@echo off
title Puente Dongle Myo (pyomyo)
color 0b
cd /d "%~dp0"

echo ========================================================
echo       INICIANDO PUENTE MYO DONGLE (PYOMYO)
echo            (SIN MYO CONNECT)
echo ========================================================
echo.
echo Verificando que Myo Connect no este bloqueando el puerto COM...
tasklist /fi "imagename eq Myo Connect.exe" | find /i "Myo Connect.exe" > nul
if not errorlevel 1 (
    echo.
    echo [ATENCION] Se detecto 'Myo Connect.exe' en ejecucion.
    echo Para que pyomyo pueda tomar control directo del Dongle USB,
    echo debes CERRAR Myo Connect primero.
    echo.
    echo Cerrando Myo Connect automaticamente...
    taskkill /f /im "Myo Connect.exe" > nul 2>&1
    timeout /t 2 > nul
)

python bridge_pyomyo_dongle.py
pause
