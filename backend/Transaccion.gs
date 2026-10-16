/**
 * TRANSACCIONES (validar → escribir → recalcular), con LockService
 * --------------------------------------------------------------------------
 * Apps Script no tiene "deshacer". Por eso cada operación:
 *   1. Toma el candado (LockService). Solo una operación escribe a la vez.
 *   2. Lee las tablas que necesita en un CONTEXTO en memoria.
 *   3. Valida TODO. Si algo falla, lanza un error y no se escribe nada.
 *   4. Hace los cambios en memoria (marca qué filas cambiaron).
 *   5. Recalcula en memoria a los clientes afectados.
 *   6. Escribe en la hoja SOLO las filas que cambiaron, en un orden seguro:
 *      primero el detalle, luego la cabecera y AL FINAL el contador de recibos (Config).
 *   7. Suelta el candado.
 */

/** Error de negocio: un mensaje claro para el usuario (no es una falla del sistema). */
function errNeg(msg) { var e = new Error(msg); e.negocio = true; return e; }

/**
 * Orden de escritura: primero los datos, después Solicitudes (idempotencia) y AL FINAL el contador (Config).
 * Si la ejecución se corta después de escribir el pago pero antes de Solicitudes, un reintento
 * encuentra el pago por su ID_SOLICITUD (en Pagos) y no lo duplica.
 */
var ORDEN_GUARDADO = ['PagosDet', 'Pagos', 'Comprobantes', 'PagosRevisar', 'Cargos', 'Servicios', 'PPPoE', 'HistPPPoE',
  'HistorialEstados', 'Clientes', 'ClientesPriv', 'ResumenCliente', 'Planes', 'Listas', 'Usuarios',
  'Solicitudes', 'Config'];

/**
 * Ejecuta fn(ctx) dentro del candado y guarda los cambios.
 * Si fn lanza un error, NO se escribe nada y el error sube a quien llamó.
 */
function transaccion(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw errNeg('El sistema está ocupado procesando otra operación. Intente de nuevo en un momento.');
  try {
    _cfgCache = null;                       // Config siempre fresca dentro del candado
    var ctx = abrirContexto();
    var res = fn(ctx);
    recalcularTocados(ctx);
    guardarContexto(ctx);
    if (ctx.bitacora.length) agregarFilas('Bitacora', ctx.bitacora);
    SpreadsheetApp.flush();
    return res;
  } finally {
    _cfgCache = null;
    lock.releaseLock();
  }
}

// ============================================================================
// CONTEXTO: tablas en memoria + registro de cambios
// ============================================================================

function abrirContexto() {
  var ctx = { tablas: {}, sucio: {}, largo: {}, tocados: {}, bitacora: [], avisos: [] };
  /** Devuelve la tabla (la lee la primera vez). */
  ctx.t = function (nombre) {
    if (!ctx.tablas[nombre]) {
      var t = leerTabla(nombre);
      ctx.tablas[nombre] = t; ctx.largo[nombre] = t.datos.length; ctx.sucio[nombre] = {};
    }
    return ctx.tablas[nombre];
  };
  return ctx;
}

/** Valor de una celda (fila i, columna por nombre). */
function val(t, i, col) { return t.datos[i][t.c[col]]; }

/** Cambia una celda en memoria y marca la fila para guardarla. */
function setV(ctx, nombre, i, col, valor) {
  var t = ctx.t(nombre);
  t.datos[i][t.c[col]] = valor;
  ctx.sucio[nombre][i] = true;
}

/** Agrega una fila (objeto columna→valor) y devuelve su índice. */
function nuevaFila(ctx, nombre, obj) {
  var t = ctx.t(nombre);
  var f = t.enc.map(function (c) { return obj[c] === undefined || obj[c] === null ? '' : obj[c]; });
  t.datos.push(f);
  return t.datos.length - 1;
}

/** Índice de la primera fila cuyo valor en `col` es `valor` (o -1). */
function buscar(ctx, nombre, col, valor) {
  var t = ctx.t(nombre), k = t.c[col], v = String(valor);
  for (var i = 0; i < t.datos.length; i++) if (String(t.datos[i][k]) === v) return i;
  return -1;
}

/** Todos los índices de filas cuyo valor en `col` es `valor`. */
function buscarTodos(ctx, nombre, col, valor) {
  var t = ctx.t(nombre), k = t.c[col], v = String(valor), r = [];
  for (var i = 0; i < t.datos.length; i++) if (String(t.datos[i][k]) === v) r.push(i);
  return r;
}

