import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { ref, getBlob } from "firebase/storage";
import { storage } from "@/lib/firebase";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

function triggerBlobDownload(blob: Blob, filename: string) {
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    
    // Append to body to ensure it works in all browsers
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
    }, 100);
}

export async function downloadFile(url: string, filename: string): Promise<boolean> {
    console.log(`Starting download for: ${filename} from ${url}`);
    
    // Try Firebase SDK approach first if it looks like a Firebase URL
    if (url.includes('firebasestorage.googleapis.com')) {
        try {
            // Extract the full path more reliably
            const urlObj = new URL(url);
            const pathPart = urlObj.pathname.split('/o/')[1];
            if (pathPart) {
                const storagePath = decodeURIComponent(pathPart.split('?')[0]);
                console.log(`Resolved Firebase Storage path: ${storagePath}`);
                const storageRef = ref(storage, storagePath);
                const blob = await getBlob(storageRef);
                triggerBlobDownload(blob, filename);
                return true;
            }
        } catch (e) {
            console.warn("Firebase SDK download failed, falling back to fetch:", e);
        }
    }

    // Fallback: direct fetch (requires CORS)
    try {
        const response = await fetch(url, { mode: 'cors' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        triggerBlobDownload(blob, filename);
        return true;
    } catch (err) {
        console.error("Download failed:", err);
        // If it's a CORS error, we might be able to just open in a new tab as a last resort
        console.log("Attempting last-resort fallback: opening in new tab");
        window.open(url, '_blank');
        return true; // We "started" it at least
    }
}
