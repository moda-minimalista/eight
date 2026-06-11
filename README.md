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

## Administração e Firebase

A aplicação utiliza Firebase para:

- cadastro, login, sessão e recuperação de senha;
- catálogo, categorias, cupons, usuários e pedidos no Firestore;
- carrinho persistente para clientes autenticados;
- imagens originais no Hosting e novos uploads otimizados no Firestore;
- estoque por SKU e redução transacional após confirmação do pagamento;
- painel administrativo de produtos, pedidos e acessos.

Na seção **Acessos**, um administrador ativo pode criar outras contas administrativas, promover clientes, bloquear acessos e enviar redefinição de senha.

As senhas são processadas somente pelo Firebase Authentication. Nenhuma senha é armazenada no código ou no Firestore.

Para a primeira configuração, abra `#configurar-loja`. O fluxo cria o administrador principal, os documentos iniciais e o catálogo automaticamente. Ele é bloqueado pelas regras após a primeira execução.

Para concluir pagamentos automáticos com Mercado Pago:

- criar preferências em uma Cloud Function;
- manter o access token somente no servidor;
- validar os webhooks do Mercado Pago;
- atualizar o pedido para `Pago` somente após confirmação autenticada.

Nunca coloque credenciais privadas do Mercado Pago no código do navegador.

## Firebase

A aplicação agora possui integração modular com:

- Firebase Authentication;
- Cloud Firestore;
- upload de imagens sem dependência do Firebase Storage;
- Firebase Hosting.

Consulte:

- `FIREBASE_SETUP.md` para ativação e deploy;
- `FIREBASE_FILES.md` para a lista exata de arquivos criados e modificados.
