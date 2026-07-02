import React, { useState, useRef } from 'react';
import { XMLParser } from 'fast-xml-parser';
import { X, RefreshCw, Upload, Loader2, CheckCircle2, Info } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../services/supabase';

interface SyncXMLHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  empresaId: string;
}

interface SyncItem {
  id: string;
  file: File;
  claveAcceso: string;
  razonSocialEmisor: string;
  numeroComprobante: string;
  tipoDocumento: string;
  total: number;
  status: 'ready_to_sync' | 'not_registered' | 'error';
  errorMsg?: string;
}

const parseMiniXML = (xmlContent: string) => {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      parseTagValue: false,
      trimValues: true,
    });
    const jsonObj = parser.parse(xmlContent);
    let comprobante: any;
    let tipo = '';
    
    if (jsonObj.autorizacion && jsonObj.autorizacion.comprobante) {
      const comprobanteXML = jsonObj.autorizacion.comprobante;
      comprobante = typeof comprobanteXML === 'string' ? parser.parse(comprobanteXML) : comprobanteXML;
    } else {
      comprobante = jsonObj;
    }
    
    if (comprobante.factura) { comprobante = comprobante.factura; tipo = 'Factura'; }
    else if (comprobante.comprobanteRetencion) { comprobante = comprobante.comprobanteRetencion; tipo = 'Comprobante de Retención'; }
    else if (comprobante.notaCredito) { comprobante = comprobante.notaCredito; tipo = 'Nota de Crédito'; }
    
    if (!comprobante) return null;
    const infoT = comprobante.infoTributaria;
    const infoF = comprobante.infoFactura || comprobante.infoCompRetencion || comprobante.infoNotaCredito;
    
    if (!infoT || !infoF) return null;
    
    return {
      claveAcceso: infoT.claveAcceso?.toString() || jsonObj.autorizacion?.numeroAutorizacion?.toString() || '',
      razonSocialEmisor: infoT.razonSocial || '',
      numeroComprobante: `${infoT.estab || '001'}-${infoT.ptoEmi || '001'}-${infoT.secuencial || '000000001'}`,
      tipoDocumento: tipo,
      total: parseFloat(infoF.importeTotal || infoF.totalRetenido || infoF.valorModificacion || 0)
    };
  } catch {
    return null;
  }
};

