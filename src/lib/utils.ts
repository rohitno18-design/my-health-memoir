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
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Delay revoke so browser has time to read the blob before it's released
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60000);
}

export async function downloadFile(url: string, filename: string): Promise<boolean> {
    // Try Firebase SDK path first (handles auth internally, no CORS issues)
    if (url.includes('firebasestorage.googleapis.com')) {
        const urlObj = new URL(url);
        const pathMatch = urlObj.pathname.match(/\/v0\/b\/[^/]+\/o\/(.+)/);
        if (pathMatch) {
            try {
                const storagePath = decodeURIComponent(pathMatch[1]);
                const storageRef = ref(storage, storagePath);
                const blob = await getBlob(storageRef);
                triggerBlobDownload(blob, filename);
                return true;
            } catch {
                // Fall through to fetch fallback
            }
        }
    }

    // Fallback: direct fetch using the token in the URL
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        triggerBlobDownload(blob, filename);
        return true;
    } catch (err) {
        console.error("Download failed:", err);
        alert("Download failed. Please try again or contact support.");
        return false;
    }
}
