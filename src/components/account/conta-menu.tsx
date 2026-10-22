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
  Handshake,
} from "lucide-react";
import { useAuthStore, type ViewMode } from "@/lib/store";
import { useViewMode, identidadeUsuario } from "@/lib/roles";
import { useDisplayUser } from "@/lib/demo/demo-mode";
import { salvarModo } from "@/lib/salvar-modo";
import { getMyAvatarUrl } from "@/lib/data/avatar-actions";
import { Avatar } from "@/components/ui/avatar";
import { PageTitle } from "@/components/dashboard/primitives";
import { removerPushToken } from "@/lib/data/push-actions";
import { createClient } from "@/lib/supabase/client";
import { appHome } from "@/lib/app-mode";
import { PROGRAMA_INDICACAO } from "@/lib/flags";
import { cn } from "@/lib/utils";
import { SeletorModo } from "./seletor-modo";
import { gravarPreferenciaParceiro, useParceiroAprovado, usePreferenciaParceiro } from "@/lib/use-papel-barra";
import { mostraEquipe, ROTA_ADMIN, ROTA_EQUIPE } from "./conta-equipe";

type Item = { href?: string; onClick?: () => void; label: string; descricao?: string; icon: React.ComponentType<{ className?: string }>; tom?: "perigo" };

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

  // Prompt 41: com a parceria aprovada, o Perfil também troca para "parceiro" (só a navegação deste aparelho).
  const parceiroAprovado = useParceiroAprovado();
  const comoParceiro = usePreferenciaParceiro() && parceiroAprovado;

  async function trocarModo(outro: ViewMode) {
    gravarPreferenciaParceiro(false);
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
      { href: "/dashboard/conta/perfil", label: "Perfil", descricao: "Nome, telefone, documento e foto.", icon: UserRound },
      { href: "/dashboard/verificacao", label: "Verificação", descricao: "Confirme sua identidade.", icon: ShieldCheck },
      { href: "/dashboard/notificacoes", label: "Notificações", descricao: "Avisos por e-mail e no app.", icon: Bell },
      { href: "/dashboard/conta/seguranca", label: "Senha e segurança", descricao: "Senha e verificação em duas etapas.", icon: Lock },
    ],
    [
      // Sem item de plano: não há mensalidade nesta fase (só taxa por contrato fechado).
      ...(mode === "owner" ? [{ href: "/dashboard/ferramentas", label: "Ferramentas", descricao: "Simulador, ROI e orçamentos.", icon: Wrench }] : []),
      ...(mostraEquipe(user?.role)
        ? [
            { href: ROTA_ADMIN, label: "Painel Admin", descricao: "Área da equipe.", icon: ShieldCheck },
            { href: ROTA_EQUIPE, label: "Equipe e aprovações", descricao: "Documentos e pendências.", icon: Users },
          ]
        : []),
      ...(PROGRAMA_INDICACAO ? [{ href: "/dashboard/indicacoes", label: "Indicações", descricao: "Convide e acompanhe.", icon: Gift }] : []),
    ],
    [
      { href: "/dashboard/conta/ajuda", label: "Ajuda e contato", descricao: "Central de ajuda e chamados.", icon: LifeBuoy },
      { href: "/dashboard/parceiro", label: "Quero ser parceiro", descricao: "Ofereça seus serviços na Viva.", icon: Handshake },
      { href: "/termos", label: "Termos de uso", descricao: "Regras da plataforma.", icon: FileText },
      { href: "/privacidade", label: "Privacidade", descricao: "Como tratamos seus dados.", icon: FileText },
    ],
    [
      { href: "/dashboard/conta/excluir", label: "Excluir conta", descricao: "Apaga seus dados, com confirmação.", icon: Trash2, tom: "perigo" },
      { onClick: sair, label: "Sair", descricao: "Encerrar a sessão neste aparelho.", icon: LogOut, tom: "perigo" },
    ],
  ];

  return (
    <div className="w-full space-y-4">
      {/* Mesma capa 3S do site; no app só a navegação muda (cabeçalho curto + abas). */}
      <PageTitle capa="conta" title="Conta" subtitle="Seus dados, segurança e preferências." />
      {/* Toque na foto leva ao Perfil (trocar/enviar foto). O modo atual aparece no chip do topo e no seletor abaixo. */}
      <Link
        href="/dashboard/conta/perfil"
        data-testid="conta-cartao-usuario"
        aria-label="Abrir Perfil para trocar a foto"
        className="flex items-center gap-3 rounded-xl border border-sage-200 bg-white p-4"
      >
        <Avatar name={identidadeUsuario(user)} size={56} photoUrl={foto ?? undefined} />
        <p className="min-w-0 flex-1 truncate font-title text-lg font-semibold text-ink">{identidadeUsuario(user)}</p>
        <ChevronRight className="h-4 w-4 text-muted" aria-hidden />
      </Link>
      {/* Toda conta pode usar os dois papéis: seletor de dois lados. */}
      <SeletorModo mode={mode} onSwitch={trocarModo} />
      {parceiroAprovado && (
        <button
          type="button"
          role="switch"
          aria-checked={comoParceiro}
          data-testid="usar-como-parceiro"
          onClick={() => {
            gravarPreferenciaParceiro(!comoParceiro);
            if (!comoParceiro) router.push("/dashboard/parceiro");
          }}
          className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 text-left text-sm font-semibold text-ink"
        >
          Usar a conta como parceiro
          <span className={cn("text-sm font-normal", comoParceiro ? "text-forest" : "text-muted")}>{comoParceiro ? "Ligado" : "Desligado"}</span>
        </button>
      )}
      {grupos
        .filter((g) => g.length > 0)
        .map((g, i) => (
          <ul key={i} className="divide-y divide-sage-100 overflow-hidden rounded-xl border border-sage-200 bg-white">
            {g.map((it) => {
              const Icon = it.icon;
              const conteudo = (
                <>
                  <span
                    className={cn(
                      "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                      it.tom === "perigo" ? "bg-red-50" : "bg-sage-100"
                    )}
                  >
                    <Icon className={cn("h-5 w-5", it.tom === "perigo" ? "text-red-600" : "text-forest")} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm font-semibold", it.tom === "perigo" ? "text-red-700" : "text-ink")}>
                      {it.label}
                    </span>
                    {it.descricao && <span className="block truncate text-xs text-muted">{it.descricao}</span>}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
                </>
              );
              const cls = "flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left";
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
