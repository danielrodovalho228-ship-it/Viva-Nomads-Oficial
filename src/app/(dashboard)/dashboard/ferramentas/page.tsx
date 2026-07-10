"use client";

import Link from "next/link";
import {
  TrendingUp,
  Percent,
  FileText,
  FileSignature,
  Receipt,
  Flame,
  ShieldCheck,
  ArrowRight,
  Lock,
  Wrench,
  Sparkles,
} from "lucide-react";
import { PageTitle } from "@/components/dashboard/primitives";
import { FERRAMENTAS_REAIS } from "@/lib/flags";
import { useAuthStore } from "@/lib/store";
import { cn } from "@/lib/utils";

interface Ferramenta {
  href: string;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  tag?: string; // ex.: "Plano Gestor"
  /** Tela em desenvolvimento: abre o placeholder até a flag FERRAMENTAS_REAIS. */
  soon?: boolean;
}

interface Grupo {
  titulo: string;
  descricao: string;
  itens: Ferramenta[];
}

const GRUPOS: Grupo[] = [
  {
    titulo: "Análise & cálculo",
    descricao: "Entenda o retorno antes de anunciar.",
    itens: [
      {
        href: "/dashboard/simulador",
        title: "Simulador de rentabilidade (do seu imóvel)",
        desc: "Quanto o SEU imóvel rende por mês na Viva Nomads — receita, custos e líquido.",
        icon: TrendingUp,
        soon: true,
      },
      {
        href: "/dashboard/roi-imovel",
        title: "Calculadora de ROI",
        desc: "Vale a pena mobiliar? Payback do investimento e retorno anual.",
        icon: Percent,
        soon: true,
      },
    ],
  },
  {
    titulo: "Fechamento & documentos",
    descricao: "Do orçamento ao contrato assinado.",
    itens: [
      {
        href: "/dashboard/orcamentos",
        title: "Orçamentos",
        desc: "Monte e compartilhe propostas para os interessados.",
        icon: FileText,
        soon: true,
      },
      {
        href: "/dashboard/fechamento",
        title: "Fechamento",
        desc: "Verificação, garantia, serviços e contrato — em um fluxo só.",
        icon: FileSignature,
      },
      {
        href: "/dashboard/contratos",
        title: "Contratos & blocos",
        desc: "Acompanhe os blocos e registre os recebimentos (declaratório).",
        icon: Receipt,
      },
    ],
  },
];

