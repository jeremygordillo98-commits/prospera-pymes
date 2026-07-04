import { useQuery } from '@tanstack/react-query';
import { supabase } from '../services/supabase';

export interface SystemConfig {
  mantenimiento: { activo: boolean; mensaje: string };
  banner: { activo: boolean; texto: string; tipo: 'info' | 'warning' | 'success' | 'danger' };
  feature_flags: { sync_xml: boolean; ride_pdf: boolean; mailer_pymes: boolean; ats_excel: boolean };
}

export function useSystemConfig() {
  const { data, isLoading, error } = useQuery<SystemConfig>({
    queryKey: ['systemConfig'],
    queryFn: async () => {
      const { data: rows, error: err } = await supabase
        .from('configuracion_sistema')
        .select('*');

      if (err) throw err;

      // Valores por defecto
      const config: SystemConfig = {
        mantenimiento: { activo: false, mensaje: 'Estamos realizando mejoras programadas en el sistema. Regresaremos pronto.' },
        banner: { activo: false, texto: '', tipo: 'info' },
        feature_flags: { sync_xml: true, ride_pdf: true, mailer_pymes: true, ats_excel: true }
      };

      if (rows) {
        const m = rows.find(r => r.clave === 'mantenimiento')?.valor;
        const b = rows.find(r => r.clave === 'banner')?.valor;
        const f = rows.find(r => r.clave === 'feature_flags')?.valor;
        if (m) config.mantenimiento = m;
        if (b) config.banner = b;
        if (f) config.feature_flags = f;
      }

      return config;
    },
    refetchInterval: 30000, // Refrescar cada 30 segundos
    refetchOnWindowFocus: true, // Refrescar al reenfocar
    staleTime: 10000
  });

  const isFeatureEnabled = (flagName: keyof SystemConfig['feature_flags']) => {
    return data?.feature_flags?.[flagName] !== false;
  };

  return {
    config: data,
    isLoading,
    error,
    isFeatureEnabled,
    mantenimiento: data?.mantenimiento || { activo: false, mensaje: '' },
    banner: data?.banner || { activo: false, texto: '', tipo: 'info' }
  };
}
