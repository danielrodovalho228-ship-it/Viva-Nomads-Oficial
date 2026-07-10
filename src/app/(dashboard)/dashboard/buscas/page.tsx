import { Search, Bell } from "lucide-react";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { ButtonLink } from "@/components/ui/button";
import { FavoritosTabs } from "@/components/dashboard/favoritos-tabs";
import { isSupabaseConfigured } from "@/lib/env";

const SAMPLE_SAVED = [
  { query: "Uberlândia · até R$ 3.500 · 2 quartos · Pronto para Morar", count: 4 },
  { query: "Centro · Studio · aceita 30 dias", count: 2 },
];

export default function SavedSearchesPage() {
  // Modo real: sem buscas fictícias; demo: mostra exemplos.
  const saved = isSupabaseConfigured() ? [] : SAMPLE_SAVED;

  return (
    <>
      <FavoritosTabs />
      <PageTitle
        title="Buscas salvas"
        subtitle="Receba avisos quando novos imóveis combinarem com seus filtros."
        action={
          <ButtonLink href="/buscar" variant="gold">
            <Search className="h-4 w-4" /> Nova busca
          </ButtonLink>
        }
      />
      {saved.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Nenhuma busca salva ainda"
          text="Faça uma busca e salve os filtros para receber um aviso quando um novo imóvel combinar com o que você procura."
          action={
            <ButtonLink href="/buscar" variant="gold">
              <Search className="h-4 w-4" /> Buscar imóveis
            </ButtonLink>
          }
        />
      ) : (
        <div className="grid gap-4">
          {saved.map((s) => (
            <Panel key={s.query} className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-ink">{s.query}</p>
                <p className="text-sm text-muted">{s.count} imóveis encontrados</p>
              </div>
              <button className="inline-flex items-center gap-2 rounded-full bg-sage-100 px-3 py-2 text-sm font-medium text-forest">
                <Bell className="h-4 w-4" /> Alertas ativos
              </button>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
