"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange, Wallet, Search, Users, Minus, Plus } from "lucide-react";
import { CityAutocomplete } from "@/components/city-autocomplete";

/** Busca do hero: Localização / Período / Pessoas / Orçamento → /buscar. */
export function HeroSearch() {
  const router = useRouter();
  const [location, setLocation] = useState("");
  const [period, setPeriod] = useState("");
  const [budget, setBudget] = useState("");
  // Hóspedes (Onda 1): adultos + crianças. O total filtra pela capacidade do
  // imóvel na página de resultados (?adultos & ?criancas).
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    // Acima de 180 dias é atendimento direto, não busca normal (1C).
    if (period === "180plus") {
      window.location.href =
        "mailto:contato@vivanomads.com.br?subject=Loca%C3%A7%C3%A3o%20acima%20de%20180%20dias";
      return;
    }
    const params = new URLSearchParams();
    if (location) params.set("local", location);
    if (period) params.set("periodo", period);
    if (budget) params.set("orcamento", budget);
    // Mesmas regras da página de resultados: adultos só se > 1, crianças se > 0.
    if (adults > 1) params.set("adultos", String(adults));
    if (children > 0) params.set("criancas", String(children));
    router.push(`/buscar?${params.toString()}`);
  }

  return (
    <form
      onSubmit={submit}
      className="grid gap-2 rounded-2xl bg-white p-2 shadow-2xl shadow-blue-900/20 sm:grid-cols-[1.3fr_1fr_1fr_1fr_auto]"
    >
      <CityAutocomplete value={location} onChange={setLocation} />
      <Field icon={CalendarRange}>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          aria-label="Período de estadia"
          className="w-full bg-transparent text-sm text-ink outline-none"
        >
          <option value="">Período</option>
          <option value="30">A partir de 30 dias</option>
          <option value="60">A partir de 60 dias</option>
          <option value="90">A partir de 90 dias</option>
          <option value="180">A partir de 180 dias</option>
          <option value="180plus">Mais de 180 dias (sob consulta)</option>
        </select>
      </Field>
      <GuestsField
        adults={adults}
        children={children}
        onAdults={setAdults}
        onChildren={setChildren}
      />
      <Field icon={Wallet}>
        <select
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          aria-label="Orçamento por mês"
          className="w-full bg-transparent text-sm text-ink outline-none"
        >
          <option value="">Orçamento/mês</option>
          <option value="2500">Até R$ 2.500</option>
          <option value="3500">Até R$ 3.500</option>
          <option value="5000">Até R$ 5.000</option>
          <option value="99999">Acima de R$ 5.000</option>
        </select>
      </Field>
      <button
        type="submit"
        className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-green-500 px-6 text-sm font-bold text-night transition-colors hover:bg-green-300"
      >
        <Search className="h-4 w-4" />
        Buscar
      </button>
    </form>
  );
}

/** Seletor de hóspedes (adultos + crianças) com popover — estilo Airbnb. */
function GuestsField({
  adults,
  children,
  onAdults,
  onChildren,
}: {
  adults: number;
  children: number;
  onAdults: (n: number) => void;
  onChildren: (n: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const total = adults + children;
  const label =
    children > 0
      ? `${total} ${total === 1 ? "pessoa" : "pessoas"}`
      : `${adults} ${adults === 1 ? "adulto" : "adultos"}`;

  // Fecha ao clicar fora / apertar Esc (sem overlay que intercepte cliques).
  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Quantidade de pessoas"
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-xl bg-surface-2 px-3.5 py-3 text-left"
      >
        <Users className="h-4 w-4 shrink-0 text-blue-500" />
        <span className="truncate text-sm text-ink">{label}</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-64 rounded-2xl border border-line bg-white p-4 shadow-xl">
          <GuestRow
            label="Adultos"
            hint="13+ anos"
            value={adults}
            min={1}
            max={16}
            onChange={onAdults}
          />
          <div className="my-3 h-px bg-line" />
          <GuestRow
            label="Crianças"
            hint="0 a 12 anos"
            value={children}
            min={0}
            max={10}
            onChange={onChildren}
          />
        </div>
      )}
    </div>
  );
}

function GuestRow({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="text-xs text-muted">{hint}</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={`Menos ${label.toLowerCase()}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="grid h-8 w-8 place-items-center rounded-full border border-line text-ink transition-colors hover:border-forest disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-5 text-center text-sm font-medium tabular-nums text-ink">{value}</span>
        <button
          type="button"
          aria-label={`Mais ${label.toLowerCase()}`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="grid h-8 w-8 place-items-center rounded-full border border-line text-ink transition-colors hover:border-forest disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function Field({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-surface-2 px-3.5 py-3">
      <Icon className="h-4 w-4 shrink-0 text-blue-500" />
      {children}
    </div>
  );
}
