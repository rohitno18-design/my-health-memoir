const fs = require('fs');
const path = require('path');
const localesDir = 'src/locales';

const files = fs.readdirSync(localesDir);

for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const filePath = path.join(localesDir, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    if (data.events) {
        data.timeline = {
            ...data.timeline,
            ...data.events,
            timelineDesc: data.events.eventsDesc || data.events.timelineDesc || "Comprehensive medical journey and milestones",
        };
        delete data.events;
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        console.log(`Fixed ${file}`);
    }
}
