const fs = require('fs');

function updateJson(file, updates) {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const [path, value] of Object.entries(updates)) {
        const parts = path.split('.');
        let current = data;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) current[parts[i]] = {};
            current = current[parts[i]];
        }
        current[parts[parts.length - 1]] = value;
    }
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

updateJson('src/locales/en.json', {
    'documents.addTimelineError': 'Failed to add event',
    'documents.addToTimeline': 'Add to Events',
    'documents.linkedTimeline': 'Linked Events',
    'patients.lifeTimeline': 'Life Events'
});

updateJson('src/locales/hi.json', {
    'documents.addTimelineError': 'इवेंट्स में जोड़ने में विफल',
    'documents.addToTimeline': 'इवेंट्स में जोड़ें',
    'documents.linkedTimeline': 'लिंक्ड इवेंट्स',
    'patients.lifeTimeline': 'लाइफ इवेंट्स'
});

console.log("Updated both json files");
