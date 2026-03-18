@echo off
title FreeBoli - Servidor de desarrollo
cd /d "e:\2026 Desarrollo Web\freeboli"

echo ========================================
echo   FreeBoli - Iniciando entorno local
echo ========================================
echo.

REM 1. Liberar el puerto 3000 si hay un proceso anterior ocupandolo
echo [1/5] Liberando puerto 3000...
for /f "tokens=5" %%p in ('netstat -aon ^| findstr ":3000 " ^| findstr "LISTENING" 2^>nul') do (
  echo   Cerrando proceso PID %%p en puerto 3000...
  taskkill /PID %%p /F >nul 2>&1
)
echo   Puerto 3000 libre.

REM 2. Limpiar cache de Next.js para evitar errores de compilacion
echo [2/5] Limpiando cache .next...
if exist ".next" (
  rmdir /s /q ".next" >nul 2>&1
  echo   Cache eliminado.
) else (
  echo   No habia cache.
)

REM 3. Instalar dependencias si no existe node_modules
echo [3/5] Verificando dependencias...
if not exist "node_modules" (
  echo   Instalando dependencias con pnpm install...
  pnpm install
) else (
  echo   node_modules existe, OK.
)

REM 4. Iniciar el servidor de desarrollo en una nueva ventana minimizada
echo [4/5] Iniciando servidor de desarrollo (pnpm run dev)...
start /min "freeboli-dev" cmd /c "pnpm run dev"

REM 5. Esperar a que el servidor responda en puerto 3000
echo [5/5] Esperando a que el servidor arranque en puerto 3000...
set INTENTOS=0
:esperar
set /a INTENTOS+=1
if %INTENTOS% gtr 30 (
  echo   Timeout: el servidor no respondio en 30 segundos.
  echo   Abriendo http://localhost:3000 de todas formas...
  goto abrir
)
timeout /t 1 /nobreak >nul
curl -s -o nul -w "" http://localhost:3000/ >nul 2>&1
if errorlevel 1 goto esperar

:abrir
echo.
echo ========================================
echo   Servidor listo en http://localhost:3000
echo ========================================
start "" "http://localhost:3000"
echo.
echo Puedes cerrar esta ventana. El servidor
echo sigue corriendo en la ventana minimizada.
echo.
pause