export default function FerramentasPage() {
  const user = useAuthStore((s) => s.user);
  const isGestor = user?.plan === "gestor";

  return (
    <div>
      <PageTitle
        title="Ferramentas"
        subtitle="Tudo o que ajuda você a analisar, fechar e proteger a locação — em um só lugar."
      />

      <div className="space-y-8">
        {GRUPOS.map((g) => (
          <section key={g.titulo}>
            <div className="mb-3">
              <h2 className="font-title text-lg font-bold text-ink">{g.titulo}</h2>
              <p className="text-sm text-muted">{g.descricao}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {g.itens.map((f) => {
                const bloqueado = f.tag === "Plano Gestor" && !isGestor;
                // Em desenvolvimento: o card leva ao placeholder dentro da casca
                // (nunca redirect). Sinaliza "Em breve" com honestidade.
                const emBreve = !!f.soon && !FERRAMENTAS_REAIS;
                return (
                  <Link
                    key={f.href}
                    href={bloqueado ? "/dashboard/assinatura" : f.href}
                    className="group flex flex-col rounded-2xl border border-sage-200 bg-white p-5 transition-colors hover:border-sage hover:bg-surface-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-sage-100 text-forest">
                        <f.icon className="h-5 w-5" />
                      </span>
                      {emBreve ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                          <Lock className="h-3 w-3" /> Em breve
                        </span>
                      ) : (
                        f.tag && (
                          <span
                            className={cn(
                              "rounded-full px-2.5 py-1 text-xs font-medium",
                              bloqueado
                                ? "bg-champagne/20 text-forest"
                                : "bg-sage-100 text-forest"
                            )}
                          >
                            {f.tag}
                          </span>
                        )
                      )}
                    </div>
                    <h3 className="mt-3 font-title font-bold text-ink">{f.title}</h3>
                    <p className="mt-1 flex-1 text-sm text-muted">{f.desc}</p>
                    <span
                      className={cn(
                        "mt-3 inline-flex items-center gap-1 text-sm font-medium",
                        emBreve ? "text-muted" : "text-forest"
                      )}
                    >
                      {emBreve ? "Em breve" : bloqueado ? "Fazer upgrade" : "Abrir"}
                      {!emBreve && (
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      )}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}

        {/* Proteção & garantias — inclui o seguro incêndio (obrigatório por lei),
            em estruturação via parceiro. SEM CTA (aguarda parecer/parceiro). */}
        <section>
          <div className="mb-3">
            <h2 className="font-title text-lg font-bold text-ink">Proteção & garantias</h2>
            <p className="text-sm text-muted">
              Coberturas e garantias que dão segurança à locação.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Card SEM link/CTA — apenas informa o status. */}
            <div className="flex flex-col rounded-2xl border border-sage-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-700">
                  <Flame className="h-5 w-5" />
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                  <Lock className="h-3 w-3" /> Em estruturação
                </span>
              </div>
              <h3 className="mt-3 font-title font-bold text-ink">
                Seguro incêndio{" "}
                <span className="text-sm font-normal text-muted">(obrigatório por lei)</span>
              </h3>
              <p className="mt-1 flex-1 text-sm text-muted">
                Exigido pela Lei do Inquilinato para locações. Estamos estruturando a contratação
                <strong className="text-ink"> via parceiro</strong> — sem custo escondido e sem a
                plataforma intermediar o valor.
              </p>
              <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted">
                Em estruturação — via parceiro
              </span>
            </div>

            {/* Garantia locatícia → página própria (explica a caução + status). */}
            <Link
              href="/dashboard/garantias"
              className="group flex flex-col rounded-2xl border border-sage-200 bg-white p-5 transition-colors hover:border-sage hover:bg-surface-2"
            >
              <div className="flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-sage-100 text-forest">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                {!FERRAMENTAS_REAIS && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                    <Lock className="h-3 w-3" /> Em breve
                  </span>
                )}
              </div>
              <h3 className="mt-3 font-title font-bold text-ink">Garantia locatícia</h3>
              <p className="mt-1 flex-1 text-sm text-muted">
                Caução Viva (50% por bloco, devolvível) ou seguro-fiança via parceiro (em
                estruturação). Uma garantia por contrato — o dinheiro nunca fica com a plataforma.
              </p>
              <span
                className={cn(
                  "mt-3 inline-flex items-center gap-1 text-sm font-medium",
                  FERRAMENTAS_REAIS ? "text-forest" : "text-muted"
                )}
              >
                {FERRAMENTAS_REAIS ? "Ver garantias e cauções" : "Em breve"}
                {FERRAMENTAS_REAIS && (
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                )}
              </span>
            </Link>

            {/* Solicitações de manutenção — documentadas entre inquilino e proprietário
                (insumo do dossiê). SEM prometer rede de parceiros (ainda não existe). */}
            <Link
              href="/dashboard/solicitacoes"
              className="group flex flex-col rounded-2xl border border-sage-200 bg-white p-5 transition-colors hover:border-sage hover:bg-surface-2"
            >
              <div className="flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-sage-100 text-forest">
                  <Wrench className="h-5 w-5" />
                </span>
              </div>
              <h3 className="mt-3 font-title font-bold text-ink">Solicitações de manutenção</h3>
              <p className="mt-1 flex-1 text-sm text-muted">
                O inquilino reporta um problema (com foto); você responde e resolve. Tudo fica
                registrado no histórico do contrato. Rede de parceiros de manutenção — em
                estruturação.
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-forest">
                Abrir solicitações
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </div>
        </section>

        {/* Regra de ouro — rodapé. */}
        <p className="flex items-start gap-2 rounded-xl border border-sage-200 bg-surface-2 px-4 py-3 text-sm text-muted">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-sage" />
          Em todas as ferramentas, a Viva Nomads <strong>calcula, conecta e documenta</strong> — o
          dinheiro (aluguel, caução, seguros) vai direto ao proprietário, à conta vinculada ou ao
          parceiro. A plataforma nunca retém valores.
        </p>
      </div>
    </div>
  );
}
