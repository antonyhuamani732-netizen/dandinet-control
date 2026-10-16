# Fase 1: hojas de PRUEBAS y PRODUCCIÓN, migración y cuadre

## Qué ya está hecho (por mí, desde VS Code)
| | Estado |
|---|---|
| Motor de la Opción A traído a `backend/` y adaptado a la Opción B | ✅ |
| Tablas nuevas `Solicitudes` y `PagosRevisar`; columnas `ULT_MODIF`, `F_DISPOSITIVO`, `URL_VOUCHER`, `INICIALES`; sin las colas de AppSheet | ✅ |
| Prueba local `npm run probar`: cuadre al centavo + instalación simulada de los dos entornos | ✅ **TODO OK** |
| Proyecto **`dandinet-api-pruebas`** creado en `dandinetcontrolclientes@gmail.com` y código subido | ✅ |
| Proyecto **`dandinet-api`** (producción) creado y código subido | ✅ |

| Proyecto | Archivo de clasp | Enlace |
|---|---|---|
| PRUEBAS | `.clasp.pruebas.json` | https://script.google.com/d/186PYCqjYu8YkLkM91M8_ot4IqC2oW_q3q_ZEBJSrX3itRHGe8UQBjsI9/edit |
| PRODUCCIÓN | `.clasp.produccion.json` | https://script.google.com/d/106IvoYBmsWSHZNcR9QKAj2fxq0gUvVrYs5-7BZZHbRcJnnD8WxmE_Ndb/edit |

## Lo que te toca a ti (unos 10 minutos)
Google exige que **el dueño de la cuenta** autorice el script la primera vez. Por eso este paso no lo puedo hacer yo.

> Usa siempre el navegador con la sesión de **dandinetcontrolclientes@gmail.com**. Si tienes varias cuentas abiertas, abre una ventana de incógnito y entra solo con esa.

### Paso 1. Subir los datos de ensayo a Drive (2 min)
1. Entra a **drive.google.com** con `dandinetcontrolclientes@gmail.com`.
2. Arrastra a **Mi unidad** estos dos archivos de `D:\CLAUDE\MACROS EXCEL\CONTROL 2026 v2 - fuentes\build\`:
   - `migracion.json`
   - `esperado.json`

> 🔒 `migracion.json` tiene datos personales de clientes (Ley 29733). No lo compartas. Puedes borrarlo de Drive cuando termine la Fase 2.

### Paso 2. Instalar PRUEBAS (5 min)
1. Abre el proyecto de PRUEBAS (enlace de la tabla de arriba), o en la terminal de VS Code:
   ```bash
   npm run abrir:pruebas
   ```
2. Arriba, en la lista de funciones, elige **`instalarPruebas`** y pulsa ▶ **Ejecutar**.
3. Google pedirá permisos:
   1. **Revisar permisos** → elige `dandinetcontrolclientes@gmail.com`.
   2. Saldrá *"Google no ha verificado esta aplicación"*. Es normal: la app es tuya. Pulsa **Configuración avanzada** → **Ir a dandinet-api-pruebas (no seguro)**.
   3. **Permitir**. Pide acceso a tus hojas, a Drive (para crear el libro, los PDF y los respaldos) y a enviar correo (aviso de renovación anual).
4. Espera 1 a 3 minutos. En el **Registro de ejecución** debe aparecer:
   ```
   [PRUEBAS]
   Creado el libro "DANDINET_DB_PRUEBAS" en la carpeta "DANDINET_PRUEBAS".
   ...
   Cuadre contra el Excel: CUADRA
   Abra el libro: https://docs.google.com/spreadsheets/d/.../edit
   ```
5. Abre ese enlace y revisa:
   - pestaña **Cuadre** → **✅ CUADRA**;
   - pestaña **AvisosMigracion** → los 10 pendientes heredados;
   - pestaña **Panel** → resumen de clientes y deudas.

### Paso 3. Instalar PRODUCCIÓN (2 min)
1. Abre el proyecto de PRODUCCIÓN (enlace de la tabla) o `npm run abrir:prod`.
2. Elige **`instalarProduccion`** → ▶ **Ejecutar** → autoriza igual que en el paso 2.
3. Debe crear la carpeta **DANDINET** con el libro **DANDINET_DB**, con todas las pestañas **vacías**. Así debe quedar: los datos reales se cargan antes de la puesta en marcha (decisión D7).

### Paso 4. Avísame
Copia y pégame el texto del **Registro de ejecución** de los dos pasos (o una captura de la pestaña Cuadre). Si sale un mensaje rojo, pégamelo tal cual.

## Seguridad incorporada
- `instalarPruebas()` y `instalarProduccion()` se pueden ejecutar varias veces **sin duplicar** nada.
- Un proyecto de PRUEBAS **no se puede** instalar como PRODUCCIÓN, ni al revés.
- `reiniciarPruebas()` borra los cobros de prueba y vuelve a importar `migracion.json`. **Solo funciona en PRUEBAS.**
- En la tabla **Usuarios** solo se acepta `ACTIVO = Sí`. Una celda vacía equivale a inactivo.

## ⚠️ Recordatorio sobre los datos
Los datos de ensayo llegan hasta el **04/08/2026**. Por eso PRUEBAS muestra 81 morosos "A CORTAR" con S/ 25,655.50 de deuda vencida. Es esperado: faltan los pagos posteriores (D7).

## Cómo repetir las pruebas locales
```bash
npm run probar
```
- `pruebas-local/cuadre.js`: el motor reproduce el Excel al centavo.
- `pruebas-local/fase1.js`: simula `instalarPruebas()` e `instalarProduccion()` completos.

## Cómo subir cambios del código a Google
```bash
npm run subir:pruebas
```
Producción solo se actualiza cuando una versión ya se probó en PRUEBAS:
```bash
npm run subir:prod
```

## ✅ Resultado en Google (16/10/2026, 01:23–01:25)
Ejecutado desde el navegador integrado con la cuenta `dandinetcontrolclientes@gmail.com`.

| Entorno | Libro | Resultado |
|---|---|---|
| PRUEBAS | `DANDINET_DB_PRUEBAS` (carpeta `DANDINET_PRUEBAS`) | **✅ CUADRA**: 16/16 controles OK, 10 avisos heredados en `AvisosMigracion`, Panel con 81 morosos (esperado: faltan pagos posteriores al 04/08/2026) |
| PRODUCCIÓN | `DANDINET_DB` (carpeta `DANDINET`) | ✅ Estructura creada, vacía |

**Fase 1 cerrada.** Los dos proyectos ya tienen los permisos aceptados.
