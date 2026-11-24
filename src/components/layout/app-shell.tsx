"use client";

import { useQuery } from "@tanstack/react-query";
import { LogOut, MessageCircle, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { clinicApi } from "@/lib/api/endpoints";
import { t } from "@/lib/i18n";
import { adminNav, clinicNav, type NavGroup, type NavItem } from "./nav-config";
import { ThemeToggle } from "./theme-toggle";

export type ShellArea = "clinic" | "admin";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function ReadinessBadge() {
  const { data } = useQuery({ queryKey: ["clinic", "readiness"], queryFn: clinicApi.readiness });
  if (!data || data.completed >= data.total) return null;
  return (
    <SidebarMenuBadge aria-label={`${data.completed} de ${data.total} concluídos`}>
      {data.completed}/{data.total}
    </SidebarMenuBadge>
  );
}

function NavLinks({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  const { can } = useAuth();
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <>
      {groups.map((group, index) => {
        const items = group.items.filter((item) => !item.permission || can(item.permission));
        if (items.length === 0) return null;
        return (
          <SidebarGroup key={group.label ?? index}>
            {group.label ? <SidebarGroupLabel>{group.label}</SidebarGroupLabel> : null}
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => {
                  const active = isActive(pathname, item);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          onClick={() => isMobile && setOpenMobile(false)}
                        >
                          <item.icon aria-hidden />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                      {item.badge === "readiness" ? <ReadinessBadge /> : null}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        );
      })}
    </>
  );
}

function UserMenu({ area }: { area: ShellArea }) {
  const { me, logout } = useAuth();
  if (!me) return null;
  const profileHref = area === "admin" ? "/admin/perfil" : "/app/perfil";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-1.5" aria-label={`Menu do usuário: ${me.user.name}`}>
          <Avatar className="size-7">
            <AvatarFallback className="text-xs">{initials(me.user.name)}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-40 truncate text-sm font-medium md:inline">{me.user.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{me.user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{me.user.email}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t(`roles.${me.user.role}`)}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={profileHref}>
            <UserRound aria-hidden /> {t("auth.profile")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void logout()}>
          <LogOut aria-hidden /> {t("auth.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({
  area,
  contextLabel,
  children,
}: {
  area: ShellArea;
  /** Ex.: nome da clínica ou "Administração". */
  contextLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <a
        href="#conteudo"
        className="sr-only z-[70] rounded-md bg-background px-3 py-2 text-sm font-medium shadow focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Pular para o conteúdo
      </a>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link href={area === "admin" ? "/admin" : "/app"}>
                  <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <MessageCircle className="size-4" aria-hidden />
                  </span>
                  <span className="grid flex-1 text-left leading-tight">
                    <span className="truncate font-semibold">{t("app.name")}</span>
                    {contextLabel ? <span className="truncate text-xs text-muted-foreground">{contextLabel}</span> : null}
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <nav aria-label="Navegação principal">
            <NavLinks groups={area === "admin" ? adminNav : clinicNav} />
          </nav>
        </SidebarContent>
        <SidebarFooter />
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-(--impersonation-offset,0px) z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:px-4">
          <SidebarTrigger aria-label="Mostrar ou ocultar menu" />
          <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{contextLabel}</span>
          <ThemeToggle />
          <UserMenu area={area} />
        </header>
        <main id="conteudo" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 p-4 outline-none md:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
