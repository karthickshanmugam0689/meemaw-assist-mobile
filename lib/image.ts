/**
 * Downscale a File to a max dimension, returning a new JPEG Blob.
 * Phone photos can be 3-4 MB; we cut them down to ~300 KB so
 * upload is fast and we don't pay for tokens we don't need.
 */
export async function resizeImage(
  file: File,
  maxDim = 1280,
  quality = 0.85
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas context unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("blob failed"))),
      "image/jpeg",
      quality
    );
  });
}

/**
 * Create a stable object URL and a teardown function, so the image
 * can be rendered by the AnnotatedImage component without leaking memory.
 */
export function blobToObjectUrl(blob: Blob): { url: string; revoke: () => void } {
  const url = URL.createObjectURL(blob);
  return { url, revoke: () => URL.revokeObjectURL(url) };
}
