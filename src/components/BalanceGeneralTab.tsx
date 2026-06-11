import React from 'react';
import { Download, ChevronDown, ChevronRight, CheckCircle2, XCircle } from 'lucide-react';

interface Props {
  filteredLedger: any[];
  rootAccounts: any[];
  expandedAccounts: Record<string, boolean>;
  toggleAccount: (code: string) => void;
  isVisibleByParentCollapse: (code: string) => boolean;
  desde: string;
  hasta: string;
}

export const BalanceGeneralTab: React.FC<Props> = ({
  filteredLedger,
  rootAccounts,
  expandedAccounts,
  toggleAccount,
  isVisibleByParentCollapse,
  desde,
  hasta
}) => {
  // Calcular utilidad del período actual
  const totalIng = rootAccounts.filter(i => i.tipo === 'Ingreso').reduce((s, i) => s + i.saldo, 0);
  const totalGas = rootAccounts.filter(i => i.tipo === 'Gasto').reduce((s, i) => s + i.saldo, 0);
  const utilidadPeriodo = totalIng - totalGas;

  const activos = filteredLedger.filter(i => i.tipo === 'Activo');
  const pasivos = filteredLedger.filter(i => i.tipo === 'Pasivo');
  const patrimonio = filteredLedger.filter(i => i.tipo === 'Patrimonio');

  // Sumatorias raíces
  const totalActivos = rootAccounts.filter(i => i.tipo === 'Activo').reduce((s, i) => s + i.saldo, 0);
  const totalPasivos = rootAccounts.filter(i => i.tipo === 'Pasivo').reduce((s, i) => s + i.saldo, 0);
  const totalPatrimonioPlano = rootAccounts.filter(i => i.tipo === 'Patrimonio').reduce((s, i) => s + i.saldo, 0);
  
  // Sumar la utilidad al patrimonio de forma dinámica
  const totalPatrimonioConUtilidad = totalPatrimonioPlano + utilidadPeriodo;
  const totalPasivoPatrimonio = totalPasivos + totalPatrimonioConUtilidad;

  const balanceCuadrado = Math.abs(totalActivos - totalPasivoPatrimonio) < 0.01;

  const exportBG = () => {
    const rows = [
      ['Balance General Clasificado'],
      ['Grupo', 'Código', 'Cuenta', 'Saldo'],
      ['Activos', '', '', totalActivos.toFixed(2)]
    ];
    activos.forEach(i => rows.push(['Activo', i.codigo_cuenta, i.nombre, i.saldo.toFixed(2)]));
    rows.push(['Pasivos', '', '', totalPasivos.toFixed(2)]);
    pasivos.forEach(i => rows.push(['Pasivo', i.codigo_cuenta, i.nombre, i.saldo.toFixed(2)]));
    rows.push(['Patrimonio', '', '', totalPatrimonioConUtilidad.toFixed(2)]);
    patrimonio.forEach(i => rows.push(['Patrimonio', i.codigo_cuenta, i.nombre, i.saldo.toFixed(2)]));
    rows.push(['Utilidad del Ejercicio (Dinamica)', '', '', utilidadPeriodo.toFixed(2)]);
    rows.push(['TOTAL PASIVO + PATRIMONIO', '', '', totalPasivoPatrimonio.toFixed(2)]);
    
    const csv = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a'); a.href = encodeURI(csv);
    a.download = `Balance_General_${desde || 'inicio'}_${hasta || 'fin'}.csv`;
    a.click();
  };

  const renderTree = (items: typeof assets, color: string) => {
    return items.map(item => {
      if (!isVisibleByParentCollapse(item.codigo_cuenta)) return null;
      const isExpanded = expandedAccounts[item.codigo_cuenta] !== false;
      const paddingLeft = (item.codigo_cuenta.split('.').length - 1) * 16 + 12;

      return (
        <div key={item.id} style={{ 
          padding: '10px 20px', 
          paddingLeft,
          borderBottom: '1px solid rgba(255,255,255,0.03)', 
          display: 'flex', 
          justifyContent: 'space-between', 
          fontSize: '0.88rem',
          fontWeight: item.isParent ? 700 : 400,
          background: item.isParent ? 'rgba(255,255,255,0.01)' : 'transparent'
        }}>
          <span style={{ color: 'var(--text-sec)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {item.isParent && (
              <span onClick={() => toggleAccount(item.codigo_cuenta)} style={{ cursor: 'pointer', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center' }}>
                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </span>
            )}
            {item.codigo_cuenta} · {item.nombre}
          </span>
          <strong style={{ color }}>${item.saldo.toFixed(2)}</strong>
        </div>
      );
    });
  };

  const assets = activos;

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="glass-card" style={{ padding: '14px 20px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <h3 style={{ margin: 0, flex: 1 }}>Balance General Clasificado</h3>
        <div style={{
          padding: '6px 14px', borderRadius: 20, fontWeight: 800, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6,
          background: balanceCuadrado ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)',
          color: balanceCuadrado ? 'var(--success)' : 'var(--error)'
        }}>
          {balanceCuadrado ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
          {balanceCuadrado ? 'A = P + Pat Cuadrado ✓' : `Diferencia Ecuación: $${Math.abs(totalActivos - totalPasivoPatrimonio).toFixed(2)}`}
        </div>
        <button onClick={exportBG} className="btn" style={{ padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 700 }}>
          <Download size={14} /> CSV
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: 20 }}>
        {/* SECCIÓN ACTIVOS (Corriente + No Corriente) */}
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', background: 'rgba(99,102,241,0.08)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 800, color: 'var(--primary)' }}>ACTIVOS</span>
            <span style={{ fontWeight: 900, color: 'var(--primary)', fontSize: '1.1rem' }}>${totalActivos.toFixed(2)}</span>
          </div>
          <div style={{ maxHeight: 440, overflowY: 'auto' }}>
            {renderTree(activos, 'var(--primary)')}
          </div>
          <div style={{ padding: '14px 20px', background: 'rgba(99,102,241,0.03)', borderTop: '2px solid rgba(99,102,241,0.2)', display: 'flex', justifyContent: 'space-between', fontWeight: 900 }}>
            <span>TOTAL ACTIVOS</span>
            <span style={{ color: 'var(--primary)' }}>${totalActivos.toFixed(2)}</span>
          </div>
        </div>

        {/* SECCIÓN PASIVOS + PATRIMONIO */}
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', background: 'rgba(245,158,11,0.08)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 800, color: 'var(--warning)' }}>PASIVOS & PATRIMONIO</span>
            <span style={{ fontWeight: 900, color: 'var(--warning)', fontSize: '1.1rem' }}>${totalPasivoPatrimonio.toFixed(2)}</span>
          </div>
          <div style={{ maxHeight: 440, overflowY: 'auto' }}>
            <div style={{ padding: '8px 20px', fontWeight: 800, fontSize: '0.75rem', letterSpacing: 0.5, background: 'rgba(255,255,255,0.02)', color: 'var(--text-sec)' }}>PASIVOS</div>
            {renderTree(pasivos, 'var(--warning)')}

            <div style={{ padding: '8px 20px', fontWeight: 800, fontSize: '0.75rem', letterSpacing: 0.5, background: 'rgba(255,255,255,0.02)', color: 'var(--text-sec)', borderTop: '1px solid var(--border-color)' }}>PATRIMONIO</div>
            {renderTree(patrimonio, '#8b5cf6')}

            {/* Fila Virtual de Utilidad del Ejercicio */}
            <div style={{ padding: '10px 20px 10px 28px', borderBottom: '1px solid rgba(255,255,255,0.03)', display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', fontWeight: 700, background: 'rgba(16,185,129,0.03)' }}>
              <span style={{ color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                3.99.99 · Resultado Neto del Ejercicio (Dinámico)
              </span>
              <strong style={{ color: 'var(--success)' }}>${utilidadPeriodo.toFixed(2)}</strong>
            </div>
          </div>
          <div style={{ padding: '14px 20px', background: 'rgba(245,158,11,0.03)', borderTop: '2px solid rgba(245,158,11,0.2)', display: 'flex', justifyContent: 'space-between', fontWeight: 900 }}>
            <span>TOTAL PASIVO + PATRIMONIO</span>
            <span style={{ color: 'var(--warning)' }}>${totalPasivoPatrimonio.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </section>
  );
};
