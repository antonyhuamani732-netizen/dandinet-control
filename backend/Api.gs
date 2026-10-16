/**
 * API: LA PUERTA ÚNICA DEL SISTEMA ("la app pide, el servidor decide")
 * --------------------------------------------------------------------------
 * Todo lo que hace la app pasa por ejecutarAccion(accion, datos, email, idSolicitud, extra).
 * En la Fase 3, doPost() verificará el token de Google y llamará a esta misma función.
 *
 * Respuesta SIEMPRE con esta forma:
 *   { ok: true,  datos: {...} }
 *   { ok: false, error: 'mensaje claro', codigoError: 'VALIDACION' }
 *
 * codigoError: VALIDACION · PROHIBIDO · NO_AUTORIZADO · OCUPADO · ACCION_DESCONOCIDA · INTERNO
 *
 * Tipos de acción:
 *   lectura       → no escribe nada. No necesita idSolicitud.
 *   escritura     → dentro del candado. Exige idSolicitud (UUID creado en el celular).
 *                   Si el mismo idSolicitud llega otra vez, devuelve el resultado guardado
 *                   en la tabla Solicitudes SIN volver a ejecutar nada (idempotencia).
 *   mantenimiento → procesos largos con su propio candado (archivar el año).
 *   lote          → procesarCola: varias escrituras hechas sin señal, en orden.
 */

var ROL_TODOS = ['ADMIN', 'COBRADOR'];
var ROL_ADMIN = ['ADMIN'];

var ACCIONES = {
  // ---- lectura ----
  perfil:                { tipo: 'lectura', roles: ROL_TODOS.concat(['CONSULTA']), fn: acc_perfil_ },
  sincronizarDatos:      { tipo: 'lectura', roles: ROL_TODOS, fn: acc_sincronizarDatos_ },
  fichaCliente:          { tipo: 'lectura', roles: ROL_TODOS, fn: acc_fichaCliente_ },
  misCobros:             { tipo: 'lectura', roles: ROL_TODOS, fn: acc_misCobros_ },
  listaCorte:            { tipo: 'lectura', roles: ROL_TODOS, fn: acc_listaCorte_ },
  reportePPPoE:          { tipo: 'lectura', roles: ROL_TODOS, fn: acc_reportePPPoE_ },
  revisiones:            { tipo: 'lectura', roles: ROL_ADMIN, fn: acc_revisiones_ },
  verificarCuadre:       { tipo: 'lectura', roles: ROL_ADMIN, fn: acc_verificarCuadre_ },
  // ---- escritura ----
  registrarPago:         { tipo: 'escritura', roles: ROL_TODOS, fn: acc_registrarPago_ },
  anularPago:            { tipo: 'escritura', roles: ROL_ADMIN, fn: acc_anularPago_ },
  cambiarEstadoServicio: { tipo: 'escritura', roles: ROL_ADMIN, fn: acc_cambiarEstadoServicio_ },
  reactivarServicio:     { tipo: 'escritura', roles: ROL_ADMIN, fn: acc_reactivarServicio_ },
  guardarCliente:        { tipo: 'escritura', roles: ROL_ADMIN, fn: acc_guardarCliente_ },
  nuevoServicio:         { tipo: 'escritura', roles: ROL_ADMIN, fn: acc_nuevoServicio_ },
  cambiarPlan:           { tipo: 'escritura', roles: ROL_ADMIN, fn: acc_cambiarPlan_ },
  pppoe:                 { tipo: 'escritura', roles: ROL_ADMIN, fn: acc_pppoe_ },
  resolverRevision:      { tipo: 'escritura', roles: ROL_ADMIN, fn: acc_resolverRevision_ },
  renovarAnio:           { tipo: 'escritura', roles: ROL_ADMIN, fn: acc_renovarAnio_ },
  // ---- mantenimiento y lote ----
  archivarAnio:          { tipo: 'mantenimiento', roles: ROL_ADMIN, fn: acc_archivarAnio_ },
  procesarCola:          { tipo: 'lote', roles: ROL_TODOS }
};

/** Máximo de operaciones por llamada a procesarCola, y tiempo máximo (el límite de Google es 6 min). */
var COLA_MAX_OPERACIONES = 20, COLA_MAX_MS = 270000;

// ============================================================================
// PUERTA ÚNICA
// ============================================================================

/**
 * accion      : nombre de la acción (ver ACCIONES).
 * datos       : objeto con los datos de la acción.
 * email       : correo del usuario YA VERIFICADO (en la Fase 3, sale del token de Google).
 * idSolicitud : UUID de la operación (obligatorio en escrituras).
 * extra       : { fDispositivo: 'fecha-hora ISO del celular', origen: 'online' | 'offline' }
 */
