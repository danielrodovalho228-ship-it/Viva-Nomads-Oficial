import { dataBRT } from "@/lib/datas-brasilia";
import { MapPinned, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { ListaNumeros, NumeroHeroi } from "@/components/admin/numeros";
import { rankingInteresse, type LinhaInteresse } from "@/lib/cidades-liberadas/regras";
import { listarCidades } from "@/lib/cidades-liberadas/servidor";
import { CadastroCidadeForm, CidadeBotao } from "./forms";

export const metadata = { title: "Cidades liberadas — Admin" };

/**
 * Admin → Cidades liberadas (ordem 335b4064): libera/pausa cidade e ranking de interesse (proprietários × inquilinos),
 * que serve para direcionar tráfego pago. Padrão das telas do admin: PageTitle + número-herói + lista + Panel, cartões no celular e
 * tabela no computador. O layout de /admin já barra quem não é admin; a RLS barra de novo no banco.
 */
export default async function AdminCidadesPage() {
  const supabase = await createClient();
  if (!supabase) {
    return (
      <>
        <PageTitle title="Cidades liberadas" />
        <EmptyState icon={MapPinned} title="Modo demonstração" text="Sem conexão com o banco: nenhum dado real para mostrar." />
      </>
    );
  }
  const [cidades, { data: interesses, error }] = await Promise.all([
    listarCidades(supabase),
    supabase.from("interesse_cidade").select("uf, chave, cidade, papel").limit(5000),
  ]);
  const lista = cidades ?? [];
  const ranking = rankingInteresse((interesses ?? []) as LinhaInteresse[]);
  const liberadas = lista.filter((c) => c.liberada).length;
  const dataBR = (iso: string | null) => (iso ? dataBRT(iso) : "—");

  return (
    <>
      <PageTitle title="Cidades liberadas" subtitle="Só dá para publicar imóvel em cidade liberada. Quem busca ou pede moradia em outra cidade pode deixar o interesse." />
      {(cidades === null || error) && (
        <p role="alert" className="mb-6 rounded-xl border border-line bg-white px-4 py-3 text-sm text-amber-800">
          Não foi possível ler todos os dados agora. Tente de novo em instantes.
        </p>
      )}
      <div className="mb-6">
        <NumeroHeroi rotulo="Cidades liberadas" valor={liberadas} href="#lista" />
        <ListaNumeros
          itens={[
            { rotulo: "Cidades pausadas", valor: lista.length - liberadas, href: "#lista" },
            { rotulo: "Cidades com interesse", valor: ranking.length, href: "#interesse" },
            { rotulo: "Pessoas interessadas", valor: ranking.reduce((n, c) => n + c.total, 0), href: "#interesse" },
          ]}
        />
      </div>

      <Panel title="Cidades" className="mb-6 scroll-mt-24" id="lista">
        {lista.length === 0 ? (
          <EmptyState icon={MapPinned} title="Nenhuma cidade cadastrada" text="Cadastre abaixo a primeira cidade liberada." />
        ) : (
          <>
            <ul className="space-y-3 md:hidden" data-testid="cidades-cartoes">
              {lista.map((c) => (
                <li key={`${c.uf}-${c.chave}`} className="flex items-center justify-between gap-3 rounded-xl border border-sage-200 p-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{c.cidade} – {c.uf}</p>
                    <p className="text-xs text-muted">{c.liberada ? `Liberada em ${dataBR(c.liberada_em)}` : "Pausada"}</p>
                  </div>
                  <CidadeBotao uf={c.uf} chave={c.chave} liberada={c.liberada} />
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto md:block" data-testid="cidades-tabela">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-muted">
                  <tr><th className="py-2">Cidade</th><th>Situação</th><th>Liberada em</th><th>Observação</th><th /></tr>
                </thead>
                <tbody>
                  {lista.map((c) => (
                    <tr key={`${c.uf}-${c.chave}`} className="border-t border-sage-100">
                      <td className="py-2 font-semibold text-ink">{c.cidade} – {c.uf}</td>
                      <td>{c.liberada ? "Liberada" : "Pausada"}</td>
                      <td>{dataBR(c.liberada_em)}</td>
                      <td className="max-w-xs truncate text-muted">{c.observacao ?? "—"}</td>
                      <td className="py-2 text-right"><CidadeBotao uf={c.uf} chave={c.chave} liberada={c.liberada} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>

      <Panel title="Cadastrar cidade" className="mb-6">
        <CadastroCidadeForm />
      </Panel>

      <Panel title="Interesse por cidade" id="interesse">
        {ranking.length === 0 ? (
          <EmptyState icon={Users} title="Ainda sem interesse registrado" text="Quando alguém buscar ou tentar publicar numa cidade fechada e pedir aviso, aparece aqui." />
        ) : (
          <ol className="divide-y divide-sage-100" data-testid="ranking-interesse">
            {ranking.map((c, i) => (
              <li key={`${c.uf}-${c.chave}`} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span className="font-semibold text-ink">{i + 1}. {c.cidade} – {c.uf}</span>
                <span className="text-muted">{c.proprietarios} proprietário(s) · {c.inquilinos} inquilino(s) · <strong className="text-ink">{c.total}</strong> no total</span>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </>
  );
}
