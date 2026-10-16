/**
 * INSTALACIÓN DE LOS ENTORNOS (Fase 1)
 * --------------------------------------------------------------------------
 * Hay DOS proyectos de Apps Script con el MISMO código:
 *   - dandinet-api-pruebas → ejecutar instalarPruebas()    (datos de ensayo: migracion.json al 04/08/2026)
 *   - dandinet-api         → ejecutar instalarProduccion() (solo la estructura; los datos reales llegan antes
 *                                                           de la puesta en marcha)
 *
 * Cada función:
 *   1. Crea (la primera vez) la carpeta y el libro del entorno en Google Drive.
 *   2. Crea las pestañas con sus formatos (nunca borra datos).
 *   3. Solo en PRUEBAS: importa migracion.json y verifica el cuadre contra esperado.json.
 *
 * Se puede volver a ejecutar sin riesgo: no duplica nada.
 * Protección: un proyecto que ya es de PRUEBAS no se puede instalar como PRODUCCIÓN, y al revés.
 */

var ENTORNOS = {
  PRUEBAS: { carpeta: 'DANDINET_PRUEBAS', libro: 'DANDINET_DB_PRUEBAS' },
  PRODUCCION: { carpeta: 'DANDINET', libro: 'DANDINET_DB' }
};

/** Entorno de este proyecto: 'PRUEBAS', 'PRODUCCION' o '' (sin instalar). */
function entorno() {
  return PropertiesService.getScriptProperties().getProperty('ENTORNO') || '';
}

/** ▶ Ejecutar en el proyecto dandinet-api-pruebas. */
function instalarPruebas() { return instalarEntorno_('PRUEBAS'); }

/** ▶ Ejecutar en el proyecto dandinet-api. */
function instalarProduccion() { return instalarEntorno_('PRODUCCION'); }

function instalarEntorno_(nombre) {
  var props = PropertiesService.getScriptProperties();
  var actual = props.getProperty('ENTORNO');
  if (actual && actual !== nombre) {
    throw new Error('Este proyecto ya está instalado como ' + actual + '. Para ' + nombre +
      ' use el otro proyecto de Apps Script (ver docs/FASE1_INSTALACION.md).');
  }
  var E = ENTORNOS[nombre], pasos = [];

  // ---- 1. Carpeta y libro (solo la primera vez) ----------------------------------------
  var libro = null, id = props.getProperty('DB_ID');
  if (id) { try { libro = SpreadsheetApp.openById(id); } catch (e) { libro = null; } }
  if (!libro) {
    var it = DriveApp.getRootFolder().getFoldersByName(E.carpeta);
    var carpeta = it.hasNext() ? it.next() : DriveApp.createFolder(E.carpeta);
    libro = SpreadsheetApp.create(E.libro);
    DriveApp.getFileById(libro.getId()).moveTo(carpeta);
    pasos.push('Creado el libro "' + E.libro + '" en la carpeta "' + E.carpeta + '".');
  }
  props.setProperty('ENTORNO', nombre);

  // ---- 2. Estructura ---------------------------------------------------------------------
  pasos.push(instalar(libro.getId()));

  // ---- 3. Datos ----------------------------------------------------------------------------
  if (nombre === 'PRUEBAS') {
    var fJ = archivoDrive_('migracion.json'), fE = archivoDrive_('esperado.json');
    if (props.getProperty('MIGRACION_IMPORTADA') !== 'SI') {
      pasos.push(importarMigracion(fJ.getId()).split('\n')[0].substr(0, 70) + '…');
      props.setProperty('MIGRACION_IMPORTADA', 'SI');
    } else {
      pasos.push('Los datos ya se importaron antes: no se vuelven a cargar.');
    }
    pasos.push('Cuadre contra el Excel: ' + verificarCuadre(fE.getId()).split('\n')[0]);
    actualizarPanel();
  } else {
    pasos.push('PRODUCCIÓN queda con la estructura vacía. Los datos reales se importan antes de la puesta en marcha (Fase 9).');
  }
  pasos.push('Abra el libro: ' + libro.getUrl());
  var txt = '[' + nombre + ']\n' + pasos.join('\n');
  Logger.log(txt);
  return txt;
}

/**
 * SOLO PRUEBAS: borra los datos del libro de pruebas y vuelve a importar migracion.json.
 * Sirve para empezar de cero después de hacer cobros de prueba.
 */
