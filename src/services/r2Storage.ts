import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

// Configuración R2 desde variables de entorno
const R2_ACCOUNT_ID = import.meta.env.VITE_R2_ACCOUNT_ID || '';
const R2_ACCESS_KEY_ID = import.meta.env.VITE_R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = import.meta.env.VITE_R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET_NAME = import.meta.env.VITE_R2_BUCKET_NAME || 'prospera-drive-virtual';
const R2_PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL || '';

export interface R2FileItem {
  id: string;
  id_empresa: string;
  nombre_archivo: string;
  ruta_r2: string;
  tamanio_bytes: number;
  mime_type: string;
  categoria: 'respaldo' | 'xml' | 'factura' | 'documento' | string;
  subido_por?: string;
  created_at: string;
  url_descarga?: string;
}

let s3Client: S3Client | null = null;

function getS3Client(): S3Client | null {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    return null;
  }
  if (!s3Client) {
    s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return s3Client;
}

export function isR2Configured(): boolean {
  return Boolean(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY);
}

/**
 * Sube un archivo a Cloudflare R2. Si no hay claves en .env, simula el almacenamiento.
 */
export async function uploadFileToR2(
  file: File,
  empresaId: string,
  categoria: string = 'documento'
): Promise<{ ruta: string; size: number; mime: string; name: string }> {
  const timeStamp = Date.now();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const objectKey = `${empresaId}/${categoria}/${timeStamp}_${sanitizedName}`;

  const client = getS3Client();

  if (client) {
    const arrayBuffer = await file.arrayBuffer();
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: objectKey,
      Body: new Uint8Array(arrayBuffer),
      ContentType: file.type || 'application/octet-stream',
    });
    await client.send(command);
  } else {
    // Simulación suave cuando R2 no tiene keys cargadas en el entorno
    console.info('[R2Storage] R2 keys no detectadas en .env. Modo Simulación activo para:', objectKey);
    await new Promise((resolve) => setTimeout(resolve, 800));
  }

  return {
    ruta: objectKey,
    size: file.size,
    mime: file.type || 'application/octet-stream',
    name: file.name,
  };
}

/**
 * Obtiene la URL pública o directa de descarga desde R2
 */
export async function getFileDownloadUrl(objectKey: string): Promise<string> {
  if (R2_PUBLIC_URL) {
    return `${R2_PUBLIC_URL.replace(/\/$/, '')}/${objectKey}`;
  }

  if (R2_ACCOUNT_ID && R2_BUCKET_NAME) {
    return `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}/${objectKey}`;
  }

  // Fallback demo
  return `#demo-r2-download-${encodeURIComponent(objectKey)}`;
}

/**
 * Elimina un objeto de Cloudflare R2
 */
export async function deleteFileFromR2(objectKey: string): Promise<boolean> {
  const client = getS3Client();
  if (client) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: objectKey,
      });
      await client.send(command);
      return true;
    } catch (e) {
      console.error('[R2Storage] Error eliminando objeto en R2:', e);
      return false;
    }
  }
  return true;
}
