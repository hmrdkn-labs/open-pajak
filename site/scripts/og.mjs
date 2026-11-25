// Draws src/og.png (English h1) and src/og-id.png (Indonesian h1), each 1200x630: headline over the
// hero illustration, the OP mark beside the "Open Pajak" wordmark at the bottom. Also draws
// src/apple-touch-icon.png (180x180) from src/logo.svg.
// Needs Playwright: PW_MODULES=~/.cache/open-pajak-pw/node_modules node scripts/og.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(process.env.PW_MODULES ?? join(process.env.HOME, ".cache/open-pajak-pw/node_modules"), "x.js"));
const { chromium } = require("playwright");
const b64 = (p) => readFileSync(p).toString("base64");
const head = `data:font/woff2;base64,${b64(join(root, "src/assets/fonts/plus-jakarta-sans-latin-800-normal.woff2"))}`;
const hero = `data:image/webp;base64,${b64(join(root, "src/assets/img/hero-1024.webp"))}`;
const logo = readFileSync(join(root, "src/logo.svg"), "utf8").replace("<svg ", '<svg class="m" ');

const card = (h1) => `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:J;font-weight:800;src:url(${head})}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;background:#0a2540;color:#f4f7fa;position:relative;overflow:hidden}
img.h{position:absolute;left:350px;top:350px;width:900px;mix-blend-mode:lighten}
.t{position:absolute;left:64px;right:64px;top:54px}
h1{font:800 86px/0.98 J;letter-spacing:-.04em;word-spacing:.1em}
.b{position:absolute;left:64px;bottom:40px;display:flex;align-items:center;gap:16px;font:800 38px/1 J;letter-spacing:-.03em}
.m{width:52px;height:52px;display:block}
</style><img class="h" src="${hero}"><div class="t"><h1>${h1}</h1></div><div class="b">${logo}<span>Open Pajak</span></div>`;

const h1 = (l) => JSON.parse(readFileSync(join(root, `src/i18n/${l}.json`), "utf8")).h1;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const [lang, file] of [["en", "og.png"], ["id", "og-id.png"]]) {
  await page.setContent(card(h1(lang)));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  writeFileSync(join(root, "src", file), await page.screenshot({ type: "png" }));
}
// Full-bleed square: iOS rounds the corners itself, and transparent corners would turn black.
const ip = await browser.newPage({ viewport: { width: 180, height: 180 } });
await ip.setContent(`<style>*{margin:0}body{background:#0F1E3D}svg{width:180px;height:180px;display:block}</style>${logo}`);
writeFileSync(join(root, "src/apple-touch-icon.png"), await ip.screenshot({ type: "png" }));
await browser.close();
