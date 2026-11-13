@echo off
rem Doble clic para abrir Metrado CAPECO en la red local (celular por WiFi).
title Metrado CAPECO - servidor local
cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel%==0 (
  node servidor.mjs %1
  goto fin
)

where python >nul 2>nul
if %errorlevel%==0 (
  echo Node.js no esta instalado; se usa Python.
  echo En el celular abre:  http://IP-DE-ESTA-PC:8080/   ^(la IP sale con el comando ipconfig^)
  python -m http.server 8080 --bind 0.0.0.0
  goto fin
)

echo No se encontro Node.js ni Python.
echo Instala Node.js desde https://nodejs.org (version LTS) y vuelve a abrir este archivo.

:fin
pause
