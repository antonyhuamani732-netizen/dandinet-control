/**
 * PRUEBA LOCAL DE LA FASE 1 (sin Google)
 * --------------------------------------------------------------------------
 * Ejecuta TODO el código de backend/*.gs sobre el simulador de Google Sheets y
 * repite lo que harás en Google:
 *   - instalarPruebas()    → crea el libro, importa migracion.json y verifica el cuadre.
 *   - instalarProduccion() → crea solo la estructura (en un "Drive" aparte).
 * Además comprueba las tablas nuevas de la Opción B y el sello ULT_MODIF.
 *
 * Uso:  node pruebas-local/fase1.js
 */
process.env.TZ = 'America/Lima';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { crearGoogle } = require('./google-mock');

const raiz = path.join(__dirname, '..');
const build = process.argv[2] || path.join(raiz, '..', 'MACROS EXCEL', 'CONTROL 2026 v2 - fuentes', 'build');
const ADMIN = 'dandinetcontrolclientes@gmail.com';

let fallos = 0;
const check = (ok, txt) => { if (!ok) fallos++; console.log((ok ? '  OK    ' : '  FALLO ') + txt); };

/** Crea un "proyecto de Apps Script" simulado con todo el código del backend. */
function proyecto() {
  const google = crearGoogle({ usuario: ADMIN });
  const ctx = vm.createContext(Object.assign({ console, Date, Math, JSON, Object, Array, String, Number, parseInt,
    parseFloat, isNaN, encodeURIComponent, Error }, google.G));
  for (const f of fs.readdirSync(path.join(raiz, 'backend')).filter((x) => x.endsWith('.gs')).sort()) {
    vm.runInContext(fs.readFileSync(path.join(raiz, 'backend', f), 'utf8'), ctx, { filename: f });
  }
  const G = (expr) => vm.runInContext(expr, ctx);
  const filas = (n) => { const t = G(`leerTabla('${n}')`); return t.datos.map((f) => Object.fromEntries(t.enc.map((c, j) => [c, f[j]]))); };
  const encabezados = (n) => G(`leerTabla('${n}')`).enc;
  return { google, ctx, G, filas, encabezados };
}

// ===========================================================================
console.log('\n== PRUEBAS: instalarPruebas()');
const P = proyecto();
P.google.subirArchivo('migracion.json', fs.readFileSync(path.join(build, 'migracion.json'), 'utf8'));
P.google.subirArchivo('esperado.json', fs.readFileSync(path.join(build, 'esperado.json'), 'utf8'));
const msg1 = P.ctx.instalarPruebas();
console.log('  ' + msg1.split('\n').join('\n  '));
check(/Cuadre contra el Excel: CUADRA/.test(msg1), 'el cuadre en el libro de PRUEBAS dice CUADRA');
check(P.G('entorno()') === 'PRUEBAS', 'el proyecto queda marcado como PRUEBAS');
const libroP = P.google.libros[P.G(`PropertiesService.getScriptProperties().getProperty('DB_ID')`)];
check(libroP && libroP.getName() === 'DANDINET_DB_PRUEBAS', 'el libro se llama DANDINET_DB_PRUEBAS');

const pestañas = libroP.getSheets().map((h) => h.getName());
check(['Solicitudes', 'PagosRevisar', 'Bitacora', 'Panel', 'Cuadre', 'AvisosMigracion'].every((n) => pestañas.includes(n)),
  'existen las pestañas nuevas: Solicitudes, PagosRevisar, Panel, Cuadre y AvisosMigracion');
check(!pestañas.includes('ColaCobros') && !pestañas.includes('ColaAcciones'), 'ya no existen las colas de AppSheet');
check(['ULT_MODIF'].every((c) => ['Clientes', 'Servicios', 'Cargos', 'PPPoE', 'ResumenCliente'].every((t) => P.encabezados(t).includes(c))),
  'ULT_MODIF existe en Clientes, Servicios, Cargos, PPPoE y ResumenCliente');
check(P.encabezados('Pagos').includes('F_DISPOSITIVO') && P.encabezados('Pagos').includes('URL_VOUCHER'), 'Pagos tiene F_DISPOSITIVO y URL_VOUCHER');

const us = P.filas('Usuarios');
check(us.length === 1 && us[0].EMAIL === ADMIN && us[0].ROL === 'ADMIN' && us[0].ZONAS === '*' && us[0].ACTIVO === 'Sí',
  'Usuarios: la cuenta del sistema queda como ADMIN, todas las zonas, activa');
