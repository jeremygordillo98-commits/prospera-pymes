import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Save, LogOut, Building2, Image as ImageIcon, Sun, Moon } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useTheme } from '../context/ThemeContext';

export const Perfil = () => {
    const { isDark, toggleTheme } = useTheme();
    const [loading, setLoading] = useState(false);
    const [userData, setUserData] = useState({
        nombre_completo: '',
        email: '',
        ruc_profesional: '',
        logo_url: ''
    });
    const [empresas, setEmpresas] = useState<any[]>([]);
    const [message, setMessage] = useState({ text: '', type: '' });

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            // Intentar cargar desde la tabla perfiles primero
            const { data: dbProfile } = await supabase
                .from('perfiles')
                .select('*')
                .eq('id_usuario', user.id)
                .single();

            // Cargar empresas del usuario
            const { data: dbEmpresas } = await supabase
                .from('empresas_gestionadas')
                .select('id, nombre_empresa, ruc_empresa, logo_url')
                .eq('id_usuario', user.id);

            setUserData({
                nombre_completo: dbProfile?.nombre_completo || user.user_metadata?.nombre_completo || '',
                email: user.email || '',
                ruc_profesional: dbProfile?.ruc_profesional || '',
                logo_url: dbProfile?.logo_url || ''
            });
            setEmpresas(dbEmpresas || []);
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ text: '', type: '' });

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No hay sesión activa');

            // 1. Actualizar metadata de Auth
            const { error: authError } = await supabase.auth.updateUser({
                data: { nombre_completo: userData.nombre_completo }
            });
            if (authError) throw authError;

            // 2. Actualizar o Insertar en tabla perfiles (upsert)
            const { error: dbError } = await supabase.from('perfiles').upsert({
                id_usuario: user.id,
                nombre_completo: userData.nombre_completo,
                email: userData.email,
                ruc_profesional: userData.ruc_profesional,
                logo_url: userData.logo_url
            });
            if (dbError) throw dbError;

            setMessage({ text: 'Perfil actualizado exitosamente', type: 'success' });
        } catch (error: any) {
            setMessage({ text: error.message, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
    };

    const inputStyle = {
        width: '100%',
        padding: '12px 16px',
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        color: 'var(--text-main)',
        outline: 'none',
        marginTop: '8px'
    };

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-2xl mx-auto mt-10">
            <header className="mb-8">
                <h2 className="h1">Mi Perfil Contable</h2>
                <p className="text-sec">Administra tu información profesional.</p>
            </header>

            <div className="glass-card" style={{ padding: '32px' }}>
                <div className="flex items-center gap-6 mb-8 pb-8" style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), #C026D3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 'bold', color: 'white' }}>
                        {userData.nombre_completo ? userData.nombre_completo.charAt(0).toUpperCase() : 'P'}
                    </div>
                    <div>
                        <h3 style={{ fontSize: '1.5rem', margin: '0 0 4px 0', fontWeight: 800 }}>{userData.nombre_completo || 'Usuario'}</h3>
                        <div className="text-sec flex items-center gap-2">
                            <Mail size={16} /> {userData.email}
                        </div>
                    </div>
                </div>

                {message.text && (
                    <div style={{ padding: '12px', borderRadius: '8px', marginBottom: '20px', background: message.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', color: message.type === 'error' ? 'var(--error)' : 'var(--success)', fontWeight: 600, fontSize: '0.9rem' }}>
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div>
                        <label style={{ fontWeight: 600, fontSize: '0.9rem' }} className="flex items-center gap-2">
                            <User size={18} /> Nombre de Despacho o Contador
                        </label>
                        <input
                            type="text"
                            value={userData.nombre_completo}
                            onChange={e => setUserData({ ...userData, nombre_completo: e.target.value })}
                            style={inputStyle}
                            placeholder="Ej: Ruiz & Asociados"
                            required
                        />
                    </div>

                    <div>
                        <label style={{ fontWeight: 600, fontSize: '0.9rem' }} className="flex items-center gap-2">
                            RUC Profesional o Firma
                        </label>
                        <input
                            type="text"
                            value={userData.ruc_profesional}
                            onChange={e => setUserData({ ...userData, ruc_profesional: e.target.value })}
                            style={inputStyle}
                            placeholder="Ej: 1712345678001"
                        />
                    </div>

                    <div>
                        <label style={{ fontWeight: 600, fontSize: '0.9rem' }} className="flex items-center gap-2">
                            <ImageIcon size={18} /> URL del Logo del Contador
                        </label>
                        <input
                            type="text"
                            value={userData.logo_url}
                            onChange={e => setUserData({ ...userData, logo_url: e.target.value })}
                            style={inputStyle}
                            placeholder="Ej: https://midominio.com/logo.png"
                        />
                    </div>

                    <div>
                        <label style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-sec)' }} className="flex items-center gap-2">
                            <Mail size={18} /> Correo de Acceso (No modificable)
                        </label>
                        <input
                            type="email"
                            value={userData.email}
                            disabled
                            style={{ ...inputStyle, opacity: 0.5, cursor: 'not-allowed' }}
                        />
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-sec)', marginTop: '6px' }}>
                            Para cambiar tu correo de acceso, por favor contacta a soporte.
                        </p>
                    </div>

                    <div className="flex gap-4 mt-6">
                        <button type="submit" className="btn btn-primary flex flex-1 items-center justify-center gap-2" disabled={loading}>
                            <Save size={18} /> {loading ? 'Actualizando...' : 'Guardar Cambios'}
                        </button>
                    </div>
                </form>
            </div>

            <div className="glass-card" style={{ padding: '32px' }}>
                <h3 className="h2 flex items-center gap-2 mb-6" style={{ margin: 0 }}>
                    <Building2 size={24} className="text-primary" /> Clientes Activos ({empresas.length})
                </h3>
                {empresas.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
                        {empresas.map(empresa => (
                            <div key={empresa.id} style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div style={{ width: 48, height: 48, borderRadius: '12px', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                    {empresa.logo_url ? (
                                        <img src={empresa.logo_url} alt={empresa.nombre_empresa} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <Building2 size={24} className="text-primary" />
                                    )}
                                </div>
                                <div style={{ overflow: 'hidden' }}>
                                    <h4 style={{ margin: 0, fontWeight: 800, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{empresa.nombre_empresa}</h4>
                                    <span className="text-sec" style={{ fontSize: '0.8rem' }}>RUC: {empresa.ruc_empresa || 'N/A'}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sec">Aún no has creado ninguna empresa o cliente.</p>
                )}
            </div>

            {/* Toggle de Tema */}
            <div className="glass-card" style={{ padding: '24px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                        {isDark ? <Moon size={20} style={{ color: 'var(--primary)' }} /> : <Sun size={20} style={{ color: 'var(--primary)' }} />}
                        Apariencia
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-sec)' }}>
                        Actualmente en modo <strong>{isDark ? 'oscuro' : 'claro'}</strong>
                    </p>
                </div>
                <button
                    onClick={toggleTheme}
                    style={{
                        width: 56, height: 30, borderRadius: 999,
                        background: isDark ? 'var(--primary)' : 'var(--border-color)',
                        border: 'none', cursor: 'pointer', position: 'relative',
                        transition: 'background 0.3s',
                    }}
                >
                    <div style={{
                        position: 'absolute', top: 3,
                        left: isDark ? 28 : 3,
                        width: 24, height: 24, borderRadius: '50%',
                        background: '#fff',
                        transition: 'left 0.3s',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        {isDark ? <Moon size={12} color="#000" /> : <Sun size={12} color="#F59E0B" />}
                    </div>
                </button>
            </div>

            <div className="glass-card" style={{ padding: '24px', borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.05)' }}>
                <h3 style={{ color: 'var(--error)', margin: '0 0 8px 0', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <LogOut size={20} /> Sesión de Seguridad
                </h3>
                <p className="text-sec mb-4">Cierra tu sesión activa para proteger la información de tus clientes en este dispositivo.</p>
                <button
                    onClick={handleLogout}
                    className="btn"
                    style={{ background: 'transparent', border: '1px solid var(--error)', color: 'var(--error)', fontWeight: 600 }}
                >
                    Cerrar Sesión Activa
                </button>
            </div>
        </motion.div>
    );
};