/** Siguiente ID correlativo: CLI-0137, SRV-0133, CRG-002856… (máximo existente + 1). */
function siguienteId(ctx, nombre, col, prefijo, digitos) {
  var t = ctx.t(nombre), k = t.c[col], mx = 0;
  t.datos.forEach(function (f) {
    var s = String(f[k]);
    if (s.indexOf(prefijo) === 0) { var n = parseInt(s.substr(prefijo.length), 10); if (n > mx) mx = n; }
  });
  return prefijo + ('000000000' + (mx + 1)).slice(-digitos);
}

/** Marca un cliente para recalcularlo al final de la transacción. */
function tocar(ctx, idCliente) { if (idCliente) ctx.tocados[String(idCliente)] = true; }

/** Agrega una línea a la Bitácora (se escribe al final, si todo salió bien). */
function bitacora(ctx, usuario, accion, entidad, idEntidad, detalle) {
  ctx.bitacora.push(ESQUEMA.Bitacora.cols.map(function (c) {
    return { ID: 'BIT-' + Utilities.getUuid().substr(0, 8).toUpperCase(), FECHA_HORA: new Date(), USUARIO: usuario,
             ACCION: accion, ENTIDAD: entidad, ID_ENTIDAD: idEntidad, DETALLE: String(detalle || '').substr(0, 500) }[c];
  }));
}

/** Escribe en la hoja solo lo que cambió: filas modificadas (en bloques contiguos) y filas nuevas. */
function guardarContexto(ctx) {
  var ahora = new Date();
  var nombres = ORDEN_GUARDADO.filter(function (n) { return ctx.tablas[n]; })
    .concat(Object.keys(ctx.tablas).filter(function (n) { return ORDEN_GUARDADO.indexOf(n) < 0; }));
  nombres.forEach(function (n) {
    var t = ctx.tablas[n], orig = ctx.largo[n], ancho = t.enc.length, h = t.hoja;
    // 0) sello ULT_MODIF en cada fila que cambió o es nueva (lo usa la sincronización incremental de la app)
    var kMod = t.c.ULT_MODIF;
    if (kMod !== undefined) {
      Object.keys(ctx.sucio[n]).forEach(function (k) { t.datos[Number(k)][kMod] = ahora; });
      for (var nn = orig; nn < t.datos.length; nn++) t.datos[nn][kMod] = ahora;
    }
    // a) filas existentes modificadas
    var idx = Object.keys(ctx.sucio[n]).map(Number).filter(function (i) { return i < orig; }).sort(function (a, b) { return a - b; });
    var i = 0;
    while (i < idx.length) {
      var j = i;
      while (j + 1 < idx.length && idx[j + 1] === idx[j] + 1) j++;
      var bloque = t.datos.slice(idx[i], idx[j] + 1).map(function (f) { return f.slice(0, ancho); });
      h.getRange(idx[i] + 2, 1, bloque.length, ancho).setValues(bloque);
      i = j + 1;
    }
    // b) filas nuevas, en una sola escritura
    if (t.datos.length > orig) {
      var nuevas = t.datos.slice(orig).map(function (f) { return f.slice(0, ancho); });
      var ultima = orig + 1 + nuevas.length;
      if (h.getMaxRows() < ultima) h.insertRowsAfter(h.getMaxRows(), ultima - h.getMaxRows());
      h.getRange(orig + 2, 1, nuevas.length, ancho).setValues(nuevas);
    }
  });
}

// ============================================================================
// RECÁLCULO POR CLIENTE (en memoria, con el mismo motor que recalcularTodo)
// ============================================================================

var COLS_CALC_CARGO = ['CLIENTE', 'PAGADO', 'SALDO', 'VENCE', 'DIAS_ATRASO', 'ESTADO', 'ZONA', 'PLAN'];

function _igual(a, b) {
  if (a instanceof Date || b instanceof Date) return aDia(a) === aDia(b);
  return a === b || (a === '' && b === null) || (a === null && b === '');
}

