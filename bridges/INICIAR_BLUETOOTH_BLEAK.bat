@echo off
title Puente Bluetooth Nativo PC (Bleak)
color 0b
cd /d "%~dp0"

echo ========================================================
echo     INICIANDO PUENTE BLUETOOTH NATIVO PC (BLEAK)
echo         (SIN DONGLE Y SIN MYO CONNECT)
echo ========================================================
echo.
echo Asegurate de:
echo  1. Tener el Bluetooth de Windows ENCENDIDO.
echo  2. Mover la pulsera Myo para despertarla.
echo  3. Si tienes el dongle USB oficial enchufado, desconectalo para
echo     que la pulsera se conecte al Bluetooth de tu PC.
echo.

python bridge_bleak_bluetooth.py
pause
