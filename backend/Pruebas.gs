/**
 * PRUEBAS DE ACEPTACIÓN DEL BACKEND (Fase 2)
 * --------------------------------------------------------------------------
 * El MISMO código corre en dos lugares:
 *   - En la PC: pruebas-local/fase2.js (simulador de Google Sheets).
 *   - En Google: correrPruebasEnGoogle() (solo en el proyecto de PRUEBAS).
 *
 * Nunca toca el libro real: crea un LIBRO DESECHABLE "DANDINET_PRUEBA_AUTOMATICA_…" dentro de
 * DANDINET_PRUEBAS/Pruebas automáticas, importa migracion.json ahí, prueba todo y al final lo
 * manda a la papelera de Drive.
 *
 * Como Google corta cada ejecución a los 6 minutos, las pruebas van en PASOS. Si se acaba el
 * tiempo, se guarda el avance y la siguiente llamada a correrPruebasEnGoogle() continúa.
 */

var PRUEBA_HOY = '2026-10-15';
var PU = {   // usuarios de prueba (solo existen en el libro desechable)
  ADMIN: 'admin@prueba.local', COB1: 'cobrador1@prueba.local', COB2: 'cobrador2@prueba.local',
  COB3: 'cobrador3@prueba.local', ROLCOB: 'rol.cobrador@prueba.local', INACTIVO: 'inactivo@prueba.local'
};

// ============================================================================
// MINI MARCO DE PRUEBAS
// ============================================================================
var _P = null;
function P_nuevo_() { return { total: 0, fallos: 0, casos: [], log: [] }; }
function P_caso_(titulo) { _P.casos.push({ caso: titulo, checks: [] }); _P.log.push('\n== ' + titulo); }
function P_check_(ok, txt) {
  ok = !!ok; _P.total++; if (!ok) _P.fallos++;
  _P.casos[_P.casos.length - 1].checks.push([ok, txt]);
  _P.log.push((ok ? '  OK    ' : '  FALLO ') + txt);
}
function P_info_(txt) { _P.log.push('  ' + txt); }

/** Filas de una tabla como objetos (lectura fresca de la hoja). */
function T_filas_(n) {
  var t = leerTabla(n);
  return t.datos.map(function (f) { var o = {}; t.enc.forEach(function (c, j) { o[c] = f[j]; }); return o; });
}
function T_fila_(n, col, v) { return T_filas_(n).filter(function (r) { return String(r[col]) === String(v); })[0]; }
function T_cfg_(k) { var r = T_fila_('Config', 'CLAVE', k); return r ? String(r.VALOR) : ''; }
function T_resumen_(id) { return T_fila_('ResumenCliente', 'ID_CLIENTE', id); }
function T_cargosDe_(id) {
  return T_filas_('Cargos').filter(function (c) { return c.ID_CLIENTE === id; }).sort(function (a, b) { return aDia(a.PERIODO) - aDia(b.PERIODO); });
}
function T_pendientes_(id) { return T_cargosDe_(id).filter(function (c) { return c.ANULADO !== SI && num(c.SALDO) > 0; }); }
function T_suma_(arr, f) { var s = 0; arr.forEach(function (x) { s += f(x); }); return r2(s); }

/** Llama a la API como lo hará la app. extra: { id, fDispositivo, origen } */
function T_api_(accion, datos, email, extra) {
  extra = extra || {};
  var id = extra.id || (ACCIONES[accion] && ACCIONES[accion].tipo === 'escritura' ? Utilities.getUuid() : '');
  var r = ejecutarAccion(accion, datos, email, id, extra);
  r._id = id;
  return r;
}

