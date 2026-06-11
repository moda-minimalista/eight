import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
import { auth, db } from "./config.js";

function productFromFirestore(id, data) {
  return {
    id,
    skuPrefix: data.skuPrefix || data.sku || "EIGHT",
    name: data.nome,
    category: data.categoria,
    collection: data.colecao || "EIGHT Collection",
    price: Number(data.preco),
    installment: Number(data.parcelas || 3),
    badge: data.destaque || "EIGHT",
    description: data.descricao,
    details: data.detalhes || data.descricao,
    colors: data.imagens || {},
    colorHex: data.coresHex || {},
    sizes: data.tamanhos || ["P", "M", "G", "GG", "XGG"],
    lifestyle: data.lifestyle || [],
    stock: data.estoque || {},
    active: data.ativo !== false
  };
}

function productToFirestore(product) {
  return {
    sku: product.skuPrefix,
    skuPrefix: product.skuPrefix,
    nome: product.name,
    descricao: product.description,
    detalhes: product.details || product.description,
    categoria: product.category,
    colecao: product.collection || "EIGHT Collection",
    preco: Number(product.price),
    parcelas: Number(product.installment || 3),
    estoque: product.stock || {},
    imagens: product.colors || {},
    coresHex: product.colorHex || {},
    tamanhos: product.sizes || [],
    lifestyle: product.lifestyle || [],
    variacoes: productVariations(product),
    destaque: product.badge || "",
    ativo: product.active !== false,
    dataAtualizacao: serverTimestamp()
  };
}

const colorCodes = {
  "Preto": "PRE",
  "Bordô": "BOR",
  "Cinza": "CIN",
  "Azul Marinho": "AZM",
  "Grafite": "GRA"
};

function productSku(product, color, size) {
  return `${product.skuPrefix}-${colorCodes[color] || color.slice(0, 3).toUpperCase()}-${size}`;
}

function productVariations(product) {
  return Object.keys(product.colors || {}).flatMap(color =>
    (product.sizes || []).map(size => {
      const sku = productSku(product, color, size);
      return {
        sku,
        cor: color,
        tamanho: size,
        estoque: Number(product.stock?.[sku] ?? 0)
      };
    })
  );
}

export async function listActiveProducts() {
  const snapshot = await getDocs(query(collection(db, "produtos"), where("ativo", "==", true)));
  return snapshot.docs.map(item => productFromFirestore(item.id, item.data()));
}

export async function listAllProducts() {
  const snapshot = await getDocs(collection(db, "produtos"));
  return snapshot.docs.map(item => productFromFirestore(item.id, item.data()));
}

