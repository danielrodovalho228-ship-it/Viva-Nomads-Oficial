import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Briefcase, MapPinned } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { ListaNumeros, NumeroHeroi } from "@/components/admin/numeros";
import { maisBuscados, TIPOS_DESTINO } from "@/lib/destinos/regras";
import { DestinoBotao, DestinoForm, type DestinoEditavel } from "./forms";
import { faltaParaRotas } from "@/lib/rotas/tempo";
import { integracoesSimuladas } from "@/lib/integracoes";

export const metadata = { title: "Destinos — Admin", robots: { index: false, follow: false } };

interface Linha extends DestinoEditavel {
  id: string;
  ativo: boolean;
}

/** Contagem por destino e dia (tabela só do servidor: lida com o cliente de serviço, depois do portão do admin). */
async function buscasDe30Dias(): Promise<{ destino_id: string; n: number }[]> {
  const admin = createAdminClient();
  if (!admin) return [];
  const desde = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const { data } = await admin.from("destinos_buscas_dia").select("destino_id, n").gte("dia", desde);
  return (data ?? []) as { destino_id: string; n: number }[];
}

/**
 * Admin → Destinos (prompt 37): hospitais, universidades e empresas para a busca pelo tempo até o trabalho.
 * Cadastrar pelo nome, conferir o ponto no mapa e ativar. "Destinos mais buscados" mostra só a contagem dos últimos
 * 30 dias (nada de endereço nem de quem buscou). O layout de /admin já barra quem não é admin; a RLS barra de novo.
 */
export default async function AdminDestinosPage({ searchParams }: { searchParams: Promise<{ editar?: string }> }) {
  const { editar } = await searchParams;
  const supabase = await createClient();
  if (!supabase) {
    return (
      <>
        <PageTitle title="Destinos" />
        <EmptyState icon={MapPinned} title="Modo demonstração" text="Sem conexão com o banco: nenhum dado real para mostrar." action={<ButtonLink href="/admin" variant="secondary" size="sm">Voltar ao painel</ButtonLink>} />
      </>
    );
  }
  // Lista com o cliente de serviço (o layout do /admin já barrou quem não é admin): com o cliente da sessão, a RLS
  // escondia os destinos do admin sem a 2ª etapa na sessão, e "Editar" virava cadastro novo (22/10).
  const leitor = createAdminClient() ?? supabase;
  const { data, error } = await leitor.from("destinos").select("id, slug, nome, artigo, tipo, cidade, uf, lat, lng, ativo").order("nome");
  const lista = (data ?? []) as Linha[];
  const ranking = maisBuscados(await buscasDe30Dias(), new Map(lista.map((d) => [d.id, d.nome])));
  const emEdicao = lista.find((d) => d.slug === editar);
  const tipo = (t: string) => TIPOS_DESTINO.find((x) => x.valor === t)?.rotulo ?? t;

  return (
    <>
      <PageTitle title="Destinos" subtitle="Hospitais, universidades e empresas para a busca pelo tempo até o trabalho." />
      {error && (
        <p role="alert" className="mb-6 rounded-xl border border-line bg-white px-4 py-3 text-sm text-amber-800">
          Não foi possível ler os destinos agora. Tente de novo em instantes.
        </p>
      )}
      <NumeroHeroi rotulo="Destinos ativos" valor={lista.filter((d) => d.ativo).length} href="#destinos" />
      {/* E31: sem o token, a busca e o anúncio só mostram a linha reta — o admin vê aqui o que falta (só o nome). */}
      {(() => {
        const falta = faltaParaRotas(process.env, integracoesSimuladas());
        return (
          <p className="mb-4 text-sm text-ink" data-testid="destinos-provedor" data-ok={falta.length ? "0" : "1"}>
            {falta.length
              ? `Tempo por rota desligado: falta a variável ${falta.join(", ")} na Vercel (produção). Até lá, a busca e o anúncio mostram só a distância em linha reta.`
              : "Tempo por rota ligado (carro, a pé e bicicleta)."}
          </p>
        );
      })()}
      <ListaNumeros
        className="mb-6"
        itens={[
          { rotulo: "Sem ponto conferido", valor: lista.filter((d) => d.lat == null).length, href: "#destinos" },
          { rotulo: "Buscas em 30 dias", valor: ranking.reduce((n, r) => n + r.total, 0), href: "#mais-buscados" },
        ]}
      />

      <Panel title="Destinos" className="mb-6 scroll-mt-24" id="destinos">
        {lista.length === 0 ? (
          <EmptyState icon={Briefcase} title="Nenhum destino" text="Cadastre abaixo o primeiro destino." action={<ButtonLink href="#form-destino" variant="secondary" size="sm">Cadastrar o primeiro destino</ButtonLink>} />
        ) : (
          <ul className="space-y-3" data-testid="destinos-lista">
            {lista.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sage-200 p-3" data-testid="destino-linha" data-slug={d.slug}>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{d.nome}</p>
                  <p className="text-xs text-muted">
                    {tipo(d.tipo)} · {d.cidade} – {d.uf} · {d.ativo ? "Ativo" : d.lat == null ? "Sem ponto conferido" : "Inativo"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Link href={`/admin/destinos?editar=${d.slug}#form-destino`} className="text-sm font-semibold text-forest underline">
                    {d.lat == null ? "Conferir no mapa" : "Editar"}
                  </Link>
                  <DestinoBotao id={d.id} ativo={d.ativo} temPonto={d.lat != null && d.lng != null} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title={emEdicao ? `Editar: ${emEdicao.nome}` : "Cadastrar destino"} className="mb-6" id="form-destino">
        {/* E32: a key remonta o formulário (e o ponto em estado) ao trocar de destino: sem ela, "Editar" abria com latitude e longitude vazias. */}
        <DestinoForm key={emEdicao?.slug ?? "novo"} inicial={emEdicao} />
      </Panel>

      <Panel title="Destinos mais buscados (30 dias)" id="mais-buscados">
        {ranking.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma busca com destino nos últimos 30 dias.</p>
        ) : (
          <ol className="divide-y divide-sage-200 rounded-xl border border-sage-200" data-testid="destinos-mais-buscados">
            {ranking.map((r) => (
              <li key={r.nome} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                <span className="text-ink">{r.nome}</span>
                <span className="font-semibold text-forest">{r.total.toLocaleString("pt-BR")}</span>
              </li>
            ))}
          </ol>
        )}
        <p className="mt-2 text-xs text-muted">Só a contagem por destino: a Viva não guarda o endereço digitado nem quem buscou.</p>
      </Panel>
    </>
  );
}
