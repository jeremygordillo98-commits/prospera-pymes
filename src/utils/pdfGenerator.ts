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
        startY: 40,
        margin: { top: 40, bottom: 20 },
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
