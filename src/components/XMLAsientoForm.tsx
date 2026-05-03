import React from 'react';
import { FileText, Receipt, FileMinus, AlertCircle } from 'lucide-react';
import { type SRIParsedData } from '../utils/sriParser';
import { type ISRIRetencion, CATALOGO_RETENCIONES_RENTA } from '../utils/sriCatalog';
import { AccountCombobox } from './AccountCombobox';

interface Account { id: string; codigo_cuenta: string; nombre: string; tipo: string; }

interface Props {
  parsedData: SRIParsedData;
  isFactura: boolean;
  isRetencion: boolean;
  isNotaCredito: boolean;
  accounts: Account[];
  idCuentaDebe: string; setIdCuentaDebe: (v: string) => void;
  idCuentaHaber: string; setIdCuentaHaber: (v: string) => void;
  idCuentaRetencion: string; setIdCuentaRetencion: (v: string) => void;
  retencionCodigo: string; setRetencionCodigo: (v: string) => void;
  retencionSeleccionada: ISRIRetencion;
  valorRetenidoCalculado: number;
}

// Mapea catálogo de retenciones al formato que acepta AccountCombobox
const retencionesComoAccounts: Account[] = CATALOGO_RETENCIONES_RENTA.map(r => ({
  id: r.codigo,
  codigo_cuenta: r.codigo,
  nombre: `${r.descripcion} (${r.porcentaje}%)`,
  tipo: '',
}));

export const XMLAsientoForm: React.FC<Props> = ({
  parsedData, isFactura, isRetencion, isNotaCredito,
  accounts, idCuentaDebe, setIdCuentaDebe, idCuentaHaber, setIdCuentaHaber,
  idCuentaRetencion, setIdCuentaRetencion, retencionCodigo, setRetencionCodigo,
  retencionSeleccionada, valorRetenidoCalculado,
}) => {
  const typeIcon = isFactura ? <FileText size={18} /> : isRetencion ? <Receipt size={18} /> : <FileMinus size={18} />;
  const debeLabel = isFactura ? 'Debe (Gasto/Inv)' : isRetencion ? 'Debe (Anticipo Impuesto)' : 'Debe (Ventas a Reversar)';
  const haberLabel = isFactura ? 'Haber (Pasivo/CXP)' : isRetencion ? 'Haber (CXC Cliente)' : 'Haber (CXC Cliente a Reducir)';

  return (
    <div className="p-6 bg-primary/5 rounded-2xl border border-primary/20 space-y-4">
      <div className="flex items-center gap-2 font-bold text-primary mb-2 text-sm uppercase tracking-wide">
        {typeIcon} Asiento Contable (Libro Diario)
      </div>

      {/* Debe / Haber */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] text-sec uppercase font-bold px-1">{debeLabel}</label>
          <AccountCombobox accounts={accounts} value={idCuentaDebe} onChange={setIdCuentaDebe} placeholder="Buscar cuenta..." />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-sec uppercase font-bold px-1">{haberLabel}</label>
          <AccountCombobox accounts={accounts} value={idCuentaHaber} onChange={setIdCuentaHaber} placeholder="Buscar cuenta..." />
        </div>
      </div>

      {/* Retención IR — solo facturas */}
      {isFactura && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-white/5 pt-3">
          <div className="space-y-1">
            <label className="text-[10px] text-sec uppercase font-bold px-1">
              Retención IR en la Fuente
              {retencionCodigo === '000' && (
                <span style={{ marginLeft: 6, background: 'rgba(0,214,143,0.15)', color: 'var(--primary)', borderRadius: 6, padding: '1px 7px', fontSize: '0.68rem', fontWeight: 800 }}>No aplica</span>
              )}
            </label>
            <AccountCombobox
              accounts={retencionesComoAccounts}
              value={retencionCodigo}
              onChange={setRetencionCodigo}
              placeholder="Buscar retención..."
            />
          </div>
          {valorRetenidoCalculado > 0 && (
            <div className="space-y-1">
              <label className="text-[10px] text-warning uppercase font-bold px-1">Cuenta Pasivo Retención</label>
              <AccountCombobox accounts={accounts} value={idCuentaRetencion} onChange={setIdCuentaRetencion} placeholder="Buscar cuenta pasivo..." filterByTipo="Pasivo" />
            </div>
          )}
        </div>
      )}

      {/* Sustento de retención */}
      {isRetencion && (
        <div className="pt-3 border-t border-white/5">
          <p className="text-xs text-sec">Documentos sustento detectados:</p>
          <ul className="text-xs font-bold mt-1 list-disc pl-4" style={{ color: 'var(--text-main)' }}>
            {(parsedData as any).documentosSustento?.map((doc: any) => (
              <li key={doc.numDocSustento}>Factura: {doc.numDocSustento}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Origen nota de crédito */}
      {isNotaCredito && (
        <div className="pt-3 border-t border-white/5 flex gap-2 items-center">
          <AlertCircle size={14} className="text-error" />
          <span className="text-xs" style={{ color: 'var(--text-main)' }}>
            Aplicando descuento a Factura origen: <strong className="text-error text-sm">{(parsedData as any).numDocModificado}</strong>
          </span>
        </div>
      )}

      {/* Totales */}
      <div className="pt-4 border-t border-primary/10 space-y-2">
        {isFactura && (
          <>
            <Row label="Subtotal Grava IVA" value={`$${(parsedData as any).baseImponible?.toFixed(2)}`} />
            <Row label="IVA Detallado" value={`$${(parsedData as any).iva?.toFixed(2)}`} />
            <Row label={`Retención IR (${retencionSeleccionada.porcentaje}%)`} value={`- $${valorRetenidoCalculado.toFixed(2)}`} warning />
            <div className="flex justify-between text-base border-t border-white/10 pt-3 mt-2">
              <span className="font-extrabold">Neto al Proveedor:</span>
              <span className="font-black" style={{ color: 'var(--primary)' }}>${((parsedData as any).total - valorRetenidoCalculado).toFixed(2)}</span>
            </div>
          </>
        )}
        {isRetencion && (
          <div className="flex justify-between text-base pt-1">
            <span className="font-extrabold">Total Retenido (Saldo a Favor):</span>
            <span className="font-black text-warning">${(parsedData as any).totalRetenido?.toFixed(2)}</span>
          </div>
        )}
        {isNotaCredito && (
          <div className="flex justify-between text-base pt-1">
            <span className="font-extrabold">Valor de Modificación:</span>
            <span className="font-black text-error">${(parsedData as any).valorModificacion?.toFixed(2)}</span>
          </div>
        )}
      </div>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string; warning?: boolean }> = ({ label, value, warning }) => (
  <div className={`flex justify-between text-xs${warning ? ' font-bold text-warning' : ''}`}>
    <span className={warning ? '' : 'text-sec'}>{label}:</span>
    <span className="font-bold">{value}</span>
  </div>
);
