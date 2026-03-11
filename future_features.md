# My Health Memoir: Future Roadmap & Features

This document outlines the planned features, enhancements, and strategic goals for My Health Memoir. It is organized by functional area to ensure a clean development path.

---

## 🚀 High Priority: Core Feature Enhancements

### 1. Secure In-App Document Viewing
- **Goal**: Prevent revealing raw Firebase URLs to users.
- **Implementation**:
    - Use a custom PDF/Image viewer within the app.
    - Fetch files as Blobs or use Signed URLs with short expiration times.
    - Disable right-click/download on the viewer (where possible) to keep data within the app ecosystem.
- **User Value**: Privacy and security of sensitive medical data.

### 2. AI-Generated PDF Downloads
- **Goal**: Allow users to download chat summaries or analysis as professional PDFs.
- **Implementation**:
    - Generate PDFs server-side or using client-side libraries (like `jspdf` or `react-pdf`).
    - Provide a clear "Download PDF" button in the AI Chat interface when a summary is ready.
- **User Value**: Portability of medical insights.

### 3. AI Doctor's Visit Compiler
- **Goal**: AI synthesizes existing records into a concise "Pre-Visit Summary" for doctors.
- **Implementation**:
    - Select specific documents or episodes of care.
    - AI summarizes symptoms, medications, and recent lab results.
    - Outputs a one-page summary (Downloadable PDF).
- **User Value**: Saves time during consultations and ensures doctors get the full context.

---

## 🛠️ Management & Administration

### 4. Universal Admin Panel
- **Goal**: A dedicated interface for the app owner (Admin) to manage the entire ecosystem.
- **Features**:
    - Manage Users (View, Update, Delete).
    - Manage Patients across all users.
    - Content Management (Manage Doctor directory, hospitals).
    - Analytics (User growth, document upload stats).
- **Control**: Total CRUD (Create, Read, Update, Delete) capability for systemic data.

---

## 💰 Monetization & Subscription Tiers

We will implement a 3-tier subscription model to limit patient counts and potentially feature access.

| Tier | Patient Limit | Price (Suggested) | Features |
| :--- | :--- | :--- | :--- |
| **Free** | 2 Patients | ₹0 | Basic storage & AI chat |
| **Paid (Silver)** | 5 Patients | ₹199/mo | Unlimited storage, AI Summaries |
| **Paid Plus (Gold)**| 10 Patients | ₹499/mo | Priority AI, SMS Alerts, Premium Support |

---

## 📱 Communications & Notifications

### 5. SMS & Email Integration
- **SMS**: Integration with a provider (like Twilio or AWS SNS) for critical alerts or login OTPs.
- **Professional Email**:
    - Setup custom domain email (e.g., support@myhealthmemoir.com).
    - Configure DKIM/SPF/DMARC records for high deliverability.
    - Use professional templates for notifications (SendGrid/Postmark).

### 6. Notification System
- **Push Notifications**: For mobile (iOS/Android) via Firebase Cloud Messaging (FCM).
- **In-App Notifications**: Alerts for new document analysis, appointment reminders, or subscription updates.

---

## 🌍 Platform & Deployment

### 7. Native Mobile Apps (iOS & Android)
- **Goal**: Publish the app on App Store and Play Store.
- **Method**: Use **Capacitor** to wrap the existing web app into a native container.
- **Native Features**: Camera integration (better scanning), Biometrics (FaceID/Fingerprint), Offline storage.

### 8. Custom Domain & Branding
- **Goal**: Move away from a `.web.app` or `.firebaseapp.com` domain.
- **Focus**: Find a premium health-related domain and set up SSL/SEO.

---

## ✨ Suggestions for "Crazy Amazing" Growth (Expert Insight)

To make people truly love this app, we should consider these clean, non-distracting additions:

1.  **Biometric Lock**: Privacy is paramount. Adding a FaceID/Fingerprint lock to the app ensures that even if a phone is unlocked, health records are safe.
2.  **Health Trends Visualization**: Instead of just PDF summaries, show "Blood Sugar" or "Weight" trends on a clean, premium chart.
3.  **Family Health Wallet**: A "Share" feature where you can temporarily share a specific "Episode of Care" with a doctor or a family member via a secure, password-protected link.
4.  **Medicine Reminders (Smart)**: AI reads a prescription and automatically asks if the user wants to set up a reminder schedule for those meds.
5.  **Offline-First Experience**: Allow users to see their core health profile and latest prescription even when there is no internet (crucial for emergencies).

---

## 🚫 What to Avoid
- **User Folders**: Keep it organized via "Episodes of Care" and "Categories" to prevent a messy user-managed file system.
- **Social Features**: Avoid making it a social network; keep it a private memoir.