/** Recalcula los clientes indicados (o los "tocados" del contexto) y marca lo que cambió. */
function recalcularClientes(ctx, ids) {
  var set = {};
  (ids || Object.keys(ctx.tocados)).forEach(function (id) { set[String(id)] = true; });
  if (!Object.keys(set).length) return;
  var tCli = ctx.t('Clientes'), tSrv = ctx.t('Servicios'), tCar = ctx.t('Cargos'), tDet = ctx.t('PagosDet'),
      tRes = ctx.t('ResumenCliente'), tPpp = ctx.t('PPPoE');
  var filtra = function (t) {
    var k = t.c.ID_CLIENTE, r = [];
    t.datos.forEach(function (f, i) { if (set[String(f[k])]) r.push(i); });
    return r;
  };
  var iCar = filtra(tCar), iSrv = filtra(tSrv);
  // foto de las columnas calculadas antes del cálculo
  var antes = iCar.map(function (i) { return COLS_CALC_CARGO.map(function (c) { return tCar.datos[i][tCar.c[c]]; }); });
  var sub = {
    Clientes: { c: tCli.c, datos: filtra(tCli).map(function (i) { return tCli.datos[i]; }) },
    Servicios: { c: tSrv.c, datos: iSrv.map(function (i) { return tSrv.datos[i]; }) },
    Cargos: { c: tCar.c, datos: iCar.map(function (i) { return tCar.datos[i]; }) },
    PagosDet: { c: tDet.c, datos: filtra(tDet).map(function (i) { return tDet.datos[i]; }) },
    PPPoE: { c: tPpp.c, datos: [] },
    ResumenCliente: { c: tRes.c, enc: tRes.enc, datos: [] }
  };
  calcularMotor(sub, {});
  iCar.forEach(function (i, n) {
    var cambio = COLS_CALC_CARGO.some(function (c, j) { return !_igual(antes[n][j], tCar.datos[i][tCar.c[c]]); });
    if (cambio) ctx.sucio.Cargos[i] = true;
  });
  iSrv.forEach(function (i) { ctx.sucio.Servicios[i] = true; });
  // resumen: reemplaza la fila del cliente (o la agrega si es nuevo)
  sub.ResumenCliente.datos.forEach(function (fila) {
    var i = buscar(ctx, 'ResumenCliente', 'ID_CLIENTE', fila[tRes.c.ID_CLIENTE]);
    if (i < 0) { tRes.datos.push(fila); }
    else { tRes.datos[i] = fila; ctx.sucio.ResumenCliente[i] = true; }
  });
}

function recalcularTocados(ctx) { recalcularClientes(ctx, Object.keys(ctx.tocados)); }

/** Fila del ResumenCliente de un cliente (objeto columna→valor) o null. */
function resumenDe(ctx, idCliente) {
  var t = ctx.t('ResumenCliente'), i = buscar(ctx, 'ResumenCliente', 'ID_CLIENTE', idCliente);
  if (i < 0) return null;
  var o = {};
  t.enc.forEach(function (c, j) { o[c] = t.datos[i][j]; });
  return o;
}

// ============================================================================
// USUARIOS Y ROLES (segunda barrera: el script vuelve a comprobar el rol)
// ============================================================================

/** {email, rol, zonas[], parcial, activo} del usuario (o null si no existe). */
function usuarioDe(ctx, email) {
  var i = buscar(ctx, 'Usuarios', 'EMAIL', String(email || '').trim().toLowerCase());
  if (i < 0) {
    // búsqueda sin distinguir mayúsculas
    var t = ctx.t('Usuarios');
    for (var k = 0; k < t.datos.length; k++) if (String(val(t, k, 'EMAIL')).toLowerCase() === String(email).trim().toLowerCase()) { i = k; break; }
    if (i < 0) return null;
  }
  var tu = ctx.t('Usuarios');
  var rol = String(val(tu, i, 'ROL')).toUpperCase();
  var zonas = String(val(tu, i, 'ZONAS')).split(',').map(function (z) { return z.trim().toUpperCase(); }).filter(String);
  return {
    email: String(val(tu, i, 'EMAIL')), nombre: String(val(tu, i, 'NOMBRE')), rol: rol,
    iniciales: String(val(tu, i, 'INICIALES')).toUpperCase(),
    // "*" (o vacío) = todas las zonas
    todasZonas: !zonas.length || zonas.indexOf('*') >= 0, zonas: zonas,
    // Hoy todos son ADMIN y pueden cobrar parcial. Un futuro COBRADOR no podría (regla de la Opción A).
    parcial: rol === 'ADMIN',
    // Seguridad: solo se acepta ACTIVO = "Sí" (vacío o cualquier otro valor = inactivo)
    activo: String(val(tu, i, 'ACTIVO')).trim().toUpperCase().replace('SI', 'SÍ') === SI.toUpperCase()
  };
}

