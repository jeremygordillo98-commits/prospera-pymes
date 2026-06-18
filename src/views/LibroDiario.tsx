import React from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Loader2,
  ChevronDown,
  ChevronUp,
  Download,
  Ban
} from 'lucide-react';
import { CustomModal } from '../components/CustomModal';
import { useLibroDiario, getDocDetails } from '../hooks/useLibroDiario';
import { LibroDiarioToolbar } from '../components/LibroDiarioToolbar';

interface LibroDiarioProps {
  empresaId: string;
  activeView?: string;
}

export const LibroDiario: React.FC<LibroDiarioProps> = ({ empresaId, activeView }) => {
  const {
    loading,
    expandedTxs,
    filterDate,
    setFilterDate,
    filterEntidad,
    setFilterEntidad,
    filterTipo,
    setFilterTipo,
    filterMontoMin,
    setFilterMontoMin,
    filterMontoMax,
    setFilterMontoMax,
    annulModal,
    setAnnulModal,
    annulReasonInput,
    setAnnulReasonInput,
    alertModal,
    setAlertModal,
    filteredTransactions,
    toggleExpand,
    exportToExcel,
    handleExportTxPDF,
    exportLibroDiarioPDF,
    repararAsientosTesoreria,
    reparing,
    emptyTxsCount,
    incorrectTxsCount
  } = useLibroDiario({ empresaId, activeView });

  return (
    <div className="libro-diario-container">
      <LibroDiarioToolbar
        filteredTransactionsLength={filteredTransactions.length}
        filterDate={filterDate}
        setFilterDate={setFilterDate}
        filterEntidad={filterEntidad}
        setFilterEntidad={setFilterEntidad}
        filterTipo={filterTipo}
        setFilterTipo={setFilterTipo}
        filterMontoMin={filterMontoMin}
        setFilterMontoMin={setFilterMontoMin}
        filterMontoMax={filterMontoMax}
        setFilterMontoMax={setFilterMontoMax}
        exportToExcel={exportToExcel}
        exportToPDF={exportLibroDiarioPDF}
      />

      {(emptyTxsCount > 0 || incorrectTxsCount > 0) && (
        <div className="glass-card" style={{ padding: '16px 20px', borderLeft: '6px solid var(--warning)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', background: 'rgba(245,158,11,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '1.5rem' }}>⚠️</span>
            <div>
              <strong style={{ color: 'var(--warning)', fontSize: '0.95rem' }}>
                {emptyTxsCount > 0 && incorrectTxsCount > 0 
                  ? 'Inconsistencias en Asientos de Tesorería' 
                  : emptyTxsCount > 0 
                    ? 'Asientos de Tesorería Huérfanos' 
                    : 'Cuentas Incorrectas en Asientos de Pagos'}
              </strong>
              <p className="text-sec" style={{ fontSize: '0.8rem', marginTop: '4px', margin: 0 }}>
                {emptyTxsCount > 0 && incorrectTxsCount > 0
                  ? `Se detectaron ${emptyTxsCount} asientos vacíos (en $0.00) y ${incorrectTxsCount} asientos de pagos registrados con cuentas incorrectas (1.1.1 y 1.1.4.3).`
                  : emptyTxsCount > 0
                    ? `Hay ${emptyTxsCount} asientos contables de cobros o pagos que no tienen sus movimientos contables registrados (aparecen en $0.00).`
                    : `Se detectaron ${incorrectTxsCount} asientos contables de pagos registrados con cuentas incorrectas (1.1.1 y 1.1.4.3) que deben corregirse.`}
              </p>
            </div>
          </div>
          <button 
            className="btn" 
            disabled={reparing}
            onClick={repararAsientosTesoreria}
            style={{ borderRadius: '10px', fontSize: '0.82rem', padding: '8px 16px', background: 'var(--warning)', color: '#000', fontWeight: 'bold', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            {reparing ? 'Reparando...' : '🔧 Reparar Asientos'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex-center" style={{ padding: '100px 0' }}>
          <Loader2 className="animate-spin text-primary" size={40} />
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="glass-card text-center" style={{ padding: '80px 20px' }}>
          <div style={{ width: 64, height: 64, background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <FileText size={32} />
          </div>
          <h2 className="h1">Sin Asientos Contables</h2>
          <p className="text-sec" style={{ maxWidth: '400px', margin: '16px auto' }}>
            Aún no has registrado transacciones para esta empresa. Comienza subiendo un XML o registrando un asiento manual.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredTransactions.map((tx) => {
            const isAnulado = tx.tipo_comprobante === 'Anulado';
            const match = tx.concepto.match(/^\[ANULADO\]\s*Motivo:\s*(.*?)\s*\|\s*Fecha:\s*(.*?)\s*\|\s*(.*)$/);
            const conceptoDisplay = isAnulado && match ? match[3] : (isAnulado ? tx.concepto.replace(/^\[ANULADO\]\s*/, '') : tx.concepto);
            return (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`glass-card ${isAnulado ? 'anulado' : ''}`}
                style={{ 
                  padding: '0', 
                  overflow: 'hidden', 
                  borderLeft: isAnulado ? '6px solid var(--error)' : 'none',
                  borderBottom: isAnulado
                    ? (expandedTxs.has(tx.id) ? '2px solid var(--error)' : '1px solid var(--error)')
                    : (expandedTxs.has(tx.id) ? '2px solid var(--primary)' : '1px solid var(--border-color)'),
                  opacity: isAnulado ? 0.8 : 1
                }}
              >
                <div
                  className="flex-between"
                  style={{ padding: '20px 24px', cursor: 'pointer', background: expandedTxs.has(tx.id) ? 'rgba(99, 102, 241, 0.03)' : 'transparent' }}
                  onClick={() => toggleExpand(tx.id)}
                >
                  <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                    <div style={{ textAlign: 'center', minWidth: '60px' }}>
                      <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-sec)', fontWeight: 800 }}>{new Date(tx.fecha + 'T12:00:00').toLocaleString('es-EC', { month: 'short' })}</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 900 }}>{new Date(tx.fecha).getUTCDate()}</div>
                    </div>

                    <div style={{ height: '30px', width: '1px', background: 'var(--border-color)' }}></div>

                    <div style={{ maxWidth: '300px' }}>
                      <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {conceptoDisplay}
                        {isAnulado && (
                          <span style={{
                            fontSize: '9px',
                            color: 'var(--error)',
                            backgroundColor: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontWeight: 'bold',
                            letterSpacing: '0.5px',
                            textTransform: 'uppercase'
                          }}>
                            Anulado
                          </span>
                        )}
                      </h4>
                      <p className="text-sec" style={{ fontSize: '0.8rem', marginTop: '2px' }}>
                        {getDocDetails(tx)} • <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{tx.entidades?.razon_social || 'Entidad no def.'}</span>
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-sec)', fontWeight: 800 }}>Monto Operación</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--primary)' }}>
                        ${tx.movimientos.reduce((acc, m) => acc + m.debe, 0).toFixed(2)}
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleExportTxPDF(e, tx)}
                      className="p-2"
                      style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', opacity: 0.6 }}
                      title="Exportar a PDF"
                    >
                      <Download size={20} />
                    </button>

                    {expandedTxs.has(tx.id) ? <ChevronUp size={24} className="text-primary" /> : <ChevronDown size={24} className="text-sec" />}
                  </div>
                </div>

                {expandedTxs.has(tx.id) && (
                  <div style={{ padding: '0px 24px 24px', borderTop: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.01)' }}>
                    {isAnulado && (
                      <div style={{
                        marginTop: '16px',
                        padding: '12px 16px',
                        background: 'rgba(239, 68, 68, 0.06)',
                        border: '1px dashed var(--error)',
                        borderRadius: '10px',
                        color: 'var(--error)',
                        fontSize: '0.88rem',
                        fontWeight: 600,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Ban size={15} />
                          <span>Este asiento contable está ANULADO. Los movimientos contables fueron eliminados.</span>
                        </div>
                        {match && match[1] && (
                          <div style={{ marginLeft: '23px', fontSize: '0.82rem', color: 'var(--text-main)', marginTop: '4px' }}>
                            <strong style={{ color: 'var(--error)' }}>Motivo:</strong> {match[1]}
                            {match[2] && <span style={{ color: 'var(--text-sec)', marginLeft: '8px' }}>• Anulado el {match[2]}</span>}
                          </div>
                        )}
                      </div>
                    )}
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '16px', minWidth: '400px' }}>
                        <thead>
                          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                            <th style={{ padding: '12px 0', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-sec)' }}>Código</th>
                            <th style={{ padding: '12px 0', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-sec)' }}>Cuenta Contable</th>
                            <th style={{ padding: '12px 0', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-sec)', textAlign: 'right' }}>Debe</th>
                            <th style={{ padding: '12px 0', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-sec)', textAlign: 'right' }}>Haber</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tx.movimientos.map((m) => (
                            <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                              <td style={{ padding: '12px 0', fontSize: '0.85rem', color: 'var(--text-sec)', fontStyle: 'italic' }}>{m.plan_cuentas?.codigo_cuenta}</td>
                              <td style={{ padding: '12px 0', fontSize: '0.9rem', fontWeight: 600 }}>{m.plan_cuentas?.nombre}</td>
                              <td style={{ padding: '12px 0', fontSize: '0.9rem', textAlign: 'right', fontWeight: m.debe > 0 ? 900 : 400, color: m.debe > 0 ? 'var(--text-main)' : 'var(--text-sec)' }}>{m.debe > 0 ? `$${m.debe.toFixed(2)}` : '-'}</td>
                              <td style={{ padding: '12px 0', fontSize: '0.9rem', textAlign: 'right', fontWeight: m.haber > 0 ? 900 : 400, color: m.haber > 0 ? 'var(--text-main)' : 'var(--text-sec)' }}>{m.haber > 0 ? `$${m.haber.toFixed(2)}` : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ fontWeight: 900, background: isAnulado ? 'rgba(239, 68, 68, 0.05)' : 'rgba(99, 102, 241, 0.05)' }}>
                            <td colSpan={2} style={{ padding: '16px 12px', textAlign: 'right', fontSize: '0.8rem', textTransform: 'uppercase', borderRadius: '12px 0 0 12px' }}>Cuadre de Asiento</td>
                            <td style={{ padding: '16px 12px', textAlign: 'right', borderTop: isAnulado ? '2px solid var(--error)' : '2px solid var(--primary)', color: isAnulado ? 'var(--error)' : 'var(--primary)' }}>
                              ${tx.movimientos.reduce((acc, m) => acc + m.debe, 0).toFixed(2)}
                            </td>
                            <td style={{ padding: '16px 12px', textAlign: 'right', borderTop: isAnulado ? '2px solid var(--error)' : '2px solid var(--primary)', color: isAnulado ? 'var(--error)' : 'var(--primary)', borderRadius: '0 12px 12px 0' }}>
                              ${tx.movimientos.reduce((acc, m) => acc + m.haber, 0).toFixed(2)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
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
    </div>
  );
};
