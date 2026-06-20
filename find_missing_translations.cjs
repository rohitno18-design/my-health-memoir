const fs = require('fs');
const path = require('path');

const tsxFiles = [];

function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walk(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            tsxFiles.push(fullPath);
        }
    }
}

walk('src/components');
walk('src/pages');

const enJson = JSON.parse(fs.readFileSync('src/locales/en.json', 'utf8'));

const missingKeys = new Set();
const foundKeys = new Set();

const regex1 = /t\(\s*["']([^"']+)["']/g;
const regex2 = /t\(\s*`([^`$]+)`/g;

for (const file of tsxFiles) {
    const content = fs.readFileSync(file, 'utf8');
    
    let match;
    while ((match = regex1.exec(content)) !== null) {
        const key = match[1];
        const parts = key.split('.');
        if (parts.length === 2) {
            if (!enJson[parts[0]] || enJson[parts[0]][parts[1]] === undefined) {
                missingKeys.add(key);
            } else {
                foundKeys.add(key);
            }
        }
    }
    
    while ((match = regex2.exec(content)) !== null) {
        const key = match[1];
        const parts = key.split('.');
        if (parts.length === 2) {
            if (!enJson[parts[0]] || enJson[parts[0]][parts[1]] === undefined) {
                missingKeys.add(key);
            } else {
                foundKeys.add(key);
            }
        }
    }
}

console.log("MISSING KEYS:");
console.log(Array.from(missingKeys));
