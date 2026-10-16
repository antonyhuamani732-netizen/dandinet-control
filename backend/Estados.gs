/**
 * CORTE / SUSPENSIÓN / BAJA / REACTIVACIÓN (traducción de modEstados)
 * --------------------------------------------------------------------------
 * Corte      : estado Cortado, LIBERA el PPPoE, anula las cuotas futuras SIN pago,
 *              CONSERVA la deuda vencida y registra el historial.
 * Suspensión : igual, pero el PPPoE queda reservado (asignado) para el cliente.
 * Baja       : definitiva. Libera el PPPoE y registra la fecha de fin.
 * Reactivar  : vuelve a Activo, asigna un PPPoE Disponible y regenera las cuotas hasta diciembre.
 */

/**
 * p = { idServ, nuevo: 'Cortado'|'Suspendido'|'Baja', fecha, motivo, cobrarMesCorte (por defecto true), usuario }
 * Devuelve { anuladas, adelantados, aviso, mensajeWhatsApp, enlaceWhatsApp }.
 */
function op_cambiarEstadoServicio(ctx, p) {
  exigirRol(ctx, p.usuario, ['ADMIN']);
  var tS = ctx.t('Servicios'), tC = ctx.t('Cargos');
  var fs = buscar(ctx, 'Servicios', 'ID_SERV', p.idServ);
  if (fs < 0) throw errNeg('Servicio no encontrado.');
  var ant = String(val(tS, fs, 'ESTADO')), nuevo = p.nuevo;
  if ([E_CORTADO, E_SUSPENDIDO, E_BAJA].indexOf(nuevo) < 0) throw errNeg('Acción no válida: ' + nuevo + '.');
  if (ant === E_BAJA) throw errNeg('El servicio ya está dado de baja.');
  if (ant === nuevo) throw errNeg('El servicio ya está en estado ' + nuevo + '.');
  if (nuevo !== E_BAJA && ant !== E_ACTIVO) throw errNeg('Solo se puede cortar o suspender un servicio Activo (está ' + ant + ').');
  var motivo = String(p.motivo || '').trim();
  if (motivo.length < 3) throw errNeg('Indique el motivo.');
  var fecha = aDia(p.fecha);
  if (fecha === null) throw errNeg('Fecha inválida.');
  var idCli = String(val(tS, fs, 'ID_CLIENTE'));
  recalcularClientes(ctx, [idCli]);                 // PAGADO al día para decidir qué se anula

  // 1. PPPoE (la suspensión lo reserva)
  var ppp = String(val(tS, fs, 'PPPOE'));
  if (ppp && nuevo !== E_SUSPENDIDO) liberarPPPoE_(ctx, ppp, fecha, nuevo + ': ' + motivo);

  // 2. anular cuotas posteriores sin pagos (la deuda anterior se conserva)
  var cobrarMes = p.cobrarMesCorte !== false && String(p.cobrarMesCorte) !== NO && String(p.cobrarMesCorte) !== 'false';
  var limite = cobrarMes ? sumarMeses(inicioMes(fecha), 1) : inicioMes(fecha);
  var nAnul = 0, adel = [];
  buscarTodos(ctx, 'Cargos', 'ID_SERV', p.idServ).forEach(function (i) {
    if (String(val(tC, i, 'ANULADO')) === SI) return;
    var per = aDia(val(tC, i, 'PERIODO'));
    if (per < limite) return;
    if (num(val(tC, i, 'PAGADO')) === 0) {
      setV(ctx, 'Cargos', i, 'ANULADO', SI);
      setV(ctx, 'Cargos', i, 'OBS', (String(val(tC, i, 'OBS')) + ' | Anulado por ' + nuevo.toLowerCase() + ' ' + txtFecha(fecha)).replace(/^ \| /, '').substr(0, 250));
      nAnul++;
    } else {
      adel.push(txtPeriodo(per));
    }
  });

  // 3. estado del servicio + historial
  setV(ctx, 'Servicios', fs, 'ESTADO', nuevo);
  setV(ctx, 'Servicios', fs, 'F_ESTADO', deDia(fecha));
  setV(ctx, 'Servicios', fs, 'MOTIVO_ESTADO', motivo.substr(0, 250));
  if (nuevo === E_BAJA) setV(ctx, 'Servicios', fs, 'FECHA_FIN', deDia(fecha));
  registrarHistorial(ctx, idCli, p.idServ, ant, nuevo, motivo + (ppp && nuevo !== E_SUSPENDIDO ? ' | PPPoE liberado: ' + ppp : '') +
    ' | ' + nAnul + ' cuotas futuras anuladas', fecha, p.usuario);

  // 4. aviso de WhatsApp (con la deuda ya recalculada)
  recalcularClientes(ctx, [idCli]);
  tocar(ctx, idCli);
  var msg = '', enlace = '';
  if (nuevo === E_CORTADO) {
    msg = plantilla(ctx, cfg('MsgCorte'), idCli);
    var ic = buscar(ctx, 'Clientes', 'ID_CLIENTE', idCli);
    enlace = enlaceWhatsApp(val(ctx.t('Clientes'), ic, 'TELEFONO'), msg);
  }
  var aviso = adel.length ? 'Atención: tiene pagos adelantados en ' + adel.join(', ') + ' (se mantienen).' : '';
  bitacora(ctx, p.usuario, nuevo.toUpperCase(), 'Servicios', p.idServ, motivo + ' | ' + nAnul + ' cuotas anuladas' + (aviso ? ' | ' + aviso : ''));
  return { idServ: p.idServ, estado: nuevo, anuladas: nAnul, adelantados: adel, aviso: aviso,
           pppoeLiberado: nuevo !== E_SUSPENDIDO ? ppp : '', mensajeWhatsApp: msg, enlaceWhatsApp: enlace };
}

