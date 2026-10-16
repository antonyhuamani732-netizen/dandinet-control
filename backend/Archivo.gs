/**
 * ARCHIVO HISTÓRICO, INTEGRIDAD, RESPALDOS Y TRIGGERS
 * --------------------------------------------------------------------------
 * archivarAnio(Y): mueve al libro CONTROL_ISP_HISTORICO_Y los cargos de periodos <= Y
 * SALDADOS (pagados o anulados) junto con sus pagos, SOLO cuando TODOS los cargos de esos
 * pagos también se archivan (punto fijo). Las deudas pendientes nunca se archivan, así
 * que el saldo arrastrado es exacto. Repetirlo no duplica. Debe terminar en "CUADRA".
 */

var TABLAS_ARCHIVO = ['Cargos', 'PagosDet', 'Pagos', 'Comprobantes'];

/** Calcula qué filas se archivarían (función pura sobre tablas en memoria). */
function seleccionArchivo(T, anio) {
  var tC = T.Cargos, tD = T.PagosDet, tP = T.Pagos, tK = T.Comprobantes;
  var car = {};
  tC.datos.forEach(function (f) {
    var per = aDia(f[tC.c.PERIODO]);
    if (per !== null && partesDia(per).a <= anio && num(f[tC.c.SALDO]) <= 0.004) car[String(f[tC.c.ID_CARGO])] = true;
  });
  // punto fijo: un pago se archiva solo si TODOS sus cargos se archivan,
  // y un cargo solo si TODOS sus pagos se archivan
  var cambio = true;
  while (cambio) {
    cambio = false;
    var malos = {};
    tD.datos.forEach(function (f) { if (!car[String(f[tD.c.ID_CARGO])]) malos[String(f[tD.c.N_RECIBO])] = true; });
    tD.datos.forEach(function (f) {
      var c = String(f[tD.c.ID_CARGO]);
      if (malos[String(f[tD.c.N_RECIBO])] && car[c]) { delete car[c]; cambio = true; }
    });
  }
  var pagOk = {};
  var sel = { Cargos: {}, PagosDet: {}, Pagos: {}, Comprobantes: {} };
  tC.datos.forEach(function (f, i) { if (car[String(f[tC.c.ID_CARGO])]) sel.Cargos[i] = true; });
  tD.datos.forEach(function (f, i) { if (car[String(f[tD.c.ID_CARGO])]) { sel.PagosDet[i] = true; pagOk[String(f[tD.c.N_RECIBO])] = true; } });
  tP.datos.forEach(function (f, i) { if (pagOk[String(f[tP.c.N_RECIBO])]) sel.Pagos[i] = true; });
  tK.datos.forEach(function (f, i) { if (pagOk[String(f[tK.c.N_RECIBO])]) sel.Comprobantes[i] = true; });
  return sel;
}

