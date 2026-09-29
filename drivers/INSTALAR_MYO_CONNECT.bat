@echo off
title Instalador Myo Connect
color 0b
cd /d "%~dp0"

echo ========================================================
echo             INSTALADOR MYO CONNECT
echo ========================================================
echo.

if not exist "Myo+Connect+Installer.exe" (
    echo Ensamblando instalador a partir de los paquetes...
    copy /b "Myo_Connect_Installer.part1" + "Myo_Connect_Installer.part2" "Myo+Connect+Installer.exe" > nul
    if exist "Myo+Connect+Installer.exe" (
        echo [OK] Myo+Connect+Installer.exe preparado con exito.
    ) else (
        echo [ERROR] No se pudo ensamblar el instalador.
        pause
        exit /b 1
    )
) else (
    echo [OK] Myo+Connect+Installer.exe ya esta listo.
)

echo.
echo Iniciando instalador de Myo Connect...
start "" "Myo+Connect+Installer.exe"
exit /b 0
