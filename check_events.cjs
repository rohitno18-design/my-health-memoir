const fs = require('fs');
const files = fs.readdirSync('src/pages').map(f => 'src/pages/' + f);
let count = 0;
files.forEach(f => {
    if (!f.endsWith('.tsx')) return;
    const txt = fs.readFileSync(f, 'utf8');
    if (txt.includes('t("events.')) {
        console.log(f, 'uses events');
        count++;
    }
});
console.log('Total files using events:', count);
