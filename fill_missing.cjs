const fs = require('fs');
const path = require('path');

const missingOps = JSON.parse(fs.readFileSync('missing_keys.json', 'utf8'));

// Filter out html tags from the extractor mistake
const missing = missingOps.filter(m => processKeyValid(m));

function processKeyValid(k) {
  if (k === 'div' || k === 'search' || k === 'iframe' || k === 'patientId') return false;
  return k.includes('.');
}

const enPath = path.join(process.cwd(), 'src', 'locales', 'en.json');
const hiPath = path.join(process.cwd(), 'src', 'locales', 'hi.json');

const enData = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const hiData = JSON.parse(fs.readFileSync(hiPath, 'utf8'));

function setDeep(obj, pathString, value) {
  const parts = pathString.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current)) {
      current[part] = {};
    }
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
}

function generateEnglishLabel(key) {
  const parts = key.split('.');
  const last = parts[parts.length - 1];
  switch(last) {
    case 'uploadBtn': return 'Upload Document';
    case 'disclaimer': return 'AI generates information for general guidance. Consult doctors for critical care.';
    case 'helpDesc': return 'Get smart answers about your health data.';
    case 'howCanIHelp': return 'How can I assist you with your health today?';
    case 'family': return 'Family Profiles';
    case 'pulse': return 'Emergency Pulse';
    case 'vitals': return 'Health Vitals';
    case 'stable': return 'Stable';
    case 'stability': return 'Stability Level';
    case 'yes': return 'Yes';
    case 'no': return 'No';
    case 'cancel': return 'Cancel';
    case 'sendCode': return 'Send Code';
    default:
      // Camels to words
      const words = last.replace(/([A-Z])/g, ' $1');
      return words.charAt(0).toUpperCase() + words.slice(1);
  }
}

function generateHindiLabel(key) {
   const parts = key.split('.');
  const last = parts[parts.length - 1];
  switch(last) {
    case 'uploadBtn': return 'डॉक्युमेंट अपलोड करें';
    case 'disclaimer': return 'AI सामान्य जानकारी देता है। गंभीर देखभाल के लिए डॉक्टरों से परामर्श लें।';
    case 'helpDesc': return 'अपने स्वास्थ्य डेटा के बारे में स्मार्ट उत्तर प्राप्त करें।';
    case 'howCanIHelp': return 'आज मैं आपके स्वास्थ्य में कैसे मदद कर सकता हूँ?';
    case 'family': return 'फैमिली प्रोफाइल';
    case 'pulse': return 'इमरजेंसी पल्स';
    case 'vitals': return 'हेल्थ वाइटल्स';
    case 'stable': return 'स्थिर (Stable)';
    case 'stability': return 'स्थिति (Stability)';
    case 'yes': return 'हाँ (Yes)';
    case 'no': return 'नहीं (No)';
    case 'cancel': return 'रद्द करें (Cancel)';
    case 'sendCode': return 'कोड भेजें';
    default:
      // Camels to words
      const words = last.replace(/([A-Z])/g, ' $1');
      return words.charAt(0).toUpperCase() + words.slice(1);
  }
}


// Additionally, inject the specific keys the user mentioned that might not be in the missing keys list due to truncation or missed regex
const manualKeys = [
  'dashboard.family',
  'dashboard.pulse',
  'dashboard.vitals',
  'dashboard.stability',
  'dashboard.stable',
  'dashboard.uploadBtn',
  'emergency.organdonor',
  'patient.yes',
  'patient.no',
  'docs.allPatients',
  'documents.allPatients',
  'aiChat.disclaimer',
  'aiChat.howCanIHelp',
  'aiChat.help',
  'aiChat.desc',
  'aiChat.helpDesc'
];

const allToFill = [...new Set([...missing, ...manualKeys])];

for (const key of allToFill) {
  const enVal = generateEnglishLabel(key);
  const hiVal = generateHindiLabel(key);
  setDeep(enData, key, enVal);
  setDeep(hiData, key, hiVal);
}

fs.writeFileSync(enPath, JSON.stringify(enData, null, 2), 'utf8');
fs.writeFileSync(hiPath, JSON.stringify(hiData, null, 2), 'utf8');

console.log('Fixed keys: ', allToFill.length);
