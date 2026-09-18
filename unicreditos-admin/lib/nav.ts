import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BadgeCheck,
  Banknote,
  BarChart3,
  BookOpen,
  Building2,
  ClipboardCheck,
  CreditCard,
  FileText,
  Headset,
  IdCard,
  Landmark,
  LayoutDashboard,
  Receipt,
  Scale,
  Settings2,
  ShieldAlert,
  ShoppingBag,
  SlidersHorizontal,
  Users,
  Wallet,
  WalletCards,
  Waypoints,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: "applications" | "kyc" | "disbursements" | "transfers" | "approvals" | "collections" | "tickets";
};

export type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "control",
    label: "Control",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/analitica", label: "Analítica", icon: BarChart3 },
    ],
  },
  {
    id: "originacion",
    label: "Originación",
    items: [
      { href: "/admin/solicitudes", label: "Solicitudes", icon: FileText, badge: "applications" },
      { href: "/admin/creditos", label: "Créditos", icon: CreditCard },
      { href: "/admin/clientes", label: "Clientes", icon: Users },
      { href: "/admin/kyc", label: "Identidad / KYC", icon: IdCard, badge: "kyc" },
      { href: "/admin/comercios", label: "Comercios", icon: ShoppingBag },
    ],
  },
  {
    id: "tesoreria",
    label: "Cobranzas y tesorería",
    items: [
      { href: "/admin/aprobaciones", label: "Aprobaciones", icon: BadgeCheck, badge: "approvals" },
      { href: "/admin/cobranzas", label: "Cobranzas", icon: Waypoints, badge: "collections" },
      { href: "/admin/pagos", label: "Pagos", icon: Wallet, badge: "transfers" },
      { href: "/admin/desembolsos", label: "Desembolsos", icon: Banknote, badge: "disbursements" },
      { href: "/admin/cartera", label: "Cartera activa", icon: WalletCards },
      { href: "/admin/comprobantes", label: "Comprobantes", icon: Receipt },
      { href: "/admin/finanzas", label: "Finanzas", icon: Landmark },
      { href: "/admin/cuentas-cbu", label: "Cuentas CBU", icon: Building2 },
    ],
  },
  {
    id: "riesgo",
    label: "Riesgo",
    items: [
      { href: "/admin/riesgo", label: "Riesgo / CENDEU", icon: ShieldAlert },
      { href: "/admin/bcra", label: "Variables BCRA", icon: Activity },
    ],
  },
  {
    id: "sistema",
    label: "Sistema",
    items: [
      { href: "/admin/contratos", label: "Contratos", icon: BookOpen },
      { href: "/admin/soporte", label: "Soporte", icon: Headset, badge: "tickets" },
      { href: "/admin/auditoria", label: "Auditoría", icon: ClipboardCheck },
      { href: "/admin/productos", label: "Productos", icon: SlidersHorizontal },
      { href: "/admin/operadores", label: "Operadores", icon: Scale },
      { href: "/admin/configuracion", label: "Configuración", icon: Settings2 },
    ],
  },
];

export const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}
