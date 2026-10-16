/**
 * PAGOS (traducción de modPagos del Excel v2)
 * --------------------------------------------------------------------------
 * - Un pago = un recibo correlativo (R-000116, R-000117…) sin saltos ni duplicados.
 * - Se aplica a los cargos elegidos del más antiguo al más nuevo. El último puede quedar PARCIAL.
 * - Nunca permite pagar un cargo ya cancelado (no existe el doble pago).
 * - Anular NO borra: marca el recibo y su detalle como anulados. El número no se reutiliza.
 *
 * Las funciones op_* trabajan dentro de una transacción (ctx). Las funciones públicas
 * (sin op_) abren su propia transacción y se pueden ejecutar desde el editor.
 */

/**
 * Registra un pago.
 * p = { idCliente, cargos: ['CRG-…'], monto, metodo, operacion, fecha, usuario, obs,
 *       idSolicitud, foto, gps, origen }
 * Devuelve { nro, monto, periodos, saldoRestante, repetido }.
 */
function op_registrarPago(ctx, p) {
  var u = exigirRol(ctx, p.usuario, ['ADMIN', 'COBRADOR']);
  var tCli = ctx.t('Clientes'), tCar = ctx.t('Cargos'), tPag = ctx.t('Pagos');

  // ---- idempotencia: la misma solicitud nunca genera dos recibos ---------------
  if (p.idSolicitud) {
    var ya = buscar(ctx, 'Pagos', 'ID_SOLICITUD', p.idSolicitud);
    if (ya >= 0) return { nro: String(val(tPag, ya, 'N_RECIBO')), monto: num(val(tPag, ya, 'MONTO')),
                          periodos: val(tPag, ya, 'PERIODOS'), saldoRestante: num(val(tPag, ya, 'SALDO_RESTANTE')), repetido: true };
  }

  // ---- validaciones generales --------------------------------------------------
  var fc = buscar(ctx, 'Clientes', 'ID_CLIENTE', p.idCliente);
  if (fc < 0) throw errNeg('Cliente ' + p.idCliente + ' no encontrado.');
  exigirZona(ctx, u, p.idCliente);
  var ids = (p.cargos || []).map(function (x) { return String(x).trim(); }).filter(String);
  if (!ids.length) throw errNeg('Seleccione al menos un periodo.');
  var monto = r2(p.monto);
  if (!(monto > 0)) throw errNeg('El monto debe ser mayor a 0.');
  var metodos = lista(ctx, 'METODO');
  if (!metodos.length) metodos = METODOS_PAGO;
  if (metodos.indexOf(String(p.metodo)) < 0) throw errNeg('Método de pago inválido: "' + p.metodo + '". Use: ' + metodos.join(', ') + '.');
  var fecha = aDia(p.fecha);
  if (fecha === null) throw errNeg('Fecha de pago inválida.');
  if (fecha > hoyDia()) throw errNeg('La fecha de pago (' + txtFecha(fecha) + ') no puede ser futura.');

  // ---- saldos al día antes de validar los periodos --------------------------------
  recalcularClientes(ctx, [p.idCliente]);
  var sel = [], vistos = {}, total = 0;
  ids.forEach(function (id) {
    if (vistos[id]) throw errNeg('Periodo repetido en la selección (' + id + ').');
    vistos[id] = true;
    var i = buscar(ctx, 'Cargos', 'ID_CARGO', id);
    if (i < 0) throw errNeg('El cargo ' + id + ' no existe.');
    var per = aDia(val(tCar, i, 'PERIODO')), nomPer = txtPeriodo(per) + ' (' + val(tCar, i, 'CONCEPTO') + ')';
    if (String(val(tCar, i, 'ID_CLIENTE')) !== String(p.idCliente)) throw errNeg('El cargo ' + id + ' no es de este cliente.');
    if (String(val(tCar, i, 'ANULADO')) === SI) throw errNeg('El periodo ' + nomPer + ' está anulado.');
    var saldo = r2(val(tCar, i, 'SALDO'));
    if (saldo <= 0) throw errNeg('El periodo ' + nomPer + ' YA ESTÁ PAGADO. No se puede pagar dos veces.');
    sel.push({ i: i, per: per, saldo: saldo });
    total = r2(total + saldo);
  });
  if (monto > total + 0.004) {
    throw errNeg('El monto (' + soles(monto) + ') supera el saldo de los periodos seleccionados (' + soles(total) +
      '). Para pagar por adelantado marque también los meses futuros.');
  }
  if (monto < total - 0.004 && u.rol === 'COBRADOR' && !u.parcial) {
    throw errNeg('Su usuario no tiene permiso para cobros parciales. Cobre el total (' + soles(total) + ') o pida al administrador.');
  }
  sel.sort(function (a, b) { return a.per - b.per; });

  // ---- correlativo: máximo entre Config y lo ya escrito, +1 ------------------------
  var pref = String(cfg('PrefijoRecibo') || 'R-'), n = parseInt(cfg('UltRecibo'), 10) || 0;
  tPag.datos.forEach(function (f) {
    var s = String(f[tPag.c.N_RECIBO]);
    if (s.indexOf(pref) === 0) { var k = parseInt(s.substr(pref.length), 10); if (k > n) n = k; }
  });
  n++;
  var nro = pref + ('000000' + n).slice(-6);

  // ---- detalle: del más antiguo al más nuevo ----------------------------------------
  var resto = monto, textos = [], cliente = val(tCli, fc, 'NOMBRES'), zona = val(tCli, fc, 'ZONA');
  sel.forEach(function (s) {
    if (resto <= 0.004) return;
    var apl = r2(Math.min(s.saldo, resto)), conc = String(val(tCar, s.i, 'CONCEPTO'));
    nuevaFila(ctx, 'PagosDet', {
      ID_DET: nro + '|' + val(tCar, s.i, 'ID_CARGO'), N_RECIBO: nro, ID_CARGO: val(tCar, s.i, 'ID_CARGO'),
      ID_SERV: val(tCar, s.i, 'ID_SERV'), ID_CLIENTE: p.idCliente, PERIODO: deDia(s.per), CONCEPTO: conc,
      MONTO_APLICADO: apl, FECHA_PAGO: deDia(fecha), METODO: p.metodo, ZONA: val(tCar, s.i, 'ZONA'),
      PLAN: val(tCar, s.i, 'PLAN'), ANULADO: NO
    });
    textos.push(txtPeriodo(s.per) + (conc !== 'MENSUALIDAD' ? ' ' + conc.toLowerCase() : '') +
      (apl < s.saldo ? ' (parcial ' + apl.toFixed(2) + ')' : ''));
    resto = r2(resto - apl);
  });

  // ---- cabecera --------------------------------------------------------------------------
  var iPag = nuevaFila(ctx, 'Pagos', {
    N_RECIBO: nro, FECHA: deDia(fecha), ID_CLIENTE: p.idCliente, CLIENTE: cliente,
    DNI_RUC: String(val(tCli, fc, 'DNI_RUC')), PERIODOS: textos.join(', ').substr(0, 250), MONTO: monto,
    METODO: p.metodo, OPERACION: String(p.operacion || '').trim(), USUARIO: p.usuario, F_REGISTRO: new Date(),
    ESTADO: 'Válido', OBS: String(p.obs || '').substr(0, 250), URL_VOUCHER: p.foto || '', GPS_COBRO: p.gps || '',
    ID_SOLICITUD: p.idSolicitud || '', ORIGEN: p.origen || 'online', ZONA: zona, F_DISPOSITIVO: p.fDispositivo || ''
  });

  // ---- contador (se escribe al final, ver ORDEN_GUARDADO) ----------------------------
  var ic = buscar(ctx, 'Config', 'CLAVE', 'UltRecibo');
  if (ic < 0) ic = nuevaFila(ctx, 'Config', { CLAVE: 'UltRecibo', VALOR: '', DESCRIPCION: 'Último N° de recibo emitido. NO EDITAR' });
  setV(ctx, 'Config', ic, 'VALOR', String(n));

  // ---- saldo restante del cliente ------------------------------------------------------
  recalcularClientes(ctx, [p.idCliente]);
  var saldoRest = num((resumenDe(ctx, p.idCliente) || {}).DEUDA_TOTAL);
  setV(ctx, 'Pagos', iPag, 'SALDO_RESTANTE', saldoRest);
  tocar(ctx, p.idCliente);
  bitacora(ctx, p.usuario, 'PAGO', 'Pagos', nro, p.idCliente + ' ' + soles(monto) + ' ' + p.metodo + ': ' + textos.join(', '));
  return { nro: nro, monto: monto, periodos: textos.join(', '), saldoRestante: saldoRest, repetido: false };
}