// ============================================================================
// PASOS (S = estado compartido entre pasos; solo textos y números)
// ============================================================================
var PASOS_PRUEBA = [

  function preparar_(S) {
    P_caso_('0. Libro desechable, migración y cuadre');
    var fE = archivoDrive_('esperado.json');
    var cuad = verificarCuadre(fE.getId()).split('\n')[0];
    P_check_(cuad === 'CUADRA', 'la copia importada cuadra con el Excel: ' + cuad);
    P_check_(T_cfg_('UltRecibo') === '115', 'UltRecibo = 115');
    agregarFilas('Usuarios', [
      [PU.ADMIN, 'Admin Prueba', 'ADMIN', '*', 'AP', SI],
      [PU.COB1, 'Cobrador Uno', 'ADMIN', '*', 'C1', SI],
      [PU.COB2, 'Cobrador Dos', 'ADMIN', '*', 'C2', SI],
      [PU.COB3, 'Cobrador Tres', 'ADMIN', '*', 'C3', SI],
      [PU.ROLCOB, 'Rol Cobrador (futuro)', 'COBRADOR', 'CUBANTIA', 'RC', SI],
      [PU.INACTIVO, 'Usuario Inactivo', 'ADMIN', '*', 'UI', NO]
    ]);
    var res = T_filas_('ResumenCliente'), srv = T_filas_('Servicios');
    var cand = res.filter(function (r) {
      return r.ESTADO === E_MOROSO && num(r.MESES_ADEUDA) >= 3 && num(r.SERV_ACTIVOS) === 1 && r.PPPOE &&
        srv.filter(function (s) { return s.ID_CLIENTE === r.ID_CLIENTE; }).length === 1;
    }).sort(function (a, b) { return b.MESES_ADEUDA - a.MESES_ADEUDA; });
    S.A = cand[0].ID_CLIENTE; S.B = cand[1].ID_CLIENTE; S.C = cand[2].ID_CLIENTE; S.D = cand[3].ID_CLIENTE;
    S.DNI_CERO = (T_filas_('Clientes').filter(function (r) { return /^0\d{7}$/.test(r.DNI_RUC); })[0] || {}).DNI_RUC;
    P_info_('Clientes de prueba: A=' + S.A + ', B=' + S.B + ', C=' + S.C + ', D=' + S.D);
  },

  function caso1_(S) {
    P_caso_('1. Pago de 1 mes → R-000116');
    var pA = T_pendientes_(S.A);
    var r = T_api_('registrarPago', { idCliente: S.A, idsCargos: [pA[0].ID_CARGO], monto: num(pA[0].SALDO), metodo: 'Yape', operacion: '123456' }, PU.COB1);
    P_check_(r.ok && r.datos.estado === 'Válido' && r.datos.nroRecibo === 'R-000116', 'respuesta ok, recibo ' + (r.datos && r.datos.nroRecibo) + (r.ok ? '' : ' · ' + r.error));
    P_check_(T_fila_('Cargos', 'ID_CARGO', pA[0].ID_CARGO).ESTADO === C_PAGADO, 'el mes queda Pagado');
    P_check_(T_cfg_('UltRecibo') === '116', 'Config.UltRecibo = 116');
    var p = T_fila_('Pagos', 'N_RECIBO', 'R-000116');
    P_check_(p && p.USUARIO === PU.COB1 && p.ORIGEN === 'online' && p.OPERACION === '123456' && p.F_REGISTRO instanceof Date && p.ID_SOLICITUD === r._id,
      'recibo con usuario, origen online, N° de operación, fecha de registro e ID_SOLICITUD');
    P_check_(T_fila_('Solicitudes', 'ID_SOLICITUD', r._id), 'la solicitud queda anotada en Solicitudes');
    P_check_(T_filas_('Bitacora').some(function (b) { return b.ACCION === 'PAGO' && b.ID_ENTIDAD === 'R-000116' && b.ID_SOLICITUD === r._id && b.USUARIO === PU.COB1; }),
      'queda en la Bitácora con usuario e ID_SOLICITUD');
  },

  function caso2_(S) {
    P_caso_('2. Pago de varios meses');
    var pA = T_pendientes_(S.A);
    var r = T_api_('registrarPago', { idCliente: S.A, idsCargos: [pA[0].ID_CARGO, pA[1].ID_CARGO], monto: r2(num(pA[0].SALDO) + num(pA[1].SALDO)), metodo: 'Efectivo' }, PU.COB1);
    P_check_(r.ok && r.datos.nroRecibo === 'R-000117', 'recibo ' + (r.datos && r.datos.nroRecibo));
    P_check_([pA[0], pA[1]].every(function (c) { return T_fila_('Cargos', 'ID_CARGO', c.ID_CARGO).ESTADO === C_PAGADO; }), 'los 2 meses quedan Pagados');
    P_check_(T_filas_('PagosDet').filter(function (d) { return d.N_RECIBO === 'R-000117'; }).length === 2, '2 líneas de detalle');
  },

  function caso3_(S) {
    P_caso_('3. Pago parcial y luego el saldo');
    var c = T_pendientes_(S.A)[0];
    var r = T_api_('registrarPago', { idCliente: S.A, idsCargos: [c.ID_CARGO], monto: r2(num(c.SALDO) - 10), metodo: 'Efectivo' }, PU.COB1);
    var c2 = T_fila_('Cargos', 'ID_CARGO', c.ID_CARGO);
    P_check_(r.ok && r.datos.nroRecibo === 'R-000118' && c2.ESTADO === C_PARCIAL && Math.abs(num(c2.SALDO) - 10) < 0.001,
      'R-000118, el mes queda Parcial con saldo ' + c2.SALDO + ' (ej.: cliente DUO que paga solo el cable)');
    P_check_(/parcial/.test(T_fila_('Pagos', 'N_RECIBO', 'R-000118').PERIODOS), 'el texto del recibo dice "parcial"');
    P_check_(r.datos.saldoRestante > 0, 'la respuesta trae el saldo restante del cliente: ' + r.datos.saldoRestante);
    r = T_api_('registrarPago', { idCliente: S.A, idsCargos: [c.ID_CARGO], monto: 10, metodo: 'Efectivo' }, PU.COB1);
    P_check_(r.ok && r.datos.nroRecibo === 'R-000119' && T_fila_('Cargos', 'ID_CARGO', c.ID_CARGO).ESTADO === C_PAGADO, 'R-000119 paga el saldo → Pagado');
  },

  function caso4_(S) {
    P_caso_('4. Pago adelantado sin afectar la deuda vencida');
    var fut = T_cargosDe_(S.A).filter(function (c) { return c.ANULADO !== SI && num(c.SALDO) > 0 && aDia(c.PERIODO) > aDia('2026-10-31'); })[0];
    var dv = num(T_resumen_(S.A).DEUDA_VENCIDA);
    var r = T_api_('registrarPago', { idCliente: S.A, idsCargos: [fut.ID_CARGO], monto: num(fut.SALDO), metodo: 'Plin' }, PU.COB1);
    P_check_(r.ok && T_fila_('Cargos', 'ID_CARGO', fut.ID_CARGO).ESTADO === C_PAGADO, 'adelanto de ' + txtPeriodo(aDia(fut.PERIODO)) + ' → ' + (r.datos && r.datos.nroRecibo));
    P_check_(num(T_resumen_(S.A).DEUDA_VENCIDA) === dv, 'deuda vencida sin cambio (' + dv + ')');
  },

  function caso5_(S) {
    P_caso_('5. Doble pago rechazado sin consumir correlativo');
    var ult = T_cfg_('UltRecibo');
    var pagado = T_filas_('PagosDet').filter(function (d) { return d.N_RECIBO === 'R-000116'; })[0].ID_CARGO;
    var r = T_api_('registrarPago', { idCliente: S.A, idsCargos: [pagado], monto: 25, metodo: 'Efectivo' }, PU.COB1);
    P_check_(!r.ok && r.codigoError === 'VALIDACION' && /YA ESTÁ PAGADO/.test(r.error), 'mes ya pagado → VALIDACION: ' + r.error);
    P_check_(T_cfg_('UltRecibo') === ult, 'UltRecibo sigue en ' + ult);
    var r2b = T_api_('registrarPago', { idCliente: S.A, idsCargos: [pagado], monto: 25, metodo: 'Efectivo' }, PU.COB1, { id: r._id });
    P_check_(!r2b.ok && r2b.repetido === true && r2b.error === r.error, 'reintentar el mismo idSolicitud devuelve el mismo rechazo (guardado en Solicitudes)');
  },

  function caso6_(S) {
    P_caso_('6. Monto mayor, fecha futura, método inválido: rechazados');
    var ult = T_cfg_('UltRecibo'), c = T_pendientes_(S.A)[0];
    var base = function (o) { var d = { idCliente: S.A, idsCargos: [c.ID_CARGO], monto: num(c.SALDO), metodo: 'Efectivo' }; for (var k in o) d[k] = o[k]; return d; };
    var r = T_api_('registrarPago', base({ monto: num(c.SALDO) + 50 }), PU.COB1);
    P_check_(!r.ok && /supera el saldo/.test(r.error), 'monto mayor al saldo → rechazado');
    r = T_api_('registrarPago', base({ fechaPago: '2026-10-20' }), PU.COB1);
    P_check_(!r.ok && /futura/.test(r.error), 'fecha futura → rechazado');
    r = T_api_('registrarPago', base({ metodo: 'Bitcoin' }), PU.COB1);
    P_check_(!r.ok && /Método/.test(r.error), 'método fuera de la lista → rechazado');
    r = T_api_('registrarPago', base({ metodo: 'MIGRADO' }), PU.COB1);
    P_check_(!r.ok, '"MIGRADO" no se acepta para pagos nuevos');
    P_check_(T_cfg_('UltRecibo') === ult, 'ningún rechazo consumió número');
  },

  function caso7_(S) {
    P_caso_('7. Idempotencia y correlativo: mismo idSolicitud 3 veces, 10 cobros de 3 usuarios');
    var c = T_pendientes_(S.B)[0], id = Utilities.getUuid();
    var datos = { idCliente: S.B, idsCargos: [c.ID_CARGO], monto: num(c.SALDO), metodo: 'Efectivo' };
    var r1 = T_api_('registrarPago', datos, PU.COB2, { id: id });
    var r2x = T_api_('registrarPago', datos, PU.COB2, { id: id });
    var r3 = T_api_('registrarPago', datos, PU.COB2, { id: id });
    P_check_(r1.ok && r2x.ok && r3.ok && r1.datos.nroRecibo === r2x.datos.nroRecibo && r2x.datos.nroRecibo === r3.datos.nroRecibo,
      'las 3 respuestas traen el mismo recibo ' + r1.datos.nroRecibo);
    P_check_(!r1.repetido && r2x.repetido === true && r3.repetido === true, 'la 2.ª y la 3.ª se marcan como repetidas');
    P_check_(T_filas_('Pagos').filter(function (p) { return p.ID_SOLICITUD === id; }).length === 1 &&
      T_filas_('Solicitudes').filter(function (s) { return s.ID_SOLICITUD === id; }).length === 1, 'un solo pago y una sola solicitud');
    // 10 cobros de 3 usuarios (en Google, la concurrencia REAL se prueba aparte con pruebaConcurrencia)
    var usuarios = [PU.COB1, PU.COB2, PU.COB3], hechos = 0, clientes = [S.C, S.D, S.B];
    for (var k = 0; k < 10; k++) {
      var cli = clientes[k % 3], cc = T_pendientes_(cli)[0];
      var rr = T_api_('registrarPago', { idCliente: cli, idsCargos: [cc.ID_CARGO], monto: Math.min(5, num(cc.SALDO)), metodo: 'Efectivo' }, usuarios[k % 3]);
      if (rr.ok) hechos++;
    }
    P_check_(hechos === 10, '10 cobros procesados (' + hechos + ')');
    var nros = T_filas_('Pagos').map(function (p) { return String(p.N_RECIBO); }).filter(function (n) { return n.indexOf('R-') === 0; })
      .map(function (n) { return +n.slice(2); }).sort(function (a, b) { return a - b; });
    var unicos = {}; nros.forEach(function (n) { unicos[n] = 1; });
    P_check_(Object.keys(unicos).length === nros.length && nros.every(function (n, i) { return n === 116 + i; }),
      'recibos R-000116…R-' + ('00000' + nros[nros.length - 1]).slice(-6) + ': sin duplicados ni saltos');
  },

  function caso8_(S) {
    P_caso_('8. Cobros sin señal: cola enviada al volver la conexión');
    var p = T_pendientes_(S.C);
    var ops = [
      { accion: 'registrarPago', idSolicitud: Utilities.getUuid(), fDispositivo: '2026-10-14T17:30:00-05:00',
        datos: { idCliente: S.C, idsCargos: [p[0].ID_CARGO], monto: num(p[0].SALDO), metodo: 'Efectivo' } },
      { accion: 'registrarPago', idSolicitud: Utilities.getUuid(), fDispositivo: '2026-10-14T17:45:00-05:00',
        datos: { idCliente: S.C, idsCargos: [p[1].ID_CARGO], monto: num(p[1].SALDO), metodo: 'Yape', operacion: '998877' } }
    ];
    var r = ejecutarAccion('procesarCola', { operaciones: ops }, PU.COB3);
    var res = r.datos.resultados;
    P_check_(r.ok && res.length === 2 && res[0].ok && res[1].ok, 'la cola se procesó: 2 recibos oficiales');
    var n0 = +res[0].datos.nroRecibo.slice(2), n1 = +res[1].datos.nroRecibo.slice(2);
    P_check_(n1 === n0 + 1, 'en el orden en que se cobraron (' + res[0].datos.nroRecibo + ', ' + res[1].datos.nroRecibo + ')');
    var pg = T_fila_('Pagos', 'N_RECIBO', res[0].datos.nroRecibo);
    P_check_(aDia(pg.FECHA) === aDia('2026-10-14') && pg.ORIGEN === 'offline' && pg.F_DISPOSITIVO instanceof Date,
      'el recibo lleva la fecha REAL del cobro (14/10), origen offline y la hora del celular');
    var r2x = ejecutarAccion('procesarCola', { operaciones: ops }, PU.COB3);
    P_check_(r2x.datos.resultados.every(function (x) { return x.repetido; }) && T_filas_('Pagos').filter(function (q) { return q.ID_SOLICITUD === ops[0].idSolicitud; }).length === 1,
      'reenviar la misma cola (señal intermitente) no duplica nada');
    var malo = ejecutarAccion('procesarCola', { operaciones: [{ accion: 'perfil', idSolicitud: 'x' }] }, PU.COB3);
    P_check_(malo.datos.resultados[0].codigoError === 'ACCION_DESCONOCIDA', 'la cola solo acepta acciones de escritura');
  },

  function caso9_(S) {
    P_caso_('9. Conflicto sin señal: dos cobradores cobran el mismo mes → uno Válido y otro "A revisar"');
    var c = T_pendientes_(S.D)[0], ult;
    var op = function (u, metodo) {
      return { accion: 'registrarPago', idSolicitud: Utilities.getUuid(), fDispositivo: '2026-10-15T09:00:00-05:00',
        datos: { idCliente: S.D, idsCargos: [c.ID_CARGO], monto: num(c.SALDO), metodo: metodo } };
    };
    var o1 = op(PU.COB1, 'Efectivo'), o2 = op(PU.COB2, 'Yape');
    var r1 = ejecutarAccion('procesarCola', { operaciones: [o1] }, PU.COB1).datos.resultados[0];
    ult = T_cfg_('UltRecibo');
    var r2x = ejecutarAccion('procesarCola', { operaciones: [o2] }, PU.COB2).datos.resultados[0];
    P_check_(r1.ok && r1.datos.estado === 'Válido', 'el primero que sincroniza: Válido ' + r1.datos.nroRecibo);
    P_check_(r2x.ok && r2x.datos.estado === 'A revisar' && r2x.datos.nroRecibo === '', 'el segundo NO se rechaza: queda "A revisar", sin número');
    P_check_(T_cfg_('UltRecibo') === ult, 'el conflicto no consumió número de recibo');
    var rev = T_fila_('PagosRevisar', 'ID_SOLICITUD', o2.idSolicitud);
    P_check_(rev && rev.ESTADO === 'A revisar' && rev.USUARIO === PU.COB2 && num(rev.MONTO) === num(c.SALDO) && /PAGADO/.test(rev.MOTIVO_CONFLICTO),
      'PagosRevisar guarda cobrador, monto y motivo: ' + (rev && rev.MOTIVO_CONFLICTO));
    var r3 = ejecutarAccion('procesarCola', { operaciones: [o2] }, PU.COB2).datos.resultados[0];
    P_check_(r3.repetido && T_filas_('PagosRevisar').filter(function (x) { return x.ID_SOLICITUD === o2.idSolicitud; }).length === 1, 'reenviarlo no duplica la revisión');
    P_check_(T_filas_('Bitacora').some(function (b) { return b.RESULTADO === 'A_REVISAR' && b.ID_SOLICITUD === o2.idSolicitud; }), 'queda en la Bitácora como A_REVISAR');
    var caja = T_api_('misCobros', { fecha: '2026-10-15' }, PU.COB2);
    P_check_(caja.ok && caja.datos.totalARevisar === num(c.SALDO), 'en "Mis cobros" del cobrador 2 aparece el dinero a revisar (' + caja.datos.totalARevisar + ')');
    var perf = T_api_('perfil', {}, PU.ADMIN);
    P_check_(perf.ok && perf.datos.revisionesPendientes >= 1, 'el perfil del ADMIN avisa ' + perf.datos.revisionesPendientes + ' revisión(es) pendiente(s)');

    // ---- resolución ADELANTO ----
    var corto = T_api_('resolverRevision', { idRevision: o2.idSolicitud, resolucion: 'ADELANTO', motivo: 'ok' }, PU.ADMIN);
    P_check_(!corto.ok && /motivo/.test(corto.error), 'resolver sin motivo suficiente → rechazado');
    var rr = T_api_('resolverRevision', { idRevision: o2.idSolicitud, resolucion: 'ADELANTO', motivo: 'Cliente acepta adelanto' }, PU.ADMIN);
    P_check_(rr.ok && /^R-/.test(rr.datos.nroRecibo), 'ADELANTO: se emite el recibo ' + (rr.datos && rr.datos.nroRecibo) + (rr.ok ? '' : ' · ' + rr.error));
    var pg = rr.ok ? T_fila_('Pagos', 'N_RECIBO', rr.datos.nroRecibo) : {};
    P_check_(pg.USUARIO === PU.COB2 && aDia(pg.FECHA) === aDia('2026-10-15') && /Revisión ADELANTO/.test(pg.OBS),
      'el recibo queda a nombre del cobrador que recibió el dinero, con la fecha real del cobro');
    P_check_(T_fila_('PagosRevisar', 'ID_SOLICITUD', o2.idSolicitud).ESTADO === 'Resuelto', 'la revisión queda Resuelta');
    var otraVez = T_api_('resolverRevision', { idRevision: o2.idSolicitud, resolucion: 'DEVOLVER', motivo: 'probando' }, PU.ADMIN);
    P_check_(!otraVez.ok && /ya fue resuelto/.test(otraVez.error), 'no se puede resolver dos veces');

    // ---- resolución DEVOLVER ----
    var o3 = op(PU.COB3, 'Efectivo');
    ejecutarAccion('procesarCola', { operaciones: [o3] }, PU.COB3);
    var ultD = T_cfg_('UltRecibo');
    var rd = T_api_('resolverRevision', { idRevision: o3.idSolicitud, resolucion: 'DEVOLVER', motivo: 'Se devolvió el efectivo al cliente' }, PU.ADMIN);
    P_check_(rd.ok && rd.datos.nroRecibo === '' && T_cfg_('UltRecibo') === ultD, 'DEVOLVER: se cierra sin recibo ni número');

    // ---- resolución APLICAR ----
    var o4 = op(PU.COB1, 'Efectivo');
    ejecutarAccion('procesarCola', { operaciones: [o4] }, PU.COB1);
    var otro = T_pendientes_(S.D)[0];
    var ra = T_api_('resolverRevision', { idRevision: o4.idSolicitud, resolucion: 'APLICAR', idsCargos: [otro.ID_CARGO], motivo: 'Aplicar al mes siguiente' }, PU.ADMIN);
    P_check_(ra.ok && num(T_fila_('Cargos', 'ID_CARGO', otro.ID_CARGO).PAGADO) > 0,
      'APLICAR: el dinero va al mes que eligió el ADMIN → ' + (ra.datos && ra.datos.nroRecibo) + (ra.ok ? '' : ' · ' + ra.error));
  },

  function caso10_(S) {
    P_caso_('10. Anulación: recibo conservado, meses a pendiente, número no reutilizado');
    var sin = T_api_('anularPago', { nroRecibo: 'R-000116', motivo: '' }, PU.ADMIN);
    P_check_(!sin.ok && /motivo/.test(sin.error), 'sin motivo → rechazado');
    var ult = T_cfg_('UltRecibo');
    var r = T_api_('anularPago', { nroRecibo: 'R-000116', motivo: 'Cliente pagó a otra cuenta' }, PU.ADMIN);
    var p = T_fila_('Pagos', 'N_RECIBO', 'R-000116');
    P_check_(r.ok && p.ESTADO === 'Anulado' && /Cliente pagó/.test(p.MOTIVO_ANULACION) && p.F_ANULACION instanceof Date, 'recibo Anulado con motivo y fecha (no se borra)');
    var det = T_filas_('PagosDet').filter(function (d) { return d.N_RECIBO === 'R-000116'; });
    P_check_(det.every(function (d) { return d.ANULADO === SI; }), 'detalle anulado');
    P_check_(num(T_fila_('Cargos', 'ID_CARGO', det[0].ID_CARGO).SALDO) > 0, 'el mes vuelve a quedar pendiente');
    var nuevo = T_api_('registrarPago', { idCliente: S.A, idsCargos: [det[0].ID_CARGO], monto: 1, metodo: 'Efectivo' }, PU.COB1);
    P_check_(nuevo.ok && nuevo.datos.nroRecibo === 'R-' + ('00000' + (+ult + 1)).slice(-6), 'el siguiente recibo es ' + nuevo.datos.nroRecibo + ': el 116 no se reutiliza');
  },

  function caso11_(S) {
    P_caso_('11. Corte: PPPoE libre con historial, deuda conservada, cuotas futuras anuladas, WhatsApp');
    var sB = T_filas_('Servicios').filter(function (s) { return s.ID_CLIENTE === S.B; })[0];
    S.SB = sB.ID_SERV; S.PPPB = String(sB.PPPOE);
    var dv = num(T_resumen_(S.B).DEUDA_VENCIDA);
    var r = T_api_('cambiarEstadoServicio', { idServ: S.SB, tipo: 'CORTE', fecha: '2026-10-15', motivo: 'Falta de pago' }, PU.ADMIN);
    P_check_(r.ok, 'corte procesado' + (r.ok ? '' : ': ' + r.error));
    var s = T_fila_('Servicios', 'ID_SERV', S.SB);
    P_check_(s.ESTADO === E_CORTADO && s.PPPOE === '' && String(s.PPPOE_ANT) === S.PPPB, 'servicio Cortado, sin PPPoE, PPPOE_ANT guardado');
    P_check_(T_fila_('PPPoE', 'CODIGO', S.PPPB).ESTADO === P_DISPONIBLE, 'PPPoE ' + S.PPPB + ' → Disponible');
    P_check_(T_filas_('HistPPPoE').filter(function (h) { return String(h.CODIGO) === S.PPPB; }).every(function (h) { return h.F_HASTA !== ''; }), 'historial del PPPoE cerrado');
    P_check_(num(T_resumen_(S.B).DEUDA_VENCIDA) === dv && T_resumen_(S.B).ESTADO === E_CORTADO, 'deuda vencida conservada (' + dv + '), cliente Cortado');
    var fut = T_cargosDe_(S.B).filter(function (c) { return aDia(c.PERIODO) >= aDia('2026-11-01'); });
    P_check_(fut.length > 0 && fut.every(function (c) { return c.ANULADO === SI || num(c.PAGADO) > 0; }), fut.length + ' cuotas futuras anuladas (las adelantadas se mantienen)');
    var oct = T_cargosDe_(S.B).filter(function (c) { return aDia(c.PERIODO) === aDia('2026-10-01'); })[0];
    P_check_(!oct || oct.ANULADO === NO, 'por defecto se cobra el mes del corte (octubre se mantiene)');
    P_check_(r.datos.mensajeWhatsApp && /CORTADO/.test(r.datos.mensajeWhatsApp), 'mensaje de WhatsApp listo');
  },

  function caso12_(S) {
    P_caso_('12. PPPoE: asignar uno ya asignado o bloqueado → rechazado');
    var asig = T_filas_('PPPoE').filter(function (p) { return p.ESTADO === P_ASIGNADO; })[0];
    var r = T_api_('pppoe', { op: 'asignar', codigo: String(asig.CODIGO), idServ: S.SB }, PU.ADMIN);
    P_check_(!r.ok && /YA ESTÁ ASIGNADO/.test(r.error), 'ya asignado → rechazado');
    var libre = T_filas_('PPPoE').filter(function (p) { return p.ESTADO === P_DISPONIBLE && String(p.CODIGO) !== S.PPPB; })[0];
    P_check_(T_api_('pppoe', { op: 'bloquear', codigo: String(libre.CODIGO), motivo: 'Cuenta suspendida por el proveedor' }, PU.ADMIN).ok, 'bloquear ' + libre.CODIGO);
    r = T_api_('pppoe', { op: 'asignar', codigo: String(libre.CODIGO), idServ: S.SB }, PU.ADMIN);
    P_check_(!r.ok && /BLOQUEADO/.test(r.error), 'bloqueado → rechazado');
    P_check_(!T_api_('pppoe', { op: 'bloquear', codigo: String(asig.CODIGO), motivo: 'xxxx' }, PU.ADMIN).ok, 'no se puede bloquear uno asignado');
    P_check_(T_api_('pppoe', { op: 'desbloquear', codigo: String(libre.CODIGO), motivo: 'Proveedor lo reactivó' }, PU.ADMIN).ok, 'desbloquear');
    var rep = T_api_('reportePPPoE', {}, PU.ADMIN);
    P_check_(rep.ok && rep.datos.codigos.length === 35 && rep.datos.inconsistencias.length >= 3, 'reporte PPPoE: 35 códigos y ' + rep.datos.inconsistencias.length + ' inconsistencias heredadas');
  },

  function caso13_(S) {
    P_caso_('13. Reactivación: PPPoE asignado y cuotas regeneradas');
    var r = T_api_('reactivarServicio', { idServ: S.SB, fecha: '2026-10-15', codigoPPPoE: S.PPPB, motivo: 'Pagó parte de la deuda' }, PU.ADMIN);
    P_check_(r.ok, 'reactivación procesada' + (r.ok ? '' : ': ' + r.error));
    var s = T_fila_('Servicios', 'ID_SERV', S.SB);
    P_check_(s.ESTADO === E_ACTIVO && String(s.PPPOE) === S.PPPB, 'servicio Activo con su PPPoE anterior');
    P_check_(T_fila_('PPPoE', 'CODIGO', S.PPPB).ESTADO === P_ASIGNADO, 'inventario: Asignado');
    P_check_(T_cargosDe_(S.B).filter(function (c) { var d = aDia(c.PERIODO); return d >= aDia('2026-11-01') && d <= aDia('2026-12-01'); })
      .every(function (c) { return c.ANULADO === NO; }), 'cuotas nov–dic reutilizadas');
    P_check_(T_filas_('Cargos').filter(function (c) { return c.ID_SERV === S.SB && c.CONCEPTO === 'MENSUALIDAD' && aDia(c.PERIODO) === aDia('2026-11-01'); }).length === 1, 'sin cuotas duplicadas');
    P_check_(/deuda/.test(r.datos.aviso) || r.datos.deuda === 0, 'avisa la deuda pendiente');
  },

  function caso14_(S) {
    P_caso_('14. Clientes: alta con validaciones, servicio, edición con trazabilidad');
    var base = { DNI_RUC: '45678912', NOMBRES: 'Cliente Prueba Fase Dos', TELEFONO: '987654321', DIRECCION: 'Jr. Lima 123', ZONA: 'SAN RAMON DE PANGOA', FECHA_ALTA: '2026-10-15' };
    var alta = function (o) { var c = {}; for (var k in base) c[k] = base[k]; for (var j in o) c[j] = o[j]; return T_api_('guardarCliente', { cliente: c }, PU.ADMIN); };
    P_check_(/DNI\/RUC inválido/.test(alta({ DNI_RUC: '1234567' }).error), 'DNI de 7 dígitos → rechazado');
    P_check_(/inválido/.test(alta({ DNI_RUC: '30123456789' }).error), 'RUC que empieza con 30 → rechazado');
    P_check_(/ya está registrado/.test(alta({ DNI_RUC: S.DNI_CERO }).error), 'DNI duplicado → rechazado');
    P_check_(/Teléfono inválido/.test(alta({ TELEFONO: '888888888' }).error), 'teléfono que no empieza con 9 → rechazado');
    P_check_(/dirección/.test(alta({ DIRECCION: '' }).error), 'sin dirección → rechazado');
    var r = alta({ CLAVE_WIFI: 'secreta123' });
    P_check_(r.ok && r.datos.idCliente === 'CLI-0137', 'válido → ' + (r.datos && r.datos.idCliente));
    S.NUEVO = r.datos.idCliente;
    var libre = T_filas_('PPPoE').filter(function (p) { return p.ESTADO === P_DISPONIBLE; })[0];
    var rs = T_api_('nuevoServicio', { idCliente: S.NUEVO, plan: 'SERVICIO DE INTERNET 20mbp', modo: 'ONU INTERNET', fecha: '2026-10-15', codigoPPPoE: String(libre.CODIGO), montoInstalacion: 50 }, PU.ADMIN);
    P_check_(rs.ok && rs.datos.idServ === 'SRV-0133' && rs.datos.cuotas === 4, 'servicio ' + (rs.datos && rs.datos.idServ) + ' con ' + (rs.datos && rs.datos.cuotas) + ' cuotas (oct–dic + instalación)');
    var oct = T_fila_('Cargos', 'CLAVE', 'SRV-0133|2026-10|MENSUALIDAD');
    P_check_(oct && num(oct.MONTO) === 27.42, 'octubre prorrateado: S/ 50 × 17/31 = ' + (oct && oct.MONTO));
    P_check_(T_resumen_(S.NUEVO).ESTADO === E_ACTIVO && T_resumen_(S.NUEVO).ALERTA === 'Por vencer', 'el cliente nuevo queda Activo y "Por vencer"');
    // ---- edición ----
    var e1 = T_api_('guardarCliente', { cliente: { ID_CLIENTE: S.NUEVO, TELEFONO: '12345' } }, PU.ADMIN);
    P_check_(!e1.ok && /Teléfono inválido/.test(e1.error), 'editar con teléfono inválido → rechazado');
    var e2 = T_api_('guardarCliente', { cliente: { ID_CLIENTE: S.NUEVO, DNI_RUC: S.DNI_CERO } }, PU.ADMIN);
    P_check_(!e2.ok && /ya está registrado/.test(e2.error), 'editar con un DNI de otro cliente → rechazado');
    var e3 = T_api_('guardarCliente', { cliente: { ID_CLIENTE: S.NUEVO, TELEFONO: '912345678', CLAVE_WIFI: 'nueva456', NOMBRES: 'Cliente Prueba Editado' } }, PU.ADMIN);
    P_check_(e3.ok && T_fila_('Clientes', 'ID_CLIENTE', S.NUEVO).TELEFONO === '912345678' && T_fila_('ClientesPriv', 'ID_CLIENTE', S.NUEVO).CLAVE_WIFI === 'nueva456', 'edición válida guardada');
    var bit = T_filas_('Bitacora').filter(function (b) { return b.ACCION === 'EDITAR_CLIENTE' && b.ID_ENTIDAD === S.NUEVO; })[0];
    P_check_(bit && /TELEFONO: "987654321" → "912345678"/.test(bit.DETALLE) && /CLAVE_WIFI \(cambiada\)/.test(bit.DETALLE) && !/nueva456/.test(bit.DETALLE),
      'Bitácora con valor anterior y nuevo (la clave WiFi no se escribe en la Bitácora)');
    P_check_(T_resumen_(S.NUEVO).NOMBRES === 'CLIENTE PRUEBA EDITADO', 'el nombre nuevo llega al resumen');
  },

  function caso15_(S) {
    P_caso_('15. Renovar el año dos veces: la segunda genera 0 cuotas');
    var a = T_api_('renovarAnio', { anio: 2027 }, PU.ADMIN), b = T_api_('renovarAnio', { anio: 2027 }, PU.ADMIN);
    P_check_(a.ok && a.datos.cuotas > 0, 'primera vez: ' + (a.datos && a.datos.cuotas) + ' cuotas');
    P_check_(b.ok && b.datos.cuotas === 0, 'segunda vez: 0 cuotas');
    var claves = {}, rep = 0;
    T_filas_('Cargos').forEach(function (c) { if (claves[c.CLAVE]) rep++; claves[c.CLAVE] = 1; });
    P_check_(rep === 0, 'ninguna clave ID_SERV|AAAA-MM|CONCEPTO repetida');
  },

  function caso16_(S) {
    P_caso_('16. Sincronización con el celular (completa e incremental)');
    var c = T_api_('sincronizarDatos', {}, PU.COB1);
    P_check_(c.ok && c.datos.tipo === 'completa' && c.datos.clientes.length === 137, 'completa: ' + (c.datos && c.datos.clientes.length) + ' clientes');
    var cli = c.datos.clientes.filter(function (x) { return x.ID_CLIENTE === S.NUEVO; })[0];
    P_check_(cli && cli.CLAVE_WIFI === 'nueva456' && cli.ESTADO && cli.DEUDA_TOTAL !== undefined, 'cada cliente trae datos, resumen y claves WiFi (acceso total)');
    P_check_(c.datos.cargos.every(function (k) { return num(k.SALDO) > 0 && k.ANULADO !== SI; }) && /^\d{4}-\d{2}-\d{2}$/.test(c.datos.cargos[0].PERIODO),
      'solo cargos con saldo, fechas como AAAA-MM-DD (' + c.datos.cargos.length + ' cargos)');
    P_check_(c.datos.pppoe.length === 35 && c.datos.planes.length > 0 && c.datos.listas.length > 0, 'PPPoE y catálogos incluidos');
    // un cobro después de la descarga → la incremental lo trae
    // "desde" justo antes del cobro (las esperas cortas separan las marcas de tiempo cuando todo corre muy rápido)
    var espera = function () { var t = Date.now() + 5; while (Date.now() < t) { /* espera activa de 5 ms */ } };
    espera(); var desde = new Date().toISOString(); espera();
    var p = T_pendientes_(S.NUEVO)[0];
    var pago = T_api_('registrarPago', { idCliente: S.NUEVO, idsCargos: [p.ID_CARGO], monto: num(p.SALDO), metodo: 'Efectivo' }, PU.COB1);
    var inc = T_api_('sincronizarDatos', { desde: desde }, PU.COB1);
    P_check_(inc.ok && inc.datos.tipo === 'incremental', 'con "desde": incremental');
    P_check_(inc.datos.cargos.some(function (k) { return k.ID_CARGO === p.ID_CARGO && num(k.SALDO) === 0; }) &&
      inc.datos.clientes.some(function (x) { return x.ID_CLIENTE === S.NUEVO; }) && inc.datos.pagos.some(function (x) { return x.N_RECIBO === pago.datos.nroRecibo; }),
      'trae el cargo recién pagado (saldo 0), su cliente y el recibo');
    P_check_(inc.datos.clientes.length < 10, 'y solo lo que cambió (' + inc.datos.clientes.length + ' clientes)');
    var viejo = T_api_('sincronizarDatos', { desde: '2020-01-01T00:00:00Z' }, PU.COB1);
    P_check_(viejo.datos.tipo === 'completa', 'si hubo un recálculo nocturno después de "desde" → completa');
    var ficha = T_api_('fichaCliente', { idCliente: S.A }, PU.COB1);
    P_check_(ficha.ok && ficha.datos.pagos.length > 0 && ficha.datos.cargos.length > 0, 'ficha del cliente con cargos y pagos');
  },

  function caso17_(S) {
    P_caso_('17. Seguridad y Bitácora');
    var p = T_pendientes_(S.A)[0], d = { idCliente: S.A, idsCargos: [p.ID_CARGO], monto: 1, metodo: 'Efectivo' };
    var r = T_api_('registrarPago', d, 'intruso@gmail.com');
    P_check_(!r.ok && r.codigoError === 'NO_AUTORIZADO', 'correo que no está en Usuarios → NO_AUTORIZADO');
    r = T_api_('registrarPago', d, PU.INACTIVO);
    P_check_(!r.ok && r.codigoError === 'NO_AUTORIZADO', 'usuario con ACTIVO = No → NO_AUTORIZADO');
    r = T_api_('sincronizarDatos', {}, PU.INACTIVO);
    P_check_(!r.ok && r.codigoError === 'NO_AUTORIZADO', 'el inactivo tampoco puede descargar datos');
    P_check_(T_filas_('Bitacora').filter(function (b) { return b.RESULTADO === 'RECHAZADO' && (b.USUARIO === 'intruso@gmail.com' || b.USUARIO === PU.INACTIVO); }).length >= 3,
      'los intentos quedan en la Bitácora');
    r = T_api_('anularPago', { nroRecibo: 'R-000117', motivo: 'probando roles' }, PU.ROLCOB);
    P_check_(!r.ok && r.codigoError === 'PROHIBIDO', 'rol COBRADOR (futuro) no puede anular → PROHIBIDO');
    r = T_api_('registrarPago', d, PU.ROLCOB);
    P_check_(!r.ok && /zona/.test(r.error), 'rol COBRADOR (futuro) no cobra fuera de sus zonas');
    r = ejecutarAccion('registrarPago', d, PU.ADMIN, '');
    P_check_(!r.ok && /idSolicitud/.test(r.error), 'una escritura sin idSolicitud → rechazada');
    P_check_(ejecutarAccion('borrarTodo', {}, PU.ADMIN).codigoError === 'ACCION_DESCONOCIDA', 'acción desconocida → ACCION_DESCONOCIDA');
    var sinId = T_filas_('Bitacora').filter(function (b) { return b.ACCION !== 'MIGRACION' && !b.ID_SOLICITUD && b.RESULTADO === 'OK'; });
    P_check_(sinId.length === 0, 'toda operación aceptada en la Bitácora lleva su ID_SOLICITUD (' + sinId.length + ' sin ID)');
  },

  function caso18_(S) {
    P_caso_('18. Cuadres');
    var r = T_api_('verificarCuadre', {}, PU.ADMIN);
    (r.datos.lineas || []).forEach(function (l) { P_check_(l.ok, l.control + ': ' + l.a + ' = ' + l.b); });
    P_check_(r.ok && r.datos.cuadra, 'verificarCuadre → cuadra');
    var foto = function (n, cols) { return T_filas_(n).map(function (x) { return cols.map(function (c) { return x[c] instanceof Date ? aDia(x[c]) : x[c]; }).join('|'); }).join('\n'); };
    var colsR = ESQUEMA.ResumenCliente.cols.filter(function (c) { return c !== 'F_CALCULO' && c !== 'ULT_MODIF'; });
    var colsC = ['PAGADO', 'SALDO', 'VENCE', 'DIAS_ATRASO', 'ESTADO'];
    var aR = foto('ResumenCliente', colsR), aC = foto('Cargos', colsC);
    var t0 = Date.now();
    tareaDiaria();
    S.msRecalculo = Date.now() - t0;
    P_check_(foto('ResumenCliente', colsR) === aR && foto('Cargos', colsC) === aC, 'recálculo por cliente = recálculo completo nocturno (idéntico)');
    P_info_('recálculo completo + integridad sobre la hoja: ' + S.msRecalculo + ' ms');
    var integ = verificarIntegridad();
    P_check_(integ.every(function (p) { return /sigue asignado a SRV-0023|sigue asignado a SRV-0025|sigue asignado a SRV-0059/.test(p); }),
      'integridad: solo los ' + integ.length + ' pendientes heredados');
  },

  function caso19_(S) {
    P_caso_('19. Archivar el año: "CUADRA" y no duplica');
    var dv = T_suma_(T_filas_('ResumenCliente'), function (x) { return num(x.DEUDA_VENCIDA); });
    var r = T_api_('archivarAnio', { anio: 2025 }, PU.ADMIN);
    P_check_(r.ok && /CUADRA/.test(r.datos.resultado), String(r.ok ? r.datos.resultado : r.error).substr(0, 140));
    var r2x = T_api_('archivarAnio', { anio: 2025 }, PU.ADMIN);
    P_check_(r2x.ok && /No hay movimientos/.test(r2x.datos.resultado), 'repetirlo no archiva nada nuevo: ' + String(r2x.ok ? r2x.datos.resultado : r2x.error).substr(0, 90));
    P_check_(T_suma_(T_filas_('ResumenCliente'), function (x) { return num(x.DEUDA_VENCIDA); }) === dv, 'la deuda vencida total no cambia tras archivar');
    var r3 = T_api_('archivarAnio', { anio: 2026 }, PU.ADMIN);
    P_check_(!r3.ok && /años cerrados/.test(r3.error), 'no permite archivar el año en curso');
    P_check_(T_api_('verificarCuadre', {}, PU.ADMIN).datos.cuadra, 'después de archivar todo sigue cuadrando');
  },

  function caso20_(S) {
    P_caso_('20. Rendimiento del motor (500 clientes, 15,000 cargos)');
    var T = { Clientes: tablaMem('Clientes', []), Servicios: tablaMem('Servicios', []), Cargos: tablaMem('Cargos', []),
              PagosDet: tablaMem('PagosDet', []), PPPoE: tablaMem('PPPoE', []), ResumenCliente: tablaMem('ResumenCliente', []) };
    var fila = function (t, o) { return T[t].enc.map(function (c) { return o[c] === undefined ? '' : o[c]; }); };
    var n = 0;
    for (var k = 1; k <= 500; k++) {
      var id = 'CLI-' + k;
      T.Clientes.datos.push(fila('Clientes', { ID_CLIENTE: id, NOMBRES: 'C' + k, ZONA: 'Z', DIA_VENC: 4 }));
      T.Servicios.datos.push(fila('Servicios', { ID_SERV: 'S' + k, ID_CLIENTE: id, PLAN: 'P', TARIFA: 50, ESTADO: 'Activo' }));
      for (var m = 0; m < 30; m++) {
        var cid = 'CRG-' + (++n);
        T.Cargos.datos.push(fila('Cargos', { ID_CARGO: cid, ID_SERV: 'S' + k, ID_CLIENTE: id, PERIODO: deDia(diaDe(2025, 1 + m, 1)), MONTO: 50, ANULADO: 'No' }));
        if (m < 20) T.PagosDet.datos.push(fila('PagosDet', { ID_CARGO: cid, ID_CLIENTE: id, MONTO_APLICADO: 50, FECHA_PAGO: deDia(diaDe(2025, 1 + m, 3)), ANULADO: 'No' }));
      }
    }
    var t0 = Date.now(); calcularMotor(T, {}); var ms = Date.now() - t0;
    P_check_(ms < 60000, 'motor en memoria: ' + ms + ' ms para ' + T.Cargos.datos.length + ' cargos');
    if (S.msRecalculo) P_check_(S.msRecalculo < 60000, 'recálculo real sobre la hoja (136 clientes): ' + S.msRecalculo + ' ms');
  }
];

