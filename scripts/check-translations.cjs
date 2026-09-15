const fs = require('fs');
const path = require('path');
const babel = require('../client/node_modules/@babel/core');
const original = require.extensions['.js'];
require.extensions['.js'] = (module, filename) => {
  if (filename.includes(path.join('client', 'src', 'i18n'))) {
    const result = babel.transformSync(fs.readFileSync(filename, 'utf8'), { babelrc: false, configFile: false, plugins: [require.resolve('../client/node_modules/@babel/plugin-transform-modules-commonjs'), require.resolve('../client/node_modules/@babel/plugin-transform-react-jsx')] });
    module._compile(result.code, filename);
  } else original(module, filename);
};
const { translate } = require('../client/src/i18n');
const audit = require('./localization-audit.json');
const untranslated = audit.map(([s]) => s).filter(s => translate(s, 'fa') === s || translate(s, 'tr') === s);
const localizedObject = { en: 'Properties', fa: 'املاک', tr: 'Gayrimenkuller' };
const nestedLocalizedObject = { label: localizedObject };
if (translate(localizedObject, 'fa') !== localizedObject.fa || translate(nestedLocalizedObject, 'tr') !== localizedObject.tr) {
  throw new Error('Localized object values are not resolved correctly.');
}
if ([translate(localizedObject, 'fa'), translate(nestedLocalizedObject, 'tr')].some(value => String(value).includes('[object Object]'))) {
  throw new Error('Localized objects must never render as [object Object].');
}
if (translate({ en: 'English-only label' }, 'fa') === 'English-only label' || translate({ en: 'English-only label' }, 'tr') === 'English-only label') {
  throw new Error('A missing localized object value must not leak English into Persian or Turkish.');
}
console.log(JSON.stringify(untranslated));
if (untranslated.length) process.exitCode = 1;
