# Metrado CAPECO — guía para Claude

App PWA (celular y PC) para **metrados de estructuras y muros** en obras de Perú: cantidad de materiales
según las tablas de **CAPECO**, acero con criterios de la **E.060 / E.070** y **rendimiento** de mano de obra
por partida. El dueño es ingeniero/residente de obra, no programador.

## Cómo trabajar con el usuario
- **Responde siempre en español** (Perú), claro y sin jerga de programación. Explica qué cambió en la app,
  no en el código.
- **Unidades métricas** (m, m², m³, kg, cm para recubrimientos). Vocabulario de obra: partida, metrado,
  varilla de 9 m, estribo, bastón, acero corrido, peraltada / chata / de borde, f'c, bolsas.
- Haz una sola pregunta concreta si algo es ambiguo; si hay un valor por defecto razonable, úsalo y dilo.
- **Después de cada cambio, prueba la app de verdad**: arranca el servidor, ábrela e interactúa con ella
  (ver "Verificar"). El usuario pide expresamente que lo pruebes tú mismo, en celular (390 px) y PC
  (1366×768).
- Termina diciendo qué cambió, qué probaste y si debe recargar (Ctrl+F5) o tocar **Actualizar**.

## Dónde corre
- Carpeta local en Windows: `D:\CLAUDE\metrado-app`. Se abre con **`iniciar-servidor.bat`**
  (`node servidor.mjs`, puerto **8080**; HTTPS opcional en 8443 si hay `certificados\cert.pem/key.pem`).