// ============================================================================
// CORREDORES
// ============================================================================

/**
 * Crea el libro desechable, importa migracion.json y devuelve su ID.
 * Deja _db apuntando a ese libro (nunca toca DB_ID ni el libro de PRUEBAS).
 */
function prepararLibroPrueba_() {
  var nombre = 'DANDINET_PRUEBA_AUTOMATICA_' + Utilities.formatDate(new Date(), 'America/Lima', 'yyyyMMdd_HHmm');
  var libro = SpreadsheetApp.create(nombre);
  var base = DriveApp.getRootFolder(), it = base.getFoldersByName('DANDINET_PRUEBAS');
  if (it.hasNext()) base = it.next();
  var it2 = base.getFoldersByName('Pruebas automáticas');
  var carpeta = it2.hasNext() ? it2.next() : base.createFolder('Pruebas automáticas');
  DriveApp.getFileById(libro.getId()).moveTo(carpeta);
  _db = libro; _cfgCache = null;
  libro.setSpreadsheetTimeZone('America/Lima');
  crearEstructura();
  importarMigracion(archivoDrive_('migracion.json').getId());
  return libro.getId();
}

/** Corre todos los pasos de una vez (lo usa la prueba local). Devuelve el informe. */
function correrTodasLasPruebas_() {
  _hoySimulado = aDia(PRUEBA_HOY);
  _P = P_nuevo_();
  prepararLibroPrueba_();
  var S = {};
  PASOS_PRUEBA.forEach(function (paso) { correrPaso_(paso, S); });
  return _P;
}

