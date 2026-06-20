const fs = require('fs');
const files = ['src/pages/GlobalTimelinePage.tsx', 'src/pages/DocumentsPage.tsx', 'src/pages/PatientsPage.tsx'];
let allKeys = new Set();
files.forEach(f => {
    try {
        const text = fs.readFileSync(f, 'utf8');
        const matches = text.match(/t\(['"`]timeline\.[^'"`]+['"`]\)/g);
        if (matches) {
            matches.forEach(m => allKeys.add(m));
        }
    } catch (e) {}
});
console.log(Array.from(allKeys));
