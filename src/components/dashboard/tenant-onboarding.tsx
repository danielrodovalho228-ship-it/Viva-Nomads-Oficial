"use client";

import { useEffect, useState } from "react";
import { Check, ShieldCheck, Megaphone, MessageSquare, X } from "lucide-react";
import { DashboardBanner } from "@/components/dashboard/banner";
import { ButtonLink } from "@/components/ui/button";
import { PHOTOS } from "@/lib/media";
import { cn } from "@/lib/utils";

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
    title: "Verifique sua identidade",
    text: "Leva 2 minutos e destrava suas candidaturas.",
    ctas: [{ label: "Verificar identidade", href: "/dashboard/verificacao", variant: "primary" }],
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
  const [saved, setSaved] = useState<Saved | null>(null); // null = ainda hidratando

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      setSaved(raw ? (JSON.parse(raw) as Saved) : { done: [], hidden: false });
    } catch {
      setSaved({ done: [], hidden: false });
    }
  }, []);

  function persist(next: Saved) {
    setSaved(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  const banner = (
    <DashboardBanner
      className="mb-6"
      image={PHOTOS.dashTenant}
      alt="Canto aconchegante de apartamento mobiliado com luz da manhã"
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

  const allDone = STEPS.every((s) => saved.done.includes(s.id));
  if (saved.hidden || allDone) return banner;

  function toggle(id: string) {
    const cur = saved as Saved;
    const done = cur.done.includes(id)
      ? cur.done.filter((d) => d !== id)
      : [...cur.done, id];
    persist({ ...cur, done });
  }

  const doneCount = saved.done.length;

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-sage-200 bg-white">
      <div className="flex items-start justify-between gap-4 border-b border-sage-200 bg-surface-2 px-5 py-4">
        <div>
          <h2 className="font-title text-lg font-bold text-ink">
            Comece por aqui{name ? `, ${name}` : ""} 👋
          </h2>
          <p className="text-sm text-muted">
            {doneCount}/3 concluídos · alguns passos para aproveitar o Viva Nomads.
          </p>
        </div>
        <button
          onClick={() => persist({ ...saved, hidden: true })}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-muted hover:bg-white hover:text-ink"
        >
          <X className="h-3.5 w-3.5" /> Ocultar
        </button>
      </div>

      <ol className="divide-y divide-sage-200">
        {STEPS.map((s, i) => {
          const done = saved.done.includes(s.id);
          const Icon = s.icon;
          return (
            <li key={s.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start">
              <span
                className={cn(
                  "grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold",
                  done ? "bg-champagne text-forest" : "bg-forest text-white"
                )}
              >
                {done ? <Check className="h-5 w-5" /> : i + 1}
              </span>

              <div className="min-w-0 flex-1">
                <h3 className="flex items-center gap-2 font-title font-bold text-ink">
                  <Icon className="h-4 w-4 text-sage" />
                  {s.title}
                  {s.highlight && (
                    <span className="rounded-full bg-champagne/20 px-2 py-0.5 text-[11px] font-semibold text-champagne-600">
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
                  "shrink-0 self-start rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
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