function correrPaso_(paso, S) {
  try { paso(S); }
  catch (e) {
    if (!_P.casos.length) P_caso_('(preparación)');
    P_check_(false, 'ERROR INESPERADO en ' + (paso.name || 'paso') + ': ' + e.message + ' ' + String(e.stack || '').split('\n').slice(1, 3).join(' | '));
  }
}

/**
 * ▶ En Google (proyecto de PRUEBAS). Llámelo hasta que diga "TERMINADO".
 * Cada llamada avanza los pasos que caben en ~4 minutos y guarda el avance.
 * Con reiniciar = true empieza de cero (nuevo libro desechable).
 */
function correrPruebasEnGoogle(reiniciar) {
  if (entorno() !== 'PRUEBAS') throw new Error('Las pruebas automáticas solo corren en el proyecto de PRUEBAS.');
  // El avance se guarda DENTRO del libro desechable (pestaña _EstadoPrueba): las propiedades del script
  // solo admiten 9 KB y el informe es más grande. En las propiedades queda solo el ID del libro.
  var props = PropertiesService.getScriptProperties(), inicio = Date.now();
  var idLibro = reiniciar ? null : props.getProperty('PRUEBA_LIBRO'), est = null;
  _hoySimulado = aDia(PRUEBA_HOY);
  if (idLibro) {
    _db = SpreadsheetApp.openById(idLibro); _cfgCache = null;
    est = JSON.parse(String(_db.getSheetByName('_EstadoPrueba').getRange(1, 1).getValue()));
    _P = est.P;
  } else {
    _P = P_nuevo_();
    est = { libro: prepararLibroPrueba_(), paso: 0, S: {}, P: null, inicio: new Date().toISOString() };
    props.setProperty('PRUEBA_LIBRO', est.libro);
    db().insertSheet('_EstadoPrueba');
  }
  while (est.paso < PASOS_PRUEBA.length && Date.now() - inicio < 240000) {
    correrPaso_(PASOS_PRUEBA[est.paso], est.S);
    est.paso++;
  }
  est.P = _P;
  if (est.paso < PASOS_PRUEBA.length) {
    db().getSheetByName('_EstadoPrueba').getRange(1, 1).setValue(JSON.stringify(est));
    return 'CONTINUAR: ' + est.paso + '/' + PASOS_PRUEBA.length + ' pasos · ' + _P.total + ' verificaciones, ' + _P.fallos + ' fallos. Vuelva a ejecutar correrPruebasEnGoogle().';
  }
  props.deleteProperty('PRUEBA_LIBRO');
  props.setProperty('PRUEBA_ULTIMO_INFORME', JSON.stringify({ fin: new Date().toISOString(), total: _P.total, fallos: _P.fallos }));
  // todo lo creado por la prueba va a la papelera (se puede recuperar 30 días); si falló algo, se conserva para revisar
  var conservar = _P.fallos > 0;
  if (!conservar) limpiarPruebas_();
  return 'TERMINADO: ' + (_P.fallos ? '❌ ' + _P.fallos + ' FALLO(S)' : '✅ TODO OK') + ' · ' + (_P.total - _P.fallos) + '/' + _P.total +
    ' verificaciones' + (conservar ? ' · libro de prueba conservado para revisar: ' + est.libro : '') + '\n' + _P.log.join('\n');
}

