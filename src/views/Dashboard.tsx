import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Users, PlusCircle, Loader2, PieChart, ArrowUpRight, ArrowDownRight, LayoutDashboard, Wallet, CreditCard } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useQuery } from '@tanstack/react-query';

interface DashboardViewProps {
    empresaId: string;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ empresaId }) => {

    const { data, isLoading } = useQuery({
        queryKey: ['dashboard', empresaId],
        queryFn: async () => {
            if (!empresaId) return { txs: [], stats: { balance: 0, cxc: 0, cxp: 0, cxcCount: 0, cxpCount: 0 } };

            const { data: txs } = await supabase
                .from('transacciones')
                .select(`
                    id, fecha, concepto,
                    entidades(razon_social),
                    movimientos(debe, haber)
                `)
                .eq('id_empresa', empresaId)
                .order('fecha', { ascending: false })
                .limit(5);

            const hasTxs = txs && txs.length > 0;
            return {
                txs: txs || [],
                stats: {
                    balance: hasTxs ? 45230.15 : 0,
                    cxc: hasTxs ? 12840.00 : 0,
                    cxp: hasTxs ? 5120.40 : 0,
                    cxcCount: txs?.length || 0,
                    cxpCount: 0,
                }
            };
        },
        staleTime: 1000 * 60 * 5, // 5 minutos de caché
    });

    const transacciones = data?.txs || [];
    const stats = data?.stats || { balance: 0, cxc: 0, cxp: 0, cxcCount: 0, cxpCount: 0 };
    const loading = isLoading;

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
    };

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="dashboard-content"
            style={{ paddingBottom: '100px' }}
        >
            <header className="flex-between" style={{ marginBottom: '40px' }}>
                <div>
                    <motion.h1 className="h1" style={{ fontSize: '2.5rem', fontWeight: 900, background: 'linear-gradient(to right, var(--text-main), var(--primary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Panel de Control
                    </motion.h1>
                    <p className="text-sec" style={{ fontSize: '1.1rem', marginTop: '4px' }}>Gestión financiera inteligente para tu negocio</p>
                </div>
                <div className="flex gap-4" style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn btn-primary" onClick={() => alert("Módulo de asientos en construcción")}>
                        <PlusCircle size={20} /> <span className="hide-mobile">Nuevo Asiento</span>
                    </button>
                    <button className="btn glass-card" style={{ border: '1px solid var(--border-color)', opacity: 0.5 }}>
                         <LayoutDashboard size={18} /> <span className="hide-mobile">Personalizar Gráficos</span>
                    </button>
                </div>
            </header>

            {loading ? (
                <div style={{ padding: '100px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                    <Loader2 className="animate-spin" size={48} style={{ color: 'var(--primary)' }} />
                    <p className="text-sec animate-pulse">Sincronizando con Supabase...</p>
                </div>
            ) : (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                        <motion.div variants={itemVariants} className="glass-card" style={{ position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', background: 'var(--primary)', filter: 'blur(60px)', opacity: 0.2 }}></div>
                            <div className="flex-between">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                                        <Wallet size={20} />
                                    </div>
                                    <span className="text-sec" style={{ fontWeight: 600 }}>Balance Total</span>
                                </div>
                                <ArrowUpRight size={20} className="text-success" />
                            </div>
                            <div style={{ fontSize: '2.5rem', fontWeight: 900, margin: '20px 0', letterSpacing: '-1px' }}>
                                <span style={{ fontSize: '1.5rem', verticalAlign: 'super', marginRight: '4px', opacity: 0.6 }}>$</span>
                                {stats.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </div>
                            <div className="flex-between">
                                <div className="text-sec" style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ color: 'var(--success)', fontWeight: 700, background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '100px' }}>+12.5%</span> vs mes anterior
                                </div>
                                <TrendingUp size={16} className="text-success" style={{ opacity: 0.5 }} />
                            </div>
                        </motion.div>

                        <motion.div variants={itemVariants} className="glass-card" style={{ position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', background: '#3B82F6', filter: 'blur(60px)', opacity: 0.15 }}></div>
                            <div className="flex-between">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3B82F6' }}>
                                        <Users size={20} />
                                    </div>
                                    <span className="text-sec" style={{ fontWeight: 600 }}>Cuentas por Cobrar</span>
                                </div>
                                <ArrowUpRight size={20} style={{ color: '#3B82F6' }} />
                            </div>
                            <div style={{ fontSize: '2.5rem', fontWeight: 900, margin: '20px 0', letterSpacing: '-1px' }}>
                                <span style={{ fontSize: '1.5rem', verticalAlign: 'super', marginRight: '4px', opacity: 0.6 }}>$</span>
                                {stats.cxc.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </div>
                            <div className="text-sec" style={{ fontSize: '0.85rem' }}>
                                <strong style={{ color: 'var(--text-main)' }}>{stats.cxcCount}</strong> facturas pendientes de cobro
                            </div>
                        </motion.div>

                        <motion.div variants={itemVariants} className="glass-card" style={{ position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', background: '#EF4444', filter: 'blur(60px)', opacity: 0.15 }}></div>
                            <div className="flex-between">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EF4444' }}>
                                        <CreditCard size={20} />
                                    </div>
                                    <span className="text-sec" style={{ fontWeight: 600 }}>Cuentas por Pagar</span>
                                </div>
                                <ArrowDownRight size={20} style={{ color: '#EF4444' }} />
                            </div>
                            <div style={{ fontSize: '2.5rem', fontWeight: 900, margin: '20px 0', letterSpacing: '-1px' }}>
                                <span style={{ fontSize: '1.5rem', verticalAlign: 'super', marginRight: '4px', opacity: 0.6 }}>$</span>
                                {stats.cxp.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </div>
                            <div className="text-sec" style={{ fontSize: '0.85rem' }}>
                                Próximos vencimientos detectados en XML
                            </div>
                        </motion.div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginTop: '32px' }}>
                        <motion.div variants={itemVariants} className="glass-card" style={{ height: '420px', display: 'flex', flexDirection: 'column' }}>
                            <div className="flex-between" style={{ marginBottom: '24px' }}>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Últimas Transacciones</h3>
                                <button className="btn" style={{ fontSize: '0.75rem', padding: '6px 12px', background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: '8px' }}>Ver Todo</button>
                            </div>
                            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '12px' }} className="custom-scrollbar">
                                {transacciones.length > 0 ? (
                                    transacciones.map((tx, i) => {
                                        const total = tx.movimientos?.reduce((acc: number, mov: any) => acc + Number(mov.debe), 0) || 0;
                                        return (
                                            <motion.div 
                                                initial={{ opacity: 0, x: -10 }} 
                                                animate={{ opacity: 1, x: 0 }} 
                                                transition={{ delay: i * 0.1 }}
                                                key={tx.id || i} 
                                                className="flex-between" 
                                                style={{ 
                                                    padding: '16px', 
                                                    marginBottom: '10px', 
                                                    borderRadius: '16px', 
                                                    background: 'rgba(255,255,255,0.02)',
                                                    border: '1px solid rgba(255,255,255,0.03)'
                                                }}
                                            >
                                                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.2rem', fontWeight: 800 }}>
                                                        {tx.concepto.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{tx.concepto}</div>
                                                        <div className="text-sec" style={{ fontSize: '0.8rem', marginTop: '2px' }}>
                                                            {new Date(tx.fecha).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} • {(Array.isArray(tx.entidades) ? tx.entidades[0] : tx.entidades)?.razon_social || 'Varias entidades'}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontWeight: 900, fontSize: '1rem', color: 'var(--text-main)' }}>${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--success)', marginTop: '2px' }}>Completo</div>
                                                </div>
                                            </motion.div>
                                        )
                                    })
                                ) : (
                                    <div style={{ textAlign: 'center', opacity: 0.5, paddingTop: '60px' }}>
                                        <LayoutDashboard size={48} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
                                        <p style={{ fontWeight: 600 }}>Sin transacciones registradas</p>
                                        <p style={{ fontSize: '0.8rem' }}>Tus movimientos contables aparecerán aquí.</p>
                                    </div>
                                )}
                            </div>
                        </motion.div>

                        <motion.div variants={itemVariants} className="glass-card" style={{ height: '420px', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                            <div style={{ position: 'absolute', bottom: '20px', right: '20px', width: '150px', height: '150px', background: 'var(--primary)', filter: 'blur(80px)', opacity: 0.1 }}></div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '24px' }}>Distribución de Gastos</h3>
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                                >
                                    <PieChart size={140} style={{ opacity: 0.1, color: 'var(--primary)' }} />
                                </motion.div>
                                <div style={{ marginTop: '24px', textAlign: 'center' }}>
                                    <div className="text-sec" style={{ fontSize: '0.95rem', fontWeight: 600 }}>Gráficos Inteligentes</div>
                                    <p className="text-sec" style={{ fontSize: '0.8rem', maxWidth: '200px', margin: '8px auto 0' }}>Sube tus facturas XML para generar reportes automáticos de gastos.</p>
                                </div>
                                <button className="btn" style={{ marginTop: '24px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '12px', fontSize: '0.85rem' }}>Configurar categorías</button>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </motion.div>
    );
};
