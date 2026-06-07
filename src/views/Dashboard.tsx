import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, ArrowUpRight, ArrowDownRight, Wallet, Calendar } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

interface DashboardViewProps {
    empresaId: string;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export const DashboardView: React.FC<DashboardViewProps> = ({ empresaId }) => {
    const [selectedDate, setSelectedDate] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });

    const { data, isLoading } = useQuery({
        queryKey: ['dashboard', empresaId, selectedDate],
        queryFn: async () => {
            if (!empresaId) return null;

            const [year, month] = selectedDate.split('-').map(Number);
            const refDate = new Date(year, month - 1, 1);

            const sixMonthsAgo = new Date(refDate);
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
            sixMonthsAgo.setDate(1);
            const sixMonthsAgoStr = sixMonthsAgo.toISOString().slice(0, 10);

            const [txsRes, docsRes, movsRes] = await Promise.all([
                supabase.from('transacciones').select(`id, fecha, concepto, entidades(razon_social), movimientos(debe, haber)`).eq('id_empresa', empresaId).order('fecha', { ascending: false }).limit(5),
                supabase.from('tesoreria_documentos').select('tipo_documento, saldo_pendiente, fecha_vencimiento, entidades(razon_social)').eq('id_empresa', empresaId).gt('saldo_pendiente', 0).order('fecha_vencimiento', { ascending: true }),
                supabase.from('transacciones').select('fecha, movimientos(debe, haber, plan_cuentas(codigo_cuenta, nombre))').eq('id_empresa', empresaId).gte('fecha', sixMonthsAgoStr).lte('fecha', new Date(year, month, 0).toISOString().slice(0, 10))
            ]);

            const txs = txsRes.data || [];
            const docs = docsRes.data || [];
            const rawMovs = movsRes.data || [];

            const cxpDocs = docs.filter(d => d.tipo_documento === 'Cuenta por pagar' || d.tipo_documento === 'Factura de compra');
            const proximosVencimientos = cxpDocs.slice(0, 5);

            const currentMonth = refDate.getMonth();
            const currentYear = refDate.getFullYear();

            let ingresosMes = 0;
            let egresosMes = 0;

            const monthlyMap: Record<string, { name: string, Ingresos: number, Egresos: number }> = {};
            const gastosMap: Record<string, number> = {};

            for (let i = 5; i >= 0; i--) {
                const d = new Date(currentYear, currentMonth - i, 1);
                const key = `${d.getFullYear()}-${d.getMonth()}`;
                const name = d.toLocaleString('es-ES', { month: 'short' }).toUpperCase();
                monthlyMap[key] = { name, Ingresos: 0, Egresos: 0 };
            }

            rawMovs.forEach(tx => {
                const d = new Date(tx.fecha);
                const key = `${d.getFullYear()}-${d.getMonth()}`;
                const isCurrentMonth = d.getMonth() === currentMonth && d.getFullYear() === currentYear;

                tx.movimientos?.forEach((m: any) => {
                    const cod = m.plan_cuentas?.codigo_cuenta || '';
                    const isIngreso = cod.startsWith('4');
                    const isGasto = cod.startsWith('5') || cod.startsWith('6');

                    if (isIngreso) {
                        const val = Number(m.haber) || 0;
                        if (monthlyMap[key]) monthlyMap[key].Ingresos += val;
                        if (isCurrentMonth) ingresosMes += val;
                    } else if (isGasto) {
                        const val = Number(m.debe) || 0;
                        if (monthlyMap[key]) monthlyMap[key].Egresos += val;
                        if (isCurrentMonth) egresosMes += val;

                        if (isCurrentMonth) {
                            const catName = m.plan_cuentas?.nombre || 'Otros';
                            gastosMap[catName] = (gastosMap[catName] || 0) + val;
                        }
                    }
                });
            });

            const monthlyData = Object.values(monthlyMap);
            const gastosData = Object.keys(gastosMap).map(name => ({ name, value: gastosMap[name] })).sort((a, b) => b.value - a.value).slice(0, 5);

            return {
                txs,
                proximosVencimientos,
                ingresosMes,
                egresosMes,
                utilidadMes: ingresosMes - egresosMes,
                monthlyData,
                gastosData
            };
        },
        staleTime: 1000 * 60 * 5,
    });

    if (isLoading) {
        return (
            <div style={{ padding: '100px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                <Loader2 className="animate-spin" size={48} style={{ color: 'var(--primary)' }} />
                <p className="text-sec animate-pulse">Generando métricas en tiempo real...</p>
            </div>
        );
    }

    if (!data) return null;

    const { txs, proximosVencimientos, ingresosMes, egresosMes, utilidadMes, monthlyData, gastosData } = data;

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
    };

    const monthName = new Date(selectedDate + '-02').toLocaleString('es-ES', { month: 'long', year: 'numeric' });
    const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

    return (
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="dashboard-content" style={{ paddingBottom: '100px' }}>
            <header className="flex-between" style={{ marginBottom: '40px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <motion.h1 className="h1" style={{ fontSize: '2.5rem', fontWeight: 900, background: 'linear-gradient(to right, var(--text-main), var(--primary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Resumen Financiero
                    </motion.h1>
                    <p className="text-sec" style={{ fontSize: '1.1rem', marginTop: '4px' }}>Métricas en tiempo real de tu negocio</p>
                </div>
                <div>
                    <input
                        type="month"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        style={{ padding: '10px 16px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--input-bg)', color: 'var(--text-main)', fontSize: '1rem', fontWeight: 600, outline: 'none' }}
                    />
                </div>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                {/* INGRESOS DEL MES */}
                <motion.div variants={itemVariants} className="glass-card" style={{ position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', background: '#10B981', filter: 'blur(60px)', opacity: 0.15 }}></div>
                    <div className="flex-between">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981' }}>
                                <ArrowUpRight size={20} />
                            </div>
                            <span className="text-sec" style={{ fontWeight: 600 }}>Ingresos ({capitalizedMonth})</span>
                        </div>
                    </div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 900, margin: '20px 0', letterSpacing: '-1px' }}>
                        <span style={{ fontSize: '1.5rem', verticalAlign: 'super', marginRight: '4px', opacity: 0.6 }}>$</span>
                        {ingresosMes.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                </motion.div>

                {/* EGRESOS DEL MES */}
                <motion.div variants={itemVariants} className="glass-card" style={{ position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', background: '#EF4444', filter: 'blur(60px)', opacity: 0.15 }}></div>
                    <div className="flex-between">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EF4444' }}>
                                <ArrowDownRight size={20} />
                            </div>
                            <span className="text-sec" style={{ fontWeight: 600 }}>Egresos ({capitalizedMonth})</span>
                        </div>
                    </div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 900, margin: '20px 0', letterSpacing: '-1px' }}>
                        <span style={{ fontSize: '1.5rem', verticalAlign: 'super', marginRight: '4px', opacity: 0.6 }}>$</span>
                        {egresosMes.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                </motion.div>

                {/* UTILIDAD NETA */}
                <motion.div variants={itemVariants} className="glass-card" style={{ position: 'relative', overflow: 'hidden', border: `1px solid ${utilidadMes >= 0 ? '#10B981' : '#EF4444'}40` }}>
                    <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', background: utilidadMes >= 0 ? '#10B981' : '#EF4444', filter: 'blur(60px)', opacity: 0.15 }}></div>
                    <div className="flex-between">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: 40, height: 40, borderRadius: 12, background: utilidadMes >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: utilidadMes >= 0 ? '#10B981' : '#EF4444' }}>
                                <Wallet size={20} />
                            </div>
                            <span className="text-sec" style={{ fontWeight: 600 }}>Utilidad Neta ({capitalizedMonth})</span>
                        </div>
                    </div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 900, margin: '20px 0', letterSpacing: '-1px', color: utilidadMes >= 0 ? 'var(--text-main)' : '#EF4444' }}>
                        <span style={{ fontSize: '1.5rem', verticalAlign: 'super', marginRight: '4px', opacity: 0.6 }}>$</span>
                        {utilidadMes.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                </motion.div>
            </div>

            {/* GRAFICOS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '24px', marginTop: '24px' }}>
                {/* BAR CHART */}
                <motion.div variants={itemVariants} className="glass-card" style={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '24px' }}>Ingresos vs Egresos (6 Meses)</h3>
                    <div style={{ flex: 1, width: '100%', minHeight: 0 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                                <XAxis dataKey="name" stroke="var(--text-sec)" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="var(--text-sec)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value: number) => `$${value}`} />
                                <Tooltip cursor={{ fill: 'var(--bg-sec)' }} contentStyle={{ borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--card-bg)' }} />
                                <Legend />
                                <Bar dataKey="Ingresos" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                <Bar dataKey="Egresos" fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* PIE CHART */}
                <motion.div variants={itemVariants} className="glass-card" style={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '16px' }}>Distribución de Gastos ({capitalizedMonth})</h3>
                    <div style={{ flex: 1, width: '100%', minHeight: 0 }}>
                        {gastosData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={gastosData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value">
                                        {gastosData.map((_entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--card-bg)' }} formatter={(value: any) => [`$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, '']} />
                                    <Legend layout="vertical" verticalAlign="bottom" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-sec)', fontSize: '0.9rem' }}>
                                No hay gastos registrados en {capitalizedMonth}
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>

            {/* VENCIMIENTOS Y TRANSACCIONES */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '24px', marginTop: '24px' }}>

                {/* ALERTAS DE VENCIMIENTOS */}
                <motion.div variants={itemVariants} className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div className="flex-between" style={{ marginBottom: '24px' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Calendar size={20} className="text-danger" />
                            Próximos Pagos
                        </h3>
                    </div>
                    <div>
                        {proximosVencimientos.length > 0 ? (
                            proximosVencimientos.map((doc, i) => (
                                <div key={i} className="flex-between" style={{ padding: '12px 16px', marginBottom: '10px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{(doc.entidades as any)?.razon_social || 'Proveedor'}</div>
                                        <div className="text-danger" style={{ fontSize: '0.8rem', marginTop: '2px', fontWeight: 600 }}>
                                            Vence: {new Date(doc.fecha_vencimiento || new Date()).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                                        </div>
                                    </div>
                                    <div style={{ fontWeight: 900, fontSize: '1rem', color: '#EF4444' }}>
                                        ${Number(doc.saldo_pendiente).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div style={{ textAlign: 'center', opacity: 0.5, padding: '40px 0' }}>
                                <p style={{ fontWeight: 600 }}>Al día</p>
                                <p style={{ fontSize: '0.8rem' }}>No tienes pagos próximos pendientes.</p>
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* ULTIMOS ASIENTOS */}
                <motion.div variants={itemVariants} className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div className="flex-between" style={{ marginBottom: '24px' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Últimos Asientos</h3>
                    </div>
                    <div>
                        {txs.length > 0 ? (
                            txs.map((tx, i) => {
                                const total = tx.movimientos?.reduce((acc: number, mov: any) => acc + Number(mov.debe), 0) || 0;
                                return (
                                    <div key={tx.id || i} className="flex-between" style={{ padding: '12px 16px', marginBottom: '10px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.03)' }}>
                                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1rem', fontWeight: 800 }}>
                                                {tx.concepto.charAt(0)}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{tx.concepto}</div>
                                                <div className="text-sec" style={{ fontSize: '0.75rem', marginTop: '2px' }}>
                                                    {new Date(tx.fecha).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ' • ' + ((Array.isArray(tx.entidades) ? tx.entidades[0] : tx.entidades) as any)?.razon_social}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ fontWeight: 900, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                                            ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </div>
                                    </div>
                                )
                            })
                        ) : (
                            <div style={{ textAlign: 'center', opacity: 0.5, padding: '40px 0' }}>
                                <p style={{ fontWeight: 600 }}>Sin transacciones</p>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </motion.div>
    );
};
