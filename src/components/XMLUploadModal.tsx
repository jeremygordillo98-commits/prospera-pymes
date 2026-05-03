import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, FileText, CheckCircle2, AlertCircle, Loader2, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { type SRIParsedData, parseSRIXML } from '../utils/sriParser';
import { supabase } from '../services/supabase';
import { CATALOGO_RETENCIONES_RENTA } from '../utils/sriCatalog';
import { EntidadQuickForm } from './EntidadQuickForm';
import { XMLDocInfo } from './XMLDocInfo';
import { XMLAsientoForm } from './XMLAsientoForm';

interface Account { id: string; codigo_cuenta: string; nombre: string; tipo: string; }

interface Props {
  isOpen: boolean;
  empresaId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const XMLUploadModal: React.FC<Props> = ({ isOpen, empresaId, onClose, onSuccess }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsedData, setParsedData] = useState<SRIParsedData | null>(null);
  const [verifyingEntidad, setVerifyingEntidad] = useState(false);
  const [entidadId, setEntidadId] = useState<string | null>(null);
  const [showCreateEntidad, setShowCreateEntidad] = useState(false);
  const [retencionCodigo, setRetencionCodigo] = useState('000');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [idCuentaDebe, setIdCuentaDebe] = useState('');
  const [idCuentaHaber, setIdCuentaHaber] = useState('');
  const [idCuentaRetencion, setIdCuentaRetencion] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const isFactura = parsedData?.tipoDocumento === 'FACTURA';
  const isRetencion = parsedData?.tipoDocumento === 'COM_RETENCION';
  const isNotaCredito = parsedData?.tipoDocumento === 'NOTA_CREDITO';
  const retencionSeleccionada = CATALOGO_RETENCIONES_RENTA.find(r => r.codigo === retencionCodigo) || CATALOGO_RETENCIONES_RENTA[0];
  const valorRetenidoCalculado = isFactura
    ? parseFloat(((parsedData.baseImponible * retencionSeleccionada.porcentaje) / 100).toFixed(2))
    : 0;

  useEffect(() => {
    if (!isOpen || !empresaId) return;
    supabase.from('plan_cuentas').select('id,codigo_cuenta,nombre,tipo')
      .eq('id_empresa', empresaId).eq('acepta_movimientos', true).order('codigo_cuenta')
      .then(({ data }) => {
        if (!data) return;
        setAccounts(data);
        const g = data.find(a => a.codigo_cuenta.startsWith('5')) || data[0];
        const p = data.find(a => a.codigo_cuenta.startsWith('2.1.3')) || data[0];
        const r = data.find(a => a.codigo_cuenta.startsWith('2.1.4') || a.nombre.toLowerCase().includes('retencion')) || data[0];
        if (g) setIdCuentaDebe(g.id);
        if (p) setIdCuentaHaber(p.id);
        if (r) setIdCuentaRetencion(r.id);
      });
  }, [isOpen, empresaId]);

  const checkEntidad = async (ruc: string) => {
    setVerifyingEntidad(true); setEntidadId(null); setShowCreateEntidad(false);
    const { data } = await supabase.from('entidades').select('id')
      .eq('ruc_cedula', ruc).eq('id_empresa', empresaId).maybeSingle();
    if (data) setEntidadId(data.id); else setShowCreateEntidad(true);
    setVerifyingEntidad(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f); setParsing(true); setParsedData(null); setStatus('idle');
    try {
      const data = await parseSRIXML(await f.text());
      if (data) {
        setParsedData(data);
        await checkEntidad(data.rucEmisor);
        if (data.tipoDocumento === 'COM_RETENCION') {
          const a = accounts.find(a => a.codigo_cuenta.startsWith('1.1.3') || a.nombre.toLowerCase().includes('anticipo'))?.id;
          const c = accounts.find(a => a.codigo_cuenta.startsWith('1.1.2') || a.nombre.toLowerCase().includes('cliente'))?.id;
          if (a) setIdCuentaDebe(a); if (c) setIdCuentaHaber(c);
        } else if (data.tipoDocumento === 'NOTA_CREDITO') {
          const v = accounts.find(a => a.codigo_cuenta.startsWith('4'))?.id;
          const c = accounts.find(a => a.codigo_cuenta.startsWith('1.1.2') || a.nombre.toLowerCase().includes('cliente'))?.id;
          if (v) setIdCuentaDebe(v); if (c) setIdCuentaHaber(c);
        }
      } else { setStatus('error'); }
    } catch { setStatus('error'); }
    finally { setParsing(false); e.target.value = ''; }
  };

