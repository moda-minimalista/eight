window.EIGHT_STORE_CONFIG = {
  storeName: "EIGHT",
  whatsappNumber: "",
  currency: "BRL",
  paymentProvider: "whatsapp-manual",
  shippingOptions: [
    { id: "standard", name: "Entrega padrão", description: "5 a 9 dias úteis", price: 19.9 },
    { id: "express", name: "Entrega expressa", description: "2 a 4 dias úteis", price: 34.9 },
    { id: "pickup", name: "Retirada combinada", description: "Agendamento pelo WhatsApp", price: 0 }
  ],
  orderStatuses: [
    "Aguardando pagamento",
    "Pago",
    "Em separação",
    "Enviado",
    "Entregue",
    "Cancelado"
  ]
};