/** Archiva el año indicado (solo años cerrados). Devuelve el resumen con "CUADRA" o "REVISAR". */
function archivarAnio(anio, usuario) {
  anio = parseInt(anio, 10);
  if (!(anio < partesDia(hoyDia()).a)) throw errNeg('Solo se pueden archivar años cerrados (anteriores a ' + partesDia(hoyDia()).a + ').');
  usuario = usuario || usuarioActual();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw errNeg('El sistema está ocupado. Intente de nuevo.');
  try {
    var ctx0 = abrirContexto(); exigirRol(ctx0, usuario, ['ADMIN']);
    recalcularTodo();
    var T = leerTablas(TABLAS_ARCHIVO.concat(['Clientes', 'Servicios', 'PPPoE', 'ResumenCliente']));
    var sel = seleccionArchivo(T, anio);
    var nC = Object.keys(sel.Cargos).length;
    if (!nC) return 'No hay movimientos saldados del año ' + anio + ' (o anteriores) para archivar.';

    var saldoAntes = sumaCol_(T.Cargos, 'SALDO'), pagadoAntes = sumaPagado_(T.PagosDet);
    var deudaAntes = deudaPorCliente_(T);
    respaldo('antes_archivar_' + anio);

    // 1. copiar al libro histórico, sin duplicar (clave = primera columna)
    var hist = libroHistorico_(anio);
    TABLAS_ARCHIVO.forEach(function (n) {
      var t = T[n], filas = Object.keys(sel[n]).map(Number).sort(function (a, b) { return a - b; });
      if (!filas.length) return;
      var h = hist.getSheetByName(n);
      if (!h) {
        h = hist.insertSheet(n);
        h.getRange(1, 1, 1, t.enc.length).setValues([t.enc]).setFontWeight('bold');
        ESQUEMA[n].texto.forEach(function (c) { var j = t.enc.indexOf(c); if (j >= 0) h.getRange(2, j + 1, h.getMaxRows() - 1, 1).setNumberFormat('@'); });
      }
      var ya = {};
      if (h.getLastRow() > 1) h.getRange(2, 1, h.getLastRow() - 1, 1).getValues().forEach(function (r) { ya[String(r[0])] = true; });
      var nuevas = filas.map(function (i) { return t.datos[i]; }).filter(function (f) { return !ya[String(f[0])]; });
      if (nuevas.length) {
        var desde = h.getLastRow() + 1, ultima = desde + nuevas.length - 1;
        if (h.getMaxRows() < ultima) h.insertRowsAfter(h.getMaxRows(), ultima - h.getMaxRows());
        h.getRange(desde, 1, nuevas.length, t.enc.length).setValues(nuevas);
      }
    });
    ['Hoja 1', 'Sheet1', 'Hoja1'].forEach(function (n) { var x = hist.getSheetByName(n); if (x && x.getLastRow() === 0 && hist.getSheets().length > 1) hist.deleteSheet(x); });
    SpreadsheetApp.flush();

    // 2. quitar del libro principal (se reescribe el cuerpo sin las filas archivadas)
    TABLAS_ARCHIVO.forEach(function (n) {
      var t = T[n];
      if (!Object.keys(sel[n]).length) return;
      t.datos = t.datos.filter(function (f, i) { return !sel[n][i]; });
      reemplazarCuerpo(t);
    });
    SpreadsheetApp.flush();

    // 3. verificar: el saldo y la deuda por cliente deben ser idénticos
    recalcularTodo();
    var T2 = leerTablas(['Cargos', 'PagosDet', 'Clientes', 'Servicios', 'PPPoE', 'ResumenCliente']);
    var saldoDesp = sumaCol_(T2.Cargos, 'SALDO'), deudaDesp = deudaPorCliente_(T2);
    var difCli = Object.keys(deudaAntes).filter(function (k) { return Math.abs(deudaAntes[k] - (deudaDesp[k] || 0)) > 0.005; });
    var cuadra = Math.abs(saldoAntes - saldoDesp) < 0.01 && difCli.length === 0;
    setCfg('UltimoArchivo', String(anio));
    var txt = 'Año ' + anio + ' archivado en "' + hist.getName() + '". Cargos: ' + nC + ', pagos: ' + Object.keys(sel.Pagos).length +
      ', detalle: ' + Object.keys(sel.PagosDet).length + '. Saldo antes ' + soles(saldoAntes) + ', después ' + soles(saldoDesp) +
      '. Pagado archivado: ' + soles(pagadoAntes - sumaPagado_(T2.PagosDet)) + '. ' + (cuadra ? 'CUADRA' : '¡REVISAR! Clientes con diferencia: ' + difCli.join(', '));
    agregarFilas('Bitacora', [[ 'BIT-' + Utilities.getUuid().substr(0, 8).toUpperCase(), new Date(), usuario, 'ARCHIVAR_ANIO', 'Cargos', String(anio), txt ]]);
    return txt;
  } finally {
    lock.releaseLock();
  }
}

function sumaCol_(t, col) { var s = 0; t.datos.forEach(function (f) { s += num(f[t.c[col]]); }); return r2(s); }
function sumaPagado_(t) { var s = 0; t.datos.forEach(function (f) { if (String(f[t.c.ANULADO]) !== SI) s += num(f[t.c.MONTO_APLICADO]); }); return r2(s); }
function deudaPorCliente_(T) {
  var d = {}, t = T.Cargos;
  t.datos.forEach(function (f) { var k = String(f[t.c.ID_CLIENTE]); d[k] = r2((d[k] || 0) + num(f[t.c.SALDO])); });
  return d;
}

/** Libro histórico del año (lo crea la primera vez y guarda su ID en las propiedades del script). */
function libroHistorico_(anio) {
  var props = PropertiesService.getScriptProperties(), clave = 'HIST_' + anio, id = props.getProperty(clave);
  if (id) { try { return SpreadsheetApp.openById(id); } catch (e) { /* se borró: se crea otro */ } }
  var libro = SpreadsheetApp.create('DANDINET_HISTORICO_' + anio + (entorno() === 'PRUEBAS' ? '_PRUEBAS' : ''));
  props.setProperty(clave, libro.getId());
  var carpeta = carpeta_('CarpetaDriveHistorico', 'Historico');
  if (carpeta) DriveApp.getFileById(libro.getId()).moveTo(carpeta);
  return libro;
}

