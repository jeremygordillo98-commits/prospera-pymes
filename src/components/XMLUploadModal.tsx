import React, { useState } from 'react';
import {
  X,
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
  Receipt,
  FileMinus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { type SRIParsedData, parseSRIXML } from '../utils/sriParser';
import { supabase } from '../services/supabase';
import { CATALOGO_RETENCIONES_RENTA } from '../utils/sriCatalog';
import { EntidadQuickForm } from './EntidadQuickForm';

interface Account {
  id: string;
  codigo_cuenta: string;
  nombre: string;
  tipo: string;
}

interface XMLUploadModalProps {
  isOpen: boolean;
  empresaId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const XMLUploadModal: React.FC<XMLUploadModalProps> = ({ isOpen, empresaId, onClose, onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsedData, setParsedData] = useState<SRIParsedData | null>(null);

  // Estados para verificación de Entidad
  const [verifyingEntidad, setVerifyingEntidad] = useState(false);
  const [entidadId, setEntidadId] = useState<string | null>(null);
  const [showCreateEntidad, setShowCreateEntidad] = useState(false);

  // Estado para concepto de retención IR (solo para Facturas de Compras)
  const [retencionCodigo, setRetencionCodigo] = useState(CATALOGO_RETENCIONES_RENTA[0].codigo);

  // Estados para Contabilidad (Asiento)
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [idCuentaDebe, setIdCuentaDebe] = useState<string>(''); // Gasto o Inventario o Anticipo
  const [idCuentaHaber, setIdCuentaHaber] = useState<string>(''); // Pago o CXC o Proveedor
  const [idCuentaRetencion, setIdCuentaRetencion] = useState<string>('');

  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const retencionSeleccionada = CATALOGO_RETENCIONES_RENTA.find(r => r.codigo === retencionCodigo) || CATALOGO_RETENCIONES_RENTA[0];

  const isFactura = parsedData?.tipoDocumento === 'FACTURA';
  const isRetencion = parsedData?.tipoDocumento === 'COM_RETENCION';
  const isNotaCredito = parsedData?.tipoDocumento === 'NOTA_CREDITO';

  const valorRetenidoCalculado = isFactura
    ? parseFloat(((parsedData.baseImponible * retencionSeleccionada.porcentaje) / 100).toFixed(2))
    : 0;

  const fetchAccounts = async () => {
    if (!empresaId) return;
    try {
      const { data } = await supabase
        .from('plan_cuentas')
        .select('id, codigo_cuenta, nombre, tipo')
        .eq('id_empresa', empresaId)
        .eq('acepta_movimientos', true)
        .order('codigo_cuenta');

      if (data) {
        setAccounts(data);
        // Defaults iniciales (serán sobrescritos al detectar el documento)
        const defaultGasto = data.find(a => a.codigo_cuenta.startsWith('5')) || data[0];
        const defaultPago = data.find(a => a.codigo_cuenta.startsWith('2.1.3')) || data[0];
        const defaultRetencion = data.find(a => a.codigo_cuenta.startsWith('2.1.4') || a.nombre.toLowerCase().includes('retencion')) || data[0];
        if (defaultGasto) setIdCuentaDebe(defaultGasto.id);
        if (defaultPago) setIdCuentaHaber(defaultPago.id);
        if (defaultRetencion) setIdCuentaRetencion(defaultRetencion.id);
      }
    } catch (err) {
      console.error("Error fetching accounts:", err);
    }
  };

  React.useEffect(() => {
    if (isOpen && empresaId) {
      fetchAccounts();
    }
  }, [isOpen, empresaId]);

  const checkEntidadExistente = async (ruc: string) => {
    setVerifyingEntidad(true);
    setEntidadId(null);
    setShowCreateEntidad(false);

    try {
      const { data } = await supabase
        .from('entidades')
        .select('id')
        .eq('ruc_cedula', ruc)
        .eq('id_empresa', empresaId)
        .maybeSingle();

      if (data) {
        setEntidadId(data.id);
      } else {
        setShowCreateEntidad(true);
      }
    } catch {
      console.error("Error checking entity");
    } finally {
      setVerifyingEntidad(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setParsing(true);
    setParsedData(null);
    setStatus('idle');

    try {
      const text = await selectedFile.text();
      const data = await parseSRIXML(text);
      if (data) {
        setParsedData(data);
        await checkEntidadExistente(data.rucEmisor);

        // Auto-asignación de cuentas sugeridas según documento
        if (data.tipoDocumento === 'COM_RETENCION') {
          const defaultAnticipo = accounts.find(a => a.codigo_cuenta.startsWith('1.1.3') || a.nombre.toLowerCase().includes('anticipo'))?.id;
          const defaultCliente = accounts.find(a => a.codigo_cuenta.startsWith('1.1.2') || a.nombre.toLowerCase().includes('cliente'))?.id;
          if (defaultAnticipo) setIdCuentaDebe(defaultAnticipo);
          if (defaultCliente) setIdCuentaHaber(defaultCliente);
        } else if (data.tipoDocumento === 'NOTA_CREDITO') {
          const defaultVentas = accounts.find(a => a.codigo_cuenta.startsWith('4'))?.id;
          const defaultCliente = accounts.find(a => a.codigo_cuenta.startsWith('1.1.2') || a.nombre.toLowerCase().includes('cliente'))?.id;
          if (defaultVentas) setIdCuentaDebe(defaultVentas);
          if (defaultCliente) setIdCuentaHaber(defaultCliente);
        }
      } else {
        setStatus('error');
      }
    } catch (err) {
      console.error(err);
      setStatus('error');
    } finally {
      setParsing(false);
      e.target.value = '';
    }
  };

  const handleSave = async () => {
    if (!parsedData || !empresaId || !entidadId || !idCuentaDebe || !idCuentaHaber || (isFactura && valorRetenidoCalculado > 0 && !idCuentaRetencion)) {
      alert("Por favor asegúrate de seleccionar todas las cuentas contables.");
      return;
    }
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesión no válida");

      let totalComprobante = 0;
      let concepto = '';

      if (isFactura) {
        totalComprobante = parsedData.total;
        concepto = `Factura: ${parsedData.razonSocialEmisor} - ${parsedData.numeroComprobante}`;
      } else if (isRetencion) {
        totalComprobante = parsedData.totalRetenido;
        concepto = `Retención: ${parsedData.razonSocialEmisor} - ${parsedData.numeroComprobante}`;
      } else if (isNotaCredito) {
        totalComprobante = parsedData.valorModificacion;
        concepto = `NC: ${parsedData.razonSocialEmisor} - Mod: ${parsedData.numDocModificado}`;
      }

      // 1. Crear transaccion
      const { data: transaccion, error: tError } = await supabase
        .from('transacciones')
        .insert({
          fecha: new Date(parsedData.fechaEmision.split('/').reverse().join('-')),
          concepto,
          tipo_comprobante: isFactura ? 'Factura' : isRetencion ? 'Comprobante de Retención' : 'Nota de Crédito',
          numero_comprobante: parsedData.numeroComprobante,
          id_entidad: entidadId,
          xml_referencia: parsedData.claveAcceso,
          id_empresa: empresaId,
          id_usuario: user.id
        })
        .select()
        .single();

      if (tError) throw tError;

      // 2. Insertar Movimientos (Doble Partida)
      let batchMovimientos: any[] = [];

      if (isFactura) {
        const netoAPagar = parseFloat((totalComprobante - valorRetenidoCalculado).toFixed(2));
        batchMovimientos = [
          { id_transaccion: transaccion.id, id_cuenta: idCuentaDebe, debe: totalComprobante, haber: 0, id_empresa: empresaId },
          ...(valorRetenidoCalculado > 0 ? [{ id_transaccion: transaccion.id, id_cuenta: idCuentaRetencion, debe: 0, haber: valorRetenidoCalculado, id_empresa: empresaId }] : []),
          { id_transaccion: transaccion.id, id_cuenta: idCuentaHaber, debe: 0, haber: netoAPagar, id_empresa: empresaId }
        ];
      } else {
        batchMovimientos = [
          { id_transaccion: transaccion.id, id_cuenta: idCuentaDebe, debe: totalComprobante, haber: 0, id_empresa: empresaId },
          { id_transaccion: transaccion.id, id_cuenta: idCuentaHaber, debe: 0, haber: totalComprobante, id_empresa: empresaId }
        ];
      }

      const { error: mError } = await supabase.from('movimientos').insert(batchMovimientos);
      if (mError) throw mError;

      // 3. Crear documento SRI para ATS
      let payloadSRI: any = {
        id_transaccion: transaccion.id,
        clave_acceso_xml: parsedData.claveAcceso,
        id_empresa: empresaId
      };

      if (isFactura) {
        payloadSRI.base_12 = parsedData.baseImponible;
        payloadSRI.monto_iva = parsedData.iva;
        payloadSRI.retenciones_aplicadas = valorRetenidoCalculado > 0 ? [{
          codigo: retencionSeleccionada.codigo, porcentaje: retencionSeleccionada.porcentaje, base: parsedData.baseImponible, valor: valorRetenidoCalculado, tipo: 'RENTA'
        }] : [];
      } else if (isRetencion) {
        payloadSRI.base_12 = 0;
        payloadSRI.monto_iva = 0;
        payloadSRI.retenciones_aplicadas = parsedData.documentosSustento.flatMap((doc: any) => doc.retenciones.map((ret: any) => ({
          codigo: ret.codigoRetencion, porcentaje: ret.porcentajeRetener, base: ret.baseImponible, valor: ret.valorRetenido, desc_doc: doc.numDocSustento
        })));
      } else if (isNotaCredito) {
        payloadSRI.base_12 = parsedData.baseImponible;
        payloadSRI.monto_iva = parsedData.iva;
        payloadSRI.retenciones_aplicadas = []; // TODO: Relacionar de otra forma si necesita, Supabase permite JSON relajado
      }

      const { error: dError } = await supabase.from('documentos_sri').insert(payloadSRI);

      if (dError) {
        console.error("Documentos SRI insert error: ", dError);
        // Omitimos throw para no revertir lo importante si falta una metadata pequeña, pero lo ideal es tener transacción SQL fuerte.
      }

      // 4. Integrar con el módulo de Tesorería (Cuentas por Cobrar / Pagar)
      if (isFactura) {
        // Determinar si es Venta (yo emito) o Compra (me emiten) cruzando el RUC
        const { data: empData } = await supabase.from('empresas_gestionadas').select('ruc_empresa').eq('id', empresaId).single();
        const rucEmpresa = empData?.ruc_empresa || '';
        
        const esVenta = rucEmpresa === parsedData.rucEmisor;
        const tipoTesoreria = esVenta ? 'Cuenta por cobrar' : 'Cuenta por pagar';
        const netoAPagar = parseFloat((totalComprobante - valorRetenidoCalculado).toFixed(2));

        const { error: tesError } = await supabase.from('tesoreria_documentos').insert({
          id_empresa: empresaId,
          id_entidad: entidadId,
          tipo_documento: tipoTesoreria,
          fecha_emision: new Date(parsedData.fechaEmision.split('/').reverse().join('-')).toISOString().slice(0, 10),
          fecha_vencimiento: new Date(parsedData.fechaEmision.split('/').reverse().join('-')).toISOString().slice(0, 10), // Podría ser +30 días según forma de pago XML
          concepto: `[Automático] Factura #${parsedData.numeroComprobante}`,
          referencia: parsedData.numeroComprobante,
          total: totalComprobante,
          saldo_pendiente: netoAPagar,
          estado: netoAPagar > 0 ? 'Pendiente' : 'Liquidado',
          origen: 'SRI XML'
        });

        if (tesError) {
          console.error("Tesorería insert error:", tesError);
        }
      }

      setStatus('success');
      setTimeout(() => {
        onSuccess();
        onClose();
        setFile(null);
        setParsedData(null);
        setEntidadId(null);
        setStatus('idle');
      }, 1500);

    } catch (error: any) {
      console.error("Save error:", error);
      alert(`Error al guardar: ${error.message}`);
      setStatus('error');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card w-full max-w-2xl p-0 overflow-hidden"
      >
        <div className="p-6 border-b border-white/10 flex-between">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Upload size={20} className="text-primary" /> Analizador Multidocumento SRI
          </h3>
          <button onClick={onClose} className="text-sec hover:text-white"><X size={24} /></button>
        </div>

        <div className="p-8 max-h-[85vh] overflow-y-auto custom-scrollbar">
          {!file ? (
            <div
              onClick={() => document.getElementById('xmlInput')?.click()}
              className="border-2 border-dashed border-white/10 rounded-2xl p-12 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all group"
            >
              <div className="mx-auto mb-4 w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Upload className="text-primary" size={40} />
              </div>
              <p className="font-bold text-xl mb-2">Sube tu archivo XML</p>
              <p className="text-sec text-sm max-w-xs mx-auto">Soporta Facturas, Notas de Crédito y Comprobantes de Retención emitidos por tus proveedores o clientes.</p>
              <input
                id="xmlInput"
                type="file"
                accept=".xml"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/10 shadow-inner">
                <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                  <FileText className="text-primary" />
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="font-bold text-lg truncate">{file.name}</p>
                  <p className="text-xs text-sec">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setFile(null);
                      setParsedData(null);
                    }}
                    className="text-xs font-bold text-primary hover:underline"
                  >
                    Cambiar
                  </button>
                  {(parsing || verifyingEntidad) && <Loader2 className="animate-spin text-primary" size={24} />}
                  {parsedData && !verifyingEntidad && <CheckCircle2 className="text-success shadow-success/20" size={24} />}
                </div>
              </div>

              <AnimatePresence mode="wait">
                {showCreateEntidad && parsedData && (
                  <motion.div
                    key="create-entidad"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="space-y-4"
                  >
                    <div className="bg-warning/10 border border-warning/30 p-4 rounded-xl flex gap-3 text-warning">
                      <AlertCircle size={24} className="shrink-0" />
                      <div>
                        <p className="font-bold">Emisor / Receptor no encontrado</p>
                        <p className="text-xs opacity-90">El RUC {parsedData.rucEmisor} no está en tu base de datos de entidades.</p>
                      </div>
                    </div>

                    <EntidadQuickForm
                      ruc={parsedData.rucEmisor}
                      razonSocial={parsedData.razonSocialEmisor}
                      empresaId={empresaId}
                      onSuccess={(id) => {
                        setEntidadId(id);
                        setShowCreateEntidad(false);
                      }}
                      onCancel={() => {
                        setFile(null);
                        setParsedData(null);
                        setShowCreateEntidad(false);
                      }}
                    />
                  </motion.div>
                )}

                {parsedData && entidadId && (
                  <motion.div
                    key="summary"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                        <span className="text-xs text-sec uppercase tracking-wider font-bold block mb-2">Entidad Vinculada</span>
                        <div className="flex items-start gap-2">
                          <CheckCircle2 size={16} className="text-success mt-1 shrink-0" />
                          <div>
                            <p className="font-bold text-sm leading-tight">{parsedData.razonSocialEmisor}</p>
                            <p className="text-xs text-sec mt-1">RUC: {parsedData.rucEmisor}</p>
                          </div>
                        </div>
                      </div>
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                        <span className="text-xs text-sec uppercase tracking-wider font-bold block mb-2" style={{ color: isRetencion ? 'var(--warning)' : isNotaCredito ? '#ef4444' : 'var(--primary)' }}>
                          {isFactura ? 'Factura Autorizada' : isRetencion ? 'Retención Recibida' : 'Nota de Crédito'}
                        </span>
                        <p className="font-bold text-sm">Secuencial: <span className="text-white">{parsedData.numeroComprobante}</span></p>
                        <p className="text-xs text-sec mt-1">Emisión: {parsedData.fechaEmision}</p>
                      </div>
                    </div>

                    <div className="p-6 bg-primary/5 rounded-2xl border border-primary/20 space-y-4">
                      <div className="flex items-center gap-2 font-bold text-primary mb-2 text-sm uppercase tracking-wide">
                        {isFactura && <FileText size={18} />}
                        {isRetencion && <Receipt size={18} />}
                        {isNotaCredito && <FileMinus size={18} />}
                        Asiento Contable (Libro Diario)
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] text-sec uppercase font-bold px-1">
                            {isFactura ? 'Debe (Gasto/Inv)' : isRetencion ? 'Debe (Anticipo Impuesto)' : 'Debe (Ventas a Reversar)'}
                          </label>
                          <select
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white text-xs outline-none focus:border-primary"
                            value={idCuentaDebe}
                            onChange={(e) => setIdCuentaDebe(e.target.value)}
                          >
                            <option value="">Seleccionar cuenta...</option>
                            {accounts.map(a => (
                              <option key={a.id} value={a.id}>{a.codigo_cuenta} - {a.nombre}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-sec uppercase font-bold px-1">
                            {isFactura ? 'Haber (Pasivo/CXP)' : isRetencion ? 'Haber (CXC Cliente)' : 'Haber (CXC Cliente a Reducir)'}
                          </label>
                          <select
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white text-xs outline-none focus:border-primary"
                            value={idCuentaHaber}
                            onChange={(e) => setIdCuentaHaber(e.target.value)}
                          >
                            <option value="">Seleccionar cuenta...</option>
                            {accounts.map(a => (
                              <option key={a.id} value={a.id}>{a.codigo_cuenta} - {a.nombre}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {isFactura && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 border-t border-white/5 pt-3">
                          <div className="space-y-1">
                            <label className="text-[10px] text-sec uppercase font-bold px-1">Aplicar Retención Renta (Opcional)</label>
                            <select
                              className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white text-xs outline-none focus:border-primary"
                              value={retencionCodigo}
                              onChange={(e) => setRetencionCodigo(e.target.value)}
                            >
                              {CATALOGO_RETENCIONES_RENTA.map(r => (
                                <option key={r.codigo} value={r.codigo}>{r.codigo} - {r.descripcion} ({r.porcentaje}%)</option>
                              ))}
                            </select>
                          </div>

                          {valorRetenidoCalculado > 0 && (
                            <div className="space-y-1">
                              <label className="text-[10px] text-warning uppercase font-bold px-1">Cuenta Contable (Pasivo Retención)</label>
                              <select
                                className="w-full bg-warning/10 border border-warning/30 rounded-xl p-3 text-white text-xs outline-none focus:border-warning"
                                value={idCuentaRetencion}
                                onChange={(e) => setIdCuentaRetencion(e.target.value)}
                              >
                                <option value="">Seleccionar cuenta pasivo...</option>
                                {accounts.filter(a => a.tipo === 'Pasivo').map(a => (
                                  <option key={a.id} value={a.id}>{a.codigo_cuenta} - {a.nombre}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      )}

                      {isRetencion && (
                        <div className="pt-3 border-t border-white/5">
                          <p className="text-xs text-sec">Se han detectado la aplicación sobre los siguientes documentos (Sustento):</p>
                          <ul className="text-xs font-bold text-white mt-1 list-disc pl-4">
                            {parsedData.documentosSustento.map((doc: any) => (
                              <li key={doc.numDocSustento}>Factura: {doc.numDocSustento}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {isNotaCredito && (
                        <div className="pt-3 border-t border-white/5 flex gap-2 items-center">
                          <AlertCircle size={14} className="text-error" />
                          <span className="text-xs text-white">Aplicando descuento a Factura origen: <strong className="text-error text-sm">{parsedData.numDocModificado}</strong></span>
                        </div>
                      )}

                      <div className="pt-4 border-t border-primary/10 space-y-2">
                        {isFactura && (
                          <>
                            <div className="flex justify-between text-xs">
                              <span className="text-sec">Subtotal Grava IVA:</span>
                              <span className="font-bold">${parsedData.baseImponible.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-sec">IVA Detallado:</span>
                              <span className="font-bold">${parsedData.iva.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-warning font-bold text-xs">
                              <span>Retención IR Impuesta ({retencionSeleccionada.porcentaje}%):</span>
                              <span>- ${valorRetenidoCalculado.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-base border-t border-white/10 pt-3 mt-2">
                              <span className="font-extrabold">Neto al Proveedor:</span>
                              <span className="font-black text-primary">
                                ${(parsedData.total - valorRetenidoCalculado).toFixed(2)}
                              </span>
                            </div>
                          </>
                        )}
                        {isRetencion && (
                          <div className="flex justify-between text-base pt-1">
                            <span className="font-extrabold">Total Retenido (Saldo a Favor):</span>
                            <span className="font-black text-warning">
                              ${parsedData.totalRetenido.toFixed(2)}
                            </span>
                          </div>
                        )}
                        {isNotaCredito && (
                          <div className="flex justify-between text-base pt-1">
                            <span className="font-extrabold">Valor de Modificación (Devolución):</span>
                            <span className="font-black text-error">
                              ${parsedData.valorModificacion.toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <footer className="pt-4 flex gap-4">
                      <button
                        onClick={() => {
                          setFile(null);
                          setParsedData(null);
                          setEntidadId(null);
                        }}
                        className="btn glass-card flex-1 justify-center h-12"
                      >Reintentar</button>
                      <button
                        disabled={!parsedData || saving || !entidadId}
                        onClick={handleSave}
                        className="btn btn-primary flex-1 justify-center h-12 shadow-lg shadow-primary/20"
                      >
                        {saving ? <Loader2 className="animate-spin" size={20} /> : <><Save size={20} /> Guardar Asiento y Documento</>}
                      </button>
                    </footer>
                  </motion.div>
                )}
              </AnimatePresence>

              {status === 'error' && (
                <div className="flex items-center gap-3 text-error text-sm bg-error/10 p-4 rounded-xl border border-error/20">
                  <AlertCircle size={20} />
                  <p><strong>Error de Procesamiento:</strong> El archivo XML no posee una estructura de comprobante válida del SRI.</p>
                </div>
              )}

              {status === 'success' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center p-12 text-center space-y-4"
                >
                  <div className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center">
                    <CheckCircle2 className="text-success" size={48} />
                  </div>
                  <h3 className="text-2xl font-black">¡Procesado Correctamente!</h3>
                  <p className="text-sec">El movimiento contable y el metadato tributario (ATS) se han guardado con éxito.</p>
                </motion.div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