function reiniciarPruebas() {
  if (entorno() !== 'PRUEBAS') throw new Error('reiniciarPruebas() solo funciona en el proyecto de PRUEBAS.');
  var fJ = archivoDrive_('migracion.json'), fE = archivoDrive_('esperado.json');
  var r = importarMigracion(fJ.getId(), true).split('\n')[0].substr(0, 70) + '…\n' +
    'Cuadre: ' + verificarCuadre(fE.getId()).split('\n')[0];
  actualizarPanel();
  Logger.log(r);
  return r;
}

/** Busca un archivo por nombre en el Drive de la cuenta. */
function archivoDrive_(nombre) {
  var it = DriveApp.getFilesByName(nombre);
  if (!it.hasNext()) throw new Error('No encontré "' + nombre + '" en Google Drive. Súbalo primero (cualquier carpeta).');
  return it.next();
}

/**
 * Pestaña "Panel": foto rápida del sistema (clientes por estado, deudas, lista A CORTAR).
 * Se puede ejecutar cuando se quiera para refrescarla. El dashboard completo llega en la Fase 8.
 */
function actualizarPanel() {
  var lock = LockService.getScriptLock();
  lock.waitLock(60000);
  var tot;
  try { tot = recalcularTodo(); } finally { lock.releaseLock(); }
  var R = leerTabla('ResumenCliente'), c = R.c;
  var est = tot.estados || {};
  var filas = [
    ['D@NDINET · PANEL (' + (entorno() || 'sin entorno') + ')', ''],
    ['Calculado el', Utilities.formatDate(new Date(), 'America/Lima', 'dd/MM/yyyy HH:mm')],
    ['', ''],
    ['CLIENTES', ''],
    ['Activos (al día)', est[E_ACTIVO] || 0],
    ['Morosos', est[E_MOROSO] || 0],
    ['   de ellos "A CORTAR" (≥ ' + diasParaCorte() + ' días)', est.aCortar || 0],
    ['Cortados', est[E_CORTADO] || 0],
    ['Suspendidos', est[E_SUSPENDIDO] || 0],
    ['Sin servicio (Baja)', est[E_BAJA] || 0],
    ['Total', tot.clientes],
    ['', ''],
    ['DINERO', ''],
    ['Deuda vencida', tot.deudaVencida],
    ['Por cobrar (hasta el mes actual)', tot.porCobrar],
    ['Total facturado (no anulado)', tot.facturado],
    ['Total pagado', tot.pagadoCargos],
    ['Último recibo emitido', String(cfg('PrefijoRecibo')) + ('000000' + cfg('UltRecibo')).slice(-6)],
    ['', ''],
    ['⚠️ IMPORTANTE', entorno() === 'PRUEBAS'
      ? 'Datos de ENSAYO: llegan hasta el 04/08/2026. Los pagos posteriores no están cargados, por eso la deuda y la lista A CORTAR aparecen infladas.'
      : '']
  ];
  var libro = db(), h = libro.getSheetByName('Panel') || libro.insertSheet('Panel', 0);
  h.clear();
  h.getRange(1, 1, filas.length, 2).setValues(filas);
  h.getRange(1, 1).setFontWeight('bold').setFontSize(14).setFontColor('#1F3A5F');
  [4, 13].forEach(function (r) { h.getRange(r, 1).setFontWeight('bold').setFontColor('#2A9D8F'); });
  h.getRange(14, 2, 4, 1).setNumberFormat('"S/ "#,##0.00');
  h.getRange(filas.length, 1, 1, 2).setFontColor('#C62828');

  // Lista A CORTAR (mayor atraso primero)
  var corte = R.datos.filter(function (f) { return f[c.ALERTA] === 'A CORTAR'; })
    .sort(function (a, b) { return b[c.DIAS_ATRASO] - a[c.DIAS_ATRASO]; })
    .map(function (f) { return [f[c.ID_CLIENTE], f[c.NOMBRES], f[c.ZONA], f[c.PPPOE], f[c.MESES_ADEUDA], f[c.DEUDA_VENCIDA], f[c.DIAS_ATRASO]]; });
  var ini = filas.length + 2;
  h.getRange(ini, 1, 1, 7).setValues([['ID', 'CLIENTE', 'ZONA', 'PPPOE', 'MESES', 'DEUDA VENCIDA', 'DÍAS']])
    .setFontWeight('bold').setBackground('#1F3A5F').setFontColor('#FFFFFF');
  if (corte.length) {
    if (h.getMaxRows() < ini + corte.length) h.insertRowsAfter(h.getMaxRows(), ini + corte.length - h.getMaxRows());
    h.getRange(ini + 1, 1, corte.length, 7).setValues(corte);
    h.getRange(ini + 1, 6, corte.length, 1).setNumberFormat('"S/ "#,##0.00');
  }
  return tot;
}
