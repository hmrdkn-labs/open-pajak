// Renders site/public from site/src and site/data. No dependencies.
// The page is complete without JavaScript: the default ledger, the figures and the GitHub counts are
// written here, from data/pph21-scenarios.json (made by scripts/scenarios.ts from the app's own rule
// code) and data/github.json (made by scripts/snapshot.sh).
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

// ---- data ---------------------------------------------------------------------------------------
const scen = JSON.parse(read(join(root, "data/pph21-scenarios.json")));
let gh = null;
try { gh = JSON.parse(read(join(root, "data/github.json"))); } catch { gh = null; }

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const fmtDate = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
const group = (n) => String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const rp = (n) => `Rp ${group(n)}`;
const signed = (n) => (n < 0 ? `\u2212${group(n)}` : group(n));

// The app prints some strings its own way. Show them in this page's style, never change a figure:
// Indonesian thousands dots become commas, a spaced en dash becomes "to", the Indonesian band label
// is spelled in English.
const clean = (s) => String(s)
  .replace(/\b\d{1,3}(?:\.\d{3})+\b/g, (m) => m.replace(/\./g, ","))
  .replace(/Lapisan PKP/g, "Taxable income band")
  .replace(/ \u2013 /g, " to ");

const PTKP_NAME = { "TK/0": "TK/0 single, no dependants", "K/0": "K/0 married, no dependants", "K/2": "K/2 married, two dependants" };

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
    row("Withheld each month, January to November", rp(s.monthlyTer), ' class="lead"'),
    row("December adjustment", rp(s.decemberAdjustment)),
    row("PPh 21 for the year", rp(s.totalTaxYear)),
  ].join("\n");
}
const caption = (s) => `PPh 21 ledger for a monthly gross of ${rp(s.gross)} and PTKP ${s.ptkp}`;

const DEFAULT_ID = "15000000-K/0"; // the app's own sample form: Rp 15,000,000 a month, K/0
const dflt = scen.scenarios.find((s) => s.id === DEFAULT_ID);
if (!dflt) throw new Error(`no scenario ${DEFAULT_ID}`);
const grosses = [...new Set(scen.scenarios.map((s) => s.gross))];
const ptkps = [...new Set(scen.scenarios.map((s) => s.ptkp))];
const options = (vals, sel, label) => vals.map((v) => `              <option value="${esc(v)}"${v === sel ? " selected" : ""}>${esc(label(v))}</option>`).join("\n");

const scenJson = {};
for (const s of scen.scenarios) scenJson[`${s.gross}|${s.ptkp}`] = { ledger: ledger(s), figures: figures(s), caption: caption(s) };
const scenUrl = emit("scenarios.json", Buffer.from(JSON.stringify(scenJson)));

// ---- pictures -----------------------------------------------------------------------------------
function picture({ name, widths, w, h, sizes, alt, cls, priority }) {
  const set = (ext) => widths.map((x) => `${urls.get(`img/${name}-${x}.${ext}`)} ${x}w`).join(", ");
  const fallback = urls.get(`img/${name}-${widths[widths.length - 1]}.webp`);
  return `<picture class="${cls}"><source type="image/avif" srcset="${set("avif")}" sizes="${sizes}"><source type="image/webp" srcset="${set("webp")}" sizes="${sizes}">` +
    `<img src="${fallback}" width="${w}" height="${h}" alt="${esc(alt)}" ${priority ? 'fetchpriority="high"' : 'loading="lazy" decoding="async"'}></picture>`;
}
const heroPic = picture({
  name: "hero", widths: [640, 1024, 1536], w: 1536, h: 864, sizes: "(min-width: 1280px) 1280px, 100vw", cls: "stage", priority: true,
  alt: "Illustration: a fanned stack of blank tax forms with a calculator, a gold paper clip and a loose slip on a navy desk.",
});
const handbookPic = picture({
  name: "handbook", widths: [640, 1024], w: 1024, h: 683, sizes: "(min-width: 900px) 50vw, 100vw", cls: "art",
  alt: "Illustration: an open reference handbook with ruled white pages, blue-grey index tabs and a gold ribbon bookmark on a navy surface.",
});
const receiptsPic = picture({
  name: "receipts", widths: [480, 800], w: 800, h: 1200, sizes: "(min-width: 900px) 40vw, 100vw", cls: "art tall",
  alt: "Illustration: a printed receipt with a gold paper clip laid over a spreadsheet printout, next to a closed laptop on a pale desk.",
});

