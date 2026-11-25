// Draws src/og.png (1200x630: headline over the hero illustration) and src/apple-touch-icon.png.
// Needs Playwright: PW_MODULES=/path/to/node_modules node scripts/og.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(process.env.PW_MODULES ?? "/tmp/pw/node_modules", "x.js"));
const { chromium } = require("playwright");
const b64 = (p) => readFileSync(p).toString("base64");
const head = `data:font/woff2;base64,${b64(join(root, "src/assets/fonts/plus-jakarta-sans-latin-800-normal.woff2"))}`;
const body = `data:font/woff2;base64,${b64(join(root, "src/assets/fonts/public-sans-latin-400-normal.woff2"))}`;
const hero = `data:image/webp;base64,${b64(join(root, "src/assets/img/hero-1024.webp"))}`;

const html = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:J;font-weight:800;src:url(${head})}
@font-face{font-family:P;font-weight:400;src:url(${body})}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;background:#0a2540;color:#f4f7fa;position:relative;overflow:hidden}
img{position:absolute;left:230px;top:300px;width:1000px;mix-blend-mode:lighten}
.t{position:absolute;left:64px;right:64px;top:58px}
h1{font:800 104px/0.95 J;letter-spacing:-.04em}
p{font:400 34px/1.3 P;margin-top:22px;color:#b9c7d8}
.b{position:absolute;left:64px;bottom:44px;font:800 38px/1 J;letter-spacing:-.03em}
</style><img src="${hero}"><div class="t"><h1>Indonesian tax, worked out line by line</h1></div><div class="b">Open Pajak</div>`;

const icon = readFileSync(join(root, "src/favicon.svg"), "utf8");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
await page.waitForTimeout(300);
writeFileSync(join(root, "src/og.png"), await page.screenshot({ type: "png" }));
const ip = await browser.newPage({ viewport: { width: 180, height: 180 } });
await ip.setContent(`<style>*{margin:0}svg{width:180px;height:180px;display:block}</style>${icon}`);
writeFileSync(join(root, "src/apple-touch-icon.png"), await ip.screenshot({ type: "png" }));
await browser.close();