/** Carpeta de Drive configurada en Config (la crea junto al libro si no existe). */
function carpeta_(claveCfg, nombre) {
  if (typeof DriveApp === 'undefined' || !DriveApp.getFolderById) return null;
  var id = String(cfg(claveCfg) || '');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* inválida: se crea */ } }
  var padre = DriveApp.getFileById(db().getId()).getParents();
  var base = padre.hasNext() ? padre.next() : DriveApp.getRootFolder();
  var it = base.getFoldersByName(nombre), c = it.hasNext() ? it.next() : base.createFolder(nombre);
  setCfg(claveCfg, c.getId());
  return c;
}

// ============================================================================
// INTEGRIDAD (solo avisa, nunca corrige por su cuenta)
// ============================================================================

/** Revisa inconsistencias y las deja en la pestaña "Integridad". Devuelve la lista de problemas. */
function verificarIntegridad() {
  var T = leerTablas(['Servicios', 'PPPoE', 'Pagos', 'PagosDet', 'Cargos', 'Config']);
  var p = revisarIntegridad(T);
  if (typeof SpreadsheetApp !== 'undefined') {
    var libro = db(), h = libro.getSheetByName('Integridad') || libro.insertSheet('Integridad');
    h.clear();
    h.getRange(1, 1).setValue((p.length ? '⚠️ ' + p.length + ' problema(s)' : '✅ Sin problemas') + ' · ' +
      Utilities.formatDate(new Date(), 'America/Lima', 'dd/MM/yyyy HH:mm')).setFontWeight('bold');
    if (p.length) h.getRange(2, 1, p.length, 1).setValues(p.map(function (x) { return [x]; }));
  }
  return p;
}

/** Función pura: lista de problemas encontrados. */
function revisarIntegridad(T) {
  var p = [], tS = T.Servicios, tP = T.PPPoE, tPg = T.Pagos, tD = T.PagosDet, tC = T.Cargos;
  // PPPoE: un código en un solo servicio, coherente con el inventario
  var srvDe = {}, inv = {};
  tP.datos.forEach(function (f) { inv[String(f[tP.c.CODIGO])] = f; });
  tS.datos.forEach(function (f) {
    var c = String(f[tS.c.PPPOE]);
    if (!c) return;
    if (srvDe[c]) p.push('PPPoE ' + c + ' está en 2 servicios: ' + srvDe[c] + ' y ' + f[tS.c.ID_SERV]);
    srvDe[c] = String(f[tS.c.ID_SERV]);
    if (!inv[c]) p.push('PPPoE ' + c + ' del servicio ' + f[tS.c.ID_SERV] + ' no existe en el inventario');
    else if (String(inv[c][tP.c.ESTADO]) !== P_ASIGNADO) p.push('PPPoE ' + c + ' figura en ' + f[tS.c.ID_SERV] + ' pero el inventario dice ' + inv[c][tP.c.ESTADO]);
    var est = String(f[tS.c.ESTADO]);
    if (est !== E_ACTIVO && est !== E_SUSPENDIDO) p.push('PPPoE ' + c + ' sigue asignado a ' + f[tS.c.ID_SERV] + ' que está ' + est);
  });
  tP.datos.forEach(function (f) {
    var c = String(f[tP.c.CODIGO]);
    if (String(f[tP.c.ESTADO]) === P_ASIGNADO && srvDe[c] !== String(f[tP.c.ID_SERV])) p.push('PPPoE ' + c + ' Asignado a ' + f[tP.c.ID_SERV] + ' en el inventario, pero ese servicio no lo tiene');
  });
  // Pagos ↔ detalle
  var pago = {}, conDet = {}, cargo = {};
  tPg.datos.forEach(function (f) { pago[String(f[tPg.c.N_RECIBO])] = String(f[tPg.c.ESTADO]); });
  tC.datos.forEach(function (f) { cargo[String(f[tC.c.ID_CARGO])] = true; });
  tD.datos.forEach(function (f) {
    var n = String(f[tD.c.N_RECIBO]);
    conDet[n] = true;
    if (pago[n] === undefined) p.push('Detalle sin recibo: ' + f[tD.c.ID_DET]);
    else if ((pago[n] === 'Anulado') !== (String(f[tD.c.ANULADO]) === SI)) p.push('Recibo ' + n + ' y su detalle no coinciden en la anulación');
    if (!cargo[String(f[tD.c.ID_CARGO])]) p.push('Detalle ' + f[tD.c.ID_DET] + ' apunta a un cargo inexistente');
  });
  Object.keys(pago).forEach(function (n) { if (!conDet[n] && pago[n] !== 'Anulado') p.push('Recibo ' + n + ' sin detalle'); });
  // Correlativo
  var tCf = T.Config, ult = 0, pref = 'R-', mx = 0;
  tCf.datos.forEach(function (f) {
    if (String(f[tCf.c.CLAVE]) === 'UltRecibo') ult = parseInt(f[tCf.c.VALOR], 10) || 0;
    if (String(f[tCf.c.CLAVE]) === 'PrefijoRecibo') pref = String(f[tCf.c.VALOR] || 'R-');
  });
  Object.keys(pago).forEach(function (n) { if (n.indexOf(pref) === 0) mx = Math.max(mx, parseInt(n.substr(pref.length), 10) || 0); });
  if (mx > ult) p.push('Config.UltRecibo (' + ult + ') es menor que el mayor recibo emitido (' + mx + ')');
  // Claves de cargos únicas
  var cl = {};
  tC.datos.forEach(function (f) {
    var k = String(f[tC.c.CLAVE]);
    if (k && cl[k]) p.push('Cuota duplicada: ' + k + ' (' + cl[k] + ' y ' + f[tC.c.ID_CARGO] + ')');
    cl[k] = String(f[tC.c.ID_CARGO]);
  });
  return p;
}

