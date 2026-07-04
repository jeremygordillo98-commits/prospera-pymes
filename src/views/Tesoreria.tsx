import React, { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useQuery } from '@tanstack/react-query';

import { EditMovimientoModal } from '../components/EditMovimientoModal';
import { TesoreriaResumen } from '../components/TesoreriaResumen';
import { TesoreriaConciliacion } from '../components/TesoreriaConciliacion';
import { TesoreriaCobrosPagos } from '../components/TesoreriaCobrosPagos';
import { TesoreriaAnulacionModal } from '../components/TesoreriaForms';
import { useTesoreria } from '../hooks/useTesoreria';

interface Props { empresaId: string; mode?: 'resumen' | 'cobros' | 'pagos' | 'conciliacion'; }

export const Tesoreria: React.FC<Props> = ({ empresaId, mode = 'resumen' }) => {
  const {
    saving,
    message,
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
  } = useTesoreria(empresaId, mode);

  const { data, isLoading: loading } = useQuery({
    queryKey: ['tesoreria', empresaId],
    queryFn: async () => {
      const [cuentasRes, docsRes, movRes, entRes, pcRes, txAnuladasRes] = await Promise.all([
        supabase.from('cuentas_financieras').select('*').eq('id_empresa', empresaId).order('nombre'),
        supabase.from('tesoreria_documentos').select('id,fecha_emision,fecha_vencimiento,tipo_documento,referencia,concepto,saldo_pendiente,total,estado,origen,entidades(id,razon_social)').eq('id_empresa', empresaId).order('fecha_emision', { ascending: false }),
        supabase.from('tesoreria_movimientos').select('id,fecha,tipo_movimiento,concepto,monto,estado,referencia,cuenta_financiera:cuentas_financieras(nombre),entidades(id,razon_social),documento:tesoreria_documentos(referencia,concepto,total,fecha_vencimiento)').eq('id_empresa', empresaId).order('fecha', { ascending: false }).limit(30),
        supabase.from('entidades').select('id,razon_social,tipo_entidad').eq('id_empresa', empresaId).order('razon_social'),
        supabase.from('plan_cuentas').select('id, codigo_cuenta, nombre, acepta_movimientos').eq('id_empresa', empresaId).order('codigo_cuenta'),
        supabase.from('transacciones').select('concepto').eq('id_empresa', empresaId).eq('tipo_comprobante', 'Anulado')
      ]);

      const refsAnuladas = new Set<string>();
      (txAnuladasRes.data || []).forEach((tx: any) => {
        const match = (tx.concepto || '').match(/(\d{3}-\d{3}-\d{9})/);
        if (match) refsAnuladas.add(match[1]);
      });

      const todosDocumentos = (docsRes.data || []).map((item: any) => ({ ...item, entidades: Array.isArray(item.entidades) ? item.entidades[0] : item.entidades }));
      const documentosSinAnulados = todosDocumentos.filter((d: any) => !refsAnuladas.has(d.referencia));

      return {
        cuentas: cuentasRes.data || [],
        documentos: documentosSinAnulados,
        movimientos: (movRes.data || []).map((item: any) => ({
          ...item,
          cuenta_financiera: Array.isArray(item.cuenta_financiera) ? item.cuenta_financiera[0] : item.cuenta_financiera,
          entidades: Array.isArray(item.entidades) ? item.entidades[0] : item.entidades,
          documento: Array.isArray(item.documento) ? item.documento[0] : item.documento,
        })),
        entities: entRes.data || [],
        cuentasContables: pcRes?.data || []
      };
    },
    staleTime: 0,
  });

  const cuentas = data?.cuentas || [];
  const documentos = data?.documentos || [];
  const movimientos = data?.movimientos || [];
  const entities = data?.entities || [];
  const cuentasContables = data?.cuentasContables || [];

  const summary = useMemo(() => {
    const saldoInicialCuentas = cuentas.reduce((acc, c) => acc + Number(c.saldo_inicial || 0), 0);
    const cobradoTotal = movimientos.filter(m => m.tipo_movimiento === 'Cobro' && m.estado !== 'Anulado').reduce((acc, m) => acc + Number(m.monto || 0), 0);
    const pagadoTotal = movimientos.filter(m => m.tipo_movimiento === 'Pago' && m.estado !== 'Anulado').reduce((acc, m) => acc + Number(m.monto || 0), 0);
    const disponible = saldoInicialCuentas + cobradoTotal - pagadoTotal;

    const porCobrar = documentos.filter((d) => d.tipo_documento === 'Cuenta por cobrar').reduce((acc, d) => acc + Number(d.saldo_pendiente || 0), 0);
    const porPagar = documentos.filter((d) => d.tipo_documento === 'Cuenta por pagar').reduce((acc, d) => acc + Number(d.saldo_pendiente || 0), 0);
    const thisMonth = new Date().toISOString().slice(0, 7);
    const cobradoMes = movimientos.filter((m) => m.tipo_movimiento === 'Cobro' && (m.fecha || '').startsWith(thisMonth)).reduce((acc, m) => acc + Number(m.monto || 0), 0);
    const pagadoMes = movimientos.filter((m) => m.tipo_movimiento === 'Pago' && (m.fecha || '').startsWith(thisMonth)).reduce((acc, m) => acc + Number(m.monto || 0), 0);
    return { disponible, porCobrar, porPagar, cobradoMes, pagadoMes, proyectado: disponible + porCobrar - porPagar };
  }, [cuentas, documentos, movimientos]);

  const docsFiltrados = useMemo(() => {
    const activos = documentos.filter((d) => d.estado !== 'Anulado');
    if (mode === 'cobros') return activos.filter((d) => d.tipo_documento === 'Cuenta por cobrar');
    if (mode === 'pagos') return activos.filter((d) => d.tipo_documento === 'Cuenta por pagar');
    return activos;
  }, [documentos, mode]);

  if (loading) return <div style={{ padding: '120px 0', width: '100%', display: 'flex', justifyContent: 'center' }}><Loader2 className="animate-spin" size={36} style={{ color: 'var(--primary)' }} /></div>;

  return (
      <div className="tesoreria-module">
          {message && <div style={{ background: 'var(--primary)', color: '#000', padding: 12, borderRadius: 12, fontWeight: 800, marginBottom: 20, animation: 'fadeIn 0.3s ease' }}>INFO: {message}</div>}
          
          {mode === 'resumen' && (
            <TesoreriaResumen
              summary={summary}
              cuentas={cuentas}
              movimientos={movimientos}
              showCuentaForm={showCuentaForm}
              setShowCuentaForm={setShowCuentaForm}
              cuentaForm={cuentaForm}
              setCuentaForm={setCuentaForm}
              handleCrearCuenta={handleCrearCuenta}
              saving={saving}
            />
          )}
          {(mode === 'cobros' || mode === 'pagos') && (
            <TesoreriaCobrosPagos
              empresaId={empresaId}
              mode={mode}
              summary={summary}
              docsFiltrados={docsFiltrados}
              movForm={movForm}
              setMovForm={setMovForm}
              docForm={docForm}
              setDocForm={setDocForm}
              cuentas={cuentas}
              cuentasContables={cuentasContables}
              entities={entities}
              movimientos={movimientos}
              saving={saving}
              handleRegistrarMovimiento={(e) => handleRegistrarMovimiento(e, documentos)}
              handleCrearDocumento={handleCrearDocumento}
              handleOpenEditModal={handleOpenEditModal}
              handleAnularMovimientoTesoreria={handleAnularMovimientoTesoreria}
            />
          )}
          {mode === 'conciliacion' && (
            <TesoreriaConciliacion
              cuentas={cuentas}
              movimientos={movimientos}
            />
          )}

          {/* Edit Modal */}
          {editingMov && (
            <EditMovimientoModal
              editingMov={editingMov}
              setEditingMov={setEditingMov}
              cuentas={cuentas}
              cuentasContables={cuentasContables}
              saving={saving}
              onSave={handleGuardarEdicionMovimiento}
              onClose={() => setEditingMov(null)}
            />
          )}

          {/* Anulacion Prompt Modal */}
          <TesoreriaAnulacionModal
            isOpen={anulacionModal.isOpen}
            onClose={() => setAnulacionModal(prev => ({ ...prev, isOpen: false }))}
            motivo={anulacionModal.motivo}
            setMotivo={(val) => setAnulacionModal(prev => ({ ...prev, motivo: val }))}
            onConfirm={handleConfirmarAnulacion}
          />
      </div>
  );
};
