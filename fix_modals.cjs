const fs = require('fs');
const path = 'src/pages/DocumentsPage.tsx';
let code = fs.readFileSync(path, 'utf8');

// Replace p-0 sm:p-4 with p-0 sm:p-4 pt-safe pb-safe in fixed inset-0 z-[110]
const lines = code.split('\n');
const fixedLines = lines.map(line => {
    if (line.includes('fixed inset-0 z-[110]') && line.includes('p-0 sm:p-4') && !line.includes('pb-safe')) {
        return line.replace('p-0 sm:p-4', 'p-0 sm:p-4 pt-safe pb-safe');
    }
    return line;
});

fs.writeFileSync(path, fixedLines.join('\n'));
console.log('Fixed modals in DocumentsPage.tsx');
