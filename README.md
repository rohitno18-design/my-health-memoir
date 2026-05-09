# I M Smrti — Universal Health OS

Your family's complete health companion. Upload medical documents, get AI-powered summaries and translations, track vitals, and share emergency data with paramedics — all in English and Hindi.

## Features

- **AI Document Analysis** — Upload PDFs, images, and reports. Gemini AI summarizes and translates them into 8 languages.
- **AI Health Chat** — An intelligent assistant with 10 medical tools: vitals tracking, doctor visit prep, PDF health reports, and more.
- **Emergency Pulse** — SOS QR code on your lock screen. Paramedics scan it to see blood type, allergies, meds, and ICE contacts — no login needed.
- **Vitals Tracking** — Log and chart blood sugar, blood pressure, and heart rate with interactive Recharts graphs.
- **Family Health Profiles** — Manage 35+ fields per patient across 5 tabs (overview, timeline, vitals, appointments, emergency).
- **Life Timeline** — Log medical events: visits, diagnoses, procedures, milestones, and notes.
- **Offline-First PWA** — Works without internet. Install on any device. iOS and Android ready via Capacitor.
- **Multi-Language** — Full English and Hindi (Hinglish) support with live language toggle.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite 7 |
| Styling | Tailwind CSS, shadcn/ui, Framer Motion |
| Backend | Firebase (Auth, Firestore, Storage, Hosting) |
| AI | Google Gemini 2.5 Flash |
| Mobile | Capacitor 7 (Android + iOS) |
| Charts | Recharts |
| Icons | Lucide React |
| i18n | i18next + react-i18next |

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment variables (copy from .env.example)
cp .env.example .env
# Fill in your Firebase and Gemini API keys in .env

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
src/
├── components/        # Reusable UI components
│   └── dashboard/     # Dashboard bento widgets
├── contexts/          # React contexts (Auth)
├── lib/               # Firebase init, utils, audit, feature flags
├── locales/           # i18n translation files (en.json, hi.json)
├── pages/             # Route pages
│   └── admin/         # Admin panel pages
└── types/             # TypeScript type definitions
```

## Deployment

The project auto-deploys to Firebase Hosting on push to `master` via GitHub Actions. PR previews are also deployed automatically.

```bash
# Manual deploy
npm run build
firebase deploy
```

## License

Proprietary — all rights reserved.
