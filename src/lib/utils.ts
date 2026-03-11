import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { ref, getBlob, updateMetadata, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

function triggerBlobDownload(blob: Blob, filename: string) {
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
    }, 100);
}

export async function downloadFile(url: string, filename: string): Promise<boolean> {
    console.log(`[Download] Starting for: ${filename}`);
    
    if (url.includes('firebasestorage.googleapis.com')) {
        try {
            const urlObj = new URL(url);
            const pathPart = urlObj.pathname.split('/o/')[1];
            if (pathPart) {
                const storagePath = decodeURIComponent(pathPart.split('?')[0]);
                const storageRef = ref(storage, storagePath);
                
                console.log(`[Download] Step 1: Forcing Metadata (Content-Disposition: attachment)`);
                // This forces the server to tell the browser "Save this file"
                await updateMetadata(storageRef, {
                    contentDisposition: `attachment; filename="${filename}"`
                });

                // Get a fresh URL which might include the updated metadata state
                const freshUrl = await getDownloadURL(storageRef);
                
                console.log(`[Download] Step 2: Triggering direct navigation`);
                // Create a temporary link and click it - this bypasses CORS completely 
                // because it's a direct navigation to a file that the server says is an attachment
                const link = document.createElement('a');
                link.href = freshUrl;
                link.download = filename;
                link.target = "_blank"; // Open in new tab which will immediately close/trigger download
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                return true;
            }
        } catch (e) {
            console.warn("[Download] Metadata force failed, falling back to Blob:", e);
        }
    }

    // Fallback 1: existing Blob logic (works if CORS is okay)
    try {
        const response = await fetch(url, { mode: 'cors' });
        if (response.ok) {
            const blob = await response.blob();
            triggerBlobDownload(blob, filename);
            return true;
        }
    } catch (err) {
        console.warn("[Download] Blob fallback failed:", err);
    }

    // Fallback 2: Last resort direct open
    console.log("[Download] Final fallback: window.open");
    window.open(url, '_blank');
    return true;
}