function ejecutarAccion(accion, datos, email, idSolicitud, extra) {
  extra = extra || {};
  datos = datos || {};
  email = String(email || '').trim().toLowerCase();
  var def = ACCIONES[accion];
  if (!def) return respError_('Acción desconocida: "' + accion + '".', 'ACCION_DESCONOCIDA');
  var id = String(idSolicitud || '').trim();
  try {
    if (def.tipo === 'lote') return acc_procesarCola_(datos, email);

    if (def.tipo === 'lectura') {
      var ctxL = abrirContexto();
      var uL = exigirUsuario_(ctxL, email, def.roles);
      return respOk_(def.fn(ctxL, datos, uL, {}));
    }

    if (def.tipo === 'mantenimiento') {
      exigirUsuario_(abrirContexto(), email, def.roles);
      return respOk_(def.fn(datos, email));         // el proceso deja su propia línea en la Bitácora
    }

    // ---- escritura ----
    if (!id) return respError_('Falta el idSolicitud de la operación.', 'VALIDACION');
    var meta = { idSolicitud: id, accion: accion, origen: extra.origen === 'offline' ? 'offline' : 'online',
                 fDispositivo: fechaHoraDe_(extra.fDispositivo) };
    return transaccion(function (ctx) {
      ctx.idSolicitud = id;
      var previa = solicitudPrevia_(ctx, id);
      if (previa) { previa.repetido = true; return previa; }       // reintento: mismo resultado, nada nuevo
      var u = exigirUsuario_(ctx, email, def.roles);
      var res = respOk_(def.fn(ctx, datos, u, meta));
      registrarSolicitud_(ctx, id, email, accion, meta, res);
      return res;
    });
  } catch (e) {
    return manejarError_(e, accion, datos, email, id, extra, def);
  }
}

/** Decide qué hacer cuando una acción falla. */
function manejarError_(e, accion, datos, email, id, extra, def) {
  var codigo = e.negocio ? (e.codigo || 'VALIDACION') : 'INTERNO';

  // El sistema está ocupado: no se guarda nada; la app reintenta sola.
  if (codigo === 'OCUPADO') return respError_(e.message, 'OCUPADO');

  // Usuario desconocido o desactivado: se anota en la Bitácora (sin candado: solo agrega una fila).
  if (codigo === 'NO_AUTORIZADO') {
    intentarBitacora_(email || '(sin correo)', accion, 'RECHAZADO', e.message, id);
    return respError_(e.message, 'NO_AUTORIZADO');
  }

  // Cobro hecho SIN SEÑAL que choca con la realidad: el dinero ya se recibió, NO se rechaza.
  if (e.negocio && accion === 'registrarPago' && extra.origen === 'offline' && codigo === 'VALIDACION') {
    try { return enviarARevision_(datos, email, id, extra, e.message); }
    catch (e2) { return manejarError_(e2, 'registrarPago_revision', datos, email, id, {}, def); }
  }

  // Rechazo de negocio: se guarda en Solicitudes para que un reintento reciba la misma respuesta.
  if (e.negocio && def && def.tipo === 'escritura' && id) {
    var resp = respError_(e.message, codigo);
    try {
      return transaccion(function (ctx) {
        ctx.idSolicitud = id;
        var previa = solicitudPrevia_(ctx, id);
        if (previa) return previa;
        registrarSolicitud_(ctx, id, email, accion, { origen: extra.origen || 'online', fDispositivo: fechaHoraDe_(extra.fDispositivo) }, resp);
        bitacora(ctx, email, accion.toUpperCase(), '', '', e.message, 'RECHAZADO');
        return resp;
      });
    } catch (e3) { return resp; }
  }
  if (e.negocio) {
    intentarBitacora_(email, accion, 'RECHAZADO', e.message, id);
    return respError_(e.message, codigo);
  }

  // Falla inesperada del sistema: se registra y la app puede reintentar.
  intentarBitacora_(email, accion, 'ERROR', String(e && e.stack || e).substr(0, 450), id);
  return respError_('Error del sistema: ' + e.message, 'INTERNO');
}

// ============================================================================
// AYUDANTES DE LA API
// ============================================================================

/** Convierte todo a JSON puro (las fechas pasan a texto ISO). */
function respOk_(datos) { return JSON.parse(JSON.stringify({ ok: true, datos: datos === undefined ? null : datos })); }
function respError_(msg, codigo) { return { ok: false, error: String(msg), codigoError: codigo || 'VALIDACION' }; }

/** Usuario activo con uno de los roles permitidos (si no, error con código NO_AUTORIZADO o PROHIBIDO). */
function exigirUsuario_(ctx, email, roles) {
  return exigirRol(ctx, email, roles || ROL_TODOS);
}

/** Resultado guardado de una solicitud ya procesada (o null). */
function solicitudPrevia_(ctx, id) {
  var i = buscar(ctx, 'Solicitudes', 'ID_SOLICITUD', id);
  if (i >= 0) {
    try { return JSON.parse(String(val(ctx.t('Solicitudes'), i, 'RESULTADO_JSON'))); }
    catch (e) { return respError_('La solicitud ' + id + ' ya fue procesada (resultado ilegible).', 'VALIDACION'); }
  }
  // Red de seguridad: un pago o una revisión ya escritos con este ID (si se cortó antes de anotar la solicitud)
  var p = buscar(ctx, 'Pagos', 'ID_SOLICITUD', id);
  if (p >= 0) {
    var tP = ctx.t('Pagos');
    return respOk_({ estado: 'Válido', nroRecibo: String(val(tP, p, 'N_RECIBO')), monto: num(val(tP, p, 'MONTO')),
      periodos: val(tP, p, 'PERIODOS'), saldoRestante: num(val(tP, p, 'SALDO_RESTANTE')), urlPdf: '' });
  }
  var r = buscar(ctx, 'PagosRevisar', 'ID_SOLICITUD', id);
  if (r >= 0) return respOk_({ estado: 'A revisar', nroRecibo: '', motivo: String(val(ctx.t('PagosRevisar'), r, 'MOTIVO_CONFLICTO')) });
  return null;
}

