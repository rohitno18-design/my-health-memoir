declare const __BUILD_TIME__: string;

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { ref, getBlob } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { getFunctions, httpsCallable } from "firebase/functions";
const utilFunctions = getFunctions();
const getSigned = httpsCallable(utilFunctions, 'getSignedUrl');

export const BUILD_ID = __BUILD_TIME__;

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

// Keep BUILD_ID referenced so tree-shaking doesn't remove it — forces hash change per build
console.debug(BUILD_ID);

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
    console.log(`[Download] Starting: ${filename}`);
    
    const isFirebase = url.includes('firebasestorage.googleapis.com');
    
    if (isFirebase) {
        try {
            const urlObj = new URL(url);
            const pathPart = urlObj.pathname.split('/o/')[1];
            if (pathPart) {
                const storagePath = decodeURIComponent(pathPart.split('?')[0]);
                
                // Get a secure signed URL (10min expiry) via Cloud Function
                const result = await getSigned({ storagePath, expiryMinutes: 10 });
                const signedUrl = (result.data as any).url as string;

                if (signedUrl) {
                    const link = document.createElement('a');
                    link.href = signedUrl;
                    link.download = filename;
                    link.target = "_blank";
                    document.body.appendChild(link);
                    link.click();
                    setTimeout(() => document.body.removeChild(link), 100);
                    return true;
                }
            }
        } catch (e) {
            console.error("[Download] Signed URL failed:", e);
        }

        // Fallback: use SDK blob download
        try {
            const pathPart = new URL(url).pathname.split('/o/')[1];
            if (pathPart) {
                const storagePath = decodeURIComponent(pathPart.split('?')[0]);
                const storageRef = ref(storage, storagePath);
                const blob = await getBlob(storageRef);
                triggerBlobDownload(blob, filename);
                return true;
            }
        } catch (e) {
            console.warn("[Download] Blob fallback failed:", e);
        }
    }

    // Final fallback
    const link = document.createElement('a');
    link.href = url;
    link.target = "_blank";
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
}
