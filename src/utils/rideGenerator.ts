import { XMLParser } from 'fast-xml-parser';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Helper to translate buyer identification types
const getTipoIdentificacion = (code: string) => {
  switch (code) {
    case '04': return 'RUC';
    case '05': return 'CÉDULA';
    case '06': return 'PASAPORTE';
    case '07': return 'CONSUMIDOR FINAL';
    case '08': return 'EXTERIOR';
    default: return 'RUC/CÉDULA';
  }
};

// Helper to translate payment methods
const getFormaPagoLabel = (code: string) => {
  const catalog: any = {
    '01': 'SIN UTILIZACION DEL SISTEMA FINANCIERO',
    '15': 'COMPENSACION DE DEUDAS',
    '16': 'TARJETA DE DEBITO',
    '17': 'DINERO ELECTRONICO',
    '18': 'TARJETA DE PREPAGO',
    '19': 'TARJETA DE CREDITO',
    '20': 'OTROS CON UTILIZACION DEL SISTEMA FINANCIERO',
    '21': 'ENDOSO DE TITULOS',
  };
  return catalog[code] || 'OTROS CON UTILIZACION DEL SISTEMA FINANCIERO';
};

export const generateRIDEFromXML = (xmlContent: string) => {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      parseTagValue: false,
      trimValues: true,
    });

    const jsonObj = parser.parse(xmlContent);
    let comprobante: any;

    if (jsonObj.autorizacion && jsonObj.autorizacion.comprobante) {
      const comprobanteXML = jsonObj.autorizacion.comprobante;
      comprobante = typeof comprobanteXML === 'string' ? parser.parse(comprobanteXML) : comprobanteXML;
    } else {
      comprobante = jsonObj;
    }

    if (comprobante.factura) {
      comprobante = comprobante.factura;
    } else {
      throw new Error("El XML no corresponde a una Factura válida.");
    }

    const infoT = comprobante.infoTributaria;
    const infoF = comprobante.infoFactura;

    if (!infoT || !infoF) {
      throw new Error("Estructura de Factura SRI inválida.");
    }

    // Initialize PDF (A4 size, vertical, mm units)
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    // Config global styles
    pdf.setFont('helvetica', 'normal');

    // ─── 1. CAJA IZQUIERDA: DATOS DEL EMISOR ───
    pdf.rect(10, 10, 90, 75);
    
    // Logo placeholder text or brand if needed (SRI typical layout has a "NO TIENE LOGO" or Logo image)
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text("NO TIENE LOGO", 55, 20, { align: 'center' });
    
    pdf.setFontSize(8.5);
    pdf.text(infoT.razonSocial || '—', 12, 32, { maxWidth: 86 });

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.text(`Dirección Matriz:\n${infoT.dirMatriz || '—'}`, 12, 42, { maxWidth: 86 });
    pdf.text(`Dirección Sucursal:\n${infoF.dirEstablecimiento || infoT.dirMatriz || '—'}`, 12, 54, { maxWidth: 86 });
    
    const obligado = infoF.obligadoContabilidad || 'NO';
    pdf.text(`OBLIGADO A LLEVAR CONTABILIDAD: ${obligado}`, 12, 68);

    // Check for special regime tags
    let regimeText = '';
    if (infoT.contribuyenteRimpe || xmlContent.includes('RIMPE')) {
      regimeText = 'CONTRIBUYENTE RÉGIMEN RIMPE';
    }
    if (regimeText) {
      pdf.setFont('helvetica', 'bold');
      pdf.text(regimeText, 12, 74, { maxWidth: 86 });
      pdf.setFont('helvetica', 'normal');
    }

    // ─── 2. CAJA DERECHA: METADATOS SRI ───
    pdf.rect(105, 10, 95, 75);
    
    pdf.setFontSize(10.5);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`RUC:   ${infoT.ruc || '—'}`, 108, 16);
    
    pdf.setFontSize(14);
    pdf.text("F A C T U R A", 108, 25);
    
    pdf.setFontSize(9);
    const secuencial = `${infoT.estab || '001'}-${infoT.ptoEmi || '001'}-${infoT.secuencial || '000000001'}`;
    pdf.text(`No. ${secuencial}`, 108, 32);

    pdf.setFontSize(7);
    pdf.text("NÚMERO DE AUTORIZACIÓN", 108, 38);
    pdf.setFont('helvetica', 'bold');
    const authKey = infoT.claveAcceso || '—';
    pdf.text(authKey, 108, 42, { maxWidth: 90 });
    
    pdf.setFont('helvetica', 'normal');
    const authDate = jsonObj.autorizacion?.fechaAutorizacion || `${infoF.fechaEmision || ''} 15:58:23`;
    pdf.text(`FECHA Y HORA DE AUTORIZACIÓN:  ${authDate}`, 108, 48, { maxWidth: 90 });
    
    const ambienteLabel = infoT.ambiente === '2' ? 'PRODUCCIÓN' : 'PRUEBAS';
    pdf.text(`AMBIENTE:  ${ambienteLabel}`, 108, 54);
    pdf.text(`EMISIÓN:  NORMAL`, 108, 59);
    pdf.text(`CLAVE DE ACCESO:`, 108, 64);
    
    // Simulate Vectorial Barcode (code 128)
    const barStartX = 108;
    const barStartY = 66;
    const barHeight = 5;
    pdf.setFillColor(0, 0, 0);
    const widths = [1, 2, 1, 3, 1, 1, 2, 2, 1, 3, 2, 1, 1, 2, 1, 3, 1, 2, 2, 1, 3, 1, 1, 2, 1, 2, 3, 1, 1, 2, 2, 1, 1, 3, 1];
    let currentX = barStartX;
    for (let i = 0; i < widths.length; i++) {
      const w = widths[i] * 0.45;
      if (i % 2 === 0) {
        pdf.rect(currentX, barStartY, w, barHeight, 'F');
      }
      currentX += w;
    }
    
    // Clave de acceso numbers below barcode
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(6.8);
    pdf.text(authKey, 108, 74, { maxWidth: 90 });

    // ─── 3. CAJA CLIENTE ───
    pdf.rect(10, 90, 190, 22);
    
    pdf.setFontSize(8.5);
    pdf.setFont('helvetica', 'bold');
    pdf.text("Razón Social / Nombres y Apellidos:", 12, 95);
    pdf.setFont('helvetica', 'normal');
    pdf.text(infoF.razonSocialComprador || '—', 62, 95, { maxWidth: 135 });

    pdf.setFont('helvetica', 'bold');
    pdf.text("Identificación Comprador:", 12, 101);
    pdf.setFont('helvetica', 'normal');
    const idComprador = infoF.identificacionComprador || '—';
    const tipoId = getTipoIdentificacion(infoF.tipoIdentificacionComprador);
    pdf.text(`${idComprador} (${tipoId})`, 48, 101);

    pdf.setFont('helvetica', 'bold');
    pdf.text("Fecha de Emisión:", 12, 107);
    pdf.setFont('helvetica', 'normal');
    pdf.text(infoF.fechaEmision || '—', 38, 107);

    // Get client address (often stored in infoAdicional)
    let clientAddress = '—';
    if (comprobante.infoAdicional?.campoAdicional) {
      const camps = Array.isArray(comprobante.infoAdicional.campoAdicional)
        ? comprobante.infoAdicional.campoAdicional
        : [comprobante.infoAdicional.campoAdicional];
      const dirCamp = camps.find((c: any) => c['@_nombre']?.toLowerCase().includes('dir') || c['#text']?.toLowerCase().includes('dir'));
      if (dirCamp) {
        clientAddress = dirCamp['#text'] || '';
      }
    }
    pdf.setFont('helvetica', 'bold');
    pdf.text("Dirección:", 100, 107);
    pdf.setFont('helvetica', 'normal');
    pdf.text(clientAddress, 116, 107, { maxWidth: 82 });

    // ─── 4. TABLA DE DETALLES (PRODUCTOS) ───
    const rawDetails = comprobante.detalles?.detalle;
    const detailsArr = Array.isArray(rawDetails) ? rawDetails : rawDetails ? [rawDetails] : [];

    const tableRows = detailsArr.map((d: any) => [
      d.codigoPrincipal || '—',
      d.codigoAuxiliar || '—',
      parseFloat(d.cantidad || 0).toFixed(2),
      d.descripcion || '—',
      parseFloat(d.precioUnitario || 0).toFixed(6),
      parseFloat(d.descuento || 0).toFixed(2),
      parseFloat(d.precioTotalSinImpuesto || 0).toFixed(2)
    ]);

    autoTable(pdf, {
      startY: 116,
      margin: { left: 10, right: 10 },
      theme: 'grid',
      head: [['Cód. Principal', 'Cód. Auxiliar', 'Cant', 'Descripción', 'Precio Unitario', 'Descuento', 'Precio Total']],
      body: tableRows,
      styles: { fontSize: 7.5, cellPadding: 1.8, textColor: '#333333' },
      headStyles: { fillColor: '#f9fafb', textColor: '#111827', fontStyle: 'bold', lineWidth: 0.1, lineColor: '#e5e7eb' },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 20 },
        2: { cellWidth: 12, halign: 'right' },
        3: { cellWidth: 'auto' },
        4: { cellWidth: 22, halign: 'right' },
        5: { cellWidth: 18, halign: 'right' },
        6: { cellWidth: 20, halign: 'right' },
      }
    });

    let finalY = (pdf as any).lastAutoTable.finalY + 8;

    // Check page overflow for totals block
    if (finalY + 60 > 297) {
      pdf.addPage();
      finalY = 15;
    }

    // ─── 5. LADO IZQUIERDO: INFORMACIÓN ADICIONAL Y FORMA DE PAGO ───
    
    // 5.1 Info Adicional Box
    const infoAdic = comprobante.infoAdicional?.campoAdicional;
    const infoAdicArr = Array.isArray(infoAdic) ? infoAdic : infoAdic ? [infoAdic] : [];
    
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.text("Información Adicional", 12, finalY - 2);
    
    let infoBoxHeight = Math.max(15, infoAdicArr.length * 4.5 + 4);
    pdf.rect(10, finalY, 100, infoBoxHeight);
    
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    infoAdicArr.forEach((camp: any, index: number) => {
      const label = camp['@_nombre'] || 'Dato';
      const val = camp['#text'] || '';
      pdf.text(`${label}: ${val}`, 12, finalY + 4 + (index * 4.5), { maxWidth: 96 });
    });

    // 5.2 Forma de Pago Box
    const formaPagoY = finalY + infoBoxHeight + 6;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.text("Forma de Pago", 12, formaPagoY - 2);
    
    pdf.rect(10, formaPagoY, 100, 15);
    pdf.setFontSize(7.5);
    pdf.text("Detalle", 12, formaPagoY + 4);
    pdf.text("Valor", 95, formaPagoY + 4, { align: 'right' });
    
    pdf.line(10, formaPagoY + 6, 110, formaPagoY + 6);
    
    pdf.setFont('helvetica', 'normal');
    const fPagoCode = infoF.pagos?.pago?.formaPago || infoF.pagos?.pago?.[0]?.formaPago || '01';
    const fPagoTotal = infoF.pagos?.pago?.total || infoF.pagos?.pago?.[0]?.total || infoF.importeTotal || 0;
    pdf.text(getFormaPagoLabel(fPagoCode), 12, formaPagoY + 11, { maxWidth: 70 });
    pdf.text(`$${parseFloat(fPagoTotal).toFixed(2)}`, 95, formaPagoY + 11, { align: 'right' });


    // ─── 6. LADO DERECHO: CUADRO DE TOTALES ───
    const totalsX = 120;
    const totalsWidth = 80;
    const totalsValX = 195;
    
    // Extract totals for summary box
    let base15 = 0, base12 = 0, base5 = 0, base0 = 0, baseNoObjeto = 0, baseExenta = 0, ivaVal = 0;
    if (infoF.totalConImpuestos?.totalImpuesto) {
      const imps = Array.isArray(infoF.totalConImpuestos.totalImpuesto)
        ? infoF.totalConImpuestos.totalImpuesto
        : [infoF.totalConImpuestos.totalImpuesto];
      imps.forEach((imp: any) => {
        const cod = String(imp.codigo || '');
        const tarifa = Number(imp.tarifa ?? imp.codigoPorcentaje ?? 0);
        const base = parseFloat(imp.baseImponible || 0);
        const val = parseFloat(imp.valor || 0);
        
        if (cod === '2') {
          if (tarifa === 0) base0 += base;
          else if (tarifa === 5) { base5 += base; ivaVal += val; }
          else if (tarifa === 12) { base12 += base; ivaVal += val; }
          else if (tarifa === 15 || tarifa === 4) { base15 += base; ivaVal += val; }
          else { base12 += base; ivaVal += val; }
        } else if (cod === '6') {
          baseNoObjeto += base;
        } else if (cod === '7') {
          baseExenta += base;
        }
      });
    }

    const totalSinImp = parseFloat(infoF.totalSinImpuestos || 0);
    const totalDesc = parseFloat(infoF.totalDescuento || 0);
    const totalFactura = parseFloat(infoF.importeTotal || 0);

    // List of rows to draw in totals box
    const totalsRows = [
      { label: 'SUBTOTAL 15%', value: base15 },
      { label: 'SUBTOTAL 12%', value: base12 },
      { label: 'SUBTOTAL 5%', value: base5 },
      { label: 'SUBTOTAL 0%', value: base0 },
      { label: 'SUBTOTAL NO OBJETO DE IVA', value: baseNoObjeto },
      { label: 'SUBTOTAL EXENTO DE IVA', value: baseExenta },
      { label: 'SUBTOTAL SIN IMPUESTOS', value: totalSinImp },
      { label: 'TOTAL DESCUENTO', value: totalDesc },
      { label: 'ICE', value: 0 },
      { label: 'IVA 15%', value: base15 > 0 ? ivaVal : 0 },
      { label: 'IVA 12%', value: base12 > 0 ? ivaVal : 0 },
      { label: 'IVA 5%', value: base5 > 0 ? ivaVal : 0 },
      { label: 'PROPINA', value: 0 },
      { label: 'VALOR TOTAL', value: totalFactura }
    ].filter(r => r.value > 0 || r.label === 'SUBTOTAL 0%' || r.label === 'SUBTOTAL SIN IMPUESTOS' || r.label === 'TOTAL DESCUENTO' || r.label === 'VALOR TOTAL');

    const boxHeight = totalsRows.length * 4.5;
    pdf.rect(totalsX, finalY, totalsWidth, boxHeight);
    
    pdf.setFontSize(7.2);
    totalsRows.forEach((r, idx) => {
      const y = finalY + 3.5 + (idx * 4.5);
      
      pdf.setFont('helvetica', r.label === 'VALOR TOTAL' ? 'bold' : 'normal');
      pdf.text(r.label, totalsX + 2, y);
      pdf.text(`$${r.value.toFixed(2)}`, totalsValX, y, { align: 'right' });
      
      // Draw grid line except last
      if (idx < totalsRows.length - 1) {
        pdf.line(totalsX, y + 1, totalsX + totalsWidth, y + 1);
      }
    });

    // Save and download PDF
    const fileName = `RIDE_${infoT.estab}-${infoT.ptoEmi}-${infoT.secuencial}.pdf`;
    pdf.save(fileName);
    return true;
  } catch (err: any) {
    console.error("Error generating RIDE PDF:", err);
    throw new Error(err.message || "Error al parsear el XML.");
  }
};
