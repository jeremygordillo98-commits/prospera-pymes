import React, { useState, useRef, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { Upload, Loader2, Image as ImageIcon, Trash2, X, ZoomIn } from 'lucide-react';
import Cropper from 'react-easy-crop';
import { motion, AnimatePresence } from 'framer-motion';

// --- Funciones auxiliares para el recorte ---
const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

const getCroppedImg = async (imageSrc: string, pixelCrop: any): Promise<Blob | null> => {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) return null;

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  // Llenar con fondo blanco por si la imagen tiene transparencia
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  // Redimensionar si es muy grande (máximo 400x400 para un logo)
  const MAX_SIZE = 400;
  if (canvas.width > MAX_SIZE) {
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = MAX_SIZE;
      finalCanvas.height = MAX_SIZE;
      const finalCtx = finalCanvas.getContext('2d');
      if (finalCtx) {
          finalCtx.fillStyle = '#FFFFFF';
          finalCtx.fillRect(0,0,MAX_SIZE,MAX_SIZE);
          finalCtx.drawImage(canvas, 0, 0, MAX_SIZE, MAX_SIZE);
          return new Promise((resolve) => finalCanvas.toBlob((blob) => resolve(blob), 'image/webp', 0.8));
      }
  }

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.8);
  });
};

interface ImageUploaderProps {
    storagePath: string;
    currentLogoUrl?: string | null;
    onUploadSuccess: (url: string) => void;
    onRemove?: () => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ storagePath, currentLogoUrl, onUploadSuccess, onRemove }) => {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Estados del Cropper
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setError('Por favor, selecciona una imagen válida.');
            return;
        }

        setError('');
        
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            setSelectedImage(reader.result as string);
        };
        reader.onerror = () => {
            setError('Error al leer el archivo.');
        };
    };

    const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleSaveCrop = async () => {
        if (!selectedImage || !croppedAreaPixels) return;

        setUploading(true);
        setError('');

        try {
            const blob = await getCroppedImg(selectedImage, croppedAreaPixels);
            if (!blob) throw new Error("No se pudo recortar la imagen.");

            const { error: uploadError } = await supabase.storage
                .from('logos')
                .upload(storagePath, blob, {
                    contentType: 'image/webp',
                    upsert: true,
                    cacheControl: '3600'
                });

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('logos').getPublicUrl(storagePath);
            const urlWithTimestamp = `${data.publicUrl}?t=${new Date().getTime()}`;
            
            onUploadSuccess(urlWithTimestamp);
            setSelectedImage(null); // Cerrar modal
        } catch (err: any) {
            setError('Error al subir imagen: ' + err.message);
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    padding: 16,
                    borderRadius: 16,
                    border: `1px solid var(--border-color)`,
                    background: 'var(--bg-card)'
                }}>
                    <div style={{
                        width: 60,
                        height: 60,
                        borderRadius: 12,
                        background: currentLogoUrl ? '#fff' : 'var(--input-bg)',
                        border: `1px dashed ${currentLogoUrl ? 'transparent' : 'var(--border-color)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        flexShrink: 0,
                        boxShadow: currentLogoUrl ? '0 2px 10px rgba(0,0,0,0.05)' : 'none'
                    }}>
                        {currentLogoUrl ? (
                            <img src={currentLogoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        ) : (
                            <ImageIcon size={24} color="var(--text-sec)" opacity={0.5} />
                        )}
                    </div>

                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                className="btn"
                                style={{
                                    padding: '8px 14px',
                                    fontSize: '0.8rem',
                                    background: 'rgba(99, 102, 241, 0.15)',
                                    color: 'var(--primary)',
                                    border: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6
                                }}
                            >
                                <Upload size={16} />
                                {currentLogoUrl ? 'Cambiar Logo' : 'Subir Logo'}
                            </button>

                            {currentLogoUrl && onRemove && (
                                <button
                                    type="button"
                                    onClick={onRemove}
                                    disabled={uploading}
                                    className="btn"
                                    style={{
                                        padding: '8px 14px',
                                        fontSize: '0.8rem',
                                        background: 'transparent',
                                        color: 'var(--error)',
                                        border: `1px solid rgba(239, 68, 68, 0.4)`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6
                                    }}
                                >
                                    <Trash2 size={16} /> Quitar
                                </button>
                            )}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-sec)', marginTop: 6 }}>
                            Podrás recortarla y centrarla. Se comprimirá para pesar menos de 50KB.
                        </div>
                    </div>
                </div>

                {error && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--error)', background: 'rgba(239, 68, 68, 0.1)', padding: 8, borderRadius: 8 }}>
                        {error}
                    </div>
                )}

                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/png, image/jpeg, image/jpg"
                    style={{ display: 'none' }}
                />
            </div>

            {/* Modal de Recorte (Cropper) */}
            <AnimatePresence>
                {selectedImage && (
                    <div className="modal-overlay" style={{ zIndex: 1000 }}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="glass-card"
                            style={{ width: '90%', maxWidth: '500px', padding: 0, overflow: 'hidden' }}
                        >
                            <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)' }}>
                                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Centrar Logo</h3>
                                <button onClick={() => setSelectedImage(null)} style={{ background: 'none', border: 'none', color: 'var(--text-sec)', cursor: 'pointer' }}>
                                    <X size={20} />
                                </button>
                            </div>
                            
                            <div style={{ position: 'relative', width: '100%', height: '350px', background: '#1a1a2e' }}>
                                <Cropper
                                    image={selectedImage}
                                    crop={crop}
                                    zoom={zoom}
                                    aspect={1} // Cuadrado perfecto
                                    onCropChange={setCrop}
                                    onCropComplete={onCropComplete}
                                    onZoomChange={setZoom}
                                    objectFit="contain"
                                    cropShape="rect" // O "round" si prefieres
                                />
                            </div>

                            <div style={{ padding: '20px', background: 'var(--bg-card)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                                    <ZoomIn size={18} color="var(--text-sec)" />
                                    <input
                                        type="range"
                                        value={zoom}
                                        min={1}
                                        max={3}
                                        step={0.1}
                                        aria-labelledby="Zoom"
                                        onChange={(e) => setZoom(Number(e.target.value))}
                                        style={{ flex: 1 }}
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: 12 }}>
                                    <button 
                                        className="btn flex-1" 
                                        onClick={() => setSelectedImage(null)}
                                        disabled={uploading}
                                    >
                                        Cancelar
                                    </button>
                                    <button 
                                        className="btn btn-primary flex-1" 
                                        onClick={handleSaveCrop}
                                        disabled={uploading}
                                    >
                                        {uploading ? (
                                            <><Loader2 size={16} className="animate-spin" /> Guardando...</>
                                        ) : (
                                            'Recortar y Guardar'
                                        )}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
};
