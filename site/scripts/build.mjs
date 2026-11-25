// Renders site/public from site/src and site/data. No dependencies.
// One template (src/index.template.html) and one string table per language (src/i18n/<lang>.json):
// "/" is Indonesian, "/en/" is English, so the two pages cannot drift in design.
// The page is complete without JavaScript: the default ledger, the figures and the GitHub counts are
// written here, from data/pph21-scenarios.json (made by scripts/scenarios.ts from the app's own rule
// code, one file per language) and data/github.json (made by scripts/snapshot.sh).
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync, copyFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "src");
const pub = join(root, "public");
const assets = join(pub, "assets");

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const read = (p) => readFileSync(p, "utf8");
const hash = (buf) => createHash("sha256").update(buf).digest("hex").slice(0, 8);

// ---- assets: content-hashed names under /assets, old hashed files removed -------------------------
rmSync(assets, { recursive: true, force: true });
mkdirSync(join(assets, "fonts"), { recursive: true });
const urls = new Map(); // "fonts/x.woff2" -> "/assets/fonts/x.<hash>.woff2"
function emit(rel, buf) {
  const ext = extname(rel);
  const out = `${rel.slice(0, -ext.length)}.${hash(buf)}${ext}`;
  mkdirSync(dirname(join(assets, out)), { recursive: true });
  writeFileSync(join(assets, out), buf);
  urls.set(rel, `/assets/${out}`);
  return `/assets/${out}`;
}
for (const f of readdirSync(join(src, "assets/fonts"))) {
  if (f.endsWith(".txt")) copyFileSync(join(src, "assets/fonts", f), join(assets, "fonts", f));
  else emit(`fonts/${f}`, readFileSync(join(src, "assets/fonts", f)));
}
for (const f of readdirSync(join(src, "assets/img"))) emit(`img/${f}`, readFileSync(join(src, "assets/img", f)));

// ---- shared data --------------------------------------------------------------------------------
let gh = null;
try { gh = JSON.parse(read(join(root, "data/github.json"))); } catch { gh = null; }
let sha = "unknown";
try { sha = execSync("git rev-parse --short HEAD", { cwd: root, encoding: "utf8" }).trim() || sha; } catch { /* keep unknown */ }
const iso = new Date().toISOString().slice(0, 10);

const ORIGIN = "https://open-pajak.hamardikan.com";
const APP = "https://openpajak.hamardikan.com/";
const REPO = "https://github.com/hmrdkn-labs/open-pajak";
const PERSON = { "@type": "Person", "@id": "https://hamardikan.com/#person", name: "Azzam Muhammadi Rizqun Karima", url: "https://hamardikan.com/" };
const PAGES = [["id", "/"], ["en", "/en/"]];

const css = read(join(src, "style.css")).replace(/@asset\/([^)\s]+)/g, (_, p) => {
  if (!urls.has(p)) throw new Error(`missing asset ${p}`);
  return urls.get(p);
});
const cssUrl = emit("style.css", Buffer.from(css));
const bootUrl = emit("boot.js", readFileSync(join(src, "boot.js")));
const appUrl = emit("app.js", readFileSync(join(src, "app.js")));

const logoSvg = read(join(src, "logo.svg")).trim()
  .replace("<svg ", '<svg class="logo" aria-hidden="true" focusable="false" ');
const template = read(join(src, "index.template.html"));

// ---- pictures (alt text per language) ------------------------------------------------------------
function picture({ name, widths, w, h, sizes, alt, cls, priority }) {
  const set = (ext) => widths.map((x) => `${urls.get(`img/${name}-${x}.${ext}`)} ${x}w`).join(", ");
  const fallback = urls.get(`img/${name}-${widths[widths.length - 1]}.webp`);
  return `<picture class="${cls}"><source type="image/avif" srcset="${set("avif")}" sizes="${sizes}"><source type="image/webp" srcset="${set("webp")}" sizes="${sizes}">` +
    `<img src="${fallback}" width="${w}" height="${h}" alt="${esc(alt)}" ${priority ? 'fetchpriority="high"' : 'loading="lazy" decoding="async"'}></picture>`;
}

// ---- one page per language ----------------------------------------------------------------------
const fill = (tpl, o) => tpl.replace(/\{(\w+)\}/g, (m, k) => { if (!(k in o)) throw new Error(`unfilled ${m}`); return o[k]; });

