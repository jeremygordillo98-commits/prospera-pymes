import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { type SRIParsedData } from '../utils/sriParser';

interface Props {
  parsedData: SRIParsedData;
  isFactura: boolean;
  isRetencion: boolean;
}

export const XMLDocInfo: React.FC<Props> = ({ parsedData, isFactura, isRetencion }) => {
  const typeColor = isRetencion ? 'var(--warning)' : !isFactura ? '#ef4444' : 'var(--primary)';
  const typeLabel = isFactura ? 'Factura Autorizada' : isRetencion ? 'Retención Recibida' : 'Nota de Crédito';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
        <span className="text-xs text-sec uppercase tracking-wider font-bold block mb-2">Entidad Vinculada</span>
        <div className="flex items-start gap-2">
          <CheckCircle2 size={16} className="text-success mt-1 shrink-0" />
          <div>
            <p className="font-bold text-sm leading-tight">{parsedData.razonSocialEmisor}</p>
            <p className="text-xs text-sec mt-1">RUC: {parsedData.rucEmisor}</p>
          </div>
        </div>
      </div>
      <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
        <span className="text-xs uppercase tracking-wider font-bold block mb-2" style={{ color: typeColor }}>{typeLabel}</span>
        <p className="font-bold text-sm">Secuencial: <span style={{ color: 'var(--text-main)' }}>{parsedData.numeroComprobante}</span></p>
        <p className="text-xs text-sec mt-1">Emisión: {parsedData.fechaEmision}</p>
      </div>
    </div>
  );
};