/** Anota la solicitud procesada con su resultado (dentro de la misma transacción). */
function registrarSolicitud_(ctx, id, email, accion, meta, res) {
  nuevaFila(ctx, 'Solicitudes', { ID_SOLICITUD: id, USUARIO: email, ACCION: accion, F_RECIBIDA: new Date(),
    F_DISPOSITIVO: meta.fDispositivo || '', ORIGEN: meta.origen || 'online', RESULTADO_JSON: JSON.stringify(res).substr(0, 45000) });
}

/** Agrega una línea a la Bitácora fuera de una transacción (nunca hace fallar la respuesta). */
function intentarBitacora_(email, accion, resultado, detalle, id) {
  try { agregarFilas('Bitacora', [filaBitacora_(email, String(accion).toUpperCase(), '', '', detalle, id, resultado)]); }
  catch (e) { /* la bitácora no debe tumbar la respuesta */ }
}

/** Texto ISO / Date → Date (o '' si no es válido). */
function fechaHoraDe_(v) {
  if (!v) return '';
  var d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? '' : d;
}

/** Fecha "solo día" para la API: 'AAAA-MM-DD'. */
function isoDia_(n) {
  if (n === null || n === undefined || n === '') return '';
  var p = partesDia(n);
  return p.a + '-' + ('0' + p.m).slice(-2) + '-' + ('0' + p.d).slice(-2);
}

/** Fila de una tabla convertida en objeto para la app (fechas "solo día" como AAAA-MM-DD). */
function filaObj_(nombre, t, i) {
  var e = ESQUEMA[nombre] || { fecha: [] }, o = {};
  t.enc.forEach(function (c, j) {
    var v = t.datos[i][j];
    if (e.fecha.indexOf(c) >= 0) v = isoDia_(aDia(v));
    else if (v instanceof Date) v = v.toISOString();
    o[c] = v;
  });
  return o;
}

/** ¿El usuario puede ver esta zona? */
function veZona_(u, zona) {
  return u.todasZonas || u.zonas.indexOf(String(zona || '').toUpperCase()) >= 0;
}

/** Cliente completo para la app: Clientes + ResumenCliente + ClientesPriv. */
function clienteObj_(ctx, idCliente) {
  var ic = buscar(ctx, 'Clientes', 'ID_CLIENTE', idCliente);
  if (ic < 0) return null;
  var o = filaObj_('Clientes', ctx.t('Clientes'), ic);
  var ir = buscar(ctx, 'ResumenCliente', 'ID_CLIENTE', idCliente);
  if (ir >= 0) {
    var r = filaObj_('ResumenCliente', ctx.t('ResumenCliente'), ir);
    ESQUEMA.ResumenCliente.calc.forEach(function (c) { if (c !== 'NOMBRES' && c !== 'ZONA') o[c] = r[c]; });
    if (r.ULT_MODIF > o.ULT_MODIF) o.ULT_MODIF = r.ULT_MODIF;
  }
  var ip = buscar(ctx, 'ClientesPriv', 'ID_CLIENTE', idCliente);
  if (ip >= 0) {
    var pv = filaObj_('ClientesPriv', ctx.t('ClientesPriv'), ip);
    CAMPOS_CLIENTE_PRIV.forEach(function (c) { o[c] = pv[c]; });
  }
  return o;
}

/** Valor de una celda tipo fecha-hora como milisegundos (0 si está vacía). */
function ms_(v) {
  if (v instanceof Date) return v.getTime();
  if (!v) return 0;
  var d = new Date(v);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

/** Config.FechaCalculo ('dd/MM/yyyy HH:mm', hora de Lima) → milisegundos. */
function msFechaCalculo_() {
  var m = String(cfg('FechaCalculo') || '').match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})/);
  if (!m) return 0;
  return Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4] + 5, +m[5]);   // Lima = UTC−5 (sin horario de verano)
}

// ============================================================================
// ACCIONES DE LECTURA
// ============================================================================

/** Datos del usuario y configuración pública para la app. */
function acc_perfil_(ctx, d, u) {
  var claves = ['Negocio', 'RUC', 'Direccion', 'Telefono', 'Email', 'Yape', 'TitularCobro', 'BCP', 'BN', 'DiaVenc',
    'DiasCorte', 'PrefijoRecibo', 'MensajeRecibo', 'MsgCobranza', 'MsgCorte', 'VoucherObligatorio', 'DiasMaxSinSync',
    'VersionMinimaApp', 'ClientId_OAuth'];
  var config = {};
  claves.forEach(function (k) { config[k] = String(cfg(k)); });
  return {
    usuario: { email: u.email, nombre: u.nombre, rol: u.rol, zonas: u.todasZonas ? ['*'] : u.zonas, iniciales: u.iniciales },
    config: config, entorno: entorno(), revisionesPendientes: contarRevisiones_(ctx), servidor: new Date()
  };
}

