import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";

export async function uploadMedia(
  file: File,
  path: string,
  onProgress?: (pct: number) => void
): Promise<string> {
  const fileRef = storageRef(storage, path);
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(fileRef, file);
    task.on(
      "state_changed",
      (snap) => {
        const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
        onProgress?.(pct);
      },
      reject,
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        resolve(url);
      }
    );
  });
}
