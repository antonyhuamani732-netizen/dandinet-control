/**
 * INSTALACIÓN, MIGRACIÓN Y VERIFICACIÓN DE CUADRE (Fase 1)
 * --------------------------------------------------------------------------
 * Lo normal es NO llamar estas funciones a mano: instalarPruebas() e
 * instalarProduccion() (Instalacion.gs) las llaman en el orden correcto.
 *   1. instalar('ID_DEL_LIBRO')            → vincula el libro y crea las pestañas.
 *   2. importarMigracion('ID_migracion.json') → carga los datos conservando los IDs.
 *   3. verificarCuadre('ID_esperado.json')    → compara contra el Excel. Debe decir "CUADRA".
 *
 * Nada de esto borra datos existentes, salvo que se pida explícitamente
 * importarMigracion(id, true) sobre el libro de PRUEBAS.
 */

// ============================================================================
// 1. INSTALACIÓN
// ============================================================================

/** Vincula el script al libro (DANDINET_DB o DANDINET_DB_PRUEBAS) y crea la estructura. */
function instalar(idLibro) {
  if (idLibro) PropertiesService.getScriptProperties().setProperty('DB_ID', idLibro);
  _db = null;
  var libro = db();
  libro.setSpreadsheetTimeZone('America/Lima');
  libro.setSpreadsheetLocale('es_PE');
  crearEstructura();
  return 'Instalado en "' + libro.getName() + '" (' + libro.getId() + ').';
}

/**
 * Crea las pestañas que falten, con encabezados y formatos. Si una pestaña ya
 * existe, solo agrega las columnas que le falten al final. NUNCA borra datos.
 */
function crearEstructura() {
  var libro = db();
  ORDEN_TABLAS.forEach(function (nombre) {
    var e = ESQUEMA[nombre];
    var h = libro.getSheetByName(nombre) || libro.insertSheet(nombre);
    var nc = h.getLastColumn();
    var enc = nc > 0 ? h.getRange(1, 1, 1, nc).getValues()[0].map(String) : [];
    var faltan = e.cols.filter(function (c) { return enc.indexOf(c) < 0; });
    if (faltan.length) {
      h.getRange(1, enc.length + 1, 1, faltan.length).setValues([faltan]);
      enc = enc.concat(faltan);
    }
    // estilo del encabezado
    var cab = h.getRange(1, 1, 1, enc.length);
    cab.setFontWeight('bold').setBackground('#1F3A5F').setFontColor('#FFFFFF');
    h.setFrozenRows(1);
    // formatos por columna (texto ANTES de escribir datos: protege los ceros iniciales)
    var filas = Math.max(h.getMaxRows() - 1, 1);
    enc.forEach(function (col, i) {
      var r = h.getRange(2, i + 1, filas, 1);
      if (e.texto.indexOf(col) >= 0) r.setNumberFormat('@');
      else if (e.fecha.indexOf(col) >= 0) r.setNumberFormat('dd/mm/yyyy');
      else if (e.fechaHora.indexOf(col) >= 0) r.setNumberFormat('dd/mm/yyyy hh:mm');
      else if (e.dinero.indexOf(col) >= 0) r.setNumberFormat('#,##0.00');
      if (e.calc.indexOf(col) >= 0) h.getRange(1, i + 1).setBackground('#2A9D8F'); // columnas calculadas
    });
  });
  // quita la "Hoja 1" vacía que crea Google
  ['Hoja 1', 'Sheet1', 'Hoja1'].forEach(function (n) {
    var h = libro.getSheetByName(n);
    if (h && h.getLastRow() === 0 && libro.getSheets().length > 1) libro.deleteSheet(h);
  });
  formatoCondicional_();
}

