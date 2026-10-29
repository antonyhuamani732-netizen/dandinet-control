# Metrado CAPECO

App para el celular (PWA) que calcula el **metrado de estructuras y muros**, la **cantidad de materiales** según las tablas de CAPECO y el **rendimiento de cada partida** (cuadrilla, horas-hombre, días y costo de mano de obra). Funciona **sin internet** y guarda todo en el propio celular.

## Qué calcula
| Partida | Metrado | Materiales |
|---|---|---|
| Concreto (cimiento, sobrecimiento, zapata, columna, viga, placa, losa maciza, losa aligerada, escalera) | m³ | Cemento, arena, piedra, agua por f'c 140–280; ciclópeo 1:10+30% PG y 1:8+25% PM (hormigón, piedra grande/mediana); ladrillo de techo en aligerados |
| Acero de refuerzo | kg | kg por diámetro con ganchos y traslapes, estribos por distribución (`1@.05, 4@.10, r@.25`), n° de varillas de 9 m, alambre N°16 |
| Encofrado | m² | Madera tornillo (p²), clavos 3", alambre N°8 |
| Muros de albañilería (KK 18 huecos, KK macizo, pandereta, pastelero u otro) | m² netos (descuenta vanos) | Ladrillos `1/((L+J)(H+J))`, mortero `e − n·L·A·H`, cemento, arena y agua según mortero 1:3 a 1:6 |

**Rendimiento por partida:** HH = 8 h × obreros de la categoría ÷ rendimiento × metrado; días = metrado ÷ (rendimiento × cuadrillas); costo = Σ HH × costo de hora-hombre.

Todos los valores (dosificaciones, desperdicios, rendimientos, cuadrillas y costo de HH) son **referenciales y editables** en la pestaña **Tablas**. Revísalos con tu edición vigente de CAPECO y la tabla salarial de construcción civil.

## Instalar en el celular
La app necesita HTTPS. Con GitHub Pages activo en este repositorio (rama `main`):

1. Abre en Chrome del celular: `https://antonyhuamani732-netizen.github.io/dandinet-control/metrado-app/`
2. Menú ⋮ → **Agregar a pantalla principal** (o **Instalar app**).
3. Ábrela una vez con internet; desde ahí funciona sin conexión.

Los datos viven solo en ese celular: usa **Proyectos → Descargar respaldo** para guardarlos o pasarlos a otro equipo.

## Desarrollo
```bash
cd metrado-app
npm test          # pruebas del motor de cálculo
npm run serve     # http://localhost:5173
```
Al publicar cambios, sube `VERSION` en `sw.js` para que los celulares descarguen la nueva versión.

| Archivo | Contenido |
|---|---|
| `data/capeco.js` | Tablas por defecto (CAPECO) |
| `calc/` | Motor de cálculo puro (sin pantalla), probado en `tests/` |
| `storage.js` | Guardado local; el único archivo a cambiar para pasar a cuentas con suscripción |
| `app.js`, `index.html`, `styles.css` | Interfaz |
| `sw.js`, `manifest.webmanifest`, `icons/` | Instalación y modo sin internet |

## Siguiente paso: suscripción
Reemplazar `storage.js` por un backend con inicio de sesión (p. ej. Firebase o Supabase) más un proveedor de pagos, y empaquetar con Capacitor para publicarla en Play Store. El motor de cálculo no cambia.