/** Lanza error si el usuario no tiene uno de los roles indicados. Devuelve el usuario. */
function exigirRol(ctx, email, roles) {
  var u = usuarioDe(ctx, email);
  if (!u || !u.activo) throw errNeg('El usuario ' + (email || '(vacío)') + ' no está registrado o está inactivo en la tabla Usuarios.');
  if (roles.indexOf(u.rol) < 0) throw errNeg('Su rol (' + u.rol + ') no permite esta acción. Requiere: ' + roles.join(' o ') + '.');
  return u;
}

/** Un COBRADOR solo opera clientes de sus zonas asignadas. */
function exigirZona(ctx, u, idCliente) {
  if (u.rol !== 'COBRADOR' || u.todasZonas) return;
  var i = buscar(ctx, 'Clientes', 'ID_CLIENTE', idCliente);
  var zona = i < 0 ? '' : String(val(ctx.t('Clientes'), i, 'ZONA')).toUpperCase();
  if (u.zonas.indexOf(zona) < 0) throw errNeg('El cliente es de la zona ' + zona + ', que no está asignada a ' + u.email + '.');
}

/** Usuario que ejecuta desde el editor (o el dueño del script en triggers). */
function usuarioActual() {
  var e = '';
  try { e = Session.getActiveUser().getEmail(); } catch (x) { /* sin permiso */ }
  if (!e) try { e = Session.getEffectiveUser().getEmail(); } catch (x2) { /* sin permiso */ }
  return e || 'SISTEMA';
}

/** Valores activos de una lista (Listas.TIPO). */
function lista(ctx, tipo) {
  var t = ctx.t('Listas'), r = [];
  t.datos.forEach(function (f) { if (String(f[t.c.TIPO]) === tipo && String(f[t.c.ACTIVO]) !== NO) r.push(String(f[t.c.VALOR])); });
  return r;
}

/** Reemplaza marcadores {NOMBRE} {DEUDA} {MESES} {PERIODOS} {DIA} {YAPE} {TITULAR} {BCP} {BN} {NEGOCIO} {TELEFONO}. */
function plantilla(ctx, txt, idCliente) {
  var r = resumenDe(ctx, idCliente) || {};
  var tC = ctx.t('Cargos'), per = [];
  buscarTodos(ctx, 'Cargos', 'ID_CLIENTE', idCliente).forEach(function (i) {
    if (num(val(tC, i, 'SALDO')) > 0 && num(val(tC, i, 'DIAS_ATRASO')) > 0) {
      var s = txtPeriodo(aDia(val(tC, i, 'PERIODO')));
      if (val(tC, i, 'ESTADO') === C_PARCIAL) s += ' (saldo ' + r2(val(tC, i, 'SALDO')).toFixed(2) + ')';
      per.push(s);
    }
  });
  var ic = buscar(ctx, 'Clientes', 'ID_CLIENTE', idCliente);
  var nombre = ic < 0 ? '' : val(ctx.t('Clientes'), ic, 'NOMBRES');
  return String(txt)
    .replace(/\{NOMBRE\}/g, nombre).replace(/\{DEUDA\}/g, soles(r.DEUDA_VENCIDA || 0))
    .replace(/\{MESES\}/g, String(r.MESES_ADEUDA || 0)).replace(/\{PERIODOS\}/g, per.join(', '))
    .replace(/\{YAPE\}/g, cfg('Yape')).replace(/\{BCP\}/g, cfg('BCP')).replace(/\{BN\}/g, cfg('BN'))
    .replace(/\{TITULAR\}/g, cfg('TitularCobro')).replace(/\{NEGOCIO\}/g, cfg('Negocio'))
    .replace(/\{TELEFONO\}/g, cfg('Telefono')).replace(/\{DIA\}/g, String(diaVencDefecto()))
    .replace(/\\n/g, '\n');
}

/** Enlace wa.me con el mensaje (o '' si el teléfono es inválido). */
function enlaceWhatsApp(telefono, mensaje) {
  if (!telefonoValido(telefono)) return '';
  return 'https://wa.me/51' + String(telefono).trim() + '?text=' + encodeURIComponent(mensaje);
}
