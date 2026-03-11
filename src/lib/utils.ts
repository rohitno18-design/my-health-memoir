import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { ref, getBlob } from "firebase/storage";
import { storage } from "@/lib/firebase";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export async function downloadFile(url: string, filename: string): Promise<boolean> {
    let blob: Blob;
    const urlObj = new URL(url);
    if (urlObj.hostname === 'firebasestorage.googleapis.com') {
        const pathMatch = urlObj.pathname.match(/\/v0\/b\/[^/]+\/o\/(.+)/);
        if (!pathMatch) throw new Error("Invalid Firebase Storage URL");
        const storagePath = decodeURIComponent(pathMatch[1]);
        const storageRef = ref(storage, storagePath);
        blob = await getBlob(storageRef);
    } else {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        blob = await response.blob();
    }
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
    return true;
}
