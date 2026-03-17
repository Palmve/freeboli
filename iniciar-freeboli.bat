@echo off
REM Iniciar entorno de desarrollo de FreeBoli y abrir el juego en el navegador

REM Ir a la carpeta del proyecto
cd /d "e:\2026 Desarrollo Web\freeboli"

REM Instalar dependencias si no existe node_modules (solo la primera vez)
if not exist "node_modules" (
  echo Instalando dependencias con npm install...
  npm install
)

REM Iniciar el servidor de desarrollo en una nueva ventana
echo Iniciando servidor de desarrollo (npm run dev)...
start "freeboli-dev-server" cmd /c "npm run dev"

REM Esperar unos segundos para que arranque el servidor
echo Esperando a que arranque el servidor...
timeout /t 10 /nobreak >nul

REM Abrir el juego en el navegador.
REM Next intenta usar primero el 3000; si está ocupado, usará 3001, 3002, 3003, etc.
REM Abrimos 3000 y 3003 (el que esté activo se verá con diseño).
start "" "http://localhost:3000"
start "" "http://localhost:3003"

echo Listo. Deja esta ventana abierta si quieres que el servidor siga corriendo.
pause

