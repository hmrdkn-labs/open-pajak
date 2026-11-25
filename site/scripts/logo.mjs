// Writes src/logo.svg: the "OP" mark from open-pajak-v1/public/favicon.svg with both letters as
// outlined paths (Inter Bold 700, 44 px, baseline y 62), so it renders the same without Inter.
// Needs opentype.js and @fontsource/inter: PW_MODULES=~/.cache/open-pajak-pw/node_modules node scripts/logo.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const mods = process.env.PW_MODULES ?? join(process.env.HOME, ".cache/open-pajak-pw/node_modules");
const require = createRequire(join(mods, "x.js"));
const opentype = require("opentype.js");

const buf = readFileSync(join(mods, "@fontsource/inter/files/inter-latin-700-normal.woff"));
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const letter = (ch, x, fill) => `  <path fill="${fill}" d="${font.getPath(ch, x, 62, 44).toPathData(2)}"/>`;

const svg = `<svg width="96" height="96" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">
  <rect width="96" height="96" rx="22" fill="#0F1E3D"/>
${letter("O", 22, "#FFFFFF")}
${letter("P", 48, "#F9C74F")}
</svg>
`;
writeFileSync(join(root, "src/logo.svg"), svg);
console.log(`wrote src/logo.svg (${svg.length} bytes)`);
