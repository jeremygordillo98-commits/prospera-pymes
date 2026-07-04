import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
import { getNextNumeroComprobante } from '../services/xmlSaveService';

export function useTesoreria(empresaId: string, mode: string) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [showCuentaForm, setShowCuentaForm] = useState(false);
  const [anulacionModal, setAnulacionModal] = useState<{ isOpen: boolean; movId: string; motivo: string }>({
    isOpen: false,
    movId: '',
    motivo: ''
  });

  const [cuentaForm, setCuentaForm] = useState({
    banco_seleccionado: 'Banco Pichincha',
    nombre: '',            
    tipo: 'Banco',         
    tipo_cuenta: 'Ahorro', 
    saldo_inicial: '0',
    moneda: 'USD',
    numero_referencia: ''  
  });
  const [movForm, setMovForm] = useState({
    fecha: new Date().toISOString().slice(0, 10),
    tipo_movimiento: mode === 'pagos' ? 'Pago' : 'Cobro',
    concepto: '', monto: '', id_cuenta_financiera: '', id_cuenta_banco_contable: '', id_entidad: '', id_documento: '', referencia: '', estado: 'Aplicado'
  });
  const [docForm, setDocForm] = useState({
    tipo_documento: mode === 'pagos' ? 'Cuenta por pagar' : 'Cuenta por cobrar',
    fecha_emision: new Date().toISOString().slice(0, 10), fecha_vencimiento: '', id_entidad: '', concepto: '', referencia: '', total: ''
  });

  const [editingMov, setEditingMov] = useState<any | null>(null);

  const handleOpenEditModal = async (mov: any) => {
    setSaving(true);
    try {
      let txId = null;
      let txMovements: any[] = [];
      const querySelect = 'id, concepto, numero_comprobante, movimientos (id, id_cuenta, debe, haber, plan_cuentas (codigo_cuenta, nombre))';

      if (mov.referencia) {
        const { data: txs } = await supabase.from('transacciones').select(querySelect).eq('id_empresa', empresaId).like('concepto', `%${mov.referencia}%`);
        const matched = txs?.find(t => (t.movimientos || []).some((m: any) => Number(m.debe) === Number(mov.monto) || Number(m.haber) === Number(mov.monto)));
        if (matched) { txId = matched.id; txMovements = matched.movimientos || []; }
      }

      if (!txId && mov.referencia) {
        const { data: txs } = await supabase.from('transacciones').select(querySelect).eq('id_empresa', empresaId).eq('numero_comprobante', mov.referencia);
        if (txs && txs.length > 0) { txId = txs[0].id; txMovements = txs[0].movimientos || []; }
      }

      if (!txId) {
        const { data: txs } = await supabase.from('transacciones').select(querySelect).eq('id_empresa', empresaId).eq('id_entidad', mov.id_entidad).eq('fecha', mov.fecha).in('tipo_comprobante', ['Ingreso', 'Egreso']);
        const matched = txs?.find(t => (t.movimientos || []).some((m: any) => Number(m.debe) === Number(mov.monto) || Number(m.haber) === Number(mov.monto)));
        if (matched) { txId = matched.id; txMovements = matched.movimientos || []; }
      }

      if (!txId) {
        const { data: txs } = await supabase.from('transacciones').select(querySelect).eq('id_empresa', empresaId).eq('fecha', mov.fecha).in('tipo_comprobante', ['Ingreso', 'Egreso']);
        const matched = txs?.find(t => (t.movimientos || []).some((m: any) => Number(m.debe) === Number(mov.monto) || Number(m.haber) === Number(mov.monto)));
        if (matched) { txId = matched.id; txMovements = matched.movimientos || []; }
      }

      let bankAccountId = '', contrapartidaAccountId = '', bankMovId = '', contrapartidaMovId = '';

      if (txMovements.length > 0) {
        const isPago = mov.tipo_movimiento === 'Pago';
        const bankMov = txMovements.find(m => isPago ? Number(m.haber) > 0 : Number(m.debe) > 0);
        const counterMov = txMovements.find(m => isPago ? Number(m.debe) > 0 : Number(m.haber) > 0);
        if (bankMov) { bankAccountId = bankMov.id_cuenta; bankMovId = bankMov.id; }
        if (counterMov) { contrapartidaAccountId = counterMov.id_cuenta; contrapartidaMovId = counterMov.id; }
      }

      setEditingMov({
        ...mov,
        txId,
        txMovements,
        bankMovId,
        contrapartidaMovId,
        fecha: mov.fecha,
        monto: String(mov.monto),
        montoOriginal: Number(mov.monto),
        concepto: mov.concepto || '',
        referencia: mov.referencia || '',
        id_cuenta_financiera: mov.id_cuenta_financiera || '',
        id_cuenta_banco_contable: bankAccountId || mov.id_cuenta_banco_contable || '',
        id_cuenta_contrapartida_contable: contrapartidaAccountId || ''
      });
      
    } catch (err) {
      console.error("Error al cargar transacción para editar:", err);
      alert("No se pudo cargar la transacción contable asociada.");
    } finally {
      setSaving(false);
    }
  };

  const handleGuardarEdicionMovimiento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMov) return;
    if (!editingMov.id_cuenta_banco_contable) {
      alert("Por favor, selecciona una cuenta contable de banco.");
      return;
    }
    if (editingMov.txId && !editingMov.id_cuenta_contrapartida_contable) {
      alert("No se pudo identificar la cuenta contable de contrapartida (proveedor/cliente) del asiento original.");
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      const newMonto = parseFloat(editingMov.monto) || 0;
      if (newMonto <= 0) {
        alert("El monto debe ser mayor a cero.");
        setSaving(false);
        return;
      }
      
      if (editingMov.id_documento) {
        const originalMonto = Number(editingMov.montoOriginal !== undefined ? editingMov.montoOriginal : editingMov.monto);
        const amountDiff = originalMonto - newMonto;

        const { data: doc, error: docError } = await supabase
          .from('tesoreria_documentos')
          .select('total, saldo_pendiente')
          .eq('id', editingMov.id_documento)
          .single();

        if (docError || !doc) {
          throw new Error("No se pudo recuperar la información del documento original para validar el monto.");
        }

        const totalDocumento = Number(doc.total || 0);
        const saldoPendienteActual = Number(doc.saldo_pendiente || 0);

        if (newMonto > totalDocumento) {
          alert(`El monto ingresado ($${newMonto.toFixed(2)}) no puede ser superior al valor total del documento ($${totalDocumento.toFixed(2)}).`);
          setSaving(false);
          return;
        }

        const nuevoSaldo = saldoPendienteActual + amountDiff;
        if (nuevoSaldo < 0) {
          const maximoPermitido = saldoPendienteActual + originalMonto;
          alert(`El monto ingresado excede el saldo de la factura. El monto máximo permitido para este pago es de $${maximoPermitido.toFixed(2)}.`);
          setSaving(false);
          return;
        }

        const nuevoEstado = nuevoSaldo === 0 ? 'Liquidado' : (nuevoSaldo === totalDocumento ? 'Pendiente' : 'Parcial');
        const { error: updDocErr } = await supabase
          .from('tesoreria_documentos')
          .update({ saldo_pendiente: nuevoSaldo, estado: nuevoEstado })
          .eq('id', editingMov.id_documento);

        if (updDocErr) throw updDocErr;
      }
      
      const { error: updMovErr } = await supabase
        .from('tesoreria_movimientos')
        .update({
          fecha: editingMov.fecha,
          monto: newMonto,
          concepto: editingMov.concepto,
          referencia: editingMov.referencia || null,
          id_cuenta_financiera: editingMov.id_cuenta_financiera || null
        })
        .eq('id', editingMov.id);

      if (updMovErr) throw updMovErr;

      if (editingMov.txId) {
        const refText = editingMov.referencia ? ` (Ref: ${editingMov.referencia})` : '';
        const conceptoAsiento = (editingMov.concepto || `${editingMov.tipo_movimiento} de Tesorería`) + refText;

        const { error: txError } = await supabase
          .from('transacciones')
          .update({
            fecha: editingMov.fecha,
            concepto: conceptoAsiento
          })
          .eq('id', editingMov.txId);
        
        if (txError) throw txError;

        if (editingMov.bankMovId) {
          const { error: bankError } = await supabase
            .from('movimientos')
            .update({
              id_cuenta: editingMov.id_cuenta_banco_contable,
              debe: editingMov.tipo_movimiento === 'Cobro' ? newMonto : 0,
              haber: editingMov.tipo_movimiento === 'Pago' ? newMonto : 0
            })
            .eq('id', editingMov.bankMovId);
          if (bankError) throw bankError;
        }

        if (editingMov.contrapartidaMovId) {
          const { error: contraError } = await supabase
            .from('movimientos')
            .update({
              id_cuenta: editingMov.id_cuenta_contrapartida_contable,
              debe: editingMov.tipo_movimiento === 'Pago' ? newMonto : 0,
              haber: editingMov.tipo_movimiento === 'Cobro' ? newMonto : 0
            })
            .eq('id', editingMov.contrapartidaMovId);
          if (contraError) throw contraError;
        }
      }

      setEditingMov(null);
      setMessage('Movimiento actualizado y sincronizado exitosamente.');
      await queryClient.invalidateQueries({ queryKey: ['tesoreria', empresaId] });

    } catch (err: any) {
      console.error("Error al guardar edición del movimiento:", err);
      alert("Error al guardar: " + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  const handleCrearCuenta = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const esCaja = cuentaForm.tipo === 'Caja';
      const esOtro = cuentaForm.banco_seleccionado === 'Otro (nombre personalizado)';
      const nombreFinal = esCaja
        ? (cuentaForm.nombre || 'Caja')
        : (esOtro ? cuentaForm.nombre : cuentaForm.banco_seleccionado);
      const tipoFinal = esCaja ? 'Caja' : `Banco ${cuentaForm.tipo_cuenta}`;

      const { error } = await supabase.from('cuentas_financieras').insert({
        id_empresa: empresaId,
        nombre: nombreFinal,
        tipo: tipoFinal,
        saldo_inicial: parseFloat(cuentaForm.saldo_inicial) || 0,
        moneda: cuentaForm.moneda,
        numero_referencia: cuentaForm.numero_referencia || null,
      });
      if (error) throw error;
      setCuentaForm({ banco_seleccionado: 'Banco Pichincha', nombre: '', tipo: 'Banco', tipo_cuenta: 'Ahorro', saldo_inicial: '0', moneda: 'USD', numero_referencia: '' });
      setShowCuentaForm(false);
      setMessage('Cuenta bancaria registrada exitosamente.');
      await queryClient.invalidateQueries({ queryKey: ['tesoreria', empresaId] });
    } catch (error: any) {
      setMessage(error.message || 'No se pudo crear la cuenta.');
    } finally { setSaving(false); }
  };

  const handleCrearDocumento = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const total = parseFloat(docForm.total) || 0;
      const { error } = await supabase.from('tesoreria_documentos').insert({
        id_empresa: empresaId,
        id_entidad: docForm.id_entidad || null,
        tipo_documento: docForm.tipo_documento,
        fecha_emision: docForm.fecha_emision,
        fecha_vencimiento: docForm.fecha_vencimiento || null,
        concepto: docForm.concepto,
        referencia: docForm.referencia || null,
        total,
        saldo_pendiente: total,
        estado: 'Pendiente',
        origen: 'Manual'
      });
      if (error) throw error;
      setDocForm({ tipo_documento: mode === 'pagos' ? 'Cuenta por pagar' : 'Cuenta por cobrar', fecha_emision: new Date().toISOString().slice(0, 10), fecha_vencimiento: '', id_entidad: '', concepto: '', referencia: '', total: '' });
      setMessage('Documento de tesorería registrado.');
      await queryClient.invalidateQueries({ queryKey: ['tesoreria', empresaId] });
    } catch (error: any) {
      setMessage(error.message || 'No se pudo crear el documento.');
    } finally { setSaving(false); }
  };

  const handleRegistrarMovimiento = async (e: React.FormEvent, documentos: any[]) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const target = movForm.id_documento ? documentos.find((d) => d.id === movForm.id_documento) : null;
      const monto = parseFloat(movForm.monto) || 0;
      const { data: mov, error } = await supabase.from('tesoreria_movimientos').insert({
        id_empresa: empresaId,
        fecha: movForm.fecha,
        tipo_movimiento: movForm.tipo_movimiento,
        concepto: movForm.concepto,
        monto,
        id_cuenta_financiera: movForm.id_cuenta_financiera || null,
        id_entidad: movForm.id_entidad || null,
        id_documento: movForm.id_documento || null,
        referencia: movForm.referencia || null,
        estado: movForm.estado,
        origen: 'Manual'
      }).select('id_documento').single();
      if (error) throw error;

      if (mov?.id_documento && target) {
        const nuevoSaldo = Math.max(0, Number(target.saldo_pendiente || 0) - monto);
        const estado = nuevoSaldo === 0 ? 'Liquidado' : 'Parcial';
        await supabase.from('tesoreria_documentos').update({ saldo_pendiente: nuevoSaldo, estado }).eq('id', target.id);
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: qCuentas } = await supabase.from('plan_cuentas').select('id, codigo_cuenta, nombre, acepta_movimientos').eq('id_empresa', empresaId);
        if (qCuentas) {
          const ctasBancos = qCuentas.filter(c => c.acepta_movimientos && (c.codigo_cuenta.startsWith('1.1.1') || c.nombre.toLowerCase().includes('banco') || c.nombre.toLowerCase().includes('caja') || c.nombre.toLowerCase().includes('fondo')));
          
          const ctasPagarMejores = qCuentas.filter(c => c.acepta_movimientos && (c.codigo_cuenta.startsWith('2.1.3') || c.nombre.toLowerCase().includes('proveedor')));
          const ctasPagarFallback = qCuentas.filter(c => c.acepta_movimientos && c.codigo_cuenta.startsWith('2') && (c.codigo_cuenta.startsWith('2.1') || c.nombre.toLowerCase().includes('pagar')));
          const cxpIdDefault = ctasPagarMejores[0]?.id || ctasPagarFallback[0]?.id;

          const ctasCobrarMejores = qCuentas.filter(c => c.acepta_movimientos && (c.codigo_cuenta.startsWith('1.1.2.5') || c.nombre.toLowerCase().includes('cliente')));
          const ctasCobrarFallback = qCuentas.filter(c => c.acepta_movimientos && c.codigo_cuenta.startsWith('1') && !c.codigo_cuenta.startsWith('1.1.1') && (c.codigo_cuenta.startsWith('1.1.2') || c.nombre.toLowerCase().includes('cobrar')));
          const cxcIdDefault = ctasCobrarMejores[0]?.id || ctasCobrarFallback[0]?.id;

          const bancoId = movForm.id_cuenta_banco_contable || ctasBancos[0]?.id;
          let cxcId = cxcIdDefault;
          let cxpId = cxpIdDefault;

          if (target && target.referencia) {
            try {
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
                .eq('id_entidad', target.id_entidad)
                .like('concepto', `%${target.referencia}%`)
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
                  .like('concepto', `%${target.referencia}%`)
                  .order('created_at', { ascending: false })
                  .limit(1)
                  .maybeSingle();
                
                invTx = invTxFallback;
              }

              if (invTx && invTx.movimientos) {
                if (movForm.tipo_movimiento === 'Pago') {
                  const matchedAcc = invTx.movimientos.find((m: any) => m.haber > 0);
                  if (matchedAcc) {
                    cxpId = matchedAcc.id_cuenta;
                  }
                } else if (movForm.tipo_movimiento === 'Cobro') {
                  const matchedAcc = invTx.movimientos.find((m: any) => m.debe > 0);
                  if (matchedAcc) {
                    cxcId = matchedAcc.id_cuenta;
                  }
                }
              }
            } catch (err) {
              console.error('Error al recuperar la cuenta contable de la factura original:', err);
            }
          }

          if (bancoId && ((movForm.tipo_movimiento === 'Cobro' && cxcId) || (movForm.tipo_movimiento === 'Pago' && cxpId))) {
            const nextNum = await getNextNumeroComprobante(empresaId);
            const refText = movForm.referencia ? ` (Ref: ${movForm.referencia})` : '';
            const conceptoAsiento = (movForm.concepto || `${movForm.tipo_movimiento} de Tesorería`) + refText;

            const { data: transaccion } = await supabase.from('transacciones').insert({
              id_empresa: empresaId,
              id_usuario: user.id,
              fecha: movForm.fecha,
              concepto: conceptoAsiento,
              tipo_comprobante: movForm.tipo_movimiento === 'Cobro' ? 'Ingreso' : 'Egreso',
              numero_comprobante: nextNum,
              id_entidad: movForm.id_entidad || null
            }).select('id').single();

            if (transaccion) {
              const payloadMovimientos = [];
              if (movForm.tipo_movimiento === 'Cobro') {
                payloadMovimientos.push({ id_transaccion: transaccion.id, id_cuenta: bancoId, debe: monto, haber: 0, id_empresa: empresaId });
                payloadMovimientos.push({ id_transaccion: transaccion.id, id_cuenta: cxcId, debe: 0, haber: monto, id_empresa: empresaId });
              } else {
                payloadMovimientos.push({ id_transaccion: transaccion.id, id_cuenta: cxpId, debe: monto, haber: 0, id_empresa: empresaId });
                payloadMovimientos.push({ id_transaccion: transaccion.id, id_cuenta: bancoId, debe: 0, haber: monto, id_empresa: empresaId });
              }
              await supabase.from('movimientos').insert(payloadMovimientos);
            }
          }
        }
      }

      setMovForm({ fecha: new Date().toISOString().slice(0, 10), tipo_movimiento: mode === 'pagos' ? 'Pago' : 'Cobro', concepto: '', monto: '', id_cuenta_financiera: '', id_cuenta_banco_contable: '', id_entidad: '', id_documento: '', referencia: '', estado: 'Aplicado' });
      setMessage('Movimiento registrado contable y financieramente.');
      await queryClient.invalidateQueries({ queryKey: ['tesoreria', empresaId] });
    } catch (error: any) {
      setMessage(error.message || 'No se pudo registrar el movimiento.');
    } finally { setSaving(false); }
  };

  const handleAnularMovimientoTesoreria = (movId: string) => {
    setAnulacionModal({ isOpen: true, movId, motivo: '' });
  };

  const handleConfirmarAnulacion = async () => {
    const { movId, motivo } = anulacionModal;
    if (!motivo.trim()) {
      alert("Por favor, ingresa el motivo de la anulación.");
      return;
    }
    
    setAnulacionModal(prev => ({ ...prev, isOpen: false }));
    setSaving(true);
    setMessage('');
    try {
      const { data: mov, error: fError } = await supabase
        .from('tesoreria_movimientos')
        .select('*, entidades(razon_social)')
        .eq('id', movId)
        .single();
      if (fError || !mov) throw new Error("No se pudo encontrar el movimiento de tesorería.");

      const { error: updMovErr } = await supabase
        .from('tesoreria_movimientos')
        .update({ estado: 'Anulado' })
        .eq('id', movId);
      if (updMovErr) throw updMovErr;

      if (mov.id_documento) {
        const { data: doc } = await supabase
          .from('tesoreria_documentos')
          .select('saldo_pendiente, total, estado')
          .eq('id', mov.id_documento)
          .single();
        if (doc) {
          const nuevoSaldo = Math.min(Number(doc.total), Number(doc.saldo_pendiente || 0) + Number(mov.monto));
          const nuevoEstado = nuevoSaldo === Number(doc.total) ? 'Pendiente' : 'Parcial';
          await supabase
            .from('tesoreria_documentos')
            .update({ saldo_pendiente: nuevoSaldo, estado: nuevoEstado })
            .eq('id', mov.id_documento);
        }
      }

      let txId = null;
      let txConcepto = '';
      
      if (mov.referencia) {
        const { data: txs } = await supabase
          .from('transacciones')
          .select('id, concepto, numero_comprobante')
          .eq('id_empresa', empresaId)
          .eq('numero_comprobante', mov.referencia);
        if (txs && txs.length > 0) {
          txId = txs[0].id;
          txConcepto = txs[0].concepto;
        }
      }
      
      if (!txId) {
        const { data: txs } = await supabase
          .from('transacciones')
          .select('id, concepto, numero_comprobante, movimientos(debe, haber)')
          .eq('id_empresa', empresaId)
          .eq('id_entidad', mov.id_entidad)
          .eq('fecha', mov.fecha)
          .in('tipo_comprobante', ['Ingreso', 'Egreso']);
        
        if (txs) {
          const matchedTx = txs.find(t => 
            (t.movimientos || []).some((m: any) => m.debe === Number(mov.monto) || m.haber === Number(mov.monto))
          );
          if (matchedTx) {
            txId = matchedTx.id;
            txConcepto = matchedTx.concepto;
          }
        }
      }

      if (txId) {
        const ahora = new Date().toLocaleString('es-EC', { 
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit', second: '2-digit' 
        });
        
        const cleanConcept = txConcepto.startsWith('[ANULADO]') ? txConcepto.replace(/^\[ANULADO\]\s*/, '') : txConcepto;
        const valOrig = { total: Number(mov.monto) };
        const newConcepto = `[ANULADO] Motivo: ${motivo} | Fecha: ${ahora} | ${cleanConcept} | ValoresOriginales: ${JSON.stringify(valOrig)}`;
        
        await supabase
          .from('transacciones')
          .update({ concepto: newConcepto, tipo_comprobante: 'Anulado' })
          .eq('id', txId);

        await supabase
          .from('movimientos')
          .delete()
          .eq('id_transaccion', txId);
      }

      setMessage('Movimiento anulado en tesorería y contabilidad.');
      await queryClient.invalidateQueries({ queryKey: ['tesoreria', empresaId] });
    } catch (err: any) {
      console.error(err);
      setMessage(err.message || 'No se pudo anular el movimiento.');
    } finally {
      setSaving(false);
    }
  };

  return {
    saving,
    setSaving,
    message,
    setMessage,
    showCuentaForm,
    setShowCuentaForm,
    anulacionModal,
    setAnulacionModal,
    cuentaForm,
    setCuentaForm,
    movForm,
    setMovForm,
    docForm,
    setDocForm,
    editingMov,
    setEditingMov,
    handleOpenEditModal,
    handleGuardarEdicionMovimiento,
    handleCrearCuenta,
    handleCrearDocumento,
    handleRegistrarMovimiento,
    handleAnularMovimientoTesoreria,
    handleConfirmarAnulacion
  };
}
