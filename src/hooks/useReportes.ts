import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabase';
import { generatePDFReport } from '../utils/pdfGenerator';

export interface Account { 
  id: string; 
  codigo_cuenta: string; 
  nombre: string; 
  tipo: string; 
}

export interface Movement { 
  id_cuenta: string; 
  debe: number; 
  haber: number; 
  fecha?: string; 
}

export interface CarteraDoc {
  id: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  tipo_documento: string;
  referencia: string;
  concepto: string;
  saldo_pendiente: number;
  total: number;
  estado: string;
  entidades: {
    id: string;
    razon_social: string;
    tipo_entidad: string;
    ruc_cedula?: string;
  } | null;
}

export interface TesoMovimiento {
  id: string;
  fecha: string;
  tipo_movimiento: string;
  concepto: string;
  monto: number;
  estado: string;
  referencia: string;
  cuentas_financieras: { nombre: string } | null;
  entidades: { razon_social: string } | null;
}

export interface SriDoc {
  id: string;
  es_compra: boolean;
  base_12: number;
  base_0: number;
  monto_iva: number;
  retenciones_aplicadas: any;
  transacciones: {
    fecha: string;
    concepto: string;
    tipo_comprobante: string;
    numero_comprobante: string;
    entidades: { ruc_cedula: string; razon_social: string } | null;
  } | null;
}

export const isDescendant = (parentCode: string, childCode: string) => {
  if (parentCode === childCode) return true;
  if (parentCode.includes('.') || childCode.includes('.')) {
    return childCode.startsWith(parentCode + '.');
  }
  return childCode.startsWith(parentCode);
};

