@echo off
setlocal
cd /d "%~dp0"
set "NPM_CONFIG_CACHE=%CD%\.npm-cache"
echo.
echo EIGHT - Publicacao das regras Firebase
echo ======================================
echo.
call "%ProgramFiles%\nodejs\npx.cmd" --yes firebase-tools@latest projects:list >nul 2>&1
if errorlevel 1 goto login
goto deploy

:login
echo.
echo Autorize sua conta Google para continuar.
call "%ProgramFiles%\nodejs\npx.cmd" --yes firebase-tools@latest login
if errorlevel 1 goto erro

:deploy
call "%ProgramFiles%\nodejs\npx.cmd" --yes firebase-tools@latest deploy --project eight-e1db2 --config "%CD%\firebase.json" --only "firestore:rules,firestore:indexes"
if errorlevel 1 goto erro
echo.
echo Regras publicadas com sucesso.
echo Atualize o site com Ctrl+F5 e tente novamente.
pause
exit /b 0

:erro
echo.
echo Nao foi possivel publicar as regras.
echo Confira se a conta Google tem acesso ao projeto eight-e1db2.
pause
exit /b 1
