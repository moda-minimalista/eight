@echo off
setlocal
cd /d "%~dp0"
set "NPM_CONFIG_CACHE=%CD%\.npm-cache"
echo.
echo EIGHT - Publicacao do Firebase
echo ==============================
echo.
echo Preparando todos os arquivos do site, incluindo imagens...
if not exist "firebase-public" mkdir "firebase-public"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Copy-Item -LiteralPath 'index.html' -Destination 'firebase-public\index.html' -Force; " ^
  "Copy-Item -LiteralPath 'assets' -Destination 'firebase-public' -Recurse -Force; " ^
  "Copy-Item -LiteralPath 'scripts' -Destination 'firebase-public' -Recurse -Force; " ^
  "Copy-Item -LiteralPath 'styles' -Destination 'firebase-public' -Recurse -Force; " ^
  "if (-not (Test-Path 'public')) { New-Item -ItemType Directory -Path 'public' | Out-Null }; " ^
  "Copy-Item -LiteralPath 'index.html' -Destination 'public\index.html' -Force; " ^
  "Copy-Item -LiteralPath 'assets' -Destination 'public' -Recurse -Force; " ^
  "Copy-Item -LiteralPath 'scripts' -Destination 'public' -Recurse -Force; " ^
  "Copy-Item -LiteralPath 'styles' -Destination 'public' -Recurse -Force"
if errorlevel 1 goto erro
if not exist "firebase-public\assets\images\brand\logo.jpeg" goto arquivos
if not exist "firebase-public\assets\images\products\basic-tee\preto.jpeg" goto arquivos
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$config = Get-Content -Raw 'firebase.json' | ConvertFrom-Json; " ^
  "if ($config.hosting.public -ne 'firebase-public') { exit 1 }; " ^
  "$html = Get-Content -Raw 'firebase-public\index.html'; " ^
  "if ($html -notmatch '<title>EIGHT \| Moda Minimalista</title>') { exit 1 }; " ^
  "if ($html -match 'Firebase Hosting Setup Complete') { exit 1 }; " ^
  "$publicHtml = Get-Content -Raw 'public\index.html'; " ^
  "if ($publicHtml -match 'Firebase Hosting Setup Complete') { exit 1 }"
if errorlevel 1 goto configuracao
echo Arquivos e imagens preparados com sucesso.
echo.
echo Uma janela do navegador sera aberta para autorizar sua conta Google.
echo Depois do login, as regras e o site serao publicados.
echo.
call "%ProgramFiles%\nodejs\npx.cmd" --yes firebase-tools@latest login
if errorlevel 1 goto erro
call "%ProgramFiles%\nodejs\npx.cmd" --yes firebase-tools@latest deploy --project eight-e1db2 --config "%CD%\firebase.json" --only "firestore:rules,firestore:indexes,hosting"
if errorlevel 1 goto erro
echo.
echo Publicacao concluida.
echo Abrindo o painel online da EIGHT.
start "" "https://eight-e1db2.web.app/#admin"
pause
exit /b 0

:arquivos
echo.
echo Nao foi possivel preparar as imagens para publicacao.
echo Confirme se a pasta assets esta junto deste arquivo.
pause
exit /b 1

:configuracao
echo.
echo PUBLICACAO BLOQUEADA: a pasta publica nao aponta para o site da EIGHT.
echo O firebase.json deve usar "public": "firebase-public".
echo Nao execute firebase init novamente nesta pasta.
pause
exit /b 1

:erro
echo.
echo A publicacao nao foi concluida. Confira o login e tente novamente.
pause
exit /b 1
