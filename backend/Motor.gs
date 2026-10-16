/**
 * MOTOR DE CÁLCULO (traducción directa de modMotor.RecalcularTodo del Excel v2)
 * --------------------------------------------------------------------------
 * Recalcula TODO con arrays y mapas en memoria. No usa fórmulas en las hojas.
 *   Cargos         : PAGADO, SALDO, VENCE, DIAS_ATRASO, ESTADO, CLIENTE, ZONA, PLAN
 *   ResumenCliente : PLAN, TARIFA_MENSUAL, PPPOE, SERV_ACTIVOS, MESES_ADEUDA, DEUDA_VENCIDA,
 *                    DEUDA_TOTAL, ULT_PAGO, DIAS_ATRASO, ESTADO, ALERTA
 *   Servicios      : CLIENTE, ZONA        PPPoE : CLIENTE
 *
 * Regla: deuda = cargos facturados (no anulados) − pagos aplicados (no anulados).
 *
 * El motor es una función PURA (calcularMotor) que recibe las tablas en memoria.
 * Por eso se puede probar fuera de Google con los mismos datos (carpeta pruebas-local).
 */

var TABLAS_MOTOR = ['Clientes', 'Servicios', 'Cargos', 'PagosDet', 'PPPoE', 'ResumenCliente'];

/**
 * Recalcula y escribe en las hojas.
 * opc (opcional): { hoy: 'aaaa-mm-dd', diaVenc: 1..28 (fuerza el día para todos), escribir: true }
 * Devuelve el resumen de totales.
 */
function recalcularTodo(opc) {
  opc = opc || {};
  var T = leerTablas(TABLAS_MOTOR);
  var res = calcularMotor(T, opc);
  if (opc.escribir !== false) {
    escribirColumnas(T.Cargos, ['PAGADO', 'SALDO', 'VENCE', 'DIAS_ATRASO', 'ESTADO', 'CLIENTE', 'ZONA', 'PLAN']);
    escribirColumnas(T.Servicios, ['CLIENTE', 'ZONA']);
    escribirColumnas(T.PPPoE, ['CLIENTE']);
    reemplazarCuerpo(T.ResumenCliente);
    if (!opc.hoy) setCfg('FechaCalculo', Utilities.formatDate(new Date(), 'America/Lima', 'dd/MM/yyyy HH:mm'));
  }
  return res;
}

/**
 * Núcleo del cálculo. Modifica las tablas en memoria y devuelve totales.
 * T debe tener: Clientes, Servicios, Cargos, PagosDet, PPPoE, ResumenCliente.
 */
