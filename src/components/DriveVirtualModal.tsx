import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Upload, 
  FileText, 
  Download, 
  Trash2, 
  HardDrive, 
  CheckCircle2, 
  FileSpreadsheet, 
  FileArchive, 
  FileCode, 
  AlertCircle, 
  Loader2, 
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../services/supabase';
import { 
  uploadFileToR2, 
  getFileDownloadUrl, 
  deleteFileFromR2, 
  isR2Configured, 
  type R2FileItem 
} from '../services/r2Storage';

interface DriveVirtualModalProps {
  isOpen: boolean;
  onClose: () => void;
  empresaId: string;
}

export const DriveVirtualModal: React.FC<DriveVirtualModalProps> = ({ isOpen, onClose, empresaId }) => {
  const [files, setFiles] = useState<R2FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadCategory, setUploadCategory] = useState<string>('documento');
  const [dragActive, setDragActive] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const r2Connected = isR2Configured();

  // Cargar archivos de la BD / LocalStorage para la empresa activa
  const fetchFiles = async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('archivos_drive_virtual')
        .select('*')
        .eq('id_empresa', empresaId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setFiles(data);
      } else {
        const localKey = `drive_files_${empresaId}`;
        const saved = localStorage.getItem(localKey);
        if (saved) {
          try { setFiles(JSON.parse(saved)); } catch (e) {}
        }
      }
    } catch (e) {
      console.warn('[DriveVirtual] Usando caché local para archivos.');
      const localKey = `drive_files_${empresaId}`;
      const saved = localStorage.getItem(localKey);
      if (saved) {
        try { setFiles(JSON.parse(saved)); } catch (err) {}
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && empresaId) {
      fetchFiles();
    }
  }, [isOpen, empresaId]);

  // Guardar copia local de metadatos en LocalStorage por persistencia
  const saveLocalFiles = (newFiles: R2FileItem[]) => {
    setFiles(newFiles);
    if (empresaId) {
      localStorage.setItem(`drive_files_${empresaId}`, JSON.stringify(newFiles));
    }
  };

  const showNotify = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3500);
  };

  const handleUploadFile = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || !empresaId) return;
    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const uploadedItems: R2FileItem[] = [];

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const res = await uploadFileToR2(file, empresaId, uploadCategory);

        const newItem: R2FileItem = {
          id: crypto.randomUUID(),
          id_empresa: empresaId,
          nombre_archivo: res.name,
          ruta_r2: res.ruta,
          tamanio_bytes: res.size,
          mime_type: res.mime,
          categoria: uploadCategory,
          subido_por: user?.id,
          created_at: new Date().toISOString(),
        };

        const { error: dbErr } = await supabase
          .from('archivos_drive_virtual')
          .insert(newItem);

        if (dbErr) {
          console.warn('[DriveVirtual] Nota guardando en BD (se conserva en cache local):', dbErr.message);
        }

        uploadedItems.push(newItem);
      }

      const updated = [...uploadedItems, ...files];
      saveLocalFiles(updated);
      showNotify('success', `${uploadedItems.length} archivo(s) subido(s) a Cloudflare R2 con éxito.`);
    } catch (err: any) {
      showNotify('error', `Error al subir archivo: ${err.message || 'Intente nuevamente'}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownload = async (fileItem: R2FileItem) => {
    try {
      const url = await getFileDownloadUrl(fileItem.ruta_r2);
      if (url.startsWith('#demo')) {
        showNotify('success', `[Modo Demo] Descarga simulada de: ${fileItem.nombre_archivo}`);
      } else {
        window.open(url, '_blank');
      }
    } catch (e) {
      showNotify('error', 'Error al obtener la URL de descarga.');
    }
  };

  const handleDelete = async (fileItem: R2FileItem) => {
    if (!confirm(`¿Estás seguro de eliminar "${fileItem.nombre_archivo}" del Drive Virtual?`)) return;

    try {
      await deleteFileFromR2(fileItem.ruta_r2);
      await supabase.from('archivos_drive_virtual').delete().eq('id', fileItem.id);

      const updated = files.filter(f => f.id !== fileItem.id);
      saveLocalFiles(updated);
      showNotify('success', 'Archivo eliminado del Drive Virtual.');
    } catch (e) {
      showNotify('error', 'Error eliminando el archivo.');
    }
  };

  // Cálculo de espacio total ocupado
  const totalBytes = files.reduce((acc, f) => acc + (f.tamanio_bytes || 0), 0);
  const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);
  const maxGB = 10;
  const usedPct = Math.min(100, (totalBytes / (10 * 1024 * 1024 * 1024)) * 100).toFixed(3);

  // Filtrado
  const filteredFiles = files.filter(f => {
    const matchCat = selectedCategory === 'todos' || f.categoria === selectedCategory;
    const matchSearch = f.nombre_archivo.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCat && matchSearch;
  });

  const getFileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    if (ext === 'pdf') return <FileText size={20} className="text-red-400" />;
    if (['xlsx', 'xls', 'csv'].includes(ext)) return <FileSpreadsheet size={20} className="text-emerald-400" />;
    if (['zip', 'rar', '7z'].includes(ext)) return <FileArchive size={20} className="text-amber-400" />;
    if (['xml', 'json'].includes(ext)) return <FileCode size={20} className="text-cyan-400" />;
    return <FileText size={20} className="text-indigo-400" />;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          style={{
            width: '100%', maxWidth: '900px', maxHeight: '90vh',
            background: 'var(--card-bg, #111827)',
            border: '1px solid var(--border-color, rgba(255,255,255,0.15))',
            borderRadius: '20px', display: 'flex', flexDirection: 'column',
            overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
          }}
        >
          {/* Header */}
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.1))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: 42, height: 42, borderRadius: '12px', background: 'rgba(0, 214, 143, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary, #00D68F)' }}>
                <HardDrive size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-main, #fff)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Drive Virtual R2 — Archivo Digital
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: 'var(--text-sec, #9CA3AF)', marginTop: '2px' }}>
                  <span>Almacenamiento Ilimitado Cloudflare R2 ($0 Costos de Ancho de Banda)</span>
                  <span 
                    style={{
                      padding: '2px 8px', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700,
                      background: r2Connected ? 'rgba(0,214,143,0.2)' : 'rgba(245,158,11,0.2)',
                      color: r2Connected ? '#00D68F' : '#F59E0B',
                      border: `1px solid ${r2Connected ? '#00D68F' : '#F59E0B'}`
                    }}
                  >
                    {r2Connected ? '🟢 R2 Conectado' : '🟡 Modo Simulación R2'}
                  </span>
                </div>
              </div>
            </div>
            <button 
              onClick={onClose}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-sec, #9CA3AF)', cursor: 'pointer', padding: '6px', borderRadius: '8px' }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Barra de Consumo de Espacio R2 */}
          <div style={{ padding: '12px 24px', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.05))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700, marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-sec, #9CA3AF)' }}>Uso del Drive de la Empresa:</span>
                <span style={{ color: 'var(--primary, #00D68F)' }}>{totalMB} MB / {maxGB} GB Gratis Cloudflare ({usedPct}%)</span>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.max(1, Number(usedPct))}%`, background: 'var(--primary, #00D68F)', borderRadius: 999, transition: 'width 0.3s' }} />
              </div>
            </div>
          </div>

          {/* Notificaciones flotantes */}
          {notification && (
            <div 
              style={{
                padding: '10px 20px',
                background: notification.type === 'success' ? 'rgba(0,214,143,0.15)' : 'rgba(239,68,68,0.15)',
                color: notification.type === 'success' ? '#00D68F' : '#EF4444',
                borderBottom: '1px solid',
                borderColor: notification.type === 'success' ? '#00D68F' : '#EF4444',
                fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px'
              }}
            >
              {notification.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{notification.message}</span>
            </div>
          )}

          {/* Zona de Carga (Drag & Drop) */}
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.08))' }}>
            <div 
              onDragOver={e => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={e => { e.preventDefault(); setDragActive(false); handleUploadFile(e.dataTransfer.files); }}
              style={{
                border: dragActive ? '2px dashed var(--primary, #00D68F)' : '2px dashed rgba(255,255,255,0.2)',
                borderRadius: '16px', padding: '20px', textAlign: 'center',
                background: dragActive ? 'rgba(0,214,143,0.05)' : 'rgba(0,0,0,0.15)',
                transition: 'all 0.2s', cursor: 'pointer'
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={e => handleUploadFile(e.target.files)} 
                style={{ display: 'none' }} 
                multiple
              />
              
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                {uploading ? (
                  <Loader2 size={32} className="animate-spin text-primary" style={{ color: 'var(--primary, #00D68F)' }} />
                ) : (
                  <Upload size={32} style={{ color: 'var(--primary, #00D68F)' }} />
                )}
                <div>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main, #fff)' }}>
                    {uploading ? 'Subiendo archivos a Cloudflare R2...' : 'Arrastra tus archivos aquí o haz clic para examinar'}
                  </span>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: 'var(--text-sec, #9CA3AF)' }}>
                    Soporta PDFs, Excels, XMLs, ZIPs e imágenes sin límite de tamaño.
                  </p>
                </div>
              </div>
            </div>

            {/* Selector de categoría para la subida */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px', justifyContent: 'flex-end' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-sec, #9CA3AF)', fontWeight: 600 }}>Categoría al subir:</span>
              <select
                value={uploadCategory}
                onChange={e => setUploadCategory(e.target.value)}
                style={{
                  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)',
                  color: 'var(--text-main, #fff)', borderRadius: '8px', padding: '4px 10px',
                  fontSize: '0.82rem', fontWeight: 600, outline: 'none'
                }}
              >
                <option value="documento">📄 Documento General</option>
                <option value="respaldo">📦 Respaldo ZIP</option>
                <option value="xml">📊 Comprobante XML / ATS</option>
                <option value="factura">🧾 Factura / RIDE</option>
              </select>
            </div>
          </div>

          {/* Filtros y Buscador */}
          <div style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            {/* Categorías */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {['todos', 'documento', 'respaldo', 'xml', 'factura'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    padding: '5px 12px', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 700,
                    border: '1px solid',
                    borderColor: selectedCategory === cat ? 'var(--primary, #00D68F)' : 'rgba(255,255,255,0.15)',
                    background: selectedCategory === cat ? 'rgba(0,214,143,0.15)' : 'transparent',
                    color: selectedCategory === cat ? 'var(--primary, #00D68F)' : 'var(--text-sec, #9CA3AF)',
                    cursor: 'pointer', textTransform: 'capitalize'
                  }}
                >
                  {cat === 'todos' ? '🌐 Todos los Archivos' : cat}
                </button>
              ))}
            </div>

            {/* Buscador */}
            <div style={{ position: 'relative', minWidth: '220px' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: 'var(--text-sec, #9CA3AF)' }} />
              <input
                type="text"
                placeholder="Buscar archivo..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{
                  width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.15)',
                  color: 'var(--text-main, #fff)', borderRadius: '8px', padding: '6px 12px 6px 30px',
                  fontSize: '0.82rem', outline: 'none'
                }}
              />
            </div>
          </div>

          {/* Lista de Archivos */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 20px 24px' }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                <Loader2 size={28} className="animate-spin text-primary" style={{ color: 'var(--primary, #00D68F)' }} />
              </div>
            ) : filteredFiles.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-sec, #9CA3AF)', fontSize: '0.85rem' }}>
                <HardDrive size={36} style={{ margin: '0 auto 12px auto', opacity: 0.4 }} />
                <p>No se encontraron archivos en el Drive Virtual.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filteredFiles.map(file => (
                  <div
                    key={file.id}
                    style={{
                      padding: '12px 16px', borderRadius: '12px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      gap: '12px', transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                      {getFileIcon(file.nombre_archivo)}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main, #fff)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {file.nombre_archivo}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.75rem', color: 'var(--text-sec, #9CA3AF)', marginTop: '2px' }}>
                          <span>{(file.tamanio_bytes / 1024).toFixed(1)} KB</span>
                          <span>•</span>
                          <span style={{ textTransform: 'capitalize' }}>{file.categoria}</span>
                          <span>•</span>
                          <span>{new Date(file.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        onClick={() => handleDownload(file)}
                        title="Descargar desde R2"
                        style={{
                          padding: '6px 12px', borderRadius: '8px',
                          background: 'rgba(0, 214, 143, 0.12)', color: 'var(--primary, #00D68F)',
                          border: '1px solid rgba(0, 214, 143, 0.3)', fontWeight: 700,
                          fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                        }}
                      >
                        <Download size={14} /> Descargar
                      </button>
                      <button
                        onClick={() => handleDelete(file)}
                        title="Eliminar de R2"
                        style={{
                          padding: '6px', borderRadius: '8px',
                          background: 'rgba(239, 68, 68, 0.12)', color: '#EF4444',
                          border: '1px solid rgba(239, 68, 68, 0.3)', cursor: 'pointer'
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
