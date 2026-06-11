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
3. Imagens:
   - o projeto funciona sem Firebase Storage;
   - imagens novas são otimizadas e armazenadas no documento do produto;
   - para catálogos maiores, será possível ativar um serviço de arquivos posteriormente.
4. Hosting:
   - o projeto já possui `firebase.json` e `.firebaserc`.

## 2. Instalar e autenticar a Firebase CLI

No Windows, também é possível executar `PUBLICAR_FIREBASE.cmd`. Ele fará o login e publicará regras e Hosting.

Se o Hosting já estiver publicado e aparecer `Missing or insufficient permissions`, execute apenas `PUBLICAR_REGRAS.cmd`.

```bash
npm install -g firebase-tools
firebase login
firebase use eight-e1db2
```

## 3. Publicar regras e site

```bash
firebase deploy --only firestore:rules,firestore:indexes
firebase deploy --only hosting
```

Para testar localmente:

```bash
firebase emulators:start
```

Não abra o projeto por `file://` ao testar Firebase. Use Hosting, Emulator Suite ou um servidor HTTP local.

## 4. Criar o primeiro administrador automaticamente

Depois de publicar as regras e abrir o site pelo Firebase Hosting:

1. acesse `#configurar-loja`;
2. informe nome, e-mail e senha;
3. clique em **Criar administrador e configurar loja**.

O sistema criará automaticamente:

- a conta no Firebase Authentication;
- `usuarios/{uid}` com função `admin`;
- `configuracoes/bootstrap`;
- produtos, variações, SKUs e estoque;
- categorias;
- referências das imagens originais no Hosting.

Essa operação funciona somente uma vez. As regras bloqueiam uma segunda inicialização assim que `configuracoes/bootstrap` é criado.

As coleções `pedidos` e `cupons` aparecem automaticamente quando o primeiro pedido ou cupom for criado, pois o Firestore não mantém coleções vazias.

## Gestão dos demais administradores

Depois que o primeiro administrador estiver ativo:

1. abra o painel administrativo;
2. entre na seção **Acessos**;
3. informe nome, e-mail e uma senha temporária;
4. clique em **Criar acesso administrativo**.

A senha é processada exclusivamente pelo Firebase Authentication. Ela não é armazenada no código nem no Firestore.

Na mesma seção é possível:

- promover um cliente para administrador;
- rebaixar um administrador para cliente;
- bloquear ou reativar um acesso;
- enviar um e-mail de redefinição de senha.

O administrador conectado não pode bloquear ou rebaixar a própria conta pelo painel.

## 5. Sincronizar o catálogo completo

No painel administrativo, clique em **Sincronizar catálogo completo**.

Isso cria:

- todos os documentos em `produtos`;
- todas as variações e SKUs;
- estoque inicial por SKU, preservando quantidades já existentes;
- documentos em `categorias`;
- imagens novas otimizadas e armazenadas no documento do produto;
- referências das imagens originais publicadas no Hosting;
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
