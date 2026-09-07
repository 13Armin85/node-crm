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
console.log(JSON.stringify(untranslated));
if (untranslated.length) process.exitCode = 1;
