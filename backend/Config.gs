/**
 * CONFIGURACIÓN Y CONSTANTES
 * --------------------------------------------------------------------------
 * Todo lo que el dueño puede cambiar vive en la pestaña "Config" (CLAVE | VALOR).
 * CONFIG_DEFECTO solo se usa la primera vez para llenarla. Después manda la hoja.
 *
 * DATOS PRIVADOS (el repositorio de GitHub es público): el Yape, las cuentas bancarias y el
 * titular NO están en el código. Se guardan en las Propiedades del script de cada proyecto,
 * en la propiedad CONFIG_LOCAL (JSON), con guardarConfigLocal(). Al instalar o migrar se
 * copian a la pestaña Config. Orden de prioridad: pestaña Config > CONFIG_LOCAL > CONFIG_DEFECTO.
 */

// ---- Estados (mismos textos que el Excel v2) ----------------------------------
var E_ACTIVO = 'Activo', E_MOROSO = 'Moroso', E_SUSPENDIDO = 'Suspendido', E_CORTADO = 'Cortado', E_BAJA = 'Baja';
var P_DISPONIBLE = 'Disponible', P_ASIGNADO = 'Asignado', P_BLOQUEADO = 'Bloqueado';
var C_PAGADO = 'Pagado', C_PARCIAL = 'Parcial', C_VENCIDO = 'Vencido', C_PORVENCER = 'Por vencer',
    C_PENDIENTE = 'Pendiente', C_ANULADO = 'Anulado', C_SINPRECIO = 'Sin precio';
var SI = 'Sí', NO = 'No';
var METODOS_PAGO = ['Efectivo', 'Yape', 'Plin', 'Transferencia', 'Depósito'];
var METODO_MIGRADO = 'MIGRADO';

/** [CLAVE, VALOR inicial, DESCRIPCIÓN] */
var CONFIG_DEFECTO = [
  ['Negocio', 'D@NDINET', 'Nombre del negocio'],
  ['RUC', '104849128', 'RUC del negocio (11 dígitos). El actual tiene 9 dígitos: el dueño debe dar el correcto'],
  ['Direccion', '', 'Dirección comercial'],
  ['Telefono', '924802014', 'Teléfono del negocio'],
  ['Email', 'dandinetinfor@gmail.com', 'Correo del negocio'],
  ['Yape', '', 'N° Yape/Plin para cobros (privado: CONFIG_LOCAL)'],
  ['TitularCobro', '', 'Titular de las cuentas de cobro (privado: CONFIG_LOCAL)'],
  ['BCP', '', 'Cuenta BCP (privado: CONFIG_LOCAL)'],
  ['BN', '', 'Cuenta Banco de la Nación (privado: CONFIG_LOCAL)'],
  ['DiaVenc', '4', 'Día de vencimiento por defecto (1-28). Del día 1 a este día el mes está "Por vencer"'],
  ['DiasCorte', '30', 'Días de atraso para la alerta "A CORTAR"'],
  ['PrefijoRecibo', 'R-', 'Prefijo del N° de recibo'],
  ['UltRecibo', '115', 'Último N° de recibo emitido. NO EDITAR: lo maneja el sistema'],
  ['MensajeRecibo', 'Gracias por confiar en D@NDINET. Conserve este recibo como constancia de su pago.', 'Mensaje al pie del recibo'],
  ['MsgCobranza', 'Hola {NOMBRE}, le saluda {NEGOCIO}.\\nRECORDATORIO DE PAGO: tiene {MESES} mes(es) pendiente(s): {PERIODOS}.\\nTotal a pagar: {DEUDA}. Último día de pago: el {DIA} de cada mes.\\n\\nYAPE/PLIN: {YAPE} ({TITULAR})\\nBCP: {BCP}\\nB. NACIÓN: {BN}\\nEnvíe su constancia al {YAPE}. ¡Gracias!',
    'Plantilla WhatsApp de cobranza ({NOMBRE} {MESES} {PERIODOS} {DEUDA} {DIA} {YAPE} {TITULAR} {BCP} {BN} {NEGOCIO}; \\n = salto de línea)'],
  ['MsgCorte', 'Estimado(a) {NOMBRE}: le informamos que su servicio de internet ha sido CORTADO por falta de pago.\\nDeuda pendiente: {DEUDA} ({PERIODOS}).\\nPara reactivarlo pague por YAPE/PLIN {YAPE} ({TITULAR}) y envíe su constancia.\\n{NEGOCIO}',
    'Plantilla WhatsApp de aviso de corte'],
  ['CarpetaDriveComprobantes', '', 'ID de la carpeta de Drive para los PDF (se crea sola si está vacío)'],
  ['CarpetaDriveHistorico', '', 'ID de la carpeta de Drive del histórico (se crea sola si está vacío)'],
  ['CarpetaDriveRespaldos', '', 'ID de la carpeta de Drive de respaldos (se crea sola si está vacío)'],
  ['CarpetaDriveVouchers', '', 'ID de la carpeta de Drive para las fotos de vouchers (se crea sola si está vacío)'],
  ['IdPlantillaRecibo', '', 'ID del Google Docs que sirve de plantilla del recibo (Fase 6)'],
  ['RespaldosConservar', '15', 'Cuántos respaldos diarios se conservan'],
  // ---- App (PWA) -------------------------------------------------------------------
  ['ClientId_OAuth', '223370778430-gbs0o6ge9noqlpiig72bv9ak3n9iialc.apps.googleusercontent.com',
    'Client ID de Google (inicio de sesión). El servidor rechaza tokens emitidos para otro Client ID'],
  ['VersionMinimaApp', '1.0.0', 'Versión mínima de la app. Una app más antigua recibe el aviso "Actualizar"'],
  ['DiasMaxSinSync', '7', 'Días máximos que la app puede trabajar sin sincronizar antes de exigir conexión'],
  ['VoucherObligatorio', 'No', 'Sí = la foto del voucher es obligatoria para Yape, Plin, Transferencia y Depósito (decisión D6)'],
  ['ProrratearAlta', 'Sí', 'Sí = en el mes del alta se cobran solo los días restantes (desde el día de instalación)'],
  ['DiasGraciaAlta', '0', 'Días de plazo para pagar el primer mes prorrateado y la instalación (0 = se pagan el día del alta)'],
  ['FechaCalculo', '', 'Fecha y hora del último recálculo (automático)'],
  ['UltimoRespaldo', '', 'Último respaldo (automático)'],
  ['UltimoArchivo', '', 'Último año archivado (automático)']
];

