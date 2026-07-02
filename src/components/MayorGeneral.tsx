import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { ChevronLeft, Download, Search, Calendar, ArrowUpDown } from 'lucide-react';
import { generatePDFReport } from '../utils/pdfGenerator';

interface Props { 
  empresaId: string; 
  permisoReportesPdf: boolean;
  onPremiumBlock: () => void;
}

interface Account {
  id: string;
  codigo_cuenta: string;
  nombre: string;
  tipo: string;
}

interface MovLine {
  id: string;
  debe: number;
  haber: number;
  transacciones: {
    fecha: string;
    concepto: string;
    tipo_comprobante: string;
    numero_comprobante: string;
    entidades?: { id: string; razon_social: string; ruc_cedula?: string } | null;
  } | null;
}

const inp: React.CSSProperties = {
  padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border-color)',
  background: 'var(--input-bg)', color: 'var(--text-main)', outline: 'none'
};

export const MayorGeneral: React.FC<Props> = ({ empresaId, permisoReportesPdf, onPremiumBlock }) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selected, setSelected] = useState<Account | null>(null);
  const [lines, setLines] = useState<MovLine[]>([]);
  const [loadingAcc, setLoadingAcc] = useState(true);
  const [loadingLines, setLoadingLines] = useState(false);
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [onlyWithMov, setOnlyWithMov] = useState(true);
  const [accTypeFilter, setAccTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const decimals = parseInt(localStorage.getItem('pref_decimals') || '2', 10);

  // Totales aggregados por cuenta (para el listado)
  const [totalesMap, setTotalesMap] = useState<Map<string, { debe: number; haber: number }>>(new Map());

  useEffect(() => {
    const load = async () => {
      setLoadingAcc(true);
      const [accRes, movRes] = await Promise.all([
        supabase.from('plan_cuentas').select('id,codigo_cuenta,nombre,tipo').eq('id_empresa', empresaId).order('codigo_cuenta'),
        supabase.from('movimientos').select('id_cuenta,debe,haber').eq('id_empresa', empresaId)
      ]);
      if (accRes.data) setAccounts(accRes.data);
      if (movRes.data) {
        const map = new Map<string, { debe: number; haber: number }>();
        movRes.data.forEach((m: any) => {
          const cur = map.get(m.id_cuenta) || { debe: 0, haber: 0 };
          cur.debe += Number(m.debe || 0);
          cur.haber += Number(m.haber || 0);
          map.set(m.id_cuenta, cur);
        });
        setTotalesMap(map);
      }
      setLoadingAcc(false);
    };
    load();
  }, [empresaId]);

  const fetchLines = useCallback(async (acc: Account) => {
    setLoadingLines(true);
    setLines([]);
    let q = supabase
      .from('movimientos')
      .select(`id, debe, haber,
        transacciones ( fecha, concepto, tipo_comprobante, numero_comprobante,
          entidades ( id, razon_social, ruc_cedula ) )`)
      .eq('id_cuenta', acc.id)
      .order('transacciones(fecha)', { ascending: true });

    const { data } = await q;
    if (data) setLines(data as any);
    setLoadingLines(false);
  }, []);

  const selectAccount = (acc: Account) => {
    setSelected(acc);
    fetchLines(acc);
  };

  // Filtrar líneas por fecha y entidad
  const filteredLines = useMemo(() => {
    return lines.filter(l => {
      const f = l.transacciones?.fecha || '';
      if (desde && f < desde) return false;
      if (hasta && f > hasta) return false;
      
      if (entityFilter) {
        const ent = l.transacciones?.entidades;
        if (!ent) return false;
        const nameMatch = ent.razon_social?.toLowerCase().includes(entityFilter.toLowerCase());
        const rucMatch = ent.ruc_cedula?.toLowerCase().includes(entityFilter.toLowerCase());
        if (!nameMatch && !rucMatch) return false;
      }
      
      return true;
    });
  }, [lines, desde, hasta, entityFilter]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [selected, desde, hasta, entityFilter]);

  // Calcular saldo inicial histórico (antes de la fecha 'desde' y filtrado por entidad si aplica)
  const saldoInicial = useMemo(() => {
    if (!selected) return 0;
    const esDeudora = ['Activo', 'Gasto'].includes(selected.tipo);
    let initial = 0;
    lines.forEach(l => {
      if (entityFilter) {
        const ent = l.transacciones?.entidades;
        if (!ent) return;
        const nameMatch = ent.razon_social?.toLowerCase().includes(entityFilter.toLowerCase());
        const rucMatch = ent.ruc_cedula?.toLowerCase().includes(entityFilter.toLowerCase());
        if (!nameMatch && !rucMatch) return;
      }
      
      const f = l.transacciones?.fecha || '';
      if (desde && f < desde) {
        if (esDeudora) initial += l.debe - l.haber;
        else initial += l.haber - l.debe;
      }
    });
    return initial;
  }, [lines, desde, selected, entityFilter]);

  // Calcular saldo acumulado
  const linesConSaldo = useMemo(() => {
    let saldo = saldoInicial;
    const esDeudora = selected && ['Activo', 'Gasto'].includes(selected.tipo);
    return filteredLines.map(l => {
      if (esDeudora) saldo += l.debe - l.haber;
      else saldo += l.haber - l.debe;
      return { ...l, saldoAcum: saldo };
    });
  }, [filteredLines, selected, saldoInicial]);

  const totalDebe = filteredLines.reduce((s, l) => s + l.debe, 0);
  const totalHaber = filteredLines.reduce((s, l) => s + l.haber, 0);

  // Lista de cuentas filtrada
  const accList = useMemo(() => {
    const term = search.toLowerCase();
    return accounts.filter(a => {
      const hasMov = totalesMap.has(a.id);
      if (onlyWithMov && !hasMov) return false;
      if (accTypeFilter && a.tipo !== accTypeFilter) return false;
      if (term && !a.nombre.toLowerCase().includes(term) && !a.codigo_cuenta.includes(term)) return false;
      return true;
    });
  }, [accounts, search, onlyWithMov, totalesMap, accTypeFilter]);

  // Paginación
  const paginatedLines = useMemo(() => {
    const start = (page - 1) * pageSize;
    return linesConSaldo.slice(start, start + pageSize);
  }, [linesConSaldo, page]);
  const totalPages = Math.ceil(linesConSaldo.length / pageSize);

  // Exportar CSV
  const exportCSV = () => {
    if (!permisoReportesPdf) {
      onPremiumBlock();
      return;
    }
    if (!selected) return;
    const metadata = [
      [`Mayor General - Cuenta: ${selected.codigo_cuenta} - ${selected.nombre}`],
      [`Período: ${desde || 'Inicio'} al ${hasta || 'Hoy'}`],
      [`Descargado el: ${new Date().toLocaleDateString('es-EC')} ${new Date().toLocaleTimeString('es-EC')}`],
      []
    ];
    const rows = [['Fecha', 'Concepto', 'Comprobante', 'Tercero', 'Debe', 'Haber', 'Saldo']];
    if (desde) {
      rows.push([
        desde,
        'SALDO INICIAL AL PERÍODO',
        '—',
        '—',
        '0.00',
        '0.00',
        saldoInicial.toFixed(decimals)
      ]);
    }
    linesConSaldo.forEach(l => {
      const tercero = l.transacciones?.entidades?.razon_social || '';
      const ruc = l.transacciones?.entidades?.ruc_cedula ? ` (${l.transacciones.entidades.ruc_cedula})` : '';
      rows.push([
        l.transacciones?.fecha || '',
        `"${(l.transacciones?.concepto || '').replace(/"/g, '""')}"`,
        `${l.transacciones?.tipo_comprobante || ''} ${l.transacciones?.numero_comprobante || ''}`,
        `"${tercero}${ruc}"`,
        l.debe.toFixed(decimals), l.haber.toFixed(decimals), l.saldoAcum.toFixed(decimals)
      ]);
    });
    rows.push(['', 'TOTALES', '', '', totalDebe.toFixed(decimals), totalHaber.toFixed(decimals), '']);
    const csv = 'data:text/csv;charset=utf-8,\uFEFF' + metadata.map(r => r.join(',')).join('\n') + '\n' + rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = encodeURI(csv);
    a.download = `Mayor_${selected.codigo_cuenta}_${selected.nombre}.csv`;
    a.click();
  };

  const exportPDF = async () => {
    if (!permisoReportesPdf) {
      onPremiumBlock();
      return;
    }
    if (!selected) return;
    const columns = ['Fecha', 'Concepto / Tercero', 'Comprobante', 'Debe', 'Haber', 'Saldo Acum.'];
    const rows = [];
    if (desde) {
      rows.push([
        new Date(desde + 'T12:00:00').toLocaleDateString('es-EC'),
        'SALDO INICIAL AL PERÍODO',
        '—',
        '—',
        '—',
        `$${saldoInicial.toFixed(decimals)}`
      ]);
    }
    linesConSaldo.forEach(l => {
      const tercero = l.transacciones?.entidades?.razon_social ? ' - ' + l.transacciones.entidades.razon_social : '';
      const ruc = l.transacciones?.entidades?.ruc_cedula ? ` (${l.transacciones.entidades.ruc_cedula})` : '';
      rows.push([
        l.transacciones?.fecha ? new Date(l.transacciones.fecha + 'T12:00:00').toLocaleDateString('es-EC') : '—',
        `${l.transacciones?.concepto || '—'}${tercero}${ruc}`,
        `${l.transacciones?.tipo_comprobante || ''} ${l.transacciones?.numero_comprobante || ''}`.trim() || '—',
        `$${l.debe.toFixed(decimals)}`,
        `$${l.haber.toFixed(decimals)}`,
        `$${l.saldoAcum.toFixed(decimals)}`
      ]);
    });

    const foot = [[
      '', 'TOTALES', '',
      `$${totalDebe.toFixed(decimals)}`,
      `$${totalHaber.toFixed(decimals)}`,
      `$${(linesConSaldo[linesConSaldo.length - 1]?.saldoAcum ?? saldoInicial).toFixed(decimals)}`
    ]];

    let subtitle = `Cuenta: ${selected.codigo_cuenta} - ${selected.nombre}`;
    if (desde || hasta) subtitle += ` | ${desde || 'Inicio'} al ${hasta || 'Hoy'}`;
    if (entityFilter) subtitle += ` | Filtrado por: ${entityFilter}`;

    await generatePDFReport(empresaId, 'Mayor General', subtitle, columns, rows, foot);
  };

  if (loadingAcc) return (
    <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-sec)' }}>
      Cargando cuentas...
    </div>
  );

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

      {/* ── PANEL IZQUIERDO: Lista de cuentas ── */}
      <div className="glass-card" style={{ width: 280, minWidth: 240, padding: 0, overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Cuentas</div>
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sec)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." style={{ ...inp, paddingLeft: 30, width: '100%', fontSize: '0.85rem', boxSizing: 'border-box' }} />
          </div>
          <select value={accTypeFilter} onChange={e => setAccTypeFilter(e.target.value)} style={{ ...inp, width: '100%', fontSize: '0.8rem', marginBottom: 8, padding: '6px 10px' }}>
            <option value="">Todos los tipos</option>
            <option value="Activo">Activos</option>
            <option value="Pasivo">Pasivos</option>
            <option value="Patrimonio">Patrimonio</option>
            <option value="Ingreso">Ingresos</option>
            <option value="Gasto">Gastos</option>
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-sec)', cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={onlyWithMov} onChange={e => setOnlyWithMov(e.target.checked)} style={{ accentColor: 'var(--primary)' }} />
            Solo con movimientos
          </label>
        </div>
        <div style={{ maxHeight: 540, overflowY: 'auto' }}>
          {accList.map(acc => {
            const t = totalesMap.get(acc.id);
            const isActive = selected?.id === acc.id;
            return (
              <div key={acc.id} onClick={() => selectAccount(acc)} style={{
                padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)',
                background: isActive ? 'var(--primary-light)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--primary)' : '3px solid transparent',
                transition: 'all 0.15s'
              }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 800 }}>{acc.codigo_cuenta}</div>
                <div style={{ fontSize: '0.85rem', fontWeight: isActive ? 800 : 600, marginTop: 2 }}>{acc.nombre}</div>
                {t && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-sec)', marginTop: 3 }}>
                    D: ${t.debe.toFixed(decimals)} · H: ${t.haber.toFixed(decimals)}
                  </div>
                )}
              </div>
            );
          })}
          {accList.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-sec)', fontSize: '0.85rem' }}>
              Sin resultados
            </div>
          )}
        </div>
      </div>

      {/* ── PANEL DERECHO: Detalle por transacción ── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {!selected ? (
          <div className="glass-card" style={{ padding: '60px 20px', textAlign: 'center' }}>
            <ArrowUpDown size={36} style={{ color: 'var(--primary)', opacity: 0.4, marginBottom: 16 }} />
            <p style={{ color: 'var(--text-sec)', fontSize: '1rem' }}>
              Selecciona una cuenta del panel izquierdo<br />para ver su Mayor detallado.
            </p>
          </div>
        ) : (
          <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Header cuenta seleccionada */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>
                <ChevronLeft size={18} /> Cuentas
              </button>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 900, fontSize: '1.05rem' }}>{selected.codigo_cuenta} — {selected.nombre}</span>
                <span style={{ marginLeft: 10, fontSize: '0.75rem', background: 'var(--primary-light)', color: 'var(--primary)', padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>{selected.tipo}</span>
              </div>
              {/* Filtros de fecha y entidad */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Calendar size={14} style={{ color: 'var(--text-sec)' }} />
                <input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={{ ...inp, fontSize: '0.82rem' }} placeholder="Desde" />
                <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={{ ...inp, fontSize: '0.82rem' }} placeholder="Hasta" />
                
                <span style={{ color: 'var(--border-color)', margin: '0 4px' }}>|</span>
                
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Search size={13} style={{ position: 'absolute', left: 10, color: 'var(--text-sec)' }} />
                  <input 
                    type="text" 
                    value={entityFilter} 
                    onChange={e => setEntityFilter(e.target.value)} 
                    placeholder="Filtrar Entidad/RUC..." 
                    style={{ ...inp, paddingLeft: 28, fontSize: '0.82rem', width: 170 }} 
                  />
                  {entityFilter && (
                    <button 
                      onClick={() => setEntityFilter('')} 
                      style={{ position: 'absolute', right: 8, background: 'none', border: 'none', color: 'var(--text-sec)', cursor: 'pointer', fontSize: '0.8rem' }}
                    >
                      ✕
                    </button>
                  )}
                </div>

                {(desde || hasta || entityFilter) && (
                  <button 
                    onClick={() => { setDesde(''); setHasta(''); setEntityFilter(''); }} 
                    style={{ background: 'none', border: 'none', color: 'var(--text-sec)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}
                  >
                    ✕ Limpiar Todo
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={exportCSV} className="btn" style={{ padding: '8px 16px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', fontWeight: 800 }}>
                  <Download size={15} /> CSV
                </button>
                <button onClick={exportPDF} className="btn btn-primary" style={{ padding: '8px 16px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', fontWeight: 800 }}>
                  <Download size={15} /> PDF
                </button>
              </div>
            </div>

            {/* Tabla de movimientos */}
            {loadingLines ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-sec)' }}>Cargando movimientos...</div>
            ) : linesConSaldo.length === 0 ? (
              <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-sec)' }}>
                No hay movimientos{(desde || hasta) ? ' en el período seleccionado' : ' para esta cuenta'}.
              </div>
            ) : (
              <>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)' }}>
                        {['Fecha', 'Concepto / Tercero', 'Comprobante', 'Debe', 'Haber', 'Saldo Acum.'].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: ['Debe', 'Haber', 'Saldo Acum.'].includes(h) ? 'right' : 'left', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-sec)', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {page === 1 && desde && (
                        <tr style={{ borderBottom: '1px dashed var(--border-color)', background: 'rgba(255,255,255,0.02)', fontWeight: 600 }}>
                          <td style={{ padding: '11px 14px', fontSize: '0.83rem', whiteSpace: 'nowrap', color: 'var(--text-sec)' }}>
                            {new Date(desde + 'T12:00:00').toLocaleDateString('es-EC')}
                          </td>
                          <td style={{ padding: '11px 14px' }}>
                            <div style={{ fontSize: '0.87rem', color: 'var(--primary)' }}>
                              SALDO INICIAL AL PERÍODO
                            </div>
                          </td>
                          <td style={{ padding: '11px 14px', fontSize: '0.78rem', color: 'var(--text-sec)', fontFamily: 'monospace' }}>—</td>
                          <td style={{ padding: '11px 14px', textAlign: 'right', fontSize: '0.88rem', color: 'var(--text-sec)' }}>—</td>
                          <td style={{ padding: '11px 14px', textAlign: 'right', fontSize: '0.88rem', color: 'var(--text-sec)' }}>—</td>
                          <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 900, fontSize: '0.9rem', color: saldoInicial >= 0 ? 'var(--primary)' : 'var(--error)', whiteSpace: 'nowrap' }}>
                            ${saldoInicial.toFixed(decimals)}
                          </td>
                        </tr>
                      )}
                      {paginatedLines.map((l, i) => (
                        <tr key={l.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                          <td style={{ padding: '11px 14px', fontSize: '0.83rem', whiteSpace: 'nowrap', color: 'var(--text-sec)' }}>
                            {l.transacciones?.fecha ? new Date(l.transacciones.fecha).toLocaleDateString('es-EC') : '—'}
                          </td>
                          <td style={{ padding: '11px 14px', maxWidth: 280 }}>
                            <div style={{ fontSize: '0.87rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {l.transacciones?.concepto || '—'}
                            </div>
                            {l.transacciones?.entidades?.razon_social && (
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-sec)', marginTop: 2 }}>
                                {l.transacciones.entidades.razon_social}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '11px 14px', fontSize: '0.78rem', color: 'var(--text-sec)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                            {l.transacciones?.tipo_comprobante} {l.transacciones?.numero_comprobante}
                          </td>
                          <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: l.debe > 0 ? 800 : 400, color: l.debe > 0 ? 'var(--text-main)' : 'var(--text-sec)', fontSize: '0.88rem' }}>
                            {l.debe > 0 ? `$${l.debe.toFixed(decimals)}` : '—'}
                          </td>
                          <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: l.haber > 0 ? 800 : 400, color: l.haber > 0 ? 'var(--text-main)' : 'var(--text-sec)', fontSize: '0.88rem' }}>
                            {l.haber > 0 ? `$${l.haber.toFixed(decimals)}` : '—'}
                          </td>
                          <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 900, fontSize: '0.9rem', color: l.saldoAcum >= 0 ? 'var(--primary)' : 'var(--error)', whiteSpace: 'nowrap' }}>
                            ${l.saldoAcum.toFixed(decimals)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: '2px solid var(--border-color)', background: 'rgba(255,255,255,0.03)', fontWeight: 900 }}>
                        <td colSpan={3} style={{ padding: '13px 14px', fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Totales del período — {linesConSaldo.length} movimientos
                        </td>
                        <td style={{ padding: '13px 14px', textAlign: 'right', color: 'var(--text-main)' }}>${totalDebe.toFixed(decimals)}</td>
                        <td style={{ padding: '13px 14px', textAlign: 'right', color: 'var(--text-main)' }}>${totalHaber.toFixed(decimals)}</td>
                        <td style={{ padding: '13px 14px', textAlign: 'right', color: 'var(--primary)' }}>
                          ${linesConSaldo[linesConSaldo.length - 1]?.saldoAcum.toFixed(decimals) ?? '0.00'}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {totalPages > 1 && (
                  <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-sec)', fontWeight: 600 }}>Página {page} de {totalPages}</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Anterior</button>
                      <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Siguiente</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
