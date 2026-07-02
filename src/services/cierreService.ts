import { supabase } from './supabase';

export interface SaldoCuentaCierre {
  id: string;
  codigo_cuenta: string;
  nombre: string;
  tipo: string;
  saldo: number;
}

/**
 * Servicio para gestionar los cierres y reaperturas de ejercicios contables.
 */
export const CierreService = {
  /**
   * Obtiene los saldos de ingresos y gastos de un año específico.
   */
  async obtenerSaldosResultados(empresaId: string, anio: number): Promise<{
    saldos: SaldoCuentaCierre[];
    ingresos: number;
    gastos: number;
    resultado: number;
  }> {
    // 1. Obtener todas las cuentas de Ingresos y Gastos de la empresa
    const { data: accounts, error: accError } = await supabase
      .from('plan_cuentas')
      .select('id, codigo_cuenta, nombre, tipo')
      .eq('id_empresa', empresaId)
      .in('tipo', ['Ingreso', 'Gasto']);

    if (accError) throw accError;
    if (!accounts || accounts.length === 0) {
      return { saldos: [], ingresos: 0, gastos: 0, resultado: 0 };
    }

    // 2. Obtener los movimientos detallados de ese año
    const desde = `${anio}-01-01`;
    const hasta = `${anio}-12-31`;

    const { data: movements, error: movError } = await supabase
      .from('movimientos')
      .select('id_cuenta, debe, haber, transacciones!inner(fecha)')
      .eq('id_empresa', empresaId)
      .gte('transacciones.fecha', desde)
      .lte('transacciones.fecha', hasta);

    if (movError) throw movError;

    // 3. Agrupar saldos por cuenta (solo hojas / cuentas que acepten movimientos)
    const saldoMap = new Map<string, { debe: number; haber: number }>();
    (movements || []).forEach(m => {
      const current = saldoMap.get(m.id_cuenta) || { debe: 0, haber: 0 };
      current.debe += Number(m.debe || 0);
      current.haber += Number(m.haber || 0);
      saldoMap.set(m.id_cuenta, current);
    });

    let totalIngresos = 0;
    let totalGastos = 0;
    const saldos: SaldoCuentaCierre[] = [];

    accounts.forEach(acc => {
      const totals = saldoMap.get(acc.id);
      if (!totals) return;

      const esDeudora = acc.tipo === 'Gasto';
      const saldo = esDeudora ? (totals.debe - totals.haber) : (totals.haber - totals.debe);

      if (Math.abs(saldo) > 0.005) {
        if (acc.tipo === 'Ingreso') {
          totalIngresos += saldo;
        } else {
          totalGastos += saldo;
        }
        saldos.push({
          id: acc.id,
          codigo_cuenta: acc.codigo_cuenta,
          nombre: acc.nombre,
          tipo: acc.tipo,
          saldo
        });
      }
    });

    return {
      saldos,
      ingresos: totalIngresos,
      gastos: totalGastos,
      resultado: totalIngresos - totalGastos
    };
  },

  /**
   * Ejecuta el cierre del periodo contable.
   * Crea el asiento de cierre, el asiento de traspaso de utilidad/pérdida y bloquea la empresa.
   */
  async cerrarPeriodo(
    empresaId: string,
    anio: number,
    saldos: SaldoCuentaCierre[],
    resultado: number,
    cuentas: {
      resultadoEjercicioId: string;
      utilidadAcumuladaId?: string;
      perdidaAcumuladaId?: string;
    }
  ): Promise<void> {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id || null;

    // --- TRANSACCIÓN 1: Asiento de Cierre de Resultados (31 de Diciembre) ---
    // Zeroes out Ingresos y Gastos y los pasa a la cuenta de Resultado del Ejercicio (3.1.7.1)
    const { data: txCierre, error: txCierreErr } = await supabase
      .from('transacciones')
      .insert({
        id_empresa: empresaId,
        id_usuario: userId,
        fecha: `${anio}-12-31`,
        concepto: `Cierre automático de cuentas de resultados - Ejercicio ${anio}`,
        tipo_comprobante: 'Asiento de Cierre',
        numero_comprobante: `CIERRE-RESULTADOS-${anio}`
      })
      .select()
      .single();

    if (txCierreErr) throw txCierreErr;

    const movimientosCierre: any[] = [];
    saldos.forEach(s => {
      if (s.tipo === 'Ingreso') {
        // Ingreso (normalmente acreedor): se debita para cerrarse
        movimientosCierre.push({
          id_transaccion: txCierre.id,
          id_cuenta: s.id,
          id_empresa: empresaId,
          debe: Math.abs(s.saldo),
          haber: 0
        });
      } else {
        // Gasto (normalmente deudor): se acredita para cerrarse
        movimientosCierre.push({
          id_transaccion: txCierre.id,
          id_cuenta: s.id,
          id_empresa: empresaId,
          debe: 0,
          haber: Math.abs(s.saldo)
        });
      }
    });

    // Registrar la contrapartida en la cuenta de Resultado del Ejercicio
    if (resultado > 0) {
      // Utilidad (Haber para aumentar Patrimonio)
      movimientosCierre.push({
        id_transaccion: txCierre.id,
        id_cuenta: cuentas.resultadoEjercicioId,
        id_empresa: empresaId,
        debe: 0,
        haber: Math.abs(resultado)
      });
    } else if (resultado < 0) {
      // Pérdida (Debe para disminuir Patrimonio)
      movimientosCierre.push({
        id_transaccion: txCierre.id,
        id_cuenta: cuentas.resultadoEjercicioId,
        id_empresa: empresaId,
        debe: Math.abs(resultado),
        haber: 0
      });
    }

    const { error: movCierreErr } = await supabase.from('movimientos').insert(movimientosCierre);
    if (movCierreErr) {
      // Intentar limpiar la transacción
      await supabase.from('transacciones').delete().eq('id', txCierre.id);
      throw movCierreErr;
    }

    // --- TRANSACCIÓN 2: Asiento de Traspaso a Resultados Acumulados (1 de Enero del año siguiente) ---
    // Traslada el saldo de 3.1.7.1 a 3.1.6.1.1.1 o 3.1.6.1.2.1, dejando 3.1.7.1 en cero para el nuevo año
    const proxAnio = anio + 1;
    const cuentaDestinoId = resultado > 0 ? cuentas.utilidadAcumuladaId : cuentas.perdidaAcumuladaId;

    if (cuentaDestinoId && resultado !== 0) {
      const { data: txTraspaso, error: txTraspasoErr } = await supabase
        .from('transacciones')
        .insert({
          id_empresa: empresaId,
          id_usuario: userId,
          fecha: `${proxAnio}-01-01`,
          concepto: `Traspaso de resultado del ejercicio ${anio} a resultados acumulados`,
          tipo_comprobante: 'Asiento de Cierre',
          numero_comprobante: `TRASPASO-RESULTADOS-${anio}`
        })
        .select()
        .single();

      if (!txTraspasoErr) {
        const movimientosTraspaso = [
          // Reversar la cuenta de Resultado del Ejercicio (3.1.7.1)
          {
            id_transaccion: txTraspaso.id,
            id_cuenta: cuentas.resultadoEjercicioId,
            id_empresa: empresaId,
            debe: resultado > 0 ? Math.abs(resultado) : 0,
            haber: resultado < 0 ? Math.abs(resultado) : 0
          },
          // Acreditar/Debitar la cuenta de Resultados Acumulados
          {
            id_transaccion: txTraspaso.id,
            id_cuenta: cuentaDestinoId,
            id_empresa: empresaId,
            debe: resultado < 0 ? Math.abs(resultado) : 0,
            haber: resultado > 0 ? Math.abs(resultado) : 0
          }
        ];

        const { error: movTraspasoErr } = await supabase.from('movimientos').insert(movimientosTraspaso);
        if (movTraspasoErr) {
          await supabase.from('transacciones').delete().eq('id', txTraspaso.id);
        }
      }
    }

    // --- ACTUALIZAR FECHA DE BLOQUEO DE LA EMPRESA ---
    const { error: lockError } = await supabase
      .from('empresas_gestionadas')
      .update({ fecha_bloqueo: `${anio}-12-31` })
      .eq('id', empresaId);

    if (lockError) throw lockError;
  },

  /**
   * Reabre un periodo contable cerrado eliminando sus asientos de cierre y restableciendo la fecha de bloqueo.
   */
  async reabrirPeriodo(empresaId: string, anio: number): Promise<void> {
    // 1. Encontrar y eliminar las transacciones de cierre
    const { data: txsToDelete, error: selectErr } = await supabase
      .from('transacciones')
      .select('id')
      .eq('id_empresa', empresaId)
      .in('numero_comprobante', [`CIERRE-RESULTADOS-${anio}`, `TRASPASO-RESULTADOS-${anio}`]);

    if (selectErr) throw selectErr;

    if (txsToDelete && txsToDelete.length > 0) {
      const ids = txsToDelete.map(tx => tx.id);
      
      // Eliminar movimientos asociados
      const { error: delMovErr } = await supabase
        .from('movimientos')
        .delete()
        .in('id_transaccion', ids);
      if (delMovErr) throw delMovErr;

      // Eliminar transacciones
      const { error: delTxErr } = await supabase
        .from('transacciones')
        .delete()
        .in('id', ids);
      if (delTxErr) throw delTxErr;
    }

    // 2. Restablecer la fecha de bloqueo
    // Buscamos si hay un cierre del año anterior para dejar la fecha de bloqueo en el año anterior
    const anioAnterior = anio - 1;
    const { data: txAnterior } = await supabase
      .from('transacciones')
      .select('id')
      .eq('id_empresa', empresaId)
      .eq('numero_comprobante', `CIERRE-RESULTADOS-${anioAnterior}`)
      .maybeSingle();

    const nuevaFechaBloqueo = txAnterior ? `${anioAnterior}-12-31` : null;

    const { error: lockError } = await supabase
      .from('empresas_gestionadas')
      .update({ fecha_bloqueo: nuevaFechaBloqueo })
      .eq('id', empresaId);

    if (lockError) throw lockError;
  }
};
