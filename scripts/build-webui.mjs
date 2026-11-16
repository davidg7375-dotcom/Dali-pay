#!/usr/bin/env node
// בונה את src/webui.generated.js: קובץ HTML יחיד עם כל התמונות מוטמעות (data URI),
// כדי שה-WebView לא יצטרך קבצים חיצוניים. מקור האמת: webui/index.src.html + webui/img/*.jpg
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'webui/index.src.html'), 'utf8');
const imgDir = path.join(root, 'webui/img');
const map = {};
for (const f of fs.readdirSync(imgDir).sort()) {
  if (!f.endsWith('.jpg')) continue;
  map[f.replace(/\.jpg$/, '')] = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(imgDir, f)).toString('base64');
}
if (!src.includes('/*IMGMAP*/{}')) throw new Error('IMGMAP placeholder missing');
const html = src.replace('/*IMGMAP*/{}', JSON.stringify(map));
fs.mkdirSync(path.join(root, 'webui/dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'webui/dist/index.html'), html);
fs.writeFileSync(path.join(root, 'src/webui.generated.js'),
  '// נוצר אוטומטית ע"י scripts/build-webui.mjs. אין לערוך ידנית.\nexport default ' + JSON.stringify(html) + ';\n');
console.log('webui built:', Object.keys(map).length, 'images,', (html.length / 1024).toFixed(0), 'KB');
