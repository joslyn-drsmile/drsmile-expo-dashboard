const MAX_RAW_BYTES = 25 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const SUPPORTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function optimizePackageImage(file: File): Promise<File> {
  if (!SUPPORTED_TYPES.has(file.type)) throw new Error("Use a PNG, JPG, JPEG or WebP image.");
  if (!file.size || file.size > MAX_RAW_BYTES) throw new Error("The original image must be smaller than 25MB.");

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("This image is damaged or cannot be read.");
  }

  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1080;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser cannot optimise the image.");
    context.clearRect(0, 0, 1080, 1080);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    const scale = Math.min(1080 / bitmap.width, 1080 / bitmap.height);
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    context.drawImage(bitmap, Math.round((1080 - width) / 2), Math.round((1080 - height) / 2), width, height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Image optimisation failed.")), "image/webp", 0.9));
    if (blob.size > MAX_UPLOAD_BYTES) throw new Error("The optimised image is still larger than 10MB. Please choose another image.");
    return new File([blob], "package-1080.webp", { type: "image/webp", lastModified: Date.now() });
  } finally {
    bitmap.close();
  }
}

export function formatFileSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)}KB` : `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
