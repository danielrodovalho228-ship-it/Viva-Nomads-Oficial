import { Search, Bell } from "lucide-react";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { ButtonLink } from "@/components/ui/button";

const SAVED = [
  { query: "Uberlândia · até R$ 3.500 · 2 quartos · Pronto para Trabalho", count: 4 },
  { query: "Centro · Studio · aceita 30 dias", count: 2 },
];

export default function SavedSearchesPage() {
  return (
    <>
      <PageTitle
        title="Buscas salvas"
        subtitle="Receba avisos quando novos imóveis combinarem com seus filtros."
        action={
          <ButtonLink href="/buscar" variant="gold">
            <Search className="h-4 w-4" /> Nova busca
          </ButtonLink>
        }
      />
      <div className="grid gap-4">
        {SAVED.map((s) => (
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
    </>
  );
}
