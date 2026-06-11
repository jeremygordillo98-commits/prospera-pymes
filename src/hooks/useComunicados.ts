import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { TEMPLATE_PRESETS } from '../utils/comunicadoPresets';

const supabaseB2C = createClient(
  'https://brlqdlnbebtmtmyodxgy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJybHFkbG5iZWJ0bXRteW9keGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNTY4OTQsImV4cCI6MjA4MzYzMjg5NH0.ZKOZNkkpsrQXCCw82ZFJHkBmQX8nho9V7KdxDoZERIo'
);

export interface CampanaPymes {
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

export const useComunicados = (empresaId: string) => {
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

  // Build HTML Email Template
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

      if (!esBorrador) {
        setSendingProgress({ current: 0, total: listadoDest.length });
        let errorsCount = 0;

        const scheduledTime = (form.programado && form.scheduledDate) 
          ? new Date(form.scheduledDate).toISOString() 
          : undefined;

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

  return {
    fileInputRef,
    empresaInfo,
    isWorkspaceOpen,
    setIsWorkspaceOpen,
    activePreset,
    setActivePreset,
    filesList,
    filesBase64,
    previewHtml,
    sending,
    sendingProgress,
    selectedCampanaRecipients,
    setSelectedCampanaRecipients,
    customAlert,
    setCustomAlert,
    form,
    setForm,
    listado,
    loadingList,
    handleFileChange,
    removeFile,
    resetForm,
    handleSend,
    handleCancelScheduled,
    handleEditScheduled,
    deleteRecord,
    loadDraft,
    sizeLimitExceeded,
    totalAttachmentsSize
  };
};