function contarRevisiones_(ctx) {
  var t = ctx.t('PagosRevisar'), n = 0;
  t.datos.forEach(function (f) { if (String(f[t.c.ESTADO]) === 'A revisar') n++; });
  return n;
}

/**
 * Descarga para el celular. d = { desde?: 'ISO' }
 * - Sin "desde" (o si hubo un recálculo nocturno después de "desde") → descarga COMPLETA.
 * - Con "desde" → solo lo que cambió (ULT_MODIF posterior).
 * Devuelve "hasta": la app lo guarda y lo manda como "desde" la próxima vez.
 */
function acc_sincronizarDatos_(ctx, d, u) {
  var ahora = new Date();
  var hasta = new Date(ahora.getTime() - 60000);         // 1 min de solape: lo que se escribía mientras leíamos
  var desde = d.desde ? ms_(d.desde) : 0;
  if (desde && msFechaCalculo_() > desde) desde = 0;     // el recálculo nocturno cambió días de atraso: completa
  var completa = !desde;

  var tC = ctx.t('Clientes'), tR = ctx.t('ResumenCliente'), tP = ctx.t('ClientesPriv');
  var modR = {}, modP = {};
  tR.datos.forEach(function (f) { modR[String(f[tR.c.ID_CLIENTE])] = ms_(f[tR.c.ULT_MODIF]); });
  tP.datos.forEach(function (f) { modP[String(f[tP.c.ID_CLIENTE])] = ms_(f[tP.c.ULT_MODIF]); });

  var zonaCli = {}, clientes = [];
  tC.datos.forEach(function (f, i) {
    var id = String(f[tC.c.ID_CLIENTE]);
    zonaCli[id] = String(f[tC.c.ZONA]);
    if (!veZona_(u, f[tC.c.ZONA])) return;
    if (completa || Math.max(ms_(f[tC.c.ULT_MODIF]), modR[id] || 0, modP[id] || 0) > desde) clientes.push(clienteObj_(ctx, id));
  });
  var visible = function (idCli) { return veZona_(u, zonaCli[String(idCli)]); };

  var tS = ctx.t('Servicios'), servicios = [];
  tS.datos.forEach(function (f, i) {
    if (visible(f[tS.c.ID_CLIENTE]) && (completa || ms_(f[tS.c.ULT_MODIF]) > desde)) servicios.push(filaObj_('Servicios', tS, i));
  });

  // Cargos: en la completa, solo los que tienen saldo; en la incremental, todo lo que cambió (para quitar los ya pagados)
  var tK = ctx.t('Cargos'), cargos = [];
  tK.datos.forEach(function (f, i) {
    if (!visible(f[tK.c.ID_CLIENTE])) return;
    var conSaldo = num(f[tK.c.SALDO]) > 0.004 && String(f[tK.c.ANULADO]) !== SI;
    if (completa ? conSaldo : ms_(f[tK.c.ULT_MODIF]) > desde) cargos.push(filaObj_('Cargos', tK, i));
  });

  // Pagos de los últimos 60 días (para la ficha y "Mis cobros")
  var tG = ctx.t('Pagos'), limite = hoyDia() - 60, pagos = [];
  tG.datos.forEach(function (f, i) {
    if (!visible(f[tG.c.ID_CLIENTE])) return;
    var nuevo = completa ? aDia(f[tG.c.FECHA]) >= limite
      : Math.max(ms_(f[tG.c.F_REGISTRO]), ms_(f[tG.c.F_ANULACION])) > desde;
    if (nuevo) pagos.push(filaObj_('Pagos', tG, i));
  });

  var tPp = ctx.t('PPPoE'), pppoe = tPp.datos.map(function (f, i) { return filaObj_('PPPoE', tPp, i); });
  var tPl = ctx.t('Planes'), planes = tPl.datos.map(function (f, i) { return filaObj_('Planes', tPl, i); });
  var tL = ctx.t('Listas'), listas = tL.datos.map(function (f, i) { return filaObj_('Listas', tL, i); });

  return { tipo: completa ? 'completa' : 'incremental', hasta: hasta, servidor: ahora, clientes: clientes,
    servicios: servicios, cargos: cargos, pagos: pagos, pppoe: pppoe, planes: planes, listas: listas,
    revisionesPendientes: contarRevisiones_(ctx) };
}

