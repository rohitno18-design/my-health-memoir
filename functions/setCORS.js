const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

admin.initializeApp({
  projectId: "im-smrti",
  storageBucket: "im-smrti.firebasestorage.app"
});

const corsConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../cors.json'), 'utf8'));

const bucket = admin.storage().bucket();
bucket.setCorsConfiguration(corsConfig)
  .then(() => {
    console.log("Successfully set CORS configuration");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Failed to set CORS:", err);
    process.exit(1);
  });
