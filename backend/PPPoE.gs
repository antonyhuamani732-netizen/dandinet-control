/**
 * PPPoE (punto crítico), traducción de modPPPoE
 * --------------------------------------------------------------------------
 * Estados: Disponible / Asignado / Bloqueado.
 * Regla estricta: un código solo puede estar asignado a UN servicio a la vez.
 * Doble verificación: contra el inventario Y contra la tabla Servicios.
 * Todo movimiento queda en HistPPPoE (quién lo tuvo y entre qué fechas).
 */

/** Asigna un código a un servicio (con validación estricta). */
function asignarPPPoE_(ctx, codigo, idServ, fecha, usuario) {
  codigo = String(codigo || '').trim();
  if (!codigo) throw errNeg('Código PPPoE vacío.');
  var tP = ctx.t('PPPoE'), tS = ctx.t('Servicios');
  var fp = buscar(ctx, 'PPPoE', 'CODIGO', codigo);
  if (fp < 0) throw errNeg('El código PPPoE ' + codigo + ' no existe en el inventario.');
  var fs = buscar(ctx, 'Servicios', 'ID_SERV', idServ);
  if (fs < 0) throw errNeg('Servicio ' + idServ + ' no encontrado.');
  var est = String(val(tP, fp, 'ESTADO'));
  if (est === P_ASIGNADO) throw errNeg('El código PPPoE ' + codigo + ' YA ESTÁ ASIGNADO a ' + val(tP, fp, 'ID_CLIENTE') + ' ' +
    val(tP, fp, 'CLIENTE') + ' (' + val(tP, fp, 'ID_SERV') + '). Primero debe liberarse (corte o baja de ese cliente).');
  if (est === P_BLOQUEADO) throw errNeg('El código PPPoE ' + codigo + ' está BLOQUEADO. Desbloquéelo primero.');
  // doble verificación: ningún otro servicio lo tiene registrado
  buscarTodos(ctx, 'Servicios', 'PPPOE', codigo).forEach(function (i) {
    if (i !== fs) throw errNeg('Inconsistencia: el servicio ' + val(tS, i, 'ID_SERV') + ' ya tiene el código ' + codigo + '.');
  });
  var actual = String(val(tS, fs, 'PPPOE'));
  if (actual && actual !== codigo) throw errNeg('El servicio ' + idServ + ' ya tiene el PPPoE ' + actual + '. Libérelo antes de asignar otro.');

  setV(ctx, 'PPPoE', fp, 'ESTADO', P_ASIGNADO);
  setV(ctx, 'PPPoE', fp, 'ID_SERV', idServ);
  setV(ctx, 'PPPoE', fp, 'ID_CLIENTE', val(tS, fs, 'ID_CLIENTE'));
  setV(ctx, 'PPPoE', fp, 'CLIENTE', val(tS, fs, 'CLIENTE'));
  setV(ctx, 'PPPoE', fp, 'F_ASIGNACION', deDia(aDia(fecha)));
  setV(ctx, 'Servicios', fs, 'PPPOE', codigo);
  nuevaFila(ctx, 'HistPPPoE', {
    ID_HPPP: siguienteId(ctx, 'HistPPPoE', 'ID_HPPP', 'HPP-', 6), CODIGO: codigo, ID_CLIENTE: val(tS, fs, 'ID_CLIENTE'),
    CLIENTE: val(tS, fs, 'CLIENTE'), ID_SERV: idServ, F_DESDE: deDia(aDia(fecha)), F_HASTA: '', MOTIVO_FIN: '',
    OBS: 'Asignado por ' + usuario
  });
  tocar(ctx, val(tS, fs, 'ID_CLIENTE'));
}

/** Libera el código (vuelve a Disponible), lo quita de los servicios y cierra su historial. */
function liberarPPPoE_(ctx, codigo, fecha, motivo) {
  var tP = ctx.t('PPPoE'), tS = ctx.t('Servicios'), tH = ctx.t('HistPPPoE');
  var fp = buscar(ctx, 'PPPoE', 'CODIGO', codigo);
  if (fp < 0) throw errNeg('El código ' + codigo + ' no existe.');
  var idServ = String(val(tP, fp, 'ID_SERV')), idCli = String(val(tP, fp, 'ID_CLIENTE')), cli = val(tP, fp, 'CLIENTE');
  buscarTodos(ctx, 'Servicios', 'PPPOE', codigo).forEach(function (i) {      // todos, por seguridad
    setV(ctx, 'Servicios', i, 'PPPOE_ANT', codigo);
    setV(ctx, 'Servicios', i, 'PPPOE', '');
    if (!idServ) { idServ = String(val(tS, i, 'ID_SERV')); idCli = String(val(tS, i, 'ID_CLIENTE')); cli = val(tS, i, 'CLIENTE'); }
  });
  // cerrar el último historial abierto de ese código
  var cerrado = false;
  for (var i = tH.datos.length - 1; i >= 0; i--) {
    if (String(val(tH, i, 'CODIGO')) === String(codigo) && val(tH, i, 'F_HASTA') === '') {
      setV(ctx, 'HistPPPoE', i, 'F_HASTA', deDia(aDia(fecha)));
      setV(ctx, 'HistPPPoE', i, 'MOTIVO_FIN', String(motivo).substr(0, 120));
      cerrado = true; break;
    }
  }
  if (!cerrado && idServ) {
    nuevaFila(ctx, 'HistPPPoE', {
      ID_HPPP: siguienteId(ctx, 'HistPPPoE', 'ID_HPPP', 'HPP-', 6), CODIGO: codigo, ID_CLIENTE: idCli, CLIENTE: cli,
      ID_SERV: idServ, F_DESDE: '', F_HASTA: deDia(aDia(fecha)), MOTIVO_FIN: String(motivo).substr(0, 120),
      OBS: 'Cierre sin registro de inicio'
    });
  }
  setV(ctx, 'PPPoE', fp, 'ESTADO', P_DISPONIBLE);
  ['ID_SERV', 'ID_CLIENTE', 'CLIENTE', 'F_ASIGNACION'].forEach(function (c) { setV(ctx, 'PPPoE', fp, c, ''); });
  tocar(ctx, idCli);
  return { codigo: codigo, idServ: idServ, idCliente: idCli };
}

