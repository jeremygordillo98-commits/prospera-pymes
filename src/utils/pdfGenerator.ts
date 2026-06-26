import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../services/supabase';

// Helper function to convert Image URL to Base64
const getBase64ImageFromUrl = async (imageUrl: string): Promise<string | null> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return resolve(null);
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => {
            console.warn('Could not load image', imageUrl);
            resolve(null);
        };
        // Add timestamp to bypass cache if needed
        img.src = imageUrl + (imageUrl.includes('?') ? '&' : '?') + 'cb=' + new Date().getTime();
    });
};

export const generatePDFReport = async (
    empresaId: string,
    title: string,
    subtitle: string,
    columns: string[],
    rows: any[][],
    foot?: any[][]
) => {
    // 1. Fetch metadata
    const { data: { user } } = await supabase.auth.getUser();
    let contadorLogo = null;
    if (user) {
        const { data: perfil } = await supabase.from('perfiles').select('logo_url').eq('id_usuario', user.id).single();
        if (perfil?.logo_url) contadorLogo = await getBase64ImageFromUrl(perfil.logo_url);
    }

    const { data: empresa } = await supabase.from('empresas_gestionadas').select('nombre_empresa, ruc_empresa, logo_url').eq('id', empresaId).single();
    let empresaLogo = null;
    let empresaNombre = 'Empresa';
    let empresaRuc = '';
    if (empresa) {
        empresaNombre = empresa.nombre_empresa;
        empresaRuc = empresa.ruc_empresa || '';
        if (empresa.logo_url) empresaLogo = await getBase64ImageFromUrl(empresa.logo_url);
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    const drawHeader = () => {
        // Logo Empresa (Izquierda)
        if (empresaLogo) {
            // Adjust proportions roughly
            doc.addImage(empresaLogo, 'PNG', 14, 10, 20, 20, undefined, 'FAST');
        }

        // Logo Contador (Derecha)
        if (contadorLogo) {
            doc.addImage(contadorLogo, 'PNG', pageWidth - 14 - 20, 10, 20, 20, undefined, 'FAST');
        }

        // Títulos centrales
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 30, 30);
        doc.text(empresaNombre, pageWidth / 2, 16, { align: 'center' });

        if (empresaRuc) {
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 100, 100);
            doc.text(`RUC: ${empresaRuc}`, pageWidth / 2, 21, { align: 'center' });
        }

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(60, 60, 60);
        doc.text(title, pageWidth / 2, 27, { align: 'center' });

        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(120, 120, 120);
        doc.text(subtitle, pageWidth / 2, 32, { align: 'center' });

        const downloadDateStr = `Descargado el: ${new Date().toLocaleDateString('es-EC')} ${new Date().toLocaleTimeString('es-EC')}`;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(130, 130, 130);
        doc.text(downloadDateStr, pageWidth / 2, 37, { align: 'center' });
    };

    const drawFooter = (data: any) => {
        const str = `Página ${data.pageNumber}`;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(150, 150, 150);

        // Footer left
        doc.text('Generado con la tecnología de Prospera Pymes', 14, doc.internal.pageSize.height - 10);
        // Footer right
        doc.text(str, pageWidth - 14, doc.internal.pageSize.height - 10, { align: 'right' });
    };

    autoTable(doc, {
        head: [columns],
        body: rows,
        foot: foot,
        startY: 42,
        margin: { top: 42, bottom: 20 },
        styles: { fontSize: 8, cellPadding: 3, textColor: [50, 50, 50] },
        headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold', halign: 'center' },
        footStyles: { fillColor: [240, 245, 250], textColor: [0, 0, 0], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        didDrawPage: (data) => {
            drawHeader();
            drawFooter(data);
        }
    });

    const fileName = `${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
};

export const generateSingleSRIDocumentPDF = async (
    empresaId: string,
    docData: any,
    movements: any[],
    getAccountLabel: (id: string) => string
) => {
    // 1. Fetch metadata
    const { data: { user } } = await supabase.auth.getUser();
    let contadorLogo = null;
    if (user) {
        const { data: perfil } = await supabase.from('perfiles').select('logo_url').eq('id_usuario', user.id).single();
        if (perfil?.logo_url) contadorLogo = await getBase64ImageFromUrl(perfil.logo_url);
    }

    const { data: empresa } = await supabase.from('empresas_gestionadas').select('nombre_empresa, ruc_empresa, logo_url').eq('id', empresaId).single();
    let empresaLogo = null;
    let empresaNombre = 'Empresa';
    let empresaRuc = '';
    if (empresa) {
        empresaNombre = empresa.nombre_empresa;
        empresaRuc = empresa.ruc_empresa || '';
        if (empresa.logo_url) empresaLogo = await getBase64ImageFromUrl(empresa.logo_url);
    }

    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.width;

    const drawHeader = () => {
        // Logo Empresa (Izquierda)
        if (empresaLogo) {
            pdf.addImage(empresaLogo, 'PNG', 14, 10, 20, 20, undefined, 'FAST');
        }

        // Logo Contador (Derecha)
        if (contadorLogo) {
            pdf.addImage(contadorLogo, 'PNG', pageWidth - 14 - 20, 10, 20, 20, undefined, 'FAST');
        }

        // Títulos centrales
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(30, 30, 30);
        pdf.text(empresaNombre, pageWidth / 2, 16, { align: 'center' });

        if (empresaRuc) {
            pdf.setFontSize(9);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(100, 100, 100);
            pdf.text(`RUC: ${empresaRuc}`, pageWidth / 2, 21, { align: 'center' });
        }

        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(60, 60, 60);
        pdf.text('DETALLE DE COMPROBANTE Y ASIENTO CONTABLE', pageWidth / 2, 27, { align: 'center' });

        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'italic');
        pdf.setTextColor(120, 120, 120);
        pdf.text(`Generado el: ${new Date().toLocaleDateString('es-EC')} ${new Date().toLocaleTimeString('es-EC')}`, pageWidth / 2, 32, { align: 'center' });
    };

    drawHeader();

    // Section 1: Identificación del Documento
    let currentY = 40;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(99, 102, 241); // Primary color
    pdf.text('1. IDENTIFICACIÓN DEL DOCUMENTO', 14, currentY);
    pdf.line(14, currentY + 2, pageWidth - 14, currentY + 2);

    currentY += 8;

    pdf.setFontSize(9);
    pdf.setTextColor(50, 50, 50);

    const xmlNumero = docData.clave_acceso_xml && docData.clave_acceso_xml.length >= 39
        ? `${docData.clave_acceso_xml.substring(24, 27)}-${docData.clave_acceso_xml.substring(27, 30)}-${docData.clave_acceso_xml.substring(30, 39)}`
        : (docData.transacciones?.concepto?.match(/\d{3}-\d{3}-\d{9}/)?.[0] || '—');

    const formattedDate = docData.transacciones?.fecha
        ? new Date(docData.transacciones.fecha + 'T12:00:00').toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' })
        : '—';

    const col1X = 14;
    const col2X = pageWidth / 2 + 5;

    const printRow = (label1: string, val1: string, label2: string, val2: string) => {
        pdf.setFont('helvetica', 'bold');
        pdf.text(label1, col1X, currentY);
        pdf.setFont('helvetica', 'normal');
        pdf.text(val1, col1X + 45, currentY);

        pdf.setFont('helvetica', 'bold');
        pdf.text(label2, col2X, currentY);
        pdf.setFont('helvetica', 'normal');
        pdf.text(val2, col2X + 45, currentY);

        currentY += 6;
    };

    printRow('Tipo de Comprobante:', docData.transacciones?.tipo_comprobante || '—', 'Fecha de Emisión:', formattedDate);
    printRow('Número de Asiento:', docData.transacciones?.numero_comprobante || '—', 'RUC/ID Entidad:', docData.transacciones?.entidades?.ruc_cedula || '—');
    printRow('Número de Factura:', xmlNumero, 'Entidad Vinculada:', docData.transacciones?.entidades?.nombre || '—');

    // Clave de Acceso (span full width)
    pdf.setFont('helvetica', 'bold');
    pdf.text('Clave de Acceso (SRI):', col1X, currentY);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.text(docData.clave_acceso_xml || '—', col1X + 45, currentY, { maxWidth: pageWidth - 14 - (col1X + 45) });
    pdf.setFontSize(9);

    currentY += 10;

    // Section 2: Resumen de Valores
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(99, 102, 241);
    pdf.text('2. RESUMEN DE VALORES', 14, currentY);
    pdf.line(14, currentY + 2, pageWidth - 14, currentY + 2);

    currentY += 8;

    pdf.setFontSize(9);
    pdf.setTextColor(50, 50, 50);

    const subtotal12 = docData.base_12 || 0;
    const subtotal0 = docData.base_0 || 0;
    const subtotalNoObj = docData.base_no_objeto || 0;
    const iva = docData.monto_iva || 0;
    const total = (subtotal12 + subtotal0 + subtotalNoObj + iva);

    printRow('Base Gravada 12/15/5%:', `$${subtotal12.toFixed(2)}`, 'Base Gravada 0%:', `$${subtotal0.toFixed(2)}`);
    printRow('Base No Objeto IVA:', `$${subtotalNoObj.toFixed(2)}`, 'Monto IVA:', `$${iva.toFixed(2)}`);

    pdf.setFont('helvetica', 'bold');
    pdf.text('Total Comprobante:', col1X, currentY);
    pdf.setTextColor(16, 185, 129); // Green total
    pdf.text(`$${total.toFixed(2)}`, col1X + 45, currentY);
    pdf.setTextColor(50, 50, 50);

    currentY += 10;

    // Section 3: Asiento Contable
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(99, 102, 241);
    pdf.text('3. DETALLE DEL ASIENTO CONTABLE', 14, currentY);
    pdf.line(14, currentY + 2, pageWidth - 14, currentY + 2);

    currentY += 6;

    const movRows = movements.map(m => {
        return [
            getAccountLabel(m.id_cuenta),
            m.debe > 0 ? `$${parseFloat(m.debe).toFixed(2)}` : '—',
            m.haber > 0 ? `$${parseFloat(m.haber).toFixed(2)}` : '—'
        ];
    });

    const totalDebe = movements.reduce((sum, m) => sum + (parseFloat(m.debe) || 0), 0);
    const totalHaber = movements.reduce((sum, m) => sum + (parseFloat(m.haber) || 0), 0);

    const movFoot = [
        ['Total Asiento', `$${totalDebe.toFixed(2)}`, `$${totalHaber.toFixed(2)}`]
    ];

    autoTable(pdf, {
        head: [['Cuenta Contable', 'Debe', 'Haber']],
        body: movRows,
        foot: movFoot,
        startY: currentY,
        margin: { left: 14, right: 14 },
        styles: { fontSize: 8.5, cellPadding: 3 },
        headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
        footStyles: { fillColor: [240, 245, 250], textColor: [30, 30, 30], fontStyle: 'bold' },
        columnStyles: {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 35, halign: 'right' },
            2: { cellWidth: 35, halign: 'right' }
        },
        didDrawPage: (data) => {
            currentY = data.cursor?.y || currentY;
        }
    });

    currentY = (pdf as any).lastAutoTable.finalY + 12;

    // Section 4: Retenciones Aplicadas (if any)
    if (docData.retenciones_aplicadas && docData.retenciones_aplicadas.length > 0) {
        if (currentY + 30 > pdf.internal.pageSize.height) {
            pdf.addPage();
            currentY = 20;
        }

        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(99, 102, 241);
        pdf.text('4. RETENCIONES APLICADAS', 14, currentY);
        pdf.line(14, currentY + 2, pageWidth - 14, currentY + 2);

        currentY += 6;

        const retRows = docData.retenciones_aplicadas.map((r: any) => {
            return [
                r.tipo || '—',
                r.codigo || '—',
                r.porcentaje ? `${r.porcentaje}%` : '—',
                r.base ? `$${parseFloat(r.base).toFixed(2)}` : '—',
                r.valor ? `$${parseFloat(r.valor).toFixed(2)}` : '—',
                r.numero_retencion || 'Manual'
            ];
        });

        autoTable(pdf, {
            head: [['Tipo', 'Cod. SRI', 'Porcentaje', 'Base Imp.', 'Val. Retenido', 'No. Retención']],
            body: retRows,
            startY: currentY,
            margin: { left: 14, right: 14 },
            styles: { fontSize: 8.5, cellPadding: 3 },
            headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' }, // indigo 600
            columnStyles: {
                0: { halign: 'center' },
                1: { halign: 'center' },
                2: { halign: 'center' },
                3: { halign: 'right' },
                4: { halign: 'right' },
                5: { halign: 'center' }
            }
        });
    }

    // Footer page number and tagline
    const totalPages = pdf.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'italic');
        pdf.setTextColor(150, 150, 150);
        pdf.text('Generado con la tecnología de Prospera Pymes', 14, pdf.internal.pageSize.height - 10);
        pdf.text(`Página ${i} de ${totalPages}`, pageWidth - 14, pdf.internal.pageSize.height - 10, { align: 'right' });
    }

    const cleanTitle = `Detalle_Comprobante_${xmlNumero}`;
    pdf.save(`${cleanTitle}.pdf`);
};

export const generateLibroDiarioPDF = async (
    empresaId: string,
    title: string,
    subtitle: string,
    transactions: any[]
) => {
    // 1. Fetch metadata
    const { data: { user } } = await supabase.auth.getUser();
    let contadorLogo = null;
    if (user) {
        const { data: perfil } = await supabase.from('perfiles').select('logo_url').eq('id_usuario', user.id).single();
        if (perfil?.logo_url) contadorLogo = await getBase64ImageFromUrl(perfil.logo_url);
    }

    const { data: empresa } = await supabase.from('empresas_gestionadas').select('nombre_empresa, ruc_empresa, logo_url').eq('id', empresaId).single();
    let empresaLogo = null;
    let empresaNombre = 'Empresa';
    let empresaRuc = '';
    if (empresa) {
        empresaNombre = empresa.nombre_empresa;
        empresaRuc = empresa.ruc_empresa || '';
        if (empresa.logo_url) empresaLogo = await getBase64ImageFromUrl(empresa.logo_url);
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    const drawHeader = () => {
        if (empresaLogo) {
            doc.addImage(empresaLogo, 'PNG', 14, 10, 20, 20, undefined, 'FAST');
        }
        if (contadorLogo) {
            doc.addImage(contadorLogo, 'PNG', pageWidth - 14 - 20, 10, 20, 20, undefined, 'FAST');
        }
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 30, 30);
        doc.text(empresaNombre, pageWidth / 2, 16, { align: 'center' });

        if (empresaRuc) {
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 100, 100);
            doc.text(`RUC: ${empresaRuc}`, pageWidth / 2, 21, { align: 'center' });
        }

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(60, 60, 60);
        doc.text(title, pageWidth / 2, 27, { align: 'center' });

        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(120, 120, 120);
        doc.text(subtitle, pageWidth / 2, 32, { align: 'center' });

        const downloadDateStr = `Descargado el: ${new Date().toLocaleDateString('es-EC')} ${new Date().toLocaleTimeString('es-EC')}`;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(130, 130, 130);
        doc.text(downloadDateStr, pageWidth / 2, 37, { align: 'center' });
    };

    const drawFooter = (data: any) => {
        const str = `Página ${data.pageNumber}`;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(150, 150, 150);
        doc.text('Generado con la tecnología de Prospera Pymes', 14, doc.internal.pageSize.height - 10);
        doc.text(str, pageWidth - 14, doc.internal.pageSize.height - 10, { align: 'right' });
    };

    const columns = ['Código / Cuenta', 'Concepto / Glosa', 'Debe', 'Haber'];
    const rows: any[] = [];
    let totalLibroDebe = 0;
    let totalLibroHaber = 0;

    transactions.forEach(tx => {
        const isAnulado = tx.tipo_comprobante === 'Anulado';
        const dateStr = tx.fecha ? new Date(tx.fecha + 'T12:00:00').toLocaleDateString('es-EC') : '—';
        const docNum = tx.numero_comprobante || '—';
        const razonSocial = tx.entidades?.razon_social || 'Consumidor Final';
        
        // Asiento Contable Spanning Row
        rows.push([
            {
                content: `ASIENTO #${docNum} | FECHA: ${dateStr} | TERCERO: ${razonSocial}${isAnulado ? ' [ANULADO]' : ''}`,
                colSpan: 4,
                styles: { fillColor: isAnulado ? [254, 242, 242] : [243, 244, 246], fontStyle: 'bold', textColor: isAnulado ? [220, 38, 38] : [31, 41, 55] }
            }
        ]);

        tx.movimientos.forEach((m: any) => {
            const code = m.plan_cuentas?.codigo_cuenta || '';
            const name = m.plan_cuentas?.nombre || '';
            const debeVal = Number(m.debe || 0);
            const haberVal = Number(m.haber || 0);

            rows.push([
                `${code} - ${name}`,
                tx.concepto || '',
                debeVal > 0 ? `$${debeVal.toFixed(2)}` : '—',
                haberVal > 0 ? `$${haberVal.toFixed(2)}` : '—'
            ]);

            if (!isAnulado) {
                totalLibroDebe += debeVal;
                totalLibroHaber += haberVal;
            }
        });
    });

    const foot = [[
        'TOTAL GENERAL LIBRO DIARIO',
        '',
        `$${totalLibroDebe.toFixed(2)}`,
        `$${totalLibroHaber.toFixed(2)}`
    ]];

    autoTable(doc, {
        head: [columns],
        body: rows,
        foot: foot,
        startY: 42,
        margin: { top: 42, bottom: 20 },
        styles: { fontSize: 8, cellPadding: 3, textColor: [50, 50, 50] },
        headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold', halign: 'left' },
        footStyles: { fillColor: [240, 245, 250], textColor: [0, 0, 0], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [255, 255, 255] },
        columnStyles: {
            0: { cellWidth: 70 },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 30, halign: 'right' },
            3: { cellWidth: 30, halign: 'right' }
        },
        didDrawPage: (data) => {
            drawHeader();
            drawFooter(data);
        }
    });

    const fileName = `Libro_Diario_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
};


