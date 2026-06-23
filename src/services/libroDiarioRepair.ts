import { supabase } from './supabase';
import { getNextNumeroComprobante } from './xmlSaveService';

export const runRepararAsientosTesoreria = async (
  empresaId: string,
  transactions: any[],
  showAlert: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void,
  setReparing: (val: boolean) => void,
  fetchTransactions: () => Promise<void>
) => {
  setReparing(true);
  try {
    const emptyTxs = transactions.filter(tx => 
      tx.tipo_comprobante !== 'Anulado' && 
      tx.movimientos.length === 0 && 
      (tx.concepto.includes('de Tesorería') || tx.concepto.includes('Pago CxC') || tx.tipo_comprobante === 'Egreso' || tx.tipo_comprobante === 'Ingreso')
    );

    const incorrectTxs = transactions.filter(tx => {
      if (tx.tipo_comprobante === 'Anulado') return false;
      if (tx.movimientos.length === 0) return false;
      const codes = tx.movimientos.map((m: any) => m.plan_cuentas?.codigo_cuenta);
      // 1. Caso anterior (1.1.1 y 1.1.4.3)
      if (tx.movimientos.length === 2 && codes.includes('1.1.1') && codes.includes('1.1.4.3')) return true;
      // 2. Caso de cuenta madre en asientos de tesorería
      const esTesoreria = tx.concepto.includes('de Tesorería') || tx.concepto.includes('Pago CxC') || tx.tipo_comprobante === 'Egreso' || tx.tipo_comprobante === 'Ingreso';
      if (esTesoreria && (codes.includes('2.1.1') || codes.includes('2.1') || codes.includes('2'))) return true;
      return false;
    });

    if (emptyTxs.length === 0 && incorrectTxs.length === 0) {
      showAlert("No se encontraron asientos de tesorería vacíos ni asientos con cuentas incorrectas para reparar.", "info");
      return;
    }

    const { data: qCuentas } = await supabase.from('plan_cuentas').select('id, codigo_cuenta, nombre').eq('id_empresa', empresaId);
    if (!qCuentas || qCuentas.length === 0) {
      showAlert("No se pudo obtener el plan de cuentas de la empresa.", "error");
      return;
    }

    const ctasBancos = qCuentas.filter(c => c.codigo_cuenta.startsWith('1.1.1') || c.nombre.toLowerCase().includes('banco') || c.nombre.toLowerCase().includes('caja'));
    const ctasCobrarMejores = qCuentas.filter(c => c.codigo_cuenta.startsWith('1.1.2.5') || c.nombre.toLowerCase().includes('cliente'));
    const ctasCobrarFallback = qCuentas.filter(c => c.codigo_cuenta.startsWith('1.1.2') || c.nombre.toLowerCase().includes('cobrar'));
    const ctasPagarMejores = qCuentas.filter(c => c.codigo_cuenta.startsWith('2.1.3') || c.nombre.toLowerCase().includes('proveedor'));
    const ctasPagarFallback = qCuentas.filter(c => c.codigo_cuenta.startsWith('2.1') || c.nombre.toLowerCase().includes('pagar'));

    const defaultBancoId = ctasBancos[0]?.id;
    const cxcId = ctasCobrarMejores[0]?.id || ctasCobrarFallback[0]?.id;
    const cxpId = ctasPagarMejores[0]?.id || ctasPagarFallback[0]?.id;

    let reparadosCount = 0;
    let corregidosCount = 0;

    // 1. REPARACIÓN DE ASIENTOS VACÍOS
    for (const tx of emptyTxs) {
      let { data: movsTesoreria } = await supabase
        .from('tesoreria_movimientos')
        .select('id, monto, tipo_movimiento, referencia, id_cuenta_financiera')
        .eq('id_empresa', empresaId)
        .eq('id_entidad', tx.id_entidad)
        .eq('fecha', tx.fecha);

      if (!movsTesoreria || movsTesoreria.length === 0) {
        const { data: movsByRef } = await supabase
          .from('tesoreria_movimientos')
          .select('id, monto, tipo_movimiento, referencia, id_cuenta_financiera')
          .eq('id_empresa', empresaId)
          .eq('referencia', tx.numero_comprobante);
        movsTesoreria = movsByRef;
      }

      if (movsTesoreria && movsTesoreria.length > 0) {
        const tm = movsTesoreria[0];
        const monto = Number(tm.monto) || 0;
        
        let bancoId = defaultBancoId;
        if (tm.id_cuenta_financiera) {
          const { data: ctaFin } = await supabase.from('cuentas_financieras').select('nombre').eq('id', tm.id_cuenta_financiera).single();
          if (ctaFin) {
            const matchedCta = qCuentas.find(c => c.nombre.toLowerCase().includes(ctaFin.nombre.toLowerCase()));
            if (matchedCta) bancoId = matchedCta.id;
          }
        }

        if (bancoId && ((tm.tipo_movimiento === 'Cobro' && cxcId) || (tm.tipo_movimiento === 'Pago' && cxpId))) {
          const payloadMovimientos = [];
          if (tm.tipo_movimiento === 'Cobro') {
            payloadMovimientos.push({ id_transaccion: tx.id, id_cuenta: bancoId, debe: monto, haber: 0, id_empresa: empresaId });
            payloadMovimientos.push({ id_transaccion: tx.id, id_cuenta: cxcId, debe: 0, haber: monto, id_empresa: empresaId });
          } else {
            payloadMovimientos.push({ id_transaccion: tx.id, id_cuenta: cxpId, debe: monto, haber: 0, id_empresa: empresaId });
            payloadMovimientos.push({ id_transaccion: tx.id, id_cuenta: bancoId, debe: 0, haber: monto, id_empresa: empresaId });
          }

          const { error: insertError } = await supabase.from('movimientos').insert(payloadMovimientos);
          if (!insertError) {
            reparadosCount++;
            
            if (!/^\d+$/.test(tx.numero_comprobante)) {
              const cleanNum = await getNextNumeroComprobante(empresaId);
              const refText = ` (Ref: ${tx.numero_comprobante})`;
              const newConcepto = tx.concepto.includes(tx.numero_comprobante) ? tx.concepto : tx.concepto + refText;
              
              await supabase.from('transacciones')
                .update({ numero_comprobante: cleanNum, concepto: newConcepto })
                .eq('id', tx.id);
            }
          }
        }
      }
    }

    // 2. CORRECCIÓN DE ASIENTOS CON CUENTAS INCORRECTAS
    for (const tx of incorrectTxs) {
      const codes = tx.movimientos.map((m: any) => m.plan_cuentas?.codigo_cuenta);
      
      // A) Caso 1.1.1 y 1.1.4.3 (anterior)
      if (tx.movimientos.length === 2 && codes.includes('1.1.1') && codes.includes('1.1.4.3')) {
        const mov111 = tx.movimientos.find((m: any) => m.plan_cuentas?.codigo_cuenta === '1.1.1');
        const mov1143 = tx.movimientos.find((m: any) => m.plan_cuentas?.codigo_cuenta === '1.1.4.3');

        if (mov111 && mov1143) {
          let correctBancoId = qCuentas.find(c => c.codigo_cuenta === '1.1.1.4')?.id;
          if (!correctBancoId) {
            correctBancoId = qCuentas.find(c => c.nombre.toLowerCase().includes('fondo rotativo'))?.id;
          }
          if (!correctBancoId) {
            correctBancoId = qCuentas.find(c => c.codigo_cuenta.startsWith('1.1.1.'))?.id || defaultBancoId;
          }

          let correctSupplierId = null;

          let { data: movsTesoreria } = await supabase
            .from('tesoreria_movimientos')
            .select('id, id_documento, monto, tipo_movimiento')
            .eq('id_empresa', empresaId)
            .eq('id_entidad', tx.id_entidad)
            .eq('fecha', tx.fecha);

          if (!movsTesoreria || movsTesoreria.length === 0) {
            const { data: movsByRef } = await supabase
              .from('tesoreria_movimientos')
              .select('id, id_documento, monto, tipo_movimiento')
              .eq('id_empresa', empresaId)
              .eq('referencia', tx.numero_comprobante);
            movsTesoreria = movsByRef;
          }

          if (movsTesoreria && movsTesoreria.length > 0 && movsTesoreria[0].id_documento) {
            const { data: doc } = await supabase
              .from('tesoreria_documentos')
              .select('id, referencia, origen, id_entidad')
              .eq('id', movsTesoreria[0].id_documento)
              .single();

            if (doc && doc.referencia) {
              let { data: invTx } = await supabase
                .from('transacciones')
                .select(`
                  id,
                  movimientos (
                    id_cuenta,
                    debe,
                    haber
                  )
                `)
                .eq('id_empresa', empresaId)
                .eq('id_entidad', doc.id_entidad)
                .like('concepto', `%${doc.referencia}%`)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

              if (!invTx) {
                const { data: invTxFallback } = await supabase
                  .from('transacciones')
                  .select(`
                    id,
                    movimientos (
                      id_cuenta,
                      debe,
                      haber
                    )
                  `)
                  .eq('id_empresa', empresaId)
                  .like('concepto', `%${doc.referencia}%`)
                  .order('created_at', { ascending: false })
                  .limit(1)
                  .maybeSingle();
                invTx = invTxFallback;
              }

              if (invTx && invTx.movimientos) {
                const matchedAcc = invTx.movimientos.find((m: any) => m.haber > 0);
                if (matchedAcc) {
                  correctSupplierId = matchedAcc.id_cuenta;
                }
              }
            }
          }

          if (!correctSupplierId) {
            correctSupplierId = cxpId;
          }

          if (correctBancoId && correctSupplierId) {
            const { error: err1 } = await supabase
              .from('movimientos')
              .update({ id_cuenta: correctBancoId })
              .eq('id', mov111.id);

            const { error: err2 } = await supabase
              .from('movimientos')
              .update({ id_cuenta: correctSupplierId })
              .eq('id', mov1143.id);

            if (!err1 && !err2) {
              corregidosCount++;
            }
          }
        }
      }
      // B) Caso de asientos de tesorería con cuentas madre o incorrectas como 2.1.1 en la contrapartida
      else {
        let { data: movsTesoreria } = await supabase
          .from('tesoreria_movimientos')
          .select('id, id_documento, monto, tipo_movimiento')
          .eq('id_empresa', empresaId)
          .eq('id_entidad', tx.id_entidad)
          .eq('fecha', tx.fecha);

        if (!movsTesoreria || movsTesoreria.length === 0) {
          const { data: movsByRef } = await supabase
            .from('tesoreria_movimientos')
            .select('id, id_documento, monto, tipo_movimiento')
            .eq('id_empresa', empresaId)
            .eq('referencia', tx.numero_comprobante);
          movsTesoreria = movsByRef;
        }

        if (movsTesoreria && movsTesoreria.length > 0 && movsTesoreria[0].id_documento) {
          const isPago = movsTesoreria[0].tipo_movimiento === 'Pago';
          let correctAccId = null;

          const { data: doc } = await supabase
            .from('tesoreria_documentos')
            .select('id, referencia, origen, id_entidad')
            .eq('id', movsTesoreria[0].id_documento)
            .single();

          if (doc && doc.referencia) {
            let { data: invTx } = await supabase
              .from('transacciones')
              .select(`
                id,
                movimientos (
                  id_cuenta,
                  debe,
                  haber
                )
              `)
              .eq('id_empresa', empresaId)
              .eq('id_entidad', doc.id_entidad)
              .like('concepto', `%${doc.referencia}%`)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (!invTx) {
              const { data: invTxFallback } = await supabase
                .from('transacciones')
                .select(`
                  id,
                  movimientos (
                    id_cuenta,
                    debe,
                    haber
                  )
                `)
                .eq('id_empresa', empresaId)
                .like('concepto', `%${doc.referencia}%`)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
              invTx = invTxFallback;
            }

            if (invTx && invTx.movimientos) {
              if (isPago) {
                const matchedAcc = invTx.movimientos.find((m: any) => m.haber > 0);
                if (matchedAcc) correctAccId = matchedAcc.id_cuenta;
              } else {
                const matchedAcc = invTx.movimientos.find((m: any) => m.debe > 0);
                if (matchedAcc) correctAccId = matchedAcc.id_cuenta;
              }
            }
          }

          if (!correctAccId) {
            correctAccId = isPago ? cxpId : cxcId;
          }

          if (correctAccId) {
            const counterMov = tx.movimientos.find((m: any) => isPago ? m.debe > 0 : m.haber > 0);
            if (counterMov && counterMov.id_cuenta !== correctAccId) {
              const { error: updErr } = await supabase
                .from('movimientos')
                .update({ id_cuenta: correctAccId })
                .eq('id', counterMov.id);

              if (!updErr) {
                corregidosCount++;
              }
            }
          }
        }
      }
    }

    if (reparadosCount > 0 || corregidosCount > 0) {
      let msg = 'Se completó la reparación de asientos:';
      if (reparadosCount > 0) msg += `\n- ${reparadosCount} asientos vacíos reparados.`;
      if (corregidosCount > 0) msg += `\n- ${corregidosCount} asientos con cuentas incorrectas corregidos.`;
      showAlert(msg, "success");
      await fetchTransactions();
    } else {
      showAlert("No se encontraron asientos de tesorería que requieran reparación o no se pudieron reparar.", "warning");
    }
  } catch (err: any) {
    console.error("Error al reparar asientos:", err);
    showAlert(`Error en reparación: ${err.message}`, "error");
  } finally {
    setReparing(false);
  }
};
