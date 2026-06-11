# Corrigir a página padrão do Firebase Hosting

A página "Firebase Hosting Setup Complete" aparece quando o deploy utiliza uma pasta `public` criada pelo `firebase init`.

Execute o arquivo `PUBLICAR_FIREBASE.cmd` desta mesma pasta. Ele usa explicitamente:

- projeto `eight-e1db2`;
- arquivo `firebase.json` desta pasta;
- diretório público `.` onde está o site EIGHT.

Não execute `firebase init` novamente.

Para substituir apenas a página padrão, execute `SUBSTITUIR_PAGINA_PADRAO.cmd`.
