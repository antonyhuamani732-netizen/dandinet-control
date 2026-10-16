# D@NDINET Control

Sistema de cobranza para el ISP **D@NDINET** (Pangoa, Satipo, Junín): app para el celular que **cobra incluso sin internet**, con recibos correlativos sin duplicados, PDF por WhatsApp y dashboard.

**Costo de licencias: S/ 0.** PWA en GitHub Pages + Google Apps Script + Google Sheets.

> 🔒 Repositorio **público**: aquí solo hay código y documentación. Los datos de clientes viven únicamente en la hoja de Google de la cuenta del sistema (Ley 29733).

## Estructura
| Carpeta | Contenido |
|---|---|
| `backend/` | Apps Script (API, motor de reglas de negocio, migración). Se sube con `clasp`. |
| `frontend/` | PWA (Fase 4 en adelante) |
| `pruebas-local/` | Pruebas en Node con un simulador de Google Sheets (sin tocar Google) |
| `migracion/` | Cómo se pasan los datos del Excel v2 a Google Sheets |
| `docs/` | Diseño, guías por fase y manuales |

## Fases
| Fase | Documento | Estado |
|---|---|---|
| 0. Diseño | [docs/FASE0_DISENO.md](docs/FASE0_DISENO.md) | ✅ Aprobado (16/10/2026) |
| 1. Hojas, migración y cuadre | [docs/FASE1_INSTALACION.md](docs/FASE1_INSTALACION.md) | ✅ CUADRA en Google (16/10/2026) |
| 2. API, idempotencia y pruebas | [docs/FASE2_API_Y_PRUEBAS.md](docs/FASE2_API_Y_PRUEBAS.md) | ✅ 124/124 en Google + concurrencia real OK (16/10/2026) |
| 3. Inicio de sesión con Google | | Pendiente |
| 4. PWA: búsqueda, ficha y cobro en línea | | Pendiente |
| 5. Modo offline | | Pendiente |
| 6. PDF, WhatsApp y voucher | | Pendiente |
| 7. Corte, reactivación y PPPoE | | Pendiente |
| 8. Dashboard | | Pendiente |
| 9. Aceptación y puesta en marcha | | Pendiente |

## Comandos
```bash
npm run probar          # pruebas locales (cuadre + instalación simulada)
npm run subir:pruebas   # sube backend/ al proyecto de PRUEBAS
npm run subir:prod      # sube backend/ al proyecto de PRODUCCIÓN
npm run abrir:pruebas   # abre el editor de Apps Script de PRUEBAS
```

## Origen
El motor es un port del sistema **CONTROL 2026 v2.xlsm** (Excel VBA), primero hecho para la Opción A (AppSheet) en `D:\CLAUDE\PROYECTO_APP` y adaptado aquí a la Opción B.

## Enlaces
- Repositorio: https://github.com/antonyhuamani732-netizen/dandinet-control
- App (desde la Fase 4): https://antonyhuamani732-netizen.github.io/dandinet-control/
