"use client";

import { useState } from "react";
import { Check, ShieldCheck, Megaphone, MessageSquare, X } from "lucide-react";
import { PageTitle } from "@/components/dashboard/primitives";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { capaDoMorador } from "@/components/dashboard/capas";
import { gravarLocalStorageBruto, useLocalStorageBruto } from "@/lib/use-client-state";
import { useEstadoIdentidade } from "@/lib/identidade/use-estado-identidade";
import type { EstadoIdentidade } from "@/lib/identidade/estado";

/** O passo "Verificação de identidade" com o estado ÚNICO (complemento do prompt 23): o texto vem da função. */
function passoIdentidade(id: EstadoIdentidade | null): { titulo: string; texto: string; cta: Cta } {
  if (!id) return { titulo: "Verificação de identidade", texto: "Carregando…", cta: { label: "Saber mais", href: "/dashboard/verificacao", variant: "outline" } };
  if (id.estado === "confirmada") return { titulo: id.texto, texto: "Seu perfil mostra a identidade confirmada.", cta: { label: "Ver verificação", href: "/dashboard/verificacao", variant: "outline" } };
  if (id.acao) return { titulo: id.texto, texto: "Leva um minuto e reforça seu perfil.", cta: { label: id.acao.texto, href: id.acao.href, variant: "outline" } };
  return { titulo: id.texto, texto: "Você já pode se candidatar sem ela. Quando abrir, avisamos — e ela reforça seu perfil.", cta: { label: "Saber mais", href: "/dashboard/verificacao", variant: "outline" } };
}

const KEY = "vivanomads-tenant-onboarding";

type Cta = { label: string; href: string; variant: "primary" | "outline" };
type Step = {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
  ctas: Cta[];
  highlight?: boolean;
};

// Espelho do funil do proprietário, para o inquilino. Textos derivados dos
// existentes; sem vídeo. O Pedido de Moradia ganha destaque (diferencial).
const STEPS: Step[] = [
  {
    id: "verificar",
    icon: ShieldCheck,
    // Título, texto e botão vêm do estado único da identidade (passoIdentidade).
    title: "Verificação de identidade",
    text: "",
    ctas: [],
  },
  {
    id: "encontrar",
    icon: Megaphone,
    title: "Encontre seu lugar",
    text: "Dois caminhos: busque imóveis ou publique um Pedido de Moradia e deixe os proprietários da cidade virem até você.",
    ctas: [
      { label: "Publicar pedido", href: "/pedidos/novo", variant: "primary" },
      { label: "Buscar imóveis", href: "/buscar", variant: "outline" },
    ],
    highlight: true,
  },
  {
    id: "conversar",
    icon: MessageSquare,
    title: "Converse e candidate-se",
    text: "Tudo pela plataforma — a conversa fica registrada e protegida.",
    ctas: [{ label: "Ver mensagens", href: "/dashboard/mensagens", variant: "outline" }],
  },
];

type Saved = { done: string[]; hidden: boolean };

/**
 * Primeiro acesso do inquilino: substitui o banner "Olá" por um checklist de 3
 * passos com estado (feito/pendente). O usuário marca cada passo como feito; o
 * card pode ser ocultado. Quando os 3 estão concluídos (ou ao ocultar), volta
 * o banner normal. Estado persistido por navegador (localStorage).
 */