/** Ficha completa de un cliente (con todo su historial). d = { idCliente } */
function acc_fichaCliente_(ctx, d, u) {
  var id = String(d.idCliente || '');
  var cli = clienteObj_(ctx, id);
  if (!cli) throw errNeg('Cliente ' + id + ' no encontrado.');
  if (!veZona_(u, cli.ZONA)) throw errNeg('El cliente es de una zona que no tiene asignada.', 'PROHIBIDO');
  recalcularClientes(ctx, [id]);                         // días de atraso al minuto (solo en memoria)
  cli = clienteObj_(ctx, id);
  var de = function (nombre, col) {
    var t = ctx.t(nombre);
    return buscarTodos(ctx, nombre, col || 'ID_CLIENTE', id).map(function (i) { return filaObj_(nombre, t, i); });
  };
  return {
    cliente: cli, servicios: de('Servicios'),
    cargos: de('Cargos').sort(function (a, b) { return a.PERIODO < b.PERIODO ? -1 : a.PERIODO > b.PERIODO ? 1 : 0; }),
    pagos: de('Pagos').reverse(), comprobantes: de('Comprobantes'), historial: de('HistorialEstados'),
    revisiones: de('PagosRevisar')
  };
}

/** Cuadre de caja: cobros de un usuario en un día. d = { fecha?: 'AAAA-MM-DD', usuario?: email } */
function acc_misCobros_(ctx, d, u) {
  var dia = d.fecha ? aDia(d.fecha) : hoyDia();
  var quien = String(d.usuario || u.email).toLowerCase();
  var tG = ctx.t('Pagos'), lista = [], porMetodo = {}, total = 0, anulados = 0;
  tG.datos.forEach(function (f, i) {
    if (String(f[tG.c.USUARIO]).toLowerCase() !== quien || aDia(f[tG.c.FECHA]) !== dia) return;
    var o = filaObj_('Pagos', tG, i);
    lista.push(o);
    if (o.ESTADO === 'Anulado') { anulados = r2(anulados + num(o.MONTO)); return; }
    porMetodo[o.METODO] = r2((porMetodo[o.METODO] || 0) + num(o.MONTO));
    total = r2(total + num(o.MONTO));
  });
  var tR = ctx.t('PagosRevisar'), revisar = [], totalRevisar = 0;
  tR.datos.forEach(function (f, i) {
    if (String(f[tR.c.USUARIO]).toLowerCase() !== quien || aDia(f[tR.c.F_COBRO]) !== dia) return;
    var o = filaObj_('PagosRevisar', tR, i);
    revisar.push(o);
    if (o.ESTADO === 'A revisar') totalRevisar = r2(totalRevisar + num(o.MONTO));
  });
  return { fecha: isoDia_(dia), usuario: quien, recibos: lista, porMetodo: porMetodo, total: total,
    anulados: anulados, aRevisar: revisar, totalARevisar: totalRevisar, totalRecibido: r2(total + totalRevisar) };
}

/** Lista "A CORTAR" (servicios activos con atraso ≥ DiasCorte). */
function acc_listaCorte_(ctx, d, u) {
  return { diasCorte: diasParaCorte(), lista: listaACortar(ctx).filter(function (x) { return veZona_(u, x.zona); }) };
}

/** Inventario PPPoE, historial e inconsistencias. */
function acc_reportePPPoE_(ctx) {
  var tP = ctx.t('PPPoE'), tH = ctx.t('HistPPPoE'), conteo = {};
  var codigos = tP.datos.map(function (f, i) {
    var o = filaObj_('PPPoE', tP, i);
    conteo[o.ESTADO] = (conteo[o.ESTADO] || 0) + 1;
    return o;
  });
  var T = { Servicios: ctx.t('Servicios'), PPPoE: tP, Pagos: { datos: [], c: {} }, PagosDet: { datos: [], c: {} },
            Cargos: { datos: [], c: {} }, Config: { datos: [], c: {} } };
  var problemas = revisarIntegridad(T).filter(function (p) { return /PPPoE/.test(p); });
  return { codigos: codigos, conteo: conteo, historial: tH.datos.map(function (f, i) { return filaObj_('HistPPPoE', tH, i); }),
    inconsistencias: problemas };
}

/** Cobros en conflicto. d = { estado?: 'A revisar' | 'Resuelto' | 'todos' } */
function acc_revisiones_(ctx, d) {
  var t = ctx.t('PagosRevisar'), est = d.estado || 'A revisar';
  return { lista: t.datos.map(function (f, i) { return filaObj_('PagosRevisar', t, i); })
    .filter(function (o) { return est === 'todos' || o.ESTADO === est; }) };
}

/** Cuadre interno del dinero (sin el Excel): las cifras deben coincidir al centavo. */
function acc_verificarCuadre_(ctx) {
  return cuadreInterno_(ctx);
}

