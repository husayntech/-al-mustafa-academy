import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(__dirname, '..');
const modPath = path.join(root, 'node_modules', 'sql.js', 'dist', 'sql-wasm.js');
let src = fs.readFileSync(modPath, 'utf8');
const cjs = src.replace(/\nif \(typeof module !== 'undefined' \&\& module\.exports\) \{\n  module\.exports = exports;\n  module\.exports\.default = exports;\n\}\n/, '');
const loc = path.join(root,'node_modules','sql.js','dist');
const esc = loc.replace(/\/g, '\\');
const locStr = `'${esc}'`;
const cjsFixed = cjs.replace(
  'Na??=k.locateFile?k.locateFile("sql-wasm.wasm",za):za+"sql-wasm.wasm";',
  `Na??=k.locateFile?k.locateFile("sql-wasm.wasm",${locStr}):${locStr}+'\sql-wasm.wasm'`
);
const s = new Function('module', 'exports', 'require', '__dirname', cjsFixed);
const moduleObj = { exports: {} };
const realRequire = require;
s(moduleObj, moduleObj.exports, realRequire, root);
const initSqlJs = moduleObj.exports;
console.log('initSqlJs type:', typeof initSqlJs);
const sqlMod = initSqlJs();
console.log('sqlMod:', sqlMod);
console.log('sqlMod Database:', sqlMod.Database);
const Database = sqlMod && (sqlMod.default || sqlMod).Database;
console.log('Database type:', typeof Database);
if (typeof Database === 'function') {
  const db = new Database(fs.readFileSync(path.join(root, 'data', 'academy.db')));
  const rows = db.exec('SELECT content_key, content_value FROM site_content ORDER BY id');
  console.log('rows:', rows.length);
  for (const r of rows) console.log(r.values.join(' | '));
  db.close();
}
