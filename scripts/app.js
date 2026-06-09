const localCatalog = window.EIGHT_CATALOG;
let catalog = localCatalog;
const storeConfig = window.EIGHT_STORE_CONFIG;
const app = document.querySelector("#app");
const money = value => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const colorCodes = {
  "Preto": "PRE",
  "Bordô": "BOR",
  "Cinza": "CIN",
  "Azul Marinho": "AZM",
  "Grafite": "GRA"
};

let selectedColor = "";
let selectedSize = "M";
let selectedQuantity = 1;
let activeProduct = catalog[0];
let selectedCategories = new Set();
let selectedSizes = new Set();
let firebaseServices = null;
let sessionUser = null;
let cartSyncTimer = null;
let adminProducts = [];
let adminOrders = [];

function productById(id) {
  return catalog.find(product => product.id === id) || catalog[0];
}

function firstColor(product) {
  return Object.keys(product.colors)[0];
}

function skuFor(product, color, size) {
  return `${product.skuPrefix}-${colorCodes[color] || color.slice(0, 3).toUpperCase()}-${size}`;
}

function availableStock(sku, product = activeProduct) {
  if (typeof product?.stock?.[sku] === "number") return product.stock[sku];
  const stock = window.EIGHT_ORDERS.getStock();
  return typeof stock[sku] === "number" ? stock[sku] : 10;
}

function shippingPrice(option, subtotal) {
  return option.id === "standard" && subtotal >= 299 ? 0 : option.price;
}

function validCpf(value) {
  const cpf = value.replace(/\D/g, "");
  if (!cpf) return true;
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = length => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) sum += Number(cpf[index]) * (length + 1 - index);
    const result = (sum * 10) % 11;
    return result === 10 ? 0 : result;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  })[character]);
}

function cartWithDetails() {
  return getCart().map(item => {
    const product = productById(item.id);
    return {
      ...item,
      sku: item.sku || skuFor(product, item.color, item.size),
      image: product.colors[item.color] || product.colors[firstColor(product)],
      subtotal: item.price * item.quantity
    };
  });
}