function cuadreInterno_(ctx) {
  var tG = ctx.t('Pagos'), tD = ctx.t('PagosDet'), tK = ctx.t('Cargos'), tR = ctx.t('ResumenCliente');
  var suma = function (t, filtro, col) {
    var s = 0;
    t.datos.forEach(function (f) { if (filtro(f)) s += num(f[t.c[col]]); });
    return r2(s);
  };
  var pagos = suma(tG, function (f) { return String(f[tG.c.ESTADO]) !== 'Anulado'; }, 'MONTO');
  var det = suma(tD, function (f) { return String(f[tD.c.ANULADO]) !== SI; }, 'MONTO_APLICADO');
  var pagadoCargos = suma(tK, function (f) { return String(f[tK.c.ANULADO]) !== SI; }, 'PAGADO');
  var facturado = suma(tK, function (f) { return String(f[tK.c.ANULADO]) !== SI; }, 'MONTO');
  var saldo = suma(tK, function () { return true; }, 'SALDO');
  var dvClientes = suma(tR, function () { return true; }, 'DEUDA_VENCIDA');
  var dvCargos = suma(tK, function (f) { return num(f[tK.c.DIAS_ATRASO]) > 0; }, 'SALDO');
  var lineas = [
    ['Σ recibos válidos = Σ detalle', pagos, det],
    ['Σ detalle = Σ pagado en cargos', det, pagadoCargos],
    ['Facturado − pagado = saldo', r2(facturado - pagadoCargos), saldo],
    ['Deuda vencida: clientes = cargos', dvClientes, dvCargos]
  ].map(function (l) { return { control: l[0], a: l[1], b: l[2], ok: Math.abs(l[1] - l[2]) < 0.005 }; });
  return { cuadra: lineas.every(function (l) { return l.ok; }), lineas: lineas,
    totales: { pagos: pagos, facturado: facturado, saldo: saldo, deudaVencida: dvClientes } };
}

// ============================================================================
// ACCIONES DE ESCRITURA (cada una corre dentro de la transacción)
// ============================================================================

/**
 * Cobro. d = { idCliente, idsCargos[], monto, metodo, operacion, fechaPago?, gps?, obs?, fotoBase64? }
 * Sin fechaPago, un cobro offline usa la fecha del celular (cuando realmente se cobró).
 */
function acc_registrarPago_(ctx, d, u, meta) {
  var fecha = d.fechaPago ? aDia(d.fechaPago) : (meta.fDispositivo ? aDia(meta.fDispositivo) : hoyDia());
  // (Fase 6: aquí se guarda la foto del voucher en Drive y se genera el PDF.)
  var r = op_registrarPago(ctx, {
    idCliente: String(d.idCliente || ''), cargos: d.idsCargos || [], monto: d.monto, metodo: d.metodo,
    operacion: d.operacion, fecha: fecha, usuario: u.email, obs: d.obs, idSolicitud: meta.idSolicitud,
    foto: '', gps: d.gps ? String(d.gps) : '', origen: meta.origen, fDispositivo: meta.fDispositivo
  });
  return { estado: 'Válido', nroRecibo: r.nro, monto: r.monto, periodos: r.periodos, saldoRestante: r.saldoRestante, urlPdf: '' };
}

/**
 * Cobro offline en conflicto → PagosRevisar, SIN número de recibo (decisión D2).
 * Se ejecuta en su propia transacción (los cambios del intento fallido nunca se escribieron).
 */
function enviarARevision_(d, email, id, extra, motivo) {
  return transaccion(function (ctx) {
    ctx.idSolicitud = id;
    var previa = solicitudPrevia_(ctx, id);
    if (previa) { previa.repetido = true; return previa; }
    var u = exigirUsuario_(ctx, email, ROL_TODOS);
    var fDisp = fechaHoraDe_(extra.fDispositivo);
    var fecha = d.fechaPago ? aDia(d.fechaPago) : (fDisp ? aDia(fDisp) : hoyDia());
    var ic = buscar(ctx, 'Clientes', 'ID_CLIENTE', String(d.idCliente || ''));
    var cliente = ic >= 0 ? val(ctx.t('Clientes'), ic, 'NOMBRES') : '(cliente no encontrado)';
    nuevaFila(ctx, 'PagosRevisar', {
      ID_SOLICITUD: id, F_COBRO: fecha === null ? '' : deDia(fecha), F_RECIBIDA: new Date(), USUARIO: u.email,
      ID_CLIENTE: String(d.idCliente || ''), CLIENTE: cliente, IDS_CARGOS: (d.idsCargos || []).join(','), MONTO: r2(d.monto),
      METODO: String(d.metodo || ''), OPERACION: String(d.operacion || ''), GPS: d.gps ? String(d.gps) : '',
      OBS: String(d.obs || '').substr(0, 250), MOTIVO_CONFLICTO: motivo, ESTADO: 'A revisar'
    });
    bitacora(ctx, u.email, 'PAGO_A_REVISAR', 'PagosRevisar', id, soles(d.monto) + ' de ' + cliente + ': ' + motivo, 'A_REVISAR');
    var res = respOk_({ estado: 'A revisar', nroRecibo: '', motivo: motivo,
      mensaje: 'Cobro recibido sin señal que choca con otro pago. Queda "A revisar": el ADMIN decidirá. No se emitió recibo oficial.' });
    registrarSolicitud_(ctx, id, u.email, 'registrarPago', { origen: 'offline', fDispositivo: fDisp }, res);
    return res;
  });
}

/**
 * El ADMIN resuelve un cobro "A revisar".
 * d = { idRevision, resolucion: 'APLICAR' | 'ADELANTO' | 'DEVOLVER', idsCargos?: [...], motivo }
 *   APLICAR  → se aplica a los meses que el ADMIN elige (idsCargos) y se emite el recibo.
 *   ADELANTO → se aplica a las cuotas FUTURAS del cliente, de la más antigua a la más nueva.
 *   DEVOLVER → se devuelve el dinero: se cierra sin recibo.
 * El recibo queda a nombre del cobrador que recibió el dinero (para su cuadre de caja) y con la fecha real del cobro.
 */