/**
 * ▶ En Google: concurrencia REAL. Se lanza varias veces EN PARALELO (una por "cobrador") sobre el
 * mismo libro desechable; cada una registra n cobros. Después, verificarConcurrencia() revisa el correlativo.
 */
function prepararConcurrencia() {
  if (entorno() !== 'PRUEBAS') throw new Error('Solo en el proyecto de PRUEBAS.');
  _hoySimulado = aDia(PRUEBA_HOY);
  var id = prepararLibroPrueba_();
  agregarFilas('Usuarios', [[PU.COB1, 'C1', 'ADMIN', '*', 'C1', SI], [PU.COB2, 'C2', 'ADMIN', '*', 'C2', SI], [PU.COB3, 'C3', 'ADMIN', '*', 'C3', SI]]);
  PropertiesService.getScriptProperties().setProperty('PRUEBA_CONCURRENCIA', id);
  return id;
}

function cobrosConcurrentes(usuario, n) {
  _hoySimulado = aDia(PRUEBA_HOY);
  _db = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('PRUEBA_CONCURRENCIA')); _cfgCache = null;
  var clientes = T_filas_('ResumenCliente').filter(function (r) { return num(r.DEUDA_TOTAL) > 50; }).map(function (r) { return r.ID_CLIENTE; });
  var ok = 0, nros = [], errores = [], t0 = Date.now();
  for (var k = 0; k < n; k++) {
    var cli = clientes[(k * 7 + usuario.length * 13) % clientes.length];
    var c = T_pendientes_(cli)[0];
    if (!c) continue;
    var r = T_api_('registrarPago', { idCliente: cli, idsCargos: [c.ID_CARGO], monto: 1, metodo: 'Efectivo' }, usuario);
    if (r.ok) { ok++; nros.push(r.datos.nroRecibo); } else errores.push(r.codigoError + ': ' + r.error);
  }
  return { usuario: usuario, ok: ok, nros: nros, errores: errores, ms: Date.now() - t0 };
}