function getCart() {
  try {
    return JSON.parse(localStorage.getItem("eight-cart")) || [];
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem("eight-cart", JSON.stringify(cart));
  updateCartCount();
  scheduleCartSync(cart);
}

function updateCartCount() {
  const count = getCart().reduce((sum, item) => sum + item.quantity, 0);
  document.querySelector(".cart-count").textContent = count;
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function firebaseErrorMessage(error) {
  const messages = {
    "auth/email-already-in-use": "Este e-mail já está cadastrado.",
    "auth/invalid-credential": "E-mail ou senha inválidos.",
    "auth/invalid-email": "Informe um e-mail válido.",
    "auth/weak-password": "Use uma senha com pelo menos 6 caracteres.",
    "auth/too-many-requests": "Muitas tentativas. Aguarde alguns minutos.",
    "auth/operation-not-allowed": "O cadastro por e-mail ainda não foi ativado no Firebase. No Console Firebase, habilite Authentication > Sign-in method > E-mail/senha."
  };
  return messages[error?.code] || error?.message || "Não foi possível concluir a operação.";
}

function scheduleCartSync(cart) {
  if (!firebaseServices || !sessionUser) return;
  clearTimeout(cartSyncTimer);
  cartSyncTimer = setTimeout(() => {
    firebaseServices.firestore.saveCart(sessionUser.uid, cart).catch(() => {});
  }, 400);
}

function mergeCarts(localCart, remoteCart) {
  const merged = [...localCart];
  remoteCart.forEach(remote => {
    const existing = merged.find(item =>
      item.id === remote.id && item.color === remote.color && item.size === remote.size
    );
    if (existing) existing.quantity = Math.max(existing.quantity, remote.quantity);
    else merged.push(remote);
  });
  return merged;
}

async function handleSession(user) {
  const previousUser = sessionUser;
  sessionUser = user;
  document.body.classList.toggle("is-authenticated", Boolean(user));
  document.body.classList.toggle("is-admin", user?.role === "admin");
  const accountLink = document.querySelector(".account-link");
  if (accountLink) {
    accountLink.setAttribute("aria-label", user ? `Conta de ${user.displayName || user.email}` : "Minha conta");
    accountLink.classList.toggle("logged-in", Boolean(user));
  }
  if (user && (!previousUser || previousUser.uid !== user.uid)) {
    try {
      const remoteCart = await firebaseServices.firestore.getCart(user.uid);
      saveCart(mergeCarts(getCart(), remoteCart));
    } catch {
      showToast("Sessão iniciada. O carrinho será sincronizado quando houver conexão.");
    }
  }
  const route = currentRoute().page;
  if (["login", "conta", "admin"].includes(route)) render();
}

async function initializeFirebaseIntegration(services) {
  firebaseServices = services;
  services.auth.observeSession(handleSession);
  try {
    const remoteProducts = await services.firestore.listActiveProducts();
    if (remoteProducts.length) {
      catalog = remoteProducts;
      window.EIGHT_CATALOG = remoteProducts;
      render();
    }
  } catch {
    showToast("Catálogo local ativo. Configure o Firestore para sincronização.");
  }
}

function colorSwatches(product, currentColor, context = "") {
  return Object.keys(product.colors).map(color => `
    <button
      class="color-swatch ${color === currentColor ? "active" : ""}"
      data-color="${color}"
      data-context="${context}"
      style="--swatch:${product.colorHex[color]}"
      aria-label="Cor ${color}"
      title="${color}">
    </button>`).join("");
}

function productCard(product) {
  const color = firstColor(product);
  const swatches = Object.entries(product.colorHex)
    .map(([name, hex]) => `<span style="background:${hex}" title="${name}"></span>`)
    .join("");

  return `
    <article class="product-card" data-category="${product.category}">
      <a href="#produto/${product.id}" class="product-card-media">
        <img src="${product.colors[color]}" alt="${product.name} na cor ${color}">
        <span class="tag">${product.badge}</span>
        <span class="quick-add">Ver produto</span>
      </a>
      <div class="product-card-info">
        <p class="product-category">${product.category}</p>
        <h3><a href="#produto/${product.id}">${product.name}</a></h3>
        <div class="product-card-line"><span>${color}</span><strong>${money(product.price)}</strong></div>
        <div class="mini-swatches" aria-label="Cores disponíveis">${swatches}</div>
      </div>
    </article>`;
}

function collectionGrid(products = catalog) {
  return products.map(productCard).join("");
}

function homePage() {
  const basic = catalog[0];
  const basicColor = selectedColor && basic.colors[selectedColor] ? selectedColor : firstColor(basic);

  return `
    <section class="hero">
      <div class="hero-media hero-collage">
        <img src="assets/images/lifestyle/basic-tee/retrato-bordo.jpeg" alt="Modelo usando camiseta bordô EIGHT">
        <img src="assets/images/lifestyle/basic-tee/retrato-preto.jpeg" alt="Modelo usando camiseta preta EIGHT">
      </div>
      <div class="hero-content">
        <p class="eyebrow">Nova coleção · The Essentials</p>
        <h1>EIGHT</h1>
        <p>Essencial. Minimalista. Atemporal.</p>
        <a class="button button-light" href="#catalogo">Ver Loja <span>→</span></a>
      </div>
      <span class="hero-index">DESIGNED FOR EVERY DAY · 2026</span>
    </section>

    <section class="benefits">
      <div class="container benefit-grid">
        <div class="benefit"><span class="benefit-number">01</span><div><strong>Materiais premium</strong><span>Estrutura, toque e durabilidade</span></div></div>
        <div class="benefit"><span class="benefit-number">02</span><div><strong>Modelagem atemporal</strong><span>Caimento limpo para todos os dias</span></div></div>
        <div class="benefit"><span class="benefit-number">03</span><div><strong>Compra segura</strong><span>Ambiente 100% protegido</span></div></div>
        <div class="benefit"><span class="benefit-number">04</span><div><strong>Troca fácil</strong><span>Primeira troca por nossa conta</span></div></div>
      </div>
    </section>

    <section class="featured">
      <div class="container">
        <div class="section-head">
          <div><p class="eyebrow">A peça que define a marca</p><h2 class="section-title">O novo essencial.</h2></div>
          <a class="text-link" href="#catalogo">Ver coleção completa →</a>
        </div>
        <div class="product-showcase">
          <a class="product-image-wrap" href="#produto/${basic.id}">
            <img id="featured-image" src="${basic.colors[basicColor]}" alt="${basic.name} na cor ${basicColor}">
            <span class="tag">Bestseller</span>
          </a>
          <div class="product-summary">
            <div class="rating">★★★★★ <span>4.9 · 128 avaliações</span></div>
            <h3>${basic.name}</h3>
            <p class="price">${money(basic.price)}</p>
            <p class="installment">ou ${basic.installment}x de ${money(basic.price / basic.installment)} sem juros</p>
            <p class="option-label">Cor: <span id="featured-color">${basicColor}</span></p>
            <div class="color-options">${colorSwatches(basic, basicColor, "featured")}</div>
            <a class="button" href="#produto/${basic.id}">Conhecer a Basic Tee <span>→</span></a>
          </div>
        </div>
      </div>
    </section>

    <section class="new-collection">
      <div class="container">
        <div class="section-head">
          <div><p class="eyebrow">Core Collection</p><h2 class="section-title">Novos essenciais.</h2></div>
          <p class="section-copy collection-copy">Camadas, formas e texturas criadas para expandir o uniforme cotidiano da EIGHT.</p>
        </div>
        <div class="home-product-grid">${collectionGrid(catalog.slice(1))}</div>
      </div>
    </section>

    <section class="categories">
      <div class="container">
        <div class="section-head"><div><p class="eyebrow">Explore a EIGHT</p><h2 class="section-title">Feito para o seu ritmo.</h2></div></div>
        <div class="category-grid">
          <a class="category-card" href="#catalogo"><img src="assets/images/products/signature-hoodie/preto.png" alt="Moletons EIGHT"><div class="category-content"><h3>Moletons</h3><span>Explorar coleção</span></div></a>
          <a class="category-card" href="#catalogo"><img src="assets/images/products/basic-tee/preto.jpeg" alt="Camisetas EIGHT"><div class="category-content"><h3>Camisetas</h3><span>Descobrir os essenciais</span></div></a>
          <a class="category-card" href="#catalogo"><img src="assets/images/products/core-jogger/preto.png" alt="Calças EIGHT"><div class="category-content"><h3>Calças</h3><span>Conhecer a Core Jogger</span></div></a>
        </div>
      </div>
    </section>

    <section class="manifesto">
      <div class="manifesto-media"><img src="assets/images/lifestyle/basic-tee/retrato-bordo.jpeg" alt="Modelo com camiseta bordô EIGHT"></div>
      <div class="manifesto-copy">
        <img class="manifesto-logo" src="assets/images/brand/logo.jpeg" alt="EIGHT">
        <p class="eyebrow">Sobre a EIGHT</p>
        <h2 class="section-title">Nascida para durar.</h2>
        <p class="section-copy">A EIGHT acredita que o essencial nunca sai de moda. Criamos peças minimalistas, versáteis e atemporais para quem valoriza qualidade, conforto e identidade.</p>
        <a class="button button-outline button-light" href="#institucional">Nossa essência →</a>
        <span class="manifesto-sign">EIGHT · SÃO PAULO · BRASIL</span>
      </div>
    </section>

    <section class="reviews">
      <div class="container">
        <p class="eyebrow">Quem veste, recomenda</p><h2 class="section-title">Essencial para eles.<br>Feito para você.</h2>
        <div class="reviews-grid">
          <div class="review-score"><strong>4.9</strong><div class="review-stars">★★★★★</div><span>Com base em 128 avaliações</span></div>
          <article class="review-card"><div class="review-stars">★★★★★</div><p>“Caimento impecável e tecido muito acima da média. Virou minha camiseta favorita.”</p><strong>Lucas M.</strong><small>Compra verificada · Preto</small></article>
          <article class="review-card"><div class="review-stars">★★★★★</div><p>“O minimalismo que eu procurava. A bordô tem uma cor muito elegante.”</p><strong>Rafael C.</strong><small>Compra verificada · Bordô</small></article>
          <article class="review-card"><div class="review-stars">★★★★★</div><p>“Confortável, estruturada e combina com tudo. Já quero as outras peças.”</p><strong>Bruno A.</strong><small>Compra verificada</small></article>
        </div>
      </div>
    </section>`;
}

function categoryFilters() {
  return [...new Set(catalog.map(product => product.category))].map(category => `
    <label class="check-row">
      <input type="checkbox" data-category-filter="${category}" ${selectedCategories.has(category) ? "checked" : ""}>
      ${category}
    </label>`).join("");
}

function catalogPage() {
  return `
    <section class="catalog-page">
      <div class="container">
        <div class="page-intro"><p class="eyebrow">The EIGHT Collection</p><h1 class="display">Loja</h1><p class="section-copy">Peças essenciais construídas para permanecer.</p></div>
        <div class="catalog-layout">
          <aside class="filters">
            <div class="filter-group"><h3>Buscar</h3><input id="catalog-search" class="filter-search" type="search" placeholder="Nome do produto"></div>
            <div class="filter-group"><h3>Categoria</h3>${categoryFilters()}</div>
            <div class="filter-group"><h3>Preço</h3><input id="price-range" class="range-price" type="range" min="100" max="400" value="400"><span class="filter-value">Até <strong id="price-value">${money(400)}</strong></span></div>
            <div class="filter-group"><h3>Tamanho</h3><div class="size-chips">${["P", "M", "G", "GG", "XGG"].map(size => `<button class="size-chip ${selectedSizes.has(size) ? "active" : ""}" data-size-filter="${size}">${size}</button>`).join("")}</div></div>
            <button class="clear-filters" data-action="clear-filters">Limpar filtros</button>
          </aside>
          <div>
            <div class="catalog-top"><span id="result-count">${catalog.length} produtos</span><select id="catalog-sort" aria-label="Ordenar produtos"><option value="relevant">Mais relevantes</option><option value="low">Menor preço</option><option value="high">Maior preço</option></select></div>
            <div class="catalog-grid" id="catalog-grid">${collectionGrid()}</div>
          </div>
        </div>
      </div>
    </section>`;
}

function productPage(product) {
  activeProduct = product;
  selectedColor = product.colors[selectedColor] ? selectedColor : firstColor(product);
  selectedSize = product.sizes.includes(selectedSize) ? selectedSize : product.sizes[0];
  const selectedSku = skuFor(product, selectedColor, selectedSize);
  const lifestyleTabs = (product.lifestyle || []).map((item, index) =>
    `<button class="gallery-tab" data-gallery-image="${item.image}">${item.label}</button>`).join("");

  return `
    <section class="product-page">
      <div class="container">
        <div class="breadcrumbs"><a href="#home">Início</a> / <a href="#catalogo">${product.category}</a> / ${product.name}</div>
        <div class="product-layout">
          <div class="gallery">
            <div class="gallery-stage"><img id="product-main-image" src="${product.colors[selectedColor]}" alt="${product.name} ${selectedColor}"></div>
            <div class="gallery-tabs ${product.lifestyle ? "" : "single-tab"}" aria-label="Galeria do produto">
              <button class="gallery-tab active" data-gallery-image="${product.colors[selectedColor]}">Produto</button>
              ${lifestyleTabs}
            </div>
          </div>
          <div class="product-detail">
            <p class="eyebrow">${product.collection}</p>
            <h1>${product.name}</h1>
            <div class="rating">★★★★★ <span>4.9 · avaliações verificadas</span></div>
            <p class="price">${money(product.price)}</p>
            <p class="installment">ou ${product.installment}x de ${money(product.price / product.installment)} sem juros</p>
            <p class="product-description">${product.description}</p>
            <div class="product-code"><span>SKU</span><strong id="product-sku">${selectedSku}</strong><small id="product-stock">${availableStock(selectedSku)} unidades disponíveis</small></div>
            <p class="option-label">Cor: <span id="product-color">${selectedColor}</span></p>
            <div class="color-options">${colorSwatches(product, selectedColor, "product")}</div>
            <div class="option-row"><p class="option-label">Tamanho: <span id="product-size">${selectedSize}</span></p><button class="guide-link">Guia de tamanhos</button></div>
            <div class="size-options">${product.sizes.map(size => `<button class="size-option ${size === selectedSize ? "active" : ""}" data-size="${size}">${size}</button>`).join("")}</div>
            <div class="quantity-add"><div class="quantity-control"><button data-qty="-1">−</button><span id="product-quantity">${selectedQuantity}</span><button data-qty="1">+</button></div><button class="button add-button" data-action="add-to-cart">Adicionar ao carrinho</button></div>
            <div class="detail-perks"><div><span>✓</span>Envio em até 2 dias úteis</div><div><span>✓</span>Primeira troca grátis em até 30 dias</div></div>
            <div class="accordion">
              <div class="accordion-row open"><button class="accordion-button">Detalhes do produto <span>−</span></button><div class="accordion-content">${product.details}</div></div>
              <div class="accordion-row"><button class="accordion-button">Cuidados <span>+</span></button><div class="accordion-content">Lavar à máquina com cores similares. Não usar alvejante. Secar à sombra e passar pelo avesso.</div></div>
            </div>
          </div>
        </div>
        ${product.id === "eight-basic-tee" ? bodyFitSection() : relatedProducts(product)}
      </div>
    </section>`;
}

function bodyFitSection() {
  return `
    <section class="body-fit">
      <div class="body-fit-image"><img src="assets/images/lifestyle/basic-tee/corpo-inteiro-preto.png" alt="Modelo de corpo inteiro com camiseta preta EIGHT"></div>
      <div class="body-fit-copy"><p class="eyebrow">Como fica no corpo</p><h2>Caimento limpo.<br>Presença discreta.</h2><p>A Basic Tee foi pensada para acompanhar o movimento do dia sem perder a estrutura visual de uma peça premium.</p></div>
      <div class="body-fit-image"><img src="assets/images/lifestyle/basic-tee/corpo-inteiro-bordo.png" alt="Modelo de corpo inteiro com camiseta bordô EIGHT"></div>
    </section>`;
}

function relatedProducts(product) {
  const related = catalog.filter(item => item.id !== product.id).slice(0, 3);
  return `
    <section class="related-products">
      <div class="section-head"><div><p class="eyebrow">Complete o essencial</p><h2 class="section-title">Você também pode gostar.</h2></div></div>
      <div class="related-grid">${collectionGrid(related)}</div>
    </section>`;
}

function cartPage() {
  const cart = cartWithDetails();
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const items = cart.map((item, index) => {
    return `
      <article class="cart-item">
        <img src="${item.image}" alt="${item.name} ${item.color}">
        <div><h3>${item.name}</h3><div class="cart-meta">SKU: <strong>${item.sku}</strong><br>Cor: ${item.color}<br>Tamanho: ${item.size}</div><div class="cart-actions"><div class="quantity-control"><button data-cart-qty="-1" data-index="${index}">−</button><span>${item.quantity}</span><button data-cart-qty="1" data-index="${index}">+</button></div><button class="remove-item" data-remove="${index}">Remover</button></div></div>
        <span class="cart-price">${money(item.price * item.quantity)}</span>
      </article>`;
  }).join("");

  return `
    <section class="cart-page"><div class="container">
      <div class="page-intro"><p class="eyebrow">Sua seleção</p><h1 class="display">Carrinho</h1></div>
      ${cart.length ? `
        <div class="cart-layout">
          <div>${items}</div>
          <aside class="cart-summary"><img class="cart-logo" src="assets/images/brand/logo.jpeg" alt="EIGHT"><h2>Resumo do pedido</h2><div class="summary-line"><span>Subtotal</span><strong>${money(subtotal)}</strong></div><div class="summary-line"><span>Frete</span><span>Escolhido no checkout</span></div><div class="summary-line summary-total"><span>Total parcial</span><strong>${money(subtotal)}</strong></div><a class="button" href="#checkout">Finalizar compra →</a><p class="secure-note">Seus dados serão revisados antes do envio ao WhatsApp</p></aside>
        </div>` :
        `<div class="empty-cart"><img class="cart-logo" src="assets/images/brand/logo.jpeg" alt="EIGHT" style="margin:0 auto 24px"><h2>Seu carrinho está vazio.</h2><p class="section-copy">Os essenciais estão esperando por você.</p><a class="button" href="#catalogo">Explorar coleção</a></div>`}
    </div></section>`;
}

function checkoutPage() {
  const cart = cartWithDetails();
  if (!cart.length) {
    return `<section class="checkout-page"><div class="container"><div class="empty-cart"><h2>Seu carrinho está vazio.</h2><a class="button" href="#catalogo">Voltar para a loja</a></div></div></section>`;
  }

  const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const items = cart.map(item => `
    <div class="checkout-item">
      <img src="${item.image}" alt="${item.name}">
      <div><strong>${item.name}</strong><span>${item.sku}</span><span>${item.color} · ${item.size} · Qtd. ${item.quantity}</span></div>
      <strong>${money(item.subtotal)}</strong>
    </div>`).join("");

  const shipping = storeConfig.shippingOptions.map((option, index) => {
    const effectivePrice = shippingPrice(option, subtotal);
    return `
    <label class="shipping-option">
      <input type="radio" name="shipping" value="${option.id}" data-shipping-price="${effectivePrice}" ${index === 0 ? "checked" : ""}>
      <span><strong>${option.name}</strong><small>${option.description}</small></span>
      <strong>${effectivePrice ? money(effectivePrice) : "Grátis"}</strong>
    </label>`;
  }).join("");
  const initialShipping = shippingPrice(storeConfig.shippingOptions[0], subtotal);

  return `
    <section class="checkout-page">
      <div class="container">
        <div class="page-intro"><p class="eyebrow">Checkout seguro</p><h1 class="display">Finalizar pedido</h1><p class="section-copy">Revise suas peças e informe os dados para entrega.</p></div>
        ${sessionUser ? "" : `<div class="checkout-login-note">Entre na sua conta para salvar o pedido e o carrinho no Firebase. <a href="#login">Fazer login</a></div>`}
        <form id="checkout-form" class="checkout-layout">
          <div class="checkout-form">
            <section class="checkout-card">
              <div class="checkout-card-head"><span>01</span><div><h2>Dados pessoais</h2><p>Usaremos esses dados somente para processar o pedido.</p></div></div>
              <div class="form-grid">
                <div class="form-field full"><label for="customer-name">Nome completo</label><input id="customer-name" name="name" autocomplete="name" required></div>
                <div class="form-field"><label for="customer-phone">Telefone / WhatsApp</label><input id="customer-phone" name="phone" inputmode="tel" autocomplete="tel" placeholder="(11) 99999-9999" required></div>
                <div class="form-field"><label for="customer-email">E-mail</label><input id="customer-email" name="email" type="email" autocomplete="email" required></div>
                <div class="form-field full"><label for="customer-cpf">CPF <span>(opcional no pedido manual)</span></label><input id="customer-cpf" name="cpf" inputmode="numeric" maxlength="14" placeholder="000.000.000-00"></div>
              </div>
            </section>

            <section class="checkout-card">
              <div class="checkout-card-head"><span>02</span><div><h2>Endereço de entrega</h2><p>Confira os dados para evitar atrasos.</p></div></div>
              <div class="form-grid">
                <div class="form-field"><label for="postal-code">CEP</label><input id="postal-code" name="postalCode" inputmode="numeric" autocomplete="postal-code" required></div>
                <div class="form-field"><label for="state">Estado</label><input id="state" name="state" maxlength="2" placeholder="SP" autocomplete="address-level1" required></div>
                <div class="form-field full"><label for="street">Rua / Avenida</label><input id="street" name="street" autocomplete="address-line1" required></div>
                <div class="form-field"><label for="number">Número</label><input id="number" name="number" required></div>
                <div class="form-field"><label for="complement">Complemento</label><input id="complement" name="complement" autocomplete="address-line2"></div>
                <div class="form-field"><label for="district">Bairro</label><input id="district" name="district" required></div>
                <div class="form-field"><label for="city">Cidade</label><input id="city" name="city" autocomplete="address-level2" required></div>
              </div>
            </section>

            <section class="checkout-card">
              <div class="checkout-card-head"><span>03</span><div><h2>Forma de entrega</h2><p>Escolha a modalidade desejada.</p></div></div>
              <div class="shipping-options">${shipping}</div>
            </section>

            <section class="checkout-card">
              <div class="checkout-card-head"><span>04</span><div><h2>Pagamento</h2><p>Por enquanto, a confirmação é feita diretamente com a loja.</p></div></div>
              <label class="payment-option active">
                <input type="radio" name="payment" value="whatsapp-manual" checked>
                <span class="payment-icon">WA</span>
                <span><strong>Pagamento manual por WhatsApp</strong><small>A loja enviará as instruções e confirmará o pagamento.</small></span>
              </label>
              <div class="future-payment"><span>Mercado Pago</span><small>Integração preparada para uma próxima etapa com backend seguro.</small><strong>Em breve</strong></div>
            </section>
          </div>

          <aside class="checkout-summary">
            <h2>Seu pedido</h2>
            <div class="checkout-items">${items}</div>
            <div class="summary-line"><span>Subtotal</span><strong>${money(subtotal)}</strong></div>
            <div class="summary-line"><span>Entrega</span><strong id="checkout-shipping">${initialShipping ? money(initialShipping) : "Grátis"}</strong></div>
            <div class="summary-line summary-total"><span>Total</span><strong id="checkout-total">${money(subtotal + initialShipping)}</strong></div>
            <input type="hidden" id="checkout-subtotal" value="${subtotal}">
            <label class="terms-check"><input type="checkbox" required> <span>Confirmo que os dados estão corretos e aceito o contato da EIGHT para concluir o pagamento.</span></label>
            <button class="button checkout-submit" type="submit">Confirmar pedido</button>
            <p class="secure-note">O pedido será criado como “Aguardando pagamento”.</p>
          </aside>
        </form>
      </div>
    </section>`;
}

function confirmationPage(orderId) {
  const order = window.EIGHT_ORDERS.findOrder(orderId);
  if (!order) return `<section class="confirmation-page"><div class="container"><div class="empty-cart"><h2>Pedido não encontrado.</h2><a class="button" href="#catalogo">Voltar para a loja</a></div></div></section>`;

  const items = order.items.map(item => `
    <div class="confirmation-item"><div><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.sku)} · ${escapeHtml(item.color)} · ${escapeHtml(item.size)}</span></div><span>${item.quantity} × ${money(item.unitPrice)}</span><strong>${money(item.subtotal)}</strong></div>`).join("");
  const statusIndex = storeConfig.orderStatuses.indexOf(order.status);

  return `
    <section class="confirmation-page"><div class="container confirmation-shell">
      <div class="confirmation-mark">✓</div>
      <p class="eyebrow">Pedido registrado</p>
      <h1>Obrigado, ${escapeHtml(order.customer.name.split(" ")[0])}.</h1>
      <p class="confirmation-lead">Seu pedido <strong>${order.id}</strong> foi salvo e está aguardando a confirmação do pagamento pela equipe EIGHT.</p>
      <div class="order-status">
        ${storeConfig.orderStatuses.filter(status => status !== "Cancelado").map((status, index) => `<div class="${index <= statusIndex ? "active" : ""}"><span></span><small>${status}</small></div>`).join("")}
      </div>
      <div class="confirmation-grid">
        <section class="confirmation-card"><h2>Itens do pedido</h2>${items}<div class="summary-line"><span>Subtotal</span><strong>${money(order.subtotal)}</strong></div><div class="summary-line"><span>${escapeHtml(order.shipping.name)}</span><strong>${money(order.shipping.price)}</strong></div><div class="summary-line summary-total"><span>Total</span><strong>${money(order.total)}</strong></div></section>
        <section class="confirmation-card"><h2>Entrega</h2><p><strong>${escapeHtml(order.customer.name)}</strong><br>${escapeHtml(order.address.street)}, ${escapeHtml(order.address.number)}${order.address.complement ? ` · ${escapeHtml(order.address.complement)}` : ""}<br>${escapeHtml(order.address.district)} · ${escapeHtml(order.address.city)}/${escapeHtml(order.address.state)}<br>CEP ${escapeHtml(order.address.postalCode)}</p><h2>Pagamento</h2><p>Manual por WhatsApp<br><span class="status-pill">${order.status}</span></p></section>
      </div>
      <div class="confirmation-actions">
        <button class="button whatsapp-button" data-action="send-whatsapp" data-order-id="${order.id}">Enviar resumo pelo WhatsApp</button>
        <a class="button button-outline" href="#catalogo">Continuar comprando</a>
      </div>
      ${storeConfig.whatsappNumber ? "" : `<p class="config-warning">O número da loja ainda precisa ser configurado em <code>scripts/config/store.js</code>. O pedido já foi salvo neste dispositivo.</p>`}
    </div></section>`;
}

function loginPage() {
  if (sessionUser) return accountPage();
  return `
    <section class="content-page auth-page"><div class="container"><div class="auth-shell">
      <div class="auth-intro"><img class="login-logo" src="assets/images/brand/logo.jpeg" alt="Logo EIGHT"><p class="eyebrow">Sua conta EIGHT</p><h1>Essenciais que acompanham você.</h1><p>Entre para recuperar seu carrinho, acompanhar pedidos e ter uma experiência contínua em qualquer dispositivo.</p></div>
      <div class="auth-panel">
        <div class="auth-tabs"><button class="active" data-auth-tab="login">Entrar</button><button data-auth-tab="register">Criar conta</button></div>
        <form id="login-form" class="auth-form active" data-auth-form="login">
          <div class="form-field"><label for="login-email">E-mail</label><input id="login-email" name="email" type="email" autocomplete="email" required></div>
          <div class="form-field"><label for="login-password">Senha</label><input id="login-password" name="password" type="password" autocomplete="current-password" required></div>
          <button class="button" type="submit">Entrar</button>
          <button class="auth-text-button" type="button" data-action="recover-password">Esqueci minha senha</button>
        </form>
        <form id="register-form" class="auth-form" data-auth-form="register">
          <div class="form-field"><label for="register-name">Nome completo</label><input id="register-name" name="name" autocomplete="name" required></div>
          <div class="form-field"><label for="register-email">E-mail</label><input id="register-email" name="email" type="email" autocomplete="email" required></div>
          <div class="form-field"><label for="register-password">Senha</label><input id="register-password" name="password" type="password" minlength="6" autocomplete="new-password" required></div>
          <button class="button" type="submit">Criar conta</button>
        </form>
        <p class="auth-status" id="auth-status"></p>
      </div>
    </div></div></section>`;
}

function accountPage() {
  return `
    <section class="content-page"><div class="container account-shell">
      <div class="page-intro"><p class="eyebrow">Minha conta</p><h1 class="display">Olá, ${escapeHtml(sessionUser?.displayName || "cliente")}.</h1><p class="section-copy">${escapeHtml(sessionUser?.email || "")}</p></div>
      <div class="account-grid">
        <a class="account-card" href="#carrinho"><span>01</span><h2>Meu carrinho</h2><p>Continue de onde parou em qualquer dispositivo.</p></a>
        <div class="account-card account-orders-card"><span>02</span><h2>Meus pedidos</h2><div id="account-orders"><p>Carregando pedidos...</p></div></div>
        ${sessionUser?.role === "admin" ? `<a class="account-card admin-account-card" href="#admin"><span>03</span><h2>Painel administrativo</h2><p>Gerencie produtos, estoque, imagens e pedidos.</p></a>` : ""}
      </div>
      <button class="button button-outline logout-button" data-action="logout">Sair da conta</button>
    </div></section>`;
}

function adminPage() {
  if (!sessionUser) return `<section class="content-page"><div class="container"><div class="empty-cart"><h2>Faça login para acessar.</h2><a class="button" href="#login">Entrar</a></div></div></section>`;
  if (sessionUser.role !== "admin") return `<section class="content-page"><div class="container"><div class="empty-cart"><h2>Acesso administrativo necessário.</h2><p class="section-copy">Defina o campo <code>role</code> como <code>admin</code> no documento do usuário no Firestore.</p><a class="button" href="#conta">Voltar para a conta</a></div></div></section>`;

  return `
    <section class="admin-page"><div class="container">
      <div class="admin-header"><div><p class="eyebrow">Administração EIGHT</p><h1 class="display">Painel</h1></div><div class="admin-header-actions"><button class="button button-outline" data-action="seed-products">Sincronizar catálogo completo</button><button class="button button-outline" data-action="logout">Sair</button></div></div>
      <div class="catalog-sync-status" id="catalog-sync-status" role="status"></div>
      <div class="admin-tabs"><button class="active" data-admin-tab="products">Produtos</button><button data-admin-tab="orders">Pedidos</button><button data-admin-tab="categories">Categorias e cupons</button></div>

      <section class="admin-section active" data-admin-section="products">
        <div class="admin-layout">
          <form id="admin-product-form" class="admin-form">
            <h2>Cadastrar ou editar produto</h2>
            <input type="hidden" name="editingId">
            <div class="form-field"><label>ID do produto</label><input name="id" placeholder="eight-nome-produto" required></div>
            <div class="form-field"><label>SKU base</label><input name="skuPrefix" placeholder="CAM-OVS" required></div>
            <div class="form-field"><label>Nome</label><input name="name" required></div>
            <div class="form-grid"><div class="form-field"><label>Categoria</label><input name="category" required></div><div class="form-field"><label>Preço</label><input name="price" type="number" min="0" step="0.01" required></div></div>
            <div class="form-field"><label>Descrição</label><textarea name="description" rows="4" required></textarea></div>
            <div class="form-grid"><div class="form-field"><label>Cor principal</label><input name="color" value="Preto" required></div><div class="form-field"><label>Hex da cor</label><input name="colorHex" value="#151515" required></div></div>
            <div class="form-field"><label>URL ou caminho da imagem</label><input name="imageUrl" required></div>
            <div class="form-field"><label>Estoque por variação</label><input name="stock" type="number" min="0" value="10" required></div>
            <div class="form-field"><label>Upload para Firebase Storage</label><input id="admin-product-image" type="file" accept="image/*"><small id="upload-status"></small></div>
            <label class="admin-check"><input name="active" type="checkbox" checked> Produto ativo</label>
            <button class="button" type="submit">Salvar produto</button>
          </form>
          <div><div class="admin-list-head"><h2>Produtos</h2><button data-action="refresh-admin">Atualizar</button></div><div class="admin-products" id="admin-products"><p>Carregando produtos...</p></div></div>
        </div>
      </section>

      <section class="admin-section" data-admin-section="orders">
        <div class="admin-list-head"><h2>Pedidos recentes</h2><button data-action="refresh-admin">Atualizar</button></div>
        <div class="admin-orders" id="admin-orders"><p>Carregando pedidos...</p></div>
      </section>

      <section class="admin-section" data-admin-section="categories">
        <div class="admin-dual">
          <form id="admin-category-form" class="admin-form"><h2>Nova categoria</h2><div class="form-field"><label>Nome</label><input name="name" required></div><button class="button" type="submit">Salvar categoria</button></form>
          <form id="admin-coupon-form" class="admin-form"><h2>Novo cupom</h2><div class="form-field"><label>Código</label><input name="code" required></div><div class="form-grid"><div class="form-field"><label>Tipo</label><select name="type"><option value="percentual">Percentual</option><option value="fixo">Valor fixo</option></select></div><div class="form-field"><label>Valor</label><input name="value" type="number" min="0" step="0.01" required></div></div><button class="button" type="submit">Salvar cupom</button></form>
        </div>
      </section>
    </div></section>`;
}

function institutionalPage() {
  return `
    <section class="content-page"><div class="container">
      <div class="institutional-grid"><div class="institutional-copy"><img class="institutional-logo" src="assets/images/brand/logo.jpeg" alt="Logo EIGHT"><p class="eyebrow">Nossa essência</p><h1 class="display">Menos, mas melhor.</h1><p>A EIGHT nasceu da busca pela peça certa: aquela que veste bem, dura mais e continua relevante independentemente da estação.</p><p>Nosso símbolo representa continuidade e equilíbrio. Dois ciclos conectados, traduzidos em roupas essenciais para a vida real.</p></div><img src="assets/images/lifestyle/basic-tee/retrato-preto.jpeg" alt="Universo da marca EIGHT"></div>
      <div class="values"><article class="value"><span>01</span><h3>Qualidade</h3><p>Materiais escolhidos com rigor e acabamento feito para durar.</p></article><article class="value"><span>02</span><h3>Essencialidade</h3><p>Design limpo, funcional e livre de excessos passageiros.</p></article><article class="value"><span>03</span><h3>Identidade</h3><p>Peças versáteis que acompanham quem você é.</p></article></div>
    </div></section>`;
}

function currentRoute() {
  const [page = "home", id] = location.hash.replace("#", "").split("/");
  return { page: page || "home", id };
}

function render() {
  const { page, id } = currentRoute();
  selectedQuantity = 1;
  const pages = {
    home: homePage,
    catalogo: catalogPage,
    produto: () => productPage(productById(id)),
    carrinho: cartPage,
    checkout: checkoutPage,
    confirmacao: () => confirmationPage(id),
    login: loginPage,
    conta: accountPage,
    admin: adminPage,
    institucional: institutionalPage
  };
  app.innerHTML = (pages[page] || homePage)();
  window.scrollTo(0, 0);
  bindPageEvents();
  updateCartCount();
  if (page === "admin" && sessionUser?.role === "admin") loadAdminData();
  if (page === "conta" && sessionUser) loadAccountOrders();
}

function addToCart() {
  const cart = getCart();
  const existing = cart.find(item => item.id === activeProduct.id && item.color === selectedColor && item.size === selectedSize);
  const sku = skuFor(activeProduct, selectedColor, selectedSize);
  const quantityInCart = existing?.quantity || 0;
  if (quantityInCart + selectedQuantity > availableStock(sku)) {
    showToast("Quantidade maior que o estoque disponível.");
    return;
  }
  if (existing) existing.quantity += selectedQuantity;
  else cart.push({ id: activeProduct.id, name: activeProduct.name, sku, price: activeProduct.price, color: selectedColor, size: selectedSize, quantity: selectedQuantity });
  saveCart(cart);
  showToast(`${activeProduct.name} adicionado ao carrinho.`);
}

function bindPageEvents() {
  document.querySelectorAll(".color-swatch").forEach(button => button.addEventListener("click", () => {
    const context = button.dataset.context;
    const product = context === "featured" ? catalog[0] : activeProduct;
    selectedColor = button.dataset.color;
    document.querySelectorAll(`.color-swatch[data-context="${context}"]`).forEach(swatch => swatch.classList.toggle("active", swatch.dataset.color === selectedColor));
    const image = document.querySelector(context === "featured" ? "#featured-image" : "#product-main-image");
    if (image) {
      image.style.opacity = ".35";
      setTimeout(() => {
        image.src = product.colors[selectedColor];
        image.alt = `${product.name} ${selectedColor}`;
        image.style.opacity = "1";
      }, 120);
    }
    document.querySelectorAll(".gallery-tab").forEach(tab => tab.classList.toggle("active", tab.textContent.trim() === "Produto"));
    const productTab = document.querySelector(".gallery-tab");
    if (productTab) productTab.dataset.galleryImage = product.colors[selectedColor];
    const label = document.querySelector(context === "featured" ? "#featured-color" : "#product-color");
    if (label) label.textContent = selectedColor;
    updateProductCode();
  }));

  document.querySelectorAll(".size-option").forEach(button => button.addEventListener("click", () => {
    selectedSize = button.dataset.size;
    document.querySelectorAll(".size-option").forEach(size => size.classList.toggle("active", size.dataset.size === selectedSize));
    document.querySelector("#product-size").textContent = selectedSize;
    updateProductCode();
  }));

  document.querySelectorAll(".gallery-tab").forEach(button => button.addEventListener("click", () => {
    document.querySelectorAll(".gallery-tab").forEach(tab => tab.classList.toggle("active", tab === button));
    const image = document.querySelector("#product-main-image");
    image.style.opacity = ".35";
    setTimeout(() => {
      image.src = button.dataset.galleryImage;
      image.alt = button.textContent;
      image.style.opacity = "1";
    }, 120);
  }));

  document.querySelectorAll("[data-qty]").forEach(button => button.addEventListener("click", () => {
    selectedQuantity = Math.max(1, selectedQuantity + Number(button.dataset.qty));
    document.querySelector("#product-quantity").textContent = selectedQuantity;
  }));

  document.querySelector("[data-action='add-to-cart']")?.addEventListener("click", addToCart);
  document.querySelector("#checkout-form")?.addEventListener("submit", submitCheckout);
  document.querySelectorAll("[name='shipping']").forEach(input => input.addEventListener("change", updateCheckoutTotal));
  document.querySelector("[data-action='send-whatsapp']")?.addEventListener("click", event => sendOrderToWhatsApp(event.currentTarget.dataset.orderId));

  document.querySelectorAll("[data-cart-qty]").forEach(button => button.addEventListener("click", () => {
    const cart = getCart();
    const item = cart[Number(button.dataset.index)];
    const product = productById(item.id);
    const sku = item.sku || skuFor(product, item.color, item.size);
    const nextQuantity = Math.max(1, item.quantity + Number(button.dataset.cartQty));
    if (nextQuantity > availableStock(sku, product)) {
      showToast("Limite de estoque atingido.");
      return;
    }
    item.quantity = nextQuantity;
    item.sku = sku;
    saveCart(cart);
    render();
  }));

  document.querySelectorAll("[data-remove]").forEach(button => button.addEventListener("click", () => {
    const cart = getCart();
    cart.splice(Number(button.dataset.remove), 1);
    saveCart(cart);
    render();
    showToast("Produto removido do carrinho.");
  }));

  document.querySelectorAll(".accordion-button").forEach(button => button.addEventListener("click", () => {
    const row = button.parentElement;
    row.classList.toggle("open");
    button.querySelector("span").textContent = row.classList.contains("open") ? "−" : "+";
  }));

  document.querySelectorAll("[data-category-filter]").forEach(input => input.addEventListener("change", () => {
    input.checked ? selectedCategories.add(input.dataset.categoryFilter) : selectedCategories.delete(input.dataset.categoryFilter);
    filterCatalog();
  }));

  document.querySelectorAll("[data-size-filter]").forEach(button => button.addEventListener("click", () => {
    const size = button.dataset.sizeFilter;
    selectedSizes.has(size) ? selectedSizes.delete(size) : selectedSizes.add(size);
    button.classList.toggle("active");
    filterCatalog();
  }));

  const range = document.querySelector("#price-range");
  range?.addEventListener("input", () => {
    document.querySelector("#price-value").textContent = money(Number(range.value));
    filterCatalog();
  });
  document.querySelector("#catalog-search")?.addEventListener("input", filterCatalog);
  document.querySelector("#catalog-sort")?.addEventListener("change", filterCatalog);
  document.querySelector("[data-action='clear-filters']")?.addEventListener("click", () => {
    selectedCategories.clear();
    selectedSizes.clear();
    render();
  });
  document.querySelector("#login-form")?.addEventListener("submit", event => {
    event.preventDefault();
    handleLogin(event.currentTarget);
  });
  document.querySelector("#register-form")?.addEventListener("submit", event => {
    event.preventDefault();
    handleRegister(event.currentTarget);
  });
  document.querySelectorAll("[data-auth-tab]").forEach(button => button.addEventListener("click", () => switchAuthTab(button.dataset.authTab)));
  document.querySelector("[data-action='recover-password']")?.addEventListener("click", recoverPassword);
  document.querySelectorAll("[data-action='logout']").forEach(button => button.addEventListener("click", handleLogout));
  document.querySelectorAll("[data-admin-tab]").forEach(button => button.addEventListener("click", () => switchAdminTab(button.dataset.adminTab)));
  document.querySelector("#admin-product-form")?.addEventListener("submit", saveAdminProduct);
  document.querySelector("#admin-product-image")?.addEventListener("change", uploadAdminImage);
  document.querySelector("#admin-category-form")?.addEventListener("submit", saveAdminCategory);
  document.querySelector("#admin-coupon-form")?.addEventListener("submit", saveAdminCoupon);
  document.querySelector("[data-action='seed-products']")?.addEventListener("click", seedInitialProducts);
  document.querySelectorAll("[data-action='refresh-admin']").forEach(button => button.addEventListener("click", loadAdminData));
}

function switchAuthTab(tab) {
  document.querySelectorAll("[data-auth-tab]").forEach(button => button.classList.toggle("active", button.dataset.authTab === tab));
  document.querySelectorAll("[data-auth-form]").forEach(form => form.classList.toggle("active", form.dataset.authForm === tab));
  document.querySelector("#auth-status").textContent = "";
}

function authStatus(message, error = false) {
  const element = document.querySelector("#auth-status");
  if (!element) return;
  element.textContent = message;
  element.classList.toggle("error", error);
}

async function handleLogin(form) {
  if (!firebaseServices) return authStatus("Firebase ainda está carregando.", true);
  const button = form.querySelector("button[type='submit']");
  button.disabled = true;
  try {
    const data = new FormData(form);
    await firebaseServices.auth.login({ email: data.get("email"), password: data.get("password") });
    location.hash = "conta";
  } catch (error) {
    authStatus(firebaseErrorMessage(error), true);
  } finally {
    button.disabled = false;
  }
}

async function handleRegister(form) {
  if (!firebaseServices) return authStatus("Firebase ainda está carregando.", true);
  const button = form.querySelector("button[type='submit']");
  button.disabled = true;
  try {
    const data = new FormData(form);
    await firebaseServices.auth.register({
      name: data.get("name"),
      email: data.get("email"),
      password: data.get("password")
    });
    location.hash = "conta";
  } catch (error) {
    authStatus(firebaseErrorMessage(error), true);
  } finally {
    button.disabled = false;
  }
}

async function recoverPassword() {
  if (!firebaseServices) return authStatus("Firebase ainda está carregando.", true);
  const email = document.querySelector("#login-email").value.trim();
  if (!email) return authStatus("Informe seu e-mail para recuperar a senha.", true);
  try {
    await firebaseServices.auth.recoverPassword(email);
    authStatus("Enviamos as instruções de recuperação para seu e-mail.");
  } catch (error) {
    authStatus(firebaseErrorMessage(error), true);
  }
}

async function handleLogout() {
  if (!firebaseServices) return;
  if (sessionUser) {
    try {
      await firebaseServices.firestore.saveCart(sessionUser.uid, getCart());
    } catch {}
  }
  await firebaseServices.auth.logout();
  localStorage.setItem("eight-cart", "[]");
  updateCartCount();
  location.hash = "home";
}

function switchAdminTab(tab) {
  document.querySelectorAll("[data-admin-tab]").forEach(button => button.classList.toggle("active", button.dataset.adminTab === tab));
  document.querySelectorAll("[data-admin-section]").forEach(section => section.classList.toggle("active", section.dataset.adminSection === tab));
}

async function loadAdminData() {
  if (!firebaseServices || sessionUser?.role !== "admin") return;
  try {
    [adminProducts, adminOrders] = await Promise.all([
      firebaseServices.firestore.listAllProducts(),
      firebaseServices.firestore.listOrders()
    ]);
    renderAdminProducts();
    renderAdminOrders();
  } catch (error) {
    showToast(firebaseErrorMessage(error));
  }
}

async function loadAccountOrders() {
  const container = document.querySelector("#account-orders");
  if (!container || !firebaseServices || !sessionUser) return;
  try {
    const orders = await firebaseServices.firestore.listUserOrders(sessionUser.uid);
    container.innerHTML = orders.length ? orders.slice(0, 5).map(order => `
      <div class="account-order"><strong>${escapeHtml(order.pedidoId || order.id)}</strong><span>${escapeHtml(order.status)}</span><small>${money(Number(order.valorTotal || 0))}</small></div>`).join("") : "<p>Você ainda não possui pedidos.</p>";
  } catch {
    container.innerHTML = "<p>Não foi possível carregar os pedidos agora.</p>";
  }
}

function renderAdminProducts() {
  const container = document.querySelector("#admin-products");
  if (!container) return;
  container.innerHTML = adminProducts.length ? adminProducts.map(product => `
    <article class="admin-product-row">
      <img src="${Object.values(product.colors)[0] || "assets/images/brand/logo.jpeg"}" alt="${escapeHtml(product.name)}">
      <div><strong>${escapeHtml(product.name)}</strong><span>${escapeHtml(product.skuPrefix)} · ${escapeHtml(product.category)}</span><small>${money(product.price)} · ${product.active ? "Ativo" : "Inativo"}</small></div>
      <div class="admin-row-actions"><button data-admin-edit-product="${product.id}">Editar</button><button data-admin-delete-product="${product.id}">Excluir</button></div>
    </article>`).join("") : "<p>Nenhum produto cadastrado no Firestore.</p>";
  container.querySelectorAll("[data-admin-edit-product]").forEach(button => button.addEventListener("click", () => fillAdminProductForm(button.dataset.adminEditProduct)));
  container.querySelectorAll("[data-admin-delete-product]").forEach(button => button.addEventListener("click", () => removeAdminProduct(button.dataset.adminDeleteProduct)));
}

function renderAdminOrders() {
  const container = document.querySelector("#admin-orders");
  if (!container) return;
  container.innerHTML = adminOrders.length ? adminOrders.map(order => `
    <article class="admin-order-row">
      <div><strong>${escapeHtml(order.pedidoId || order.id)}</strong><span>${escapeHtml(order.cliente?.nome || order.cliente?.name || "Cliente")}</span><small>${money(Number(order.valorTotal || 0))} · ${(order.produtos || []).length} item(ns)</small></div>
      <select data-admin-order-status="${order.id}">
        ${storeConfig.orderStatuses.map(status => `<option ${status === order.status ? "selected" : ""}>${status}</option>`).join("")}
      </select>
    </article>`).join("") : "<p>Nenhum pedido no Firestore.</p>";
  container.querySelectorAll("[data-admin-order-status]").forEach(select => select.addEventListener("change", () => updateAdminOrder(select.dataset.adminOrderStatus, select.value)));
}

function fillAdminProductForm(productId) {
  const product = adminProducts.find(item => item.id === productId);
  const form = document.querySelector("#admin-product-form");
  if (!product || !form) return;
  const color = firstColor(product);
  form.elements.editingId.value = product.id;
  form.elements.id.value = product.id;
  form.elements.id.disabled = true;
  form.elements.skuPrefix.value = product.skuPrefix;
  form.elements.name.value = product.name;
  form.elements.category.value = product.category;
  form.elements.price.value = product.price;
  form.elements.description.value = product.description;
  form.elements.color.value = color;
  form.elements.colorHex.value = product.colorHex[color] || "#151515";
  form.elements.imageUrl.value = product.colors[color] || "";
  form.elements.stock.value = Math.min(...product.sizes.map(size => product.stock?.[skuFor(product, color, size)] ?? 0));
  form.elements.active.checked = product.active;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function saveAdminProduct(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const id = data.get("editingId") || data.get("id").trim();
  const color = data.get("color").trim();
  const sizes = ["P", "M", "G", "GG", "XGG"];
  const base = {
    id,
    skuPrefix: data.get("skuPrefix").trim().toUpperCase(),
    name: data.get("name").trim(),
    category: data.get("category").trim(),
    collection: "EIGHT Collection",
    price: Number(data.get("price")),
    installment: 3,
    badge: "EIGHT",
    description: data.get("description").trim(),
    details: data.get("description").trim(),
    colors: { [color]: data.get("imageUrl").trim() },
    colorHex: { [color]: data.get("colorHex").trim() },
    sizes,
    active: data.get("active") === "on"
  };
  base.stock = Object.fromEntries(sizes.map(size => [skuFor(base, color, size), Number(data.get("stock"))]));
  try {
    await firebaseServices.firestore.saveProduct(base);
    showToast("Produto salvo no Firestore.");
    form.reset();
    form.elements.id.disabled = false;
    form.elements.active.checked = true;
    await loadAdminData();
    const remoteProducts = await firebaseServices.firestore.listActiveProducts();
    if (remoteProducts.length) catalog = remoteProducts;
  } catch (error) {
    showToast(firebaseErrorMessage(error));
  }
}

async function uploadAdminImage(event) {
  const file = event.currentTarget.files[0];
  if (!file) return;
  const form = document.querySelector("#admin-product-form");
  const productId = form.elements.editingId.value || form.elements.id.value.trim();
  if (!productId) {
    showToast("Informe o ID do produto antes do upload.");
    event.currentTarget.value = "";
    return;
  }
  const status = document.querySelector("#upload-status");
  try {
    const upload = await firebaseServices.storage.uploadProductImage(productId, file, progress => {
      status.textContent = `Upload: ${progress}%`;
    });
    form.elements.imageUrl.value = upload.url;
    status.textContent = "Imagem enviada ao Firebase Storage.";
  } catch (error) {
    status.textContent = firebaseErrorMessage(error);
  }
}

async function removeAdminProduct(productId) {
  if (!window.confirm("Excluir este produto do Firestore?")) return;
  try {
    await firebaseServices.firestore.deleteProduct(productId);
    showToast("Produto excluído.");
    await loadAdminData();
  } catch (error) {
    showToast(firebaseErrorMessage(error));
  }
}

async function updateAdminOrder(orderId, status) {
  try {
    await firebaseServices.firestore.updateOrderStatus(orderId, status);
    showToast(`Pedido atualizado para ${status}.`);
    await loadAdminData();
  } catch (error) {
    showToast(firebaseErrorMessage(error));
    await loadAdminData();
  }
}

async function saveAdminCategory(event) {
  event.preventDefault();
  const name = new FormData(event.currentTarget).get("name").trim();
  try {
    await firebaseServices.firestore.saveCategory({ nome: name, ativo: true });
    event.currentTarget.reset();
    showToast("Categoria salva.");
  } catch (error) {
    showToast(firebaseErrorMessage(error));
  }
}

async function saveAdminCoupon(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  try {
    await firebaseServices.firestore.saveCoupon({
      codigo: data.get("code"),
      tipo: data.get("type"),
      valor: data.get("value"),
      ativo: true
    });
    event.currentTarget.reset();
    showToast("Cupom salvo.");
  } catch (error) {
    showToast(firebaseErrorMessage(error));
  }
}

async function seedInitialProducts() {
  const button = document.querySelector("[data-action='seed-products']");
  const status = document.querySelector("#catalog-sync-status");
  if (!firebaseServices?.migration) return showToast("O sincronizador do catálogo ainda está carregando.");
  try {
    button.disabled = true;
    button.textContent = "Sincronizando...";
    status.textContent = "Preparando produtos e imagens.";
    const report = await firebaseServices.migration.migrateCatalog(localCatalog, {
      onProgress(progress) {
        status.textContent = progress.phase === "product"
          ? `Produto ${progress.current} de ${progress.total}: ${progress.product.name}`
          : `${progress.product.name}: imagem ${progress.completed} de ${progress.total}`;
      }
    });
    const remoteProducts = await firebaseServices.firestore.listActiveProducts();
    if (remoteProducts.length) catalog = remoteProducts;
    status.textContent = `${report.products} produtos, ${report.skus} SKUs, ${report.images} imagens e ${report.categories} categorias sincronizados.`;
    showToast("Catálogo completo sincronizado com o Firebase.");
    await loadAdminData();
  } catch (error) {
    status.textContent = firebaseErrorMessage(error);
    showToast(firebaseErrorMessage(error));
  } finally {
    button.disabled = false;
    button.textContent = "Sincronizar catálogo completo";
  }
}

function updateCheckoutTotal() {
  const subtotal = Number(document.querySelector("#checkout-subtotal")?.value || 0);
  const shippingInput = document.querySelector("[name='shipping']:checked");
  const shippingPrice = Number(shippingInput?.dataset.shippingPrice || 0);
  document.querySelector("#checkout-shipping").textContent = shippingPrice ? money(shippingPrice) : "Grátis";
  document.querySelector("#checkout-total").textContent = money(subtotal + shippingPrice);
}

function updateProductCode() {
  const skuElement = document.querySelector("#product-sku");
  if (!skuElement) return;
  const sku = skuFor(activeProduct, selectedColor, selectedSize);
  skuElement.textContent = sku;
  document.querySelector("#product-stock").textContent = `${availableStock(sku)} unidades disponíveis`;
}

async function submitCheckout(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;

  const data = new FormData(form);
  const cart = cartWithDetails();
  if (data.get("phone").replace(/\D/g, "").length < 10) {
    showToast("Informe um telefone válido com DDD.");
    return;
  }
  if (!validCpf(data.get("cpf"))) {
    showToast("Confira o CPF informado.");
    return;
  }
  const unavailable = cart.find(item => item.quantity > availableStock(item.sku, productById(item.id)));
  if (unavailable) {
    showToast(`Estoque insuficiente para ${unavailable.name}.`);
    return;
  }
  const shippingOption = storeConfig.shippingOptions.find(option => option.id === data.get("shipping"));
  const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const shipping = { ...shippingOption, price: shippingPrice(shippingOption, subtotal) };
  const submitButton = form.querySelector("[type='submit']");
  submitButton.disabled = true;
  submitButton.textContent = "Criando pedido...";
  const order = window.EIGHT_ORDERS.createOrder({
    userId: sessionUser?.uid || null,
    customer: {
      name: data.get("name").trim(),
      phone: data.get("phone").trim(),
      email: data.get("email").trim(),
      cpf: data.get("cpf").trim()
    },
    address: {
      postalCode: data.get("postalCode").trim(),
      state: data.get("state").trim().toUpperCase(),
      street: data.get("street").trim(),
      number: data.get("number").trim(),
      complement: data.get("complement").trim(),
      district: data.get("district").trim(),
      city: data.get("city").trim()
    },
    shipping,
    paymentMethod: "whatsapp-manual",
    items: cart.map(item => ({
      productId: item.id,
      name: item.name,
      sku: item.sku,
      color: item.color,
      size: item.size,
      quantity: item.quantity,
      unitPrice: item.price,
      subtotal: item.subtotal
    })),
    subtotal,
    total: subtotal + shipping.price
  });

  if (firebaseServices) {
    try {
      await firebaseServices.firestore.createOrder(order);
    } catch (error) {
      showToast("Pedido salvo localmente. A sincronização com o Firebase falhou.");
      console.error(error);
    }
  }
  saveCart([]);
  if (storeConfig.whatsappNumber) sendOrderToWhatsApp(order.id);
  location.hash = `confirmacao/${order.id}`;
}

function whatsappMessage(order) {
  const itemLines = order.items.map(item =>
    `• ${item.name}\n  SKU: ${item.sku}\n  ${item.color} | Tam. ${item.size} | Qtd. ${item.quantity}\n  ${money(item.unitPrice)} cada | Subtotal: ${money(item.subtotal)}`
  ).join("\n\n");

  return [
    `Olá, EIGHT! Quero concluir o pedido ${order.id}.`,
    "",
    "*ITENS*",
    itemLines,
    "",
    `Subtotal: ${money(order.subtotal)}`,
    `Entrega (${order.shipping.name}): ${money(order.shipping.price)}`,
    `*TOTAL: ${money(order.total)}*`,
    "",
    "*CLIENTE*",
    `${order.customer.name}`,
    `${order.customer.phone}`,
    `${order.customer.email}`,
    order.customer.cpf ? `CPF: ${order.customer.cpf}` : "",
    "",
    "*ENTREGA*",
    `${order.address.street}, ${order.address.number}${order.address.complement ? ` - ${order.address.complement}` : ""}`,
    `${order.address.district} - ${order.address.city}/${order.address.state}`,
    `CEP: ${order.address.postalCode}`,
    "",
    `Status: ${order.status}`
  ].filter(line => line !== "").join("\n");
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
}

async function sendOrderToWhatsApp(orderId) {
  const order = window.EIGHT_ORDERS.findOrder(orderId);
  if (!order) return showToast("Pedido não encontrado.");
  if (!storeConfig.whatsappNumber) {
    await copyText(whatsappMessage(order));
    showToast("Configure o WhatsApp da loja. O resumo foi copiado.");
    return;
  }
  const number = storeConfig.whatsappNumber.replace(/\D/g, "");
  window.open(`https://wa.me/${number}?text=${encodeURIComponent(whatsappMessage(order))}`, "_blank", "noopener");
}

function filterCatalog() {
  const search = document.querySelector("#catalog-search")?.value.toLowerCase().trim() || "";
  const maxPrice = Number(document.querySelector("#price-range")?.value || 400);
  const sort = document.querySelector("#catalog-sort")?.value || "relevant";
  let results = catalog.filter(product => {
    const matchesSearch = `${product.name} ${product.category}`.toLowerCase().includes(search);
    const matchesPrice = product.price <= maxPrice;
    const matchesCategory = !selectedCategories.size || selectedCategories.has(product.category);
    const matchesSize = !selectedSizes.size || [...selectedSizes].some(size => product.sizes.includes(size));
    return matchesSearch && matchesPrice && matchesCategory && matchesSize;
  });

  if (sort === "low") results.sort((a, b) => a.price - b.price);
  if (sort === "high") results.sort((a, b) => b.price - a.price);

  document.querySelector("#catalog-grid").innerHTML = results.length
    ? collectionGrid(results)
    : `<div class="empty-results"><h3>Nenhum produto encontrado</h3><p>Experimente ajustar os filtros.</p></div>`;
  document.querySelector("#result-count").textContent = `${results.length} ${results.length === 1 ? "produto" : "produtos"}`;
}

function setupGlobalEvents() {
  const searchPanel = document.querySelector(".search-panel");
  document.querySelector(".search-trigger").addEventListener("click", () => {
    searchPanel.classList.add("open");
    searchPanel.setAttribute("aria-hidden", "false");
    setTimeout(() => document.querySelector("#global-search").focus(), 250);
  });
  document.querySelector(".search-close").addEventListener("click", () => {
    searchPanel.classList.remove("open");
    searchPanel.setAttribute("aria-hidden", "true");
  });

  const runSearch = () => {
    const term = document.querySelector("#global-search").value;
    location.hash = "catalogo";
    setTimeout(() => {
      const input = document.querySelector("#catalog-search");
      if (input) {
        input.value = term;
        filterCatalog();
      }
    }, 50);
    searchPanel.classList.remove("open");
  };

  document.querySelector(".search-submit").addEventListener("click", runSearch);
  document.querySelector("#global-search").addEventListener("keydown", event => {
    if (event.key === "Enter") runSearch();
  });

  const mobile = document.querySelector(".mobile-menu");
  document.querySelector(".menu-toggle").addEventListener("click", () => {
    mobile.classList.add("open");
    mobile.setAttribute("aria-hidden", "false");
    document.body.classList.add("menu-open");
  });
  document.querySelector(".mobile-close").addEventListener("click", closeMobile);
  mobile.querySelectorAll("a").forEach(link => link.addEventListener("click", closeMobile));
  document.querySelector("#newsletter-form").addEventListener("submit", event => {
    event.preventDefault();
    event.currentTarget.reset();
    document.querySelector(".newsletter-note").textContent = "Bem-vindo à EIGHT.";
  });
}

function closeMobile() {
  document.querySelector(".mobile-menu").classList.remove("open");
  document.querySelector(".mobile-menu").setAttribute("aria-hidden", "true");
  document.body.classList.remove("menu-open");
}

window.addEventListener("hashchange", render);
window.addEventListener("eight:firebase-ready", event => initializeFirebaseIntegration(event.detail));
setupGlobalEvents();
render();
if (window.EIGHT_FIREBASE) initializeFirebaseIntegration(window.EIGHT_FIREBASE);
