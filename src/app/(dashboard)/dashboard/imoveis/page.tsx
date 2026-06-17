import Link from "next/link";
import { Home, Plus, Eye, Bath, BedDouble } from "lucide-react";
import { PageTitle, EmptyState } from "@/components/dashboard/primitives";
import { ButtonLink } from "@/components/ui/button";
import { WorkReadyBadge } from "@/components/ui/badge";
import { PhotoPlaceholder } from "@/components/ui/photo-placeholder";
import { SAMPLE_PROPERTIES } from "@/lib/properties";
import { formatBRL } from "@/lib/utils";

export default function MyPropertiesPage() {
  const properties = SAMPLE_PROPERTIES.slice(0, 2);

  return (
    <>
      <PageTitle
        title="Meus imóveis"
        subtitle="Gerencie seus anúncios e o status de publicação."
        action={
          <ButtonLink href="/qualificar" variant="gold">
            <Plus className="h-4 w-4" /> Novo anúncio
          </ButtonLink>
        }
      />

      {properties.length === 0 ? (
        <EmptyState
          icon={Home}
          title="Você ainda não tem imóveis"
          text="Comece pela qualificação para liberar a publicação do seu primeiro anúncio."
          action={
            <ButtonLink href="/qualificar" variant="gold">
              Qualificar imóvel
            </ButtonLink>
          }
        />
      ) : (
        <div className="grid gap-4">
          {properties.map((p) => (
            <div
              key={p.id}
              className="flex flex-col gap-4 rounded-2xl border border-sage-200 bg-white p-4 sm:flex-row"
            >
              <PhotoPlaceholder
                label={p.photos[0]}
                className="aspect-[4/3] w-full shrink-0 rounded-xl sm:w-48"
              />
              <div className="flex flex-1 flex-col">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-sage-100 px-2.5 py-1 text-xs font-medium text-forest">
                    Ativo
                  </span>
                  {p.workReadyBadge && <WorkReadyBadge />}
                </div>
                <Link
                  href={`/imoveis/${p.id}`}
                  className="mt-2 font-title text-lg font-bold text-ink hover:text-forest"
                >
                  {p.title}
                </Link>
                <div className="mt-1 flex gap-4 text-sm text-muted">
                  <span className="inline-flex items-center gap-1">
                    <BedDouble className="h-4 w-4" /> {p.bedrooms}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Bath className="h-4 w-4" /> {p.bathrooms}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Eye className="h-4 w-4" /> 624 visualizações
                  </span>
                </div>
                <div className="mt-auto flex items-center justify-between pt-3">
                  <span className="font-title text-xl font-extrabold text-forest">
                    {formatBRL(p.monthlyPrice)}
                    <span className="text-sm font-normal text-muted">/mês</span>
                  </span>
                  <div className="flex gap-2">
                    <ButtonLink href={`/imoveis/${p.id}`} variant="outline" size="sm">
                      Ver
                    </ButtonLink>
                    <ButtonLink href="/dashboard/imoveis/novo" variant="ghost" size="sm">
                      Editar
                    </ButtonLink>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
