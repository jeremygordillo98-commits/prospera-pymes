import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Wallet, Landmark, ArrowDownCircle, ArrowUpCircle, Repeat, Loader2, CheckCircle2, Building2, Banknote } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getNextNumeroComprobante } from '../services/xmlSaveService';

const BANCOS_ECUADOR = [
  // Bancos Privados
  'Banco Pichincha',
  'Banco Guayaquil',
  'Banco del Pacífico',
  'Banco Internacional',
  'Banco del Austro',
  'Banco Solidario',
  'Banco ProCredit',
  'Banco General Rumiñahui',
  'Banco de Machala',
  'Banco Bolivariano',
  'Banco Capital',
  'Produbanco',
  'Diners Club del Ecuador',
  'Banco D-MIRO',
  'Banco Desarrollo',
  // Mutualistas
  'Mutualista Pichincha',
  'Mutualista Imbabura',
  'Mutualista Azuay',
  // Cooperativas principales
  'Cooperativa JEP',
  'Cooperativa Oscus',
  'Cooperativa Cooprogreso',
  'Cooperativa Andalucía',
  'Cooperativa 29 de Octubre',
  'Cooperativa Atuntaqui',
  'Cooperativa Mego',
  'Cooperativa Riobamba',
  'Cooperativa San Francisco',
  'Cooperativa Tulcán',
  'Cooperativa Mushuc Runa',
  'Cooperativa Alianza del Valle',
  'Cooperativa Policía Nacional',
  'Cooperativa Cámara de Comercio de Ambato',
  // Bancos Públicos
  'BanEcuador',
  'Banco del Estado (BDE)',
  'CFN (Corporación Financiera Nacional)',
  // Otro
  'Otro (nombre personalizado)',
];

interface Props { empresaId: string; mode?: 'resumen' | 'cobros' | 'pagos' | 'conciliacion'; }

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', outline: 'none'
};

const cardTitle: React.CSSProperties = { fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: 1.2, color: 'var(--text-sec)', fontWeight: 800 };

