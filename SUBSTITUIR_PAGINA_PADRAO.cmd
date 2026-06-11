@echo off
setlocal
cd /d "%~dp0"
set "NPM_CONFIG_CACHE=%CD%\.npm-cache"
echo.
echo EIGHT - Substituir pagina padrao do Hosting
echo ============================================
echo.
echo Pasta que sera publicada:
echo %CD%
echo.
if not exist "%CD%\index.html" goto arquivos
if not exist "%CD%\assets" goto arquivos
if not exist "%CD%\scripts" goto arquivos
if not exist "%CD%\styles" goto arquivos

call "%ProgramFiles%\nodejs\npx.cmd" --yes firebase-tools@latest deploy --project eight-e1db2 --config "%CD%\firebase.json" --only hosting
if errorlevel 1 goto login
goto sucesso

:login
echo.
echo Se apareceu erro de autenticacao, autorize sua conta Google.
call "%ProgramFiles%\nodejs\npx.cmd" --yes firebase-tools@latest login --reauth
if errorlevel 1 goto erro
call "%ProgramFiles%\nodejs\npx.cmd" --yes firebase-tools@latest deploy --project eight-e1db2 --config "%CD%\firebase.json" --only hosting
if errorlevel 1 goto erro
goto sucesso

:arquivos
echo.
echo ERRO: os arquivos da loja nao foram encontrados nesta pasta.
pause
exit /b 1

:erro
echo.
echo ERRO: a publicacao nao foi concluida.
echo Verifique se sua conta Google tem acesso ao projeto eight-e1db2.
pause
exit /b 1

:sucesso
echo.
echo SITE EIGHT PUBLICADO COM SUCESSO.
echo Abra https://eight-e1db2.web.app/?v=%RANDOM%
echo.
pause
exit /b 0
