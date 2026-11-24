import {
  Activity,
  Bot,
  Building2,
  CalendarClock,
  ClipboardList,
  Contact,
  LayoutDashboard,
  MessagesSquare,
  Plug,
  Rocket,
  Settings,
  ShieldCheck,
  Stethoscope,
  Tags,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Permission } from "@/lib/api/types";
import { t } from "@/lib/i18n";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Só aparece para quem tem a permissão. */
  permission?: Permission;
  /** Marca como ativo só no caminho exato. */
  exact?: boolean;
  badge?: "readiness";
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export const clinicNav: NavGroup[] = [
  {
    items: [
      { href: "/app/primeiros-passos", label: t("nav.clinic.onboarding"), icon: Rocket, badge: "readiness" },
      { href: "/app", label: t("nav.clinic.overview"), icon: LayoutDashboard, exact: true },
    ],
  },
  {
    label: t("nav.clinic.groupSetup"),
    items: [
      { href: "/app/conexoes", label: t("nav.clinic.connections"), icon: Plug },
      { href: "/app/agente", label: t("nav.clinic.agent"), icon: Bot },
      { href: "/app/profissionais", label: t("nav.clinic.professionals"), icon: Stethoscope },
      { href: "/app/servicos", label: t("nav.clinic.services"), icon: Tags },
      { href: "/app/horarios", label: t("nav.clinic.schedule"), icon: CalendarClock },
    ],
  },
  {
    label: t("nav.clinic.groupAttendance"),
    items: [
      { href: "/app/conversas", label: t("nav.clinic.conversations"), icon: MessagesSquare, permission: "conversations:read" },
      { href: "/app/contatos", label: t("nav.clinic.contacts"), icon: Contact, permission: "contacts:read" },
    ],
  },
  {
    label: t("nav.clinic.groupClinic"),
    items: [
      { href: "/app/equipe", label: t("nav.clinic.team"), icon: Users, permission: "users:manage" },
      { href: "/app/configuracoes", label: t("nav.clinic.settings"), icon: Settings },
    ],
  },
];

export const adminNav: NavGroup[] = [
  {
    label: t("nav.admin.groupPlatform"),
    items: [
      { href: "/admin", label: t("nav.admin.overview"), icon: LayoutDashboard, exact: true },
      { href: "/admin/clinicas", label: t("nav.admin.clinics"), icon: Building2 },
      { href: "/admin/uso", label: t("nav.admin.usage"), icon: Wallet },
    ],
  },
  {
    label: t("nav.admin.groupOps"),
    items: [
      { href: "/admin/saude", label: t("nav.admin.health"), icon: Activity },
      { href: "/admin/auditoria", label: t("nav.admin.audit"), icon: ClipboardList },
      { href: "/admin/administradores", label: t("nav.admin.admins"), icon: ShieldCheck },
    ],
  },
];
