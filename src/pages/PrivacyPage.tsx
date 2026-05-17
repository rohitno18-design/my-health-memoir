import { ShieldCheck, Mail, MapPin } from "lucide-react";

export function PrivacyPage() {
    return (
        <div className="min-h-screen bg-slate-50 py-12 px-6">
            <div className="max-w-3xl mx-auto bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-slate-100">
                <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl">
                        <ShieldCheck size={28} />
                    </div>
                    <h1 className="text-3xl font-black text-slate-900">Privacy Policy</h1>
                </div>

                <div className="prose prose-slate max-w-none text-slate-600 space-y-6">
                    <p className="font-medium text-slate-800">
                        Effective Date: May 9, 2026<br/>
                        Company Name: I M Smrti
                    </p>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">1. Information We Collect</h2>
                        <p>We collect information to provide better healthcare management services. This includes:</p>
                        <ul className="list-disc pl-5 mt-2 space-y-2">
                            <li><strong>Personal Identity Info:</strong> Name, Email, Phone Number.</li>
                            <li><strong>Health Data:</strong> Vital signs, medical documents, allergies, and emergency contacts you choose to upload.</li>
                            <li><strong>AI Interactions:</strong> Conversations with our AI assistant to generate summaries.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">2. How We Use Information</h2>
                        <p>Your data is strictly used to:</p>
                        <ul className="list-disc pl-5 mt-2 space-y-2">
                            <li>Provide medical record storage and emergency SOS services.</li>
                            <li>Generate AI health insights securely.</li>
                            <li>Never, under any circumstances, sell your health data to third-party advertisers.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">3. Data Security & Storage</h2>
                        <p>We implement strict security measures including encryption in transit and at rest using industry-standard cloud providers (Google Firebase). Your SOS Medical ID is publicly accessible only if someone scans your specific QR code.</p>
                    </section>
                    
                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">4. Data Deletion</h2>
                        <p>You have the right to request the deletion of all your data. You can delete your account and all associated medical records directly within the App's Account Settings. Data is permanently deleted within 30 days of account termination.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">5. Your Data Rights</h2>
                        <p>Depending on your jurisdiction, you may have the following rights:</p>
                        <ul className="list-disc pl-5 mt-2 space-y-2">
                            <li><strong>Right to Access:</strong> Request a copy of all personal data we hold about you.</li>
                            <li><strong>Right to Rectification:</strong> Correct inaccurate or incomplete data.</li>
                            <li><strong>Right to Erasure:</strong> Request permanent deletion of your data ("Right to be Forgotten").</li>
                            <li><strong>Right to Data Portability:</strong> Receive your data in a structured, machine-readable format.</li>
                            <li><strong>Right to Object:</strong> Object to processing of your data for specific purposes.</li>
                            <li><strong>Right to Withdraw Consent:</strong> Withdraw consent at any time without affecting prior lawful processing.</li>
                        </ul>
                        <p className="mt-2">To exercise any of these rights, contact us at <strong>hii@imsmrti.app</strong>. We respond within 30 days.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">6. GDPR Compliance (EU Users)</h2>
                        <p>If you are located in the European Economic Area (EEA), we process your personal data under the following lawful bases:</p>
                        <ul className="list-disc pl-5 mt-2 space-y-2">
                            <li><strong>Consent:</strong> You have given clear consent for us to process your personal data for healthcare management.</li>
                            <li><strong>Legitimate Interest:</strong> Processing is necessary for our legitimate interests in providing the service.</li>
                            <li><strong>Legal Obligation:</strong> Processing is necessary for compliance with applicable laws.</li>
                        </ul>
                        <p className="mt-2">Data may be transferred outside the EEA to our servers in the United States and India. We ensure appropriate safeguards through Google Cloud's GDPR-compliant infrastructure and standard contractual clauses.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">7. DPDP Act (India Users)</h2>
                        <p>Under the Digital Personal Data Protection (DPDP) Act, 2023 of India:</p>
                        <ul className="list-disc pl-5 mt-2 space-y-2">
                            <li>Your personal data is processed with your consent, which you provide during account registration.</li>
                            <li>You have the right to access, correct, and erase your data at any time.</li>
                            <li>A Data Protection Officer (DPO) is available at <strong>hii@imsmrti.app</strong> for grievance redressal.</li>
                            <li>In the event of a data breach, we will notify affected users and the Data Protection Board of India as required by law.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">8. Cookies & Tracking</h2>
                        <p>This application uses essential cookies and local storage to:</p>
                        <ul className="list-disc pl-5 mt-2 space-y-2">
                            <li>Maintain your login session securely</li>
                            <li>Remember your language preference (English/Hindi)</li>
                            <li>Store service worker cache version for offline access</li>
                        </ul>
                        <p className="mt-2">We do not use third-party tracking cookies, advertising cookies, or analytics cookies that identify individual users. You can clear application data through your browser settings at any time.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">9. Children's Privacy</h2>
                        <p>I M Smrti is not intended for use by individuals under the age of 13 without parental consent. We do not knowingly collect personal data from children under 13. If you believe a child has provided us with personal data, please contact us immediately.</p>
                    </section>

                    <section className="bg-slate-50 p-6 rounded-2xl mt-8">
                        <h2 className="text-lg font-bold text-slate-900 mb-4">Contact Information</h2>
                        <div className="flex items-center gap-3 mb-2">
                            <Mail size={18} className="text-slate-400" />
                            <span>hii@imsmrti.app</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <MapPin size={18} className="text-slate-400" />
                            <span>Ashbag Road, Infront of Police Station, Chouwky, Barkhedi, Plot No J 59, Bhopal, Madhya Pradesh, India</span>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
