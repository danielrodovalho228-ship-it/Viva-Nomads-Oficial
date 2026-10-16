import { Search, Bell } from "lucide-react";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { ButtonLink } from "@/components/ui/button";
import { FavoritosTabs } from "@/components/dashboard/favoritos-tabs";
import { isSupabaseConfigured } from "@/lib/env";
import { listarBuscasSalvas } from "@/lib/data/buscas-salvas-actions";
import { ListaBuscasSalvas } from "@/components/busca/lista-buscas-salvas";

const SAMPLE_SAVED = [
  { query: "Uberlândia · até R$ 3.500 · 2 quartos · Pronto para Morar", count: 4 },
  { query: "Centro · Studio · aceita 30 dias", count: 2 },
];

export default async function SavedSearchesPage() {
  // Modo real: as buscas salvas no coração da /buscar (0122); demo: mostra exemplos.
  const reais = isSupabaseConfigured() ? await listarBuscasSalvas() : null;
  const vazio = reais ? reais.length === 0 : SAMPLE_SAVED.length === 0;

  return (
    <>
      <FavoritosTabs />
      <PageTitle capa="buscas"
        title="Buscas salvas"
        subtitle="Receba avisos quando novos imóveis combinarem com seus filtros."
        action={
          <ButtonLink href="/buscar" variant="gold">
            <Search className="h-4 w-4" /> Nova busca
          </ButtonLink>
        }
      />
      {vazio ? (
        <EmptyState
          icon={Search}
          title="Nenhuma busca salva ainda"
          text="Na busca, toque em “Salvar busca” (o coração ao lado da contagem) para guardar os filtros e voltar a eles depois."
          action={
            <ButtonLink href="/buscar" variant="gold">
              <Search className="h-4 w-4" /> Buscar imóveis
            </ButtonLink>
          }
        />
      ) : reais ? (
        <ListaBuscasSalvas inicial={reais} />
      ) : (
        <div className="grid gap-4">
          {SAMPLE_SAVED.map((s) => (
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
