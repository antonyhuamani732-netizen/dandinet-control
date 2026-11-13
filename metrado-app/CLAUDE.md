# Metrado CAPECO — guía para Claude

App PWA (celular y PC) para **metrados de obras en Perú** por especialidad (OE.2 Estructuras, OE.3 Arquitectura,
OE.4 Instalaciones sanitarias, OE.5 Instalaciones eléctricas, OE.X Otras): cantidad de materiales según tablas de
**CAPECO**, acero con criterios de la **E.060 / E.070** y **rendimiento** de mano de obra por partida.
El dueño es ingeniero/residente de obra, no programador. **Versión actual: v12.**

## Cómo trabajar con el usuario
- **Responde siempre en español** (Perú), claro y sin jerga de programación. Explica qué cambió en la app,
  no en el código.
- **Unidades métricas** (m, m², m³, kg, cm para recubrimientos). Vocabulario de obra: partida, metrado, subtema,
  planilla, N° veces, varilla de 9 m, estribo, bastón, acero corrido, peraltada / chata / de borde, f'c, bolsas, pto.
- Haz una sola pregunta concreta si algo es ambiguo; si hay un valor por defecto razonable, úsalo y dilo.
- **Después de cada cambio, prueba la app de verdad** (ver "Verificar"), en celular (390 px) y PC (1366×768).
- Termina diciendo qué cambió, qué probaste y si debe recargar (Ctrl+F5) o tocar **Actualizar**.

## Dónde corre
- **Local (Windows):** `D:\CLAUDE\metrado-app`, se abre con **`iniciar-servidor.bat`** (`node servidor.mjs`,
  puerto **8080**; HTTPS opcional en 8443 con `certificados\cert.pem/key.pem`). PC: `http://localhost:8080/`;
  celular por WiFi: `http://IP-DE-LA-PC:8080/`.
  - Si el usuario dice "no veo los cambios", lo primero es comprobar que el **servidor esté encendido**: sin
    servidor el navegador muestra la copia guardada (modo sin internet), que es la versión vieja.
  - La carpeta local **no es un repositorio git** (está dentro de `D:\CLAUDE`, que sí lo es, pero ignorada).
    Hay respaldos en `D:\CLAUDE\metrado-app-respaldo-*` (no editarlos).
