/**
 * UTILIDADES: base de datos, fechas, montos, validaciones y tablas en memoria
 * --------------------------------------------------------------------------
 * Toda la lógica trabaja con TABLAS EN MEMORIA. Se lee la hoja una sola vez
 * (getValues), se procesa en arrays y se escribe en bloque (setValues). Nunca se
 * lee ni escribe celda por celda dentro de un bucle.
 */

// ============================================================================
// BASE DE DATOS
// ============================================================================

/**
 * Devuelve el libro de datos (DANDINET_DB o DANDINET_DB_PRUEBAS).
 * - Si el script es independiente (así es en este proyecto), usa la propiedad
 *   de script DB_ID (la fija instalar()).
 * - Si el script está pegado al libro, usa el libro activo.
 */
var _db = null;
function db() {
  if (_db) return _db;
  var id = PropertiesService.getScriptProperties().getProperty('DB_ID');
  _db = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActive();
  if (!_db) throw new Error('No se encontró el libro. Ejecute instalar("ID_DEL_LIBRO") primero.');
  return _db;
}

// ============================================================================
// FECHAS
// Internamente cada fecha es un NÚMERO DE DÍA (días desde 01/01/1970). Así las
// restas dan días exactos y no hay problemas de horas ni de zona horaria.
// La zona horaria del proyecto y del libro es America/Lima (en appsscript.json).
// ============================================================================

/** Convierte Date | 'aaaa-mm-dd' | 'dd/mm/aaaa' | número de día → número de día (o null). */
function aDia(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Math.floor(v);
  if (Object.prototype.toString.call(v) === '[object Date]') {
    if (isNaN(v.getTime())) return null;
    return Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()) / 864e5;
  }
  var s = String(v).trim(), m;
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) return Date.UTC(+m[1], +m[2] - 1, +m[3]) / 864e5;
  if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s))) return Date.UTC(+m[3], +m[2] - 1, +m[1]) / 864e5;
  return null;
}