/** Colores por estado (rojo moroso/vencido, amarillo por vencer, gris cortado, verde pagado). */
function formatoCondicional_() {
  var reglas = {
    Cargos: { col: 'ESTADO', colores: { 'Vencido': '#F8D7DA', 'Por vencer': '#FFF3CD', 'Pagado': '#D4EDDA', 'Parcial': '#FFE5CC', 'Anulado': '#E0E0E0', 'Sin precio': '#E0E0E0' } },
    ResumenCliente: { col: 'ESTADO', colores: { 'Moroso': '#F8D7DA', 'Activo': '#D4EDDA', 'Cortado': '#E0E0E0', 'Suspendido': '#E0E0E0', 'Baja': '#BDBDBD' } },
    Pagos: { col: 'ESTADO', colores: { 'Anulado': '#F8D7DA' } },
    PPPoE: { col: 'ESTADO', colores: { 'Disponible': '#D4EDDA', 'Asignado': '#DDEBF7', 'Bloqueado': '#F8D7DA' } }
  };
  Object.keys(reglas).forEach(function (nombre) {
    var h = db().getSheetByName(nombre), def = reglas[nombre];
    var ci = ESQUEMA[nombre].cols.indexOf(def.col) + 1;
    var r = h.getRange(2, ci, Math.max(h.getMaxRows() - 1, 1), 1);
    var nuevas = h.getConditionalFormatRules().filter(function (x) {
      return x.getRanges().every(function (rg) { return rg.getColumn() !== ci; });
    });
    Object.keys(def.colores).forEach(function (valor) {
      nuevas.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(valor)
        .setBackground(def.colores[valor]).setRanges([r]).build());
    });
    h.setConditionalFormatRules(nuevas);
  });
}

// ============================================================================
// 2. CONSTRUCCIÓN DE FILAS DESDE migracion.json (función pura, se prueba en local)
// ============================================================================

/**
 * Convierte el JSON de migración en filas listas para cada pestaña.
 * Conserva los IDs CLI-, SRV-, CRG- y MIG-. Las fechas pasan a Date (medianoche, Lima).
 * Devuelve { filas: {Tabla: [[...]]}, avisos: [texto] }.
 */
