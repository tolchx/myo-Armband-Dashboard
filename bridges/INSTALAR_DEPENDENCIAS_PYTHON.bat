@echo off
title Instalar Dependencias Python para Puentes Myo
color 0b
cd /d "%~dp0"

echo ========================================================
echo   INSTALANDO DEPENDENCIAS PYTHON (PYOMYO Y BLEAK)
echo ========================================================
echo.
python -m pip install -r requirements.txt
echo.
if errorlevel 1 (
    echo [ERROR] Hubo un problema al instalar las dependencias.
) else (
    echo [OK] Dependencias instaladas correctamente.
)
echo.
pause