  const reset = () => { setFile(null); setParsedData(null); setEntidadId(null); setStatus('idle'); };

  const handleSave = async () => {
    if (!parsedData || !empresaId || !entidadId || !idCuentaDebe || !idCuentaHaber ||
      (isFactura && valorRetenidoCalculado > 0 && !idCuentaRetencion)) {
      alert('Por favor asegúrate de seleccionar todas las cuentas contables.'); return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sesión no válida');

      const totalComprobante = isFactura ? parsedData.total : isRetencion ? parsedData.totalRetenido : parsedData.valorModificacion;
      const concepto = isFactura
        ? `Factura: ${parsedData.razonSocialEmisor} - ${parsedData.numeroComprobante}`
        : isRetencion
          ? `Retención: ${parsedData.razonSocialEmisor} - ${parsedData.numeroComprobante}`
          : `NC: ${parsedData.razonSocialEmisor} - Mod: ${parsedData.numDocModificado}`;

      const { data: tx, error: tError } = await supabase.from('transacciones').insert({
        fecha: new Date(parsedData.fechaEmision.split('/').reverse().join('-')),
        concepto,
        tipo_comprobante: isFactura ? 'Factura' : isRetencion ? 'Comprobante de Retención' : 'Nota de Crédito',
        numero_comprobante: parsedData.numeroComprobante,
        id_entidad: entidadId, xml_referencia: parsedData.claveAcceso,
        id_empresa: empresaId, id_usuario: user.id,
      }).select().single();
      if (tError) throw tError;

      const neto = parseFloat((totalComprobante - valorRetenidoCalculado).toFixed(2));
      const movimientos = isFactura
        ? [
          { id_transaccion: tx.id, id_cuenta: idCuentaDebe, debe: totalComprobante, haber: 0, id_empresa: empresaId },
          ...(valorRetenidoCalculado > 0 ? [{ id_transaccion: tx.id, id_cuenta: idCuentaRetencion, debe: 0, haber: valorRetenidoCalculado, id_empresa: empresaId }] : []),
          { id_transaccion: tx.id, id_cuenta: idCuentaHaber, debe: 0, haber: neto, id_empresa: empresaId },
        ]
        : [
          { id_transaccion: tx.id, id_cuenta: idCuentaDebe, debe: totalComprobante, haber: 0, id_empresa: empresaId },
          { id_transaccion: tx.id, id_cuenta: idCuentaHaber, debe: 0, haber: totalComprobante, id_empresa: empresaId },
        ];
      const { error: mError } = await supabase.from('movimientos').insert(movimientos);
      if (mError) throw mError;

      let esCompra = false;
      if (isFactura || isNotaCredito || isRetencion) {
        const { data: emp } = await supabase.from('empresas_gestionadas').select('ruc_empresa').eq('id', empresaId).single();
        const rucEmpresa = emp?.ruc_empresa || '';
        if (isRetencion) {
          // Si YO soy el emisor de la retención → es una retención que hago a mi proveedor = COMPRA
          // Si OTRO emitió la retención sobre mí → es una retención de mi cliente = VENTA
          esCompra = parsedData.rucEmisor === rucEmpresa;
        } else {
          esCompra = parsedData.rucEmisor !== rucEmpresa;
        }
      }

      const sri: any = { id_transaccion: tx.id, clave_acceso_xml: parsedData.claveAcceso, id_empresa: empresaId };
      if (isFactura) {
        Object.assign(sri, {
          base_12: parsedData.base12, base_0: parsedData.base0, base_no_objeto: parsedData.baseNoObjeto,
          monto_iva: parsedData.iva, es_compra: esCompra,
          retenciones_aplicadas: valorRetenidoCalculado > 0
            ? [{ codigo: retencionSeleccionada.codigo, porcentaje: retencionSeleccionada.porcentaje, base: parsedData.base12, valor: valorRetenidoCalculado, tipo: 'RENTA' }]
            : [],
        });
      } else if (isRetencion) {
        Object.assign(sri, {
          base_12: 0, base_0: 0, base_no_objeto: 0, monto_iva: parsedData.totalRetenidoIVA, es_compra: esCompra,
          retenciones_aplicadas: parsedData.documentosSustento.flatMap((doc: any) =>
            doc.retenciones.map((r: any) => ({ codigo: r.codigoRetencion, porcentaje: r.porcentajeRetener, base: r.baseImponible, valor: r.valorRetenido, tipo: r.tipo, desc_doc: doc.numDocSustento, cod_doc_sustento: doc.codDocSustento }))
          ),
        });
      } else {
        Object.assign(sri, { base_12: parsedData.base12, base_0: parsedData.base0, base_no_objeto: parsedData.baseNoObjeto, monto_iva: parsedData.iva, es_compra: esCompra, retenciones_aplicadas: [] });
      }
      await supabase.from('documentos_sri').insert(sri);

      if (isFactura) {
        const { data: emp } = await supabase.from('empresas_gestionadas').select('ruc_empresa').eq('id', empresaId).single();
        const esVenta = (emp?.ruc_empresa || '') === parsedData.rucEmisor;
        await supabase.from('tesoreria_documentos').insert({
          id_empresa: empresaId, id_entidad: entidadId,
          tipo_documento: esVenta ? 'Cuenta por cobrar' : 'Cuenta por pagar',
          fecha_emision: new Date(parsedData.fechaEmision.split('/').reverse().join('-')).toISOString().slice(0, 10),
          fecha_vencimiento: new Date(parsedData.fechaEmision.split('/').reverse().join('-')).toISOString().slice(0, 10),
          concepto: `[Automático] Factura #${parsedData.numeroComprobante}`,
          referencia: parsedData.numeroComprobante, total: totalComprobante,
          saldo_pendiente: neto, estado: neto > 0 ? 'Pendiente' : 'Liquidado', origen: 'SRI XML',
        });
      }

      setStatus('success');
      setTimeout(() => { onSuccess(); onClose(); reset(); }, 1500);
    } catch (err: any) {
      alert(`Error al guardar: ${err.message}`); setStatus('error');
    } finally { setSaving(false); }
  };

