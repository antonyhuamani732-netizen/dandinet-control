/**
 * CLIENTES Y SERVICIOS (traducción de modClientes)
 * --------------------------------------------------------------------------
 * - Alta de clientes con validaciones (DNI/RUC único, celular, obligatorios).
 * - Alta de servicios: plan, tarifa, PPPoE, cuotas hasta diciembre e instalación.
 * Los IDs se generan solos: CLI-0137, SRV-0133…
 */

/**
 * d = { DNI_RUC, NOMBRES, TELEFONO, TELEFONO2, DIRECCION, REFERENCIA, ZONA, COORDENADAS, FECHA_ALTA,
 *       DIA_VENC, OBSERVACIONES, USUARIO_WIFI, CLAVE_WIFI, USUARIO_ROUTER, CLAVE_ROUTER }
 */
function op_nuevoCliente(ctx, d, usuario) {
  exigirRol(ctx, usuario, ['ADMIN']);
  var s = function (k) { return String(d[k] === undefined || d[k] === null ? '' : d[k]).trim(); };
  var doc = s('DNI_RUC'), tel = s('TELEFONO'), tel2 = s('TELEFONO2');
  if (!docValido(doc)) throw errNeg('DNI/RUC inválido: el DNI debe tener 8 dígitos y el RUC 11 (empieza con 10, 15, 17 o 20).');
  if (!s('NOMBRES')) throw errNeg('El nombre es obligatorio.');
  if (!telefonoValido(tel)) throw errNeg('Teléfono inválido: debe tener 9 dígitos y empezar con 9.');
  if (tel2 && !telefonoValido(tel2)) throw errNeg('Teléfono 2 inválido (9 dígitos, empieza con 9) o déjelo vacío.');
  if (!s('DIRECCION')) throw errNeg('La dirección es obligatoria.');
  var zona = s('ZONA').toUpperCase();
  if (!zona) throw errNeg('Seleccione la zona.');
  var zonas = lista(ctx, 'ZONA');
  if (zonas.length && zonas.indexOf(zona) < 0) throw errNeg('La zona "' + zona + '" no está en la lista. Agréguela primero en Listas.');
  var alta = aDia(d.FECHA_ALTA);
  if (alta === null) throw errNeg('Fecha de alta inválida.');
  var dia = s('DIA_VENC') === '' ? diaVencDefecto() : parseInt(s('DIA_VENC'), 10);
  if (!(dia >= 1 && dia <= 28)) throw errNeg('El día de vencimiento debe estar entre 1 y 28.');
  var dup = buscar(ctx, 'Clientes', 'DNI_RUC', doc);
  if (dup >= 0) throw errNeg('El DNI/RUC ' + doc + ' ya está registrado: ' + val(ctx.t('Clientes'), dup, 'ID_CLIENTE') + ' ' +
    val(ctx.t('Clientes'), dup, 'NOMBRES') + '.');

  var id = siguienteId(ctx, 'Clientes', 'ID_CLIENTE', 'CLI-', 4);
  nuevaFila(ctx, 'Clientes', {
    ID_CLIENTE: id, DNI_RUC: doc, NOMBRES: s('NOMBRES').toUpperCase(), TELEFONO: tel, TELEFONO2: tel2,
    DIRECCION: s('DIRECCION').toUpperCase(), REFERENCIA: s('REFERENCIA'), ZONA: zona, COORDENADAS: s('COORDENADAS'),
    FECHA_ALTA: deDia(alta), DIA_VENC: dia, OBSERVACIONES: s('OBSERVACIONES'), F_MODIF: new Date(), USR_MODIF: usuario
  });
  nuevaFila(ctx, 'ClientesPriv', { ID_CLIENTE: id, USUARIO_WIFI: s('USUARIO_WIFI'), CLAVE_WIFI: s('CLAVE_WIFI'),
    USUARIO_ROUTER: s('USUARIO_ROUTER'), CLAVE_ROUTER: s('CLAVE_ROUTER') });
  tocar(ctx, id);
  bitacora(ctx, usuario, 'NUEVO_CLIENTE', 'Clientes', id, s('NOMBRES') + ' ' + doc);
  return { idCliente: id };
}

/**
 * p = { idCliente, plan, modo, tarifa, pppoe, fechaInicio, montoInstalacion, usuario }
 * Devuelve { idServ, cuotas }.
 */
