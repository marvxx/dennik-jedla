/* Zloží app.js zo súborov v src/ (v abecednom poradí) do jedného celku.
   Spustenie: node tools/build.js
   Kontrola, či je app.js aktuálny (bez zápisu): node tools/build.js --check */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const srcDir = path.join(root, 'src');
const out = path.join(root, 'app.js');

const HEAD = `/* Denník jedla a trávenia – celá aplikácia. Údaje zostávajú len v telefóne (IndexedDB).
   NEUPRAVOVAŤ PRIAMO: súbor sa skladá zo súborov v src/ príkazom  node tools/build.js */
(function () {
  'use strict';
`;
const FOOT = `})();
`;

function build() {
  const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.js')).sort();
  const parts = files.map(f => {
    const t = fs.readFileSync(path.join(srcDir, f), 'utf8');
    return t.endsWith('\n') ? t : t + '\n';
  });
  return HEAD + parts.join('') + FOOT;
}

if (require.main === module) {
  const text = build();
  if (process.argv.includes('--check')) {
    const cur = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
    if (cur !== text) {
      console.error('app.js nie je aktuálny. Spusti: node tools/build.js');
      process.exit(1);
    }
    console.log('app.js je aktuálny');
  } else {
    fs.writeFileSync(out, text);
    console.log('app.js zložený z ' + fs.readdirSync(srcDir).filter(f => f.endsWith('.js')).length + ' súborov');
  }
}

module.exports = { build };