export const useReportes = (empresaId: string) => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'balance' | 'resultado' | 'general' | 'mayor' | 'cartera' | 'flujo' | 'retenciones'>('balance');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [carteraDocs, setCarteraDocs] = useState<CarteraDoc[]>([]);
  const [tesoMovs, setTesoMovs] = useState<TesoMovimiento[]>([]);
  const [sriDocs, setSriDocs] = useState<SriDoc[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [soloConMov, setSoloConMov] = useState(false);
  const [expandedAccounts, setExpandedAccounts] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [accRes, movRes, carteraRes, tesoRes, sriRes] = await Promise.all([
          supabase.from('plan_cuentas').select('id,codigo_cuenta,nombre,tipo').eq('id_empresa', empresaId).order('codigo_cuenta'),
          supabase.from('movimientos').select('id_cuenta,debe,haber,transacciones(fecha)').eq('id_empresa', empresaId),
          supabase.from('tesoreria_documentos').select('id,fecha_emision,fecha_vencimiento,tipo_documento,referencia,concepto,saldo_pendiente,total,estado,entidades(id,razon_social,tipo_entidad,ruc_cedula)').eq('id_empresa', empresaId),
          supabase.from('tesoreria_movimientos').select('id,fecha,tipo_movimiento,concepto,monto,estado,referencia,cuentas_financieras(nombre),entidades(razon_social)').eq('id_empresa', empresaId),
          supabase.from('documentos_sri').select('id, es_compra, base_12, base_0, monto_iva, retenciones_aplicadas, transacciones(fecha, concepto, tipo_comprobante, numero_comprobante, entidades(ruc_cedula, razon_social))').eq('id_empresa', empresaId)
        ]);

        if (!accRes.error) setAccounts(accRes.data || []);
        if (!movRes.error) {
          setMovements((movRes.data || []).map((m: any) => ({
            ...m,
            debe: Number(m.debe || 0),
            haber: Number(m.haber || 0),
            fecha: Array.isArray(m.transacciones) ? m.transacciones[0]?.fecha : m.transacciones?.fecha
          })));
        }
        if (!carteraRes.error) setCarteraDocs(carteraRes.data as any || []);
        if (!tesoRes.error) setTesoMovs(tesoRes.data as any || []);
        if (!sriRes.error) setSriDocs(sriRes.data as any || []);

      } catch (err) {
        console.error("Error al cargar reportes:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [empresaId]);

  // Filtrado de movimientos por fecha
  const rawAccountMap = useMemo(() => {
    const map = new Map<string, { debeIni: number; haberIni: number; debePer: number; haberPer: number }>();
    accounts.forEach(acc => {
      map.set(acc.id, { debeIni: 0, haberIni: 0, debePer: 0, haberPer: 0 });
    });

    movements.forEach(m => {
      const accData = map.get(m.id_cuenta);
      if (accData) {
        const f = m.fecha || '';
        const isBefore = desde && f < desde;
        const isInPeriod = (!desde || f >= desde) && (!hasta || f <= hasta);
        if (isBefore) {
          accData.debeIni += m.debe;
          accData.haberIni += m.haber;
        } else if (isInPeriod) {
          accData.debePer += m.debe;
          accData.haberPer += m.haber;
        }
      }
    });
    return map;
  }, [movements, accounts, desde, hasta]);

  // Generar Balance Acumulado y Flujos Jerárquicos
  const ledger = useMemo(() => {
    return accounts.map(acc => {
      let debeIni = 0;
      let haberIni = 0;
      let debePer = 0;
      let haberPer = 0;
      let hasMov = false;

      accounts.forEach(subAcc => {
        if (isDescendant(acc.codigo_cuenta, subAcc.codigo_cuenta)) {
          const raw = rawAccountMap.get(subAcc.id);
          if (raw) {
            debeIni += raw.debeIni;
            haberIni += raw.haberIni;
            debePer += raw.debePer;
            haberPer += raw.haberPer;
            if (raw.debeIni > 0 || raw.haberIni > 0 || raw.debePer > 0 || raw.haberPer > 0) {
              hasMov = true;
            }
          }
        }
      });

      const esDeudora = ['Activo', 'Gasto'].includes(acc.tipo);
      const saldoIni = esDeudora ? (debeIni - haberIni) : (haberIni - debeIni);
      const saldoFin = esDeudora ? (debeIni + debePer - (haberIni + haberPer)) : (haberIni + haberPer - (debeIni + debePer));

      const isParent = accounts.some(other => other.codigo_cuenta !== acc.codigo_cuenta && isDescendant(acc.codigo_cuenta, other.codigo_cuenta));

      return {
        ...acc,
        debeIni,
        haberIni,
        debe: debePer,
        haber: haberPer,
        saldoIni,
        saldo: saldoFin,
        hasMov,
        isParent
      };
    });
  }, [accounts, rawAccountMap]);

  const rootAccounts = useMemo(() => {
    return ledger.filter(acc => {
      return !accounts.some(other => other.codigo_cuenta !== acc.codigo_cuenta && isDescendant(other.codigo_cuenta, acc.codigo_cuenta));
    });
  }, [ledger, accounts]);

  const totals = useMemo(() => {
    const ingresos = rootAccounts.filter((item) => item.tipo === 'Ingreso').reduce((acc, item) => acc + item.saldo, 0);
    const gastos = rootAccounts.filter((item) => item.tipo === 'Gasto').reduce((acc, item) => acc + item.saldo, 0);
    const activos = rootAccounts.filter((item) => item.tipo === 'Activo').reduce((acc, item) => acc + item.saldo, 0);
    const pasivos = rootAccounts.filter((item) => item.tipo === 'Pasivo').reduce((acc, item) => acc + item.saldo, 0);
    const patrimonio = rootAccounts.filter((item) => item.tipo === 'Patrimonio').reduce((acc, item) => acc + item.saldo, 0);
    return { ingresos, gastos, utilidad: ingresos - gastos, activos, pasivos, patrimonio };
  }, [rootAccounts]);

  const filteredLedger = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return ledger.filter(item => {
      if (soloConMov && !item.hasMov) return false;
      if (term && !item.nombre.toLowerCase().includes(term) && !item.codigo_cuenta.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [ledger, searchTerm, soloConMov]);

  const carteraAgrupada = useMemo(() => {
    const map = new Map<string, { id: string; razonSocial: string; ruc: string; tipo: string; total: number; saldo: number; docsCount: number }>();
    
    carteraDocs.forEach(d => {
      if (!d.entidades) return;
      const key = d.entidades.id;
      const current = map.get(key) || {
        id: key,
        razonSocial: d.entidades.razon_social,
        ruc: d.entidades.ruc_cedula || '—',
        tipo: d.entidades.tipo_entidad,
        total: 0,
        saldo: 0,
        docsCount: 0
      };
      current.total += d.total;
      current.saldo += d.saldo_pendiente;
      if (d.saldo_pendiente > 0) current.docsCount++;
      map.set(key, current);
    });
    return Array.from(map.values());
  }, [carteraDocs]);

  const flowCategorized = useMemo(() => {
    let operacionIn = 0;
    let operacionOut = 0;
    let inversionIn = 0;
    let inversionOut = 0;
    let financiamientoIn = 0;
    let financiamientoOut = 0;

    tesoMovs.forEach(m => {
      if (desde && m.fecha < desde) return;
      if (hasta && m.fecha > hasta) return;

      const c = m.concepto.toLowerCase();
      const val = Number(m.monto || 0);

      const isFin = c.includes('prestamo') || c.includes('préstamo') || c.includes('socio') || c.includes('aporte') || c.includes('financiamiento') || c.includes('capital');
      const isInv = c.includes('activo fijo') || c.includes('maquinaria') || c.includes('vehiculo') || c.includes('mueble') || c.includes('equipo') || c.includes('computador');

      if (m.tipo_movimiento === 'Ingreso') {
        if (isFin) financiamientoIn += val;
        else if (isInv) inversionIn += val;
        else operacionIn += val;
      } else {
        if (isFin) financiamientoOut += val;
        else if (isInv) inversionOut += val;
        else operacionOut += val;
      }
    });

    return { operacionIn, operacionOut, inversionIn, inversionOut, financiamientoIn, financiamientoOut };
  }, [tesoMovs, desde, hasta]);

  const retencionesAgrupadas = useMemo(() => {
    const emitidas = new Map<string, { base: number; valor: number; count: number }>();
    const recibidas = new Map<string, { base: number; valor: number; count: number }>();

    sriDocs.forEach(doc => {
      const rets = doc.retenciones_aplicadas || [];
      if (!Array.isArray(rets)) return;

      rets.forEach((r: any) => {
        const cod = r.codigo || 'OTRO';
        const base = Number(r.base || 0);
        const valor = Number(r.valor || 0);

        const targetMap = doc.es_compra ? emitidas : recibidas;
        const current = targetMap.get(cod) || { base: 0, valor: 0, count: 0 };
        
        current.base += base;
        current.valor += valor;
        current.count++;
        targetMap.set(cod, current);
      });
    });

    return { 
      emitidas: Array.from(emitidas.entries()).map(([codigo, val]) => ({ codigo, ...val })),
      recibidas: Array.from(recibidas.entries()).map(([codigo, val]) => ({ codigo, ...val }))
    };
  }, [sriDocs]);

  const totalDebe = ledger.filter(i => !i.isParent).reduce((s, i) => s + i.debe, 0);
  const totalHaber = ledger.filter(i => !i.isParent).reduce((s, i) => s + i.haber, 0);
  const cuadrado = Math.abs(totalDebe - totalHaber) < 0.01 && totalDebe > 0;

  const toggleAccount = (code: string) => {
    setExpandedAccounts(prev => ({ ...prev, [code]: !prev[code] }));
  };

  const isVisibleByParentCollapse = (code: string) => {
    const parts = code.split('.');
    if (parts.length <= 1) return true;
    
    let currentPath = '';
    for (let i = 0; i < parts.length - 1; i++) {
      currentPath = currentPath ? `${currentPath}.${parts[i]}` : parts[i];
      if (expandedAccounts[currentPath] === false) {
        return false;
      }
    }
    return true;
  };

  const exportBalanceCSV = () => {
    const rows = [['Código', 'Cuenta', 'Tipo', 'Saldo Inicial Deudor', 'Saldo Inicial Acreedor', 'Debe Período', 'Haber Período', 'Saldo Final Deudor', 'Saldo Final Acreedor']];
    filteredLedger.forEach(i => {
      const esDeudora = ['Activo', 'Gasto'].includes(i.tipo);
      const saldoIniD = esDeudora ? (i.saldoIni >= 0 ? i.saldoIni : 0) : (i.saldoIni < 0 ? -i.saldoIni : 0);
      const saldoIniA = esDeudora ? (i.saldoIni < 0 ? -i.saldoIni : 0) : (i.saldoIni >= 0 ? i.saldoIni : 0);
      const saldoFinD = esDeudora ? (i.saldo >= 0 ? i.saldo : 0) : (i.saldo < 0 ? -i.saldo : 0);
      const saldoFinA = esDeudora ? (i.saldo < 0 ? -i.saldo : 0) : (i.saldo >= 0 ? i.saldo : 0);
      rows.push([
        i.codigo_cuenta,
        `"${i.nombre}"`,
        i.tipo,
        saldoIniD.toFixed(2),
        saldoIniA.toFixed(2),
        i.debe.toFixed(2),
        i.haber.toFixed(2),
        saldoFinD.toFixed(2),
        saldoFinA.toFixed(2)
      ]);
    });
    const csv = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a'); a.href = encodeURI(csv);
    a.download = `Balance_Comprobacion_${desde || 'inicio'}_${hasta || 'fin'}.csv`;
    a.click();
  };

  const exportBalancePDF = async () => {
    const columns = ['Código', 'Cuenta', 'Saldo Inicial', 'Debe', 'Haber', 'Saldo Final'];
    const rows = filteredLedger.map(i => {
      const esDeudora = ['Activo', 'Gasto'].includes(i.tipo);
      return [
        i.codigo_cuenta,
        i.nombre,
        `$${i.saldoIni.toFixed(2)} ${esDeudora ? 'Db' : 'Cr'}`,
        `$${i.debe.toFixed(2)}`,
        `$${i.haber.toFixed(2)}`,
        `$${i.saldo.toFixed(2)} ${esDeudora ? 'Db' : 'Cr'}`
      ];
    });
    let subtitle = 'Balance de Comprobación Sumas y Saldos';
    if (desde || hasta) subtitle += ` (${desde || 'Inicio'} al ${hasta || 'Hoy'})`;
    await generatePDFReport(empresaId, 'Balance de Comprobación', subtitle, columns, rows, []);
  };

  return {
    loading,
    activeTab,
    setActiveTab,
    accounts,
    movements,
    carteraDocs,
    tesoMovs,
    sriDocs,
    searchTerm,
    setSearchTerm,
    desde,
    setDesde,
    hasta,
    setHasta,
    soloConMov,
    setSoloConMov,
    expandedAccounts,
    setExpandedAccounts,
    ledger,
    rootAccounts,
    totals,
    filteredLedger,
    carteraAgrupada,
    flowCategorized,
    retencionesAgrupadas,
    totalDebe,
    totalHaber,
    cuadrado,
    toggleAccount,
    isVisibleByParentCollapse,
    exportBalanceCSV,
    exportBalancePDF
  };
};
