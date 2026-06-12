import { getDownloadURL, ref, uploadBytes } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-storage.js";
import { storage } from "./config.js";

function safeName(name) {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
}

async function uploadImageBlob(productId, blob, fileName) {
  if (!blob?.type?.startsWith("image/")) throw new Error("O arquivo informado não é uma imagem válida.");
  if (blob.size > 8 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 8 MB.");
  const path = `produtos/${productId}/${safeName(fileName)}`;
  const snapshot = await uploadBytes(ref(storage, path), blob, {
    contentType: blob.type,
    cacheControl: "public,max-age=31536000"
  });
  return { url: await getDownloadURL(snapshot.ref), path };
}

export async function uploadProductImage(productId, file, onProgress) {
  if (!file?.type?.startsWith("image/")) throw new Error("Selecione um arquivo de imagem.");
  if (file.size > 8 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 8 MB.");
  onProgress?.(10);
  const upload = await uploadImageBlob(productId, file, `${Date.now()}-${file.name}`);
  onProgress?.(80);
  onProgress?.(100);
  return upload;
}

export async function uploadCatalogAsset(productId, sourceUrl, fileName) {
  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error(`Não foi possível carregar a imagem ${sourceUrl}.`);
  return uploadImageBlob(productId, await response.blob(), fileName);
}

function canvasBlob(canvas, quality) {
  return new Promise(resolve => canvas.toBlob(resolve, "image/webp", quality));
}

export async function prepareInlineProductImage(file, onProgress) {
  if (!file?.type?.startsWith("image/")) throw new Error("Selecione um arquivo de imagem.");
  if (file.size > 12 * 1024 * 1024) throw new Error("A imagem original deve ter no máximo 12 MB.");
  onProgress?.(10);

  const bitmap = await createImageBitmap(file);
  const maxDimension = 1200;
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d", { alpha: false }).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  onProgress?.(45);

  let blob = null;
  for (const quality of [0.82, 0.72, 0.62, 0.52, 0.42]) {
    blob = await canvasBlob(canvas, quality);
    if (blob?.size <= 480 * 1024) break;
  }
  if (!blob || blob.size > 520 * 1024) {
    throw new Error("Não foi possível reduzir a imagem para o limite do Firestore.");
  }
  onProgress?.(75);

  const url = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Não foi possível processar a imagem."));
    reader.readAsDataURL(blob);
  });
  onProgress?.(100);
  return { url, path: "firestore:inline", size: blob.size };
}

