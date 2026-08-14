import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw,
  CheckCircle2,
  FileText,
  Receipt,
  TrendingUp,
  TrendingDown,
  Code2,
  Copy,
  ChevronDown,
  ChevronUp,
  Lock
} from 'lucide-react';
import { supabase } from '../services/supabase';
import JSZip from 'jszip';
import { buildATSXml, getSRIDocumentNumber } from '../utils/atsXmlBuilder';
import { exportATSToExcel } from '../utils/atsExcelExporter';
import { SRIShieldDiagnostics } from '../components/SRIShieldDiagnostics';
import { ATSPeriodSelector } from '../components/ATSPeriodSelector';
import { trackAtsGeneration, trackAtsExcelExport } from '../services/analytics';

interface ATSProps { 
  empresaId: string; 
  permisoDescargaAts: boolean;
}

interface DocSRI {
  id: string;
  base_12: number;
  base_0: number;
  base_no_objeto?: number;
  monto_iva: number;
  clave_acceso_xml: string;
  es_compra: boolean;
  forma_pago?: string;
  retenciones_aplicadas: any[];
  transacciones: {
    id: string;
    fecha: string;
    concepto: string;
    tipo_comprobante: string;
    numero_comprobante: string;
    entidades?: {
      id: string;
      nombre: string;
      razon_social: string;
      ruc_cedula: string;
      tipo_identificacion?: string;
      persona_tipo?: string
    } | null;
  } | null;
}

interface EmpresaInfo {
  nombre_empresa: string;
  ruc_empresa: string;
}

type Tab = 'compras' | 'ventas' | 'retenciones' | 'anulados';