/** Número de día → Date a medianoche local (para escribir en la hoja). */
function deDia(n) {
  if (n === null || n === undefined || n === '') return '';
  var d = new Date(n * 864e5);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Partes {a, m (1-12), d} de un número de día. */
function partesDia(n) {
  var d = new Date(n * 864e5);
  return { a: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
}

function diaDe(a, m, d) { return Date.UTC(a, m - 1, d) / 864e5; }

/** Hoy (America/Lima) como número de día. Las pruebas pueden fijar una fecha simulada. */
var _hoySimulado = null;
function hoyDia() { return _hoySimulado !== null ? _hoySimulado : aDia(new Date()); }

/** Primer día del mes de una fecha. */
function inicioMes(n) { var p = partesDia(n); return diaDe(p.a, p.m, 1); }

/** Suma meses a un primer día de mes. */
function sumarMeses(n, k) { var p = partesDia(n); return diaDe(p.a, p.m + k, 1); }

/** Vencimiento: día `dia` del mes del periodo, ajustado al último día si el mes es corto. */
function fechaVence(periodo, dia) {
  var p = partesDia(periodo);
  var ultimo = new Date(Date.UTC(p.a, p.m, 0)).getUTCDate();
  if (dia > ultimo) dia = ultimo;
  if (dia < 1) dia = 1;
  return diaDe(p.a, p.m, dia);
}

var MESES_CORTOS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SET', 'OCT', 'NOV', 'DIC'];

/** "AGO-2026" */
function txtPeriodo(n) { var p = partesDia(n); return MESES_CORTOS[p.m - 1] + '-' + p.a; }

/** "04/08/2026" */
function txtFecha(n) {
  if (n === null || n === undefined) return '';
  var p = partesDia(n);
  return ('0' + p.d).slice(-2) + '/' + ('0' + p.m).slice(-2) + '/' + p.a;
}

/** "2026-08" (para la clave única de cargos) */
function aaaamm(n) { var p = partesDia(n); return p.a + '-' + ('0' + p.m).slice(-2); }

// ============================================================================
// MONTOS
// ============================================================================

/** Convierte a número (vacío o texto inválido → 0). */
function num(v) {
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  if (v === null || v === undefined || v === '') return 0;
  var x = parseFloat(String(v).replace(',', '.'));
  return isNaN(x) ? 0 : x;
}

/** Redondeo a 2 decimales sin errores de coma flotante (2.675 → 2.68). */
function r2(x) { return Math.round((num(x) + Number.EPSILON) * 100) / 100; }

/** "S/ 1,234.50" */
function soles(x) {
  var s = r2(x).toFixed(2).split('.');
  return 'S/ ' + s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + s[1];
}

// ============================================================================
// VALIDACIONES (las mismas reglas del Excel v2)
// ============================================================================

function soloDigitos(s) { return /^\d+$/.test(String(s)); }

/** DNI: 8 dígitos. RUC: 11 dígitos que empiezan con 10, 15, 17 o 20. */
function docValido(s) {
  s = String(s || '').trim();
  if (s.length === 8 && soloDigitos(s)) return true;
  return s.length === 11 && soloDigitos(s) && ['10', '15', '17', '20'].indexOf(s.substr(0, 2)) >= 0;
}

/** Celular peruano: 9 dígitos que empiezan con 9. */
function telefonoValido(s) {
  s = String(s || '').trim();
  return s.length === 9 && soloDigitos(s) && s.charAt(0) === '9';
}

// ============================================================================
// TABLAS EN MEMORIA
// Una "tabla" es: { nombre, enc: [encabezados], datos: [[fila], ...], c: {COLUMNA: índice} }
// ============================================================================

/** Crea una tabla en memoria a partir del esquema y un array de filas. */
function tablaMem(nombre, datos) {
  var enc = ESQUEMA[nombre].cols.slice();
  return { nombre: nombre, enc: enc, datos: datos || [], c: indiceCols(enc) };
}

function indiceCols(enc) {
  var c = {};
  enc.forEach(function (e, i) { c[String(e)] = i; });
  return c;
}

/** Lee una pestaña completa en una tabla en memoria (una sola llamada a la hoja). */
function leerTabla(nombre) {
  var h = db().getSheetByName(nombre);
  if (!h) throw new Error('Falta la pestaña "' + nombre + '". Ejecute crearEstructura().');
  var nf = h.getLastRow(), nc = h.getLastColumn();
  var enc = nc > 0 ? h.getRange(1, 1, 1, nc).getValues()[0].map(String) : [];
  var datos = nf > 1 ? h.getRange(2, 1, nf - 1, nc).getValues() : [];
  // descarta filas totalmente vacías al final
  while (datos.length && datos[datos.length - 1].every(function (x) { return x === ''; })) datos.pop();
  ESQUEMA[nombre].cols.forEach(function (col) {
    if (enc.indexOf(col) < 0) throw new Error('A la pestaña "' + nombre + '" le falta la columna ' + col + '.');
  });
  return { nombre: nombre, enc: enc, datos: datos, c: indiceCols(enc), hoja: h };
}

/** Lee varias tablas: { Clientes: tabla, Cargos: tabla, ... } */
function leerTablas(nombres) {
  var T = {};
  nombres.forEach(function (n) { T[n] = leerTabla(n); });
  return T;
}

/**
 * Escribe en la hoja las columnas indicadas de una tabla (en bloque).
 * Agrupa columnas contiguas para hacer el mínimo de llamadas.
 */
function escribirColumnas(t, columnas) {
  if (!t.datos.length) return;
  var idx = columnas.map(function (c) { return t.c[c]; }).sort(function (a, b) { return a - b; });
  var i = 0;
  while (i < idx.length) {
    var j = i;
    while (j + 1 < idx.length && idx[j + 1] === idx[j] + 1) j++;
    var desde = idx[i], ancho = idx[j] - idx[i] + 1;
    var bloque = t.datos.map(function (f) { return f.slice(desde, desde + ancho); });
    t.hoja.getRange(2, desde + 1, bloque.length, ancho).setValues(bloque);
    i = j + 1;
  }
}

/** Reemplaza TODO el cuerpo de una tabla (lo usa ResumenCliente, que es 100 % calculada). */
function reemplazarCuerpo(t) {
  var h = t.hoja, viejas = Math.max(h.getLastRow() - 1, 0);
  if (t.datos.length) h.getRange(2, 1, t.datos.length, t.enc.length).setValues(t.datos);
  if (viejas > t.datos.length) h.getRange(t.datos.length + 2, 1, viejas - t.datos.length, t.enc.length).clearContent();
}

/** Agrega filas al final de una pestaña en una sola llamada. */
function agregarFilas(nombre, filas) {
  if (!filas.length) return;
  var h = db().getSheetByName(nombre), desde = h.getLastRow() + 1, ultima = desde + filas.length - 1;
  if (h.getMaxRows() < ultima) h.insertRowsAfter(h.getMaxRows(), ultima - h.getMaxRows());
  h.getRange(desde, 1, filas.length, filas[0].length).setValues(filas);
}

/** Mapa valor-de-columna → índice de fila. */
function mapaPor(t, col) {
  var m = {}, k = t.c[col];
  t.datos.forEach(function (f, i) { m[String(f[k])] = i; });
  return m;
}