/** Valores privados de este proyecto (Propiedades del script → CONFIG_LOCAL). {} si no hay. */
function configLocal_() {
  try {
    var t = PropertiesService.getScriptProperties().getProperty('CONFIG_LOCAL');
    return t ? JSON.parse(t) : {};
  } catch (e) { return {}; }
}

/** CONFIG_DEFECTO con los valores privados ya puestos: [[CLAVE, VALOR, DESCRIPCIÓN], ...]. */
function configInicial_() {
  var loc = configLocal_();
  return CONFIG_DEFECTO.map(function (r) { return [r[0], loc[r[0]] !== undefined ? String(loc[r[0]]) : r[1], r[2]]; });
}

/**
 * ▶ Guarda los datos privados en este proyecto. Ejemplo (desde la terminal):
 *   npm run correr:pruebas -- guardarConfigLocal -p '[{"Yape":"9xxxxxxxx","TitularCobro":"...","BCP":"...","BN":"..."}]'
 * Si el libro ya tiene la pestaña Config con datos, también los actualiza ahí.
 */
function guardarConfigLocal(valores) {
  var loc = configLocal_();
  Object.keys(valores || {}).forEach(function (k) { loc[k] = String(valores[k]); });
  PropertiesService.getScriptProperties().setProperty('CONFIG_LOCAL', JSON.stringify(loc));
  var h = null;
  try { h = db().getSheetByName('Config'); } catch (e) { h = null; }
  if (h && h.getLastRow() > 1) Object.keys(valores || {}).forEach(function (k) { setCfg(k, String(valores[k])); });
  _cfgCache = null;
  return 'Guardadas ' + Object.keys(loc).length + ' claves privadas: ' + Object.keys(loc).join(', ');
}

// ---- Lectura con caché (una lectura de la hoja por ejecución) -----------------
var _cfgCache = null;

/** Devuelve el valor de una clave de Config (texto). Si no existe, usa el valor por defecto. */
function cfg(clave) {
  if (_cfgCache === null) {
    _cfgCache = {};
    configInicial_().forEach(function (r) { _cfgCache[r[0]] = r[1]; });
    if (typeof SpreadsheetApp !== 'undefined') {
      var h = db().getSheetByName('Config');
      if (h && h.getLastRow() > 1) {
        h.getRange(2, 1, h.getLastRow() - 1, 2).getValues().forEach(function (r) {
          if (r[0] !== '') _cfgCache[String(r[0])] = r[1];
        });
      }
    }
  }
  var v = _cfgCache[clave];
  return v === undefined || v === null ? '' : v;
}

/** Escribe una clave en Config (la crea si no existe). */
function setCfg(clave, valor) {
  var h = db().getSheetByName('Config');
  var n = h.getLastRow();
  var claves = n > 1 ? h.getRange(2, 1, n - 1, 1).getValues() : [];
  for (var i = 0; i < claves.length; i++) {
    if (String(claves[i][0]) === clave) { h.getRange(i + 2, 2).setValue(valor); if (_cfgCache) _cfgCache[clave] = valor; return; }
  }
  h.appendRow([clave, valor, '']);
  if (_cfgCache) _cfgCache[clave] = valor;
}

/** Permite a las pruebas fijar la configuración sin hoja. */
function _cfgFijar(obj) {
  _cfgCache = {};
  configInicial_().forEach(function (r) { _cfgCache[r[0]] = r[1]; });
  Object.keys(obj || {}).forEach(function (k) { _cfgCache[k] = obj[k]; });
}

function diaVencDefecto() {
  var d = parseInt(cfg('DiaVenc'), 10);
  return d >= 1 && d <= 28 ? d : 4;
}

function diasParaCorte() {
  var d = parseInt(cfg('DiasCorte'), 10);
  return d >= 1 ? d : 30;
}
