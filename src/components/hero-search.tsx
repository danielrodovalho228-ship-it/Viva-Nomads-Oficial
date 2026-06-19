"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, CalendarRange, Wallet, Search } from "lucide-react";
import { LocationDatalist } from "@/lib/locations";

/** Busca do hero: Localização / Período / Orçamento → /buscar. */
export function HeroSearch() {
  const router = useRouter();
  const [location, setLocation] = useState("");
  const [period, setPeriod] = useState("");
  const [budget, setBudget] = useState("");

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
    router.push(`/buscar?${params.toString()}`);
  }

  return (
    <form
      onSubmit={submit}
      className="grid gap-2 rounded-2xl bg-white p-2 shadow-2xl shadow-blue-900/20 sm:grid-cols-[1.3fr_1fr_1fr_auto]"
    >
      <Field icon={MapPin}>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Cidade ou bairro"
          list="hero-location-list"
          autoComplete="off"
          className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
        />
        <LocationDatalist id="hero-location-list" />
      </Field>
      <Field icon={CalendarRange}>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
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
      <Field icon={Wallet}>
        <select
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
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