export const SyncXMLHistoryModal: React.FC<SyncXMLHistoryModalProps> = ({
  isOpen,
  onClose,
  empresaId
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [syncItems, setSyncItems] = useState<SyncItem[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncFinished, setSyncFinished] = useState(false);
  const [syncStats, setSyncStats] = useState({ success: 0, failed: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const processFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setParsing(true);
    setSyncFinished(false);

    try {
      const parsedItems: any[] = [];
      
      // 1. Parse each file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          const text = await file.text();
          const parsed = parseMiniXML(text);
          if (parsed) {
            parsedItems.push({
              id: `${file.name}-${Date.now()}-${i}`,
              file,
              ...parsed,
              status: 'checking'
            });
          } else {
            parsedItems.push({
              id: `${file.name}-${Date.now()}-${i}`,
              file,
              claveAcceso: '',
              razonSocialEmisor: file.name,
              numeroComprobante: '—',
              tipoDocumento: 'Desconocido',
              total: 0,
              status: 'error',
              errorMsg: 'XML no posee estructura SRI válida.'
            });
          }
        } catch (err: any) {
          parsedItems.push({
            id: `${file.name}-${Date.now()}-${i}`,
            file,
            claveAcceso: '',
            razonSocialEmisor: file.name,
            numeroComprobante: '—',
            tipoDocumento: 'Desconocido',
            total: 0,
            status: 'error',
            errorMsg: err.message || 'Error al leer archivo.'
          });
        }
      }

      // 2. Query database to find which keys exist in documentos_sri
      const validKeys = parsedItems.filter(p => p.status === 'checking' && p.claveAcceso).map(p => p.claveAcceso);
      
      let existingKeys = new Set<string>();
      if (validKeys.length > 0) {
        const { data } = await supabase
          .from('documentos_sri')
          .select('clave_acceso_xml')
          .in('clave_acceso_xml', validKeys)
          .eq('id_empresa', empresaId);
        
        if (data) {
          existingKeys = new Set(data.map(d => d.clave_acceso_xml));
        }
      }

      // 3. Mark items status
      const finalItems = parsedItems.map(item => {
        if (item.status === 'error') return item;
        
        if (existingKeys.has(item.claveAcceso)) {
          return { ...item, status: 'ready_to_sync' };
        } else {
          return { 
            ...item, 
            status: 'not_registered', 
            errorMsg: 'No se encuentra registrado en tu contabilidad.' 
          };
        }
      });

      setSyncItems(finalItems as any);
    } catch (err) {
      console.error("Error processing files for sync:", err);
    } finally {
      setParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.xml'));
    processFiles(files);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(f => f.name.endsWith('.xml'));
    processFiles(files);
  };

  const handleStartSync = async () => {
    const itemsToSync = syncItems.filter(item => item.status === 'ready_to_sync');
    if (itemsToSync.length === 0) return;

    setSyncing(true);
    setSyncProgress(0);
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < itemsToSync.length; i++) {
      const item = itemsToSync[i];
      try {
        const storagePath = `${empresaId}/${item.claveAcceso}.xml`;
        const { error } = await supabase.storage
          .from('xml-documents')
          .upload(storagePath, item.file, {
            contentType: 'text/xml',
            upsert: true
          });
        
        if (error) throw error;
        successCount++;
      } catch (err) {
        console.error("Error syncing file:", item.file.name, err);
        failedCount++;
      }
      setSyncProgress(Math.round(((i + 1) / itemsToSync.length) * 100));
    }

    setSyncStats({ success: successCount, failed: failedCount });
    setSyncing(false);
    setSyncFinished(true);
  };

  const handleClear = () => {
    setSyncItems([]);
    setSyncFinished(false);
    setSyncProgress(0);
  };

  const syncableCount = syncItems.filter(item => item.status === 'ready_to_sync').length;
  const notRegisteredCount = syncItems.filter(item => item.status === 'not_registered').length;
  const errorCount = syncItems.filter(item => item.status === 'error').length;

  return (
    <div className="modal-overlay" style={{
      position: 'fixed',
      inset: 0,
      zIndex: 11000,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '750px',
          padding: 0,
          overflow: 'hidden',
          backgroundColor: 'rgba(11, 15, 25, 0.96)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '24px',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '85vh'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#0b0f19'
        }}>
          <h3 className="h1" style={{ fontSize: '1.25rem', margin: 0, display: 'flex', alignItems: 'center', gap: 10, fontWeight: 900, color: '#ffffff' }}>
            <RefreshCw className="text-primary animate-spin-slow" size={22} /> Sincronizar XMLs Históricos
          </h3>
          <button
            onClick={onClose}
            disabled={syncing}
            style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--text-sec)', cursor: 'pointer', padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center' }}
            title="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Loader de Análisis */}
        {parsing && (
          <div style={{ padding: '60px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <Loader2 className="animate-spin" style={{ color: 'var(--primary)', marginBottom: '16px' }} size={40} />
            <h4 style={{ color: '#ffffff', margin: '0 0 4px 0', fontSize: '0.95rem', fontWeight: 800 }}>Analizando archivos XML locales...</h4>
            <p style={{ color: 'var(--text-sec)', margin: 0, fontSize: '0.8rem' }}>Buscando coincidencias con documentos ya registrados en tu contabilidad...</p>
          </div>
        )}

        {/* Barra de progreso de sincronización */}
        {syncing && (
          <div style={{ padding: '60px 40px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <Loader2 className="animate-spin text-primary" style={{ marginBottom: '20px' }} size={44} />
            <h4 style={{ color: '#ffffff', margin: '0 0 16px 0', fontSize: '1.05rem', fontWeight: 800 }}>Respaldando XMLs en Supabase Storage...</h4>
            
            {/* Progress Bar Container */}
            <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '10px', overflow: 'hidden', marginBottom: '8px' }}>
              <div style={{ width: `${syncProgress}%`, height: '100%', backgroundColor: 'var(--primary)', transition: 'width 0.1s ease', borderRadius: '10px' }} />
            </div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-sec)', fontWeight: 'bold' }}>{syncProgress}% Completado</span>
          </div>
        )}

        {/* Cuerpo principal */}
        {!parsing && !syncing && (
          <div style={{ overflowY: 'auto', padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
            
            {/* Si no hay archivos cargados */}
            {syncItems.length === 0 && (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? 'var(--primary)' : 'rgba(255, 255, 255, 0.15)'}`,
                  borderRadius: '16px',
                  padding: '50px 20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  backgroundColor: dragOver ? 'rgba(99, 102, 241, 0.05)' : 'rgba(0, 0, 0, 0.15)',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  multiple
                  accept=".xml"
                  style={{ display: 'none' }}
                />
                <Upload size={36} className="text-sec" style={{ marginBottom: 16, opacity: 0.6 }} />
                <h4 style={{ color: '#ffffff', margin: '0 0 6px 0', fontSize: '0.95rem', fontWeight: 800 }}>Arrastra los archivos XML aquí</h4>
                <p style={{ color: 'var(--text-sec)', margin: '0 0 16px 0', fontSize: '0.8rem', maxWidth: '400px' }}>
                  Selecciona todos tus archivos XML históricos y el sistema los asociará automáticamente con tus registros contables.
                </p>
                <button className="btn btn-secondary" style={{ padding: '8px 20px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 700 }}>
                  Examinar archivos (.xml)
                </button>
              </div>
            )}

            {/* Si hay archivos procesados */}
            {syncItems.length > 0 && !syncFinished && (
              <>
                {/* Panel de Estadísticas rápidas */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                  <div style={{ padding: '12px 16px', backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.15)', borderRadius: '12px' }}>
                    <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#10b981', fontWeight: 900 }}>Sincronizables</span>
                    <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#ffffff', marginTop: '2px' }}>{syncableCount}</div>
                  </div>
                  <div style={{ padding: '12px 16px', backgroundColor: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.15)', borderRadius: '12px' }}>
                    <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#f59e0b', fontWeight: 900 }}>No Registrados</span>
                    <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#ffffff', marginTop: '2px' }}>{notRegisteredCount}</div>
                  </div>
                  <div style={{ padding: '12px 16px', backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '12px' }}>
                    <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#ef4444', fontWeight: 900 }}>Con Errores</span>
                    <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#ffffff', marginTop: '2px' }}>{errorCount}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', backgroundColor: 'rgba(99, 102, 241, 0.06)', border: '1px solid rgba(99, 102, 241, 0.15)', borderRadius: '10px', fontSize: '0.78rem', color: 'var(--text-sec)' }}>
                  <Info size={14} className="text-primary" />
                  <span>
                    Solo se sincronizarán los XMLs clasificados como <strong>Sincronizables</strong>. Los XMLs no registrados en contabilidad se omiten para evitar descuadres.
                  </span>
                </div>

                {/* Listado de archivos procesados */}
                <div className="custom-scrollbar" style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden', flex: 1, maxHeight: '250px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-sec)', fontWeight: 'bold' }}>
                        <th style={{ padding: '8px 12px' }}>Archivo</th>
                        <th style={{ padding: '8px 12px' }}>Tipo</th>
                        <th style={{ padding: '8px 12px' }}>Emisor</th>
                        <th style={{ padding: '8px 12px' }}>Comprobante</th>
                        <th style={{ padding: '8px 12px' }}>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {syncItems.map((item) => {
                        let statusColor = '#10b981';
                        let statusText = 'Listo';
                        if (item.status === 'not_registered') {
                          statusColor = '#f59e0b';
                          statusText = 'Omitido';
                        } else if (item.status === 'error') {
                          statusColor = '#ef4444';
                          statusText = 'Error';
                        }
                        
                        return (
                          <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <td style={{ padding: '8px 12px', fontWeight: 'bold', color: '#ffffff', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.file.name}>
                              {item.file.name}
                            </td>
                            <td style={{ padding: '8px 12px', color: 'var(--text-sec)' }}>{item.tipoDocumento}</td>
                            <td style={{ padding: '8px 12px', color: 'var(--text-sec)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.razonSocialEmisor}>
                              {item.razonSocialEmisor}
                            </td>
                            <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{item.numeroComprobante}</td>
                            <td style={{ padding: '8px 12px' }} title={item.errorMsg}>
                              <span style={{ color: statusColor, fontWeight: 'bold' }}>{statusText}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* Si ha finalizado la sincronización */}
            {syncFinished && (
              <div style={{ textAlign: 'center', padding: '20px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle2 size={36} />
                </div>
                <div>
                  <h4 style={{ color: '#ffffff', fontSize: '1.2rem', fontWeight: 800, margin: '0 0 6px 0' }}>¡Sincronización Finalizada!</h4>
                  <p style={{ color: 'var(--text-sec)', fontSize: '0.85rem', margin: 0, maxWidth: '400px' }}>
                    El proceso de sincronización de documentos XML históricos ha terminado con éxito.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 24, padding: '16px 32px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-sec)', fontWeight: 'bold' }}>Sincronizados</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#10b981' }}>{syncStats.success}</div>
                  </div>
                  <div style={{ width: '1px', backgroundColor: 'var(--border-color)' }} />
                  <div>
                    <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-sec)', fontWeight: 'bold' }}>Fallidos</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#ef4444' }}>{syncStats.failed}</div>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
          backgroundColor: '#0c101b'
        }}>
          {syncItems.length > 0 && !syncFinished && !syncing && (
            <button
              onClick={handleClear}
              className="btn btn-secondary"
              style={{ padding: '8px 20px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 700, border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.03)' }}
            >
              Limpiar lote
            </button>
          )}
          <button
            onClick={onClose}
            disabled={syncing}
            className="btn btn-secondary"
            style={{ padding: '8px 20px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 700, border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.03)' }}
          >
            {syncFinished ? 'Cerrar' : 'Cancelar'}
          </button>
          {syncableCount > 0 && !syncFinished && !syncing && (
            <button
              onClick={handleStartSync}
              className="btn btn-primary"
              style={{ padding: '8px 24px', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 700 }}
            >
              Iniciar Sincronización ({syncableCount})
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};
