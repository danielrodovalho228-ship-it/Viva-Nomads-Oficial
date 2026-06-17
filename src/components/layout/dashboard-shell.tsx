"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Home,
  Users,
  MessageSquare,
  CreditCard,
  Settings,
  Heart,
  Search,
  ClipboardCheck,
  ShieldCheck,
  Menu,
  LogOut,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { useAuthStore } from "@/lib/store";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const OWNER_NAV: NavItem[] = [
  { href: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
  { href: "/qualificar", label: "Qualificar imóvel", icon: ClipboardCheck },
  { href: "/dashboard/imoveis", label: "Meus imóveis", icon: Home },
  { href: "/dashboard/leads", label: "Leads", icon: Users },
  { href: "/dashboard/mensagens", label: "Mensagens", icon: MessageSquare },
  { href: "/dashboard/assinatura", label: "Assinatura", icon: CreditCard },
  { href: "/dashboard/conta", label: "Conta", icon: Settings },
];

const TENANT_NAV: NavItem[] = [
  { href: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
  { href: "/dashboard/favoritos", label: "Favoritos", icon: Heart },
  { href: "/dashboard/buscas", label: "Buscas salvas", icon: Search },
  { href: "/dashboard/mensagens", label: "Mensagens", icon: MessageSquare },
  { href: "/dashboard/conta", label: "Conta", icon: Settings },
];

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Admin", icon: ShieldCheck },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuthStore();

  const role = user?.role ?? "owner";
  let nav = role === "tenant" ? TENANT_NAV : OWNER_NAV;
  if (role === "admin") nav = [...OWNER_NAV, ...ADMIN_NAV];

  function handleSignOut() {
    signOut();
    router.push("/home");
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center border-b border-white/10 px-5">
        <Logo light />
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {nav.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-champagne text-forest"
                  : "text-white/80 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className="h-4.5 w-4.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-3">
        <div className="px-3 py-2 text-xs text-white/60">
          {user ? (
            <>
              <p className="font-medium text-white">{user.name}</p>
              <p className="capitalize">{labelForRole(user.role)}</p>
            </>
          ) : (
            <p>Modo demonstração</p>
          )}
        </div>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white"
        >
          <LogOut className="h-4.5 w-4.5" />
          Sair
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full bg-surface-2">
      {/* Sidebar desktop */}
      <aside className="hidden w-64 shrink-0 bg-forest lg:block">{sidebar}</aside>

      {/* Drawer mobile */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-forest">{sidebar}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar mobile */}
        <div className="flex h-16 items-center justify-between border-b border-sage-200 bg-white px-4 lg:hidden">
          <Logo />
          <button
            className="grid h-10 w-10 place-items-center rounded-lg text-forest"
            onClick={() => setOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>

        <main className="flex-1 p-5 sm:p-8">{children}</main>
      </div>
    </div>
  );
}

function labelForRole(role: string) {
  if (role === "owner") return "Proprietário";
  if (role === "tenant") return "Inquilino";
  return "Administrador";
}