// ---- calculators --------------------------------------------------------------------------------
const ROUTES = [
  ["PPh 21/26", "/pph21", "Employees, non-employees and non-residents."],
  ["PPh 22", "/pph22", "Imports, oil and gas, state-owned enterprise purchases and special cases."],
  ["PPh 23", "/pph23", "Technical services, consulting, equipment lease, dividends and interest."],
  ["PPh 4(2)", "/pph4-2", "Final tax on land lease, construction, restaurants and PP 23 small businesses."],
  ["PPN", "/ppn", "VAT, with the tax base worked out for inclusive or exclusive pricing."],
  ["PPNBM", "/ppnbm", "Luxury goods sales tax on vehicles, jewellery and premium electronics."],
];
const routes = ROUTES.map(([name, path, desc]) =>
  `      <li><a href="https://openpajak.hamardikan.com${path}"><span class="name">${esc(name)}</span><span class="desc">${esc(desc)}</span><span class="path">${esc(path)}</span></a></li>`).join("\n");

// ---- page values --------------------------------------------------------------------------------
let sha = "unknown";
try { sha = execSync("git rev-parse --short HEAD", { cwd: root, encoding: "utf8" }).trim() || sha; } catch { /* keep unknown */ }
const snapDate = fmtDate(gh?.generated_at) ?? "an unknown date";
const starsLine = gh && gh.stars != null
  ? `The repository has ${gh.stars} stars and ${gh.forks} forks on GitHub, counted on ${snapDate}${fmtDate(gh.pushed_at) ? `. The last push was on ${fmtDate(gh.pushed_at)}` : ""}.`
  : "GitHub counts are not available in this build.";

const css = read(join(src, "style.css")).replace(/@asset\/([^)\s]+)/g, (_, p) => {
  if (!urls.has(p)) throw new Error(`missing asset ${p}`);
  return urls.get(p);
});
const cssUrl = emit("style.css", Buffer.from(css));
const bootUrl = emit("boot.js", readFileSync(join(src, "boot.js")));
const appUrl = emit("app.js", readFileSync(join(src, "app.js")));

const vars = {
  css: cssUrl, boot: bootUrl, app: appUrl, scenarios_url: scenUrl,
  hero_pic: heroPic, handbook_pic: handbookPic, receipts_pic: receiptsPic,
  gross_options: options(grosses, dflt.gross, (g) => rp(g)),
  ptkp_options: options(ptkps, dflt.ptkp, (p) => PTKP_NAME[p] ?? p),
  figures: figures(dflt), ledger: ledger(dflt), caption: caption(dflt),
  routes, stars_line: esc(starsLine), branch: esc(gh?.default_branch ?? "master"),
  sha: esc(sha), builddate: fmtDate(new Date().toISOString()), snapdate: snapDate,
};
let html = read(join(src, "index.template.html"));
html = html.replace(/\{\{font:([^}]+)\}\}/g, (_, f) => { if (!urls.has(`fonts/${f}`)) throw new Error(`missing font ${f}`); return urls.get(`fonts/${f}`); });
html = html.replace(/\{\{(\w+)\}\}/g, (m, k) => { if (!(k in vars)) throw new Error(`unfilled ${m}`); return vars[k]; });
writeFileSync(join(pub, "index.html"), html);

// ---- static files -------------------------------------------------------------------------------
for (const f of ["favicon.svg", "robots.txt", "_headers"]) copyFileSync(join(src, f), join(pub, f));
writeFileSync(join(pub, "404.html"), read(join(src, "404.html")).replace("{{css}}", cssUrl));
const iso = new Date().toISOString().slice(0, 10);
writeFileSync(join(pub, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>https://open-pajak.hamardikan.com/</loc><lastmod>${iso}</lastmod></url>\n</urlset>\n`);
for (const f of ["og.png", "apple-touch-icon.png"]) if (existsSync(join(src, f))) copyFileSync(join(src, f), join(pub, f));
console.log(`built public/index.html (${(Buffer.byteLength(html) / 1024).toFixed(1)} KB), css ${cssUrl}`);