function acc_resolverRevision_(ctx, d, u, meta) {
  var idR = String(d.idRevision || '');
  var t = ctx.t('PagosRevisar'), i = buscar(ctx, 'PagosRevisar', 'ID_SOLICITUD', idR);
  if (i < 0) throw errNeg('No existe el cobro en revisión ' + idR + '.');
  if (String(val(t, i, 'ESTADO')) !== 'A revisar') throw errNeg('Ese cobro ya fue resuelto (' + val(t, i, 'RESOLUCION') + ').');
  var motivo = String(d.motivo || '').trim();
  if (motivo.length < 4) throw errNeg('Indique el motivo de la decisión (mínimo 4 letras).');
  var res = String(d.resolucion || '').toUpperCase();
  if (['APLICAR', 'ADELANTO', 'DEVOLVER'].indexOf(res) < 0) throw errNeg('Resolución inválida: use APLICAR, ADELANTO o DEVOLVER.');

  var nro = '';
  if (res !== 'DEVOLVER') {
    var idCli = String(val(t, i, 'ID_CLIENTE')), monto = r2(val(t, i, 'MONTO')), ids = d.idsCargos || [];
    if (res === 'ADELANTO') ids = cuotasParaAdelanto_(ctx, idCli, monto);
    if (!ids.length) throw errNeg('Seleccione los meses a los que se aplica el dinero.');
    var cobrador = String(val(t, i, 'USUARIO')), uc = usuarioDe(ctx, cobrador);
    var r = op_registrarPago(ctx, {
      idCliente: idCli, cargos: ids, monto: monto, metodo: String(val(t, i, 'METODO')), operacion: val(t, i, 'OPERACION'),
      fecha: aDia(val(t, i, 'F_COBRO')), usuario: uc && uc.activo ? cobrador : u.email,
      obs: ('Revisión ' + res + ' por ' + u.email + ': ' + motivo).substr(0, 250), idSolicitud: 'REV-' + idR,
      gps: val(t, i, 'GPS'), origen: 'offline'
    });
    nro = r.nro;
  }
  setV(ctx, 'PagosRevisar', i, 'ESTADO', 'Resuelto');
  setV(ctx, 'PagosRevisar', i, 'RESOLUCION', res);
  setV(ctx, 'PagosRevisar', i, 'N_RECIBO_FINAL', nro);
  setV(ctx, 'PagosRevisar', i, 'RESUELTO_POR', u.email);
  setV(ctx, 'PagosRevisar', i, 'F_RESOLUCION', new Date());
  setV(ctx, 'PagosRevisar', i, 'MOTIVO_RESOLUCION', motivo.substr(0, 250));
  bitacora(ctx, u.email, 'RESOLVER_REVISION', 'PagosRevisar', idR, res + (nro ? ' → ' + nro : '') + ' | ' + motivo);
  return { idRevision: idR, resolucion: res, nroRecibo: nro };
}

/** Cuotas futuras con saldo (de la más antigua a la más nueva) hasta cubrir el monto. */
function cuotasParaAdelanto_(ctx, idCli, monto) {
  recalcularClientes(ctx, [idCli]);
  var t = ctx.t('Cargos'), mes = inicioMes(hoyDia()), lista = [];
  buscarTodos(ctx, 'Cargos', 'ID_CLIENTE', idCli).forEach(function (i) {
    if (aDia(val(t, i, 'PERIODO')) > mes && num(val(t, i, 'SALDO')) > 0.004 && String(val(t, i, 'ANULADO')) !== SI) {
      lista.push({ id: String(val(t, i, 'ID_CARGO')), per: aDia(val(t, i, 'PERIODO')), saldo: num(val(t, i, 'SALDO')) });
    }
  });
  lista.sort(function (a, b) { return a.per - b.per; });
  var ids = [], acum = 0;
  for (var k = 0; k < lista.length && acum < monto - 0.004; k++) { ids.push(lista[k].id); acum = r2(acum + lista[k].saldo); }
  if (acum < monto - 0.004) throw errNeg('Las cuotas futuras del cliente (' + soles(acum) + ') no alcanzan para ' + soles(monto) +
    '. Renueve el año, aplique a meses vencidos (APLICAR) o devuelva el dinero.');
  return ids;
}

/** d = { nroRecibo, motivo } */
function acc_anularPago_(ctx, d, u) {
  return op_anularPago(ctx, { nro: String(d.nroRecibo || ''), motivo: d.motivo, usuario: u.email });
}

/** d = { idServ, tipo: 'CORTE' | 'SUSPENSION' | 'BAJA', fecha?, motivo, cobrarMesCorte? (por defecto true) } */
function acc_cambiarEstadoServicio_(ctx, d, u) {
  var nuevo = { CORTE: E_CORTADO, SUSPENSION: E_SUSPENDIDO, BAJA: E_BAJA }[String(d.tipo || '').toUpperCase()];
  if (!nuevo) throw errNeg('Tipo inválido: use CORTE, SUSPENSION o BAJA.');
  return op_cambiarEstadoServicio(ctx, { idServ: String(d.idServ || ''), nuevo: nuevo, fecha: d.fecha || hoyDia(),
    motivo: d.motivo, cobrarMesCorte: d.cobrarMesCorte !== false, usuario: u.email });
}

