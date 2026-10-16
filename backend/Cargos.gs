/**
 * CARGOS (periodos facturados), traducción de modCargos
 * --------------------------------------------------------------------------
 * - Generación anual por servicio (desde un mes hasta diciembre).
 * - Renovación del año para todos los servicios activos (idempotente).
 * - Cambio de plan o tarifa desde un mes.
 * Clave única de un cargo: ID_SERV|AAAA-MM|CONCEPTO. Nunca se duplica.
 */

function claveCargo(idServ, periodo, concepto) {
  return String(idServ) + '|' + aaaamm(periodo) + '|' + String(concepto).toUpperCase();
}

/** Índice clave → fila de Cargos (se arma una vez por transacción). */
function indiceCargos(ctx) {
  if (ctx._idxCargos) return ctx._idxCargos;
  var t = ctx.t('Cargos'), d = {};
  t.datos.forEach(function (f, i) {
    var per = aDia(f[t.c.PERIODO]);
    var k = String(f[t.c.CLAVE] || '') || (per === null ? '' : claveCargo(f[t.c.ID_SERV], per, f[t.c.CONCEPTO]));
    if (k) d[k] = i;
  });
  ctx._idxCargos = d;
  return d;
}

/**
 * Genera (o reactiva, si estaban anulados y sin pagos) los cargos de un servicio entre dos meses.
 * Devuelve cuántos cargos se crearon o reactivaron. No duplica.
 */
function generarCargosServicio(ctx, idServ, desde, hasta, concepto, montoFijo, obs) {
  concepto = String(concepto || 'MENSUALIDAD').toUpperCase();
  var tS = ctx.t('Servicios'), tC = ctx.t('Cargos');
  var fs = buscar(ctx, 'Servicios', 'ID_SERV', idServ);
  if (fs < 0) throw errNeg('No existe el servicio ' + idServ + '.');
  var monto = montoFijo >= 0 ? r2(montoFijo) : r2(val(tS, fs, 'TARIFA'));
  var idx = indiceCargos(ctx), cnt = 0, sig = null;
  var per = inicioMes(aDia(desde)), fin = inicioMes(aDia(hasta));
  var idCli = String(val(tS, fs, 'ID_CLIENTE'));
  while (per <= fin) {
    var k = claveCargo(idServ, per, concepto);
    if (idx[k] !== undefined) {
      var i = idx[k];
      if (String(val(tC, i, 'ANULADO')) === SI && num(val(tC, i, 'PAGADO')) === 0) {
        setV(ctx, 'Cargos', i, 'ANULADO', NO);
        setV(ctx, 'Cargos', i, 'MONTO', monto);
        setV(ctx, 'Cargos', i, 'OBS', (String(val(tC, i, 'OBS')) + ' | Reactivado ' + txtFecha(hoyDia())).replace(/^ \| /, '').substr(0, 250));
        cnt++;
      }
    } else {
      if (sig === null) sig = parseInt(siguienteId(ctx, 'Cargos', 'ID_CARGO', 'CRG-', 6).substr(4), 10);
      var id = 'CRG-' + ('000000' + sig++).slice(-6);
      idx[k] = nuevaFila(ctx, 'Cargos', {
        ID_CARGO: id, CLAVE: k, ID_SERV: idServ, ID_CLIENTE: idCli, CLIENTE: val(tS, fs, 'CLIENTE'),
        PERIODO: deDia(per), CONCEPTO: concepto, MONTO: monto, PAGADO: 0, SALDO: monto, DIAS_ATRASO: 0,
        ESTADO: C_PENDIENTE, ANULADO: NO, ZONA: val(tS, fs, 'ZONA'), PLAN: val(tS, fs, 'PLAN'), OBS: obs || ''
      });
      cnt++;
    }
    per = sumarMeses(per, 1);
  }
  tocar(ctx, idCli);
  return cnt;
}

/** Renueva un año completo (ENE-DIC) para todos los servicios activos (o los de un cliente). */
function op_renovarAnio(ctx, p) {
  exigirRol(ctx, p.usuario, ['ADMIN']);
  var anio = parseInt(p.anio, 10);
  if (!(anio >= 2020 && anio <= 2100)) throw errNeg('Año inválido.');
  var tS = ctx.t('Servicios'), total = 0, nServ = 0;
  tS.datos.forEach(function (f) {
    if (String(f[tS.c.ESTADO]) !== E_ACTIVO) return;
    if (p.idCliente && String(f[tS.c.ID_CLIENTE]) !== String(p.idCliente)) return;
    var desde = diaDe(anio, 1, 1), ini = aDia(f[tS.c.FECHA_INICIO]);
    if (ini !== null && inicioMes(ini) > desde) desde = inicioMes(ini);
    if (desde <= diaDe(anio, 12, 1)) {
      var n = generarCargosServicio(ctx, f[tS.c.ID_SERV], desde, diaDe(anio, 12, 1), 'MENSUALIDAD', -1, 'Renovación ' + anio);
      if (n) nServ++;
      total += n;
    }
  });
  bitacora(ctx, p.usuario, 'RENOVAR_ANIO', 'Cargos', String(anio), total + ' cuotas generadas en ' + nServ + ' servicios');
  return { anio: anio, cuotas: total, servicios: nServ };
}

