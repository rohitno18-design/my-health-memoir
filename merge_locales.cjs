const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function isObject(item) {
  return (item && typeof item === 'object' && !Array.isArray(item));
}

function mergeDeep(target, ...sources) {
  if (!sources.length) return target;
  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        mergeDeep(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return mergeDeep(target, ...sources);
}

const localesDir = path.join(__dirname, 'src', 'locales');
const newEnPath = path.join(localesDir, 'en.json');
const newHiPath = path.join(localesDir, 'hi.json');

try {
  // Read exact bytes from git directly avoiding PowerShell BOM
  const oldEnRaw = execSync('git show 88da660:src/locales/en.json', { encoding: 'utf8' });
  const oldHiRaw = execSync('git show 88da660:src/locales/hi.json', { encoding: 'utf8' });
  
  const oldEn = JSON.parse(oldEnRaw);
  const oldHi = JSON.parse(oldHiRaw);

  const newEn = JSON.parse(fs.readFileSync(newEnPath, 'utf8'));
  const newHi = JSON.parse(fs.readFileSync(newHiPath, 'utf8'));

  // Merge: Target is a clone of OLD. Source is NEW. So NEW OVERRIDES OLD where there is overlap.
  const mergedEn = mergeDeep({}, oldEn, newEn);
  const mergedHi = mergeDeep({}, oldHi, newHi);

  // Write back formatted
  fs.writeFileSync(newEnPath, JSON.stringify(mergedEn, null, 2), 'utf8');
  fs.writeFileSync(newHiPath, JSON.stringify(mergedHi, null, 2), 'utf8');

  console.log("Successfully merged en.json and hi.json");

  // Output some keys to verify
  console.log("en.dashboard.uploadBtn:", mergedEn?.dashboard?.uploadBtn);
  console.log("en.patient.yes:", mergedEn?.patient?.yes);
  console.log("en.aiChat.disclaimer:", mergedEn?.aiChat?.disclaimer);

} catch (err) {
  console.error("Merge error:", err);
}
