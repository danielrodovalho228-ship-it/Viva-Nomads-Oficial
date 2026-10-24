"use client";

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
  CreditCard,
  Eye,
} from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { useDisplayUser } from "@/lib/demo/demo-mode";
import { removerPushToken } from "@/lib/data/push-actions";
import { createClient } from "@/lib/supabase/client";
import { PROGRAMA_INDICACAO } from "@/lib/flags";
import { cn } from "@/lib/utils";
import { SeusPapeis } from "./seus-papeis";
import { mostraEquipe, ROTA_ADMIN, ROTA_EQUIPE } from "./conta-equipe";

type Grupo = { titulo: string | null; itens: Item[] };
type Item = { href?: string; onClick?: () => void; label: string; descricao?: string; icon: React.ComponentType<{ className?: string }>; tom?: "perigo" };

/**
 * Conta no APP (mapa, seção 4): lista curta de itens que abrem subtelas, nos 4 grupos das configurações (Prompt 43):
 * Conta · Notificações · Privacidade e segurança · Pagamentos. Conta única: no lugar do antigo seletor
 * "Proprietário | Inquilino", a lista "Seus papéis" — o contexto da tela decide a navegação, sem troca manual.
 */
export function ContaMenu() {
  const router = useRouter();
  const user = useDisplayUser();
  const { signOut } = useAuthStore();


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

  const grupos: Grupo[] = [
    {
      titulo: "Conta",
      itens: [
        { href: "/dashboard/conta/perfil", label: "Perfil", descricao: "Nome, foto, telefone e documento.", icon: UserRound },
        { href: "/dashboard/conta/perfil-publico", label: "Seu perfil público", descricao: "O que os outros veem de você.", icon: Eye },
        { href: "/dashboard/verificacao", label: "Verificação", descricao: "Confirme sua identidade.", icon: ShieldCheck },
        { href: "/dashboard/conta/excluir", label: "Sair da Viva", descricao: "Apaga seus dados, com confirmação.", icon: Trash2, tom: "perigo" },
      ],
    },
    { titulo: "Notificações", itens: [{ href: "/dashboard/notificacoes", label: "Notificações", descricao: "Avisos por e-mail e no app.", icon: Bell }] },
    {
      titulo: "Privacidade e segurança",
      itens: [
        { href: "/dashboard/conta/seguranca", label: "Senha e segurança", descricao: "Senha e verificação em duas etapas.", icon: Lock },
        { href: "/privacidade", label: "Privacidade", descricao: "Como tratamos seus dados.", icon: FileText },
      ],
    },
    { titulo: "Pagamentos", itens: [{ href: "/dashboard/conta/pagamentos", label: "Pagamentos", descricao: "Para onde vai o valor mensal.", icon: CreditCard }] },
    {
      titulo: null,
      itens: [
        // Sem item de plano: não há mensalidade nesta fase (só taxa por contrato fechado).
        { href: "/dashboard/ferramentas", label: "Ferramentas", descricao: "Simulador, ROI e orçamentos.", icon: Wrench },
        ...(mostraEquipe(user?.role)
          ? [
              { href: ROTA_ADMIN, label: "Painel Admin", descricao: "Área da equipe.", icon: ShieldCheck },
              { href: ROTA_EQUIPE, label: "Equipe e aprovações", descricao: "Documentos e pendências.", icon: Users },
            ]
          : []),
        ...(PROGRAMA_INDICACAO ? [{ href: "/dashboard/indicacoes", label: "Indicações", descricao: "Convide e acompanhe.", icon: Gift }] : []),
        { href: "/dashboard/conta/ajuda", label: "Ajuda e contato", descricao: "Central de ajuda e chamados.", icon: LifeBuoy },
        { href: "/termos", label: "Termos de uso", descricao: "Regras da plataforma.", icon: FileText },
        { onClick: sair, label: "Sair", descricao: "Encerrar a sessão neste aparelho.", icon: LogOut, tom: "perigo" },
      ],
    },
  ];

  return (
    <div className="w-full space-y-4">
      {/* CONTA-A: o título e o cartão do usuário saíram — o topo único da Conta (foto, nome no H1, papéis) vale no site e no app. */}
      <SeusPapeis />
      {grupos
        .filter((g) => g.itens.length > 0)
        .map((g, i) => (
          <section key={i} aria-label={g.titulo ?? "Mais"} data-testid="conta-grupo" data-grupo={g.titulo ?? "mais"}>
          {g.titulo && <h2 className="mb-2 font-title text-base font-semibold text-ink">{g.titulo}</h2>}
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
            {g.itens.map((it) => {
              const Icon = it.icon;
              const conteudo = (
                <>
                  <span
                    className={cn(
                      "grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-white"
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
          </section>
        ))}
    </div>
  );
}
