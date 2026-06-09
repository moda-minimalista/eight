# EIGHT Store

Loja virtual estática e responsiva da EIGHT.

## Estrutura

```text
eight-store/
├── assets/
│   └── images/
│       ├── brand/              # Logo e identidade
│       ├── lifestyle/          # Fotos com modelo
│       └── products/           # Imagens separadas por produto
├── scripts/
│   ├── data/
│   │   └── products.js         # Catálogo e informações dos produtos
│   ├── config/
│   │   └── store.js            # WhatsApp, entrega e configurações da loja
│   ├── integrations/
│   │   └── mercado-pago.js     # Adaptador reservado para integração segura
│   ├── services/
│   │   └── orders.js           # Pedidos, estados e estoque local
│   └── app.js                  # Interface, filtros, produto e carrinho
├── styles/
│   └── main.css                # Estilos e responsividade
└── index.html                  # Estrutura principal e SEO
```

## Adicionar um produto

1. Crie uma pasta em `assets/images/products/`.
2. Coloque as imagens do produto nessa pasta.
3. Cadastre o produto no array `EIGHT_CATALOG`, em `scripts/data/products.js`.

A página de produto, o catálogo, os filtros, os relacionados e o carrinho são gerados automaticamente a partir desses dados.

## Checkout e pedidos

O checkout atual usa pagamento manual por WhatsApp:

1. O cliente informa dados pessoais, endereço e forma de entrega.
2. O sistema gera um pedido único no estado `Aguardando pagamento`.
3. O pedido é salvo no navegador e o resumo pode ser enviado ao WhatsApp.
4. O estoque é reduzido somente quando o pedido muda para `Pago`.

Estados disponíveis:

- `Aguardando pagamento`
- `Pago`
- `Em separação`
- `Enviado`
- `Entregue`
- `Cancelado`

Em uma futura função administrativa ou webhook autenticado:

```js
EIGHT_ORDERS.updateStatus(orderId, "Pago");
```

Essa operação reduz o estoque uma única vez, mesmo que a confirmação seja recebida novamente.

Para configurar o WhatsApp da loja, informe o número com DDI e DDD em:

```js
// scripts/config/store.js
whatsappNumber: "5511999999999"
```

## Produção com Mercado Pago e Firebase

O armazenamento local é adequado para protótipo e operação manual em um único dispositivo, mas não substitui um backend de produção.
Dados pessoais e pedidos ficam no `localStorage` do navegador nesta etapa. Não use essa versão como armazenamento definitivo de dados sensíveis.

Para vendas reais:

- salvar pedidos e estoque no Firebase/Firestore;
- criar preferências do Mercado Pago em uma Cloud Function;
- manter o access token somente no servidor;
- validar webhooks do Mercado Pago;
- chamar `updateStatus(orderId, "Pago")` somente após confirmação autenticada;
- aplicar regras de segurança, autenticação administrativa e controle transacional de estoque.

Nunca coloque credenciais privadas do Mercado Pago no código do navegador.

## Firebase

A aplicação agora possui integração modular com:

- Firebase Authentication;
- Cloud Firestore;
- Firebase Storage;
- Firebase Hosting.

Consulte:

- `FIREBASE_SETUP.md` para ativação e deploy;
- `FIREBASE_FILES.md` para a lista exata de arquivos criados e modificados.
