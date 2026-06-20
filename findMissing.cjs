const fs = require('fs');
const path = require('path');
const en = JSON.parse(fs.readFileSync('src/locales/en.json', 'utf8'));

function flattenKeys(obj, prefix = '') {
  let keys = [];
  for (const k in obj) {
    if (typeof obj[k] === 'object') {
      keys = keys.concat(flattenKeys(obj[k], prefix + k + '.'));
    } else {
      keys.push(prefix + k);
    }
  }
  return keys;
}

const allKeys = new Set(flattenKeys(en));
const missing = new Set();

function searchDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      searchDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const matches = content.matchAll(/t\(['"]([a-zA-Z0-9_\.]+)['"](?:,\s*\{.*?\})?\)/g);
      for (const match of matches) {
        const key = match[1];
        if (!allKeys.has(key) && !key.includes('{{')) {
            if (!allKeys.has(key + '_one') && !allKeys.has(key + '_other')) {
                missing.add(key);
            }
        }
      }
    }
  }
}

searchDir('src');
console.log('Missing Keys:', Array.from(missing).join(', '));
