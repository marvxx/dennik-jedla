/* app.js sa skladá zo src/. Tento test zlyhá, ak niekto upravil src/ a zabudol spustiť node tools/build.js. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { build } = require('../tools/build.js');

test('app.js je zložený z aktuálnych súborov v src/', () => {
  const cur = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  assert.ok(cur === build(), 'app.js nie je aktuálny. Spusti: node tools/build.js');
});
