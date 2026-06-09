# Configuração Firebase da EIGHT

Projeto configurado: `eight-e1db2`.

## 1. Ativar serviços no Console Firebase

No [Firebase Console](https://console.firebase.google.com/):

1. Authentication:
   - abra **Authentication > Sign-in method**;
   - selecione **E-mail/senha**;
   - ative a primeira opção **E-mail/senha**;
   - clique em **Salvar**;
   - não é necessário ativar "Link por e-mail" para este projeto;
   - confirme os domínios autorizados do Hosting e `localhost`.
2. Firestore:
   - crie o banco em modo de produção;
   - escolha a região adequada à operação.
3. Storage:
   - inicialize o bucket do projeto.
4. Hosting:
   - o projeto já possui `firebase.json` e `.firebaserc`.

## 2. Instalar e autenticar a Firebase CLI

```bash
npm install -g firebase-tools
firebase login
firebase use eight-e1db2
```

## 3. Publicar regras e site

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
firebase deploy --only hosting
```

Para testar localmente:

```bash
firebase emulators:start
```

Não abra o projeto por `file://` ao testar Firebase. Use Hosting, Emulator Suite ou um servidor HTTP local.

## 4. Criar o primeiro administrador

1. Cadastre uma conta normalmente no site.
2. No Firestore, abra `usuarios/{uid}`.
3. Altere o campo:

```text
role: "admin"
```

4. Saia e entre novamente.
5. Acesse `#admin`.

Usuários comuns não podem promover a própria conta. Essa restrição está em `firestore.rules`.

## 5. Sincronizar o catálogo completo

No painel administrativo, clique em **Sincronizar catálogo completo**.

Isso cria:

- todos os documentos em `produtos`;
- todas as variações e SKUs;
- estoque inicial por SKU, preservando quantidades já existentes;
- documentos em `categorias`;
- upload das imagens para o Firebase Storage;
- URLs definitivas das imagens nos documentos de produtos;
- registro da última sincronização em `configuracoes/catalogo`.

A sincronização pode ser executada novamente para atualizar nomes, preços, descrições e imagens sem restaurar o estoque já movimentado.

## Coleções

```text
produtos/{produtoId}
categorias/{categoriaId}
usuarios/{usuarioId}
usuarios/{usuarioId}/carrinho/atual
pedidos/{pedidoId}
cupons/{codigo}
configuracoes/catalogo
```

## Segurança

- A configuração Web do Firebase identifica o projeto e não é uma chave privada.
- O acesso é controlado por `firestore.rules` e `storage.rules`.
- Contas administrativas são verificadas pelo campo `usuarios.role`.
- Uploads aceitam apenas imagens de até 8 MB.
- Pedidos só podem ser criados no Firestore por usuários autenticados.
- Estoque e status de pedidos só podem ser alterados por administradores.
- Nunca adicione service account, chave privada ou token do Mercado Pago ao frontend.
