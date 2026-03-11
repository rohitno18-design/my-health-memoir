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
    console.log(`[Download V3] Starting for: ${filename}`);
    
    // Check if it's a Firebase URL
    const isFirebase = url.includes('firebasestorage.googleapis.com');
    
    if (isFirebase) {
        try {
            const urlObj = new URL(url);
            const pathPart = urlObj.pathname.split('/o/')[1];
            if (pathPart) {
                const storagePath = decodeURIComponent(pathPart.split('?')[0]);
                const storageRef = ref(storage, storagePath);
                
                console.log(`[Download V3] Step 1: Forcing Server-Side Headers`);
                // Force Content-Disposition: attachment on the server
                await updateMetadata(storageRef, {
                    contentDisposition: `attachment; filename="${filename}"`
                });

                // Wait a tiny bit for the metadata to propagate in the backend/cache
                await new Promise(resolve => setTimeout(resolve, 500));

                // Get a fresh download URL that includes the attachment instruction
                const freshUrl = await getDownloadURL(storageRef);
                
                console.log(`[Download V3] Step 2: Aggressive Triggering`);
                
                // Detection for mobile
                const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                
                if (isMobile) {
                    console.log(`[Download V3] Mobile detected - using direct link`);
                    const link = document.createElement('a');
                    link.href = freshUrl;
                    link.download = filename;
                    // Mobile browsers often require direct navigation to trigger the download prompt
                    link.target = "_blank"; 
                    document.body.appendChild(link);
                    link.click();
                    // Clean up after a delay
                    setTimeout(() => document.body.removeChild(link), 100);
                } else {
                    console.log(`[Download V3] Desktop detected - using hidden iframe`);
                    // Method A: Try hidden iframe first (cleanest on PC, no tab flash)
                    const iframe = document.createElement('iframe');
                    iframe.style.display = 'none';
                    iframe.src = freshUrl;
                    document.body.appendChild(iframe);
                    
                    // Periodically check if we should fall back to window.open
                    setTimeout(() => {
                        if (document.body.contains(iframe)) {
                            document.body.removeChild(iframe);
                        }
                    }, 3000);
                }

                return true;
            }
        } catch (e) {
            console.error("[Download V3] Aggressive approach failed:", e);
        }
    }

    // FALLBACK 1: The "Legacy" SDK Way (requires CORS)
    if (isFirebase) {
        try {
            const urlObj = new URL(url);
            const pathPart = urlObj.pathname.split('/o/')[1];
            if (pathPart) {
                const storagePath = decodeURIComponent(pathPart.split('?')[0]);
                const storageRef = ref(storage, storagePath);
                const blob = await getBlob(storageRef);
                triggerBlobDownload(blob, filename);
                return true;
            }
        } catch (e) {
            console.warn("[Download V3] SDK Blob fallback failed:", e);
        }
    }

    // FALLBACK 2: Direct Open (User will see a new tab, but better than nothing)
    console.warn("[Download V3] Using final fallback: window.open");
    const link = document.createElement('a');
    link.href = url;
    link.target = "_blank";
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
}
