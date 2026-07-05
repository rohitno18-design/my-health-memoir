import { ShieldCheck, Mail, MapPin } from "lucide-react";

export function PrivacyPage() {
    return (
        <div className="min-h-screen bg-slate-50 py-12 px-6">
            <div className="max-w-3xl mx-auto bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-slate-100">
                <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl">
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
                        <h2 className="text-xl font-bold text-slate-900 mb-3">4. Data Deletion &amp; Retention</h2>
                        <p>You have the right to request the deletion of all your data. You can delete your account and all associated medical records directly within the App's Account Settings (Account → Delete Account permanently), or request deletion without the app at <a href="/delete-account" className="font-bold text-blue-600">imsmrti.app/delete-account</a>. In-app deletion takes effect immediately; email requests are completed within 30 days.</p>
                        <p className="mt-2">We retain your data only as long as your account is active. After deletion, minimal security/audit logs required for fraud prevention and legal compliance are removed on a rolling basis within 90 days.</p>
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
                            <li>Your personal data is processed with your consent, which you provide during account registration. You may withdraw consent at any time by deleting your account.</li>
                            <li>You have the right to access, correct, and erase your data at any time, and the right to nominate another individual to exercise these rights on your behalf in case of death or incapacity.</li>
                            <li>In the event of a data breach, we will notify affected users and the Data Protection Board of India as required by law.</li>
                            <li>If you are unsatisfied with our grievance resolution, you may escalate to the Data Protection Board of India.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">8. Grievance Officer</h2>
                        <p>In accordance with the DPDP Act, 2023 and the Information Technology Act, 2000, the contact details of our Grievance Officer are:</p>
                        <ul className="list-disc pl-5 mt-2 space-y-2">
                            <li><strong>Name:</strong> Rohit (Founder, I M Smrti)</li>
                            <li><strong>Email:</strong> hii@imsmrti.app (subject line: "Grievance")</li>
                            <li><strong>Address:</strong> Ashbag Road, Infront of Police Station, Chouwky, Barkhedi, Plot No J 59, Bhopal, Madhya Pradesh, India</li>
                            <li><strong>Response time:</strong> acknowledgment within 48 hours, resolution within 30 days.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">9. Records of Family Members</h2>
                        <p>If you add health records of a family member or dependent, you confirm that you are their parent, legal guardian, or authorized caregiver, or that you have their consent to manage their health information. The same protection, deletion and access rights described in this policy apply to their data.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">10. Cookies & Tracking</h2>
                        <p>This application uses essential cookies and local storage to:</p>
                        <ul className="list-disc pl-5 mt-2 space-y-2">
                            <li>Maintain your login session securely</li>
                            <li>Remember your language preference (English/Hindi)</li>
                            <li>Store service worker cache version for offline access</li>
                        </ul>
                        <p className="mt-2">We do not use third-party tracking cookies, advertising cookies, or analytics cookies that identify individual users. You can clear application data through your browser settings at any time.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-slate-900 mb-3">11. Children's Privacy</h2>
                        <p>You must be at least 18 years old to create an I M Smrti account. Health records of children may only be added and managed by a parent or legal guardian through their own account, as described in "Records of Family Members". We do not knowingly allow children to create accounts or collect personal data directly from children. If you believe a child has created an account, please contact us immediately.</p>
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