check(P.G(`usuarioDe(abrirContexto(), '${ADMIN.toUpperCase()}').activo`) === true, 'el usuario se reconoce sin importar mayúsculas');
check(P.G(`(function(){ var c = abrirContexto(); setV(c,'Usuarios',0,'ACTIVO',''); return usuarioDe(c,'${ADMIN}').activo; })()`) === false,
  'ACTIVO vacío = inactivo (solo "Sí" da acceso)');
check(String(P.filas('Config').find((r) => r.CLAVE === 'ClientId_OAuth').VALOR).startsWith('223370778430-'), 'Config tiene el Client ID de Google');
check(String(P.filas('Config').find((r) => r.CLAVE === 'UltRecibo').VALOR) === '115', 'UltRecibo = 115 (el siguiente será R-000116)');

// ---- reinstalar no duplica -------------------------------------------------------
const nCargos = P.filas('Cargos').length;
const msg2 = P.ctx.instalarPruebas();
check(/ya se importaron/.test(msg2) && P.filas('Cargos').length === nCargos, 'ejecutar instalarPruebas() otra vez no duplica nada');
let bloqueado = false;
try { P.ctx.instalarProduccion(); } catch (e) { bloqueado = /ya está instalado como PRUEBAS/.test(e.message); }
check(bloqueado, 'un proyecto de PRUEBAS no se puede instalar como PRODUCCIÓN');

// ---- un cobro desde el editor: sello ULT_MODIF y columnas nuevas -------------------
P.G(`_hoySimulado = aDia('2026-10-16')`);
const cargo = P.filas('Cargos').filter((c) => c.ANULADO !== 'Sí' && c.SALDO > 0 && c.ESTADO === 'Vencido')[0];
const antes = new Date(Date.now() - 1000);
const r = P.ctx.registrarPago(cargo.ID_CLIENTE, [cargo.ID_CARGO], cargo.SALDO, 'Efectivo', '', '2026-10-16', ADMIN, 'prueba fase 1');
check(r.nro === 'R-000116', 'un cobro de prueba recibe el N° R-000116');
const pago = P.filas('Pagos').find((p) => p.N_RECIBO === 'R-000116');
check(pago && pago.ORIGEN === 'editor' && pago.USUARIO === ADMIN, 'el recibo guarda el origen y el usuario');
const cargoDesp = P.filas('Cargos').find((c) => c.ID_CARGO === cargo.ID_CARGO);
check(cargoDesp.ESTADO === 'Pagado' && cargoDesp.ULT_MODIF instanceof Date && cargoDesp.ULT_MODIF >= antes,
  'el cargo pagado queda Pagado y con ULT_MODIF actualizado');
const resu = P.filas('ResumenCliente').find((x) => x.ID_CLIENTE === cargo.ID_CLIENTE);
check(resu.ULT_MODIF instanceof Date && resu.ULT_MODIF >= antes, 'el resumen del cliente también se sella con ULT_MODIF');
const otro = P.filas('Cargos').find((c) => c.ID_CLIENTE !== cargo.ID_CLIENTE);
check(!(otro.ULT_MODIF instanceof Date && otro.ULT_MODIF >= antes), 'los cargos de otros clientes NO se tocan');

// ---- reiniciar pruebas ------------------------------------------------------------
const msg3 = P.ctx.reiniciarPruebas();
check(/CUADRA/.test(msg3) && !P.filas('Pagos').some((p) => p.N_RECIBO === 'R-000116'), 'reiniciarPruebas() vuelve a los datos migrados y sigue cuadrando');

// ===========================================================================
console.log('\n== PRODUCCIÓN: instalarProduccion() (otro proyecto, otro "Drive")');
const Q = proyecto();
const msg4 = Q.ctx.instalarProduccion();
console.log('  ' + msg4.split('\n').join('\n  '));
const libroQ = Q.google.libros[Q.G(`PropertiesService.getScriptProperties().getProperty('DB_ID')`)];
check(libroQ && libroQ.getName() === 'DANDINET_DB' && Q.G('entorno()') === 'PRODUCCION', 'se crea DANDINET_DB y el proyecto queda como PRODUCCION');
check(Q.G('ORDEN_TABLAS').every((t) => libroQ.getSheetByName(t)), 'tiene todas las pestañas');
check(Q.G('ORDEN_TABLAS').every((t) => libroQ.getSheetByName(t).getLastRow() === 1), 'todas vacías (solo encabezados): no hay datos de ensayo en PRODUCCIÓN');
let bloq2 = false;
try { Q.ctx.reiniciarPruebas(); } catch (e) { bloq2 = /solo funciona en el proyecto de PRUEBAS/.test(e.message); }
check(bloq2, 'reiniciarPruebas() está bloqueado en PRODUCCIÓN');

console.log(`\n${fallos === 0 ? 'TODO OK' : fallos + ' FALLO(S)'}`);
process.exit(fallos ? 1 : 0);
