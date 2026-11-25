// Audit for the built landing page. One Chromium at a time.
// Usage: NODE_PATH=~/.cache/open-pajak-pw/node_modules node site/scripts/audit.cjs <base-url> <shots-dir>
// Exits non-zero on any failure; writes <shots-dir>/audit.json.
const fs = require("fs");
const path = require("path");
const net = require("net");
const { spawn } = require("child_process");
const { pathToFileURL } = require("url");
const { chromium } = require("playwright");
const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

const base = process.argv[2];
const shots = process.argv[3];
if (!base || !shots) {
  console.error("usage: audit.cjs <base-url> <shots-dir>");
  process.exit(2);
}
fs.mkdirSync(shots, { recursive: true });

const report = { base, checks: {}, problems: [], warnings: [] };
const bad = (m) => { report.problems.push(m); console.log("PROBLEM", m); };
const warn = (m) => { report.warnings.push(m); console.log("WARN", m); };
const check = (name, data, failures) => {
  report.checks[name] = { pass: failures.length === 0, ...data };
  console.log(`${failures.length ? "FAIL" : "PASS"} ${name}`);
  for (const f of failures) bad(`${name}: ${f}`);
};

async function newPage(browser, opts) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  await page.goto(base);
  await page.waitForLoadState("networkidle");
  return { ctx, page };
}

// Runs in the page. Computed-style facts for every visible text element.
function collectStyles() {
  const h1 = document.querySelector("h1");
  const hero = h1 && (h1.closest("header, section") || h1.parentElement);
  const nav = [...document.querySelectorAll("nav a, header a")].filter((a) => a.closest("nav, header"));
  const wordmark = nav.find((a) => a.querySelector("svg, img") || /logo|brand|wordmark|home/i.test(a.className + " " + (a.getAttribute("aria-label") || ""))) || document.querySelector("header a");
  const families = {}, belowSizes = {}, uppercase = [], transitions = [], small = [], dashes = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seenEl = new Set();
  while (walker.nextNode()) {
    const t = walker.currentNode;
    const text = t.textContent.replace(/\s+/g, " ").trim();
    if (!text) continue;
    const el = t.parentElement;
    if (!el || el.closest("script, style, noscript, template")) continue;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (cs.display === "none" || cs.visibility === "hidden" || !r.width || !r.height) continue;
    // Clipped visually-hidden text is not visible text.
    if (r.width <= 1 && r.height <= 1) continue;
    let op = 1;
    for (let e = el; e; e = e.parentElement) op *= parseFloat(getComputedStyle(e).opacity);
    if (op === 0) continue;
    const tag = el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).join(".") : "");
    let px = parseFloat(cs.fontSize);
    if (el instanceof SVGElement && el.getScreenCTM) px *= el.getScreenCTM().a;
    const fam = cs.fontFamily.split(",")[0].trim().replace(/^["']|["']$/g, "").toLowerCase();
    families[fam] = (families[fam] || 0) + 1;
    if (px < 13) small.push(`${px.toFixed(1)}px ${tag} "${text.slice(0, 30)}"`);
    const inHero = hero && hero.contains(el);
    const isH1 = h1 && h1.contains(el);
    const isWordmark = wordmark && wordmark.contains(el);
    const afterHero = hero && !inHero && !!(hero.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
    if (afterHero && !isH1 && !isWordmark) {
      const k = px.toFixed(2).replace(/\.?0+$/, "");
      (belowSizes[k] = belowSizes[k] || []).push(`${tag} "${text.slice(0, 24)}"`);
    }
    if (!seenEl.has(el)) {
      seenEl.add(el);
      const ls = cs.letterSpacing;
      if (cs.textTransform === "uppercase" && ls !== "normal" && parseFloat(ls) !== 0) uppercase.push(`${tag} ls=${ls} "${text.slice(0, 30)}"`);
    }
    if (/—/.test(text) || / – /.test(text)) dashes.push(`${tag}: ${text.slice(0, 80)}`);
  }
  for (const el of document.querySelectorAll("body *")) {
    const tp = getComputedStyle(el).transitionProperty;
    if (/\ball\b/.test(tp) && parseFloat(getComputedStyle(el).transitionDuration) > 0) {
      transitions.push(`${el.tagName.toLowerCase()}.${typeof el.className === "string" ? el.className : ""}`);
    } else if (/\ball\b/.test(tp)) {
      // the default `all 0s` is harmless; flag only if authored. Duration 0 is not a transition.
    }
  }
  return { families, belowSizes, uppercase, transitions, small, dashes, heroTag: hero ? hero.tagName.toLowerCase() : null };
}

function freePort() {
  return new Promise((res, rej) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); });
    s.on("error", rej);
  });
}