  if (!isOpen) return null;

  const btnStyle = { background: 'var(--input-bg)', border: '1px solid var(--border-color)' };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)' }}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card w-full" style={{ maxWidth: 680, padding: 0, overflow: 'hidden' }}>

        {/* Header */}
        <div className="flex-between p-6" style={{ borderBottom: '1px solid var(--border-color)' }}>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Upload size={20} className="text-primary" /> Analizador Multidocumento SRI
          </h3>
          <button onClick={onClose} className="btn" style={{ ...btnStyle, padding: 8, borderRadius: 10 }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-8 custom-scrollbar" style={{ maxHeight: '85vh', overflowY: 'auto' }}>

          {/* Zona de carga */}
          {!file ? (
            <div onClick={() => fileInputRef.current?.click()}
              className="group"
              style={{ border: '2px dashed var(--border-color)', borderRadius: 20, padding: 48, textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'var(--primary-light)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{ width: 80, height: 80, background: 'var(--primary-light)', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', transition: 'transform 0.2s' }}>
                <Upload size={40} className="text-primary" />
              </div>
              <p className="font-bold" style={{ fontSize: '1.2rem', marginBottom: 8 }}>Sube tu archivo XML</p>
              <p className="text-sec" style={{ fontSize: '0.88rem' }}>Soporta Facturas, Notas de Crédito y Comprobantes de Retención del SRI.</p>
              <input ref={fileInputRef} type="file" accept=".xml" style={{ display: 'none' }} onChange={handleFileChange} />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

              {/* Archivo seleccionado */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'var(--input-bg)', padding: 16, borderRadius: 14, border: '1px solid var(--border-color)' }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FileText className="text-primary" />
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <p className="font-bold" style={{ fontSize: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</p>
                  <p className="text-sec" style={{ fontSize: '0.75rem' }}>{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button onClick={() => { setFile(null); setParsedData(null); }} className="btn" style={{ ...btnStyle, padding: '6px 14px', fontSize: '0.78rem', borderRadius: 10 }}>
                    Cambiar
                  </button>
                  {(parsing || verifyingEntidad) && <Loader2 className="animate-spin text-primary" size={22} />}
                  {parsedData && !verifyingEntidad && <CheckCircle2 className="text-success" size={22} />}
                </div>
              </div>

              <AnimatePresence mode="wait">
                {/* Crear entidad */}
                {showCreateEntidad && parsedData && (
                  <motion.div key="create" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', padding: 16, borderRadius: 14, display: 'flex', gap: 12, color: 'var(--warning)' }}>
                      <AlertCircle size={22} style={{ flexShrink: 0 }} />
                      <div>
                        <p className="font-bold">Emisor no encontrado</p>
                        <p style={{ fontSize: '0.78rem', opacity: 0.9 }}>RUC {parsedData.rucEmisor} no está en tu base de entidades.</p>
                      </div>
                    </div>
                    <EntidadQuickForm
                      ruc={parsedData.rucEmisor} razonSocial={parsedData.razonSocialEmisor} empresaId={empresaId}
                      onSuccess={(id) => { setEntidadId(id); setShowCreateEntidad(false); }}
                      onCancel={() => { setFile(null); setParsedData(null); setShowCreateEntidad(false); }}
                    />
                  </motion.div>
                )}

                {/* Formulario principal */}
                {parsedData && entidadId && (
                  <motion.div key="form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    <XMLDocInfo parsedData={parsedData} isFactura={isFactura} isRetencion={isRetencion} />
                    <XMLAsientoForm
                      parsedData={parsedData} isFactura={isFactura} isRetencion={isRetencion} isNotaCredito={isNotaCredito}
                      accounts={accounts}
                      idCuentaDebe={idCuentaDebe} setIdCuentaDebe={setIdCuentaDebe}
                      idCuentaHaber={idCuentaHaber} setIdCuentaHaber={setIdCuentaHaber}
                      idCuentaRetencion={idCuentaRetencion} setIdCuentaRetencion={setIdCuentaRetencion}
                      retencionCodigo={retencionCodigo} setRetencionCodigo={setRetencionCodigo}
                      retencionSeleccionada={retencionSeleccionada} valorRetenidoCalculado={valorRetenidoCalculado}
                    />
                    <div style={{ display: 'flex', gap: 16 }}>
                      <button onClick={reset} className="btn" style={{ ...btnStyle, flex: 1, height: 48, borderRadius: 14, justifyContent: 'center' }}>
                        Reintentar
                      </button>
                      <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ flex: 1, height: 48, borderRadius: 14, justifyContent: 'center' }}>
                        {saving ? <Loader2 className="animate-spin" size={20} /> : <><Save size={20} /> Guardar Asiento y Documento</>}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {status === 'error' && (
                <div style={{ display: 'flex', gap: 12, color: 'var(--error)', background: 'rgba(239,68,68,0.1)', padding: 16, borderRadius: 14, border: '1px solid rgba(239,68,68,0.2)', fontSize: '0.88rem' }}>
                  <AlertCircle size={20} />
                  <p><strong>Error:</strong> El XML no tiene una estructura válida del SRI.</p>
                </div>
              )}
              {status === 'success' && (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 48, textAlign: 'center', gap: 16 }}>
                  <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CheckCircle2 className="text-success" size={48} />
                  </div>
                  <h3 style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0 }}>¡Procesado Correctamente!</h3>
                  <p className="text-sec">El asiento y el metadato tributario (ATS) fueron guardados.</p>
                </motion.div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