export const ATS: React.FC<ATSProps> = ({ empresaId, permisoDescargaAts }) => {
  const now = new Date();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [anio, setAnio] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [tab, setTab] = useState<Tab>('compras');
  const [docs, setDocs] = useState<DocSRI[]>([]);
  const [empresa, setEmpresa] = useState<EmpresaInfo | null>(null);
  const [loading, setLoading] = useState(false);

  // Shield Diagnóstico
  const [alertasCriticas, setAlertasCriticas] = useState<string[]>([]);
  const [advertencias, setAdvertencias] = useState<string[]>([]);

  // Live Previewer
  const [showXmlPreview, setShowXmlPreview] = useState(false);
  const [xmlStringPreview, setXmlStringPreview] = useState('');
  const [copied, setCopied] = useState(false);

  const fetchData = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      const [{ data: empData }, { data: docsData }] = await Promise.all([
        supabase.from('empresas_gestionadas').select('nombre_empresa, ruc_empresa').eq('id', empresaId).single(),
        supabase.from('documentos_sri').select(`
          id, base_12, base_0, base_no_objeto, monto_iva, clave_acceso_xml, es_compra, forma_pago, retenciones_aplicadas,
          transacciones ( id, fecha, concepto, tipo_comprobante, numero_comprobante,
            entidades ( id, nombre, razon_social, ruc_cedula, tipo_identificacion, persona_tipo )
          )
        `).eq('id_empresa', empresaId)
      ]);

      if (empData) setEmpresa(empData);

      if (docsData) {
        // Filtrar por periodo (mes y año)
        const filtered = (docsData as any[]).filter(d => {
          const fecha = d.transacciones?.fecha;
          if (!fecha) return false;
          const f = new Date(fecha);
          return f.getUTCFullYear() === anio && f.getUTCMonth() + 1 === mes;
        });
        setDocs(filtered);

        // --- MOTOR DE DIAGNÓSTICO SRI-SHIELD ---
        const criticals: string[] = [];
        const warns: string[] = [];

        filtered.forEach(d => {
          const ent = d.transacciones?.entidades;
          const numComp = getSRIDocumentNumber(d);
          const esComp = d.es_compra;

          if (!d.transacciones) {
            criticals.push(`Comprobante sin datos de transacción enlazados.`);
            return;
          }

          if (!ent) {
            criticals.push(`Comprobante ${numComp}: No tiene una Entidad (Cliente/Proveedor) vinculada.`);
            return;
          }

          // Validación de Identificaciones
          const idStr = ent.ruc_cedula || '';
          if (idStr === '9999999999999' && esComp) {
            criticals.push(`Proveedor "${ent.razon_social}": Consumidor Final no permitido en Compras.`);
          } else if (idStr.length !== 13 && idStr.length !== 10 && idStr !== '9999999999999') {
            criticals.push(`Entidad "${ent.razon_social}": Identificación no válida (${idStr.length} dígitos).`);
          }

          // Tipo de Identificación SRI
          if (!ent.tipo_identificacion) {
            criticals.push(`Entidad "${ent.razon_social}": Falta configurar el "Tipo de Identificación SRI".`);
          }

          // Validación de Secuenciales (9 dígitos)
          const partesNum = numComp.split('-');
          if (partesNum.length === 3) {
            if (partesNum[0].length !== 3 || partesNum[1].length !== 3 || partesNum[2].length !== 9) {
              warns.push(`Doc ${numComp}: Formato de secuencial inusual (Debe ser estab[3]-ptoEmi[3]-secuencial[9]).`);
            }
          } else {
            criticals.push(`Doc "${numComp || 'Sin número'}": Formato de número de comprobante incorrecto.`);
          }

          // Forma de pago en compras
          if (esComp && !d.forma_pago) {
            warns.push(`Compra ${numComp}: Sin forma de pago especificada. Se asignará 'Otros con sistema financiero (20)' por defecto.`);
          }

          // --- NUEVAS COMPROBACIONES DE ROBUSTEZ FISCAL ---
          const rets = d.retenciones_aplicadas || [];
          const firstRet = rets[0];

          if (esComp) {
            // 1. Validar existencia del sustento tributario (solo si no hay retenciones en absoluto para evitar falsas advertencias en facturas antiguas procesadas)
            const sust = firstRet?.cod_sustento;
            if (!sust && rets.length === 0) {
              warns.push(`Compra ${numComp}: No se ha definido el Sustento Tributario. Se asumirá '01' (Crédito Tributario para IVA) por defecto.`);
            }

            // 2. Validar que si hay valores retenidos, el comprobante de retención esté ingresado correctamente
            const retRenta = rets.filter((r: any) => r.tipo === 'RENTA' || !r.tipo);
            const retIVA = rets.filter((r: any) => r.tipo === 'IVA');
            const tieneRetencion = retRenta.some((r: any) => r.valor > 0) || retIVA.some((r: any) => r.valor > 0);

            if (tieneRetencion) {
              const numRet = firstRet?.numero_retencion;
              const autRet = firstRet?.clave_retencion;
              const fechaRet = firstRet?.fecha_retencion;

              if (!numRet || numRet === 'Manual') {
                criticals.push(`Compra ${numComp}: Tiene retenciones calculadas pero falta ingresar el Número de la Retención emitida.`);
              } else if (!/^\d{3}-\d{3}-\d{9}$/.test(numRet)) {
                criticals.push(`Compra ${numComp}: El Número de Retención emitido (${numRet}) tiene un formato inválido.`);
              }

              if (!autRet) {
                criticals.push(`Compra ${numComp}: Falta ingresar el número de autorización de la retención emitida.`);
              } else if (autRet.length !== 10 && autRet.length !== 49) {
                criticals.push(`Compra ${numComp}: La autorización de la retención debe tener 10 o 49 dígitos (actual: ${autRet.length}).`);
              }

              if (!fechaRet) {
                criticals.push(`Compra ${numComp}: Falta ingresar la fecha de emisión del comprobante de retención.`);
              }
            }
          }
        });

        setAlertasCriticas([...new Set(criticals)]);
        setAdvertencias([...new Set(warns)]);
      }
    } catch (e) {
      console.error("Error cargando datos ATS:", e);
    } finally {
      setLoading(false);
    }
  }, [empresaId, anio, mes]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Clasificación y Filtros ──────────────────────────────────
  const compras = docs.filter(d => (d.transacciones?.tipo_comprobante === 'Factura' || d.transacciones?.tipo_comprobante === 'Nota de Crédito') && d.es_compra);
  const ventas = docs.filter(d => (d.transacciones?.tipo_comprobante === 'Factura' || d.transacciones?.tipo_comprobante === 'Nota de Crédito') && !d.es_compra);
  const retenciones = docs.filter(d => d.transacciones?.tipo_comprobante === 'Comprobante de Retención');
  const retencionesRecibidas = docs.filter(d => d.transacciones?.tipo_comprobante === 'Comprobante de Retención' && !d.es_compra);
  const anulados = docs.filter(d =>
    d.transacciones?.concepto?.toLowerCase().includes('anulado') ||
    d.transacciones?.tipo_comprobante === 'Anulado'
  );

  // ─── Agrupamientos y KPIs Contables ──────────────────────────
  const totalIVAVentas = ventas.reduce((s, d) => {
    const isNC = d.transacciones?.tipo_comprobante === 'Nota de Crédito';
    return s + (isNC ? -(d.monto_iva || 0) : (d.monto_iva || 0));
  }, 0);

  const totalRetEmitido = compras.reduce((s, d) =>
    s + (d.retenciones_aplicadas || []).reduce((a: number, r: any) => a + (r.valor || 0), 0), 0);

  // Agrupamiento de Ventas por Cliente para el ATS con retenciones dinámicas
  const ventasAgrupadasPorCliente = Object.values(
    ventas.reduce((acc, v) => {
      const ent = v.transacciones?.entidades;
      const idCliente = ent?.ruc_cedula || '9999999999999';
      const isNC = v.transacciones?.tipo_comprobante === 'Nota de Crédito';
      const tipoComp = isNC ? 'Nota de Crédito' : 'Factura';
      const key = `${idCliente}_${tipoComp}`;

      if (!acc[key]) {
        acc[key] = {
          ruc: idCliente,
          razonSocial: ent?.razon_social || ent?.nombre || 'Consumidor Final',
          tipoId: ent?.tipo_identificacion || '07',
          tipoDoc: tipoComp,
          tipoComprobante: isNC ? '04' : '01',
          numeroComprobantes: 0,
          base0: 0,
          base12: 0,
          baseNoObjeto: 0,
          iva: 0,
          total: 0,
          retIva: 0,
          retRenta: 0
        };
      }
      acc[key].numeroComprobantes += 1;
      acc[key].base0 += v.base_0 || 0;
      acc[key].base12 += v.base_12 || 0;
      acc[key].baseNoObjeto += v.base_no_objeto || 0;
      acc[key].iva += v.monto_iva || 0;
      acc[key].total += (v.base_12 || 0) + (v.base_0 || 0) + (v.base_no_objeto || 0) + (v.monto_iva || 0);
      return acc;
    }, {} as Record<string, any>)
  ).map((v: any) => {
    const retsCliente = retencionesRecibidas.filter(r => r.transacciones?.entidades?.ruc_cedula === v.ruc);
    let totalRetIva = 0;
    let totalRetRenta = 0;

    retsCliente.forEach(r => {
      const retsAplicadas = r.retenciones_aplicadas || [];
      retsAplicadas.forEach((ra: any) => {
        if (ra.tipo === 'IVA') {
          totalRetIva += ra.valor || 0;
        } else if (ra.tipo === 'RENTA' || !ra.tipo) {
          totalRetRenta += ra.valor || 0;
        }
      });
    });

    return {
      ...v,
      retIva: v.tipoComprobante === '04' ? 0 : totalRetIva,
      retRenta: v.tipoComprobante === '04' ? 0 : totalRetRenta
    };
  });

  // ─── COMPILADOR DE XML ATS (SRI COMPLIANT) ────────────────────
  const buildXMLString = (): string => {
    if (!empresa) return '';
    return buildATSXml(empresa, anio, mes, docs);
  };

  const generarXML = async () => {
    if (!permisoDescargaAts) {
      setShowUpgradeModal(true);
      return;
    }
    if (!empresa) return;
    const xml = buildXMLString();
    const mesStr = String(mes).padStart(2, '0');

    const zip = new JSZip();
    const filename = `AT${mesStr}${anio}`;
    zip.file(`${filename}.xml`, xml);

    trackAtsGeneration(`${anio}-${String(mes).padStart(2, '0')}`);
    try {
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error generating ZIP:", err);
      alert("Error al comprimir el archivo XML.");
    }
  };

  const generarExcel = () => {
    if (!permisoDescargaAts) {
      setShowUpgradeModal(true);
      return;
    }
    if (!empresa) return;
    trackAtsExcelExport(`${anio}-${String(mes).padStart(2, '0')}`);
    exportATSToExcel(empresa, anio, mes, docs);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(xmlStringPreview);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTogglePreview = () => {
    if (!showXmlPreview) {
      setXmlStringPreview(buildXMLString());
    }
    setShowXmlPreview(!showXmlPreview);
  };

  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  return (
    <div className="space-y-6">

      <ATSPeriodSelector
        mes={mes}
        setMes={setMes}
        anio={anio}
        setAnio={setAnio}
        fetchData={fetchData}
        generarExcel={generarExcel}
        generarXML={generarXML}
        docsLength={docs.length}
        hasCriticalErrors={alertasCriticas.length > 0}
        MESES={MESES}
      />

      {/* KPIs Fiscales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Facturas de Compra', value: compras.length, unit: 'docs', color: 'var(--primary)', isCurrency: false },
          { label: 'Facturas de Venta', value: ventas.length, unit: 'docs', color: '#10b981', isCurrency: false },
          { label: 'IVA Cobrado (Ventas)', value: totalIVAVentas, unit: '', color: 'var(--warning)', isCurrency: true },
          { label: 'Retenciones de Renta', value: totalRetEmitido, unit: '', color: '#8b5cf6', isCurrency: true },
        ].map(k => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card" style={{ padding: '20px 24px' }}>
            <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-sec)' }}>{k.label}</p>
            <p style={{ margin: '8px 0 0', fontSize: '1.8rem', fontWeight: 900, color: k.color }}>
              {k.isCurrency ? `$${k.value.toFixed(2)}` : k.value}
            </p>
          </motion.div>
        ))}
      </div>

      <SRIShieldDiagnostics
        alertasCriticas={alertasCriticas}
        advertencias={advertencias}
        docsLength={docs.length}
      />

      {/* Tabs de inspección */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {([
          ['compras', 'Facturas Compra', compras.length],
          ['ventas', 'Ventas (Agrupadas)', ventasAgrupadasPorCliente.length],
          ['retenciones', 'Retenciones', retenciones.length],
          ['anulados', 'Anulados', anulados.length]
        ] as [Tab, string, number][]).map(([id, label, cnt]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding: '10px 20px', borderRadius: 12, border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem', background: tab === id ? 'var(--primary)' : 'var(--glass-bg)', color: tab === id ? '#fff' : 'var(--text-sec)', display: 'flex', alignItems: 'center', gap: 8 }}>
            {id === 'compras' && <FileText size={15} />}
            {id === 'ventas' && <TrendingUp size={15} />}
            {id === 'retenciones' && <Receipt size={15} />}
            {id === 'anulados' && <TrendingDown size={15} />}
            {label}
            <span style={{ background: tab === id ? 'rgba(255,255,255,0.25)' : 'var(--primary-light)', color: tab === id ? '#fff' : 'var(--primary)', padding: '2px 8px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 800 }}>{cnt}</span>
          </button>
        ))}
      </div>

      {/* Visor de Tablas de Inspección */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-sec)' }}>
            <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', marginBottom: 12 }} />
            <p>Cargando registros contables...</p>
          </div>
        ) : tab === 'compras' ? (
          compras.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-sec)' }}>
              <CheckCircle2 size={36} style={{ opacity: 0.2, marginBottom: 12 }} />
              <p>No hay facturas o notas de crédito de compra procesadas en este periodo.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)' }}>
                  {['Proveedor', 'Número Comprobante', 'Fecha', 'Base 0%', 'Base Imp Grav', 'IVA', 'Forma Pago', 'Total'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: h === 'Proveedor' ? 'left' : 'right', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-sec)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compras.map((d) => {
                  const isNC = d.transacciones?.tipo_comprobante === 'Nota de Crédito';
                  return (
                    <tr key={d.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.85rem' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                          {d.transacciones?.entidades?.razon_social || '—'}
                          {isNC && (
                            <span style={{ fontSize: '0.65rem', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '1px 6px', borderRadius: 4, fontWeight: 800 }}>NC</span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-sec)' }}>{d.transacciones?.entidades?.ruc_cedula || '—'}</div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.78rem' }}>{d.transacciones?.numero_comprobante}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-sec)' }}>{d.transacciones?.fecha ? new Date(d.transacciones.fecha + 'T12:00:00').toLocaleDateString('es-EC') : '—'}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>${(d.base_0 || 0).toFixed(2)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>${(d.base_12 || 0).toFixed(2)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--primary)', fontWeight: 700 }}>${(d.monto_iva || 0).toFixed(2)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800 }}>{d.forma_pago || '20'}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 900 }}>
                        {isNC ? '-' : ''}${((d.base_12 || 0) + (d.base_0 || 0) + (d.monto_iva || 0)).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        ) : tab === 'ventas' ? (
          ventasAgrupadasPorCliente.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-sec)' }}>
              <TrendingUp size={36} style={{ opacity: 0.2, marginBottom: 12 }} />
              <p>No hay registros de ventas en este periodo.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)' }}>
                  {['Cliente', 'Tipo ID', 'Tipo Doc', 'Comprobantes', 'Suma Base 0%', 'Suma Base 12%', 'Suma IVA', 'Total Facturado'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: h === 'Cliente' ? 'left' : 'right', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-sec)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ventasAgrupadasPorCliente.map((v: any) => (
                  <tr key={`${v.ruc}_${v.tipoDoc}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.85rem' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700 }}>{v.razonSocial}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-sec)' }}>{v.ruc}</div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800 }}>{v.tipoId}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <span style={{
                        fontSize: '0.75rem',
                        background: v.tipoDoc === 'Nota de Crédito' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                        color: v.tipoDoc === 'Nota de Crédito' ? '#ef4444' : '#10b981',
                        padding: '2px 8px',
                        borderRadius: 6,
                        fontWeight: 700
                      }}>
                        {v.tipoDoc}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>{v.numeroComprobantes}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>${v.base0.toFixed(2)}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>${v.base12.toFixed(2)}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--primary)', fontWeight: 700 }}>${v.iva.toFixed(2)}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 900 }}>
                      {v.tipoDoc === 'Nota de Crédito' ? '-' : ''}${v.total.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : tab === 'retenciones' ? (
          retenciones.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-sec)' }}>
              <Receipt size={36} style={{ opacity: 0.2, marginBottom: 12 }} />
              <p>No hay comprobantes de retención cargados.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)' }}>
                  {['Tercero', 'Secuencial', 'Fecha', 'Conceptos Aplicados', 'Total Retenido'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: h === 'Tercero' ? 'left' : 'right', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-sec)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {retenciones.map(d => {
                  const totalRetDoc = (d.retenciones_aplicadas || []).reduce((a: number, r: any) => a + (r.valor || 0), 0);
                  const docsRef = [...new Set((d.retenciones_aplicadas || []).map((r: any) => r.codigo).filter(Boolean))];
                  return (
                    <tr key={d.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.85rem' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700 }}>{d.transacciones?.entidades?.razon_social || '—'}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-sec)' }}>{d.transacciones?.entidades?.ruc_cedula || '—'}</div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.78rem' }}>{d.transacciones?.numero_comprobante}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>{d.transacciones?.fecha ? new Date(d.transacciones.fecha + 'T12:00:00').toLocaleDateString('es-EC') : '—'}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.78rem', color: 'var(--text-sec)' }}>Código: {docsRef.join(', ') || '—'}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 900, color: 'var(--warning)' }}>${totalRetDoc.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        ) : (
          anulados.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-sec)' }}>
              <TrendingDown size={36} style={{ opacity: 0.2, marginBottom: 12 }} />
              <p>No hay facturas o comprobantes marcados como anulados en este periodo.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)' }}>
                  {['Comprobante', 'Secuencial', 'Fecha Anulación', 'Autorización / Clave Acceso'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: h === 'Comprobante' ? 'left' : 'right', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-sec)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {anulados.map(d => (
                  <tr key={d.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.85rem' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 800 }}>{d.transacciones?.tipo_comprobante}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace' }}>{d.transacciones?.numero_comprobante}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>{d.transacciones?.fecha ? new Date(d.transacciones.fecha + 'T12:00:00').toLocaleDateString('es-EC') : '—'}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.78rem', color: 'var(--text-sec)', fontFamily: 'monospace' }}>{d.clave_acceso_xml}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>

      {/* Acordeón Previsualizador de XML ATS */}
      {docs.length > 0 && (
        <div className="glass-card" style={{ padding: 0, marginTop: 32, overflow: 'hidden' }}>
          <div
            onClick={handleTogglePreview}
            style={{ padding: '18px 24px', cursor: 'pointer', display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 900, color: 'var(--primary)' }}>
              <Code2 size={18} /> Previsualizador Interactivo del XML ATS
            </div>
            {showXmlPreview ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>

          <AnimatePresence>
            {showXmlPreview && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                style={{ borderTop: '1px solid var(--border-color)', background: '#0f172a', padding: 24, position: 'relative' }}
              >
                <button
                  onClick={copyToClipboard}
                  style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 700 }}
                >
                  <Copy size={14} /> {copied ? '¡Copiado!' : 'Copiar XML'}
                </button>
                <pre style={{ margin: 0, overflowX: 'auto', fontFamily: 'monospace', fontSize: '0.82rem', color: '#cbd5e1', lineHeight: '1.5' }}>
                  <code>{xmlStringPreview.split('\n').slice(0, 35).join('\n')}\n... [XML Completo listo para descarga]</code>
                </pre>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* MODAL DE UPGRADE PREMIUM */}
      {showUpgradeModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999999,
          padding: 16
        }} onClick={() => setShowUpgradeModal(false)}>
          <div style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: 24,
            width: '100%',
            maxWidth: 440,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
            overflow: 'hidden',
            padding: '32px 24px',
            textAlign: 'center',
            backdropFilter: 'blur(40px)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'rgba(0, 214, 143, 0.15)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              fontSize: '1.8rem'
            }}>
              <Lock size={32} />
            </div>

            <h3 style={{ margin: '0 0 12px', fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-main)' }}>
              ¡Acceso a Descargas Premium!
            </h3>

            <p style={{ margin: '0 0 24px', fontSize: '0.92rem', color: 'var(--text-sec)', lineHeight: 1.6 }}>
              La descarga del archivo XML para declaración fiscal del ATS requiere una suscripción activa. Contacta con tu administrador para habilitar este módulo.
            </p>

            <button
              onClick={() => setShowUpgradeModal(false)}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: 14,
                fontWeight: 800,
                fontSize: '0.95rem',
                justifyContent: 'center'
              }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