function verificarConcurrencia() {
  var id = PropertiesService.getScriptProperties().getProperty('PRUEBA_CONCURRENCIA');
  _db = SpreadsheetApp.openById(id); _cfgCache = null;
  var nros = T_filas_('Pagos').map(function (p) { return String(p.N_RECIBO); }).filter(function (n) { return n.indexOf('R-') === 0; })
    .map(function (n) { return +n.slice(2); }).sort(function (a, b) { return a - b; });
  var unicos = {}; nros.forEach(function (n) { unicos[n] = 1; });
  var sinSaltos = nros.every(function (n, i) { return n === 116 + i; });
  var cuadre = cuadreInterno_(abrirContexto());
  var ok = Object.keys(unicos).length === nros.length && sinSaltos && cuadre.cuadra;
  if (ok) limpiarPruebas_();
  PropertiesService.getScriptProperties().deleteProperty('PRUEBA_CONCURRENCIA');
  return { recibos: nros.length, primero: nros[0], ultimo: nros[nros.length - 1], duplicados: nros.length - Object.keys(unicos).length,
    sinSaltos: sinSaltos, cuadra: cuadre.cuadra, resultado: ok ? '✅ CONCURRENCIA OK' : '❌ REVISAR (libro conservado: ' + id + ')' };
}