function renderPage(lang) {
  const t = JSON.parse(read(join(src, "i18n", `${lang}.json`)));
  const scen = JSON.parse(read(join(root, `data/pph21-scenarios.${lang}.json`)));
  const dot = lang === "id" ? "." : ",";
  const group = (n) => String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, dot);
  const rp = (n) => `Rp ${group(n)}`;
  const signed = (n) => (n < 0 ? `\u2212${group(n)}` : group(n));
  const fmtDate = (isoStr) => {
    if (!isoStr) return null;
    const d = new Date(isoStr);
    return Number.isNaN(d.getTime()) ? null : `${d.getUTCDate()} ${t.months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  };

  // The app prints some strings its own way. Show them in this page's style, never change a figure.
  // English page: Indonesian thousands dots become commas, a spaced en dash becomes "to", the
  // Indonesian band label is spelled in English. Indonesian page: the figures stay as the app wrote
  // them, only a spaced en dash becomes "sampai".
  const clean = lang === "id"
    ? (s) => String(s).replace(/ \u2013 /g, " sampai ")
    : (s) => String(s)
      .replace(/\b\d{1,3}(?:\.\d{3})+\b/g, (m) => m.replace(/\./g, ","))
      .replace(/Lapisan PKP/g, "Taxable income band")
      .replace(/ \u2013 /g, " to ");

  function ledger(s) {
    let out = "";
    for (const r of s.rows) {
      if (r.variant === "spacer") continue;
      if (r.variant === "group") { out += `            <tr class="group"><th scope="rowgroup" colspan="2">${esc(clean(r.label))}</th></tr>\n`; continue; }
      const v = typeof r.value === "number" ? signed(r.value) : r.value == null ? "" : esc(r.valueType === "percent" ? `${r.value}%` : r.value);
      const note = r.note && r.note !== r.label ? `<span class="note">${esc(clean(r.note))}</span>` : "";
      const cls = r.variant ? ` class="${r.variant}"` : "";
      out += `            <tr${cls}><th scope="row">${esc(clean(r.label))}${note}</th><td class="num">${v}</td></tr>\n`;
    }
    return out.trimEnd();
  }
  function figures(s) {
    const row = (dt, dd, cls = "") => `          <div${cls}><dt>${dt}</dt><dd>${dd}</dd></div>`;
    return [
      row(t.fig_monthly, rp(s.monthlyTer), ' class="lead"'),
      row(t.fig_dec, rp(s.decemberAdjustment)),
      row(t.fig_year, rp(s.totalTaxYear)),
    ].join("\n");
  }
  const caption = (s) => fill(t.caption_tpl, { gross: rp(s.gross), ptkp: s.ptkp });

  const DEFAULT_ID = "15000000-K/0"; // the app's own sample form: Rp 15,000,000 a month, K/0
  const dflt = scen.scenarios.find((s) => s.id === DEFAULT_ID);
  if (!dflt) throw new Error(`no scenario ${DEFAULT_ID}`);
  const grosses = [...new Set(scen.scenarios.map((s) => s.gross))];
  const ptkps = [...new Set(scen.scenarios.map((s) => s.ptkp))];
  const options = (vals, sel, label) => vals.map((v) => `              <option value="${esc(v)}"${v === sel ? " selected" : ""}>${esc(label(v))}</option>`).join("\n");

  const scenJson = {};
  for (const s of scen.scenarios) scenJson[`${s.gross}|${s.ptkp}`] = { ledger: ledger(s), figures: figures(s), caption: caption(s) };
  const scenUrl = emit(`scenarios.${lang}.json`, Buffer.from(JSON.stringify(scenJson)));

  const routes = t.routes.map(([name, path, desc]) =>
    `      <li><a href="${APP.slice(0, -1)}${path}"><span class="name">${esc(name)}</span><span class="desc">${esc(desc)}</span><span class="path">${esc(path)}</span></a></li>`).join("\n");

  const snapDate = fmtDate(gh?.generated_at) ?? t.unknown_date;
  const starsLine = gh && gh.stars != null
    ? [fill(t.stars_tpl, { stars: gh.stars, forks: gh.forks, date: snapDate }), fmtDate(gh.pushed_at) ? fill(t.push_tpl, { push: fmtDate(gh.pushed_at) }) : ""].filter(Boolean).join(" ")
    : t.stars_none;

  // ---- head: title, description, canonical, hreflang, Open Graph, JSON-LD ----
  const url = `${ORIGIN}${t.path}`;
  const image = `${ORIGIN}/${t.og_image}`;
  const alt = () => PAGES.map(([l, p]) => `<link rel="alternate" hreflang="${l}" href="${ORIGIN}${p}">`).join("\n") + `\n<link rel="alternate" hreflang="x-default" href="${ORIGIN}/en/">`;
  const other = lang === "id" ? "en_GB" : "id_ID";
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", "@id": `${url}#website`, url, name: "Open Pajak", inLanguage: lang, publisher: { "@id": PERSON["@id"] } },
      {
        "@type": "WebApplication", "@id": `${APP}#app`, name: "Open Pajak", url: APP, description: t.app_description,
        applicationCategory: "FinanceApplication", operatingSystem: "Any (web browser)", browserRequirements: t.browser_requirements,
        inLanguage: lang, sameAs: [REPO], author: { "@id": PERSON["@id"] }, publisher: { "@id": PERSON["@id"] },
      },
      PERSON,
    ],
  };
  const ld = JSON.stringify(graph).replace(/</g, "\\u003c");
  const headMeta = [
    `<title>${esc(t.title)}</title>`,
    `<meta name="description" content="${esc(t.description)}">`,
    `<meta name="theme-color" content="#0a2540">`,
    `<link rel="canonical" href="${url}">`,
    alt(),
    `<link rel="icon" href="/favicon.svg" type="image/svg+xml">`,
    `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="Open Pajak">`,
    `<meta property="og:title" content="${esc(t.og_title)}">`,
    `<meta property="og:description" content="${esc(t.og_description)}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:locale" content="${t.og_locale}">`,
    `<meta property="og:locale:alternate" content="${other}">`,
    `<meta property="og:image" content="${image}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="${esc(t.og_alt)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<script type="application/ld+json">${ld}</script>`,
  ].join("\n");

  const vars = {
    ...Object.fromEntries(Object.entries(t).filter(([, v]) => typeof v === "string")),
    head_meta: headMeta, logo: logoSvg,
    css: cssUrl, boot: bootUrl, app: appUrl, scenarios_url: scenUrl,
    hero_pic: picture({ name: "hero", widths: [640, 1024, 1536], w: 1536, h: 864, sizes: "(min-width: 1280px) 1280px, 100vw", cls: "stage", priority: true, alt: t.hero_alt }),
    handbook_pic: picture({ name: "handbook", widths: [640, 1024], w: 1024, h: 683, sizes: "(min-width: 900px) 50vw, 100vw", cls: "art", alt: t.handbook_alt }),
    receipts_pic: picture({ name: "receipts", widths: [480, 800], w: 800, h: 1200, sizes: "(min-width: 900px) 40vw, 100vw", cls: "art tall", alt: t.receipts_alt }),
    gross_options: options(grosses, dflt.gross, (g) => rp(g)),
    ptkp_options: options(ptkps, dflt.ptkp, (p) => t.ptkp_names[p] ?? p),
    figures: figures(dflt), ledger: ledger(dflt), caption: caption(dflt),
    routes, stars_line: esc(starsLine), branch: esc(gh?.default_branch ?? "master"),
    sha: esc(sha), builddate: fmtDate(new Date().toISOString()), snapdate: snapDate,
    load_error: esc(t.load_error),
  };
  // Strings may carry {branch}, {sha} and similar slots of their own: fill those first.
  for (const k of ["prose_sample", "foot_deploy"]) vars[k] = fill(vars[k], vars);
  let html = template;
  html = html.replace(/\{\{font:([^}]+)\}\}/g, (_, f) => { if (!urls.has(`fonts/${f}`)) throw new Error(`missing font ${f}`); return urls.get(`fonts/${f}`); });
  html = html.replace(/\{\{(\w+)\}\}/g, (m, k) => { if (!(k in vars)) throw new Error(`unfilled ${m}`); return vars[k]; });
  return { html, t };
}

for (const [lang, path] of PAGES) {
  const { html } = renderPage(lang);
  const dir = join(pub, path);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), html);
  console.log(`built public${path}index.html (${(Buffer.byteLength(html) / 1024).toFixed(1)} KB)`);
}

// ---- static files -------------------------------------------------------------------------------
for (const f of ["favicon.svg", "robots.txt", "_headers", "_redirects"]) copyFileSync(join(src, f), join(pub, f));
writeFileSync(join(pub, "404.html"), read(join(src, "404.html")).replace("{{css}}", cssUrl));
const altLinks = [...PAGES.map(([l, p]) => [l, p]), ["x-default", "/en/"]]
  .map(([l, p]) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${ORIGIN}${p}"/>`).join("\n");
writeFileSync(join(pub, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
  PAGES.map(([, p]) => `  <url>\n    <loc>${ORIGIN}${p}</loc>\n    <lastmod>${iso}</lastmod>\n${altLinks}\n  </url>`).join("\n") + `\n</urlset>\n`);
for (const f of ["og.png", "og-id.png", "apple-touch-icon.png"]) copyFileSync(join(src, f), join(pub, f));
console.log(`css ${cssUrl}`);
