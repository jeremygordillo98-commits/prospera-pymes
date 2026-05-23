import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, Loader2, UserPlus, LogIn, Eye, EyeOff, User, ArrowLeft } from 'lucide-react';

export const Login = () => {
    const [view, setView] = useState<'login' | 'register' | 'forgot'>('login');
    const [loading, setLoading] = useState(false);
    
    // Form fields
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    
    // UI states
    const [showPassword, setShowPassword] = useState(false);
    const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const mode = params.get('mode');
        if (mode === 'register') setView('register');
        else if (mode === 'forgot') setView('forgot');

        // Forzar tema oscuro al cargar Login
        document.documentElement.setAttribute('data-theme', 'dark');
        document.body.className = 'dark-theme';
    }, []);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            if (view === 'register') {
                if (password !== confirmPassword) throw new Error('Las contraseñas no coinciden.');
                if (password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');
                const { error } = await supabase.auth.signUp({ 
                    email, 
                    password, 
                    options: { 
                        data: { nombre_completo: name },
                        emailRedirectTo: window.location.origin 
                    } 
                });
                if (error) throw error;
                setMessage({ type: 'success', text: '¡Cuenta creada! Revisa tu correo electrónico para confirmar.' });
            } else if (view === 'login') {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
            } else if (view === 'forgot') {
                const { error } = await supabase.auth.resetPasswordForEmail(email, { 
                    redirectTo: `${window.location.origin}/update-password` 
                });
                if (error) throw error;
                setMessage({ type: 'success', text: 'Instrucciones enviadas a tu correo electrónico.' });
            }
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex-center" style={{ minHeight: '100vh', padding: '20px', background: '#0b1120' }} data-theme="dark">
            <div className="aurora-bg" style={{ background: '#0b1120' }}>
                <div className="orb orb-1"></div>
                <div className="orb orb-2"></div>
            </div>

            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card" 
                style={{ width: '100%', maxWidth: '420px', padding: '40px', position: 'relative', zIndex: 1 }}
            >
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{ width: 48, height: 48, background: 'var(--primary)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '1.5rem', margin: '0 auto 16px' }}>P</div>
                    <h1 className="h1" style={{ fontSize: '1.75rem', marginBottom: '8px' }}>
                        {view === 'login' ? 'Prospera Contable' : view === 'register' ? 'Crea tu cuenta' : 'Recuperar clave'}
                    </h1>
                    <p className="text-sec">
                        {view === 'login' ? 'Panel de Contabilidad Avanzada' : view === 'register' ? 'Inicia tu despacho inteligente' : 'Te ayudaremos a entrar de nuevo'}
                    </p>
                </div>

                <AnimatePresence mode="wait">
                    {message && message.type === 'success' && view !== 'login' ? (
                        <motion.div 
                            key="message"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            style={{ textAlign: 'center', padding: '20px 0' }}
                        >
                            <div style={{ color: 'var(--success)', marginBottom: '16px', fontWeight: 600 }}>{message.text}</div>
                            <button className="btn" onClick={() => { setMessage(null); setView('login'); }}>Ir al Login</button>
                        </motion.div>
                    ) : (
                        <motion.form 
                            key={`form-${view}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            onSubmit={handleAuth} 
                            style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}
                        >
                            {view === 'register' && (
                                <div className="input-group">
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-sec)' }}>Nombre Completo</label>
                                    <div style={{ position: 'relative', width: '100%' }}>
                                        <User size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sec)', opacity: 0.7 }} />
                                        <input 
                                            type="text" 
                                            placeholder="Juan Pérez" 
                                            required 
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            style={{ width: '100%', padding: '12px 12px 12px 42px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'white', outline: 'none', fontSize: '0.9rem', transition: 'all 0.3s ease' }}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="input-group">
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-sec)' }}>Correo Electrónico</label>
                                <div style={{ position: 'relative', width: '100%' }}>
                                    <Mail size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sec)', opacity: 0.7 }} />
                                    <input 
                                        type="email" 
                                        placeholder="hola@empresa.com" 
                                        required 
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        style={{ width: '100%', padding: '12px 12px 12px 42px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'white', outline: 'none', fontSize: '0.9rem', transition: 'all 0.3s ease' }}
                                    />
                                </div>
                            </div>

                            {view !== 'forgot' && (
                                <div className="input-group">
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-sec)' }}>Contraseña</label>
                                    <div style={{ position: 'relative', width: '100%' }}>
                                        <Lock size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sec)', opacity: 0.7 }} />
                                        <input 
                                            type={showPassword ? "text" : "password"} 
                                            placeholder="••••••••" 
                                            required 
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            style={{ width: '100%', padding: '12px 42px 12px 42px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'white', outline: 'none', fontSize: '0.9rem', transition: 'all 0.3s ease' }}
                                        />
                                        <button 
                                            type="button" 
                                            onClick={() => setShowPassword(!showPassword)} 
                                            style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-sec)', cursor: 'pointer', padding: 0, opacity: 0.7 }}
                                        >
                                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {view === 'register' && (
                                <div className="input-group">
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-sec)' }}>Confirmar Contraseña</label>
                                    <div style={{ position: 'relative', width: '100%' }}>
                                        <Lock size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sec)', opacity: 0.7 }} />
                                        <input 
                                            type={showPassword ? "text" : "password"} 
                                            placeholder="••••••••" 
                                            required 
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            style={{ width: '100%', padding: '12px 12px 12px 42px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'white', outline: 'none', fontSize: '0.9rem', transition: 'all 0.3s ease' }}
                                        />
                                    </div>
                                </div>
                            )}

                            {message && message.type === 'error' && (
                                <motion.div 
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    style={{ color: 'var(--error)', fontSize: '0.8rem', textAlign: 'center', fontWeight: 600 }}
                                >
                                    {message.text}
                                </motion.div>
                            )}

                            <button className="btn btn-primary" type="submit" disabled={loading} style={{ padding: '14px', width: '100%', justifyContent: 'center', margin: '10px 0', boxShadow: '0 8px 16px rgba(99, 102, 241, 0.2)' }}>
                                {loading ? <Loader2 size={18} className="animate-spin" /> : (
                                    view === 'login' ? <><LogIn size={18} /> Ingresar</> : 
                                    view === 'register' ? <><UserPlus size={18} /> Registrarme</> :
                                    <><Mail size={18} /> Enviar Instrucciones</>
                                )}
                            </button>
                        </motion.form>
                    )}
                </AnimatePresence>

                <div style={{ marginTop: '20px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {view === 'login' ? (
                        <>
                            <button onClick={() => setView('forgot')} style={{ background: 'none', border: 'none', color: 'var(--text-sec)', fontSize: '0.85rem', cursor: 'pointer' }}>
                                ¿Olvidaste tu contraseña?
                            </button>
                            <div style={{ color: 'var(--text-sec)', fontSize: '0.9rem' }}>
                                ¿No tienes cuenta? 
                                <button onClick={() => setView('register')} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 800, cursor: 'pointer', marginLeft: '6px' }}>Regístrate gratis</button>
                            </div>
                        </>
                    ) : view === 'register' ? (
                        <div style={{ color: 'var(--text-sec)', fontSize: '0.9rem' }}>
                            ¿Ya tienes cuenta? 
                            <button onClick={() => setView('login')} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 800, cursor: 'pointer', marginLeft: '6px' }}>Inicia sesión</button>
                        </div>
                    ) : (
                        <button onClick={() => setView('login')} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.9rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            <ArrowLeft size={16} /> Volver a login
                        </button>
                    )}
                </div>

                <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', textAlign: 'center' }}>
                    <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-sec)', fontSize: '0.8rem', textDecoration: 'none', fontWeight: 600, transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-sec)'}>
                        Términos y Condiciones (Aspectos Legales)
                    </a>
                </div>
            </motion.div>
        </div>
    );
};
