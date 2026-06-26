import {
  LayoutDashboard,
  Settings,
  BookOpen,
  Users,
  User,
  Zap, 
  FileUp, 
  Database, 
  Grid, 
  Wallet, 
  CreditCard, 
  BarChart, 
  FileText,
  Mail,
  Ban
} from 'lucide-react';

export const MENU_STRUCTURE = [
  { id: 'dashboard', label: 'Resumen Financiero', icon: LayoutDashboard },
  {
    id: 'contabilidad-parent',
    label: 'Contabilidad',
    isParent: true,
    icon: Database,
    children: [
      { id: 'plan-cuentas', label: 'Plan de Cuentas', icon: BookOpen },
      { id: 'entidades', label: 'Entidades (Terceros)', icon: Users },
      { id: 'libro-diario', label: 'Libro Diario', icon: FileText },
      { id: 'asientos', label: 'Asientos Manuales', icon: Grid },
    ]
  },
  {
    id: 'sri-parent',
    label: 'Automatización SRI',
    isParent: true,
    icon: Zap,
    children: [
      { id: 'xml-compras', label: 'XML Compras', icon: FileUp },
      { id: 'xml-ventas', label: 'XML Ventas', icon: FileUp },
      { id: 'xml-anulados', label: 'Anulados', icon: Ban },
    ]
  },
  {
    id: 'tesoreria-parent',
    label: 'Tesorería',
    isParent: true,
    icon: Wallet,
    children: [
      { id: 'tesoreria', label: 'Resumen Tesorería', icon: Wallet },
      { id: 'cobros', label: 'Cobros a Clientes', icon: CreditCard },
      { id: 'pagos', label: 'Pagos a Proveedores', icon: CreditCard },
      { id: 'conciliacion', label: 'Conciliación y Flujo', icon: FileText },
    ]
  },
  {
    id: 'reportes-parent',
    label: 'Reportes',
    isParent: true,
    icon: BarChart,
    children: [
      { id: 'reportes', label: 'Estados Financieros', icon: FileText },
      { id: 'reportes-fiscales', label: 'Fiscales (ATS)', icon: FileText },
    ]
  },
  {
    id: 'comunicaciones-parent',
    label: 'Comunicaciones',
    isParent: true,
    icon: Mail,
    children: [
      { id: 'comunicados', label: 'Comunicados Mailer', icon: Mail }
    ]
  },
  {
    id: 'config-parent',
    label: 'Configuración',
    isParent: true,
    icon: Settings,
    children: [
      { id: 'perfil', label: 'Mi Perfil', icon: User },
      { id: 'config', label: 'Preferencias (Tema)', icon: Settings },
    ]
  }
];
