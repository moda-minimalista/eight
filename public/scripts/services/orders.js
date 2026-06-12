(function () {
  const ORDER_KEY = "eight-orders";
  const STOCK_KEY = "eight-stock";

  function read(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) || fallback;
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function orderNumber() {
    const date = new Date();
    const stamp = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("");
    const random = crypto.getRandomValues(new Uint32Array(1))[0].toString(36).toUpperCase().slice(0, 6);
    return `EIGHT-${stamp}-${random}`;
  }

  function getOrders() {
    return read(ORDER_KEY, []);
  }

  function getStock() {
    return read(STOCK_KEY, {});
  }

  function ensureStock(items) {
    const stock = getStock();
    items.forEach(item => {
      if (typeof stock[item.sku] !== "number") stock[item.sku] = 10;
    });
    write(STOCK_KEY, stock);
    return stock;
  }

  function createOrder(payload) {
    const orders = getOrders();
    const order = {
      ...payload,
      id: orderNumber(),
      status: "Aguardando pagamento",
      paymentStatus: "pending",
      stockReduced: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    ensureStock(order.items);
    orders.unshift(order);
    write(ORDER_KEY, orders);
    return order;
  }

  function updateStatus(orderId, status) {
    const validStatuses = window.EIGHT_STORE_CONFIG.orderStatuses;
    if (!validStatuses.includes(status)) throw new Error("Status de pedido inválido.");

    const orders = getOrders();
    const order = orders.find(item => item.id === orderId);
    if (!order) throw new Error("Pedido não encontrado.");

    if (status === "Pago" && !order.stockReduced) {
      const stock = ensureStock(order.items);
      order.items.forEach(item => {
        stock[item.sku] = Math.max(0, stock[item.sku] - item.quantity);
      });
      write(STOCK_KEY, stock);
      order.stockReduced = true;
      order.paymentStatus = "approved";
      order.paidAt = new Date().toISOString();
    }

    order.status = status;
    order.updatedAt = new Date().toISOString();
    write(ORDER_KEY, orders);
    return order;
  }

  function findOrder(orderId) {
    return getOrders().find(order => order.id === orderId);
  }

  window.EIGHT_ORDERS = { createOrder, updateStatus, findOrder, getOrders, getStock };
})();
