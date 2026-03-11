import { useEffect, useState } from "react";
import { X, Download, Loader2, AlertCircle } from "lucide-react";
import { cn, downloadFile } from "@/lib/utils";

interface DocumentViewerModalProps {
    isOpen: boolean;
    onClose: () => void;
    url: string;
    title: string;
    type?: string;
}

export function DocumentViewerModal({
    isOpen,
    onClose,
    url,
    title,
    type,
}: DocumentViewerModalProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            setError(null);
            // Lock body scroll
            document.body.style.overflow = "hidden";

            // Fail-safe: if it's still loading after 10 seconds, stop loading
            const timer = setTimeout(() => {
                setLoading(false);
            }, 10000);
            return () => clearTimeout(timer);
        } else {
            document.body.style.overflow = "unset";
        }
    }, [isOpen]);

    if (!isOpen) return null;

    // Improved type detection: Check mime type first, then fallback to URL extension
    const isImage = type?.startsWith("image/") || url.split('?')[0].match(/\.(jpeg|jpg|gif|png|webp|svg)$/i);
    const isPDF = type === "application/pdf" || type?.includes("pdf") || url.split('?')[0].includes(".pdf");

    // Clear loading if we know we are in the "Unknown" branch
    if (isOpen && !isImage && !isPDF && loading) {
        setLoading(false);
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div 
                className="absolute inset-0" 
                onClick={onClose}
            />
            
            <div className="relative w-full h-full sm:max-w-4xl sm:h-[90vh] bg-white sm:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-10">
                    <div className="flex-1 min-w-0 pr-4">
                        <h2 className="text-lg font-bold text-slate-800 truncate" title={title}>
                            {title}
                        </h2>
                        {type && (
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                {type.split("/")[1] || type}
                            </p>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => downloadFile(url, title || 'document')}
                            className="p-2.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                            title="Download"
                        >
                            <Download size={18} />
                        </button>
                        <button 
                            onClick={onClose}
                            className="p-2.5 rounded-xl bg-slate-800 text-white hover:bg-slate-700 transition-colors shadow-lg"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Content Viewer */}
                <div className="flex-1 bg-slate-50 relative overflow-hidden flex items-center justify-center">
                    {loading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 z-0">
                            <Loader2 size={32} className="animate-spin text-primary mb-3" />
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">Loading Document...</p>
                        </div>
                    )}

                    {error ? (
                        <div className="flex flex-col items-center justify-center p-12 text-center max-w-sm">
                            <div className="size-16 rounded-3xl bg-red-50 text-red-500 flex items-center justify-center mb-4">
                                <AlertCircle size={32} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 mb-2">Failed to load</h3>
                            <p className="text-sm text-slate-500 mb-6">{error}</p>
                            <button 
                                onClick={onClose}
                                className="px-6 py-2 bg-slate-800 text-white rounded-xl font-bold shadow-lg"
                            >
                                Close Viewer
                            </button>
                        </div>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            {isImage ? (
                                <img 
                                    src={url} 
                                    alt={title} 
                                    className={cn(
                                        "max-w-full max-h-full object-contain transition-opacity duration-300",
                                        loading ? "opacity-0" : "opacity-100"
                                    )}
                                    onLoad={() => setLoading(false)}
                                    onError={() => {
                                        setLoading(false);
                                        setError("Could not load image. It might have been deleted or the link expired.");
                                    }}
                                />
                            ) : isPDF ? (
                                <iframe 
                                    src={`${url}#toolbar=0&navpanes=0&scrollbar=1`}
                                    className={cn(
                                        "w-full h-full border-none transition-opacity duration-300",
                                        loading ? "opacity-0" : "opacity-100"
                                    )}
                                    onLoad={() => setLoading(false)}
                                    onError={() => {
                                        setLoading(false);
                                        setError("Could not load PDF. Your browser might be blocking the file or the link expired.");
                                    }}
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center p-12 text-center">
                                    <div className="size-16 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center mb-4">
                                        <AlertCircle size={32} />
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-800 mb-2">Unknown File Type</h3>
                                    <p className="text-sm text-slate-500 mb-6">This file type might not be viewable directly. You can try downloading it instead.</p>
                                    <button
                                        onClick={() => downloadFile(url, title || 'document')}
                                        className="px-6 py-2 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20"
                                    >
                                        Download File
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Secure Footer Notice */}
                <div className="px-6 py-3 border-t border-slate-100 bg-white flex items-center justify-center gap-2">
                    <span className="flex-shrink-0 size-1.5 rounded-full bg-emerald-500" />
                    <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">
                        Viewed Securely in My Health Memoir
                    </p>
                </div>
            </div>
        </div>
    );
}
