import { doc, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
import { db } from "./config.js";
import { getProductDocument, saveCategory, saveProduct } from "./firestore-service.js";
import { uploadCatalogAsset } from "./storage-service.js";

const colorCodes = {
  "Preto": "PRE",
  "Bordô": "BOR",
  "Cinza": "CIN",
  "Azul Marinho": "AZM",
  "Grafite": "GRA"
};

function slug(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function extensionFromUrl(url, fallback = "jpg") {
  const match = String(url).split("?")[0].match(/\.([a-z0-9]+)$/i);
  return match?.[1]?.toLowerCase() || fallback;
}

function skuFor(product, color, size) {
  const colorCode = colorCodes[color] || slug(color).slice(0, 3).toUpperCase();
  return `${product.skuPrefix}-${colorCode}-${size}`;
}

async function uploadProductAssets(product, onProgress) {
  const colors = {};
  const lifestyle = [];
  const colorEntries = Object.entries(product.colors || {});
  const lifestyleEntries = product.lifestyle || [];
  const assetCount = colorEntries.length + lifestyleEntries.length;
  let completed = 0;

  for (const [color, sourceUrl] of colorEntries) {
    const upload = await uploadCatalogAsset(
      product.id,
      sourceUrl,
      `catalogo-${slug(color)}.${extensionFromUrl(sourceUrl)}`
    );
    colors[color] = upload.url;
    completed += 1;
    onProgress?.({ phase: "images", product, completed, total: assetCount });
  }

  for (const [index, item] of lifestyleEntries.entries()) {
    const upload = await uploadCatalogAsset(
      product.id,
      item.image,
      `lifestyle-${index + 1}-${slug(item.label)}.${extensionFromUrl(item.image)}`
    );
    lifestyle.push({ ...item, image: upload.url });
    completed += 1;
    onProgress?.({ phase: "images", product, completed, total: assetCount });
  }

  return { colors, lifestyle, imageCount: assetCount };
}

export async function migrateCatalog(products, options = {}) {
  const onProgress = options.onProgress;
  const initialStock = Number(options.initialStock ?? 10);
  const report = { products: 0, categories: 0, images: 0, skus: 0 };

  for (const [index, product] of products.entries()) {
    onProgress?.({ phase: "product", product, current: index + 1, total: products.length });
    const existing = await getProductDocument(product.id);
    const assets = await uploadProductAssets(product, onProgress);
    const stock = {};

    for (const color of Object.keys(product.colors || {})) {
      for (const size of product.sizes || []) {
        const sku = skuFor(product, color, size);
        stock[sku] = Number(existing?.estoque?.[sku] ?? initialStock);
        report.skus += 1;
      }
    }

    await saveProduct({
      ...product,
      colors: assets.colors,
      lifestyle: assets.lifestyle,
      stock,
      active: product.active !== false
    });
    report.products += 1;
    report.images += assets.imageCount;
  }

  const categories = [...new Set(products.map(product => product.category).filter(Boolean))];
  for (const category of categories) {
    await saveCategory({ nome: category, ativo: true });
  }
  report.categories = categories.length;

  await setDoc(doc(db, "configuracoes", "catalogo"), {
    versao: 1,
    origem: "catalogo-inicial-eight",
    produtos: report.products,
    categorias: report.categories,
    imagens: report.images,
    skus: report.skus,
    ultimaSincronizacao: serverTimestamp()
  }, { merge: true });

  return report;
}