function op_asignarPPPoE(ctx, p) {
  exigirRol(ctx, p.usuario, ['ADMIN']);
  asignarPPPoE_(ctx, p.codigo, p.idServ, p.fecha || hoyDia(), p.usuario);
  bitacora(ctx, p.usuario, 'ASIGNAR_PPPOE', 'PPPoE', p.codigo, 'a ' + p.idServ);
  return { codigo: p.codigo, idServ: p.idServ };
}

function op_liberarPPPoE(ctx, p) {
  exigirRol(ctx, p.usuario, ['ADMIN']);
  var fp = buscar(ctx, 'PPPoE', 'CODIGO', p.codigo);
  if (fp < 0) throw errNeg('El código ' + p.codigo + ' no existe.');
  if (String(val(ctx.t('PPPoE'), fp, 'ESTADO')) !== P_ASIGNADO) throw errNeg('El código ' + p.codigo + ' no está asignado.');
  var motivo = String(p.motivo || 'Liberación manual');
  var r = liberarPPPoE_(ctx, p.codigo, p.fecha || hoyDia(), motivo);
  bitacora(ctx, p.usuario, 'LIBERAR_PPPOE', 'PPPoE', p.codigo, motivo + ' (era de ' + r.idServ + ')');
  return r;
}

function op_bloquearPPPoE(ctx, p) {
  exigirRol(ctx, p.usuario, ['ADMIN']);
  var t = ctx.t('PPPoE'), f = buscar(ctx, 'PPPoE', 'CODIGO', p.codigo);
  if (f < 0) throw errNeg('Código no encontrado.');
  var est = String(val(t, f, 'ESTADO'));
  if (p.bloquear) {
    if (est === P_ASIGNADO) throw errNeg('No se puede bloquear: está asignado a ' + val(t, f, 'CLIENTE') + '.');
    if (est === P_BLOQUEADO) throw errNeg('El código ya está bloqueado.');
    setV(ctx, 'PPPoE', f, 'ESTADO', P_BLOQUEADO);
  } else {
    if (est !== P_BLOQUEADO) throw errNeg('El código no está bloqueado.');
    setV(ctx, 'PPPoE', f, 'ESTADO', P_DISPONIBLE);
  }
  setV(ctx, 'PPPoE', f, 'OBS', ((p.bloquear ? 'Bloqueado ' : 'Desbloqueado ') + txtFecha(hoyDia()) + ': ' + (p.motivo || '')).substr(0, 250));
  bitacora(ctx, p.usuario, p.bloquear ? 'BLOQUEAR_PPPOE' : 'DESBLOQUEAR_PPPOE', 'PPPoE', p.codigo, p.motivo || '');
  return { codigo: p.codigo, estado: p.bloquear ? P_BLOQUEADO : P_DISPONIBLE };
}

function op_agregarCodigoPPPoE(ctx, p) {
  exigirRol(ctx, p.usuario, ['ADMIN']);
  var codigo = String(p.codigo || '').trim();
  if (!codigo) throw errNeg('Ingrese el código.');
  if (buscar(ctx, 'PPPoE', 'CODIGO', codigo) >= 0) throw errNeg('El código ' + codigo + ' ya existe en el inventario.');
  nuevaFila(ctx, 'PPPoE', { CODIGO: codigo, TITULAR: String(p.titular || '').trim().toUpperCase(), ESTADO: P_DISPONIBLE,
    OBS: 'Alta ' + txtFecha(hoyDia()) });
  bitacora(ctx, p.usuario, 'AGREGAR_PPPOE', 'PPPoE', codigo, 'Titular: ' + (p.titular || ''));
  return { codigo: codigo };
}

/** Lista de códigos disponibles. */
function pppoeDisponibles(ctx) {
  var t = ctx.t('PPPoE');
  return t.datos.filter(function (f) { return String(f[t.c.ESTADO]) === P_DISPONIBLE; }).map(function (f) { return String(f[t.c.CODIGO]); });
}

// ---- Versiones públicas ----------------------------------------------------------------
function asignarPPPoE(codigo, idServ, fecha, usuario) {
  return transaccion(function (ctx) { return op_asignarPPPoE(ctx, { codigo: codigo, idServ: idServ, fecha: fecha, usuario: usuario || usuarioActual() }); });
}
function liberarPPPoE(codigo, motivo, usuario) {
  return transaccion(function (ctx) { return op_liberarPPPoE(ctx, { codigo: codigo, motivo: motivo, usuario: usuario || usuarioActual() }); });
}
function bloquearPPPoE(codigo, bloquear, motivo, usuario) {
  return transaccion(function (ctx) { return op_bloquearPPPoE(ctx, { codigo: codigo, bloquear: bloquear !== false, motivo: motivo, usuario: usuario || usuarioActual() }); });
}