function construirFilasMigracion(J, emailAdmin) {
  var F = {}, avisos = [];
  ORDEN_TABLAS.forEach(function (t) { F[t] = []; });
  var fecha = function (v) { var d = aDia(v); return d === null ? '' : deDia(d); };
  var txt = function (v) { return v === null || v === undefined ? '' : String(v); };
  var fila = function (tabla, obj) {
    return ESQUEMA[tabla].cols.map(function (c) { return obj[c] === undefined || obj[c] === null ? '' : obj[c]; });
  };
  var ahora = new Date();

  // ---- Clientes + ClientesPriv --------------------------------------------------
  var zonaCli = {};
  J.clientes.forEach(function (c) {
    zonaCli[c.ID_CLIENTE] = c.ZONA;
    var obs = txt(c.OBS);
    if (!telefonoValido(c.TEL)) {
      obs = (obs ? obs + ' | ' : '') + 'TEL. INVÁLIDO: revisar';
      avisos.push(c.ID_CLIENTE + ' ' + c.NOMBRES + ': teléfono inválido "' + c.TEL + '"');
    }
    if (!docValido(c.DNI)) avisos.push(c.ID_CLIENTE + ': DNI/RUC inválido "' + c.DNI + '"');
    F.Clientes.push(fila('Clientes', {
      ID_CLIENTE: c.ID_CLIENTE, DNI_RUC: txt(c.DNI), NOMBRES: c.NOMBRES, TELEFONO: txt(c.TEL), TELEFONO2: txt(c.TEL2),
      DIRECCION: c.DIRECCION, REFERENCIA: c.REFERENCIA, ZONA: c.ZONA, COORDENADAS: txt(c.COORD),
      FECHA_ALTA: fecha(c.FECHA_ALTA), DIA_VENC: num(c.DIA_VENC) || '', OBSERVACIONES: obs,
      ULT_MODIF: ahora, USR_MODIF: 'MIGRACION'
    }));
    F.ClientesPriv.push(fila('ClientesPriv', {
      ID_CLIENTE: c.ID_CLIENTE, USUARIO_WIFI: txt(c.USR_WIFI), CLAVE_WIFI: txt(c.CLAVE_WIFI),
      USUARIO_ROUTER: txt(c.USR_ROUTER), CLAVE_ROUTER: txt(c.CLAVE_ROUTER)
    }));
    F.ResumenCliente.push(fila('ResumenCliente', { ID_CLIENTE: c.ID_CLIENTE }));
  });

  // ---- Servicios -------------------------------------------------------------------
  J.servicios.forEach(function (s) {
    F.Servicios.push(fila('Servicios', {
      ID_SERV: s.ID_SERV, ID_CLIENTE: s.ID_CLIENTE, CLIENTE: s.CLIENTE, ZONA: zonaCli[s.ID_CLIENTE] || '',
      PLAN: s.PLAN, MODO: s.MODO, TARIFA: num(s.TARIFA), PPPOE: txt(s.PPPOE), PPPOE_ANT: txt(s.PPPOE_ANT),
      FECHA_INICIO: fecha(s.FECHA_INICIO), ESTADO: s.ESTADO, F_ESTADO: fecha(s.F_ESTADO),
      MOTIVO_ESTADO: s.MOTIVO_ESTADO, FECHA_FIN: fecha(s.FECHA_FIN), OBS: s.OBS
    }));
  });

  // ---- Cargos (con la clave única ID_SERV|AAAA-MM|CONCEPTO) ------------------------
  var claves = {};
  J.cargos.forEach(function (k) {
    var per = aDia(k.PERIODO);
    var clave = k.ID_SERV + '|' + aaaamm(per) + '|' + String(k.CONCEPTO).toUpperCase();
    if (claves[clave]) avisos.push('Clave de cargo repetida: ' + clave + ' (' + claves[clave] + ' y ' + k.ID_CARGO + ')');
    claves[clave] = k.ID_CARGO;
    F.Cargos.push(fila('Cargos', {
      ID_CARGO: k.ID_CARGO, CLAVE: clave, ID_SERV: k.ID_SERV, ID_CLIENTE: k.ID_CLIENTE, CLIENTE: k.CLIENTE,
      PERIODO: deDia(per), CONCEPTO: String(k.CONCEPTO).toUpperCase(), MONTO: num(k.MONTO),
      PAGADO: 0, SALDO: 0, DIAS_ATRASO: 0, ESTADO: '', ANULADO: k.ANULADO === SI ? SI : NO,
      ZONA: k.ZONA, PLAN: k.PLAN, OBS: txt(k.OBS)
    }));
  });

  // ---- Pagos y detalle --------------------------------------------------------------
  var hoy = hoyDia();
  J.pagos.forEach(function (p) {
    var fp = aDia(p.FECHA);
    var obs = txt(p.OBS);
    if (fp !== null && fp > hoy) {
      obs = (obs ? obs + ' | ' : '') + 'FECHA FUTURA: revisar';
      avisos.push(p.N_RECIBO + ': fecha de pago futura ' + txtFecha(fp) + ' (' + p.CLIENTE + ')');
    }
    F.Pagos.push(fila('Pagos', {
      N_RECIBO: p.N_RECIBO, FECHA: fecha(p.FECHA), ID_CLIENTE: p.ID_CLIENTE, CLIENTE: p.CLIENTE,
      DNI_RUC: txt(p.DNI), PERIODOS: txt(p.PERIODOS), MONTO: num(p.MONTO), METODO: p.METODO,
      OPERACION: txt(p.OPERACION), USUARIO: p.USUARIO, F_REGISTRO: fecha(p.F_REGISTRO),
      SALDO_RESTANTE: p.SALDO_RESTANTE === '' ? '' : num(p.SALDO_RESTANTE), ESTADO: p.ESTADO,
      MOTIVO_ANULACION: txt(p.MOTIVO_ANUL), F_ANULACION: fecha(p.F_ANUL), OBS: obs,
      ID_SOLICITUD: '', ORIGEN: 'MIGRACION', ZONA: zonaCli[p.ID_CLIENTE] || ''
    }));
  });
  J.det.forEach(function (d) {
    F.PagosDet.push(fila('PagosDet', {
      ID_DET: d.N_RECIBO + '|' + d.ID_CARGO, N_RECIBO: d.N_RECIBO, ID_CARGO: d.ID_CARGO, ID_SERV: d.ID_SERV,
      ID_CLIENTE: d.ID_CLIENTE, PERIODO: fecha(d.PERIODO), CONCEPTO: d.CONCEPTO, MONTO_APLICADO: num(d.MONTO),
      FECHA_PAGO: fecha(d.FECHA_PAGO), METODO: d.METODO, ZONA: d.ZONA, PLAN: d.PLAN,
      ANULADO: d.ANULADO === SI ? SI : NO
    }));
  });

  // ---- Historiales --------------------------------------------------------------------
  J.hist.forEach(function (h, i) {
    F.HistorialEstados.push(fila('HistorialEstados', {
      ID_HIST: 'HST-' + ('00000' + (i + 1)).slice(-6), FECHA: fecha(h.FECHA), ID_CLIENTE: h.ID_CLIENTE,
      CLIENTE: h.CLIENTE, ID_SERV: h.ID_SERV, ESTADO_ANT: h.ANT, ESTADO_NUEVO: h.NUEVO, MOTIVO: h.MOTIVO,
      USUARIO: h.USUARIO, F_REGISTRO: ahora
    }));
  });
  J.hist_ppp.forEach(function (h, i) {
    F.HistPPPoE.push(fila('HistPPPoE', {
      ID_HPPP: 'HPP-' + ('00000' + (i + 1)).slice(-6), CODIGO: txt(h.CODIGO), ID_CLIENTE: h.ID_CLIENTE,
      CLIENTE: h.CLIENTE, ID_SERV: h.ID_SERV, F_DESDE: fecha(h.F_DESDE), F_HASTA: fecha(h.F_HASTA),
      MOTIVO_FIN: h.MOTIVO_FIN, OBS: h.OBS
    }));
  });

  // ---- PPPoE (con doble verificación contra Servicios) ------------------------------
  var srvPorCodigo = {};
  J.servicios.forEach(function (s) {
    if (!s.PPPOE) return;
    if (srvPorCodigo[s.PPPOE]) avisos.push('PPPoE ' + s.PPPOE + ' figura en 2 servicios: ' + srvPorCodigo[s.PPPOE] + ' y ' + s.ID_SERV);
    srvPorCodigo[s.PPPOE] = s.ID_SERV;
    if (s.ESTADO !== E_ACTIVO && s.ESTADO !== E_SUSPENDIDO) avisos.push('PPPoE ' + s.PPPOE + ' asignado a ' + s.ID_SERV + ' (' + s.CLIENTE + ') que está ' + s.ESTADO + ': revisar');
  });
  J.pppoe.forEach(function (p) {
    if (p.ESTADO === P_ASIGNADO && srvPorCodigo[p.CODIGO] !== p.ID_SERV) avisos.push('PPPoE ' + p.CODIGO + ': el inventario dice ' + p.ID_SERV + ' pero Servicios dice ' + (srvPorCodigo[p.CODIGO] || '(ninguno)'));
    F.PPPoE.push(fila('PPPoE', {
      CODIGO: txt(p.CODIGO), TITULAR: p.TITULAR, ESTADO: p.ESTADO, ID_SERV: txt(p.ID_SERV), ID_CLIENTE: txt(p.ID_CLIENTE),
      CLIENTE: p.CLIENTE, F_ASIGNACION: fecha(p.F_ASIG), OBS: p.OBS
    }));
  });

  // ---- Catálogos ------------------------------------------------------------------------
  J.planes.forEach(function (p) {
    F.Planes.push(fila('Planes', { PLAN: p.PLAN, CODIGO: p.CODIGO, TARIFA: num(p.TARIFA), ACTIVO: SI }));
  });
  var listas = [];
  J.modos.forEach(function (v) { listas.push(['MODO', v]); });
  J.zonas.forEach(function (v) { listas.push(['ZONA', v]); });
  METODOS_PAGO.forEach(function (v) { listas.push(['METODO', v]); });
  [E_ACTIVO, E_SUSPENDIDO, E_CORTADO, E_BAJA].forEach(function (v) { listas.push(['ESTADO_SERV', v]); });
  [P_DISPONIBLE, P_ASIGNADO, P_BLOQUEADO].forEach(function (v) { listas.push(['ESTADO_PPPOE', v]); });
  ['MENSUALIDAD', 'INSTALACION'].forEach(function (v) { listas.push(['CONCEPTO', v]); });
  ['ADMIN', 'COBRADOR', 'CONSULTA'].forEach(function (v) { listas.push(['ROL', v]); });
  var orden = {};
  listas.forEach(function (l, i) {
    orden[l[0]] = (orden[l[0]] || 0) + 1;
    F.Listas.push(fila('Listas', { ID: 'LST-' + ('000' + (i + 1)).slice(-4), TIPO: l[0], VALOR: l[1], ORDEN: orden[l[0]], ACTIVO: SI }));
  });

  // ---- Config y usuario administrador ---------------------------------------------------
  CONFIG_DEFECTO.forEach(function (r) {
    var v = r[0] === 'UltRecibo' ? String(J.ult_recibo) : r[1];
    F.Config.push([r[0], v, r[2]]);
  });
  // Quien ejecuta la importación queda como primer usuario (ADMIN, todas las zonas).
  if (emailAdmin) F.Usuarios.push(fila('Usuarios', { EMAIL: String(emailAdmin).toLowerCase(), NOMBRE: 'Administrador', ROL: 'ADMIN', ZONAS: '*', INICIALES: 'ADM', ACTIVO: SI }));

  F.Bitacora.push(fila('Bitacora', {
    ID: 'BIT-000001', FECHA_HORA: ahora, USUARIO: emailAdmin || 'MIGRACION', ACCION: 'MIGRACION',
    ENTIDAD: 'TODAS', ID_ENTIDAD: '', DETALLE: 'Importación desde migracion.json: ' + J.clientes.length + ' clientes, ' +
      J.cargos.length + ' cargos, ' + J.pagos.length + ' pagos. Avisos: ' + avisos.length
  }));
  return { filas: F, avisos: avisos };
}