/** d = { idServ, fecha?, codigoPPPoE, tarifa?, motivo } */
function acc_reactivarServicio_(ctx, d, u) {
  return op_reactivarServicio(ctx, { idServ: String(d.idServ || ''), fecha: d.fecha || hoyDia(), codigoPPPoE: d.codigoPPPoE,
    tarifa: d.tarifa, motivo: d.motivo, usuario: u.email });
}

/** d = { cliente: {...} }. Sin ID_CLIENTE = alta; con ID_CLIENTE = edición de los campos enviados. */
function acc_guardarCliente_(ctx, d, u) {
  var c = d.cliente || {};
  if (c.ID_CLIENTE) return op_editarCliente(ctx, c, u.email);
  return op_nuevoCliente(ctx, c, u.email);
}

/** d = { idCliente, plan, modo?, tarifa?, codigoPPPoE?, fecha?, montoInstalacion? } */
function acc_nuevoServicio_(ctx, d, u) {
  return op_nuevoServicio(ctx, { idCliente: String(d.idCliente || ''), plan: d.plan, modo: d.modo, tarifa: d.tarifa,
    pppoe: d.codigoPPPoE, fechaInicio: d.fecha || hoyDia(), montoInstalacion: d.montoInstalacion || 0, usuario: u.email });
}

/** d = { idServ, plan, modo?, tarifa?, desde } */
function acc_cambiarPlan_(ctx, d, u) {
  return op_cambiarPlan(ctx, { idServ: String(d.idServ || ''), plan: d.plan, modo: d.modo, tarifa: d.tarifa,
    desde: d.desde || hoyDia(), usuario: u.email });
}

/** d = { op: 'asignar' | 'liberar' | 'bloquear' | 'desbloquear' | 'agregar', codigo, idServ?, motivo?, titular?, fecha? } */
function acc_pppoe_(ctx, d, u) {
  var codigo = String(d.codigo || '').trim(), fecha = d.fecha || hoyDia();
  switch (String(d.op || '').toLowerCase()) {
    case 'asignar': return op_asignarPPPoE(ctx, { codigo: codigo, idServ: String(d.idServ || ''), fecha: fecha, usuario: u.email });
    case 'liberar': return op_liberarPPPoE(ctx, { codigo: codigo, fecha: fecha, motivo: d.motivo, usuario: u.email });
    case 'bloquear': return op_bloquearPPPoE(ctx, { codigo: codigo, bloquear: true, motivo: d.motivo, usuario: u.email });
    case 'desbloquear': return op_bloquearPPPoE(ctx, { codigo: codigo, bloquear: false, motivo: d.motivo, usuario: u.email });
    case 'agregar': return op_agregarCodigoPPPoE(ctx, { codigo: codigo, titular: d.titular, usuario: u.email });
    default: throw errNeg('Operación PPPoE inválida: use asignar, liberar, bloquear, desbloquear o agregar.');
  }
}

/** d = { anio } */
function acc_renovarAnio_(ctx, d, u) {
  return op_renovarAnio(ctx, { anio: parseInt(d.anio, 10) || partesDia(hoyDia()).a + 1, usuario: u.email });
}

/** Mantenimiento: d = { anio } (solo años cerrados; tiene su propio candado y respaldo previo). */
function acc_archivarAnio_(d, email) {
  return { resultado: archivarAnio(parseInt(d.anio, 10), email) };
}

// ============================================================================
// LOTE: COLA DE OPERACIONES HECHAS SIN SEÑAL
// ============================================================================

/**
 * d = { operaciones: [ { accion, idSolicitud, datos, fDispositivo, origen? }, ... ] } en el orden en que se hicieron.
 * Cada operación es independiente (su propia transacción). Devuelve un resultado por operación.
 */
function acc_procesarCola_(d, email) {
  var ops = d.operaciones || [], inicio = Date.now(), resultados = [];
  if (ops.length > COLA_MAX_OPERACIONES) return respError_('Máximo ' + COLA_MAX_OPERACIONES + ' operaciones por envío.', 'VALIDACION');
  for (var k = 0; k < ops.length; k++) {
    var op = ops[k] || {}, def = ACCIONES[op.accion], r;
    if (Date.now() - inicio > COLA_MAX_MS) r = respError_('Tiempo agotado en este envío: se reintenta en el siguiente.', 'OCUPADO');
    else if (!def || def.tipo !== 'escritura') r = respError_('Acción no permitida en la cola: "' + op.accion + '".', 'ACCION_DESCONOCIDA');
    else r = ejecutarAccion(op.accion, op.datos, email, op.idSolicitud, { fDispositivo: op.fDispositivo, origen: op.origen || 'offline' });
    r.idSolicitud = op.idSolicitud;
    resultados.push(r);
    if (r.codigoError === 'NO_AUTORIZADO') break;        // usuario desactivado: no seguir
  }
  return respOk_({ resultados: resultados });
}