export const Tesoreria: React.FC<Props> = ({ empresaId, mode = 'resumen' }) => {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [showCuentaForm, setShowCuentaForm] = useState(false);

  const [cuentaForm, setCuentaForm] = useState({
    banco_seleccionado: 'Banco Pichincha',
    nombre: '',            // solo si es 'Otro (nombre personalizado)' o Caja
    tipo: 'Banco',         // 'Banco' | 'Caja'
    tipo_cuenta: 'Ahorro', // 'Ahorro' | 'Corriente' (solo para Banco)
    saldo_inicial: '0',
    moneda: 'USD',
    numero_referencia: ''  // número de cuenta bancaria
  });
  const [movForm, setMovForm] = useState({
    fecha: new Date().toISOString().slice(0, 10),
    tipo_movimiento: mode === 'pagos' ? 'Pago' : 'Cobro',
    concepto: '', monto: '', id_cuenta_financiera: '', id_cuenta_banco_contable: '', id_entidad: '', id_documento: '', referencia: '', estado: 'Aplicado'
  });
  const [searchAccount, setSearchAccount] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [docForm, setDocForm] = useState({
    tipo_documento: mode === 'pagos' ? 'Cuenta por pagar' : 'Cuenta por cobrar',
    fecha_emision: new Date().toISOString().slice(0, 10), fecha_vencimiento: '', id_entidad: '', concepto: '', referencia: '', total: ''
  });

  const [editingMov, setEditingMov] = useState<any | null>(null);
  const [searchEditBank, setSearchEditBank] = useState('');
  const [isEditBankOpen, setIsEditBankOpen] = useState(false);
  const editBankRef = useRef<HTMLDivElement>(null);

  const { data, isLoading: loading } = useQuery({
    queryKey: ['tesoreria', empresaId],
    queryFn: async () => {
      const [cuentasRes, docsRes, movRes, entRes, pcRes, txAnuladasRes] = await Promise.all([
        supabase.from('cuentas_financieras').select('*').eq('id_empresa', empresaId).order('nombre'),
        supabase.from('tesoreria_documentos').select('id,fecha_emision,fecha_vencimiento,tipo_documento,referencia,concepto,saldo_pendiente,total,estado,entidades(id,razon_social)').eq('id_empresa', empresaId).order('fecha_emision', { ascending: false }),
        supabase.from('tesoreria_movimientos').select('id,fecha,tipo_movimiento,concepto,monto,estado,referencia,cuenta_financiera:cuentas_financieras(nombre),entidades(id,razon_social),documento:tesoreria_documentos(referencia,concepto,total,fecha_vencimiento)').eq('id_empresa', empresaId).order('fecha', { ascending: false }).limit(30),
        supabase.from('entidades').select('id,razon_social,tipo_entidad').eq('id_empresa', empresaId).order('razon_social'),
        supabase.from('plan_cuentas').select('id, codigo_cuenta, nombre').eq('id_empresa', empresaId).order('codigo_cuenta'),
        // Traer todas las transacciones anuladas para poder excluir sus facturas de tesorería
        supabase.from('transacciones').select('concepto').eq('id_empresa', empresaId).eq('tipo_comprobante', 'Anulado')
      ]);

      // Extraer los números SRI (ej. 001-001-000001234) de las transacciones anuladas
      const refsAnuladas = new Set<string>();
      (txAnuladasRes.data || []).forEach((tx: any) => {
        const match = (tx.concepto || '').match(/(\d{3}-\d{3}-\d{9})/);
        if (match) refsAnuladas.add(match[1]);
      });

      // Mapear y filtrar documentos: excluir los que correspondan a facturas anuladas
      const todosDocumentos = (docsRes.data || []).map((item: any) => ({ ...item, entidades: Array.isArray(item.entidades) ? item.entidades[0] : item.entidades }));
      const documentosSinAnulados = todosDocumentos.filter((d: any) => !refsAnuladas.has(d.referencia));

      return {
        cuentas: cuentasRes.data || [],
        documentos: documentosSinAnulados,
        movimientos: (movRes.data || []).map((item: any) => ({
          ...item,
          cuenta_financiera: Array.isArray(item.cuenta_financiera) ? item.cuenta_financiera[0] : item.cuenta_financiera,
          entidades: Array.isArray(item.entidades) ? item.entidades[0] : item.entidades,
          documento: Array.isArray(item.documento) ? item.documento[0] : item.documento,
        })),
        entities: entRes.data || [],
        cuentasContables: pcRes?.data || []
      };
    },
    staleTime: 0, // Sin caché: siempre datos frescos para reflejar anulaciones
  });

  const cuentas = data?.cuentas || [];
  const documentos = data?.documentos || [];
  const movimientos = data?.movimientos || [];
  const entities = data?.entities || [];
  const cuentasContables = data?.cuentasContables || [];

  // Synchronize search text with the selected account
  const selectedAccountText = useMemo(() => {
    const selected = cuentasContables.find((c: any) => c.id === movForm.id_cuenta_banco_contable);
    return selected ? `${selected.codigo_cuenta} - ${selected.nombre}` : '';
  }, [cuentasContables, movForm.id_cuenta_banco_contable]);

  useEffect(() => {
    if (!isDropdownOpen) {
      setSearchAccount(selectedAccountText);
    }
  }, [selectedAccountText, isDropdownOpen]);

  // Click outside listener for dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const filteredCuentasContables = useMemo(() => {
    if (!searchAccount || searchAccount === selectedAccountText) {
      return cuentasContables;
    }
    const query = searchAccount.toLowerCase();
    return cuentasContables.filter((c: any) =>
      c.codigo_cuenta?.toLowerCase().includes(query) ||
      c.nombre?.toLowerCase().includes(query)
    );
  }, [cuentasContables, searchAccount, selectedAccountText]);

  // Synchronize edit search inputs when dropdowns are closed or editingMov changes
  const selectedEditBankText = useMemo(() => {
    if (!editingMov) return '';
    const selected = cuentasContables.find((c: any) => c.id === editingMov.id_cuenta_banco_contable);
    return selected ? `${selected.codigo_cuenta} - ${selected.nombre}` : '';
  }, [cuentasContables, editingMov?.id_cuenta_banco_contable]);

  useEffect(() => {
    if (!isEditBankOpen && editingMov) {
      setSearchEditBank(selectedEditBankText);
    }
  }, [selectedEditBankText, isEditBankOpen]);

  // Click outside listener for edit dropdowns
  useEffect(() => {
    const handleClickOutsideEdit = (event: MouseEvent) => {
      if (editBankRef.current && !editBankRef.current.contains(event.target as Node)) {
        setIsEditBankOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutsideEdit);
    return () => {
      document.removeEventListener('mousedown', handleClickOutsideEdit);
    };
  }, []);

  const filteredEditBankCuentas = useMemo(() => {
    if (!searchEditBank || searchEditBank === selectedEditBankText) {
      return cuentasContables;
    }
    const query = searchEditBank.toLowerCase();
    return cuentasContables.filter((c: any) =>
      c.codigo_cuenta?.toLowerCase().includes(query) ||
      c.nombre?.toLowerCase().includes(query)
    );
  }, [cuentasContables, searchEditBank, selectedEditBankText]);

  const handleOpenEditModal = async (mov: any) => {
    setSaving(true);
    try {
      let txId = null;
      let txMovements: any[] = [];

      if (mov.referencia) {
        const { data: txs } = await supabase
          .from('transacciones')
          .select('id, concepto, numero_comprobante, movimientos (id, id_cuenta, debe, haber, plan_cuentas (codigo_cuenta, nombre))')
          .eq('id_empresa', empresaId)
          .eq('numero_comprobante', mov.referencia);
        if (txs && txs.length > 0) {
          txId = txs[0].id;
          txMovements = txs[0].movimientos || [];
        }
      }

      if (!txId) {
        const { data: txs } = await supabase
          .from('transacciones')
          .select('id, concepto, numero_comprobante, movimientos (id, id_cuenta, debe, haber, plan_cuentas (codigo_cuenta, nombre))')
          .eq('id_empresa', empresaId)
          .eq('id_entidad', mov.id_entidad)
          .eq('fecha', mov.fecha)
          .in('tipo_comprobante', ['Ingreso', 'Egreso']);

        if (txs) {
          const matchedTx = txs.find(t => 
            (t.movimientos || []).some((m: any) => m.debe === Number(mov.monto) || m.haber === Number(mov.monto))
          );
          if (matchedTx) {
            txId = matchedTx.id;
            txMovements = matchedTx.movimientos || [];
          }
        }
      }

      let bankAccountId = '';
      let contrapartidaAccountId = '';

      if (txMovements.length > 0) {
        if (mov.tipo_movimiento === 'Pago') {
          const bankMov = txMovements.find(m => Number(m.haber) > 0);
          const supplierMov = txMovements.find(m => Number(m.debe) > 0);
          if (bankMov) bankAccountId = bankMov.id_cuenta;
          if (supplierMov) contrapartidaAccountId = supplierMov.id_cuenta;
        } else {
          const bankMov = txMovements.find(m => Number(m.debe) > 0);
          const clientMov = txMovements.find(m => Number(m.haber) > 0);
          if (bankMov) bankAccountId = bankMov.id_cuenta;
          if (clientMov) contrapartidaAccountId = clientMov.id_cuenta;
        }
      }

      setEditingMov({
        ...mov,
        txId,
        txMovements,
        fecha: mov.fecha,
        monto: String(mov.monto),
        montoOriginal: Number(mov.monto),
        concepto: mov.concepto || '',
        referencia: mov.referencia || '',
        id_cuenta_financiera: mov.id_cuenta_financiera || '',
        id_cuenta_banco_contable: bankAccountId || mov.id_cuenta_banco_contable || '',
        id_cuenta_contrapartida_contable: contrapartidaAccountId || ''
      });

      const bCta = cuentasContables.find((c: any) => c.id === bankAccountId);
      setSearchEditBank(bCta ? `${bCta.codigo_cuenta} - ${bCta.nombre}` : '');
      
    } catch (err) {
      console.error("Error al cargar transacción para editar:", err);
      alert("No se pudo cargar la transacción contable asociada.");
    } finally {
      setSaving(false);
    }
  };

  const handleGuardarEdicionMovimiento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMov) return;
    if (!editingMov.id_cuenta_banco_contable) {
      alert("Por favor, selecciona una cuenta contable de banco.");
      return;
    }
    if (editingMov.txId && !editingMov.id_cuenta_contrapartida_contable) {
      alert("No se pudo identificar la cuenta contable de contrapartida (proveedor/cliente) del asiento original.");
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      const newMonto = parseFloat(editingMov.monto) || 0;
      
      // 1. UPDATE tesoreria_movimientos
      const { error: updMovErr } = await supabase
        .from('tesoreria_movimientos')
        .update({
          fecha: editingMov.fecha,
          monto: newMonto,
          concepto: editingMov.concepto,
          referencia: editingMov.referencia || null,
          id_cuenta_financiera: editingMov.id_cuenta_financiera || null
        })
        .eq('id', editingMov.id);

      if (updMovErr) throw updMovErr;

      // 2. UPDATE tesoreria_documentos
      if (editingMov.id_documento) {
        const originalMonto = Number(editingMov.montoOriginal !== undefined ? editingMov.montoOriginal : editingMov.monto);
        const amountDiff = originalMonto - newMonto;

        const { data: doc } = await supabase
          .from('tesoreria_documentos')
          .select('total, saldo_pendiente')
          .eq('id', editingMov.id_documento)
          .single();

        if (doc) {
          const nuevoSaldo = Math.max(0, Math.min(Number(doc.total), Number(doc.saldo_pendiente) + amountDiff));
          const nuevoEstado = nuevoSaldo === 0 ? 'Liquidado' : (nuevoSaldo === Number(doc.total) ? 'Pendiente' : 'Parcial');
          
          await supabase
            .from('tesoreria_documentos')
            .update({ saldo_pendiente: nuevoSaldo, estado: nuevoEstado })
            .eq('id', editingMov.id_documento);
        }
      }

      // 3. UPDATE transacciones and movimientos
      if (editingMov.txId) {
        const refText = editingMov.referencia ? ` (Ref: ${editingMov.referencia})` : '';
        const conceptoAsiento = (editingMov.concepto || `${editingMov.tipo_movimiento} de Tesorería`) + refText;

        await supabase
          .from('transacciones')
          .update({
            fecha: editingMov.fecha,
            concepto: conceptoAsiento
          })
          .eq('id', editingMov.txId);

        const { data: txMovs } = await supabase
          .from('movimientos')
          .select('id, debe, haber')
          .eq('id_transaccion', editingMov.txId);

        if (txMovs && txMovs.length === 2) {
          const mov1 = txMovs[0];
          const mov2 = txMovs[1];

          if (editingMov.tipo_movimiento === 'Pago') {
            const debitMov = mov1.debe > 0 ? mov1 : mov2;
            const creditMov = mov1.haber > 0 ? mov1 : mov2;

            await supabase
              .from('movimientos')
              .update({
                id_cuenta: editingMov.id_cuenta_banco_contable,
                debe: 0,
                haber: newMonto
              })
              .eq('id', creditMov.id);

            await supabase
              .from('movimientos')
              .update({
                id_cuenta: editingMov.id_cuenta_contrapartida_contable,
                debe: newMonto,
                haber: 0
              })
              .eq('id', debitMov.id);

          } else {
            const debitMov = mov1.debe > 0 ? mov1 : mov2;
            const creditMov = mov1.haber > 0 ? mov1 : mov2;

            await supabase
              .from('movimientos')
              .update({
                id_cuenta: editingMov.id_cuenta_banco_contable,
                debe: newMonto,
                haber: 0
              })
              .eq('id', debitMov.id);

            await supabase
              .from('movimientos')
              .update({
                id_cuenta: editingMov.id_cuenta_contrapartida_contable,
                debe: 0,
                haber: newMonto
              })
              .eq('id', creditMov.id);
          }
        }
      }

      setEditingMov(null);
      setMessage('Movimiento actualizado y sincronizado exitosamente.');
      await queryClient.invalidateQueries({ queryKey: ['tesoreria', empresaId] });

    } catch (err: any) {
      console.error("Error al guardar edición del movimiento:", err);
      alert("Error al guardar: " + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  // Filtrar de las cuentas contables solo las que son de activo corriente (Bancos/Caja/Fondos)
  const cuentasContablesBancos = cuentasContables.filter((c: any) => 
    c.codigo_cuenta?.startsWith('1.1.1') || 
    c.nombre?.toLowerCase().includes('banco') || 
    c.nombre?.toLowerCase().includes('caja') ||
    c.nombre?.toLowerCase().includes('fondo')
  );



  const summary = useMemo(() => {
    const saldoInicialCuentas = cuentas.reduce((acc, c) => acc + Number(c.saldo_inicial || 0), 0);
    const cobradoTotal = movimientos.filter(m => m.tipo_movimiento === 'Cobro' && m.estado !== 'Anulado').reduce((acc, m) => acc + Number(m.monto || 0), 0);
    const pagadoTotal = movimientos.filter(m => m.tipo_movimiento === 'Pago' && m.estado !== 'Anulado').reduce((acc, m) => acc + Number(m.monto || 0), 0);
    const disponible = saldoInicialCuentas + cobradoTotal - pagadoTotal;

    const porCobrar = documentos.filter((d) => d.tipo_documento === 'Cuenta por cobrar').reduce((acc, d) => acc + Number(d.saldo_pendiente || 0), 0);
    const porPagar = documentos.filter((d) => d.tipo_documento === 'Cuenta por pagar').reduce((acc, d) => acc + Number(d.saldo_pendiente || 0), 0);
    const thisMonth = new Date().toISOString().slice(0, 7);
    const cobradoMes = movimientos.filter((m) => m.tipo_movimiento === 'Cobro' && (m.fecha || '').startsWith(thisMonth)).reduce((acc, m) => acc + Number(m.monto || 0), 0);
    const pagadoMes = movimientos.filter((m) => m.tipo_movimiento === 'Pago' && (m.fecha || '').startsWith(thisMonth)).reduce((acc, m) => acc + Number(m.monto || 0), 0);
    return { disponible, porCobrar, porPagar, cobradoMes, pagadoMes, proyectado: disponible + porCobrar - porPagar };
  }, [cuentas, documentos, movimientos]);

  const docsFiltrados = useMemo(() => {
    // Nunca mostrar documentos anulados en las vistas de cobros/pagos
    const activos = documentos.filter((d) => d.estado !== 'Anulado');
    if (mode === 'cobros') return activos.filter((d) => d.tipo_documento === 'Cuenta por cobrar');
    if (mode === 'pagos') return activos.filter((d) => d.tipo_documento === 'Cuenta por pagar');
    return activos;
  }, [documentos, mode]);

  const handleCrearCuenta = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      // Construir el nombre y tipo final según la selección
      const esCaja = cuentaForm.tipo === 'Caja';
      const esOtro = cuentaForm.banco_seleccionado === 'Otro (nombre personalizado)';
      const nombreFinal = esCaja
        ? (cuentaForm.nombre || 'Caja')
        : (esOtro ? cuentaForm.nombre : cuentaForm.banco_seleccionado);
      const tipoFinal = esCaja ? 'Caja' : `Banco ${cuentaForm.tipo_cuenta}`;

      const { error } = await supabase.from('cuentas_financieras').insert({
        id_empresa: empresaId,
        nombre: nombreFinal,
        tipo: tipoFinal,
        saldo_inicial: parseFloat(cuentaForm.saldo_inicial) || 0,
        moneda: cuentaForm.moneda,
        numero_referencia: cuentaForm.numero_referencia || null,
      });
      if (error) throw error;
      setCuentaForm({ banco_seleccionado: 'Banco Pichincha', nombre: '', tipo: 'Banco', tipo_cuenta: 'Ahorro', saldo_inicial: '0', moneda: 'USD', numero_referencia: '' });
      setShowCuentaForm(false);
      setMessage('Cuenta bancaria registrada exitosamente.');
      await queryClient.invalidateQueries({ queryKey: ['tesoreria', empresaId] });
    } catch (error: any) {
      setMessage(error.message || 'No se pudo crear la cuenta.');
    } finally { setSaving(false); }
  };

  const handleCrearDocumento = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const total = parseFloat(docForm.total) || 0;
      const { error } = await supabase.from('tesoreria_documentos').insert({
        id_empresa: empresaId,
        id_entidad: docForm.id_entidad || null,
        tipo_documento: docForm.tipo_documento,
        fecha_emision: docForm.fecha_emision,
        fecha_vencimiento: docForm.fecha_vencimiento || null,
        concepto: docForm.concepto,
        referencia: docForm.referencia || null,
        total,
        saldo_pendiente: total,
        estado: 'Pendiente',
        origen: 'Manual'
      });
      if (error) throw error;
      setDocForm({ tipo_documento: mode === 'pagos' ? 'Cuenta por pagar' : 'Cuenta por cobrar', fecha_emision: new Date().toISOString().slice(0, 10), fecha_vencimiento: '', id_entidad: '', concepto: '', referencia: '', total: '' });
      setMessage('Documento de tesorería registrado.');
      await queryClient.invalidateQueries({ queryKey: ['tesoreria', empresaId] });
    } catch (error: any) {
      setMessage(error.message || 'No se pudo crear el documento.');
    } finally { setSaving(false); }
  };

  const handleRegistrarMovimiento = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const target = movForm.id_documento ? documentos.find((d) => d.id === movForm.id_documento) : null;
      const monto = parseFloat(movForm.monto) || 0;
      const { data: mov, error } = await supabase.from('tesoreria_movimientos').insert({
        id_empresa: empresaId,
        fecha: movForm.fecha,
        tipo_movimiento: movForm.tipo_movimiento,
        concepto: movForm.concepto,
        monto,
        id_cuenta_financiera: movForm.id_cuenta_financiera || null,
        id_entidad: movForm.id_entidad || null,
        id_documento: movForm.id_documento || null,
        referencia: movForm.referencia || null,
        estado: movForm.estado,
        origen: 'Manual'
      }).select('id_documento').single();
      if (error) throw error;

      if (mov?.id_documento && target) {
        const nuevoSaldo = Math.max(0, Number(target.saldo_pendiente || 0) - monto);
        const estado = nuevoSaldo === 0 ? 'Liquidado' : 'Parcial';
        await supabase.from('tesoreria_documentos').update({ saldo_pendiente: nuevoSaldo, estado }).eq('id', target.id);
      }

      // AUTOMATIZACIÓN DE ASIENTO CONTABLE
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: qCuentas } = await supabase.from('plan_cuentas').select('id, codigo_cuenta, nombre').eq('id_empresa', empresaId);
        if (qCuentas) {
          const ctasBancos = qCuentas.filter(c => c.codigo_cuenta.startsWith('1.1.1') || c.nombre.toLowerCase().includes('banco') || c.nombre.toLowerCase().includes('caja'));
          const ctasCobrar = qCuentas.filter(c => c.codigo_cuenta.startsWith('1') && !c.codigo_cuenta.startsWith('1.1.1') && (c.codigo_cuenta.startsWith('1.1.2') || c.nombre.toLowerCase().includes('cobrar') || c.nombre.toLowerCase().includes('cliente')));
          const ctasPagar = qCuentas.filter(c => c.codigo_cuenta.startsWith('2') && (c.codigo_cuenta.startsWith('2.1') || c.nombre.toLowerCase().includes('pagar') || c.nombre.toLowerCase().includes('proveedor')));

          const bancoId = movForm.id_cuenta_banco_contable || ctasBancos[0]?.id;
          let cxcId = ctasCobrar[0]?.id;
          let cxpId = ctasPagar[0]?.id;

          // Si el documento origen es de un XML (origen !== 'Manual'),
          // intentamos buscar la transacción contable de la factura para usar
          // exactamente la misma cuenta de Proveedor / Cliente que se utilizó.
          if (target && target.origen !== 'Manual') {
            try {
              const { data: invTx } = await supabase
                .from('transacciones')
                .select(`
                  id,
                  movimientos (
                    id_cuenta,
                    debe,
                    haber
                  )
                `)
                .eq('id_empresa', empresaId)
                .eq('id_entidad', target.id_entidad)
                .like('concepto', `%${target.referencia}%`)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

              if (invTx && invTx.movimientos) {
                if (movForm.tipo_movimiento === 'Pago') {
                  // Pago: la cuenta contable del proveedor es la que se acreditó en la compra (haber > 0)
                  const matchedAcc = invTx.movimientos.find((m: any) => m.haber > 0);
                  if (matchedAcc) {
                    cxpId = matchedAcc.id_cuenta;
                  }
                } else if (movForm.tipo_movimiento === 'Cobro') {
                  // Cobro: la cuenta contable del cliente es la que se debitó en la venta (debe > 0)
                  const matchedAcc = invTx.movimientos.find((m: any) => m.debe > 0);
                  if (matchedAcc) {
                    cxcId = matchedAcc.id_cuenta;
                  }
                }
              }
            } catch (err) {
              console.error('Error al recuperar la cuenta contable de la factura original:', err);
            }
          }

          if (bancoId && ((movForm.tipo_movimiento === 'Cobro' && cxcId) || (movForm.tipo_movimiento === 'Pago' && cxpId))) {
            const nextNum = await getNextNumeroComprobante(empresaId);
            const refText = movForm.referencia ? ` (Ref: ${movForm.referencia})` : '';
            const conceptoAsiento = (movForm.concepto || `${movForm.tipo_movimiento} de Tesorería`) + refText;

            const { data: transaccion } = await supabase.from('transacciones').insert({
              id_empresa: empresaId,
              id_usuario: user.id,
              fecha: movForm.fecha,
              concepto: conceptoAsiento,
              tipo_comprobante: movForm.tipo_movimiento === 'Cobro' ? 'Ingreso' : 'Egreso',
              numero_comprobante: nextNum,
              id_entidad: movForm.id_entidad || null
            }).select('id').single();

            if (transaccion) {
              const payloadMovimientos = [];
              if (movForm.tipo_movimiento === 'Cobro') {
                payloadMovimientos.push({ id_transaccion: transaccion.id, id_cuenta: bancoId, debe: monto, haber: 0, id_empresa: empresaId });
                payloadMovimientos.push({ id_transaccion: transaccion.id, id_cuenta: cxcId, debe: 0, haber: monto, id_empresa: empresaId });
              } else {
                payloadMovimientos.push({ id_transaccion: transaccion.id, id_cuenta: cxpId, debe: monto, haber: 0, id_empresa: empresaId });
                payloadMovimientos.push({ id_transaccion: transaccion.id, id_cuenta: bancoId, debe: 0, haber: monto, id_empresa: empresaId });
              }
              await supabase.from('movimientos').insert(payloadMovimientos);
            }
          }
        }
      }

      setMovForm({ fecha: new Date().toISOString().slice(0, 10), tipo_movimiento: mode === 'pagos' ? 'Pago' : 'Cobro', concepto: '', monto: '', id_cuenta_financiera: '', id_cuenta_banco_contable: '', id_entidad: '', id_documento: '', referencia: '', estado: 'Aplicado' });
      setMessage('Movimiento registrado contable y financieramente.');
      await queryClient.invalidateQueries({ queryKey: ['tesoreria', empresaId] });
    } catch (error: any) {
      setMessage(error.message || 'No se pudo registrar el movimiento.');
    } finally { setSaving(false); }
  };

  const handleAnularMovimientoTesoreria = async (movId: string) => {
    const reason = prompt("Por favor, ingresa el motivo de la anulación:");
    if (reason === null) return;
    
    setSaving(true);
    setMessage('');
    try {
      const { data: mov, error: fError } = await supabase
        .from('tesoreria_movimientos')
        .select('*, entidades(razon_social)')
        .eq('id', movId)
        .single();
      if (fError || !mov) throw new Error("No se pudo encontrar el movimiento de tesorería.");

      const { error: updMovErr } = await supabase
        .from('tesoreria_movimientos')
        .update({ estado: 'Anulado' })
        .eq('id', movId);
      if (updMovErr) throw updMovErr;

      if (mov.id_documento) {
        const { data: doc } = await supabase
          .from('tesoreria_documentos')
          .select('saldo_pendiente, total, estado')
          .eq('id', mov.id_documento)
          .single();
        if (doc) {
          const nuevoSaldo = Math.min(Number(doc.total), Number(doc.saldo_pendiente || 0) + Number(mov.monto));
          const nuevoEstado = nuevoSaldo === Number(doc.total) ? 'Pendiente' : 'Parcial';
          await supabase
            .from('tesoreria_documentos')
            .update({ saldo_pendiente: nuevoSaldo, estado: nuevoEstado })
            .eq('id', mov.id_documento);
        }
      }

      let txId = null;
      let txConcepto = '';
      
      if (mov.referencia) {
        const { data: txs } = await supabase
          .from('transacciones')
          .select('id, concepto, numero_comprobante')
          .eq('id_empresa', empresaId)
          .eq('numero_comprobante', mov.referencia);
        if (txs && txs.length > 0) {
          txId = txs[0].id;
          txConcepto = txs[0].concepto;
        }
      }
      
      if (!txId) {
        const { data: txs } = await supabase
          .from('transacciones')
          .select('id, concepto, numero_comprobante, movimientos(debe, haber)')
          .eq('id_empresa', empresaId)
          .eq('id_entidad', mov.id_entidad)
          .eq('fecha', mov.fecha)
          .in('tipo_comprobante', ['Ingreso', 'Egreso']);
        
        if (txs) {
          const matchedTx = txs.find(t => 
            (t.movimientos || []).some((m: any) => m.debe === Number(mov.monto) || m.haber === Number(mov.monto))
          );
          if (matchedTx) {
            txId = matchedTx.id;
            txConcepto = matchedTx.concepto;
          }
        }
      }

      if (txId) {
        const ahora = new Date().toLocaleString('es-EC', { 
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit', second: '2-digit' 
        });
        
        const cleanConcept = txConcepto.startsWith('[ANULADO]') ? txConcepto.replace(/^\[ANULADO\]\s*/, '') : txConcepto;
        const valOrig = { total: Number(mov.monto) };
        const newConcepto = `[ANULADO] Motivo: ${reason || 'No especificado'} | Fecha: ${ahora} | ${cleanConcept} | ValoresOriginales: ${JSON.stringify(valOrig)}`;
        
        await supabase
          .from('transacciones')
          .update({ concepto: newConcepto, tipo_comprobante: 'Anulado' })
          .eq('id', txId);

        await supabase
          .from('movimientos')
          .delete()
          .eq('id_transaccion', txId);
      }

      setMessage('Movimiento anulado en tesorería y contabilidad.');
      await queryClient.invalidateQueries({ queryKey: ['tesoreria', empresaId] });
    } catch (err: any) {
      console.error(err);
      setMessage(err.message || 'No se pudo anular el movimiento.');
    } finally {
      setSaving(false);
    }
  };

  // --- RENDERIZADO POR MODOS ---

  const renderResumen = () => (
    <div className="space-y-6" style={{ animation: 'fadeIn 0.5s ease' }}>
      <header>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.5, fontSize: '0.8rem', marginBottom: 8 }}>
            <Landmark size={14} /> Panorama Financiero
        </div>
        <h2 className="h1" style={{ fontSize: '2.2rem' }}>Centro de Mando de Tesorería</h2>
        <p className="text-sec">Visión general del efectivo, obligaciones y liquidez de la empresa.</p>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16 }}>
        {[
          { label: 'Efectivo Disponible', value: summary.disponible, icon: Wallet },
          { label: 'Cuentas por Cobrar', value: summary.porCobrar, icon: ArrowDownCircle },
          { label: 'Cuentas por Pagar', value: summary.porPagar, icon: ArrowUpCircle },
          { label: 'Liquidez Proyectada', value: summary.proyectado, icon: Repeat },
        ].map((item) => (
          <div key={item.label} className="glass-card" style={{ padding: 20 }}>
            <div className="flex-between">
              <div>
                <div style={cardTitle}>{item.label}</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 900, marginTop: 8, color: item.value < 0 ? 'var(--error)' : 'var(--text-main)' }}>${item.value.toFixed(2)}</div>
              </div>
              <div style={{ width: 48, height: 48, borderRadius: 16, background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <item.icon size={24} />
              </div>
            </div>
          </div>
        ))}
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24 }}>
          {/* Cuentas Bancarias */}
          <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0 }}>Cuentas Bancarias</h3>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-sec)', marginTop: 2 }}>Bancos, cajas y cooperativas</div>
              </div>
              <button
                  style={{ background: showCuentaForm ? 'var(--error)' : 'var(--primary)', border: 'none', color: '#000', fontWeight: 800, cursor: 'pointer', fontSize: '0.78rem', padding: '6px 14px', borderRadius: 8 }}
                  onClick={() => setShowCuentaForm(v => !v)}
              >
                  {showCuentaForm ? '✕ Cancelar' : '+ Nueva Cuenta'}
              </button>
            </div>

            {showCuentaForm && (
              <form onSubmit={handleCrearCuenta} style={{ padding: 20, background: 'var(--primary-light)', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ marginBottom: 14, fontWeight: 800, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Building2 size={16} color="var(--primary)" /> Nueva Cuenta Financiera
                </div>

                {/* Tipo principal: Banco o Caja */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  {['Banco', 'Caja'].map(t => (
                    <button key={t} type="button"
                      onClick={() => setCuentaForm({...cuentaForm, tipo: t})}
                      style={{ flex: 1, padding: '10px', borderRadius: 10, border: `2px solid ${cuentaForm.tipo === t ? 'var(--primary)' : 'var(--border-color)'}`, background: cuentaForm.tipo === t ? 'var(--primary)' : 'transparent', color: cuentaForm.tipo === t ? '#000' : 'var(--text-sec)', fontWeight: 800, cursor: 'pointer', fontSize: '0.85rem' }}
                    >
                      {t === 'Banco' ? '🏦 Banco / Cooperativa' : '💵 Caja / Efectivo'}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {cuentaForm.tipo === 'Banco' ? (
                    <>
                      {/* Seleccionar banco de Ecuador */}
                      <div>
                        <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-sec)', display: 'block', marginBottom: 4 }}>Institución Financiera</label>
                        <select
                          value={cuentaForm.banco_seleccionado}
                          onChange={e => setCuentaForm({...cuentaForm, banco_seleccionado: e.target.value, nombre: ''})}
                          style={inputStyle}
                        >
                          {BANCOS_ECUADOR.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                      </div>

                      {/* Nombre personalizado si eligió Otro */}
                      {cuentaForm.banco_seleccionado === 'Otro (nombre personalizado)' && (
                        <input
                          value={cuentaForm.nombre}
                          onChange={e => setCuentaForm({...cuentaForm, nombre: e.target.value})}
                          style={inputStyle}
                          placeholder="Nombre del banco o cooperativa"
                          required
                        />
                      )}

                      {/* Tipo de cuenta */}
                      <div>
                        <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-sec)', display: 'block', marginBottom: 4 }}>Tipo de Cuenta</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {['Ahorro', 'Corriente'].map(tc => (
                            <button key={tc} type="button"
                              onClick={() => setCuentaForm({...cuentaForm, tipo_cuenta: tc})}
                              style={{ flex: 1, padding: '9px', borderRadius: 8, border: `2px solid ${cuentaForm.tipo_cuenta === tc ? 'var(--primary)' : 'var(--border-color)'}`, background: cuentaForm.tipo_cuenta === tc ? 'var(--primary)' : 'transparent', color: cuentaForm.tipo_cuenta === tc ? '#000' : 'var(--text-sec)', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}
                            >
                              {tc === 'Ahorro' ? '🏷 Ahorro' : '💳 Corriente'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Número de cuenta */}
                      <div>
                        <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-sec)', display: 'block', marginBottom: 4 }}>Número de Cuenta</label>
                        <input
                          value={cuentaForm.numero_referencia}
                          onChange={e => setCuentaForm({...cuentaForm, numero_referencia: e.target.value})}
                          style={inputStyle}
                          placeholder="Ej. 2200123456"
                        />
                      </div>
                    </>
                  ) : (
                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-sec)', display: 'block', marginBottom: 4 }}>Nombre de la Caja</label>
                      <input
                        value={cuentaForm.nombre}
                        onChange={e => setCuentaForm({...cuentaForm, nombre: e.target.value})}
                        style={inputStyle}
                        placeholder="Ej. Caja Principal, Caja Chica"
                        required
                      />
                    </div>
                  )}

                  {/* Saldo inicial */}
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-sec)', display: 'block', marginBottom: 4 }}>Saldo Inicial ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={cuentaForm.saldo_inicial}
                      onChange={e => setCuentaForm({...cuentaForm, saldo_inicial: e.target.value})}
                      style={{...inputStyle, fontWeight: 800}}
                      placeholder="0.00"
                      required
                    />
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 4 }} disabled={saving}>
                    {saving ? 'Guardando...' : '✓ Registrar Cuenta'}
                  </button>
                </div>
              </form>
            )}

            {/* Lista de cuentas registradas */}
            <div style={{ padding: cuentas.length === 0 ? 24 : '12px 0' }}>
              {cuentas.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-sec)', fontSize: '0.85rem' }}>
                  <Building2 size={32} style={{ opacity: 0.3, display: 'block', margin: '0 auto 8px' }} />
                  Sin cuentas registradas.<br />
                  <span style={{ fontSize: '0.75rem' }}>Haz clic en "+ Nueva Cuenta" para agregar tu banco.</span>
                </div>
              ) : cuentas.map((c: any) => {
                const esCaja = c.tipo === 'Caja';
                const tipoBadge = c.tipo?.replace('Banco ', '') || c.tipo;
                const numCta = c.numero_referencia;
                const numMask = numCta && numCta.length > 4 ? '···' + numCta.slice(-4) : numCta;
                return (
                  <div key={c.id} style={{ padding: '14px 20px', borderBottom: '1px dashed var(--border-color)', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: esCaja ? 'rgba(16,185,129,0.12)' : 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {esCaja ? <Banknote size={18} color="var(--success)" /> : <Building2 size={18} color="var(--primary)" />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nombre}</div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '2px 7px', borderRadius: 6, background: esCaja ? 'rgba(16,185,129,0.12)' : 'var(--primary-light)', color: esCaja ? 'var(--success)' : 'var(--primary)', textTransform: 'uppercase' }}>
                          {tipoBadge}
                        </span>
                        {numMask && <span style={{ fontSize: '0.7rem', color: 'var(--text-sec)', fontFamily: 'monospace' }}>{numMask}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontWeight: 900, fontSize: '1rem' }}>${Number(c.saldo_inicial).toFixed(2)}</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-sec)' }}>saldo inicial</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Últimos Movimientos Generales */}
          <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="flex-between" style={{ padding: 20, borderBottom: '1px solid var(--border-color)' }}>
              <div>
                <h3 style={{ margin: 0 }}>Flujo de Caja Reciente</h3>
                <p className="text-sec" style={{ margin: '6px 0 0' }}>Últimas entradas y salidas de dinero.</p>
              </div>
              <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--success)', marginRight: 16 }}>Entró: ${summary.cobradoMes.toFixed(2)}</span>
                  <span style={{ color: 'var(--warning)' }}>Salió: ${summary.pagadoMes.toFixed(2)}</span>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead><tr><th>Fecha</th><th>Tercero</th><th>Concepto</th><th>Importe</th></tr></thead>
                <tbody>
                  {movimientos.slice(0, 8).map((mov) => (
                    <tr key={mov.id}>
                      <td style={{ padding: '12px 16px', fontSize: '0.85rem' }}>{mov.fecha}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>{mov.entidades?.razon_social || 'N/A'}</td>
                      <td style={{ padding: '12px 16px' }}>{mov.concepto}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 800, color: mov.tipo_movimiento === 'Cobro' ? 'var(--success)' : 'var(--text-main)', textAlign: 'right' }}>
                          {mov.tipo_movimiento === 'Cobro' ? '+' : '-'}${Number(mov.monto).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  {movimientos.length === 0 && <tr><td colSpan={4} style={{ padding: 28, textAlign: 'center', color: 'var(--text-sec)' }}>Sin movimientos.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
      </div>
    </div>
  );

  const renderCobrosPagos = () => {
    const isCobro = mode === 'cobros';
    const color = isCobro ? 'var(--success)' : 'var(--error)';
    
    return (
    <div className="space-y-6" style={{ animation: 'fadeIn 0.5s ease' }}>
        <header className="flex-between" style={{ alignItems: 'flex-start' }}>
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.5, fontSize: '0.8rem', marginBottom: 8 }}>
                    {isCobro ? <ArrowDownCircle size={14} /> : <ArrowUpCircle size={14} />} 
                    Gestión de {isCobro ? 'Cobranzas' : 'Obligaciones'}
                </div>
                <h2 className="h1" style={{ fontSize: '2.2rem' }}>{isCobro ? 'Cuentas x Cobrar' : 'Cuentas x Pagar'}</h2>
                <p className="text-sec">Administra tus facturas y registra {isCobro ? 'recibos' : 'desembolsos'}.</p>
            </div>
            
            <div className="glass-card" style={{ padding: '16px 24px', textAlign: 'right', border: `1px solid ${color}33`, background: `${color}11` }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color, textTransform: 'uppercase' }}>Total {isCobro ? 'Por Cobrar' : 'Por Pagar'}</div>
                <div style={{ fontSize: '2rem', fontWeight: 900 }}>${isCobro ? summary.porCobrar.toFixed(2) : summary.porPagar.toFixed(2)}</div>
            </div>
        </header>

        <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: 24, alignItems: 'start' }}>
            {/* Lista de Documentos Pendientes */}
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: 20, borderBottom: '1px solid var(--border-color)' }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{isCobro ? 'Facturas de Clientes' : 'Facturas de Proveedores'}</h3>
                    <p className="text-sec" style={{ fontSize: '0.85rem' }}>Documentos con saldos pendientes.</p>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                    <thead><tr><th>Tercero</th><th>Referencia</th><th>Vence</th><th style={{ textAlign: 'right' }}>Saldo</th><th>Estado</th></tr></thead>
                    <tbody>
                        {docsFiltrados.map((doc) => (
                        <tr key={doc.id}>
                            <td style={{ padding: '14px 16px' }}>
                                <div style={{ fontWeight: 800 }}>{doc.entidades?.razon_social || 'Sin tercero'}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-sec)' }}>{doc.concepto}</div>
                            </td>
                            <td style={{ padding: '14px 16px', fontWeight: 600 }}>{doc.referencia}</td>
                            <td style={{ padding: '14px 16px', fontSize: '0.85rem' }}>
                                {doc.fecha_vencimiento}
                                {doc.fecha_vencimiento && new Date(doc.fecha_vencimiento) < new Date() && doc.saldo_pendiente > 0 && 
                                    <span style={{ color: 'var(--error)', marginLeft: 8, fontWeight: 800 }}>⚠️</span>}
                            </td>
                            <td style={{ padding: '14px 16px', fontWeight: 800, textAlign: 'right', color: doc.saldo_pendiente > 0 ? color : 'var(--text-main)' }}>
                                ${Number(doc.saldo_pendiente || 0).toFixed(2)}
                            </td>
                            <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', padding: '4px 8px', borderRadius: 999, background: doc.estado === 'Liquidado' ? 'rgba(16,185,129,0.1)' : 'var(--primary-light)', color: doc.estado === 'Liquidado' ? 'var(--success)' : 'var(--primary)', fontWeight: 800 }}>{doc.estado}</span>
                            </td>
                        </tr>
                        ))}
                        {docsFiltrados.length === 0 && <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'var(--text-sec)', fontWeight: 600 }}>No hay documentos pendientes aquí.</td></tr>}
                    </tbody>
                    </table>
                </div>
            </div>

            {/* Panel de Operaciones (Añadir Documento o Registrar Pago) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                
                {/* 1. Registrar Operación */}
                <form className="glass-card" onSubmit={handleRegistrarMovimiento} style={{ border: `1px solid var(--primary)` }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CheckCircle2 color="var(--primary)" /> {isCobro ? 'Aplicar Cobro' : 'Aplicar Pago'}
                    </h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div>
                            <label className="text-sec" style={{ fontSize: '0.75rem', fontWeight: 800 }}>Documento a saldar</label>
                            <select value={movForm.id_documento} onChange={e => {
                                const did = e.target.value;
                                const doc = docsFiltrados.find(d => d.id === did);
                                setMovForm({...movForm, id_documento: e.target.value, id_entidad: doc?.entidades?.id || movForm.id_entidad, monto: doc ? String(doc.saldo_pendiente) : movForm.monto});
                            }} style={inputStyle}>
                                <option value="">Selecciona (Factura/Deuda)</option>
                                {docsFiltrados.filter(d => d.saldo_pendiente > 0).map(doc => <option key={doc.id} value={doc.id}>{doc.entidades?.razon_social} - {doc.referencia} (${Number(doc.saldo_pendiente).toFixed(2)})</option>)}
                            </select>
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div>
                                <label className="text-sec" style={{ fontSize: '0.75rem', fontWeight: 800 }}>Monto a aplicar ($)</label>
                                <input value={movForm.monto} onChange={e => setMovForm({...movForm, monto: e.target.value})} style={{...inputStyle, fontWeight: 900, color}} required />
                            </div>
                            <div>
                                <label className="text-sec" style={{ fontSize: '0.75rem', fontWeight: 800 }}>Fecha</label>
                                <input type="date" value={movForm.fecha} onChange={e => setMovForm({...movForm, fecha: e.target.value})} style={inputStyle} required />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                             <div>
                                <label className="text-sec" style={{ fontSize: '0.75rem', fontWeight: 800 }}>Caja / Banco de Tesorería (Opcional)</label>
                                <select value={movForm.id_cuenta_financiera} onChange={e => {
                                    const fid = e.target.value;
                                    const selectedFinCta = cuentas.find(c => c.id === fid);
                                    let matchedContableId = movForm.id_cuenta_banco_contable;
                                    if (selectedFinCta) {
                                        const match = cuentasContablesBancos.find((cc: any) => 
                                            cc.nombre.toLowerCase().includes(selectedFinCta.nombre.toLowerCase()) ||
                                            selectedFinCta.nombre.toLowerCase().includes(cc.nombre.toLowerCase())
                                        );
                                        if (match) {
                                            matchedContableId = match.id;
                                        }
                                    }
                                    setMovForm({
                                        ...movForm, 
                                        id_cuenta_financiera: fid,
                                        id_cuenta_banco_contable: matchedContableId
                                    });
                                }} style={inputStyle}>
                                    <option value="">No deducir de panel</option>
                                    {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-sec" style={{ fontSize: '0.75rem', fontWeight: 800 }}>Cuenta Contable (Libro Diario)</label>
                                <div ref={dropdownRef} style={{ position: 'relative' }}>
                                    <input 
                                        value={searchAccount}
                                        onChange={e => {
                                            setSearchAccount(e.target.value);
                                            setIsDropdownOpen(true);
                                        }}
                                        onFocus={() => {
                                            setSearchAccount('');
                                            setIsDropdownOpen(true);
                                        }}
                                        placeholder="Buscar cuenta contable..."
                                        style={inputStyle}
                                        required={!movForm.id_cuenta_banco_contable}
                                    />
                                    <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: 0.6, fontSize: '0.8rem', color: 'var(--text-sec)' }}>
                                        ▼
                                    </span>
                                    
                                    {isDropdownOpen && (
                                        <div style={{ 
                                            position: 'absolute', 
                                            top: '100%', 
                                            left: 0, 
                                            right: 0, 
                                            maxHeight: '260px', 
                                            overflowY: 'auto', 
                                            background: '#0c101f', 
                                            border: '1px solid var(--border-color)', 
                                            borderRadius: '12px', 
                                            marginTop: '4px', 
                                            zIndex: 9999,
                                            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
                                        }}>
                                            {filteredCuentasContables.length === 0 ? (
                                                <div style={{ padding: '10px 12px', color: 'var(--text-sec)', fontSize: '0.85rem' }}>No se encontraron cuentas</div>
                                            ) : (
                                                filteredCuentasContables.map((c: any) => {
                                                    const isSelected = c.id === movForm.id_cuenta_banco_contable;
                                                    return (
                                                        <div 
                                                            key={c.id}
                                                            onClick={() => {
                                                                setMovForm({...movForm, id_cuenta_banco_contable: c.id});
                                                                setIsDropdownOpen(false);
                                                            }}
                                                            style={{ 
                                                                padding: '8px 12px', 
                                                                cursor: 'pointer', 
                                                                background: isSelected ? 'var(--primary-light)' : 'transparent',
                                                                color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                                                                fontSize: '0.85rem',
                                                                borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                                                                transition: 'background 0.2s',
                                                                textAlign: 'left'
                                                            }}
                                                            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; }}
                                                            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                                                        >
                                                            {c.codigo_cuenta} - {c.nombre}
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <input value={movForm.referencia} onChange={e => setMovForm({...movForm, referencia: e.target.value})} placeholder="Referencia bancaria / Voucher..." style={inputStyle} />
                        
                        <button className="btn btn-primary" type="submit" disabled={saving || !movForm.monto || !movForm.id_cuenta_banco_contable} style={{ width: '100%', marginTop: 8 }}>
                            Confirmar Operación
                        </button>
                    </div>
                </form>

                {/* 2. Añadir Documento Manual */}
                <form className="glass-card" onSubmit={handleCrearDocumento}>
                    <h3 style={{ margin: '0 0 16px', fontSize: '1rem', color: 'var(--text-sec)' }}>Añadir Documento Manual</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <select value={docForm.id_entidad} onChange={e => setDocForm({...docForm, id_entidad: e.target.value})} style={inputStyle} required>
                            <option value="">Seleccionar Tercero...</option>
                            {entities.map(e => <option key={e.id} value={e.id}>{e.razon_social}</option>)}
                        </select>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                           <input value={docForm.referencia} onChange={e => setDocForm({...docForm, referencia: e.target.value})} placeholder="Nº Factura / Ref" style={inputStyle} required />
                           <input value={docForm.total} onChange={e => setDocForm({...docForm, total: e.target.value})} placeholder="Total $" style={inputStyle} required />
                        </div>
                        <input type="date" value={docForm.fecha_vencimiento} onChange={e => setDocForm({...docForm, fecha_vencimiento: e.target.value})} style={inputStyle} />
                        <button className="btn" type="submit" disabled={saving || !docForm.total || !docForm.id_entidad}>Registrar Deuda</button>
                    </div>
                </form>
            </div>
        </section>

        {/* Historial de Movimientos de Tesorería */}
        <div className="glass-card" style={{ padding: 0, overflow: 'hidden', marginTop: 24 }}>
          <div style={{ padding: 20, borderBottom: '1px solid var(--border-color)' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem' }}>
              Historial de {isCobro ? 'Cobros' : 'Pagos'} Aplicados
            </h3>
            <p className="text-sec" style={{ fontSize: '0.85rem' }}>
              Últimas operaciones registradas. Puedes anular cualquier registro erróneo aquí.
            </p>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ padding: '12px 16px' }}>{isCobro ? 'Fecha de Cobro' : 'Fecha de Pago'}</th>
                  <th style={{ padding: '12px 16px' }}>Tercero y Documento</th>
                  <th style={{ padding: '12px 16px' }}>Factura Original</th>
                  <th style={{ padding: '12px 16px' }}>Detalles del {isCobro ? 'Cobro' : 'Pago'}</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Monto Aplicado</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {movimientos
                  .filter(m => m.tipo_movimiento === (isCobro ? 'Cobro' : 'Pago') && m.estado !== 'Anulado')
                  .map(mov => {
                    const doc = mov.documento;
                    const ent = mov.entidades;
                    
                    const formatEcuadorianDate = (dateStr: string) => {
                      if (!dateStr) return '—';
                      try {
                        const parts = dateStr.split('-');
                        if (parts.length === 3) {
                          return `${parts[2]}/${parts[1]}/${parts[0]}`;
                        }
                      } catch {}
                      return dateStr;
                    };

                    return (
                      <tr key={mov.id}>
                        {/* Fecha del Movimiento */}
                        <td style={{ padding: '16px', fontSize: '0.88rem', fontWeight: 600 }}>
                          {formatEcuadorianDate(mov.fecha)}
                        </td>
                        
                        {/* Tercero y Documento */}
                        <td style={{ padding: '16px' }}>
                          <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-main)' }}>
                            {ent?.razon_social || 'N/A'}
                          </div>
                          <div style={{ marginTop: 4 }}>
                            {doc ? (
                              <span style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: 4, 
                                fontSize: '0.75rem', 
                                color: 'var(--primary)', 
                                backgroundColor: 'rgba(99, 102, 241, 0.1)', 
                                border: '1px solid rgba(99, 102, 241, 0.2)', 
                                padding: '2px 8px', 
                                borderRadius: 12,
                                fontFamily: 'monospace',
                                fontWeight: 700
                              }}>
                                Factura: #{doc.referencia}
                              </span>
                            ) : (
                              <span style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: 4, 
                                fontSize: '0.72rem', 
                                color: 'var(--text-sec)', 
                                backgroundColor: 'rgba(255,255,255,0.05)', 
                                padding: '2px 8px', 
                                borderRadius: 12,
                                fontStyle: 'italic'
                              }}>
                                Anticipo / Sin Factura
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Factura Original */}
                        <td style={{ padding: '16px', fontSize: '0.85rem' }}>
                          {doc ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <div>
                                <span style={{ color: 'var(--text-sec)' }}>Total Factura:</span>{' '}
                                <strong style={{ color: 'var(--text-main)' }}>
                                  ${Number(doc.total || 0).toFixed(2)}
                                </strong>
                              </div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-sec)' }}>
                                Vencimiento: <span style={{ fontWeight: 600, color: '#f59e0b' }}>{formatEcuadorianDate(doc.fecha_vencimiento)}</span>
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-sec)', fontStyle: 'italic' }}>—</span>
                          )}
                        </td>

                        {/* Detalles del Pago */}
                        <td style={{ padding: '16px', fontSize: '0.85rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <div>
                              <span style={{ color: 'var(--text-sec)' }}>Concepto:</span>{' '}
                              <span style={{ color: 'var(--text-main)', fontStyle: mov.concepto ? 'normal' : 'italic' }}>
                                {mov.concepto || '—'}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.78rem' }}>
                              <span style={{ color: 'var(--text-sec)' }}>Ref. Pago / N° Documento:</span>{' '}
                              <strong style={{ fontFamily: 'monospace', color: 'var(--text-main)' }}>
                                {mov.referencia || '—'}
                              </strong>
                            </div>
                          </div>
                        </td>

                        {/* Monto Aplicado */}
                        <td style={{ padding: '16px', textAlign: 'right' }}>
                          <div style={{ 
                            fontWeight: 900, 
                            fontSize: '1.05rem', 
                            color: isCobro ? 'var(--success)' : 'var(--error)' 
                          }}>
                            {isCobro ? '+' : '-'}${Number(mov.monto).toFixed(2)}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-sec)', textTransform: 'uppercase', fontWeight: 700, marginTop: 2 }}>
                            {isCobro ? 'Monto Cobrado' : 'Monto Pagado'}
                          </div>
                        </td>

                        {/* Acciones */}
                        <td style={{ padding: '16px', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: 8 }}>
                            <button
                              className="btn"
                              style={{ 
                                padding: '8px 16px', 
                                background: 'rgba(59,130,246,0.1)', 
                                color: '#3b82f6', 
                                border: 'none', 
                                borderRadius: 10, 
                                cursor: 'pointer', 
                                fontWeight: 'bold', 
                                fontSize: '0.8rem',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.2)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.1)'; }}
                              onClick={() => handleOpenEditModal(mov)}
                              disabled={saving}
                            >
                              Editar
                            </button>
                            <button
                              className="btn"
                              style={{ 
                                padding: '8px 16px', 
                                background: 'rgba(239,68,68,0.1)', 
                                color: 'var(--error)', 
                                border: 'none', 
                                borderRadius: 10, 
                                cursor: 'pointer', 
                                fontWeight: 'bold', 
                                fontSize: '0.8rem',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                              onClick={() => handleAnularMovimientoTesoreria(mov.id)}
                              disabled={saving}
                            >
                              Anular
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                {movimientos.filter(m => m.tipo_movimiento === (isCobro ? 'Cobro' : 'Pago') && m.estado !== 'Anulado').length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--text-sec)' }}>
                      Sin movimientos recientes de {isCobro ? 'cobro' : 'pago'} aplicados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
    </div>
    );
  };

  const renderConciliacion = () => (
      <div className="space-y-6" style={{ animation: 'fadeIn 0.5s ease' }}>
        <header>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.5, fontSize: '0.8rem', marginBottom: 8 }}>
                <CheckCircle2 size={14} /> Auditoría
            </div>
            <h2 className="h1" style={{ fontSize: '2.2rem' }}>Conciliación Bancaria</h2>
            <p className="text-sec">Verifica que los saldos del sistema coincidan con tu estado de cuenta real.</p>
        </header>

        <section style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24, alignItems: 'start' }}>
            {/* Lista Bancos */}
            <div className="glass-card" style={{ padding: 0 }}>
                <div style={{ padding: 20, borderBottom: '1px solid var(--border-color)', background: 'var(--primary-light)' }}>
                    <h3 style={{ margin: 0, color: 'var(--primary)' }}>Saldos Contables</h3>
                    <div style={{ fontSize: '0.75rem', marginTop: 4, color: 'var(--text-main)' }}>Valores calculados por el sistema</div>
                </div>
                <div>
                   {cuentas.map(c => {
                       const c_movs = movimientos.filter(m => m.cuenta_financiera?.nombre === c.nombre);
                       const ingresos = c_movs.filter(m => m.tipo_movimiento === 'Cobro').reduce((a, b) => a + Number(b.monto), 0);
                       const egresos = c_movs.filter(m => m.tipo_movimiento === 'Pago').reduce((a, b) => a + Number(b.monto), 0);
                       const saldoFinal = Number(c.saldo_inicial) + ingresos - egresos;

                       return (
                       <div key={c.id} style={{ padding: 20, borderBottom: '1px solid var(--border-color)' }}>
                           <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 12 }}>{c.nombre}</div>
                           <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 6 }}>
                               <span className="text-sec">Inicial:</span> <span>${Number(c.saldo_inicial).toFixed(2)}</span>
                           </div>
                           <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 6, color: 'var(--success)' }}>
                               <span>Ingresos:</span> <span>+${ingresos.toFixed(2)}</span>
                           </div>
                           <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 12, color: 'var(--error)' }}>
                               <span>Egresos:</span> <span>-${egresos.toFixed(2)}</span>
                           </div>
                           <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 900, paddingTop: 12, borderTop: '1px dashed var(--border-color)' }}>
                               <span>Calculado:</span> <span>${saldoFinal.toFixed(2)}</span>
                           </div>
                       </div>
                       );
                   })}
                </div>
            </div>

            {/* Libro Auxiliar de Bancos */}
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: 20, borderBottom: '1px solid var(--border-color)' }}>
                    <h3 style={{ margin: 0 }}>Libro Auxiliar de Bancos</h3>
                    <p className="text-sec" style={{ margin: '6px 0 0' }}>Historial detallado para cotejar (Cartola).</p>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                        <thead><tr><th>Fecha / Ref</th><th>Cuenta</th><th>Concepto / Proveedor</th><th style={{ textAlign: 'right' }}>Cobros</th><th style={{ textAlign: 'right' }}>Pagos</th></tr></thead>
                        <tbody>
                            {movimientos.map(mov => (
                                <tr key={mov.id}>
                                    <td style={{ padding: '12px 16px' }}>
                                        <div style={{ fontWeight: 800 }}>{mov.fecha}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-sec)' }}>{mov.referencia || 'S/N'}</div>
                                    </td>
                                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{mov.cuenta_financiera?.nombre}</td>
                                    <td style={{ padding: '12px 16px' }}>
                                        <div>{mov.concepto}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-sec)' }}>{mov.entidades?.razon_social}</div>
                                    </td>
                                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: 'var(--success)' }}>
                                        {mov.tipo_movimiento === 'Cobro' ? `$${Number(mov.monto).toFixed(2)}` : ''}
                                    </td>
                                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: 'var(--error)' }}>
                                        {mov.tipo_movimiento === 'Pago' ? `$${Number(mov.monto).toFixed(2)}` : ''}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
      </div>
  );

  if (loading) return <div style={{ padding: '120px 0', width: '100%', display: 'flex', justifyContent: 'center' }}><Loader2 className="animate-spin" size={36} style={{ color: 'var(--primary)' }} /></div>;

  return (
      <div className="tesoreria-module">
          {message && <div style={{ background: 'var(--primary)', color: '#000', padding: 12, borderRadius: 12, fontWeight: 800, marginBottom: 20, animation: 'fadeIn 0.3s ease' }}>INFO: {message}</div>}
          
          {mode === 'resumen' && renderResumen()}
          {(mode === 'cobros' || mode === 'pagos') && renderCobrosPagos()}
          {mode === 'conciliacion' && renderConciliacion()}

          {/* Edit Modal */}
          {editingMov && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(5,8,16,0.85)', backdropFilter: 'blur(12px)', padding: '20px', boxSizing: 'border-box' }}>
                <div className="glass-card" style={{ padding: '28px', width: '90%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto' }}>
                    <h3 className="h1" style={{ fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: 8, marginBottom: '20px' }}>
                        <CheckCircle2 color="var(--primary)" /> Editar {editingMov.tipo_movimiento === 'Pago' ? 'Pago a Proveedor' : 'Cobro a Cliente'}
                    </h3>
                    
                    <form onSubmit={handleGuardarEdicionMovimiento} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div>
                                <label className="text-sec" style={{ fontSize: '0.75rem', fontWeight: 800 }}>Monto a aplicar ($)</label>
                                <input 
                                    type="number" 
                                    step="0.01" 
                                    value={editingMov.monto} 
                                    onChange={e => setEditingMov({...editingMov, monto: e.target.value})} 
                                    style={{...inputStyle, fontWeight: 900}} 
                                    required 
                                />
                            </div>
                            <div>
                                <label className="text-sec" style={{ fontSize: '0.75rem', fontWeight: 800 }}>Fecha</label>
                                <input 
                                    type="date" 
                                    value={editingMov.fecha} 
                                    onChange={e => setEditingMov({...editingMov, fecha: e.target.value})} 
                                    style={inputStyle} 
                                    required 
                                />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div>
                                <label className="text-sec" style={{ fontSize: '0.75rem', fontWeight: 800 }}>Caja / Banco de Tesorería (Opcional)</label>
                                <select 
                                    value={editingMov.id_cuenta_financiera} 
                                    onChange={e => setEditingMov({...editingMov, id_cuenta_financiera: e.target.value})} 
                                    style={inputStyle}
                                >
                                    <option value="">No deducir de panel</option>
                                    {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-sec" style={{ fontSize: '0.75rem', fontWeight: 800 }}>Cuenta Contable Banco (Libro Diario)</label>
                                <div ref={editBankRef} style={{ position: 'relative' }}>
                                    <input 
                                        value={searchEditBank}
                                        onChange={e => {
                                            setSearchEditBank(e.target.value);
                                            setIsEditBankOpen(true);
                                        }}
                                        onFocus={() => {
                                            setSearchEditBank('');
                                            setIsEditBankOpen(true);
                                        }}
                                        placeholder="Buscar cuenta banco..."
                                        style={inputStyle}
                                        required={!editingMov.id_cuenta_banco_contable}
                                    />
                                    <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: 0.6, fontSize: '0.8rem', color: 'var(--text-sec)' }}>
                                        ▼
                                    </span>
                                    
                                    {isEditBankOpen && (
                                        <div style={{ 
                                            position: 'absolute', 
                                            top: '100%', 
                                            left: 0, 
                                            right: 0, 
                                            maxHeight: '180px', 
                                            overflowY: 'auto', 
                                            background: '#0c101f', 
                                            border: '1px solid var(--border-color)', 
                                            borderRadius: '12px', 
                                            marginTop: '4px', 
                                            zIndex: 9999,
                                            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
                                        }}>
                                            {filteredEditBankCuentas.length === 0 ? (
                                                <div style={{ padding: '10px 12px', color: 'var(--text-sec)', fontSize: '0.85rem' }}>No se encontraron cuentas</div>
                                            ) : (
                                                filteredEditBankCuentas.map((c: any) => {
                                                    const isSelected = c.id === editingMov.id_cuenta_banco_contable;
                                                    return (
                                                        <div 
                                                            key={c.id}
                                                            onClick={() => {
                                                                setEditingMov({...editingMov, id_cuenta_banco_contable: c.id});
                                                                setIsEditBankOpen(false);
                                                            }}
                                                            style={{ 
                                                                padding: '8px 12px', 
                                                                cursor: 'pointer', 
                                                                background: isSelected ? 'var(--primary-light)' : 'transparent',
                                                                color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                                                                fontSize: '0.85rem',
                                                                borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                                                                textAlign: 'left'
                                                            }}
                                                            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; }}
                                                            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                                                        >
                                                            {c.codigo_cuenta} - {c.nombre}
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="text-sec" style={{ fontSize: '0.75rem', fontWeight: 800 }}>Referencia bancaria / Voucher</label>
                            <input 
                                value={editingMov.referencia} 
                                onChange={e => setEditingMov({...editingMov, referencia: e.target.value})} 
                                placeholder="Nº de transferencia, cheque, etc..." 
                                style={inputStyle} 
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 10 }}>
                            <button 
                                type="button" 
                                onClick={() => setEditingMov(null)} 
                                className="btn" 
                                style={{ padding: '10px 20px', borderRadius: 10 }}
                            >
                                Cancelar
                            </button>
                            <button 
                                type="submit" 
                                disabled={saving || !editingMov.monto || !editingMov.id_cuenta_banco_contable} 
                                className="btn btn-primary" 
                                style={{ padding: '10px 24px', borderRadius: 10 }}
                            >
                                {saving ? 'Guardando...' : 'Guardar Cambios'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
          )}
      </div>
  );
};
