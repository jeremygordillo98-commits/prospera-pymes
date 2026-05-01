import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FileDown, Calendar, RefreshCw, AlertCircle, CheckCircle2, FileText, Receipt } from 'lucide-react';
import { supabase } from '../services/supabase';

interface ATSProps { empresaId: string; }

interface DocSRI {
  id: string;
  base_12: number;
  base_0: number;
  monto_iva: number;
  clave_acceso_xml: string;
  retenciones_aplicadas: any[];
  transacciones: {
    fecha: string;
    tipo_comprobante: string;
    numero_comprobante: string;
    entidades?: { nombre: string; ruc_cedula: string; tipo_identificacion?: string } | null;
  } | null;
}

interface EmpresaInfo {
  nombre_empresa: string;
  ruc_empresa: string;
}

type Tab = 'compras' | 'retenciones';

export const ATS: React.FC<ATSProps> = ({ empresaId }) => {
  const now = new Date();
  const [anio, setAnio] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [tab, setTab] = useState<Tab>('compras');
  const [docs, setDocs] = useState<DocSRI[]>([]);
  const [empresa, setEmpresa] = useState<EmpresaInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [advertencias, setAdvertencias] = useState<string[]>([]);

  const fetchData = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      const [{ data: empData }, { data: docsData }] = await Promise.all([
        supabase.from('empresas_gestionadas').select('nombre_empresa, ruc_empresa').eq('id', empresaId).single(),
        supabase.from('documentos_sri').select(`
          id, base_12, base_0, monto_iva, clave_acceso_xml, retenciones_aplicadas,
          transacciones ( fecha, tipo_comprobante, numero_comprobante,
            entidades ( nombre, ruc_cedula, tipo_identificacion )
          )
        `).eq('id_empresa', empresaId)
      ]);
      if (empData) setEmpresa(empData);
      if (docsData) {
        // Filtrar por mes/año
        const filtered = (docsData as any[]).filter(d => {
          const fecha = d.transacciones?.fecha;
          if (!fecha) return false;
          const f = new Date(fecha);
          return f.getFullYear() === anio && f.getMonth() + 1 === mes;
        });
        setDocs(filtered);
        // Validaciones
        const warns: string[] = [];
        filtered.forEach(d => {
          if (!d.transacciones?.entidades) warns.push(`Doc ${d.transacciones?.numero_comprobante || '?'}: sin entidad vinculada`);
          if (!d.transacciones?.entidades?.tipo_identificacion) warns.push(`Entidad "${d.transacciones?.entidades?.nombre || '?'}": sin tipo de identificación SRI`);
        });
        setAdvertencias([...new Set(warns)].slice(0, 5));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [empresaId, anio, mes]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── Cálculos ───────────────────────────────────────────────
  const facturas = docs.filter(d => d.transacciones?.tipo_comprobante === 'Factura');
  const retenciones = docs.filter(d => d.transacciones?.tipo_comprobante === 'Comprobante de Retención');

  const totalBase12 = facturas.reduce((s, d) => s + (d.base_12 || 0), 0);
  const totalIVA    = facturas.reduce((s, d) => s + (d.monto_iva || 0), 0);
  const totalRet    = retenciones.reduce((s, d) =>
    s + (d.retenciones_aplicadas || []).reduce((a: number, r: any) => a + (r.valor || 0), 0), 0);

  // ─── Generador XML ATS ──────────────────────────────────────
  const generarXML = () => {
    if (!empresa) return;
    const mesStr = String(mes).padStart(2, '0');
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<ats>\n`;
    xml += `  <TipoIDInformante>04</TipoIDInformante>\n`;
    xml += `  <IdInformante>${empresa.ruc_empresa}</IdInformante>\n`;
    xml += `  <razonSocial>${empresa.nombre_empresa}</razonSocial>\n`;
    xml += `  <Anio>${anio}</Anio>\n`;
    xml += `  <Mes>${mesStr}</Mes>\n`;
    xml += `  <numEstabRuc>001</numEstabRuc>\n`;
    xml += `  <totalVentas>0.00</totalVentas>\n`;
    xml += `  <codigoOperativo>IVA</codigoOperativo>\n`;
    xml += `  <compras>\n`;
    facturas.forEach(d => {
      const ent = d.transacciones?.entidades;
      const num = d.transacciones?.numero_comprobante || '';
      const partes = num.split('-');
      const estab = partes[0] || '001';
      const ptoEmi = partes[1] || '001';
      const sec    = partes[2] || '000000000';
      const rets = d.retenciones_aplicadas || [];
      const retRenta = rets.filter((r: any) => r.tipo === 'RENTA' || !r.tipo);
      xml += `    <detalleCompras>\n`;
      xml += `      <codSustento>01</codSustento>\n`;
      xml += `      <tpIdProv>${ent?.tipo_identificacion || '04'}</tpIdProv>\n`;
      xml += `      <idProv>${ent?.ruc_cedula || ''}</idProv>\n`;
      xml += `      <tipoComprobante>01</tipoComprobante>\n`;
      xml += `      <parteRel>NO</parteRel>\n`;
      xml += `      <fechaRegistro>${d.transacciones?.fecha || ''}</fechaRegistro>\n`;
      xml += `      <establecimiento>${estab}</establecimiento>\n`;
      xml += `      <emisionPuntoEmision>${ptoEmi}</emisionPuntoEmision>\n`;
      xml += `      <secuencial>${sec}</secuencial>\n`;
      xml += `      <fechaEmision>${d.transacciones?.fecha || ''}</fechaEmision>\n`;
      xml += `      <autorizacion>${d.clave_acceso_xml || ''}</autorizacion>\n`;
      xml += `      <baseNoGraIva>${(d.base_0 || 0).toFixed(2)}</baseNoGraIva>\n`;
      xml += `      <baseImponible>0.00</baseImponible>\n`;
      xml += `      <baseImpGrav>${(d.base_12 || 0).toFixed(2)}</baseImpGrav>\n`;
      xml += `      <montoIce>0.00</montoIce>\n`;
      xml += `      <montoIva>${(d.monto_iva || 0).toFixed(2)}</montoIva>\n`;
      const ret1 = retRenta[0];
      xml += `      <valRetBien10>0.00</valRetBien10>\n`;
      xml += `      <valRetServ20>0.00</valRetServ20>\n`;
      xml += `      <valorRetBienes>${ret1?.valor?.toFixed(2) || '0.00'}</valorRetBienes>\n`;
      xml += `      <valorRetServicios>0.00</valorRetServicios>\n`;
      xml += `      <valRetServ100>0.00</valRetServ100>\n`;
      xml += `      <totbasesImpReemb>0.00</totbasesImpReemb>\n`;
      xml += `      <pagoExterior>\n        <pagoLocExt>01</pagoLocExt>\n      </pagoExterior>\n`;
      xml += `      <air>\n`;
      retRenta.forEach((r: any) => {
        xml += `        <detalleAir>\n`;
        xml += `          <codRetAir>${r.codigo || '332'}</codRetAir>\n`;
        xml += `          <baseImpAir>${(r.base || 0).toFixed(2)}</baseImpAir>\n`;
        xml += `          <porcentajeAir>${r.porcentaje || 0}</porcentajeAir>\n`;
        xml += `          <valRetAir>${(r.valor || 0).toFixed(2)}</valRetAir>\n`;
        xml += `        </detalleAir>\n`;
      });
      xml += `      </air>\n`;
      xml += `    </detalleCompras>\n`;
    });
    xml += `  </compras>\n`;
    xml += `  <ventas>\n  </ventas>\n`;
    xml += `  <ventasEstablecimiento>\n  </ventasEstablecimiento>\n`;
    xml += `  <anulados>\n  </anulados>\n`;
    xml += `</ats>`;

    const blob = new Blob([xml], { type: 'text/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ATS_${anio}${mesStr}_${empresa.ruc_empresa}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  return (
    <div>
      {/* Header */}
      <header style={{ marginBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '2px', marginBottom: 8 }}>
          <FileText size={14} /> Módulo Fiscal
        </div>
        <h1 className="h1" style={{ fontSize: '2.5rem', fontWeight: 900 }}>Anexo Transaccional</h1>
        <p className="text-sec" style={{ fontSize: '1.1rem' }}>Genera el ATS para declarar al SRI desde tus documentos procesados.</p>
      </header>

      {/* Selector Periodo + Acciones */}
      <div className="glass-card" style={{ padding: '20px 24px', marginBottom: 24, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <Calendar size={18} style={{ color: 'var(--primary)' }} />
        <select value={mes} onChange={e => setMes(+e.target.value)} style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', fontWeight: 700 }}>
          {MESES.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
        </select>
        <select value={anio} onChange={e => setAnio(+e.target.value)} style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', fontWeight: 700 }}>
          {[2023, 2024, 2025, 2026].map(y => <option key={y}>{y}</option>)}
        </select>
        <button onClick={fetchData} className="btn" style={{ padding: '8px 14px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={15} /> Cargar
        </button>
        <div style={{ flex: 1 }} />
        <button
          onClick={generarXML}
          disabled={facturas.length === 0}
          className="btn btn-primary"
          style={{ padding: '10px 22px', borderRadius: 14, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8, opacity: facturas.length === 0 ? 0.5 : 1 }}
        >
          <FileDown size={18} /> Descargar ATS XML
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Facturas de Compra', value: facturas.length, unit: 'docs', color: 'var(--primary)' },
          { label: 'Base Gravada 12%', value: `$${totalBase12.toFixed(2)}`, unit: '', color: '#10b981' },
          { label: 'IVA Total', value: `$${totalIVA.toFixed(2)}`, unit: '', color: 'var(--warning)' },
          { label: 'Retenciones IR', value: `$${totalRet.toFixed(2)}`, unit: '', color: '#8b5cf6' },
        ].map(k => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card" style={{ padding: '20px 24px' }}>
            <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-sec)' }}>{k.label}</p>
            <p style={{ margin: '8px 0 0', fontSize: '1.8rem', fontWeight: 900, color: k.color }}>{k.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Advertencias */}
      {advertencias.length > 0 && (
        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 16, padding: '16px 20px', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, color: 'var(--warning)', marginBottom: 8 }}>
            <AlertCircle size={16} /> Advertencias antes de generar
          </div>
          {advertencias.map((w, i) => <p key={i} style={{ margin: '4px 0', fontSize: '0.85rem', color: 'var(--text-sec)' }}>• {w}</p>)}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {([['compras','Facturas de Compra', facturas.length], ['retenciones','Retenciones Recibidas', retenciones.length]] as [Tab,string,number][]).map(([id, label, cnt]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding: '10px 20px', borderRadius: 12, border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem', background: tab === id ? 'var(--primary)' : 'var(--glass-bg)', color: tab === id ? '#fff' : 'var(--text-sec)', display: 'flex', alignItems: 'center', gap: 8 }}>
            {id === 'compras' ? <FileText size={15}/> : <Receipt size={15}/>} {label}
            <span style={{ background: tab === id ? 'rgba(255,255,255,0.25)' : 'var(--primary-light)', color: tab === id ? '#fff' : 'var(--primary)', padding: '2px 8px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 800 }}>{cnt}</span>
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-sec)' }}>
            <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', marginBottom: 12 }} />
            <p>Cargando documentos del período...</p>
          </div>
        ) : tab === 'compras' ? (
          facturas.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-sec)' }}>
              <CheckCircle2 size={36} style={{ opacity: 0.2, marginBottom: 12 }} />
              <p>No hay facturas de compra para {MESES[mes-1]} {anio}.<br />Procesa XMLs desde el módulo de Automatización SRI.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)' }}>
                  {['Proveedor / RUC','Comprobante','Fecha','Base 0%','Base 12%','IVA','Retención IR','Total'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: h === 'Proveedor / RUC' ? 'left' : 'right', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-sec)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {facturas.map((d) => {
                  const ret = (d.retenciones_aplicadas || []).reduce((a: number, r: any) => a + (r.valor || 0), 0);
                  return (
                    <tr key={d.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.85rem' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700 }}>{d.transacciones?.entidades?.nombre || <span style={{ color: 'var(--error)', fontStyle: 'italic' }}>Sin entidad</span>}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-sec)' }}>{d.transacciones?.entidades?.ruc_cedula || '—'}</div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.78rem' }}>{d.transacciones?.numero_comprobante || '—'}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-sec)', whiteSpace: 'nowrap' }}>{d.transacciones?.fecha ? new Date(d.transacciones.fecha).toLocaleDateString('es-EC') : '—'}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>${(d.base_0 || 0).toFixed(2)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>${(d.base_12 || 0).toFixed(2)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--primary)', fontWeight: 700 }}>${(d.monto_iva || 0).toFixed(2)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: '#8b5cf6', fontWeight: 700 }}>{ret > 0 ? `-$${ret.toFixed(2)}` : '—'}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 900 }}>${((d.base_12 || 0) + (d.monto_iva || 0)).toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border-color)', background: 'rgba(255,255,255,0.03)', fontWeight: 900 }}>
                  <td colSpan={4} style={{ padding: '14px 16px', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>TOTALES</td>
                  <td style={{ padding: '14px 16px', textAlign: 'right', color: '#10b981' }}>${totalBase12.toFixed(2)}</td>
                  <td style={{ padding: '14px 16px', textAlign: 'right', color: 'var(--primary)' }}>${totalIVA.toFixed(2)}</td>
                  <td style={{ padding: '14px 16px', textAlign: 'right', color: '#8b5cf6' }}>-${totalRet.toFixed(2)}</td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>${(totalBase12 + totalIVA).toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          )
        ) : (
          retenciones.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-sec)' }}>
              <Receipt size={36} style={{ opacity: 0.2, marginBottom: 12 }} />
              <p>No hay comprobantes de retención para {MESES[mes-1]} {anio}.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)' }}>
                  {['Agente de Retención','N° Comprobante','Fecha','Docs Sustento','Total Retenido'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: h === 'Agente de Retención' ? 'left' : 'right', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-sec)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {retenciones.map(d => {
                  const totalRetDoc = (d.retenciones_aplicadas || []).reduce((a: number, r: any) => a + (r.valor || 0), 0);
                  const docsRef = [...new Set((d.retenciones_aplicadas || []).map((r: any) => r.desc_doc).filter(Boolean))];
                  return (
                    <tr key={d.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.85rem' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700 }}>{d.transacciones?.entidades?.nombre || '—'}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-sec)' }}>{d.transacciones?.entidades?.ruc_cedula || '—'}</div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.78rem' }}>{d.transacciones?.numero_comprobante || '—'}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>{d.transacciones?.fecha ? new Date(d.transacciones.fecha).toLocaleDateString('es-EC') : '—'}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.78rem', color: 'var(--text-sec)' }}>{docsRef.join(', ') || '—'}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 900, color: 'var(--warning)' }}>${totalRetDoc.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
