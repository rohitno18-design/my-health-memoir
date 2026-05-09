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
                        <p>You have the right to request the deletion of all your data. You can delete your account and all associated medical records directly within the App's Account Settings.</p>
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
