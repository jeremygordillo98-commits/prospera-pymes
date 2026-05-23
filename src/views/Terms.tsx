import React from 'react';
import { useTheme } from "../context/ThemeContext";

export const Terms = () => {
  const { isDark } = useTheme();

  // --- RESPONSIVE CHECK ---
  const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);
  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Función para volver a la pantalla anterior
  const handleGoBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "/";
    }
  };

  return (
    <div style={{ 
      background: 'var(--bg-color)', 
      minHeight: '100vh', 
      padding: isMobile ? '20px' : '40px', 
      color: 'var(--text-main)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* ORBES DE LUZ */}
      <div style={{ position: 'fixed', top: '10%', right: '-10%', width: '400px', height: '400px', background: 'var(--primary)15', borderRadius: '50%', filter: 'blur(120px)', zIndex: 0 }}></div>
      <div style={{ position: 'fixed', bottom: '10%', left: '-10%', width: '300px', height: '300px', background: '#0ea5e915', borderRadius: '50%', filter: 'blur(100px)', zIndex: 0 }}></div>

      <div style={{ 
        maxWidth: '900px', 
        margin: '0 auto', 
        lineHeight: '1.7', 
        textAlign: 'left',
        paddingBottom: '100px',
        position: 'relative',
        zIndex: 1
      }}>
        
        {/* --- BOTÓN DE REGRESAR --- */}
        <button 
          onClick={handleGoBack} 
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-main)',
            fontSize: '0.9rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '40px',
            padding: '12px 24px',
            borderRadius: '16px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
            backdropFilter: 'blur(10px)',
            transition: 'all 0.3s'
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'translateX(-5px)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'translateX(0)'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Regresar
        </button>

        <header style={{ textAlign: 'center', marginBottom: '60px', animation: 'fadeInDown 0.8s ease' }}>
            <h1 style={{ color: 'var(--text-main)', marginBottom: '15px', fontSize: isMobile ? '2.2rem' : '3.2rem', fontWeight: 900, letterSpacing: '-1.5px' }}>
              Aspectos Legales y <span style={{ color: 'var(--primary)' }}>Términos de Pymes</span>
            </h1>
            <div style={{ display: 'inline-block', background: 'var(--primary-light)', color: 'var(--primary)', padding: '6px 16px', borderRadius: '100px', fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
              Versión B2B 1.0 • Mayo 2026
            </div>
        </header>

        <section style={{ 
            background: 'var(--card-bg)', 
            backdropFilter: 'blur(30px)', 
            border: '1px solid var(--border-color)', 
            borderRadius: '32px', 
            padding: isMobile ? '30px 20px' : '50px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
            animation: 'fadeInUp 0.8s ease'
        }}>
            {/* TÉRMINOS Y CONDICIONES */}
            <h2 style={{ color: 'var(--text-main)', fontSize: '1.6rem', fontWeight: 900, marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ color: 'var(--primary)' }}>💼</span> Términos y Condiciones de Uso B2B
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '35px', color: 'var(--text-main)', opacity: 0.95 }}>
                <div>
                  <h3 style={{ color: 'var(--primary)', fontSize: '1.1rem', marginBottom: '10px', fontWeight: 800 }}>1. Relación y Naturaleza del Servicio</h3>
                  <p><b>Prospera Pymes</b> es una plataforma tecnológica en la nube diseñada como software de apoyo para la gestión contable, conciliación y automatización del procesamiento de datos financieros. Prospera <b>no realiza asesoría contable o tributaria de manera autónoma</b>, ni es una firma contable o de auditoría regulada.</p>
                </div>

                <div style={{ padding: '24px', background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderRadius: '20px', borderLeft: '6px solid var(--primary)' }}>
                  <h3 style={{ color: 'var(--text-main)', fontSize: '1.15rem', marginBottom: '12px', fontWeight: 900 }}>⚠️ Delimitación de Responsabilidad Profesional y Tributaria</h3>
                  <p style={{ margin: 0 }}>
                    El <b>Contador Público Autorizado o usuario profesional</b> es el <b>único y exclusivo responsable legal</b> de revisar, verificar y certificar la veracidad, integridad y exactitud de todos los saldos contables, transacciones del Libro Diario, conciliaciones bancarias, balances financieros y reportes tributarios.
                  </p>
                </div>

                <div>
                  <h3 style={{ color: 'var(--primary)', fontSize: '1.1rem', marginBottom: '10px', fontWeight: 800 }}>2. Procesamiento Automatizado de XML del SRI y Reportes ATS</h3>
                  <p>
                    Las herramientas de subida masiva e interpretación de archivos XML del Servicio de Rentas Internas (SRI) de Ecuador, así como el módulo generador de Reportes ATS, son utilidades de <b>automatización de apoyo</b>. 
                    El usuario profesional se compromete a realizar una revisión minuciosa y validar los montos, retenciones aplicadas (o la opción de no aplicar retenciones 000), códigos de retención y totales antes de la presentación final de impuestos o anexos al SRI. Prospera no asume responsabilidad alguna por multas, glosas, recargos o sanciones fiscales emitidas por el SRI debidas a inconsistencias de datos o mala parametrización contable.
                  </p>
                </div>

                <div>
                  <h3 style={{ color: 'var(--primary)', fontSize: '1.1rem', marginBottom: '10px', fontWeight: 800 }}>3. Autorización de Datos de Terceros (LODP)</h3>
                  <p>
                    En conformidad con la <b>Ley Orgánica de Protección de Datos Personales (LODP) de Ecuador</b>, el usuario profesional garantiza bajo juramento que posee los consentimientos, mandatos o autorizaciones de sus clientes (personas naturales o jurídicas representadas) para registrar, procesar, cargar y hospedar su información financiera, de facturación y transaccional en la infraestructura de Prospera Pymes.
                  </p>
                </div>

                <div>
                  <h3 style={{ color: 'var(--primary)', fontSize: '1.1rem', marginBottom: '10px', fontWeight: 800 }}>4. Seguridad y Aislamiento de Información (Multi-tenancy)</h3>
                  <p>
                    Prospera Pymes garantiza la confidencialidad absoluta mediante la implementación de políticas de aislamiento de datos multi-inquilino a nivel de base de datos (Row Level Security - RLS) gestionadas por Supabase. Esto asegura que la información de cada despacho y de cada empresa asignada sea completamente invisible y esté aislada de otros usuarios del ecosistema.
                  </p>
                </div>

                <hr style={{ border: 'none', height: '1px', background: 'var(--border-color)', margin: '10px 0' }} />

                {/* PRIVACIDAD */}
                <h2 style={{ color: 'var(--text-main)', fontSize: '1.6rem', fontWeight: 900, marginTop: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ color: 'var(--primary)' }}>🛡️</span> Privacidad Contable y Copias de Seguridad
                </h2>
                
                <div>
                  <p>Nuestra prioridad es la protección de la soberanía financiera de las empresas que confían en nosotros:</p>
                  <ul style={{ paddingLeft: '20px', marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <li><b>Confidencialidad B2B:</b> No comercializamos bajo ningún concepto los registros, datos de ventas, márgenes ni carteras de clientes/proveedores de las empresas gestionadas.</li>
                    <li><b>Derecho de Eliminación:</b> El contador cuenta con el control absoluto para eliminar de manera definitiva cualquier empresa de su catálogo junto con todos sus registros del Libro Diario, Mayor, XMLs cargados e información asociada de manera instantánea e irreversible.</li>
                  </ul>
                </div>
            </div>

            <footer style={{ textAlign: 'center', marginTop: '60px', paddingTop: '40px', borderTop: '1px solid var(--border-color)' }}>
                <p style={{ fontWeight: 800, color: 'var(--text-sec)', marginBottom: '20px' }}>¿Tienes dudas adicionales sobre el marco regulatorio B2B?</p>
                <a href="mailto:legal-pymes@prosperafinanzas.com" style={{ 
                    display: 'inline-block',
                    background: 'var(--primary)',
                    color: '#000',
                    padding: '14px 30px',
                    borderRadius: '16px',
                    textDecoration: 'none',
                    fontWeight: 900,
                    boxShadow: '0 10px 25px rgba(0, 149, 106, 0.25)',
                    transition: 'all 0.3s'
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                    Contactar a Legal Pymes
                </a>
            </footer>
        </section>
      </div>

      <style>
        {`
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(40px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes fadeInDown {
            from { opacity: 0; transform: translateY(-20px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}
      </style>
    </div>
  );
};
