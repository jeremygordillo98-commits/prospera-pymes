import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2 } from 'lucide-react';
import { ImageUploader } from './ImageUploader';

interface Company {
  id: string;
  nombre_empresa: string;
  ruc_empresa: string;
  logo_url?: string | null;
}

// 1. CompanyCreateModal
interface CompanyCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  newEmpresaName: string;
  setNewEmpresaName: (v: string) => void;
  newEmpresaRuc: string;
  setNewEmpresaRuc: (v: string) => void;
  newEmpresaLogo: string;
  setNewEmpresaLogo: (v: string) => void;
  newEmpresaId: string;
  onCreate: () => void;
}

export const CompanyCreateModal: React.FC<CompanyCreateModalProps> = ({
  isOpen,
  onClose,
  newEmpresaName,
  setNewEmpresaName,
  newEmpresaRuc,
  setNewEmpresaRuc,
  newEmpresaLogo,
  setNewEmpresaLogo,
  newEmpresaId,
  onCreate
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="modal-overlay" style={{ zIndex: 200 }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card"
            style={{ width: '90%', maxWidth: '400px', padding: '32px' }}
          >
            <h3>Nuevo Cliente Contable</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px', marginTop: '24px' }}>
              <input
                autoFocus
                type="text"
                placeholder="Nombre de la empresa *"
                value={newEmpresaName}
                onChange={(e) => setNewEmpresaName(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}
              />
              <input
                type="text"
                placeholder="RUC o Identificación"
                value={newEmpresaRuc}
                onChange={(e) => setNewEmpresaRuc(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}
              />
              <ImageUploader
                storagePath={`empresas/empresa_${newEmpresaId}.webp`}
                currentLogoUrl={newEmpresaLogo}
                onUploadSuccess={(url: string) => setNewEmpresaLogo(url)}
                onRemove={() => setNewEmpresaLogo('')}
              />
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn flex-1" onClick={onClose}>Cancelar</button>
              <button className="btn btn-primary flex-1" onClick={onCreate}>Crear Empresa</button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// 2. CompanyLimitModal
interface CompanyLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CompanyLimitModal: React.FC<CompanyLimitModalProps> = ({ isOpen, onClose }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="modal-overlay" style={{ zIndex: 300 }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card"
            style={{ width: '90%', maxWidth: '450px', padding: '40px', textAlign: 'center' }}
          >
            <div style={{ width: 64, height: 64, background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <Building2 size={32} />
            </div>
            <h3>Límite Alcanzado</h3>
            <p className="text-sec" style={{ marginBottom: '32px' }}>Contacta a soporte para ampliar el límite.</p>
            <button className="btn btn-primary w-full" onClick={onClose}>Entendido</button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// 3. CompanyEditModal
interface CompanyEditModalProps {
  editingEmpresa: Company | null;
  onClose: () => void;
  editForm: { nombre_empresa: string; ruc_empresa: string; logo_url: string };
  setEditForm: React.Dispatch<React.SetStateAction<any>>;
  onSave: () => void;
  savingEdit: boolean;
}

export const CompanyEditModal: React.FC<CompanyEditModalProps> = ({
  editingEmpresa,
  onClose,
  editForm,
  setEditForm,
  onSave,
  savingEdit
}) => {
  return (
    <AnimatePresence>
      {editingEmpresa && (
        <div className="modal-overlay" style={{ zIndex: 300 }}>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="glass-card" style={{ width: '90%', maxWidth: '420px', padding: '32px' }}>
            <h3 style={{ marginTop: 0, marginBottom: 24 }}>✏️ Editar Empresa</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              <input autoFocus type="text" placeholder="Nombre de la empresa *" value={editForm.nombre_empresa} onChange={e => setEditForm({ ...editForm, nombre_empresa: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }} />
              <input type="text" placeholder="RUC o Identificación" value={editForm.ruc_empresa} onChange={e => setEditForm({ ...editForm, ruc_empresa: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'var(--input-bg)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }} />
              <ImageUploader
                storagePath={`empresas/empresa_${editingEmpresa.id}.webp`}
                currentLogoUrl={editForm.logo_url}
                onUploadSuccess={(url: string) => setEditForm({ ...editForm, logo_url: url })}
                onRemove={() => setEditForm({ ...editForm, logo_url: '' })}
              />
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn flex-1" onClick={onClose}>Cancelar</button>
              <button className="btn btn-primary flex-1" onClick={onSave} disabled={savingEdit}>{savingEdit ? 'Guardando...' : 'Guardar Cambios'}</button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// 4. CompanyDeleteConfirmModal
interface CompanyDeleteConfirmModalProps {
  showArchiveConfirm: Company | null;
  onClose: () => void;
  archiveStep: number;
  setArchiveStep: (step: number) => void;
  archiveConfirmEmail: string;
  setArchiveConfirmEmail: (email: string) => void;
  onSubmit: (emp: Company) => void;
  submittingArchive: boolean;
}

export const CompanyDeleteConfirmModal: React.FC<CompanyDeleteConfirmModalProps> = ({
  showArchiveConfirm,
  onClose,
  archiveStep,
  setArchiveStep,
  archiveConfirmEmail,
  setArchiveConfirmEmail,
  onSubmit,
  submittingArchive
}) => {
  return (
    <AnimatePresence>
      {showArchiveConfirm && (
        <div className="modal-overlay" style={{ zIndex: 300 }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card" style={{ width: '90%', maxWidth: '420px', padding: '40px', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, background: 'rgba(239,68,68,0.1)', color: 'var(--error)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '2rem' }}>🗑️</div>
            <h3 style={{ color: 'var(--error)', marginTop: 0 }}>Eliminación Segura</h3>
            
            {archiveStep === 1 ? (
              <>
                <p style={{ color: 'var(--text-sec)', marginBottom: '28px', fontSize: '0.9rem', lineHeight: '1.5', textAlign: 'left' }}>
                  Estás por solicitar la eliminación completa de <strong>«{showArchiveConfirm.nombre_empresa}»</strong>.<br /><br />
                  <span style={{ display: 'block', background: 'rgba(239,68,68,0.05)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.1)', fontSize: '0.82rem' }}>
                    ⚠️ <strong>Proceso de Respaldo:</strong> El administrador procesará tu solicitud y compilará un respaldo ZIP completo de tus datos contables en Excel (.xlsx) y los enviará a tu correo. Tras el envío del respaldo, todos los datos de la empresa serán borrados de forma permanente.
                  </span>
                </p>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button className="btn flex-1" onClick={onClose}>Cancelar</button>
                  <button className="btn btn-primary flex-1" onClick={() => setArchiveStep(2)}>Entendido, Continuar</button>
                </div>
              </>
            ) : (
              <>
                <p style={{ color: 'var(--text-sec)', marginBottom: '20px', fontSize: '0.88rem', lineHeight: '1.4' }}>
                  Por favor confirma ingresando el correo electrónico donde deseas recibir el respaldo ZIP de los datos:
                </p>
                <input
                  type="email"
                  placeholder="ejemplo@correo.com"
                  value={archiveConfirmEmail}
                  onChange={(e) => setArchiveConfirmEmail(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '10px',
                    background: 'var(--input-bg)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-main)',
                    marginBottom: '24px',
                    fontSize: '0.9rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button className="btn flex-1" onClick={() => setArchiveStep(1)} disabled={submittingArchive}>Atrás</button>
                  <button 
                    className="btn flex-1" 
                    style={{ background: 'var(--error)', color: '#fff', border: 'none', opacity: submittingArchive ? 0.7 : 1 }} 
                    onClick={() => onSubmit(showArchiveConfirm)}
                    disabled={submittingArchive}
                  >
                    {submittingArchive ? 'Registrando...' : 'Solicitar Baja'}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// 5. CompanyResetConfirmModal
interface CompanyResetConfirmModalProps {
  showResetConfirm: Company | null;
  onClose: () => void;
  onSubmit: (emp: Company) => void;
  resettingEmpresa: boolean;
}

export const CompanyResetConfirmModal: React.FC<CompanyResetConfirmModalProps> = ({
  showResetConfirm,
  onClose,
  onSubmit,
  resettingEmpresa
}) => {
  return (
    <AnimatePresence>
      {showResetConfirm && (
        <div className="modal-overlay" style={{ zIndex: 300 }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card" style={{ width: '90%', maxWidth: '420px', padding: '40px', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, background: 'rgba(245,158,11,0.1)', color: '#F59E0B', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '2rem' }}>⚠️</div>
            <h3 style={{ color: '#F59E0B', marginTop: 0 }}>Resetear Empresa</h3>
            <p style={{ color: 'var(--text-sec)', marginBottom: '28px', fontSize: '0.9rem', lineHeight: '1.4' }}>
              ¿Estás seguro de que deseas resetear los datos de <strong>«{showResetConfirm.nombre_empresa}»</strong>?<br /><br />
              <span style={{ fontSize: '0.82rem', display: 'block', background: 'rgba(245,158,11,0.05)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(245,158,11,0.1)' }}>
                Se eliminarán de forma <strong>PERMANENTE</strong> todas las transacciones, asientos contables, documentos SRI, movimientos de tesorería, entidades y cuentas bancarias.<br /><br />
                🟢 El <strong>Plan de Cuentas</strong> se conservará intacto.
              </span>
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn flex-1" onClick={onClose} disabled={resettingEmpresa}>Cancelar</button>
              <button className="btn flex-1" style={{ background: '#F59E0B', color: '#fff', border: 'none' }} onClick={() => onSubmit(showResetConfirm)} disabled={resettingEmpresa}>
                {resettingEmpresa ? 'Reseteando...' : 'Sí, Resetear'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// 6. CompanySuccessModal
interface CompanySuccessModalProps {
  successModal: { title: string; message: string; type?: 'success' | 'error' | 'info' } | null;
  onClose: () => void;
}

export const CompanySuccessModal: React.FC<CompanySuccessModalProps> = ({
  successModal,
  onClose
}) => {
  return (
    <AnimatePresence>
      {successModal && (
        <div className="modal-overlay" style={{ zIndex: 400 }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="glass-card"
            style={{ width: '90%', maxWidth: '450px', padding: '40px', textAlign: 'center' }}
          >
            <div style={{
              width: 64,
              height: 64,
              background: successModal.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
              color: successModal.type === 'error' ? 'var(--error)' : 'var(--primary)',
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
              fontSize: '2rem'
            }}>
              {successModal.type === 'error' ? '❌' : '✅'}
            </div>
            <h3>{successModal.title}</h3>
            <p className="text-sec" style={{ marginBottom: '32px', fontSize: '0.92rem', lineHeight: '1.6' }}>
              {successModal.message}
            </p>
            <button className="btn btn-primary w-full" onClick={onClose}>Aceptar</button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
