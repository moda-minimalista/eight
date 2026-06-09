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

