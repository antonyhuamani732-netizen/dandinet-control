# Metrado CAPECO

App para el celular (PWA) que calcula el **metrado de estructuras y muros**, la **cantidad de materiales** según las tablas de CAPECO y el **rendimiento de cada partida** (cuadrilla, horas-hombre, días y costo de mano de obra). Funciona **sin internet** y guarda todo en el propio celular.

## Cómo se organiza
**Especialidad → tipo de elemento → elemento → partidas.** Escribes las medidas de un elemento una sola vez (p. ej. *Z-1 × 6*) y de ahí salen sus partidas: concreto, encofrado y acero. Cada grupo (Zapatas, Columnas…) y cada especialidad se despliega u oculta.

| Especialidad | Elementos | Partidas |
|---|---|---|
| Estructuras | Cimiento corrido, sobrecimiento, zapata, columna, viga, placa, losa maciza, losa aligerada, escalera | Concreto (m³), encofrado (m²), acero (kg) |
| Arquitectura | Muro de albañilería (KK 18 huecos, KK macizo, pandereta, pastelero u otro) | Muro (m² netos, descuenta vanos) |
| Otras partidas | Partida manual (excavación, tarrajeo, lo que necesites) | Unidad, metrado, rendimiento, cuadrilla y materiales por unidad |

Cada partida se puede **incluir o no**, usar **metrado calculado o valor fijo** (los materiales se escalan), marcar como **ejecutada** y ajustar su **rendimiento y cuadrilla**.

## Qué calcula
- **Concreto:** cemento, arena, piedra y agua por f'c 140–280; ciclópeo 1:10+30% PG y 1:8+25% PM; ladrillo de techo en aligerados.
- **Encofrado:** madera, clavos y alambre N°8, más **puntales, soleras, tablones, estacas, barrotes, tornapuntas y cuñas** según el elemento, con reúsos del juego.
- **Acero por armado:** barras (con ganchos y traslapes), **mallas en X e Y** (n° = (ancho − 2·rec) ÷ espaciamiento + 1) y **estribos por tramos** con botones +/−, presets y dibujo de la distribución. Tarjeta **Para el maestro**: medida interior, ganchos, longitud de corte, cantidad y varillas.
- **Varillas de 9 m optimizadas:** el corte agrupa piezas en varillas comerciales (primero el más largo) y parte con traslape las de más de 9 m.
- **Muros:** ladrillos `1/((L+J)(H+J))`, mortero `e − n·L·A·H`, cemento, arena y agua según mortero 1:3 a 1:6.
- **Rendimiento:** HH = 8 h × obreros ÷ rendimiento × metrado; días = metrado ÷ (rendimiento × cuadrillas); costo = Σ HH × costo HH.

**Resumen** con casillas por especialidad, tipo, elemento y partida, y el atajo **Solo por avanzar** (excluye lo ejecutado): materiales, varillas, rendimiento por partida y HH de lo elegido. Se exporta a CSV.

**Obra:** registras lo que hizo tu gente (cantidad, horas, personas por categoría). La app calcula tu HH por unidad real, la compara con CAPECO, te dice en cuántos días terminas con N personas y te deja usar ese rendimiento en tus partidas o en la tabla general.

Todos los valores de las tablas son **referenciales y editables** en **Tablas**. Revísalos con tu edición vigente de CAPECO y la tabla salarial de construcción civil.

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
| `data/elementos.js` | Tipos de elemento, medidas y armado típico |
| `calc/` | Motor de cálculo puro (sin pantalla), probado en `tests/` |
| `storage.js` | Guardado local (migra datos de la versión 1); el único archivo a cambiar para pasar a cuentas con suscripción |
| `app.js`, `ui/`, `index.html`, `styles.css` | Interfaz, figuras y editor de estribos |
| `sw.js`, `manifest.webmanifest`, `icons/` | Instalación y modo sin internet |

## Siguiente paso: suscripción
Reemplazar `storage.js` por un backend con inicio de sesión (p. ej. Firebase o Supabase) más un proveedor de pagos, y empaquetar con Capacitor para publicarla en Play Store. El motor de cálculo no cambia.