// ============================================================================
// 3. IMPORTACIÓN EN GOOGLE SHEETS
// ============================================================================

/**
 * Importa migracion.json (subido a Drive) en el libro.
 * - idArchivo: ID del archivo migracion.json en Drive.
 * - reemplazar: true SOLO en un libro de ensayo. Vacía las tablas antes de importar.
 * Si alguna tabla de datos ya tiene filas y reemplazar no es true, se detiene sin tocar nada.
 */
function importarMigracion(idArchivo, reemplazar) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var J = JSON.parse(DriveApp.getFileById(idArchivo).getBlob().getDataAsString('UTF-8'));
    var email = usuarioActual();   // correo de quien instala (queda como ADMIN)
    var r = construirFilasMigracion(J, email);
    var libro = db();

    var conDatos = ORDEN_TABLAS.filter(function (t) { return libro.getSheetByName(t).getLastRow() > 1; });
    if (conDatos.length && reemplazar !== true) {
      throw new Error('Estas pestañas ya tienen datos: ' + conDatos.join(', ') +
        '. No se importó nada. En un libro de ENSAYO use importarMigracion(id, true).');
    }
    // a) vaciar y asegurar filas suficientes
    ORDEN_TABLAS.forEach(function (t) {
      var h = libro.getSheetByName(t), necesarias = r.filas[t].length + 1;
      if (h.getLastRow() > 1) h.getRange(2, 1, h.getLastRow() - 1, h.getLastColumn()).clearContent();
      if (h.getMaxRows() < necesarias) h.insertRowsAfter(h.getMaxRows(), necesarias - h.getMaxRows());
    });
    // b) formatos ANTES de escribir: las columnas de texto quedan como texto (ceros iniciales)
    crearEstructura();
    // c) escribir cada tabla en una sola llamada
    ORDEN_TABLAS.forEach(function (t) {
      var filas = r.filas[t];
      if (filas.length) libro.getSheetByName(t).getRange(2, 1, filas.length, filas[0].length).setValues(filas);
    });
    SpreadsheetApp.flush();
    _cfgCache = null;
    var tot = recalcularTodo();
    escribirAvisos_(r.avisos);
    return 'Importación terminada. ' + JSON.stringify(tot) + '\nAvisos: ' + r.avisos.length + ' (ver pestaña AvisosMigracion).';
  } finally {
    lock.releaseLock();
  }
}