/** Manda a la papelera todo lo que está en DANDINET_PRUEBAS/Pruebas automáticas (libros, respaldos, históricos). */
function limpiarPruebas_() {
  var it = DriveApp.getRootFolder().getFoldersByName('DANDINET_PRUEBAS');
  if (!it.hasNext()) return;
  var it2 = it.next().getFoldersByName('Pruebas automáticas');
  if (!it2.hasNext()) return;
  var c = it2.next();
  if (c.setTrashed) c.setTrashed(true);
}

/** ▶ En Google: mide cuánto tarda cada parte de una operación (sobre un libro desechable). */
function medirTiempos() {
  if (entorno() !== 'PRUEBAS') throw new Error('Solo en el proyecto de PRUEBAS.');
  _hoySimulado = aDia(PRUEBA_HOY);
  prepararLibroPrueba_();
  agregarFilas('Usuarios', [[PU.COB1, 'C1', 'ADMIN', '*', 'C1', SI]]);
  var r = {}, t;
  ['Clientes', 'Servicios', 'Cargos', 'Pagos', 'PagosDet', 'ResumenCliente', 'Solicitudes', 'Config'].forEach(function (n) {
    t = Date.now(); leerTabla(n); r['leer_' + n] = Date.now() - t;
  });
  var cli = T_filas_('ResumenCliente').filter(function (x) { return num(x.DEUDA_TOTAL) > 50; }).map(function (x) { return x.ID_CLIENTE; });
  r.pagos_ms = [];
  for (var k = 0; k < 3; k++) {
    var c = T_pendientes_(cli[k])[0];
    t = Date.now();
    T_api_('registrarPago', { idCliente: cli[k], idsCargos: [c.ID_CARGO], monto: 1, metodo: 'Efectivo' }, PU.COB1);
    r.pagos_ms.push(Date.now() - t);
  }
  t = Date.now(); var s = T_api_('sincronizarDatos', {}, PU.COB1); r.sync_completa_ms = Date.now() - t;
  r.sync_kb = Math.round(JSON.stringify(s).length / 1024);
  t = Date.now(); T_api_('perfil', {}, PU.COB1); r.perfil_ms = Date.now() - t;
  limpiarPruebas_();
  return r;
}