- **Nube / GitHub:** `antonyhuamani732-netizen/dandinet-control`, carpeta `metrado-app/`, rama
  `ccr-36c378d1-nge02i` (PR #1 sin fusionar). Si el usuario pide subir cambios, pregúntale antes de hacer push.
  No publicar en GitHub Pages ni otra nube salvo que lo pida.

## Comandos
```bash
npm test                  # node --test tests/calc.test.mjs  (41 pruebas; deben pasar todas)
npm run local             # servidor en el puerto 8080 (igual que iniciar-servidor.bat)
node servidor.mjs 8091    # otro puerto para probar sin cerrar el del usuario
```
No hay paso de compilación: JavaScript puro con módulos ES. No agregues frameworks ni dependencias de npm.

## Estructura
| Ruta | Qué hay |
|---|---|
| `index.html`, `styles.css`, `app.js` | Interfaz (vistas Partidas, Planilla, Resumen, Obra, Tablas, Proyectos; editor; selector/catálogo; formulario de proyecto) |
| `data/capeco.js` | Tablas por defecto (concreto por f'c, encofrado, acero, ladrillos, mortero, rendimientos, costos) |
| `data/elementos.js` | Especialidades, **subtemas**, tipos de elemento (con figura y **partidas libres**), medidas, armado típico, plantillas |
| `data/catalogo.js` | **Catálogo de 65 partidas** por especialidad y subtema (unidad, rendimiento, cuadrilla, materiales; accesorios con filas) |
| `calc/` | Motor de cálculo **puro** (sin DOM), probado en `tests/`: concreto, encofrado, acero, corte, muros, rendimiento, norma E.060, obra, **detalle por filas** |
| `calc/util.js` | `num()` / `evaluar()`: los campos aceptan fórmulas (`25.283/2`) |
| `ui/` | Figuras SVG, estribos, guía, **planilla (por especialidad → subtema)**, informe (con datos de obra), PDF propio, calculadora, iconos, Excel |
| `storage.js` | Guardado en `localStorage` (`metrado-capeco.v2`, migra v1). Normaliza `datos` del proyecto y `misPartidas`. Único archivo a cambiar para cuentas en la nube |
| `vendor/xlsx.mini.min.js` | SheetJS 0.18.5 (no lo edites) |
| `sw.js` | Service worker (modo sin internet); `ARCHIVOS` incluye `data/catalogo.js` |
| `servidor.mjs`, `iniciar-servidor.bat` | Servidor local para la red WiFi |

## Modelo de datos (lo importante)
- **Proyecto:** `{ id, nombre, datos, creado, elementos[], registros[], seleccion }`.
  `datos = { propietario, ubicacion, responsable, inicio (AAAA-MM-DD), plazo, descripcion, especialidades[] }`.
  Al crear un proyecto se abre un formulario que pide estos datos (solo el nombre es obligatorio). Partidas
  muestra solo las especialidades elegidas **más** las que ya tengan elementos. Salen en Informe y PDF.
- **Elementos con figura** (`cimiento`, `sobrecimiento`, `zapata`, `columna`, `viga`, `placa`, `losa_maciza`,
  `losa_aligerada`, `escalera`, `muro`): tienen `TIPOS[t].subtema` fijo (Concreto simple, Concreto armado,
  Muros y tabiques de albañilería).
- **Partidas libres**: un tipo por especialidad (`LIBRE_POR_ESP`): `libre_est`, `libre_arq`, `libre_san`,
  `libre_ele`, `manual` (OE.X). Todas usan la partida `manual` (unidad, metrado, rendimiento, cuadrilla,
  materiales por unidad). Usa `esLibre(tipo)`, nunca `tipo === 'manual'`. `el.grupo` = subtema escrito por el
  usuario; `moverEspecialidad()` cambia la especialidad sin perder datos.
- **Detalle por filas** (partida libre): `partidas.manual.modoMetrado = 'valor' | 'detalle'` y
  `detalle = [{ desc, veces, largo, ancho, alto, material, und }]`.
  - Parcial = N° veces (vacío = 1) × las medidas llenas; veces negativas descuentan (vanos). `parcialFila()`,
    `metradoManual()`, `usaDetalle()` en `calc/elemento.js`.
  - Filas con `material: true` salen en el **pedido** como material con su propia cantidad (codos, tees…);
    las que quedan en 0 no salen. Sin medidas se muestran como fila compacta (accesorio, cantidad, und).
- **Subtemas** (`SUBTEMAS` en `data/elementos.js`), en el orden de la Norma Técnica de Metrados; el código sale
  de la posición: OE.2.1 Obras preliminares, OE.2.2 Movimiento de tierras, OE.2.3 Concreto simple, OE.2.4
  Concreto armado; OE.3.1 Muros… OE.3.8 Pintura; OE.4.1 Aparatos sanitarios… OE.4.6 Accesorios de desagüe;
  OE.5.1 Salidas… OE.5.5 Artefactos. Los subtemas propios van al final (OE.3.9…). `subtemaDe()`,
  `subtemasEspecialidad()`, `codigoSubtema()`. Si se agrega un subtema a la lista, cambian los códigos de los
  propios: avisar al usuario.
- **Mis partidas**: `S.misPartidas[]` (a nivel de datos, no de proyecto): plantillas guardadas por el usuario
  desde el editor ("Guardar en Mis partidas"), incluyen sus filas de detalle. Aparecen con ★ en el catálogo de
  su subtema; se borran en Tablas › Mis partidas. `nuevaDesdePlantilla()` / `plantillaDesde()`.

## Reglas que no se deben romper
- **Al cambiar cualquier archivo de la app**, sube `VERSION` en `sw.js` (`metrado-v12` → `v13`…) **y**
  `VERSION_APP` en `app.js` (se muestra al pie de Proyectos). Archivo nuevo que deba funcionar sin internet →
  agrégalo a `ARCHIVOS` en `sw.js`.
- El service worker es **primero red, luego caché**; no lo vuelvas cache-first.
- `styles.css` tiene `[hidden] { display: none !important; }`. No lo quites.
- Rejillas de campos con `repeat(auto-fit, …)` (no `auto-fill`): con `auto-fill` los campos quedaban "solo de
  un lado" en PC.
- Nombres largos: el nombre del elemento (editor) y del proyecto son `<textarea>` con `field-sizing: content`;
  Enter no hace salto de línea. Los títulos usan `overflow-wrap: anywhere`. No vuelvas a `<input>`.
- Temas: oscuro por defecto (`:root`), claro con `:root[data-theme="light"]`. Usa siempre las variables
  (`--bg`, `--superficie`, `--hundido`, `--elevado`, `--tinta`, `--tenue`, `--acento`…), nunca colores fijos
  (excepción: iconos de especialidad). El PDF/impresión sale siempre en claro.
- Editor: en el celular ocupa toda la pantalla; en tablet/PC es una ventana grande; en PC puede ir al costado
  (`localStorage` `metrado-editor`). Revisa ambos al tocar el editor.
- Cálculo: la lógica va en `calc/` (o funciones puras de `data/`) con prueba en `tests/calc.test.mjs`; la
  interfaz solo muestra.
- Longitudes internas en **metros**; el recubrimiento se guarda en **cm** por partida de acero (`recCm`).
- Todo `localStorage` va dentro de `try/catch`.
- **Privacidad**: el repositorio en GitHub es público. Nunca subas datos de obras o clientes (nombres,
  direcciones, metrados reales, Excel del usuario) ni certificados.

## Criterios técnicos ya acordados con el usuario
- Varillas de **9 m**. Varillas "por peso" = REDONDEAR.MAS(kg ÷ (kg/m × 9) × 1.10), como en su Excel, junto al
  corte optimizado (primero la pieza más larga; las de más de 9 m se parten con traslape).
- `escalaCAD`: medida leída en AutoCAD ÷ factor (en sus planos dividía entre 2).
- En su Excel, el VB de 8 mm es un amarre alrededor del acero longitudinal: **mantenerlo como está**, con su peso.
- Recubrimientos E.060 sugeridos: 7.5 cm contra el suelo, 4 cm en vigas y columnas, 2 cm en losas, placas y
  escaleras. Uno por partida.
- Anclajes por apoyo (columna, zapata, viga peraltada, viga chata con gancho recortado a su peralte, continúa,
  traslape, volado, manual) y zonas: corrido, bastón izquierdo/derecho/ambos, central.
- Valores del **catálogo** (rendimientos, cuadrillas, materiales por unidad) son **referenciales** cargados por
  Claude, no una tabla CAPECO oficial: decirlo siempre; el usuario los corrige y los guarda en Mis partidas.
- Todos los valores de tablas son referenciales y editables en **Tablas**.

## Excel
- Hoja **Manual**: columnas `Partida, Unidad, Metrado, Cantidad, Rendimiento (und/día), Capataz, Operario,
  Oficial, Peón, Especialidad, Subtítulo`. Especialidad = OE.2…OE.5 / OE.X (vacía o desconocida → Otras).
  Si el nombre coincide con el catálogo, al importar trae sus materiales.
- Al exportar, el Metrado de una partida libre es el **total** (se pierden las filas del detalle; sí viajan en el
  respaldo .json). Las barras "por apoyos" se guardan como longitud total.

## Verificar (obligatorio después de cada cambio)
1. `npm test` en verde.
2. Arranca `node servidor.mjs 8091` (sin cerrar el 8080 del usuario) y prueba en el navegador. Si el panel del
   navegador no saca capturas, se puede usar Chrome headless por CDP con Node 24 (WebSocket nativo), sin
   instalar dependencias.
3. Revisa a **390×800** (celular) y **1366×768** (PC), en tema oscuro y claro:
   - Partidas: subtemas con código, "Contraer todo" / "Desplegar todo", especialidad vacía con sus subtemas.
   - Agregar: catálogo con buscador, catálogo de un solo subtema, editor completo (Guardar visible, Esc cierra).
   - Partida libre: Detalle por filas (parciales y total en vivo), accesorios al pedido, Guardar en Mis partidas.
   - Nuevo proyecto (formulario de datos), Proyectos › Datos.
   - Acero de una viga, Resumen, Planilla (OE.x → OE.x.y), Informe → Descargar PDF, Proyectos → Excel.
   - Sin errores en la consola y sin desplazamiento horizontal.
4. Dile al usuario cómo verlo: recargar (o **Actualizar** en el aviso) y comprobar la versión al pie de Proyectos.

## Historial de versiones
- **v10**: editor adaptable (pantalla completa / ventana / al costado), actualizaciones automáticas.
- **v11**: especialidades OE.4 Sanitarias y OE.5 Eléctricas; partidas libres por especialidad; catálogo con
  buscador; Mis partidas; datos del proyecto al crearlo (salen en informe/PDF); rejillas a todo el ancho;
  nombres largos sin cortarse; iconos de especialidad; Excel con Especialidad y Subtítulo.
- **v12**: detalle de metrado por filas (N° veces × largo × ancho × alto, descuentos); accesorios que van al
  pedido (agua, desagüe, eléctricos); subtemas con código de la norma en Partidas, catálogo, editor y Planilla.

## Ideas pendientes (solo si el usuario las pide)
- Suscripción: reemplazar `storage.js` por un backend con inicio de sesión y pagos, y empaquetar con Capacitor
  para Play Store.
- Exportar a Excel también las filas del detalle (hoy solo el total).
- Detalle por filas también para elementos con figura (hoy solo partidas libres).