function escribirAvisos_(avisos) {
  var libro = db();
  var h = libro.getSheetByName('AvisosMigracion') || libro.insertSheet('AvisosMigracion');
  h.clear();
  h.getRange(1, 1, 1, 2).setValues([['N°', 'AVISO (pendientes heredados: mostrar al dueño, no corregir sin aprobación)']]).setFontWeight('bold');
  if (avisos.length) h.getRange(2, 1, avisos.length, 2).setValues(avisos.map(function (a, i) { return [i + 1, a]; }));
}

// ============================================================================
// 4. VERIFICACIÓN DE CUADRE contra esperado.json
// ============================================================================

/**
 * Compara las tablas (en memoria) con esperado.json. Función pura.
 * Recalcula con la fecha del corte (04/08/2026) y el día de vencimiento = 1,
 * igual que se calculó el Excel. NO modifica las hojas.
 * Devuelve { cuadra: bool, lineas: [[OK/FALLO, control, esperado, obtenido, detalle]] }.
 */
function compararCuadre(T, E) {
  var lineas = [], todoOk = true;
  var linea = function (ok, control, esp, obt, det) {
    if (!ok) todoOk = false;
    lineas.push([ok ? 'OK' : 'FALLO', control, esp, obt, det || '']);
  };
  var tot = calcularMotor(T, { hoy: E.fecha_cache, diaVenc: 1 });

  // conteos
  linea(T.Clientes.datos.length === E.n_clientes_v2, 'Clientes', E.n_clientes_v2, T.Clientes.datos.length);
  linea(T.Servicios.datos.length === E.n_servicios, 'Servicios', E.n_servicios, T.Servicios.datos.length);
  linea(T.Cargos.datos.length === E.n_cargos, 'Cargos', E.n_cargos, T.Cargos.datos.length);
  linea(T.PagosDet.datos.length === E.n_det, 'Líneas de detalle de pago', E.n_det, T.PagosDet.datos.length);
  if (T.Pagos) linea(T.Pagos.datos.length === E.n_pagos, 'Pagos (recibos)', E.n_pagos, T.Pagos.datos.length);

  // totales de dinero
  var pagadoDet = 0, cD = T.PagosDet.c;
  T.PagosDet.datos.forEach(function (f) { if (String(f[cD.ANULADO]) !== SI) pagadoDet += num(f[cD.MONTO_APLICADO]); });
  pagadoDet = r2(pagadoDet);
  linea(Math.abs(pagadoDet - E.total_pagado) < 0.005, 'Total pagado (detalle)', E.total_pagado, pagadoDet);
  if (T.Pagos) {
    var pagadoRec = 0, cP = T.Pagos.c;
    T.Pagos.datos.forEach(function (f) { if (String(f[cP.ESTADO]) !== 'Anulado') pagadoRec += num(f[cP.MONTO]); });
    pagadoRec = r2(pagadoRec);
    linea(Math.abs(pagadoRec - pagadoDet) < 0.005, 'Σ recibos válidos = Σ detalle', pagadoDet, pagadoRec);
  }
  linea(Math.abs(tot.pagadoCargos - pagadoDet) < 0.005, 'Σ pagado en cargos = Σ detalle', pagadoDet, tot.pagadoCargos,
    'Si difiere: hay pagos aplicados a cargos anulados o a cargos inexistentes');
  linea(Math.abs(tot.facturado - E.total_cargos) < 0.005, 'Total facturado no anulado', E.total_cargos, tot.facturado);
  linea(Math.abs(tot.saldo - E.saldo_pendiente_total) < 0.005, 'Saldo pendiente total', E.saldo_pendiente_total, tot.saldo);
  linea(Math.abs(r2(tot.facturado - tot.pagadoCargos) - tot.saldo) < 0.005, 'Facturado − pagado = saldo',
    r2(tot.facturado - tot.pagadoCargos), tot.saldo, 'Si difiere: hay cargos pagados de más');

  // deuda vencida por cliente
  var cR = T.ResumenCliente.c, dv = {}, sumaDv = 0;
  T.ResumenCliente.datos.forEach(function (f) {
    var v = num(f[cR.DEUDA_VENCIDA]);
    if (v > 0.004) dv[String(f[cR.ID_CLIENTE])] = v;
    sumaDv += v;
  });
  sumaDv = r2(sumaDv);
  var esp = E.deuda_vencida_cache, dif = [];
  Object.keys(esp).concat(Object.keys(dv)).forEach(function (id, i, arr) {
    if (arr.indexOf(id) !== i) return;
    var a = num(esp[id]), b = num(dv[id]);
    if (Math.abs(a - b) > 0.005) dif.push(id + ': esperado ' + a + ', obtenido ' + b);
  });
  linea(Math.abs(sumaDv - E.deuda_vencida_cache_total) < 0.005, 'Deuda vencida total al ' + E.fecha_cache,
    E.deuda_vencida_cache_total, sumaDv);
  linea(dif.length === 0, 'Diferencias de deuda vencida por cliente', 0, dif.length, dif.slice(0, 10).join(' · '));

  // saldo pendiente por cliente (todos los cargos no anulados)
  var sp = {}, cK = T.Cargos.c;
  T.Cargos.datos.forEach(function (f) {
    var id = String(f[cK.ID_CLIENTE]);
    sp[id] = r2((sp[id] || 0) + num(f[cK.SALDO]));
  });
  var espS = E.saldo_pendiente || {}, difS = [];
  Object.keys(espS).concat(Object.keys(sp)).forEach(function (id, i, arr) {
    if (arr.indexOf(id) !== i) return;
    if (Math.abs(num(espS[id]) - num(sp[id])) > 0.005) difS.push(id + ': esperado ' + num(espS[id]) + ', obtenido ' + num(sp[id]));
  });
  linea(difS.length === 0, 'Diferencias de saldo pendiente por cliente', 0, difS.length, difS.slice(0, 10).join(' · '));

  // PPPoE
  var cPp = T.PPPoE.c, asig = 0;
  T.PPPoE.datos.forEach(function (f) { if (String(f[cPp.ESTADO]) === P_ASIGNADO) asig++; });
  linea(T.PPPoE.datos.length === E.pppoe_codigos, 'Códigos PPPoE', E.pppoe_codigos, T.PPPoE.datos.length);
  linea(asig === E.pppoe_asignados, 'PPPoE asignados', E.pppoe_asignados, asig);

  return { cuadra: todoOk, lineas: lineas, totales: tot };
}

