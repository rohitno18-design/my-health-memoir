import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { ref, getBlob } from "firebase/storage";
import { storage } from "@/lib/firebase";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

function triggerBlobDownload(blob: Blob, filename: string) {
    const blobUrl = window.URL.createObjectURL(blob);
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile) {
        // On mobile, open in new tab — user can save via browser share/menu
        window.open(blobUrl, '_blank');
    } else {
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Keep blob URL alive for 60s so browser can complete the operation
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60000);
}

export async function downloadFile(url: string, filename: string): Promise<boolean> {
    if (url.includes('firebasestorage.googleapis.com')) {
        try {
            // Extract path from Firebase URL: /v0/b/{bucket}/o/{encoded_path}
            const urlObj = new URL(url);
            const pathMatch = urlObj.pathname.match(/\/v0\/b\/[^/]+\/o\/(.+)/);
            if (!pathMatch) throw new Error("Could not parse Firebase Storage path");
            const storagePath = decodeURIComponent(pathMatch[1]);
            const storageRef = ref(storage, storagePath);
            const blob = await getBlob(storageRef);
            triggerBlobDownload(blob, filename);
            return true;
        } catch (e) {
            console.warn("Firebase SDK download failed:", e);
            // Fall through to fetch fallback
        }
    }

    // Fallback: direct fetch (works when CORS is configured)
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