// ============================================================================
// RESPALDOS Y TAREAS PROGRAMADAS
// ============================================================================

/** Copia el libro a Drive/Respaldos y conserva solo los últimos N (Config.RespaldosConservar). */
function respaldo(etiqueta) {
  var carpeta = carpeta_('CarpetaDriveRespaldos', 'Respaldos');
  var nombre = 'RESPALDO_' + db().getName() + '_' + Utilities.formatDate(new Date(), 'America/Lima', 'yyyy-MM-dd_HHmm') + (etiqueta ? '_' + etiqueta : '');
  DriveApp.getFileById(db().getId()).makeCopy(nombre, carpeta);
  var conservar = parseInt(cfg('RespaldosConservar'), 10) || 15, archivos = [], it = carpeta.getFiles();
  while (it.hasNext()) { var f = it.next(); if (f.getName().indexOf('RESPALDO_') === 0) archivos.push(f); }
  archivos.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); });
  archivos.slice(conservar).forEach(function (f) { f.setTrashed(true); });   // a la papelera, no borrado definitivo
  setCfg('UltimoRespaldo', Utilities.formatDate(new Date(), 'America/Lima', 'dd/MM/yyyy HH:mm'));
  return nombre;
}

/** Trigger diario 00:30: recálculo completo (días de atraso) + revisión de integridad. */
function tareaDiaria() {
  var lock = LockService.getScriptLock();
  lock.waitLock(120000);
  try { recalcularTodo(); } finally { lock.releaseLock(); }
  verificarIntegridad();
}

/** Trigger diario 01:00. */
function respaldoDiario() { respaldo(''); }

/** Trigger el día 1 de cada mes: en diciembre avisa al dueño si falta renovar el año siguiente. */
function avisoRenovacion() {
  var hoy = partesDia(hoyDia());
  if (hoy.m !== 12) return;
  var ctx = abrirContexto();
  if (faltaRenovar(ctx, hoy.a + 1)) {
    MailApp.sendEmail(String(cfg('Email')), 'D@NDINET: falta renovar el año ' + (hoy.a + 1),
      'Hay servicios activos sin cuotas del año ' + (hoy.a + 1) + '. Ejecute "Renovar año" en la app (solo ADMIN).');
  }
}

/** Crea (o recrea) los triggers del sistema. Ejecutar una vez, como el dueño de la cuenta. */
function instalarTriggers() {
  // (En la Fase 6 se agrega aquí el reintento de los PDF pendientes.)
  var nuestros = ['tareaDiaria', 'respaldoDiario', 'avisoRenovacion', 'procesarColaPendiente'];
  ScriptApp.getProjectTriggers().forEach(function (t) { if (nuestros.indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('tareaDiaria').timeBased().atHour(0).nearMinute(30).everyDays(1).inTimezone('America/Lima').create();
  ScriptApp.newTrigger('respaldoDiario').timeBased().atHour(1).everyDays(1).inTimezone('America/Lima').create();
  ScriptApp.newTrigger('avisoRenovacion').timeBased().onMonthDay(1).atHour(8).inTimezone('America/Lima').create();
  return 'Triggers instalados: tareaDiaria (00:30), respaldoDiario (01:00), avisoRenovacion (día 1).';
}
