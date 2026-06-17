"use client";

import Link from "next/link";
import { GitCompare, Check, Minus, Award } from "lucide-react";
import { PageTitle, EmptyState } from "@/components/dashboard/primitives";
import { ButtonLink } from "@/components/ui/button";
import { SAMPLE_PROPERTIES } from "@/lib/properties";
import { useFavoritesStore } from "@/lib/favorites-store";
import { formatBRL, cn } from "@/lib/utils";
import type { Property } from "@/lib/types";

export default function ComparePage() {
  const ids = useFavoritesStore((s) => s.ids);
  const items = SAMPLE_PROPERTIES.filter((p) => ids.includes(p.id)).slice(0, 4);

  if (items.length < 2) {
    return (
      <>
        <PageTitle title="Comparar imóveis" />
        <EmptyState
          icon={GitCompare}
          title="Favorite ao menos 2 imóveis"
          text="Adicione imóveis aos favoritos para compará-los lado a lado: preço, área, recursos de trabalho e compatibilidade."
          action={
            <ButtonLink href="/buscar" variant="primary">
              Buscar imóveis
            </ButtonLink>
          }
        />
      </>
    );
  }

  const rows: { label: string; render: (p: Property) => React.ReactNode }[] = [
    { label: "Preço/mês", render: (p) => <strong className="text-forest">{formatBRL(p.monthlyPrice)}</strong> },
    { label: "Tipo", render: (p) => p.propertyType },
    { label: "Bairro", render: (p) => `${p.neighborhood}, ${p.city}` },
    { label: "Quartos", render: (p) => p.bedrooms },
    { label: "Banheiros", render: (p) => p.bathrooms },
    { label: "Área", render: (p) => `${p.areaM2} m²` },
    { label: "Período mínimo", render: (p) => `${p.minPeriodDays} dias` },
    {
      label: "Pronto para Trabalho",
      render: (p) =>
        p.workReadyBadge ? (
          <span className="inline-flex items-center gap-1 text-champagne-600">
            <Award className="h-4 w-4" /> Sim
          </span>
        ) : (
          <Minus className="h-4 w-4 text-muted" />
        ),
    },
    {
      label: "Compatibilidade trabalho",
      render: (p) => <CompatBar score={p.workScore} />,
    },
    {
      label: "Coworking próximo",
      render: (p) => {
        const cw = p.nearbyWorkspaces.find((w) => w.type === "coworking");
        return cw ? `${cw.distanceM} m` : <Minus className="h-4 w-4 text-muted" />;
      },
    },
    {
      label: "Recursos de trabalho",
      render: (p) => (
        <ul className="space-y-0.5 text-xs">
          {p.workFeatures.slice(0, 3).map((f) => (
            <li key={f} className="flex items-center gap-1">
              <Check className="h-3 w-3 text-sage" /> {f}
            </li>
          ))}
        </ul>
      ),
    },
  ];

  return (
    <>
      <PageTitle
        title="Comparar imóveis"
        subtitle={`${items.length} imóveis · compatibilidade com seu perfil de trabalho`}
      />
      <div className="overflow-x-auto rounded-2xl border border-sage-200 bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-sage-200">
              <th className="w-40 px-4 py-4" />
              {items.map((p) => (
                <th key={p.id} className="px-4 py-4 text-left align-top">
                  <Link href={`/imoveis/${p.id}`} className="font-title font-bold text-ink hover:text-forest">
                    {p.title}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-sage-200">
            {rows.map((row) => (
              <tr key={row.label}>
                <td className="px-4 py-3 font-medium text-muted">{row.label}</td>
                {items.map((p) => (
                  <td key={p.id} className="px-4 py-3 text-ink">
                    {row.render(p)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Score de compatibilidade "Pronto para Trabalho" (4.5). */
function CompatBar({ score }: { score: number }) {
  return (
    <div>
      <span className={cn("text-sm font-semibold", score >= 70 ? "text-champagne-600" : "text-muted")}>
        {score}% compatível
      </span>
      <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-sage-100">
        <div className="h-full rounded-full bg-champagne" style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}