/**
 * Verifica el cuadre del libro contra esperado.json (subido a Drive).
 * No modifica las tablas: recalcula en memoria. Escribe el resultado en la pestaña "Cuadre".
 */
function verificarCuadre(idEsperado) {
  var E = JSON.parse(DriveApp.getFileById(idEsperado).getBlob().getDataAsString('UTF-8'));
  var T = leerTablas(TABLAS_MOTOR.concat(['Pagos']));
  var r = compararCuadre(T, E);
  var libro = db();
  var h = libro.getSheetByName('Cuadre') || libro.insertSheet('Cuadre');
  h.clear();
  h.getRange(1, 1).setValue(r.cuadra ? '✅ CUADRA: el sistema reproduce el Excel al centavo' : '❌ NO CUADRA: revisar las filas en rojo')
    .setFontWeight('bold').setFontSize(14).setFontColor(r.cuadra ? '#2A9D8F' : '#C62828');
  h.getRange(2, 1).setValue('Verificado el ' + Utilities.formatDate(new Date(), 'America/Lima', 'dd/MM/yyyy HH:mm') +
    ' · corte ' + E.fecha_cache + ' · día de vencimiento forzado = 1');
  h.getRange(4, 1, 1, 5).setValues([['RESULTADO', 'CONTROL', 'ESPERADO (Excel)', 'OBTENIDO', 'DETALLE']]).setFontWeight('bold');
  h.getRange(5, 1, r.lineas.length, 5).setValues(r.lineas);
  r.lineas.forEach(function (l, i) { h.getRange(5 + i, 1).setBackground(l[0] === 'OK' ? '#D4EDDA' : '#F8D7DA'); });
  return (r.cuadra ? 'CUADRA' : 'NO CUADRA') + '\n' + r.lineas.map(function (l) { return l.join(' | '); }).join('\n');
}