function op_nuevoServicio(ctx, p) {
  exigirRol(ctx, p.usuario, ['ADMIN']);
  var tC = ctx.t('Clientes'), fc = buscar(ctx, 'Clientes', 'ID_CLIENTE', p.idCliente);
  if (fc < 0) throw errNeg('Primero registre el cliente.');
  if (!p.plan) throw errNeg('Seleccione el plan.');
  var tarifa = r2(p.tarifa);
  if (!(tarifa > 0)) {
    var ip = buscar(ctx, 'Planes', 'PLAN', p.plan);
    tarifa = ip >= 0 ? r2(val(ctx.t('Planes'), ip, 'TARIFA')) : 0;
  }
  if (!(tarifa > 0)) throw errNeg('La tarifa mensual debe ser mayor a 0.');
  var ini = aDia(p.fechaInicio);
  if (ini === null) throw errNeg('Fecha de inicio inválida.');
  var codigo = String(p.pppoe || '').trim();
  if (codigo) {
    var fp = buscar(ctx, 'PPPoE', 'CODIGO', codigo);
    if (fp < 0) throw errNeg('El PPPoE ' + codigo + ' no existe.');
    if (String(val(ctx.t('PPPoE'), fp, 'ESTADO')) !== P_DISPONIBLE) throw errNeg('El PPPoE ' + codigo + ' no está disponible (' +
      val(ctx.t('PPPoE'), fp, 'ESTADO') + ' - ' + val(ctx.t('PPPoE'), fp, 'CLIENTE') + ').');
  }
  var idS = siguienteId(ctx, 'Servicios', 'ID_SERV', 'SRV-', 4);
  nuevaFila(ctx, 'Servicios', {
    ID_SERV: idS, ID_CLIENTE: p.idCliente, CLIENTE: val(tC, fc, 'NOMBRES'), ZONA: val(tC, fc, 'ZONA'), PLAN: p.plan,
    MODO: p.modo || '', TARIFA: tarifa, FECHA_INICIO: deDia(ini), ESTADO: E_ACTIVO, F_ESTADO: deDia(ini),
    MOTIVO_ESTADO: 'Alta de servicio'
  });
  if (codigo) asignarPPPoE_(ctx, codigo, idS, ini, p.usuario);
  var pi = partesDia(ini);
  var n = generarCargosServicio(ctx, idS, inicioMes(ini), diaDe(pi.a, 12, 1), 'MENSUALIDAD', -1, 'Alta');
  if (r2(p.montoInstalacion) > 0) n += generarCargosServicio(ctx, idS, inicioMes(ini), inicioMes(ini), 'INSTALACION', r2(p.montoInstalacion), 'Instalación');

  // ---- primer mes: se cobran solo los días restantes y vence el día del alta (+ días de gracia) ----
  // La instalación (precio variable) también vence el día del alta. Los meses siguientes siguen normales.
  var prorr = prorrateoAlta(tarifa, ini);
  var venceAlta = deDia(ini + (parseInt(cfg('DiasGraciaAlta'), 10) || 0));
  var idx = indiceCargos(ctx), tCar = ctx.t('Cargos');
  var iMes = idx[claveCargo(idS, ini, 'MENSUALIDAD')];
  if (prorr.aplica && iMes !== undefined) {
    setV(ctx, 'Cargos', iMes, 'MONTO', prorr.monto);
    setV(ctx, 'Cargos', iMes, 'VENCE_FIJO', venceAlta);
    setV(ctx, 'Cargos', iMes, 'OBS', 'Alta: ' + prorr.dias + ' de ' + prorr.diasMes + ' días (' + soles(tarifa) + ' × ' + prorr.dias + '/' + prorr.diasMes + ')');
  }
  var iIns = idx[claveCargo(idS, ini, 'INSTALACION')];
  if (iIns !== undefined) setV(ctx, 'Cargos', iIns, 'VENCE_FIJO', venceAlta);
  registrarHistorial(ctx, p.idCliente, idS, '', E_ACTIVO, 'Alta de servicio ' + p.plan, ini, p.usuario);
  tocar(ctx, p.idCliente);
  bitacora(ctx, p.usuario, 'NUEVO_SERVICIO', 'Servicios', idS, p.idCliente + ' ' + p.plan + ' ' + soles(tarifa) + (codigo ? ' PPPoE ' + codigo : '') +
    (prorr.aplica ? ' | 1.er mes prorrateado ' + soles(prorr.monto) : ''));
  return { idServ: idS, cuotas: n, primerMes: prorr.aplica ? prorr.monto : tarifa, instalacion: r2(p.montoInstalacion) || 0 };
}

/**
 * Prorrateo del mes de alta: tarifa × días restantes / días del mes (contando el día de instalación).
 * Alta el día 1 (o ProrratearAlta = No) → mes completo.
 * Ejemplo: S/ 50, alta el 15/10 → 17 de 31 días → S/ 27.42.
 */
function prorrateoAlta(tarifa, diaAlta) {
  var p = partesDia(diaAlta), diasMes = new Date(Date.UTC(p.a, p.m, 0)).getUTCDate();
  var dias = diasMes - p.d + 1;
  var aplica = p.d > 1 && String(cfg('ProrratearAlta')) !== NO;
  return { aplica: aplica, dias: dias, diasMes: diasMes, monto: aplica ? r2(tarifa * dias / diasMes) : r2(tarifa) };
}

// ---- Versiones públicas ----------------------------------------------------------------
function nuevoCliente(datos, usuario) {
  return transaccion(function (ctx) { return op_nuevoCliente(ctx, datos, usuario || usuarioActual()); });
}
function nuevoServicio(idCliente, plan, modo, tarifa, pppoe, fechaInicio, montoInstalacion, usuario) {
  return transaccion(function (ctx) {
    return op_nuevoServicio(ctx, { idCliente: idCliente, plan: plan, modo: modo, tarifa: tarifa, pppoe: pppoe,
      fechaInicio: fechaInicio, montoInstalacion: montoInstalacion, usuario: usuario || usuarioActual() });
  });
}