export function TenantOnboarding({ name }: { name: string }) {
  const raw = useLocalStorageBruto(KEY); // undefined = ainda hidratando
  // Complemento do prompt 23: o passo "verificar" lê o laudo (confirmada / teste / em breve), não um texto fixo.
  const identidade = useEstadoIdentidade().situacao?.identidade ?? null;
  const cartao = { ...passoIdentidade(identidade), estado: identidade?.estado ?? "carregando" };
  const passos: Step[] = STEPS.map((s) => (s.id === "verificar" ? { ...s, title: cartao.titulo, text: cartao.texto, ctas: [cartao.cta] } : s));
  // Cópia local: mantém a tela funcionando mesmo se o navegador bloquear o localStorage.
  const [local, setLocal] = useState<Saved | null>(null);
  let doArmazenamento: Saved = { done: [], hidden: false };
  if (raw) {
    try {
      doArmazenamento = JSON.parse(raw) as Saved;
    } catch {
      /* valor corrompido: recomeça */
    }
  }
  const saved: Saved | null = raw === undefined ? null : (local ?? doArmazenamento);

  function persist(next: Saved) {
    setLocal(next);
    gravarLocalStorageBruto(KEY, JSON.stringify(next));
  }

  const banner = (
    <PageTitle
      capa={capaDoMorador()}
      title={`Olá${name ? `, ${name}` : "!"} 👋`}
      subtitle="Encontre o imóvel certo para a sua próxima fase."
      action={
        <ButtonLink href="/buscar" variant="accent">
          Buscar imóveis
        </ButtonLink>
      }
    />
  );

  // Antes de hidratar, mostra o banner (evita "pulo" e SSR consistente).
  if (saved === null) return banner;

  const feitos = cartao.estado === "confirmada" && !saved.done.includes("verificar") ? [...saved.done, "verificar"] : saved.done;
  // O "concluído" automático da identidade só muda a exibição: o cartão não some sozinho por causa dele.
  const allDone = STEPS.every((s) => saved.done.includes(s.id));
  if (saved.hidden || allDone) return banner;

  function toggle(id: string) {
    const cur = saved as Saved;
    const done = cur.done.includes(id)
      ? cur.done.filter((d) => d !== id)
      : [...cur.done, id];
    persist({ ...cur, done });
  }

  const doneCount = feitos.length;

  return (
    <section className="mb-6 overflow-hidden rounded-xl border border-sage-200 bg-white">
      <div className="flex items-start justify-between gap-4 border-b border-sage-200 bg-surface-2 px-5 py-4">
        <div>
          <h2 className="font-title text-lg font-semibold text-ink">
            Comece por aqui{name ? `, ${name}` : ""} 👋
          </h2>
          <p className="text-sm text-muted">
            {doneCount}/3 concluídos · alguns passos para aproveitar o Viva Nomads.
          </p>
        </div>
        <button
          onClick={() => persist({ ...saved, hidden: true })}
          className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-muted hover:bg-white hover:text-ink"
        >
          <X className="h-3.5 w-3.5" /> Ocultar
        </button>
      </div>

      <ol className="divide-y divide-sage-200">
        {passos.map((s, i) => {
          const done = feitos.includes(s.id);
          const Icon = s.icon;
          return (
            <li key={s.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start" data-testid={`onboarding-${s.id}`} data-estado={s.id === "verificar" ? cartao.estado : undefined}>
              <span
                className={cn(
                  "grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-semibold",
                  done ? "bg-champagne text-forest" : "bg-forest text-white"
                )}
              >
                {done ? <Check className="h-5 w-5" /> : i + 1}
              </span>

              <div className="min-w-0 flex-1">
                <h3 className="flex items-center gap-2 font-title font-semibold text-ink">
                  <Icon className="h-4 w-4 text-sage" />
                  {s.title}
                  {s.highlight && (
                    <span className="rounded-full bg-champagne/20 px-2 py-1 text-[11px] font-semibold text-champagne-600">
                      nosso diferencial
                    </span>
                  )}
                </h3>
                <p className={cn("mt-1 text-sm", done ? "text-muted line-through" : "text-muted")}>
                  {s.text}
                </p>
                {!done && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {s.ctas.map((c) => (
                      <ButtonLink key={c.href} href={c.href} variant={c.variant} size="sm">
                        {c.label}
                      </ButtonLink>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => toggle(s.id)}
                className={cn(
                  "shrink-0 self-start rounded-full border px-3 py-2 text-xs font-medium transition-colors",
                  done
                    ? "border-champagne bg-champagne/10 text-champagne-600"
                    : "border-sage-200 text-muted hover:border-sage hover:text-ink"
                )}
              >
                {done ? "Concluído ✓" : "Marcar como feito"}
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
