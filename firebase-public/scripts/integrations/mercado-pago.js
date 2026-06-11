window.EIGHT_MERCADO_PAGO = {
  enabled: false,

  async createPreference() {
    throw new Error(
      "Mercado Pago ainda não configurado. A preferência deve ser criada em um backend seguro, nunca diretamente no navegador."
    );
  }
};
