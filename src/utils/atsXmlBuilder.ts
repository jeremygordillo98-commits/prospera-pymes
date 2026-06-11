export interface DocSRI {
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

export const getSRIDocumentNumber = (d: DocSRI): string => {
  const concepto = d.transacciones?.concepto || '';
  const numComp = (d.transacciones?.numero_comprobante || '').trim();
  const sriRegex = /\d{3}-\d{3}-\d{9}/;
  
  if (sriRegex.test(numComp)) {
    return numComp;
  }
  const matchConcepto = concepto.match(sriRegex);
  if (matchConcepto) {
    return matchConcepto[0];
  }
  const clave = d.clave_acceso_xml || '';
  if (clave.length >= 39) {
    return `${clave.substring(24,27)}-${clave.substring(27,30)}-${clave.substring(30,39)}`;
  }
  return numComp;
};

const mapIdProv = (tipoId: string | undefined): string => {
  if (!tipoId) return '01';
  if (tipoId === '04') return '01';
  if (tipoId === '05') return '02';
  if (tipoId === '06' || tipoId === '08') return '03';
  return tipoId;
};

const formatDateForSRI = (dateString: string | undefined): string => {
  if (!dateString) return '';
  const parts = dateString.split('T')[0].split('-');
  if (parts.length === 3) {
    return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
  }
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

export const buildATSXml = (empresa: EmpresaInfo, anio: number, mes: number, docs: DocSRI[]): string => {
  const mesStr = String(mes).padStart(2, '0');
  
  const compras = docs.filter(d => d.transacciones?.tipo_comprobante === 'Factura' && d.es_compra);
  const ventas = docs.filter(d => d.transacciones?.tipo_comprobante === 'Factura' && !d.es_compra);
  const retencionesRecibidas = docs.filter(d => d.transacciones?.tipo_comprobante === 'Comprobante de Retención' && !d.es_compra);
  const anulados = docs.filter(d => 
    d.transacciones?.concepto?.toLowerCase().includes('anulado') || 
    d.transacciones?.tipo_comprobante === 'Anulado'
  );

  const totalBase12Ventas = ventas.reduce((s, d) => s + (d.base_12 || 0), 0);
  const totalBase0Ventas = ventas.reduce((s, d) => s + (d.base_0 || 0), 0);
  const totalBaseNoObjetoVentas = ventas.reduce((s, d) => s + (d.base_no_objeto || 0), 0);
  const totalVentasSRI = (totalBase12Ventas + totalBase0Ventas + totalBaseNoObjetoVentas).toFixed(2);

  const estabsUnicos = [...new Set(docs.map(d => {
    const num = getSRIDocumentNumber(d);
    const partes = num.split('-');
    return partes[0]?.padStart(3, '0') || '001';
  }))];
  const numEstabs = String(estabsUnicos.length).padStart(3, '0');

  // Agrupamiento de Ventas por Cliente
  const ventasAgrupadasPorCliente = Object.values(
    ventas.reduce((acc, v) => {
      const ent = v.transacciones?.entidades;
      const idCliente = ent?.ruc_cedula || '9999999999999';
      if (!acc[idCliente]) {
        acc[idCliente] = {
          ruc: idCliente,
          razonSocial: ent?.razon_social || ent?.nombre || 'Consumidor Final',
          tipoId: ent?.tipo_identificacion || '07',
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
      acc[idCliente].numeroComprobantes += 1;
      acc[idCliente].base0 += v.base_0 || 0;
      acc[idCliente].base12 += v.base_12 || 0;
      acc[idCliente].baseNoObjeto += v.base_no_objeto || 0;
      acc[idCliente].iva += v.monto_iva || 0;
      acc[idCliente].total += (v.base_12 || 0) + (v.base_0 || 0) + (v.base_no_objeto || 0) + (v.monto_iva || 0);
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
      retIva: totalRetIva,
      retRenta: totalRetRenta
    };
  });

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<iva>\n`;
  xml += `  <TipoIDInformante>R</TipoIDInformante>\n`;
  xml += `  <IdInformante>${empresa.ruc_empresa}</IdInformante>\n`;
  xml += `  <razonSocial>${empresa.nombre_empresa.replace(/&/g, '&amp;')}</razonSocial>\n`;
  xml += `  <Anio>${anio}</Anio>\n`;
  xml += `  <Mes>${mesStr}</Mes>\n`;
  xml += `  <numEstabRuc>${numEstabs}</numEstabRuc>\n`;
  xml += `  <totalVentas>${totalVentasSRI}</totalVentas>\n`;
  xml += `  <codigoOperativo>IVA</codigoOperativo>\n`;

  // 1. Módulo Compras
  xml += `  <compras>\n`;
  compras.forEach(d => {
    const ent = d.transacciones?.entidades;
    const num = getSRIDocumentNumber(d);
    const partes = num.split('-');
    const estab = partes[0]?.padStart(3, '0') || '001';
    const ptoEmi = partes[1]?.padStart(3, '0') || '001';
    const sec    = partes[2]?.padStart(9, '0') || '000000001';
    const fp     = d.forma_pago || '20';
    const fechaFormat = formatDateForSRI(d.transacciones?.fecha);

    const rets = d.retenciones_aplicadas || [];
    const retRenta = rets.filter((r: any) => r.tipo === 'RENTA' || !r.tipo);
    const retIVA = rets.filter((r: any) => r.tipo === 'IVA');

    const ret10 = retIVA.filter(r => r.porcentaje === 10).reduce((s, r) => s + r.valor, 0);
    const ret20 = retIVA.filter(r => r.porcentaje === 20).reduce((s, r) => s + r.valor, 0);
    const ret30 = retIVA.filter(r => r.porcentaje === 30).reduce((s, r) => s + r.valor, 0);
    const ret50 = retIVA.filter(r => r.porcentaje === 50).reduce((s, r) => s + r.valor, 0);
    const ret70 = retIVA.filter(r => r.porcentaje === 70).reduce((s, r) => s + r.valor, 0);
    const ret100 = retIVA.filter(r => r.porcentaje === 100).reduce((s, r) => s + r.valor, 0);

    xml += `    <detalleCompras>\n`;
    xml += `      <codSustento>01</codSustento>\n`;
    xml += `      <tpIdProv>${mapIdProv(ent?.tipo_identificacion)}</tpIdProv>\n`;
    xml += `      <idProv>${ent?.ruc_cedula || ''}</idProv>\n`;
    xml += `      <tipoComprobante>01</tipoComprobante>\n`;
    xml += `      <parteRel>NO</parteRel>\n`;
    xml += `      <fechaRegistro>${fechaFormat}</fechaRegistro>\n`;
    xml += `      <establecimiento>${estab}</establecimiento>\n`;
    xml += `      <emisionPuntoEmision>${ptoEmi}</emisionPuntoEmision>\n`;
    xml += `      <secuencial>${sec}</secuencial>\n`;
    xml += `      <fechaEmision>${fechaFormat}</fechaEmision>\n`;
    xml += `      <autorizacion>${d.clave_acceso_xml || ''}</autorizacion>\n`;
    xml += `      <baseNoGraIva>${(d.base_no_objeto || 0).toFixed(2)}</baseNoGraIva>\n`;
    xml += `      <baseImponible>${(d.base_0 || 0).toFixed(2)}</baseImponible>\n`;
    xml += `      <baseImpGrav>${(d.base_12 || 0).toFixed(2)}</baseImpGrav>\n`;
    xml += `      <montoIce>0.00</montoIce>\n`;
    xml += `      <montoIva>${(d.monto_iva || 0).toFixed(2)}</montoIva>\n`;
    xml += `      <valRetBien10>${ret10.toFixed(2)}</valRetBien10>\n`;
    xml += `      <valRetServ20>${ret20.toFixed(2)}</valRetServ20>\n`;
    xml += `      <valorRetBienes>${ret30.toFixed(2)}</valorRetBienes>\n`;
    xml += `      <valRetServ50>${ret50.toFixed(2)}</valRetServ50>\n`;
    xml += `      <valorRetServicios>${ret70.toFixed(2)}</valorRetServicios>\n`;
    xml += `      <valRetServ100>${ret100.toFixed(2)}</valRetServ100>\n`;
    xml += `      <totbasesImpReemb>0.00</totbasesImpReemb>\n`;
    xml += `      <pagoExterior>\n        <pagoLocExt>01</pagoLocExt>\n      </pagoExterior>\n`;
    xml += `      <formasDePago>\n        <formaPago>${fp}</formaPago>\n      </formasDePago>\n`;
    
    if (retRenta.length > 0) {
      xml += `      <air>\n`;
      retRenta.forEach((r: any) => {
        xml += `        <detalleAir>\n`;
        xml += `          <codRetAir>${r.codigo || '332'}</codRetAir>\n`;
        xml += `          <baseImpAir>${(r.base || d.base_12 || 0).toFixed(2)}</baseImpAir>\n`;
        xml += `          <porcentajeAir>${r.porcentaje || 0}</porcentajeAir>\n`;
        xml += `          <valRetAir>${(r.valor || 0).toFixed(2)}</valRetAir>\n`;
        xml += `        </detalleAir>\n`;
      });
      xml += `      </air>\n`;
    }
    xml += `    </detalleCompras>\n`;
  });
  xml += `  </compras>\n`;

  // 2. Módulo Ventas
  xml += `  <ventas>\n`;
  ventasAgrupadasPorCliente.forEach((v: any) => {
    xml += `    <detalleVentas>\n`;
    xml += `      <tpIdCliente>${v.tipoId}</tpIdCliente>\n`;
    xml += `      <idCliente>${v.ruc}</idCliente>\n`;
    xml += `      <parteRelVentas>NO</parteRelVentas>\n`;
    xml += `      <tipoComprobante>01</tipoComprobante>\n`;
    xml += `      <numeroComprobantes>${v.numeroComprobantes}</numeroComprobantes>\n`;
    xml += `      <baseNoGraIva>${v.baseNoObjeto.toFixed(2)}</baseNoGraIva>\n`;
    xml += `      <baseImponible>${v.base0.toFixed(2)}</baseImponible>\n`;
    xml += `      <baseImpGrav>${v.base12.toFixed(2)}</baseImpGrav>\n`;
    xml += `      <montoIva>${v.iva.toFixed(2)}</montoIva>\n`;
    xml += `      <montoIce>0.00</montoIce>\n`;
    xml += `      <valorRetIva>${v.retIva.toFixed(2)}</valorRetIva>\n`;
    xml += `      <valorRetRenta>${v.retRenta.toFixed(2)}</valorRetRenta>\n`;
    xml += `      <formasDePago>\n        <formaPago>20</formaPago>\n      </formasDePago>\n`;
    xml += `    </detalleVentas>\n`;
  });
  xml += `  </ventas>\n`;

  // 3. Módulo Ventas por Establecimiento
  xml += `  <ventasEstablecimiento>\n`;
  estabsUnicos.forEach(est => {
    const totalEstab = ventas.filter(d => {
      const num = getSRIDocumentNumber(d);
      const partes = num.split('-');
      return (partes[0]?.padStart(3, '0') || '001') === est;
    }).reduce((sum, d) => sum + (d.base_12 || 0) + (d.base_0 || 0) + (d.monto_iva || 0), 0);

    xml += `    <ventaEstablecimiento>\n`;
    xml += `      <codEstab>${est}</codEstab>\n`;
    xml += `      <ventasEstab>${totalEstab.toFixed(2)}</ventasEstab>\n`;
    xml += `      <ivaComp>0.00</ivaComp>\n`;
    xml += `    </ventaEstablecimiento>\n`;
  });
  xml += `  </ventasEstablecimiento>\n`;

  // 4. Módulo Anulados
  xml += `  <anulados>\n`;
  anulados.forEach(d => {
    const num = getSRIDocumentNumber(d);
    const partes = num.split('-');
    const estab = partes[0]?.padStart(3, '0') || '001';
    const ptoEmi = partes[1]?.padStart(3, '0') || '001';
    const sec    = partes[2]?.padStart(9, '0') || '000000001';

    xml += `    <detalleAnulados>\n`;
    xml += `      <tipoComprobante>01</tipoComprobante>\n`;
    xml += `      <establecimiento>${estab}</establecimiento>\n`;
    xml += `      <puntoEmision>${ptoEmi}</puntoEmision>\n`;
    xml += `      <secuencialInicio>${sec}</secuencialInicio>\n`;
    xml += `      <secuencialFin>${sec}</secuencialFin>\n`;
    xml += `      <autorizacion>${d.clave_acceso_xml || ''}</autorizacion>\n`;
    xml += `    </detalleAnulados>\n`;
  });
  xml += `  </anulados>\n`;
  xml += `</iva>`;

  return xml;
};
