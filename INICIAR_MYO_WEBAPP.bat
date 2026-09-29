@echo off
title Myo Armband WebApp & OSC Bridge
color 0b
echo ========================================================
echo       INICIANDO MYO ARMBAND WEBAPP & OSC BRIDGE
echo ========================================================
echo.
echo Verificando proceso Myo Connect...
tasklist /fi "imagename eq Myo Connect.exe" | find /i "Myo Connect.exe" > nul
if errorlevel 1 (
    echo [AVISO] Myo Connect no parece estar en ejecucion.
    echo Asegurate de que Myo Connect este abierto con el dongle USB conectado.
    echo.
) else (
    echo [OK] Myo Connect esta activo.
)

cd /d "%~dp0Myo"
echo Abriendo Dashboard en http://localhost:3000 ...
start http://localhost:3000
echo.
node server.js
pause