/**
 * Anula un recibo (solo ADMIN, con motivo). No borra nada.
 * p = { nro, motivo, usuario }
 */
function op_anularPago(ctx, p) {
  exigirRol(ctx, p.usuario, ['ADMIN']);
  var tPag = ctx.t('Pagos'), f = buscar(ctx, 'Pagos', 'N_RECIBO', p.nro);
  if (f < 0) throw errNeg('No existe el recibo ' + p.nro + '.');
  if (String(val(tPag, f, 'ESTADO')) === 'Anulado') throw errNeg('El recibo ' + p.nro + ' ya está anulado.');
  var motivo = String(p.motivo || '').trim();
  if (motivo.length < 4) throw errNeg('Indique el motivo de la anulación (mínimo 4 letras).');

  setV(ctx, 'Pagos', f, 'ESTADO', 'Anulado');
  setV(ctx, 'Pagos', f, 'MOTIVO_ANULACION', (motivo + ' (' + p.usuario + ')').substr(0, 250));
  setV(ctx, 'Pagos', f, 'F_ANULACION', new Date());
  var nDet = 0;
  buscarTodos(ctx, 'PagosDet', 'N_RECIBO', p.nro).forEach(function (i) { setV(ctx, 'PagosDet', i, 'ANULADO', SI); nDet++; });
  var k = buscar(ctx, 'Comprobantes', 'N_RECIBO', p.nro);
  if (k >= 0) setV(ctx, 'Comprobantes', k, 'ESTADO', 'Anulado');
  var idCli = String(val(tPag, f, 'ID_CLIENTE'));
  tocar(ctx, idCli);
  bitacora(ctx, p.usuario, 'ANULAR_PAGO', 'Pagos', p.nro, motivo + ' | ' + nDet + ' líneas anuladas');
  return { nro: p.nro, lineas: nDet };
}