- PC: `http://localhost:8080/`. Celular por WiFi: `http://IP-DE-LA-PC:8080/` (el servidor la muestra).
- **Por ahora es solo local**: no publicar en la nube ni en GitHub Pages salvo que el usuario lo pida.
- El código también está en GitHub (`antonyhuamani732-netizen/dandinet-control`, carpeta `metrado-app/`,
  rama `ccr-36c378d1-nge02i`, PR #1 sin fusionar). Esta carpeta local se instaló desde el zip de esa rama,
  así que **puede no ser un repositorio git**. Si el usuario quiere subir cambios, pregúntale antes.
- Hay respaldos de versiones anteriores en `D:\CLAUDE\metrado-app-respaldo-*`. No los edites; se pueden
  borrar si el usuario lo pide.

## Comandos
```bash
npm test            # node --test tests/calc.test.mjs  (34 pruebas; deben pasar todas)
npm run local       # servidor local en el puerto 8080 (igual que iniciar-servidor.bat)
node servidor.mjs 8091   # otro puerto para probar sin cerrar el del usuario
```
No hay paso de compilación: JavaScript puro con módulos ES. No agregues frameworks ni dependencias de npm.

## Estructura
| Ruta | Qué hay |
|---|---|
| `index.html`, `styles.css`, `app.js` | Interfaz completa (vistas Partidas, Planilla, Resumen, Obra, Tablas, Proyectos; editor de elementos) |
| `data/capeco.js` | Tablas por defecto (concreto por f'c, encofrado, acero, ladrillos, mortero, rendimientos, costos) |
| `data/elementos.js` | Especialidades, tipos de elemento, medidas, partidas, armado típico, recubrimiento por tipo |
| `calc/` | Motor de cálculo **puro** (sin DOM), probado en `tests/`: concreto, encofrado, acero, corte de varillas, muros, rendimiento, norma E.060, obra |
| `calc/util.js` | `num()` / `evaluar()`: los campos aceptan fórmulas (`25.283/2`) |
| `ui/` | Figuras SVG, estribos, guía, planilla, informe, PDF propio, calculadora, iconos, Excel |
| `storage.js` | Guardado en `localStorage` (`metrado-capeco.v2`, migra v1). Único archivo a cambiar para cuentas en la nube |
| `vendor/xlsx.mini.min.js` | SheetJS 0.18.5 (no lo edites) |
| `sw.js` | Service worker (modo sin internet) |
| `servidor.mjs`, `iniciar-servidor.bat` | Servidor local para la red WiFi |

## Reglas que no se deben romper
- **Al cambiar cualquier archivo de la app**, sube `VERSION` en `sw.js` (`metrado-v10` → `v11`…) **y**
  `VERSION_APP` en `app.js` (se muestra al pie de Proyectos). Si un archivo nuevo debe funcionar sin
  internet, agrégalo a `ARCHIVOS` en `sw.js`.
- El service worker es **primero red, luego caché** para los archivos de la app; no lo vuelvas cache-first
  (por eso antes no llegaban las actualizaciones).
- `styles.css` tiene `[hidden] { display: none !important; }`. No lo quites: las secciones plegables usan
  el atributo `hidden` y sus clases tienen `display: flex`.
- Temas: oscuro por defecto (`:root`), claro con `:root[data-theme="light"]`. Usa siempre las variables
  (`--bg`, `--superficie`, `--tinta`, `--tenue`, `--acento`…), nunca colores fijos. El PDF/impresión sale
  siempre en claro.
- Editor: en el celular ocupa toda la pantalla; en tablet/PC es una ventana grande; en PC el usuario puede
  ponerlo al costado (`localStorage` `metrado-editor`). Revisa ambos al tocar el editor.
- Cálculo: la lógica va en `calc/` con prueba en `tests/calc.test.mjs`; la interfaz solo muestra.
- Longitudes internas en **metros**; el recubrimiento se guarda en **cm** por partida de acero (`recCm`).
- Todo `localStorage` va dentro de `try/catch`.
- **Privacidad**: el repositorio en GitHub es público. Nunca subas datos de obras o clientes (nombres,
  direcciones, metrados reales, Excel del usuario) ni certificados. Esos archivos quedan solo en la PC.

## Criterios técnicos ya acordados con el usuario
- Varillas de **9 m**. Varillas "por peso" = REDONDEAR.MAS(kg ÷ (kg/m × 9) × 1.10), como en su Excel, y se
  muestran junto al corte optimizado (primero la pieza más larga; las de más de 9 m se parten con traslape).
- `escalaCAD`: medida leída en AutoCAD ÷ factor (en sus planos dividía entre 2).
- En su Excel, el VB de 8 mm es un amarre alrededor del acero longitudinal: **mantenerlo como está**,
  con su peso.
- Recubrimientos E.060 sugeridos: 7.5 cm contra el suelo, 4 cm en vigas y columnas, 2 cm en losas,
  placas y escaleras. Uno por partida.
- Anclajes por apoyo (columna, zapata, viga peraltada, viga chata con gancho recortado a su peralte,
  continúa, traslape, volado, manual) y zonas: corrido, bastón izquierdo/derecho/ambos, central.
- Todos los valores de tablas son referenciales y editables en **Tablas**.

## Verificar (obligatorio después de cada cambio)
1. `npm test` en verde.
2. Arranca `node servidor.mjs 8091` y prueba con Playwright si está disponible
   (`npx playwright` o `require('playwright')`); si no, pídele al usuario que abra `http://localhost:8080/`
   y dile exactamente qué tocar.
3. Revisa a **390×800** (celular) y **1366×768** (PC), en tema oscuro y claro:
   - Partidas: "Contraer todo" / "Desplegar todo" y las cabeceras plegables.
   - Abrir y agregar un elemento: el editor se ve completo, Guardar visible, Esc cierra.
   - Acero de una viga, Resumen, Planilla, Informe → Descargar PDF, Proyectos → Excel.
   - Sin errores en la consola y sin desplazamiento horizontal.
4. Dile al usuario cómo verlo: recargar (o **Actualizar** en el aviso) y comprobar la versión al pie de
   **Proyectos**.

## Ideas pendientes (solo si el usuario las pide)
- Suscripción: reemplazar `storage.js` por un backend con inicio de sesión y pagos, y empaquetar con
  Capacitor para Play Store.
- Al exportar a Excel, las barras "por apoyos" se guardan como longitud total (se pierde el detalle de
  apoyos al reimportar).
