@echo off
title Star Dance - Liga de Patin Artistico
echo ============================================
echo   STAR DANCE - Plataforma de la Liga
echo ============================================
echo.
cd /d "%~dp0"

if not exist node_modules (
  echo Instalando dependencias por primera vez...
  call npm install
)

if not exist stardance.db (
  echo Cargando datos iniciales...
  call npm run seed
)

echo.
echo Iniciando el servidor...
echo Abri en el navegador:  http://localhost:3000
echo (Para cerrar el servidor, cerra esta ventana)
echo.
call npm start
pause