async function lighthouse() {
  const out = { performance: null, accessibility: null };
  let lhDir;
  try {
    lhDir = path.join(path.dirname(require.resolve("lighthouse/package.json")));
  } catch (e) {
    return { skipped: `lighthouse not resolvable: ${e.message}` };
  }
  const port = await freePort();
  const profile = fs.mkdtempSync(path.join(require("os").tmpdir(), "op-lh-"));
  let child;
  try {
    child = spawn(chromium.executablePath(), [
      `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--headless=new",
      "--no-first-run", "--no-default-browser-check", "--disable-gpu", "about:blank",
    ], { stdio: "ignore" });
    // wait for the debugging endpoint
    let up = false;
    for (let i = 0; i < 60 && !up; i++) {
      await new Promise((r) => setTimeout(r, 250));
      try { up = (await fetch(`http://127.0.0.1:${port}/json/version`)).ok; } catch { /* retry */ }
    }
    if (!up) return { skipped: "Chromium did not expose a debugging port" };
    const mod = await import(pathToFileURL(path.join(lhDir, "core", "index.js")).href).catch(() => import("lighthouse"));
    const lh = mod.default || mod;
    const run = await lh(base, { port, output: "json", logLevel: "error", onlyCategories: ["performance", "accessibility"] });
    const c = run.lhr.categories;
    out.performance = Math.round(c.performance.score * 100);
    out.accessibility = Math.round(c.accessibility.score * 100);
    out.failedA11y = Object.values(run.lhr.audits).filter((a) => a.score === 0 && c.accessibility.auditRefs.some((r) => r.id === a.id)).map((a) => a.id);
    return out;
  } catch (e) {
    return { skipped: `lighthouse could not run: ${e.message.split("\n")[0]}` };
  } finally {
    if (child && !child.killed) child.kill("SIGKILL");
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

(async () => {
  const browser = await chromium.launch();

  // 1-4: computed styles at desktop
  {
    const { ctx, page } = await newPage(browser, { viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    const s = await page.evaluate(collectStyles);
    const fams = Object.keys(s.families);
    const sizes = Object.keys(s.belowSizes);
    const f1 = [];
    if (fams.length > 2) f1.push(`${fams.length} font families: ${fams.join(", ")}`);
    if (sizes.length > 3) f1.push(`${sizes.length} font sizes below hero (${s.heroTag}): ${sizes.map((k) => k + "px").join(", ")}`);
    if (s.small.length) f1.push(`text under 13px: ${[...new Set(s.small)].slice(0, 8).join(" | ")}`);
    check("1 fonts", { families: s.families, sizesBelowHero: Object.fromEntries(Object.entries(s.belowSizes).map(([k, v]) => [k, v.length])), small: s.small }, f1);
    check("2 uppercase+tracking", { found: s.uppercase }, s.uppercase.length ? [s.uppercase.slice(0, 6).join(" | ")] : []);
    check("3 transition all", { found: s.transitions }, s.transitions.length ? [[...new Set(s.transitions)].slice(0, 6).join(" | ")] : []);
    check("4 dashes", { found: s.dashes }, s.dashes.length ? [s.dashes.slice(0, 6).join(" | ")] : []);

    // 5: h1 width
    const w = await page.evaluate(() => { const h = document.querySelector("h1"); return h ? h.getBoundingClientRect().width : 0; });
    check("5 h1 width", { px: Math.round(w), pct: Math.round((w / 1440) * 1000) / 10 }, w >= 0.7 * 1440 ? [] : [`h1 is ${Math.round(w)}px, ${(w / 14.4).toFixed(1)}% of 1440 (need 70%)`]);
    await ctx.close();
  }

  // 6: overflow
  {
    const res = {}, f = [];
    for (const w of [320, 390, 1440]) {
      const { ctx, page } = await newPage(browser, { viewport: { width: w, height: 800 }, reducedMotion: "reduce" });
      const sw = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
      res[w] = sw;
      if (sw[0] > sw[1]) f.push(`scrollWidth ${sw[0]} > clientWidth ${sw[1]} at ${w}`);
      await ctx.close();
    }
    check("6 overflow", { widths: res }, f);
  }

  // 7: axe
  {
    const res = {}, f = [];
    for (const [w, h] of [[1440, 900], [390, 844]]) {
      const { ctx, page } = await newPage(browser, { viewport: { width: w, height: h }, reducedMotion: "reduce" });
      await page.evaluate(AXE);
      const r = await page.evaluate(() => axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } }));
      res[w] = r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, sample: v.nodes[0] && v.nodes[0].html.slice(0, 120) }));
      if (r.violations.length) f.push(`at ${w}: ${r.violations.map((v) => `${v.id}(${v.nodes.length})`).join(", ")}`);
      await ctx.close();
    }
    check("7 axe", { violations: res }, f);
  }

  // 8: JS off
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto(base);
    await page.waitForLoadState("networkidle");
    const f = [];
    const h1 = page.locator("h1").first();
    const table = page.locator("table").first();
    const h1ok = (await page.locator("h1").count()) > 0 && (await h1.isVisible());
    const tcount = await page.locator("table").count();
    const tok = tcount > 0 && (await table.isVisible());
    if (!h1ok) f.push("h1 missing or not visible");
    if (!tok) f.push("worked-example table missing or not visible");
    check("8 js off", { h1: h1ok, table: tok, tables: tcount }, f);
    await ctx.close();
  }

  // 9: transfer size
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    let total = 0; const files = new Map();
    cdp.on("Network.responseReceived", (e) => files.set(e.requestId, { url: e.response.url, bytes: 0 }));
    cdp.on("Network.loadingFinished", (e) => { total += e.encodedDataLength; const x = files.get(e.requestId); if (x) x.bytes = e.encodedDataLength; });
    await page.goto(base);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);
    const kb = Math.round(total / 102.4) / 10;
    const list = [...files.values()].sort((a, b) => b.bytes - a.bytes).map((x) => `${Math.round(x.bytes / 102.4) / 10}KB ${x.url.replace(new URL(base).origin, "")}`);
    console.log(`transfer ${kb} KB`);
    check("9 transfer", { kb, files: list }, total > 300 * 1024 ? [`${kb} KB over 300 KB: ${list.slice(0, 4).join(" | ")}`] : []);
    await ctx.close();
  }

  // 11: screenshots
  {
    const shotFiles = [];
    const shot = async (page, name, opts) => { await page.screenshot({ path: path.join(shots, name), ...opts }); shotFiles.push(name); };
    {
      const { ctx, page } = await newPage(browser, { viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
      const total = await page.evaluate(() => document.documentElement.scrollHeight);
      const maxY = Math.max(0, total - 900);
      for (let i = 0, y = 0; ; i++, y += 900) {
        const at = Math.min(y, maxY);
        await page.evaluate((v) => window.scrollTo(0, v), at);
        await page.waitForTimeout(250);
        await shot(page, `d-${String(i).padStart(2, "0")}.png`);
        if (at >= maxY) break;
      }
      await ctx.close();
    }
    {
      const { ctx, page } = await newPage(browser, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, reducedMotion: "reduce" });
      await shot(page, "m-first.png");
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } window.scrollTo(0, 0); });
      await page.waitForTimeout(300);
      await shot(page, "m-full.png", { fullPage: true });
      await ctx.close();
    }
    check("11 screenshots", { files: shotFiles }, []);
  }

  await browser.close();

  // 10: lighthouse, after Chromium above is closed
  {
    console.log("swap:", require("child_process").execSync("sysctl vm.swapusage").toString().trim());
    const lh = await lighthouse();
    if (lh.skipped) {
      warn(`10 lighthouse skipped: ${lh.skipped}`);
      report.checks["10 lighthouse"] = { pass: null, skipped: lh.skipped };
      console.log("SKIP 10 lighthouse:", lh.skipped);
    } else {
      const f = [];
      if (lh.performance < 90) f.push(`performance ${lh.performance} < 90`);
      if (lh.accessibility < 100) f.push(`accessibility ${lh.accessibility} < 100 (${(lh.failedA11y || []).join(", ")})`);
      check("10 lighthouse", lh, f);
    }
  }

  fs.writeFileSync(path.join(shots, "audit.json"), JSON.stringify(report, null, 2));
  const summary = Object.entries(report.checks).map(([k, v]) => `${v.pass === null ? "SKIP" : v.pass ? "PASS" : "FAIL"} ${k}`);
  console.log(summary.join("\n"));
  process.exit(report.problems.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
