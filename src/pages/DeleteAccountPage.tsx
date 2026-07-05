import { Trash2, Mail, Smartphone, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

// Public page required by Google Play & Apple App Store: a web-accessible
// path to request account/data deletion without having the app installed.
export function DeleteAccountPage() {
    return (
        <div className="min-h-screen bg-slate-50 py-12 px-6">
            <div className="max-w-3xl mx-auto bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-slate-100">
                <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl">
                        <Trash2 size={28} />
                    </div>
                    <h1 className="text-3xl font-black text-slate-900">Delete Your Account &amp; Data</h1>
                </div>

                <div className="prose prose-slate max-w-none text-slate-600 space-y-6">
                    <p>
                        You can permanently delete your I M Smrti account and all associated data at any time.
                        Deletion removes your profile, medical documents, vitals, reminders, family member records,
                        emergency information, shared links and uploaded files. <strong>This cannot be undone.</strong>
                    </p>

                    <section className="bg-slate-50 p-6 rounded-2xl">
                        <div className="flex items-center gap-3 mb-3">
                            <Smartphone size={20} className="text-blue-600" />
                            <h2 className="text-lg font-bold text-slate-900 m-0">Option 1 — Delete inside the app (instant)</h2>
                        </div>
                        <ol className="list-decimal pl-5 space-y-1">
                            <li>Open I M Smrti and sign in.</li>
                            <li>Go to <strong>Account → Security → Delete Account permanently</strong>.</li>
                            <li>Type <strong>DELETE</strong> to confirm.</li>
                        </ol>
                        <p className="mt-3 text-sm">All your data is erased immediately from our systems.</p>
                    </section>

                    <section className="bg-slate-50 p-6 rounded-2xl">
                        <div className="flex items-center gap-3 mb-3">
                            <Mail size={20} className="text-blue-600" />
                            <h2 className="text-lg font-bold text-slate-900 m-0">Option 2 — Request deletion by email</h2>
                        </div>
                        <p>
                            If you no longer have the app installed or cannot sign in, email us at{" "}
                            <a href="mailto:hii@imsmrti.app?subject=Account%20Deletion%20Request" className="font-bold text-blue-600">hii@imsmrti.app</a>{" "}
                            from the email address linked to your account with the subject{" "}
                            <strong>"Account Deletion Request"</strong>. We verify ownership and complete deletion
                            within <strong>30 days</strong>, then confirm by email.
                        </p>
                    </section>

                    <section>
                        <div className="flex items-center gap-3 mb-2">
                            <ShieldCheck size={20} className="text-emerald-600" />
                            <h2 className="text-lg font-bold text-slate-900 m-0">What is deleted, and what is kept</h2>
                        </div>
                        <ul className="list-disc pl-5 space-y-1">
                            <li><strong>Deleted:</strong> profile, health records, documents and files, vitals, reminders, appointments, family member records, emergency info, shared links, and your login account.</li>
                            <li><strong>Kept temporarily:</strong> minimal audit/security logs required for fraud prevention and legal compliance, deleted on a rolling basis within 90 days.</li>
                        </ul>
                    </section>

                    <p className="text-sm">
                        Before deleting, you can download a copy of your data from{" "}
                        <strong>Account → Download My Data (JSON)</strong>. See our{" "}
                        <Link to="/privacy" className="font-bold text-blue-600">Privacy Policy</Link> for details.
                    </p>
                </div>
            </div>
        </div>
    );
}