/** ¿Hay servicios activos sin la cuota de diciembre del año? */
function faltaRenovar(ctx, anio) {
  var tS = ctx.t('Servicios'), idx = indiceCargos(ctx);
  return tS.datos.some(function (f) {
    return String(f[tS.c.ESTADO]) === E_ACTIVO && idx[claveCargo(f[tS.c.ID_SERV], diaDe(anio, 12, 1), 'MENSUALIDAD')] === undefined;
  });
}

/** Cambia plan/tarifa desde un mes: actualiza las cuotas futuras SIN pagos. */
function op_cambiarPlan(ctx, p) {
  exigirRol(ctx, p.usuario, ['ADMIN']);
  var tS = ctx.t('Servicios'), tC = ctx.t('Cargos');
  var fs = buscar(ctx, 'Servicios', 'ID_SERV', p.idServ);
  if (fs < 0) throw errNeg('Servicio no encontrado.');
  if (!p.plan) throw errNeg('Seleccione el plan.');
  var tarifa = r2(p.tarifa);
  if (!(tarifa > 0)) {
    var ip = buscar(ctx, 'Planes', 'PLAN', p.plan);
    tarifa = ip >= 0 ? r2(val(ctx.t('Planes'), ip, 'TARIFA')) : 0;
  }
  if (!(tarifa > 0)) throw errNeg('La tarifa debe ser mayor a 0.');
  var desde = inicioMes(aDia(p.desde) || hoyDia()), n = 0;
  recalcularClientes(ctx, [val(tS, fs, 'ID_CLIENTE')]);
  setV(ctx, 'Servicios', fs, 'PLAN', p.plan);
  if (p.modo) setV(ctx, 'Servicios', fs, 'MODO', p.modo);
  setV(ctx, 'Servicios', fs, 'TARIFA', tarifa);
  buscarTodos(ctx, 'Cargos', 'ID_SERV', p.idServ).forEach(function (i) {
    if (String(val(tC, i, 'CONCEPTO')) !== 'MENSUALIDAD' || String(val(tC, i, 'ANULADO')) === SI) return;
    if (val(tC, i, 'VENCE_FIJO') !== '' && val(tC, i, 'VENCE_FIJO') !== undefined) return;   // mes prorrateado del alta: se respeta
    if (aDia(val(tC, i, 'PERIODO')) >= desde && num(val(tC, i, 'PAGADO')) === 0) {
      setV(ctx, 'Cargos', i, 'MONTO', tarifa);
      setV(ctx, 'Cargos', i, 'PLAN', p.plan);
      n++;
    }
  });
  var est = String(val(tS, fs, 'ESTADO'));
  registrarHistorial(ctx, val(tS, fs, 'ID_CLIENTE'), p.idServ, est, est,
    'Cambio de plan a ' + p.plan + ' (' + soles(tarifa) + ') desde ' + txtPeriodo(desde) + ' - ' + n + ' cuotas actualizadas', desde, p.usuario);
  tocar(ctx, val(tS, fs, 'ID_CLIENTE'));
  bitacora(ctx, p.usuario, 'CAMBIAR_PLAN', 'Servicios', p.idServ, p.plan + ' ' + soles(tarifa) + ', ' + n + ' cuotas');
  return { idServ: p.idServ, cuotasActualizadas: n, tarifa: tarifa };
}

/** Registra un cambio de estado en HistorialEstados. */
function registrarHistorial(ctx, idCli, idServ, ant, nuevo, motivo, fecha, usuario) {
  var ic = buscar(ctx, 'Clientes', 'ID_CLIENTE', idCli);
  nuevaFila(ctx, 'HistorialEstados', {
    ID_HIST: siguienteId(ctx, 'HistorialEstados', 'ID_HIST', 'HST-', 6), FECHA: deDia(aDia(fecha)),
    ID_CLIENTE: idCli, CLIENTE: ic < 0 ? '' : val(ctx.t('Clientes'), ic, 'NOMBRES'), ID_SERV: idServ,
    ESTADO_ANT: ant, ESTADO_NUEVO: nuevo, MOTIVO: String(motivo || '').substr(0, 250), USUARIO: usuario,
    F_REGISTRO: new Date()
  });
}

// ---- Versiones públicas ----------------------------------------------------------------
function renovarAnio(anio, usuario) {
  return transaccion(function (ctx) { return op_renovarAnio(ctx, { anio: anio, usuario: usuario || usuarioActual() }); });
}
function cambiarPlan(idServ, plan, modo, tarifa, desde, usuario) {
  return transaccion(function (ctx) {
    return op_cambiarPlan(ctx, { idServ: idServ, plan: plan, modo: modo, tarifa: tarifa, desde: desde, usuario: usuario || usuarioActual() });
  });
}
