import fs from 'fs';
import path from 'path';

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

function extractKeys() {
  const keys = new Set();
  const srcDir = path.join(process.cwd(), 'src');
  
  walkDir(srcDir, (filePath) => {
    if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
      const content = fs.readFileSync(filePath, 'utf8');
      const regex = /t\(['"]([a-zA-Z0-9_\.]+)['"]\)/g;
      let match;
      while ((match = regex.exec(content)) !== null) {
        keys.add(match[1]);
      }
    }
  });
  
  return Array.from(keys).sort();
}

const allKeys = extractKeys();
const enPath = path.join(process.cwd(), 'src', 'locales', 'en.json');
const enData = JSON.parse(fs.readFileSync(enPath, 'utf8'));

// Check missing
const missing = [];
for (const key of allKeys) {
  const parts = key.split('.');
  let current = enData;
  let found = true;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      found = false;
      break;
    }
  }
  if (!found) {
    missing.push(key);
  }
}

console.log("Missing keys:");
console.log(missing.join('\n'));

fs.writeFileSync('missing_keys.json', JSON.stringify(missing, null, 2));
