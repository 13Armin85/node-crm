const fs = require('fs');
const path = require('path');
const parser = require('../client/node_modules/@babel/parser');
const traverse = require('../client/node_modules/@babel/traverse').default;
const root = path.resolve(__dirname, '..');
const files = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(path.join(directory, entry.name)) : /\.(js|jsx)$/.test(entry.name) ? [path.join(directory, entry.name)] : []);
const strings = new Map();
for (const file of files(path.join(root, 'client/src')).filter(file => !/[\\/]i18n[\\/]|[\\/]theme[\\/]|[\\/]help[\\/]/.test(file))) {
  const source = fs.readFileSync(file, 'utf8');
  const ast = parser.parse(source, { sourceType: 'module', plugins: ['jsx'] });
  const add = value => { value = value.replace(/\s+/g, ' ').trim(); if (/[A-Za-z]/.test(value)) strings.set(value, (strings.get(value) || 0) + 1); };
  traverse(ast, {
    JSXText(p) { add(p.node.value); },
    JSXAttribute(p) { if (['placeholder', 'label', 'title', 'aria-label'].includes(p.node.name.name) && p.node.value?.type === 'StringLiteral') add(p.node.value.value); },
    ObjectProperty(p) { if (['Header', 'label'].includes(p.node.key.name) && p.node.value.type === 'StringLiteral') add(p.node.value.value); },
    CallExpression(p) { if (['required', 'email', 'min', 'max', 'matches', 'success', 'error', 'warn'].includes(p.node.callee.property?.name)) for (const arg of p.node.arguments) if (arg.type === 'StringLiteral') add(arg.value); },
  });
}
const sorted = [...strings].sort((a, b) => b[1] - a[1]);
fs.writeFileSync(path.join(__dirname, 'localization-audit.json'), JSON.stringify(sorted, null, 2));
console.log(JSON.stringify({ unique: sorted.length, strings: sorted.map(s => s[0]) }));