/**
 * p = { idServ, fecha, codigoPPPoE, tarifa (opcional), motivo, usuario }
 * Devuelve { idServ, cuotas, pppoe, deuda, aviso }.
 */
function op_reactivarServicio(ctx, p) {
  exigirRol(ctx, p.usuario, ['ADMIN']);
  var tS = ctx.t('Servicios');
  var fs = buscar(ctx, 'Servicios', 'ID_SERV', p.idServ);
  if (fs < 0) throw errNeg('Servicio no encontrado.');
  var ant = String(val(tS, fs, 'ESTADO'));
  if (ant !== E_CORTADO && ant !== E_SUSPENDIDO) throw errNeg('Solo se reactiva un servicio Cortado o Suspendido (está ' + ant + ').');
  var fecha = aDia(p.fecha);
  if (fecha === null) throw errNeg('Fecha inválida.');
  var tarifa = r2(p.tarifa) > 0 ? r2(p.tarifa) : r2(val(tS, fs, 'TARIFA'));
  var idCli = String(val(tS, fs, 'ID_CLIENTE'));
  var codigo = String(p.codigoPPPoE || '').trim(), actual = String(val(tS, fs, 'PPPOE'));
  var motivo = String(p.motivo || '').trim() || 'Reactivación';

  // Suspendido: conserva su PPPoE. Cortado: se asigna uno Disponible (si se indicó).
  if (codigo && codigo !== actual) {
    if (actual) throw errNeg('El servicio ya tiene el PPPoE ' + actual + '.');
    asignarPPPoE_(ctx, codigo, p.idServ, fecha, p.usuario);   // valida Disponible + doble verificación
  }
  setV(ctx, 'Servicios', fs, 'TARIFA', tarifa);
  setV(ctx, 'Servicios', fs, 'ESTADO', E_ACTIVO);
  setV(ctx, 'Servicios', fs, 'F_ESTADO', deDia(fecha));
  setV(ctx, 'Servicios', fs, 'MOTIVO_ESTADO', motivo.substr(0, 250));
  var p0 = partesDia(fecha);
  var n = generarCargosServicio(ctx, p.idServ, inicioMes(fecha), diaDe(p0.a, 12, 1), 'MENSUALIDAD', -1, 'Reactivación');
  registrarHistorial(ctx, idCli, p.idServ, ant, E_ACTIVO, motivo + (codigo ? ' | PPPoE: ' + codigo : ''), fecha, p.usuario);
  recalcularClientes(ctx, [idCli]);
  tocar(ctx, idCli);
  var deuda = num((resumenDe(ctx, idCli) || {}).DEUDA_VENCIDA);
  var avisos = [];
  if (deuda > 0) avisos.push('El cliente mantiene una deuda vencida de ' + soles(deuda) + '.');
  if (!String(val(tS, fs, 'PPPOE'))) avisos.push('El servicio quedó SIN PPPoE asignado.');
  bitacora(ctx, p.usuario, 'REACTIVAR', 'Servicios', p.idServ, motivo + ' | ' + n + ' cuotas | PPPoE ' + (val(tS, fs, 'PPPOE') || '-'));
  return { idServ: p.idServ, cuotas: n, pppoe: String(val(tS, fs, 'PPPOE')), deuda: deuda, aviso: avisos.join(' ') };
}

/** Servicios activos de clientes con atraso ≥ DiasCorte (la lista "A CORTAR"). */
function listaACortar(ctx) {
  var tS = ctx.t('Servicios'), r = [], corte = diasParaCorte();
  tS.datos.forEach(function (f) {
    if (String(f[tS.c.ESTADO]) !== E_ACTIVO) return;
    var res = resumenDe(ctx, f[tS.c.ID_CLIENTE]);
    if (res && num(res.DIAS_ATRASO) >= corte) r.push({ idServ: String(f[tS.c.ID_SERV]), idCliente: String(f[tS.c.ID_CLIENTE]),
      cliente: res.NOMBRES, zona: res.ZONA, pppoe: String(f[tS.c.PPPOE]), deuda: num(res.DEUDA_VENCIDA), dias: num(res.DIAS_ATRASO) });
  });
  return r.sort(function (a, b) { return b.dias - a.dias; });
}

// ---- Versiones públicas ----------------------------------------------------------------
function cambiarEstadoServicio(idServ, nuevo, fecha, motivo, cobrarMesCorte, usuario) {
  return transaccion(function (ctx) {
    return op_cambiarEstadoServicio(ctx, { idServ: idServ, nuevo: nuevo, fecha: fecha, motivo: motivo,
      cobrarMesCorte: cobrarMesCorte, usuario: usuario || usuarioActual() });
  });
}
function reactivarServicio(idServ, fecha, codigoPPPoE, tarifa, motivo, usuario) {
  return transaccion(function (ctx) {
    return op_reactivarServicio(ctx, { idServ: idServ, fecha: fecha, codigoPPPoE: codigoPPPoE, tarifa: tarifa,
      motivo: motivo, usuario: usuario || usuarioActual() });
  });
}
