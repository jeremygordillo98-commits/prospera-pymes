import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';

const supabaseB2C = createClient(
  'https://brlqdlnbebtmtmyodxgy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJybHFkbG5iZWJ0bXRteW9keGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNTY4OTQsImV4cCI6MjA4MzYzMjg5NH0.ZKOZNkkpsrQXCCw82ZFJHkBmQX8nho9V7KdxDoZERIo'
);

import { 
  Mail, 
  Send, 
  Clock, 
  Plus, 
  Trash2, 
  Eye, 
  FileText, 
  Paperclip, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Calendar,
  Layers,
  ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ComunicadosProps {
  empresaId: string;
}

interface CampanaPymes {
  id: string;
  created_at: string;
  titulo: string;
  asunto: string;
  contenido: string;
  plantilla_id: string;
  destinatarios: string;
  manual_emails?: string;
  adjuntos: any[];
  estado: 'Borrador' | 'Programado' | 'Enviado' | 'Error';
  scheduled_at?: string;
  sent_at?: string;
}

const TEMPLATE_PRESETS = [
  {
    id: 'sri_alert',
    name: '🔴 Alerta de Obligaciones SRI',
    subject: 'Aviso Importante: Vencimiento de Obligaciones Tributarias SRI',
    title: 'Aviso de Obligaciones Tributarias',
    defaultText: 'Estimado cliente,\n\nLe escribimos para recordarle que el calendario de vencimientos del SRI para la presentación de sus declaraciones mensuales se encuentra próximo. \n\nPor favor, asegúrese de remitirnos toda su documentación (facturas físicas, comprobantes de retención manuales y reportes de caja) a la brevedad posible para procesar y presentar su declaración dentro del plazo legal y evitar multas.\n\nQuedamos a su entera disposición.'
  },
  {
    id: 'balance_delivery',
    name: '📄 Envío de Balance y Reportes',
    subject: 'Estados Financieros y Reporte de Caja Mensual',
    title: 'Reportes Financieros del Mes',
    defaultText: 'Estimado cliente,\n\nAdjunto a este correo compartimos con usted el Balance General, Estado de Resultados y Reporte de Caja correspondiente al último mes.\n\nHemos consolidado la información contable y los números muestran un desempeño óptimo en el flujo de caja del negocio. Le sugerimos revisar en detalle los reportes adjuntos.\n\nCualquier duda o comentario que tenga, con gusto la revisaremos juntos.'
  },
  {
    id: 'payment_reminder',
    name: '💰 Notificación de Cobro Pendiente',
    subject: 'Recordatorio Amistoso: Saldo Pendiente de Pago',
    title: 'Notificación de Saldo Pendiente',
    defaultText: 'Estimado cliente,\n\nLe escribimos para enviarle un saludo cordial y, al mismo tiempo, recordarle de forma amistosa que tiene un saldo pendiente de pago correspondiente a sus servicios contables contratados.\n\nLe agradecemos realizar la transferencia bancaria a las cuentas autorizadas a la brevedad para poder mantener el despacho normal de sus reportes y la gestión contable de su negocio.\n\nMuchas gracias por su confianza y colaboración.'
  },
  {
    id: 'general_notice',
    name: '✉️ Comunicado General',
    subject: 'Comunicado Importante de su Asesor Contable',
    title: 'Comunicado General',
    defaultText: 'Estimado cliente,\n\nPor medio del presente comunicado, queremos compartir con usted información relevante acerca de los nuevos lineamientos de control interno y entrega de documentación contable.\n\nA partir de este mes, estaremos aplicando mejoras en el flujo de recepción para automatizar las cargas del SRI de forma más ágil.\n\nAgradecemos de antemano su colaboración y seguimos trabajando para brindarle el mejor servicio.'
  }
];

export const Comunicados: React.FC<ComunicadosProps> = ({ empresaId }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [empresaInfo, setEmpresaInfo] = useState<any>(null);
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [activePreset, setActivePreset] = useState('general_notice');
  const [filesList, setFilesList] = useState<File[]>([]);
  const [filesBase64, setFilesBase64] = useState<Array<{ content: string; name: string }>>([]);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [sending, setSending] = useState(false);
  const [sendingProgress, setSendingProgress] = useState<{ current: number; total: number } | null>(null);
  const [selectedCampanaRecipients, setSelectedCampanaRecipients] = useState<CampanaPymes | null>(null);
  const [customAlert, setCustomAlert] = useState<{ type: 'success' | 'error' | 'info'; title: string; message: string; onClose?: () => void } | null>(null);

  // Form State
  const [form, setForm] = useState({
    id: '',
    titulo: '',
    asunto: '',
    cuerpoMsg: '',
    destinatarios: 'prueba' as 'prueba' | 'clientes' | 'proveedores' | 'manual',
    manualEmails: '',
    testEmail: '',
    programado: false,
    scheduledDate: ''
  });

  // Fetch empresa info (nombre, logo)
  useEffect(() => {
    if (!empresaId) return;
    supabase.from('empresas_gestionadas')
      .select('nombre_empresa, logo_url, ruc_empresa')
      .eq('id', empresaId)
      .single()
      .then(({ data }) => {
        if (data) setEmpresaInfo(data);
      });
  }, [empresaId]);

  // Query sent communications
  const { data: listado = [], isLoading: loadingList, refetch } = useQuery({
    queryKey: ['comunicados_pymes', empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data, error } = await supabase
        .from('comunicados_pymes')
        .select('*')
        .eq('id_empresa', empresaId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error cargando comunicados:", error);
        return [];
      }
      
      const list = (data || []) as CampanaPymes[];
      const now = new Date();
      
      // Sincronizar automáticamente en la base de datos los comunicados programados cuyo tiempo ya pasó
      const updatedList = await Promise.all(
        list.map(async (camp) => {
          if (camp.estado === 'Programado' && camp.scheduled_at && new Date(camp.scheduled_at) <= now) {
            const { error: updateError } = await supabase
              .from('comunicados_pymes')
              .update({
                estado: 'Enviado',
                sent_at: camp.scheduled_at,
                updated_at: now.toISOString()
              })
              .eq('id', camp.id);
            
            if (updateError) {
              console.error(`Error al actualizar comunicado programado ${camp.id} a Enviado:`, updateError);
              return camp;
            }
            
            return {
              ...camp,
              estado: 'Enviado',
              sent_at: camp.scheduled_at
            } as CampanaPymes;
          }
          return camp;
        })
      );
      
      return updatedList;
    }
  });

  // Query entidades (clientes/proveedores) for current active company
  const { data: entidades = [] } = useQuery({
    queryKey: ['entidades_comunicados', empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data } = await supabase
        .from('entidades')
        .select('email, razon_social, tipo_entidad')
        .eq('id_empresa', empresaId);
      return data || [];
    }
  });

  // Detect total attachments size
  const totalAttachmentsSize = filesList.reduce((acc, f) => acc + f.size, 0);
  const sizeLimitExceeded = totalAttachmentsSize > 5 * 1024 * 1024; // 5MB

  // Trigger default preset text
  useEffect(() => {
    const sel = TEMPLATE_PRESETS.find(p => p.id === activePreset);
    if (sel && !form.id) {
      setForm(prev => ({
        ...prev,
        asunto: sel.subject,
        cuerpoMsg: sel.defaultText,
        titulo: `Comunicado - ${sel.name.replace(/[^\w\s]/g, '').trim()}`
      }));
    }
  }, [activePreset, isWorkspaceOpen]);

  // Build high fidelity dynamic HTML Email Template
  const generateFinalHtml = (bodyText: string) => {
    const headerTitle = TEMPLATE_PRESETS.find(p => p.id === activePreset)?.title || 'Comunicado Oficial';
    const logoSection = empresaInfo?.logo_url 
      ? `<img src="${empresaInfo.logo_url}" alt="${empresaInfo.nombre_empresa}" style="max-height: 50px; display: block; margin: 0 auto 16px; border-radius: 8px;" />`
      : `<h2 style="margin: 0; color: #10b981; font-weight: 800; font-size: 1.5rem; text-align: center;">${empresaInfo?.nombre_empresa || 'Servicios Contables'}</h2>`;

    const paragraphs = bodyText.split('\n').map(p => p.trim() ? `<p style="margin-bottom: 16px; line-height: 1.6;">${p}</p>` : '').join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${form.asunto}</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #334155; -webkit-font-smoothing: antialiased;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 32px 16px;">
          <tr>
            <td align="center">
              <table width="100%" maxWidth="600px" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03); max-width: 600px; border: 1px solid #e2e8f0;">
                
                <!-- Header -->
                <tr>
                  <td style="padding: 40px 32px; background-color: #ffffff; border-bottom: 1px solid #f1f5f9; text-align: center;">
                    ${logoSection}
                    <div style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b; font-weight: 800; margin-top: 4px;">
                      ${headerTitle}
                    </div>
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding: 40px 32px; font-size: 1rem; color: #334155;">
                    ${paragraphs}
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding: 24px 32px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; text-align: center; font-size: 0.78rem; color: #64748b;">
                    <p style="margin: 0 0 6px; font-weight: 700; color: #475569;">${empresaInfo?.nombre_empresa || 'Asesoría Contable'}</p>
                    <p style="margin: 0 0 16px;">RUC: ${empresaInfo?.ruc_empresa || 'N/A'}</p>
                    <div style="width: 40px; height: 1px; background-color: #cbd5e1; margin: 0 auto 16px;"></div>
                    <p style="margin: 0; font-size: 0.72rem; opacity: 0.8;">
                      Este comunicado ha sido enviado de forma segura a través de <span style="color: #10b981; font-weight: 700;">Prospera Pymes</span>.
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  };

  // Real-time Preview Compilation
  useEffect(() => {
    if (isWorkspaceOpen) {
      setPreviewHtml(generateFinalHtml(form.cuerpoMsg));
    }
  }, [form.cuerpoMsg, activePreset, empresaInfo, isWorkspaceOpen]);

  // Dynamically hide main sidebar when workspace is open to avoid overlapping
  useEffect(() => {
    const sidebarEl = document.querySelector('.sidebar') as HTMLElement;
    if (sidebarEl) {
      if (isWorkspaceOpen) {
        sidebarEl.style.display = 'none';
      } else {
        sidebarEl.style.display = '';
      }
    }
    return () => {
      if (sidebarEl) sidebarEl.style.display = '';
    };
  }, [isWorkspaceOpen]);

  // File to Base64 encoder
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newFiles = [...filesList, ...files];
    setFilesList(newFiles);

    const encodedPromises = files.map(file => {
      return new Promise<{ content: string; name: string }>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          const rawBase64 = (reader.result as string).split(',')[1];
          resolve({ content: rawBase64, name: file.name });
        };
        reader.onerror = error => reject(error);
      });
    });

    try {
      const results = await Promise.all(encodedPromises);
      setFilesBase64(prev => [...prev, ...results]);
    } catch (err) {
      setCustomAlert({
        type: 'error',
        title: 'Error de Adjuntos',
        message: 'Error al procesar los archivos adjuntos.'
      });
    }

    e.target.value = ''; // Reset input
  };

  const removeFile = (idx: number) => {
    setFilesList(prev => prev.filter((_, i) => i !== idx));
    setFilesBase64(prev => prev.filter((_, i) => i !== idx));
  };

  const resetForm = () => {
    setForm({
      id: '',
      titulo: '',
      asunto: '',
      cuerpoMsg: '',
      destinatarios: 'prueba',
      manualEmails: '',
      testEmail: '',
      programado: false,
      scheduledDate: ''
    });
    setFilesList([]);
    setFilesBase64([]);
    setActivePreset('general_notice');
  };

  // Main Dispatcher using send-campaign edge function
  const handleSend = async (esBorrador: boolean = false) => {
    if (!form.titulo || !form.asunto || !form.cuerpoMsg) {
      setCustomAlert({
        type: 'error',
        title: 'Campos Incompletos',
        message: 'Por favor rellena el título, asunto y mensaje del comunicado.'
      });
      return;
    }

    if (form.destinatarios === 'prueba' && !form.testEmail) {
      setCustomAlert({
        type: 'error',
        title: 'Correo de Prueba Requerido',
        message: 'Por favor ingresa el correo de prueba.'
      });
      return;
    }

    if (form.destinatarios === 'manual' && !form.manualEmails) {
      setCustomAlert({
        type: 'error',
        title: 'Correos Manuales Requeridos',
        message: 'Por favor ingresa los correos manuales.'
      });
      return;
    }

    if (sizeLimitExceeded) {
      setCustomAlert({
        type: 'error',
        title: 'Límite de Peso Excedido',
        message: 'La suma de todos los archivos adjuntos no puede exceder el límite de 5MB.'
      });
      return;
    }

    setSending(true);
    setSendingProgress(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesión de usuario no válida.");

      // 1. Filter destinaries
      let listadoDest: Array<{ email: string; nombre: string }> = [];

      if (form.destinatarios === 'prueba') {
        listadoDest = [{ email: form.testEmail, nombre: 'Contador (Prueba)' }];
      } else if (form.destinatarios === 'manual') {
        listadoDest = form.manualEmails.split(/[\n,;]/)
          .map(e => e.trim())
          .filter(e => e && e.includes('@'))
          .map(e => ({ email: e, nombre: e.split('@')[0] }));
      } else if (form.destinatarios === 'clientes') {
        listadoDest = entidades
          .filter(e => e.tipo_entidad === 'Cliente' && e.email)
          .map(e => ({ email: e.email!, nombre: e.razon_social }));
      } else if (form.destinatarios === 'proveedores') {
        listadoDest = entidades
          .filter(e => e.tipo_entidad === 'Proveedor' && e.email)
          .map(e => ({ email: e.email!, nombre: e.razon_social }));
      }

      if (!esBorrador && listadoDest.length === 0) {
        throw new Error("No hay destinatarios con correo electrónico válido en esta selección.");
      }

      // 2. Persist record in crm_campanas
      const campaignPayload = {
        id_empresa: empresaId,
        titulo: form.titulo,
        asunto: form.asunto,
        contenido: form.cuerpoMsg,
        plantilla_id: activePreset,
        destinatarios: form.destinatarios,
        manual_emails: form.destinatarios === 'manual' ? form.manualEmails : null,
        adjuntos: filesList.map(f => ({ name: f.name, size: f.size })),
        estado: esBorrador ? 'Borrador' : (form.programado ? 'Programado' : 'Enviado'),
        scheduled_at: (form.programado && form.scheduledDate) ? new Date(form.scheduledDate).toISOString() : null,
        sent_at: (esBorrador || form.programado) ? null : new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      let recordId = form.id;
      if (recordId) {
        const { error: updErr } = await supabase
          .from('comunicados_pymes')
          .update(campaignPayload)
          .eq('id', recordId);
        if (updErr) throw updErr;
      } else {
        const { data: insData, error: insErr } = await supabase
          .from('comunicados_pymes')
          .insert([campaignPayload])
          .select('id')
          .single();
        if (insErr) throw insErr;
        recordId = insData.id;
      }

      // 3. Dispatch to Brevo via Edge Function if NOT a draft
      if (!esBorrador) {
        setSendingProgress({ current: 0, total: listadoDest.length });
        let errorsCount = 0;

        const scheduledTime = (form.programado && form.scheduledDate) 
          ? new Date(form.scheduledDate).toISOString() 
          : undefined;

        // Fetch accountant profile name for reply-to
        const { data: profile } = await supabase.from('perfiles').select('nombre_completo').eq('id_usuario', user.id).maybeSingle();
        const accountantName = profile?.nombre_completo || 'Contador Autorizado';

        for (let i = 0; i < listadoDest.length; i++) {
          const dest = listadoDest[i];
          setSendingProgress({ current: i + 1, total: listadoDest.length });

          const finalHtml = generateFinalHtml(form.cuerpoMsg);

          try {
            const { error: sendErr } = await supabaseB2C.functions.invoke('send-campaign', {
              body: {
                to: dest.email,
                subject: form.asunto,
                htmlContent: finalHtml,
                sender: {
                  name: empresaInfo?.nombre_empresa || accountantName,
                  email: "soporte@prosperafinanzas.com"
                },
                replyTo: {
                  email: user.email,
                  name: accountantName
                },
                attachment: filesBase64.length > 0 ? filesBase64 : undefined,
                scheduledAt: scheduledTime,
                batchId: recordId
              }
            });

            if (sendErr) throw sendErr;
          } catch (err) {
            console.error(`Error de envío a ${dest.email}:`, err);
            errorsCount++;
          }
        }

        if (errorsCount > 0) {
          const finalStatus = errorsCount === listadoDest.length ? 'Error' : 'Enviado';
          await supabase.from('comunicados_pymes')
            .update({ 
              estado: finalStatus, 
              titulo: `${form.titulo} (${listadoDest.length - errorsCount}/${listadoDest.length} despachados)`
            })
            .eq('id', recordId);
          
          setCustomAlert({
            type: 'success',
            title: 'Despacho Completado',
            message: `Despacho completado. Se enviaron con éxito ${listadoDest.length - errorsCount} de ${listadoDest.length} correos.`,
            onClose: () => {
              refetch();
              setIsWorkspaceOpen(false);
              resetForm();
            }
          });
        } else {
          setCustomAlert({
            type: 'success',
            title: '¡Envío Exitoso!',
            message: `¡Comunicado despachado con éxito total a los ${listadoDest.length} destinatarios!`,
            onClose: () => {
              refetch();
              setIsWorkspaceOpen(false);
              resetForm();
            }
          });
        }
      } else {
        setCustomAlert({
          type: 'success',
          title: 'Borrador Guardado',
          message: 'Borrador guardado correctamente.',
          onClose: () => {
            refetch();
            setIsWorkspaceOpen(false);
            resetForm();
          }
        });
      }
    } catch (err: any) {
      console.error(err);
      setCustomAlert({
        type: 'error',
        title: 'Error al Procesar',
        message: `Error al procesar el comunicado: ${err.message || 'Error desconocido.'}`
      });
    } finally {
      setSending(false);
      setSendingProgress(null);
    }
  };

  const cancelBrevoSchedule = async (campaignId: string): Promise<boolean> => {
    try {
      const { error: cancelErr } = await supabaseB2C.functions.invoke(`send-campaign?batchId=${campaignId}`, {
        method: 'DELETE'
      });
      if (cancelErr) throw cancelErr;
      return true;
    } catch (err) {
      console.error("Error al cancelar en Brevo:", err);
      return false;
    }
  };

  const handleCancelScheduled = async (camp: CampanaPymes) => {
    if (!confirm("¿Deseas cancelar el envío programado de esta campaña? El correo se detendrá en Brevo y volverá a ser un Borrador.")) return;
    
    const ok = await cancelBrevoSchedule(camp.id);
    if (ok) {
      const { error } = await supabase.from('comunicados_pymes')
        .update({
          estado: 'Borrador',
          scheduled_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', camp.id);
      
      if (error) {
        alert("Se canceló en Brevo pero falló al actualizar la base de datos: " + error.message);
      } else {
        alert("Envío programado cancelado correctamente. La campaña ahora es un Borrador.");
      }
      refetch();
    } else {
      alert("No se pudo cancelar el envío programado en Brevo. Por favor, intenta de nuevo.");
    }
  };

  const handleEditScheduled = async (camp: CampanaPymes) => {
    if (!confirm("Para editar esta campaña programada, primero debemos cancelar el envío en Brevo. ¿Deseas continuar?")) return;
    
    const ok = await cancelBrevoSchedule(camp.id);
    if (ok) {
      const { error } = await supabase.from('comunicados_pymes')
        .update({
          estado: 'Borrador',
          scheduled_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', camp.id);
      
      if (!error) {
        loadDraft({
          ...camp,
          estado: 'Borrador',
          scheduled_at: undefined
        });
      } else {
        alert("Se canceló en Brevo pero falló al actualizar la base de datos: " + error.message);
      }
      refetch();
    } else {
      alert("No se pudo cancelar el envío en Brevo. No se puede editar en este momento.");
    }
  };

  const deleteRecord = async (camp: CampanaPymes) => {
    if (!confirm("¿Seguro de que deseas eliminar este registro?")) return;
    
    if (camp.estado === 'Programado') {
      const cancelOk = await cancelBrevoSchedule(camp.id);
      if (!cancelOk) {
        if (!confirm("No se pudo cancelar la programación en Brevo. ¿Deseas eliminar el registro en la base de datos de todas formas?")) {
          return;
        }
      }
    }

    const { error } = await supabase.from('comunicados_pymes').delete().eq('id', camp.id);
    if (!error) refetch();
  };

  const loadDraft = (camp: CampanaPymes) => {
    setForm({
      id: camp.id,
      titulo: camp.titulo,
      asunto: camp.asunto,
      cuerpoMsg: camp.contenido,
      destinatarios: camp.destinatarios as any,
      manualEmails: camp.manual_emails || '',
      testEmail: '',
      programado: !!camp.scheduled_at,
      scheduledDate: camp.scheduled_at ? new Date(camp.scheduled_at).toISOString().slice(0, 16) : ''
    });
    setActivePreset(camp.plantilla_id);
    setIsWorkspaceOpen(true);
  };

  const btnStyle = { background: 'var(--input-bg)', border: '1px solid var(--border-color)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: '100px' }}>
      
      {/* ─── LIST VIEW (Standard Dashboard) ─── */}
      {!isWorkspaceOpen && (
        <>
          <header className="flex-between" style={{ flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '2px', marginBottom: '8px' }}>
                <Mail size={14} /> Mailer Contable B2B
              </div>
              <h1 className="h1" style={{ fontSize: '2.5rem', fontWeight: 900 }}>Comunicados</h1>
              <p className="text-sec" style={{ fontSize: '1.1rem' }}>Envía boletines, recordatorios del SRI y reportes financieros a tus clientes.</p>
            </div>
            <button
              onClick={() => { resetForm(); setIsWorkspaceOpen(true); }}
              className="btn btn-primary"
              style={{ padding: '14px 28px', borderRadius: '18px', fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <Plus size={20} /> Redactar Comunicado
            </button>
          </header>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
            <div className="glass-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-sec)' }}>Total Mensajes</span>
              <span style={{ fontSize: '2.2rem', fontWeight: 900 }}>{listado.length}</span>
            </div>
            <div className="glass-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-sec)', display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={12} className="text-success" /> Despachados</span>
              <span style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--success)' }}>{listado.filter(c => c.estado === 'Enviado').length}</span>
            </div>
            <div className="glass-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-sec)', display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12} className="text-primary" /> Programados</span>
              <span style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--primary)' }}>{listado.filter(c => c.estado === 'Programado').length}</span>
            </div>
          </div>

          <section className="glass-card" style={{ padding: '24px' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: '1.2rem', fontWeight: 900 }}>Historial de Envíos Masivos</h3>
            
            {loadingList ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[1, 2, 3].map(i => <div key={i} style={{ height: 50, borderRadius: 12, background: 'rgba(255,255,255,0.03)', animation: 'pulse 1.5s infinite' }} />)}
              </div>
            ) : listado.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-sec)', fontSize: '0.95rem' }}>
                No se han registrado envíos masivos. ¡Comienza haciendo clic en "Redactar Comunicado"!
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      {['Fecha', 'Asunto', 'Destinatarios', 'Estado', 'Adjuntos', ''].map(h => (
                        <th key={h} style={{ padding: '12px', fontSize: '0.75rem', color: 'var(--text-sec)', textTransform: 'uppercase', fontWeight: 800 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {listado.map(camp => (
                      <tr key={camp.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '12px', fontSize: '0.82rem', fontWeight: 600 }}>
                          {new Date(camp.created_at).toLocaleDateString('es-EC')}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{camp.titulo}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-sec)', marginTop: 2 }}>{camp.asunto}</div>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ background: 'var(--input-bg)', color: 'var(--text-main)', padding: '4px 8px', borderRadius: 8, fontSize: '0.7rem', fontWeight: 800 }}>
                            {camp.destinatarios === 'clientes' && '👥 Clientes'}
                            {camp.destinatarios === 'proveedores' && '👥 Proveedores'}
                            {camp.destinatarios === 'manual' && '✏️ Manual'}
                            {camp.destinatarios === 'prueba' && '🧪 Prueba'}
                          </span>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{
                            background: camp.estado === 'Enviado' ? 'rgba(16, 185, 129, 0.15)' : (camp.estado === 'Programado' ? 'rgba(59, 130, 246, 0.15)' : (camp.estado === 'Borrador' ? 'rgba(148, 163, 184, 0.15)' : 'rgba(239, 68, 68, 0.15)')),
                            color: camp.estado === 'Enviado' ? 'var(--success)' : (camp.estado === 'Programado' ? '#3b82f6' : (camp.estado === 'Borrador' ? '#94a3b8' : 'var(--error)')),
                            padding: '4px 10px',
                            borderRadius: 20,
                            fontSize: '0.7rem',
                            fontWeight: 800
                          }}>
                            {camp.estado === 'Enviado' && '✓ Enviado'}
                            {camp.estado === 'Programado' && '⏰ Programado'}
                            {camp.estado === 'Borrador' && '✏ Borrador'}
                            {camp.estado === 'Error' && '✗ Error'}
                          </span>
                        </td>
                        <td style={{ padding: '12px', fontSize: '0.8rem', color: 'var(--text-sec)', fontWeight: 600 }}>
                          {camp.adjuntos?.length > 0 ? `📎 ${camp.adjuntos.length} archivo(s)` : 'Ninguno'}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 8 }}>
                            {camp.estado === 'Borrador' && (
                              <button onClick={() => loadDraft(camp)} className="btn" title="Editar Borrador" style={{ ...btnStyle, padding: 6, borderRadius: 8 }}>
                                <Layers size={14} />
                              </button>
                            )}
                            {camp.estado === 'Programado' && (
                              <>
                                <button onClick={() => handleEditScheduled(camp)} className="btn" title="Editar Programación (se cancelará el envío actual)" style={{ ...btnStyle, padding: 6, borderRadius: 8 }}>
                                  <Layers size={14} />
                                </button>
                                <button onClick={() => handleCancelScheduled(camp)} className="btn hover:text-warning" title="Cancelar Envío Programado" style={{ ...btnStyle, padding: 6, borderRadius: 8, color: '#F59E0B' }}>
                                  <Clock size={14} />
                                </button>
                              </>
                            )}
                            <button onClick={() => setSelectedCampanaRecipients(camp)} className="btn" title="Ver Destinatarios" style={{ ...btnStyle, padding: 6, borderRadius: 8 }}>
                              <Eye size={14} />
                            </button>
                            <button onClick={() => deleteRecord(camp)} className="btn hover:text-error" title="Eliminar Registro" style={{ ...btnStyle, padding: 6, borderRadius: 8, color: 'var(--error)' }}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {/* ─── FULL VIEW WORKSPACE (Side-by-Side Editor & Live Preview) ─── */}
      <AnimatePresence>
        {isWorkspaceOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: 15 }}
            style={{ 
              position: 'fixed', 
              inset: 0, 
              zIndex: 99999999, 
              display: 'flex', 
              flexDirection: 'column', 
              background: 'var(--bg-main)', 
              color: 'var(--text-main)',
              overflow: 'hidden'
            }}
          >
            {/* Top Workspace Bar */}
            <header style={{ 
              padding: '16px 32px', 
              borderBottom: '1px solid var(--border-color)', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              background: 'var(--nav-bg)',
              flexShrink: 0 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <button 
                  onClick={() => setIsWorkspaceOpen(false)} 
                  className="btn" 
                  style={{ ...btnStyle, padding: '8px 16px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
                >
                  <ArrowLeft size={16} /> Volver al Historial
                </button>
                <div style={{ width: 1, height: 24, background: 'var(--border-color)' }}></div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900 }}>
                    {form.id ? 'Editar Comunicado' : 'Creador de Comunicados Contables'}
                  </h2>
                  <p className="text-sec" style={{ margin: 0, fontSize: '0.78rem' }}>Redacción en texto plano con previsualización premium interactiva en tiempo real</p>
                </div>
              </div>

              {/* Action buttons top right */}
              <div style={{ display: 'flex', gap: 12 }}>
                <button 
                  type="button" 
                  onClick={() => handleSend(true)} 
                  disabled={sending} 
                  className="btn" 
                  style={{ ...btnStyle, borderRadius: 12, height: 42, padding: '0 20px', fontWeight: 800 }}
                >
                  Guardar Borrador
                </button>
                <button 
                  type="button" 
                  onClick={() => handleSend(false)} 
                  disabled={sending || sizeLimitExceeded} 
                  className="btn btn-primary" 
                  style={{ borderRadius: 12, height: 42, padding: '0 24px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  {sending ? <Loader2 className="animate-spin" size={16} /> : <><Send size={16} /> {form.programado ? 'Programar Envío' : 'Enviar Comunicado'}</>}
                </button>
              </div>
            </header>

            {/* Split Screen Workspace Body */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              
              {/* LEFT COLUMN: Redactor Form (60% width) */}
              <div className="custom-scrollbar" style={{ 
                width: '60%', 
                padding: '32px', 
                overflowY: 'auto', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: 20, 
                borderRight: '1px solid var(--border-color)',
                boxSizing: 'border-box'
              }}>
                
                {/* Real-time progress bar when sending */}
                {sending && sendingProgress && (
                  <div style={{ background: 'var(--primary-light)', border: '1px solid var(--primary)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 800, color: 'var(--primary)' }}>
                      <span>Despachando correos masivos...</span>
                      <span>{sendingProgress.current} de {sendingProgress.total} ({Math.round((sendingProgress.current / sendingProgress.total) * 100)}%)</span>
                    </div>
                    <div style={{ width: '100%', height: 6, background: 'var(--border-color)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: 'var(--primary)', width: `${(sendingProgress.current / sendingProgress.total) * 100}%`, transition: 'width 0.2s' }}></div>
                    </div>
                  </div>
                )}

                {/* Preset templates selector */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-sec)', marginBottom: 8 }}>Elegir Plantilla Base (Precarga el Asunto y Mensaje)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                    {TEMPLATE_PRESETS.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setActivePreset(p.id)}
                        className="btn"
                        style={{
                          ...btnStyle,
                          padding: 10,
                          fontSize: '0.78rem',
                          borderRadius: 10,
                          borderColor: activePreset === p.id ? 'var(--primary)' : 'var(--border-color)',
                          background: activePreset === p.id ? 'var(--primary-light)' : 'var(--input-bg)',
                          color: activePreset === p.id ? 'var(--primary)' : 'var(--text-main)',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {/* Titulo Interno */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-sec)', marginBottom: 6 }}>Título del Mensaje (Auditoría Interna)</label>
                    <input
                      type="text"
                      placeholder="Ej. Envío Balances Trimestrales"
                      value={form.titulo}
                      onChange={e => setForm({ ...form, titulo: e.target.value })}
                      style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>

                  {/* Asunto Comercial */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-sec)', marginBottom: 6 }}>Asunto del Correo (Subject)</label>
                    <input
                      type="text"
                      placeholder="Ej. Importante: Estados Financieros"
                      value={form.asunto}
                      onChange={e => setForm({ ...form, asunto: e.target.value })}
                      style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                {/* Destinatarios */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-sec)', marginBottom: 6 }}>Grupo de Destinatarios</label>
                    <select
                      value={form.destinatarios}
                      onChange={e => setForm({ ...form, destinatarios: e.target.value as any })}
                      style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}
                    >
                      <option value="prueba">🧪 Enviar Prueba Única</option>
                      <option value="clientes">👥 Todos mis Clientes de la Empresa</option>
                      <option value="proveedores">👥 Todos mis Proveedores de la Empresa</option>
                      <option value="manual">✏️ Lista de Correos Manual</option>
                    </select>
                  </div>

                  <div>
                    {form.destinatarios === 'prueba' && (
                      <>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-sec)', marginBottom: 6 }}>Correo de Prueba</label>
                        <input
                          type="email"
                          placeholder="ejemplo@contador.com"
                          value={form.testEmail}
                          onChange={e => setForm({ ...form, testEmail: e.target.value })}
                          style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', outline: 'none', boxSizing: 'border-box' }}
                        />
                      </>
                    )}

                    {form.destinatarios === 'manual' && (
                      <>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-sec)', marginBottom: 6 }}>Direcciones de Correo (Salto de línea o comas)</label>
                        <textarea
                          placeholder="cliente1@empresa.com, cliente2@empresa.com"
                          value={form.manualEmails}
                          onChange={e => setForm({ ...form, manualEmails: e.target.value })}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', outline: 'none', resize: 'vertical', boxSizing: 'border-box', height: 44 }}
                        />
                      </>
                    )}

                    {form.destinatarios === 'clientes' && (
                      <div style={{ background: 'var(--primary-light)', border: '1px solid var(--primary-light)', padding: 12, borderRadius: 12, fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 700, display: 'flex', alignItems: 'center', height: '100%', boxSizing: 'border-box' }}>
                        👥 Enviará a los clientes con email registrado en Entidades.
                      </div>
                    )}

                    {form.destinatarios === 'proveedores' && (
                      <div style={{ background: 'var(--primary-light)', border: '1px solid var(--primary-light)', padding: 12, borderRadius: 12, fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 700, display: 'flex', alignItems: 'center', height: '100%', boxSizing: 'border-box' }}>
                        👥 Enviará a los proveedores con email registrado en Entidades.
                      </div>
                    )}
                  </div>
                </div>

                {/* Redacción de Mensaje en TEXTO PLANO */}
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 250 }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-sec)', marginBottom: 6 }}>Mensaje (Escribe el contenido en texto plano limpio)</label>
                  <textarea
                    placeholder="Estimado cliente, por medio del presente correo le informamos..."
                    value={form.cuerpoMsg}
                    onChange={e => setForm({ ...form, cuerpoMsg: e.target.value })}
                    style={{ width: '100%', flex: 1, padding: 16, borderRadius: 16, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', outline: 'none', resize: 'none', fontFamily: 'inherit', fontSize: '0.95rem', boxSizing: 'border-box', minHeight: 200 }}
                  />
                </div>

                {/* Programador de Envío */}
                <div className="glass-card" style={{ padding: 16, background: 'rgba(255,255,255,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="checkbox"
                      id="progCheck"
                      checked={form.programado}
                      onChange={e => setForm({ ...form, programado: e.target.checked })}
                      style={{ cursor: 'pointer', width: 18, height: 18 }}
                    />
                    <label htmlFor="progCheck" style={{ fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}><Clock size={16} className="text-primary" /> Programar este correo para el futuro</label>
                  </div>
                  {form.programado && (
                    <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                      <Calendar size={16} className="text-sec" />
                      <input
                        type="datetime-local"
                        value={form.scheduledDate}
                        onChange={e => setForm({ ...form, scheduledDate: e.target.value })}
                        style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', outline: 'none', fontWeight: 600 }}
                      />
                    </div>
                  )}
                </div>

                {/* Subir Adjuntos Masivos en Memoria (Zero-Storage) */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-sec)', display: 'flex', alignItems: 'center', gap: 6 }}><Paperclip size={14} /> Archivos Adjuntos (Balances, XML, Facturas)</label>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: sizeLimitExceeded ? 'var(--error)' : 'var(--text-sec)' }}>
                      Total: {(totalAttachmentsSize / (1024 * 1024)).toFixed(2)} MB / 5.00 MB
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="btn" style={{ ...btnStyle, borderRadius: 10, padding: '8px 16px', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer' }}>
                      + Adjuntar Archivos
                    </button>
                    <input ref={fileInputRef} type="file" multiple onChange={handleFileChange} style={{ display: 'none' }} />
                  </div>

                  {filesList.length > 0 && (
                    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {filesList.map((file, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifySelf: 'stretch', background: 'var(--input-bg)', border: '1px solid var(--border-color)', padding: '10px 14px', borderRadius: 10, fontSize: '0.82rem' }}>
                          <FileText size={16} className="text-sec" style={{ marginRight: 10 }} />
                          <span style={{ flex: 1, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                          <span style={{ color: 'var(--text-sec)', marginRight: 14 }}>{(file.size / 1024).toFixed(1)} KB</span>
                          <button type="button" onClick={() => removeFile(i)} className="text-sec hover:text-error" style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><Trash2 size={16} /></button>
                        </div>
                      ))}
                    </div>
                  )}

                  {sizeLimitExceeded && (
                    <div style={{ display: 'flex', gap: 10, color: 'var(--error)', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: 12, borderRadius: 12, fontSize: '0.8rem', marginTop: 10 }}>
                      <AlertCircle size={16} style={{ flexShrink: 0 }} />
                      <p style={{ margin: 0 }}><strong>Límite de Peso Excedido:</strong> El peso total de todos los archivos no debe exceder los 5.00 MB.</p>
                    </div>
                  )}
                </div>

              </div>

              {/* RIGHT COLUMN: Live Real-time Interactive Preview (40% width) */}
              <div style={{ 
                width: '40%', 
                background: '#f1f5f9', 
                display: 'flex', 
                flexDirection: 'column',
                boxSizing: 'border-box',
                overflow: 'hidden'
              }}>
                <div style={{ 
                  padding: '12px 24px', 
                  background: 'var(--nav-bg)', 
                  borderBottom: '1px solid var(--border-color)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 8,
                  flexShrink: 0
                }}>
                  <Eye size={16} className="text-primary" />
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-main)' }}>
                    Previsualización en Tiempo Real
                  </span>
                </div>
                
                <div style={{ flex: 1, padding: 16, overflow: 'hidden' }}>
                  <iframe
                    title="Live Mailer Preview"
                    srcDoc={previewHtml}
                    style={{ width: '100%', height: '100%', border: 'none', borderRadius: 12, background: '#ffffff', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                  />
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* MODAL DE NOTIFICACIÓN PREMIUM */}
      {customAlert && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999999,
          padding: 16
        }}>
          <div style={{
            background: 'var(--bg-main)',
            border: '1px solid var(--border-color)',
            borderRadius: 20,
            width: '100%',
            maxWidth: 400,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
            overflow: 'hidden',
            textAlign: 'center',
            padding: '32px 24px',
            color: 'var(--text-main)'
          }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: customAlert.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: customAlert.type === 'success' ? 'var(--success)' : 'rgb(239, 68, 68)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              fontSize: '1.8rem',
              fontWeight: 'bold'
            }}>
              {customAlert.type === 'success' ? '✓' : '✗'}
            </div>
            
            <h4 style={{ margin: '0 0 8px', fontSize: '1.2rem', fontWeight: 900 }}>
              {customAlert.title}
            </h4>
            
            <p style={{ margin: '0 0 24px', fontSize: '0.9rem', color: 'var(--text-sec)', lineHeight: 1.5 }}>
              {customAlert.message}
            </p>
            
            <button 
              onClick={() => {
                setCustomAlert(null);
                if (customAlert.onClose) customAlert.onClose();
              }}
              style={{
                background: customAlert.type === 'success' ? 'var(--primary)' : 'rgb(239, 68, 68)',
                color: '#fff',
                border: 'none',
                width: '100%',
                padding: '12px',
                borderRadius: 12,
                cursor: 'pointer',
                fontWeight: 800,
                fontSize: '0.95rem'
              }}
            >
              Aceptar
            </button>
          </div>
        </div>
      )}

      {/* MODAL VISOR DE DESTINATARIOS */}
      {selectedCampanaRecipients && (
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
        }}>
          <div style={{
            background: 'var(--bg-main)',
            border: '1px solid var(--border-color)',
            borderRadius: 20,
            width: '100%',
            maxWidth: 500,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
            overflow: 'hidden',
            color: 'var(--text-main)'
          }}>
            <header style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(255,255,255,0.01)'
            }}>
              <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900 }}>Destinatarios del Comunicado</h4>
              <button 
                onClick={() => setSelectedCampanaRecipients(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-sec)',
                  fontSize: '1.2rem',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </header>
            <div style={{ padding: '24px', maxHeight: 300, overflowY: 'auto' }}>
              <div style={{ marginBottom: 16 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-sec)', display: 'block', marginBottom: 4 }}>
                  Tipo de Destinatario
                </span>
                <span style={{
                  background: 'var(--input-bg)',
                  color: 'var(--text-main)',
                  padding: '4px 10px',
                  borderRadius: 8,
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  display: 'inline-block'
                }}>
                  {selectedCampanaRecipients.destinatarios === 'clientes' && '👥 Todos los Clientes'}
                  {selectedCampanaRecipients.destinatarios === 'proveedores' && '👥 Todos los Proveedores'}
                  {selectedCampanaRecipients.destinatarios === 'manual' && '✏️ Manual'}
                  {selectedCampanaRecipients.destinatarios === 'prueba' && '🧪 Prueba'}
                </span>
              </div>
              
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-sec)', display: 'block', marginBottom: 6 }}>
                  Lista de Correos
                </span>
                {selectedCampanaRecipients.destinatarios === 'manual' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {(selectedCampanaRecipients.manual_emails || '').split(/[\n,;]/).map((email: string) => email.trim()).filter(Boolean).map((email: string, i: number) => (
                      <div key={i} style={{ fontSize: '0.85rem', fontWeight: 600, padding: '8px 12px', background: 'var(--input-bg)', borderRadius: 8 }}>
                        {email}
                      </div>
                    ))}
                  </div>
                ) : selectedCampanaRecipients.destinatarios === 'prueba' ? (
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, padding: '8px 12px', background: 'var(--input-bg)', borderRadius: 8 }}>
                    {selectedCampanaRecipients.asunto.includes('TEST') ? 'test-contador@prosperafinanzas.com (Enviado a destinatario de prueba)' : 'test-contador@prosperafinanzas.com'}
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-sec)', fontStyle: 'italic' }}>
                    Este comunicado fue enviado de forma masiva a todo el grupo seleccionado ({selectedCampanaRecipients.destinatarios === 'clientes' ? 'Clientes' : 'Proveedores'}).
                  </p>
                )}
              </div>
            </div>
            <footer style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'flex-end',
              background: 'rgba(255,255,255,0.01)'
            }}>
              <button 
                onClick={() => setSelectedCampanaRecipients(null)}
                style={{
                  background: 'var(--primary)',
                  color: '#fff',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  fontWeight: 800,
                  fontSize: '0.85rem'
                }}
              >
                Entendido
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
};
export default Comunicados;
