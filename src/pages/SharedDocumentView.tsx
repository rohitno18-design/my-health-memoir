import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { decryptUrl } from "@/lib/encryption";
import { Loader2, Lock, FileText, AlertTriangle, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function SharedDocumentView() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [shareData, setShareData] = useState<any>(null);
    const [pin, setPin] = useState("");
    const [decryptedUrl, setDecryptedUrl] = useState<string | null>(null);
    const [pinError, setPinError] = useState(false);

    useEffect(() => {
        const fetchShare = async () => {
            if (!id) return;
            try {
                const docRef = doc(db, "shared_links", id);
                const docSnap = await getDoc(docRef);
                
                if (!docSnap.exists()) {
                    setError("This link does not exist or has been revoked.");
                    setLoading(false);
                    return;
                }

                const data = docSnap.data();
                
                // Check Expiry
                if (data.expiresAt && data.expiresAt.toDate() < new Date()) {
                    setError("This secure link has expired.");
                    setLoading(false);
                    return;
                }

                setShareData(data);
                
                // If it doesn't have a PIN, we still used a default "no-pin" string or it's unencrypted
                // Let's assume if hasPin is false, the url is just stored plainly in `url`, 
                // but actually we encrypted it with an empty string or fixed string if no pin.
                // Let's check how we stored it. If `hasPin` is false, we might have `url` stored directly.
                if (!data.hasPin && data.url) {
                    setDecryptedUrl(data.url);
                }
                
            } catch (err) {
                setError("Failed to load secure link. Please check your connection.");
            } finally {
                setLoading(false);
            }
        };
        fetchShare();
    }, [id]);

    const handleUnlock = (e: React.FormEvent) => {
        e.preventDefault();
        if (!shareData?.encryptedUrl) return;

        const url = decryptUrl(shareData.encryptedUrl, pin);
        if (url) {
            setDecryptedUrl(url);
            setPinError(false);
        } else {
            setPinError(true);
            setPin("");
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
                <Loader2 className="animate-spin text-blue-500 mb-4" size={32} />
                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Verifying Link...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50">
                <div className="size-20 bg-rose-100 rounded-full flex items-center justify-center mb-6">
                    <AlertTriangle size={32} className="text-rose-500" />
                </div>
                <h1 className="text-2xl font-black text-slate-900 mb-2">Link Unavailable</h1>
                <p className="text-slate-500 text-center max-w-sm mb-8">{error}</p>
                <button onClick={() => navigate("/")} className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold">
                    Go to I M Smrti
                </button>
            </div>
        );
    }

    if (shareData?.hasPin && !decryptedUrl) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 text-center">
                    <div className="size-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-blue-600">
                        <Lock size={28} />
                    </div>
                    <h2 className="text-xl font-black text-slate-900 mb-2">Secure Document</h2>
                    <p className="text-sm text-slate-500 mb-8">This medical document is protected. Please enter the PIN provided by the sender.</p>
                    
                    <form onSubmit={handleUnlock}>
                        <input
                            type="password"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={4}
                            value={pin}
                            onChange={(e) => { setPin(e.target.value); setPinError(false); }}
                            placeholder="Enter 4-digit PIN"
                            className={`w-full text-center tracking-[0.5em] text-2xl font-black py-4 bg-slate-50 border-2 rounded-xl mb-4 transition-colors ${pinError ? 'border-rose-300 text-rose-500 bg-rose-50' : 'border-slate-100 focus:border-blue-500'}`}
                            autoFocus
                        />
                        <AnimatePresence>
                            {pinError && (
                                <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="text-xs font-bold text-rose-500 mb-4">
                                    Incorrect PIN. Please try again.
                                </motion.p>
                            )}
                        </AnimatePresence>
                        <button 
                            type="submit" 
                            disabled={pin.length < 4}
                            className="w-full py-4 bg-blue-600 text-white rounded-xl font-black disabled:opacity-50 transition-opacity"
                        >
                            Unlock Document
                        </button>
                    </form>
                </motion.div>
                <div className="mt-8 text-center flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-widest">
                    <CheckCircle2 size={14} className="text-emerald-500" /> Securely shared via I M Smrti
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col">
            <header className="p-4 flex items-center justify-between bg-slate-900 text-white z-10 shadow-md">
                <div className="flex items-center gap-3">
                    <div className="size-10 bg-blue-500/20 rounded-xl flex items-center justify-center text-blue-400">
                        <FileText size={20} />
                    </div>
                    <div>
                        <h1 className="font-bold text-sm leading-tight">{shareData?.documentName || "Medical Document"}</h1>
                        <p className="text-[10px] font-medium text-slate-400">Securely shared</p>
                    </div>
                </div>
                {shareData?.expiresAt && (
                    <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Expires On</p>
                        <p className="text-xs font-medium text-white">{shareData.expiresAt.toDate().toLocaleString()}</p>
                    </div>
                )}
            </header>

            <main className="flex-1 w-full bg-slate-800 relative">
                {decryptedUrl ? (
                    <iframe 
                        src={decryptedUrl} 
                        className="absolute inset-0 w-full h-full border-0"
                        title="Secure Document Viewer"
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <p className="text-slate-500">Failed to load document view.</p>
                    </div>
                )}
            </main>
        </div>
    );
}
