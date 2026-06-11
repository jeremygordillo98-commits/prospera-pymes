import React from 'react';
import { Download, ChevronDown, ChevronRight } from 'lucide-react';

interface Props {
  filteredLedger: any[];
  rootAccounts: any[];
  expandedAccounts: Record<string, boolean>;
  toggleAccount: (code: string) => void;
  isVisibleByParentCollapse: (code: string) => boolean;
  desde: string;
  hasta: string;
}

export const EstadoResultadosTab: React.FC<Props> = ({
  filteredLedger,
  rootAccounts,
  expandedAccounts,
  toggleAccount,
  isVisibleByParentCollapse,
  desde,
  hasta
}) => {
  const ingresos = filteredLedger.filter(i => i.tipo === 'Ingreso');
  const gastos = filteredLedger.filter(i => i.tipo === 'Gasto');
  
  // Totales de primer nivel
  const totalIng = rootAccounts.filter(i => i.tipo === 'Ingreso').reduce((s, i) => s + i.saldo, 0);
  const totalGas = rootAccounts.filter(i => i.tipo === 'Gasto').reduce((s, i) => s + i.saldo, 0);
  
  const utilidadOperativa = totalIng - totalGas;
  const partTrabajadores = utilidadOperativa > 0 ? utilidadOperativa * 0.15 : 0;
  const baseIR = utilidadOperativa > 0 ? utilidadOperativa - partTrabajadores : 0;
  const impuestoRenta = baseIR > 0 ? baseIR * 0.25 : 0;
  const utilidadNeta = utilidadOperativa - partTrabajadores - impuestoRenta;

  const exportER = () => {
    const rows = [
      ['Estado de Resultados en Cascada'],
      ['Estructura', 'Código', 'Cuenta', 'Valor'],
      ['Ingresos Operacionales', '', '', totalIng.toFixed(2)]
    ];
    ingresos.forEach(i => rows.push(['', i.codigo_cuenta, i.nombre, i.saldo.toFixed(2)]));
    rows.push(['Gastos Operacionales', '', '', totalGas.toFixed(2)]);
    gastos.forEach(i => rows.push(['', i.codigo_cuenta, i.nombre, i.saldo.toFixed(2)]));
    rows.push(['Utilidad Operacional', '', '', utilidadOperativa.toFixed(2)]);
    rows.push(['(-) 15% Participación Trabajadores', '', '', partTrabajadores.toFixed(2)]);
    rows.push(['(-) 25% Impuesto a la Renta', '', '', impuestoRenta.toFixed(2)]);
    rows.push(['UTILIDAD NETA DEL EJERCICIO', '', '', utilidadNeta.toFixed(2)]);
    
    const csv = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a'); a.href = encodeURI(csv);
    a.download = `Estado_Resultados_${desde || 'inicio'}_${hasta || 'fin'}.csv`;
    a.click();
  };

  const renderTree = (items: typeof ingresos, color: string) => {
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

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="glass-card" style={{ padding: '14px 20px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <h3 style={{ margin: 0, flex: 1 }}>Estado de Resultados Integral</h3>
        <button onClick={exportER} className="btn" style={{ padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 700 }}>
          <Download size={14} /> CSV
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: 20 }}>
        {/* INGRESOS */}
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', background: 'rgba(16,185,129,0.08)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 800, color: 'var(--success)' }}>INGRESOS OPERACIONALES</span>
            <span style={{ fontWeight: 900, color: 'var(--success)', fontSize: '1.1rem' }}>${totalIng.toFixed(2)}</span>
          </div>
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {renderTree(ingresos, 'var(--success)')}
          </div>
        </div>

        {/* GASTOS */}
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 800, color: 'var(--error)' }}>COSTOS Y GASTOS OPERACIONALES</span>
            <span style={{ fontWeight: 900, color: 'var(--error)', fontSize: '1.1rem' }}>${totalGas.toFixed(2)}</span>
          </div>
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {renderTree(gastos, 'var(--error)')}
          </div>
        </div>
      </div>

      {/* CASCADA DE RESULTADO NETO */}
      <div className="glass-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontWeight: 800, borderBottom: '1px solid var(--border-color)', paddingBottom: 8 }}>Cálculo del Resultado Neto Fiscal</div>
        
        <div className="flex-between" style={{ fontSize: '0.92rem' }}>
          <span>(+) Ingresos Operacionales</span>
          <strong>${totalIng.toFixed(2)}</strong>
        </div>
        <div className="flex-between" style={{ fontSize: '0.92rem', color: 'var(--error)' }}>
          <span>(-) Costos y Gastos Operacionales</span>
          <strong>-${totalGas.toFixed(2)}</strong>
        </div>
        
        <div className="flex-between" style={{ borderTop: '1px solid var(--border-color)', paddingTop: 8, fontWeight: 700 }}>
          <span>(=) UTILIDAD DE LA OPERACIÓN</span>
          <span style={{ color: utilidadOperativa >= 0 ? 'var(--success)' : 'var(--error)' }}>${utilidadOperativa.toFixed(2)}</span>
        </div>

        <div className="flex-between" style={{ fontSize: '0.9rem', color: 'var(--text-sec)' }}>
          <span>(-) 15% Participación de Trabajadores (Ecuador)</span>
          <strong>-${partTrabajadores.toFixed(2)}</strong>
        </div>
        <div className="flex-between" style={{ fontSize: '0.9rem', color: 'var(--text-sec)' }}>
          <span>(-) 25% Impuesto a la Renta</span>
          <strong>-${impuestoRenta.toFixed(2)}</strong>
        </div>

        <div className="flex-between" style={{ borderTop: '2px solid var(--primary)', paddingTop: 10, fontSize: '1.3rem', fontWeight: 900 }}>
          <span>RESULTADO NETO DEL EJERCICIO</span>
          <span style={{ color: utilidadNeta >= 0 ? 'var(--success)' : 'var(--error)' }}>
            ${utilidadNeta.toFixed(2)}
          </span>
        </div>
      </div>
    </section>
  );
};