export async function getProductDocument(productId) {
  const snapshot = await getDoc(doc(db, "produtos", productId));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function saveProduct(product) {
  const reference = doc(db, "produtos", product.id);
  const existing = await getDoc(reference);
  await setDoc(reference, {
    ...productToFirestore(product),
    ...(existing.exists() ? {} : { dataCriacao: serverTimestamp() })
  }, { merge: true });
  return product.id;
}

export async function deleteProduct(productId) {
  await deleteDoc(doc(db, "produtos", productId));
}

export async function seedProducts(products) {
  await Promise.all(products.map(product => saveProduct({
    ...product,
    stock: product.stock || Object.fromEntries(
      Object.keys(product.colors).flatMap(color =>
        product.sizes.map(size => [productSku(product, color, size), 10])
      )
    ),
    active: true
  })));
}

export async function listCategories() {
  const snapshot = await getDocs(query(collection(db, "categorias"), orderBy("nome")));
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
}

export async function saveCategory(category) {
  const id = category.id || category.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");
  await setDoc(doc(db, "categorias", id), {
    nome: category.nome,
    slug: id,
    ativo: category.ativo !== false,
    dataAtualizacao: serverTimestamp()
  }, { merge: true });
  return id;
}

export async function saveCoupon(coupon) {
  const code = coupon.codigo.trim().toUpperCase();
  await setDoc(doc(db, "cupons", code), {
    codigo: code,
    tipo: coupon.tipo,
    valor: Number(coupon.valor),
    ativo: coupon.ativo !== false,
    validade: coupon.validade || null,
    dataAtualizacao: serverTimestamp()
  }, { merge: true });
  return code;
}

export async function createOrder(order) {
  const user = auth.currentUser;
  const reference = doc(db, "pedidos", order.id);
  await setDoc(reference, {
    pedidoId: order.id,
    usuarioId: user?.uid || null,
    cliente: order.customer,
    endereco: order.address,
    entrega: order.shipping,
    produtos: order.items,
    valorSubtotal: order.subtotal,
    valorTotal: order.total,
    formaPagamento: order.paymentMethod,
    status: order.status,
    pagamentoStatus: order.paymentStatus,
    dataCriacao: serverTimestamp(),
    dataAtualizacao: serverTimestamp()
  });
  return order.id;
}

export async function findOrder(orderId) {
  const snapshot = await getDoc(doc(db, "pedidos", orderId));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function listOrders() {
  const snapshot = await getDocs(query(collection(db, "pedidos"), orderBy("dataCriacao", "desc"), limit(100)));
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
}

export async function listUserOrders(uid) {
  const snapshot = await getDocs(query(collection(db, "pedidos"), where("usuarioId", "==", uid)));
  return snapshot.docs
    .map(item => ({ id: item.id, ...item.data() }))
    .sort((a, b) => Number(b.dataCriacao?.seconds || 0) - Number(a.dataCriacao?.seconds || 0));
}

export async function cancelUserOrder(orderId) {
  const user = auth.currentUser;
  if (!user) throw new Error("Faça login para cancelar o pedido.");
  await runTransaction(db, async transaction => {
    const reference = doc(db, "pedidos", orderId);
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists()) throw new Error("Pedido não encontrado.");
    const order = snapshot.data();
    if (order.usuarioId !== user.uid) throw new Error("Este pedido não pertence à sua conta.");
    if (order.status !== "Aguardando pagamento") {
      throw new Error("Somente pedidos aguardando pagamento podem ser cancelados pelo site.");
    }
    transaction.update(reference, {
      status: "Cancelado",
      pagamentoStatus: "cancelled",
      dataAtualizacao: serverTimestamp()
    });
  });
}

export async function updateOrderStatus(orderId, status) {
  await runTransaction(db, async transaction => {
    const orderReference = doc(db, "pedidos", orderId);
    const orderSnapshot = await transaction.get(orderReference);
    if (!orderSnapshot.exists()) throw new Error("Pedido não encontrado.");
    const order = orderSnapshot.data();

    if (status === "Pago" && !order.estoqueReduzido) {
      const productEntries = await Promise.all(order.produtos.map(async item => {
        const reference = doc(db, "produtos", item.productId);
        const snapshot = await transaction.get(reference);
        return { item, reference, snapshot };
      }));
      for (const { item, reference, snapshot } of productEntries) {
        if (!snapshot.exists()) throw new Error(`Produto ${item.productId} não encontrado.`);
        const stock = snapshot.data().estoque || {};
        const current = Number(stock[item.sku] ?? 0);
        if (current < item.quantity) throw new Error(`Estoque insuficiente para ${item.sku}.`);
        transaction.update(reference, {
          [`estoque.${item.sku}`]: current - item.quantity,
          dataAtualizacao: serverTimestamp()
        });
      }
    }

    transaction.update(orderReference, {
      status,
      pagamentoStatus: status === "Pago" ? "approved" : order.pagamentoStatus,
      estoqueReduzido: status === "Pago" ? true : order.estoqueReduzido || false,
      dataAtualizacao: serverTimestamp()
    });
  });
}

export async function getCart(uid) {
  const snapshot = await getDoc(doc(db, "usuarios", uid, "carrinho", "atual"));
  return snapshot.exists() ? snapshot.data().itens || [] : [];
}

export async function saveCart(uid, items) {
  await setDoc(doc(db, "usuarios", uid, "carrinho", "atual"), {
    itens: items,
    dataAtualizacao: serverTimestamp()
  });
}

export async function getSiteSettings() {
  const snapshot = await getDoc(doc(db, "configuracoes", "site"));
  return snapshot.exists() ? snapshot.data() : {};
}

export async function saveSiteSettings(settings) {
  await setDoc(doc(db, "configuracoes", "site"), {
    ...settings,
    dataAtualizacao: serverTimestamp()
  }, { merge: true });
}

export async function listApprovedReviews() {
  const snapshot = await getDocs(query(collection(db, "avaliacoes"), where("aprovado", "==", true)));
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
}

export async function listAllReviews() {
  const snapshot = await getDocs(collection(db, "avaliacoes"));
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
}

export async function saveReview(review) {
  const user = auth.currentUser;
  if (!user) throw new Error("Faça login para publicar uma avaliação.");
  await addDoc(collection(db, "avaliacoes"), {
    usuarioId: user.uid,
    nome: review.name,
    produtoId: review.productId,
    produtoNome: review.productName,
    nota: Number(review.rating),
    comentario: review.comment,
    aprovado: false,
    dataCriacao: serverTimestamp()
  });
}

export async function moderateReview(reviewId, approved) {
  await updateDoc(doc(db, "avaliacoes", reviewId), {
    aprovado: approved,
    dataModeracao: serverTimestamp()
  });
}

export async function deleteReview(reviewId) {
  await deleteDoc(doc(db, "avaliacoes", reviewId));
}

