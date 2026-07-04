import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Zap, Sparkles, CheckCircle2, Search, Filter, RefreshCw } from 'lucide-react';
import { XMLUploadModal } from '../components/XMLUploadModal';
import { WithholdingUploadModal } from '../components/WithholdingUploadModal';
import { DocumentDetailsSRIModal } from '../components/DocumentDetailsSRIModal';
import { EditMappingSRIModal } from '../components/EditMappingSRIModal';
import { SyncXMLHistoryModal } from '../components/SyncXMLHistoryModal';
import { CustomModal } from '../components/CustomModal';
import { useSRIAutomation } from '../hooks/useSRIAutomation';
import { SRIDocumentListTable } from '../components/SRIDocumentListTable';


interface SRIAutomationProps {
  tipo: 'Compras' | 'Ventas';
  empresaId: string;
}

const ITEMS_PER_PAGE = 10;

export const SRIAutomation: React.FC<SRIAutomationProps> = ({ tipo, empresaId }) => {
  const {
    isUploadOpen,
    setIsUploadOpen,
    documentos,
    loading,
    search,
    setSearchTerm,
    filterTipo,
    setFilterTipo,
    desde,
    setDesde,
    hasta,
    setHasta,
    currentPage,
    setCurrentPage,
    deletingId,
    annulModal,
    setAnnulModal,
    annulReasonInput,
    setAnnulReasonInput,
    alertModal,
    setAlertModal,
    confirmModal,
    setConfirmModal,
    accounts,
    selectedDocForWithholding,
    setSelectedDocForWithholding,
    viewingDoc,
    setViewingDoc,
    editingDoc,
    setEditingDoc,
    showAlert,
    showConfirm,
    fetchDocumentos,
    handleAnular,
    filtered
  } = useSRIAutomation({ tipo, empresaId });

  const [isSyncOpen, setIsSyncOpen] = React.useState(false);

  const totals = React.useMemo(() => {
    let baseGrav = 0;
    let iva = 0;
    let retencion = 0;
    let total = 0;

    filtered.forEach(doc => {
      const tc = doc.transacciones?.tipo_comprobante || '';
      const isRet = tc.toLowerCase().includes('retención') || tc.toLowerCase().includes('retencion');
      
      let docBase = 0;
      let docIva = 0;
      let docRet = 0;
      let docTotal = 0;

      if (isRet) {
        const rets = doc.retenciones_aplicadas || [];
        docBase = rets.reduce((sum, r) => sum + (r.base || 0), 0);
        docIva = rets.filter(r => r.tipo === 'IVA').reduce((sum, r) => sum + (r.valor || 0), 0);
        docRet = rets.reduce((sum, r) => sum + (r.valor || 0), 0);
        docTotal = rets.reduce((sum, r) => sum + (r.valor || 0), 0);
      } else {
        docBase = (doc.base_12 || 0) + (doc.base_0 || 0) + (doc.base_no_objeto || 0);
        docIva = doc.monto_iva || 0;
        docRet = doc.retenciones_aplicadas ? doc.retenciones_aplicadas.reduce((sum, r) => sum + (r.valor || 0), 0) : 0;
        docTotal = docBase + docIva;
      }

      baseGrav += docBase;
      iva += docIva;
      retencion += docRet;
      total += docTotal;
    });

    return { baseGrav, iva, retencion, total };
  }, [filtered]);

  // Body scroll lock when modals are open
  useEffect(() => {
    if (viewingDoc || editingDoc || selectedDocForWithholding || isUploadOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [viewingDoc, editingDoc, selectedDocForWithholding, isUploadOpen]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="sri-automation-container">
      {isUploadOpen ? (
        <XMLUploadModal
          isOpen={isUploadOpen}
          tipo={tipo}
          empresaId={empresaId}
          onClose={() => setIsUploadOpen(false)}
          onSuccess={() => {
            setIsUploadOpen(false);
            fetchDocumentos();
          }}
        />
      ) : (
        <>
          {/* ─── HEADER ─── */}
          <header className="flex-between" style={{ marginBottom: '40px', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '2px', marginBottom: '8px' }}>
                <Zap size={14} /> Automatización SRI
              </div>
              <h1 className="h1" style={{ fontSize: '2.5rem', fontWeight: 900 }}>XML {tipo}</h1>
              <p className="text-sec" style={{ fontSize: '1.1rem' }}>
                Sincroniza tus facturas electrónicas con tu contabilidad.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={fetchDocumentos}
                className="btn"
                style={{ padding: '12px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: 8 }}
                title="Refrescar"
              >
                <RefreshCw size={18} />
              </button>
              <button
                onClick={() => setIsSyncOpen(true)}
                className="btn"
                style={{ 
                  padding: '14px 28px', 
                  borderRadius: '18px', 
                  fontSize: '1rem', 
                  fontWeight: 800, 
                  letterSpacing: '0.5px', 
                  background: 'rgba(255,255,255,0.05)', 
                  border: '1px solid rgba(255,255,255,0.1)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px' 
                }}
              >
                <RefreshCw size={18} /> Sincronizar Históricos
              </button>
              <button
                onClick={() => setIsUploadOpen(true)}
                className="btn btn-primary"
                style={{ padding: '14px 28px', borderRadius: '18px', fontSize: '1rem', fontWeight: 800, letterSpacing: '0.5px' }}
              >
                <Upload size={20} /> Cargar XML
              </button>
            </div>
          </header>

          {/* ─── EMPTY STATE ─── */}
          {!loading && documentos.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card"
              style={{ padding: '60px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
            >
              <div style={{ width: 80, height: 80, background: 'var(--primary-light)', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', marginBottom: '24px' }}>
                <Sparkles size={40} />
              </div>
              <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '16px' }}>Procesador Masivo de XML</h2>
              <p className="text-sec" style={{ maxWidth: '500px', fontSize: '1.1rem', marginBottom: '32px' }}>
                Sube tus archivos electrónicos y el sistema creará automáticamente los asientos contables,
                vinculará a los proveedores y preparará tus anexos del SRI.
              </p>
              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', justifyContent: 'center' }}>
                {['Mapeo Automático de Cuentas', 'Detección de Proveedores', 'Validación de Doble Partida'].map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.9rem', color: 'var(--text-sec)' }}>
                    <div style={{ padding: '6px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', borderRadius: '8px' }}>
                      <CheckCircle2 size={16} />
                    </div>
                    {f}
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ─── HISTORIAL ─── */}
          {(loading || documentos.length > 0) && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card" style={{ padding: '28px' }}>
              {/* Filtros */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontWeight: 800, flex: 1, minWidth: 200 }}>
                  Historial de Documentos
                  <span style={{ marginLeft: 10, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-sec)', background: 'var(--primary-light)', padding: '3px 10px', borderRadius: 20 }}>
                    {filtered.length}
                  </span>
                </h3>
                <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                  <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sec)' }} />
                  <input
                    value={search}
                    onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                    placeholder="Buscar por entidad, número..."
                    style={{ width: '100%', paddingLeft: 36, padding: '10px 12px 10px 36px', borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', fontSize: '0.9rem', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-sec)', fontWeight: 700 }}>Desde:</span>
                  <input
                    type="date"
                    value={desde}
                    onChange={e => { setDesde(e.target.value); setCurrentPage(1); }}
                    style={{ padding: '8px 12px', borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-sec)', fontWeight: 700 }}>Hasta:</span>
                  <input
                    type="date"
                    value={hasta}
                    onChange={e => { setHasta(e.target.value); setCurrentPage(1); }}
                    style={{ padding: '8px 12px', borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                  />
                </div>
                <div style={{ position: 'relative' }}>
                  <Filter size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sec)' }} />
                  <select
                    value={filterTipo}
                    onChange={e => { setFilterTipo(e.target.value); setCurrentPage(1); }}
                    style={{ paddingLeft: 36, padding: '10px 12px 10px 36px', borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', fontSize: '0.9rem' }}
                  >
                    <option value="">Todos los tipos</option>
                    <option value="Factura">Factura</option>
                    <option value="Comprobante de Retención">Retención</option>
                    <option value="Nota de Crédito">Nota de Crédito</option>
                  </select>
                </div>
              </div>

              {/* Tabla */}
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} style={{ height: 56, borderRadius: 12, background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                  ))}
                </div>
              ) : (
                <SRIDocumentListTable
                  paginated={paginated}
                  filteredLength={filtered.length}
                  currentPage={currentPage}
                  itemsPerPage={ITEMS_PER_PAGE}
                  deletingId={deletingId}
                  handleAnular={handleAnular}
                  setViewingDoc={setViewingDoc}
                  setEditingDoc={setEditingDoc}
                  totalPages={totalPages}
                  setCurrentPage={setCurrentPage}
                  totals={totals}
                />
              )}
            </motion.div>
          )}
        </>
      )}

      {/* Reusable Modals */}
      <CustomModal
        isOpen={annulModal.isOpen && annulModal.step === 'confirm'}
        onClose={() => setAnnulModal(prev => ({ ...prev, isOpen: false }))}
        title="Confirmar Anulación"
        type="confirm"
        message={annulModal.confirmText}
        confirmLabel="Continuar"
        cancelLabel="Cancelar"
        onConfirm={() => setAnnulModal(prev => ({ ...prev, step: 'reason' }))}
      />

      <CustomModal
        isOpen={annulModal.isOpen && annulModal.step === 'reason'}
        onClose={() => {
          setAnnulModal(prev => ({ ...prev, isOpen: false }));
          setAnnulReasonInput('');
        }}
        title="Motivo de Anulación"
        type="prompt"
        message={annulModal.promptText}
        confirmLabel="Confirmar Anulación"
        cancelLabel="Cancelar"
        inputValue={annulReasonInput}
        onInputChange={setAnnulReasonInput}
        inputPlaceholder="Ej. Error de cuenta, digitación incorrecta..."
        onConfirm={() => {
          const reason = annulReasonInput.trim() || 'No especificado';
          annulModal.onSuccess(reason);
          setAnnulModal(prev => ({ ...prev, isOpen: false }));
          setAnnulReasonInput('');
        }}
      />

      <CustomModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal(prev => ({ ...prev, isOpen: false }))}
        title={alertModal.title}
        type={alertModal.type}
        message={alertModal.message}
        confirmLabel="Aceptar"
      />

      <CustomModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        title={confirmModal.title}
        type="confirm"
        message={confirmModal.message}
        confirmLabel="Confirmar"
        cancelLabel="Cancelar"
        onConfirm={() => {
          confirmModal.onConfirm();
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }}
      />

      {/* Modular Components */}
      <AnimatePresence>
        {editingDoc && (
          <EditMappingSRIModal
            editingDoc={editingDoc}
            onClose={() => setEditingDoc(null)}
            accounts={accounts}
            empresaId={empresaId}
            tipo={tipo}
            onSuccess={() => {
              setEditingDoc(null);
              fetchDocumentos();
            }}
            showAlert={showAlert}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewingDoc && (
          <DocumentDetailsSRIModal
            viewingDoc={viewingDoc}
            onClose={() => setViewingDoc(null)}
            accounts={accounts}
            empresaId={empresaId}
            tipo={tipo}
            onSuccess={() => {
              fetchDocumentos();
            }}
            showAlert={showAlert}
            showConfirm={showConfirm}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedDocForWithholding && (
          <WithholdingUploadModal
            selectedDoc={selectedDocForWithholding}
            onClose={() => setSelectedDocForWithholding(null)}
            accounts={accounts}
            empresaId={empresaId}
            tipo={tipo}
            onSuccess={() => {
              setSelectedDocForWithholding(null);
              fetchDocumentos();
            }}
            showAlert={showAlert}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSyncOpen && (
          <SyncXMLHistoryModal
            isOpen={isSyncOpen}
            onClose={() => setIsSyncOpen(false)}
            empresaId={empresaId}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
