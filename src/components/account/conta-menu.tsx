"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  UserRound,
  ShieldCheck,
  Bell,
  Lock,
  Wrench,
  Gift,
  LifeBuoy,
  FileText,
  Trash2,
  LogOut,
  ChevronRight,
  Users,
} from "lucide-react";
import { useAuthStore, type ViewMode } from "@/lib/store";
import { useViewMode, identidadeUsuario } from "@/lib/roles";
import { useDisplayUser } from "@/lib/demo/demo-mode";
import { salvarModo } from "@/lib/salvar-modo";
import { getMyAvatarUrl } from "@/lib/data/avatar-actions";
import { Avatar } from "@/components/ui/avatar";
import { removerPushToken } from "@/lib/data/push-actions";
import { createClient } from "@/lib/supabase/client";
import { appHome } from "@/lib/app-mode";
import { PROGRAMA_INDICACAO } from "@/lib/flags";
import { cn } from "@/lib/utils";
import { SeletorModo } from "./seletor-modo";
import { mostraEquipe, ROTA_EQUIPE } from "./conta-equipe";

type Item = { href?: string; onClick?: () => void; label: string; icon: React.ComponentType<{ className?: string }>; tom?: "perigo" };

/**
 * Conta no APP (mapa, seção 4): lista curta de itens que abrem subtelas. A troca
 * inquilino ⇄ proprietário fica AQUI no app (no site segue no topo do painel).
 */
export function ContaMenu() {
  const router = useRouter();
  const user = useDisplayUser();
  const { signOut, setActiveMode } = useAuthStore();
  const { mode } = useViewMode();

  // Foto do próprio usuário (opcional); sem foto, o Avatar mostra as iniciais.
  const [foto, setFoto] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    getMyAvatarUrl()
      .then((r) => {
        if (vivo) setFoto(r.url);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [user?.id]);

  async function trocarModo(outro: ViewMode) {
    setActiveMode(outro);
    // Espera gravar a preferência antes de navegar (ver dashboard-shell: 8.3).
    await salvarModo(outro);
    router.replace(appHome(outro));
  }

  async function sair() {
    try {
      const t = localStorage.getItem("vn-push-token");
      if (t) {
        removerPushToken(t).catch(() => {});
        localStorage.removeItem("vn-push-token");
      }
    } catch {
      /* segue */
    }
    await createClient()?.auth.signOut().catch(() => {});
    signOut();
    router.replace("/app/boas-vindas");
  }

  const grupos: Item[][] = [
    [
      { href: "/dashboard/conta/perfil", label: "Perfil", icon: UserRound },
      { href: "/dashboard/verificacao", label: "Verificação", icon: ShieldCheck },
      { href: "/dashboard/conta/notificacoes", label: "Notificações", icon: Bell },
      { href: "/dashboard/conta/seguranca", label: "Senha e segurança", icon: Lock },
    ],
    [
      // Sem item de plano: não há mensalidade nesta fase (só taxa por contrato fechado).
      ...(mode === "owner" ? [{ href: "/dashboard/ferramentas", label: "Ferramentas", icon: Wrench }] : []),
      ...(mostraEquipe(user?.role) ? [{ href: ROTA_EQUIPE, label: "Equipe e aprovações", icon: Users }] : []),
      ...(PROGRAMA_INDICACAO ? [{ href: "/dashboard/indicacoes", label: "Indicações", icon: Gift }] : []),
    ],
    [
      { href: "/dashboard/conta/ajuda", label: "Ajuda e contato", icon: LifeBuoy },
      { href: "/termos", label: "Termos de uso", icon: FileText },
      { href: "/privacidade", label: "Privacidade", icon: FileText },
    ],
    [
      { href: "/dashboard/conta/excluir", label: "Excluir conta", icon: Trash2, tom: "perigo" },
      { onClick: sair, label: "Sair", icon: LogOut, tom: "perigo" },
    ],
  ];

  return (
    <div className="mx-auto max-w-xl space-y-4">
      {/* Toque na foto leva ao Perfil (trocar/enviar foto). O modo atual aparece no chip do topo e no seletor abaixo. */}
      <Link
        href="/dashboard/conta/perfil"
        data-testid="conta-cartao-usuario"
        aria-label="Abrir Perfil para trocar a foto"
        className="flex items-center gap-3 rounded-2xl bg-white p-4"
      >
        <Avatar name={identidadeUsuario(user)} size={56} photoUrl={foto ?? undefined} />
        <p className="min-w-0 flex-1 truncate font-title text-lg font-bold text-ink">{identidadeUsuario(user)}</p>
        <ChevronRight className="h-4 w-4 text-muted" aria-hidden />
      </Link>
      {/* Toda conta pode usar os dois papéis: seletor de dois lados. */}
      <SeletorModo mode={mode} onSwitch={trocarModo} />
      {grupos
        .filter((g) => g.length > 0)
        .map((g, i) => (
          <ul key={i} className="divide-y divide-sage-100 overflow-hidden rounded-2xl bg-white">
            {g.map((it) => {
              const Icon = it.icon;
              const conteudo = (
                <>
                  <Icon className={cn("h-5 w-5", it.tom === "perigo" ? "text-red-600" : "text-forest")} />
                  <span className={cn("flex-1 text-sm font-medium", it.tom === "perigo" ? "text-red-700" : "text-ink")}>
                    {it.label}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted" />
                </>
              );
              const cls = "flex w-full items-center gap-3 px-4 py-3.5 text-left";
              return (
                <li key={it.label}>
                  {it.href ? (
                    <Link href={it.href} className={cls}>
                      {conteudo}
                    </Link>
                  ) : (
                    <button type="button" onClick={it.onClick} className={cls}>
                      {conteudo}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        ))}
    </div>
  );
}