function calcularMotor(T, opc) {
  opc = opc || {};
  var hoy = opc.hoy ? aDia(opc.hoy) : hoyDia();
  var mesActual = inicioMes(hoy);
  var diaForzado = opc.diaVenc ? parseInt(opc.diaVenc, 10) : 0;
  var diaDef = diaForzado || diaVencDefecto();
  var corte = diasParaCorte();

  var tCli = T.Clientes, tSrv = T.Servicios, tCar = T.Cargos, tDet = T.PagosDet, tPpp = T.PPPoE;
  var cC = tCli.c, cS = tSrv.c, cK = tCar.c, cD = tDet.c, cP = tPpp.c;

  // ---- 1. Clientes: id → fila, y acumuladores por cliente ----------------------
  var n = tCli.datos.length, dCli = {};
  var A = [];
  for (var k = 0; k < n; k++) {
    dCli[String(tCli.datos[k][cC.ID_CLIENTE])] = k;
    A.push({ plan: [], tar: 0, ppp: [], act: 0, cort: 0, susp: 0, nsrv: 0, meses: 0, venc: 0, tot: 0,
             dias: 0, porVencer: false, ult: null });
  }

  // ---- 2. Servicios: estado y datos por cliente --------------------------------
  var dSrv = {};
  tSrv.datos.forEach(function (f, i) {
    dSrv[String(f[cS.ID_SERV])] = i;
    var kk = dCli[String(f[cS.ID_CLIENTE])];
    if (kk === undefined) return;               // cliente inexistente: se deja como está
    var cli = tCli.datos[kk], a = A[kk];
    f[cS.CLIENTE] = cli[cC.NOMBRES];
    f[cS.ZONA] = cli[cC.ZONA];
    a.nsrv++;
    var est = String(f[cS.ESTADO]);
    if (est === E_ACTIVO) { a.act++; a.tar += num(f[cS.TARIFA]); a.plan.push(String(f[cS.PLAN])); }
    else if (est === E_CORTADO) a.cort++;
    else if (est === E_SUSPENDIDO) a.susp++;
    if (String(f[cS.PPPOE]) !== '') a.ppp.push(String(f[cS.PPPOE]));
  });

  // ---- 3. Pagos aplicados por cargo y último pago por cliente -------------------
  var dPag = {};
  tDet.datos.forEach(function (f) {
    if (String(f[cD.ANULADO]) === SI) return;
    var idc = String(f[cD.ID_CARGO]);
    dPag[idc] = (dPag[idc] || 0) + num(f[cD.MONTO_APLICADO]);
    var fp = aDia(f[cD.FECHA_PAGO]), kk = dCli[String(f[cD.ID_CLIENTE])];
    if (fp !== null && kk !== undefined && (A[kk].ult === null || fp > A[kk].ult)) A[kk].ult = fp;
  });

  // ---- 4. Cargos ----------------------------------------------------------------
  var tot = { facturado: 0, pagadoCargos: 0, saldo: 0, deudaVencida: 0, porCobrar: 0, cargos: tCar.datos.length };
  tCar.datos.forEach(function (f) {
    var kk = dCli[String(f[cK.ID_CLIENTE])];
    var diaV = diaDef;
    if (kk !== undefined) {
      var cli = tCli.datos[kk];
      var dc = parseInt(cli[cC.DIA_VENC], 10);
      if (!diaForzado && dc >= 1 && dc <= 28) diaV = dc;
      f[cK.CLIENTE] = cli[cC.NOMBRES];
      f[cK.ZONA] = cli[cC.ZONA];
    }
    var si = dSrv[String(f[cK.ID_SERV])];
    if (si !== undefined) f[cK.PLAN] = tSrv.datos[si][cS.PLAN];

    var per = aDia(f[cK.PERIODO]);
    if (per === null) per = mesActual;
    // vencimiento especial (primer mes prorrateado / instalación) o el día de vencimiento normal
    var vence = (cK.VENCE_FIJO !== undefined ? aDia(f[cK.VENCE_FIJO]) : null);
    if (vence === null) vence = fechaVence(per, diaV);
    var monto = r2(f[cK.MONTO]);
    var pag = r2(dPag[String(f[cK.ID_CARGO])] || 0);
    var dias = 0, saldo, est;

    if (String(f[cK.ANULADO]) === SI) {
      saldo = 0; est = C_ANULADO;
    } else {
      tot.facturado += monto;
      tot.pagadoCargos += pag;
      saldo = r2(monto - pag);
      if (saldo < 0) saldo = 0;
      if (monto === 0 && pag === 0) {
        est = C_SINPRECIO;
      } else if (saldo <= 0.004) {
        est = C_PAGADO;
      } else {
        if (hoy > vence) dias = hoy - vence;
        if (pag > 0) est = C_PARCIAL;
        else if (dias > 0) est = C_VENCIDO;
        else if (per <= hoy) est = C_PORVENCER;
        else est = C_PENDIENTE;
        if (kk !== undefined) {
          var a = A[kk];
          if (dias > 0) {
            a.venc += saldo; a.meses++;
            if (dias > a.dias) a.dias = dias;
          } else if (per <= hoy) {
            a.porVencer = true;
          }
          if (per <= mesActual) a.tot += saldo;
        }
        if (dias > 0) tot.deudaVencida += saldo;
        if (per <= mesActual) tot.porCobrar += saldo;
      }
      tot.saldo += saldo;
    }
    f[cK.PAGADO] = pag;
    f[cK.SALDO] = saldo;
    f[cK.VENCE] = deDia(vence);
    f[cK.DIAS_ATRASO] = dias;
    f[cK.ESTADO] = est;
  });

  // ---- 5. Resumen por cliente ---------------------------------------------------
  var ahora = new Date(), resumen = [], cR = T.ResumenCliente.c, ancho = T.ResumenCliente.enc.length;
  var cuenta = {};
  for (k = 0; k < n; k++) {
    var a = A[k], cli = tCli.datos[k], estC, alerta = '';
    if (a.act > 0) estC = a.venc > 0.004 ? E_MOROSO : E_ACTIVO;
    else if (a.susp > 0) estC = E_SUSPENDIDO;
    else if (a.cort > 0) estC = E_CORTADO;
    else estC = E_BAJA;

    if (estC === E_MOROSO && a.dias >= corte) alerta = 'A CORTAR';
    else if (estC === E_MOROSO) alerta = 'Moroso ' + a.dias + ' d';
    else if (a.porVencer && estC === E_ACTIVO) alerta = 'Por vencer';

    var plan = a.plan.length ? a.plan.join(' + ') : (a.nsrv > 0 ? '(sin servicio activo)' : '(sin servicio)');
    var fila = new Array(ancho).fill('');
    fila[cR.ID_CLIENTE] = cli[cC.ID_CLIENTE];
    fila[cR.NOMBRES] = cli[cC.NOMBRES];
    fila[cR.ZONA] = cli[cC.ZONA];
    fila[cR.PLAN] = plan;
    fila[cR.TARIFA_MENSUAL] = r2(a.tar);
    fila[cR.PPPOE] = a.ppp.join(', ');
    fila[cR.SERV_ACTIVOS] = a.act;
    fila[cR.MESES_ADEUDA] = a.meses;
    fila[cR.DEUDA_VENCIDA] = r2(a.venc);
    fila[cR.DEUDA_TOTAL] = r2(a.tot);
    fila[cR.ULT_PAGO] = a.ult === null ? '' : deDia(a.ult);
    fila[cR.DIAS_ATRASO] = a.dias;
    fila[cR.ESTADO] = estC;
    fila[cR.ALERTA] = alerta;
    fila[cR.F_CALCULO] = ahora;
    resumen.push(fila);
    cuenta[estC] = (cuenta[estC] || 0) + 1;
    if (alerta === 'A CORTAR') cuenta.aCortar = (cuenta.aCortar || 0) + 1;
  }
  T.ResumenCliente.datos = resumen;

  // ---- 6. Nombre del cliente en PPPoE -------------------------------------------
  tPpp.datos.forEach(function (f) {
    var kk = dCli[String(f[cP.ID_CLIENTE])];
    if (kk !== undefined) f[cP.CLIENTE] = tCli.datos[kk][cC.NOMBRES];
  });

  Object.keys(tot).forEach(function (x) { tot[x] = r2(tot[x]); });
  tot.hoy = txtFecha(hoy);
  tot.clientes = n;
  tot.estados = cuenta;
  return tot;
}
