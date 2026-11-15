"use client";

/** A bill page ready to send to /api/extract (base64 without the data: prefix). */
export type UploadFile = {
  name: string;
  mediaType: "application/pdf" | "image/jpeg" | "image/png" | "image/webp";
  data: string;
  sizeKb: number;
};

export const MAX_UPLOAD_FILES = 6;
const MAX_PDF_BYTES = 3_000_000;
const MAX_TOTAL_B64 = 4_200_000;
const MAX_SIDE = 2000;

function readAsBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(new Error("Could not read the file"));
    r.readAsDataURL(file);
  });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Can't open ${file.name}. Use a JPEG, PNG or PDF (iPhone: Settings → Camera → Formats → Most Compatible).`));
    };
    img.src = url;
  });
}

/** Downscale a photo to ≤2000px on the long side and re-encode as JPEG (keeps text legible, cuts size). */
async function prepareImage(file: File): Promise<UploadFile> {
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser can't process images");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const data = canvas.toDataURL("image/jpeg", 0.85).split(",")[1] ?? "";
  return { name: file.name, mediaType: "image/jpeg", data, sizeKb: Math.round((data.length * 3) / 4 / 1024) };
}

async function preparePdf(file: File): Promise<UploadFile> {
  if (file.size > MAX_PDF_BYTES) {
    throw new Error(`${file.name} is larger than 3 MB. Upload just the itemized pages, or take photos instead.`);
  }
  const data = await readAsBase64(file);
  return { name: file.name, mediaType: "application/pdf", data, sizeKb: Math.round(file.size / 1024) };
}

/** Validate and convert picked files; throws an Error with a user-facing message. */
export async function prepareUploads(existing: UploadFile[], picked: File[]): Promise<UploadFile[]> {
  const out = [...existing];
  for (const f of picked) {
    if (out.length >= MAX_UPLOAD_FILES) throw new Error(`You can upload up to ${MAX_UPLOAD_FILES} pages at once.`);
    const isPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
    if (isPdf) {
      if (out.some((x) => x.mediaType === "application/pdf")) throw new Error("Upload one PDF at a time.");
      out.push(await preparePdf(f));
    } else if (f.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name)) {
      out.push(await prepareImage(f));
    } else {
      throw new Error(`${f.name}: only PDF or photos (JPEG, PNG) are supported.`);
    }
  }
  if (out.reduce((n, x) => n + x.data.length, 0) > MAX_TOTAL_B64) {
    throw new Error("These files are too large together (max about 3 MB). Remove a page or use smaller photos.");
  }
  return out;
}