/** Cargos con saldo de un cliente, ordenados por periodo (para la pantalla de cobro). */
function cargosPendientes(ctx, idCliente, incluirFuturos) {
  recalcularClientes(ctx, [idCliente]);
  var t = ctx.t('Cargos'), mes = inicioMes(hoyDia()), r = [];
  buscarTodos(ctx, 'Cargos', 'ID_CLIENTE', idCliente).forEach(function (i) {
    var per = aDia(val(t, i, 'PERIODO'));
    if (num(val(t, i, 'SALDO')) > 0.004 && String(val(t, i, 'ANULADO')) !== SI && (incluirFuturos || per <= mes)) {
      r.push({ idCargo: String(val(t, i, 'ID_CARGO')), periodo: per, concepto: val(t, i, 'CONCEPTO'),
               saldo: num(val(t, i, 'SALDO')), estado: val(t, i, 'ESTADO') });
    }
  });
  return r.sort(function (a, b) { return a.periodo - b.periodo; });
}

// ---- Versiones públicas (para el editor de Apps Script) ------------------------------
function registrarPago(idCliente, idsCargos, monto, metodo, operacion, fecha, usuario, obs) {
  return transaccion(function (ctx) {
    return op_registrarPago(ctx, { idCliente: idCliente, cargos: idsCargos, monto: monto, metodo: metodo,
      operacion: operacion, fecha: fecha, usuario: usuario || usuarioActual(), obs: obs, origen: 'editor' });
  });
}

function anularPago(nroRecibo, motivo, usuario) {
  return transaccion(function (ctx) {
    return op_anularPago(ctx, { nro: nroRecibo, motivo: motivo, usuario: usuario || usuarioActual() });
  });
}
