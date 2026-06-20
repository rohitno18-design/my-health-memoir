const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

db.collection('folders').where('name', 'in', ['new', 'hh', 'test hill']).get().then(snap => {
    snap.forEach(doc => doc.ref.delete());
    console.log('Deleted ' + snap.size + ' folders');
}).catch(console.error);
