import Link from "next/link";
import { dataBRT } from "@/lib/datas-brasilia";
import { ButtonLink } from "@/components/ui/button";
import { Briefcase, MapPinned } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { ListaNumeros, NumeroHeroi } from "@/components/admin/numeros";
import { maisBuscados, TIPOS_DESTINO } from "@/lib/destinos/regras";
import { DestinoBotao, DestinoForm, ResolverNaoAchado, ResolverReporte, type DestinoEditavel } from "./forms";
import { JANELA_AGREGADO_DIAS, MIN_PESSOAS_AGREGADO, pontoValido } from "@/lib/destinos/pessoal";
import { faltaParaRotas } from "@/lib/rotas/tempo";
import { integracoesSimuladas } from "@/lib/integracoes";

export const metadata = { title: "Destinos — Admin", robots: { index: false, follow: false } };

interface Linha extends DestinoEditavel {
  id: string;
  ativo: boolean;
}

/** Contagem por destino e dia (tabela só do servidor: lida com o cliente de serviço, depois do portão do admin). */
/** PERTO-B: avisos "Está errado" em aberto (lidos com o cliente de serviço, depois do portão do admin). */
async function reportesAbertos(): Promise<{ id: string; nome: string; tipo: string | null; motivo: string; criado_em: string; properties: { title: string | null; city: string | null } | null }[]> {
  const admin = createAdminClient();
  if (!admin) return [];
  const { data } = await admin.from("proximidades_reportes").select("id, nome, tipo, motivo, criado_em, properties(title, city)").is("resolvido_em", null).order("criado_em", { ascending: false }).limit(100);
  return (data ?? []) as unknown as Awaited<ReturnType<typeof reportesAbertos>>;
}

/**
 * DESTINO-PESSOAL-B: os pontos que muita gente usa como "Outro local" — só o agregado do banco (célula de ~300 m com 5
 * pessoas distintas ou mais em 90 dias). O admin nunca lê destinos_pessoais: nem endereço, nem rótulo, nem quem.
 */
async function pontosPessoais(): Promise<{ celula: string; lat: number; lng: number; pessoas: number }[]> {
  const admin = createAdminClient();
  if (!admin) return [];
  const { data, error } = await admin.rpc("destinos_pessoais_agregado", { p_dias: JANELA_AGREGADO_DIAS, p_min: MIN_PESSOAS_AGREGADO });
  if (error) return [];
  return ((data ?? []) as { celula: string; lat: number; lng: number; pessoas: number }[]).map((c) => ({ ...c, lat: Number(c.lat), lng: Number(c.lng) }));
}

/** DESTINO-PESSOAL-B: pedidos "Não achei meu local" em aberto (nome do lugar + cidade). */
async function naoAchadosAbertos(): Promise<{ id: string; nome: string; cidade: string; criado_em: string }[]> {
  const admin = createAdminClient();
  if (!admin) return [];
  const { data } = await admin.from("destinos_nao_achados").select("id, nome, cidade, criado_em").is("resolvido_em", null).order("criado_em", { ascending: false }).limit(100);
  return (data ?? []) as { id: string; nome: string; cidade: string; criado_em: string }[];
}

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
export default async function AdminDestinosPage({ searchParams }: { searchParams: Promise<{ editar?: string; promover?: string }> }) {
  const { editar, promover } = await searchParams;
  // "Promover a âncora": o centro da célula (lat,lng) vai para o cadastro de destinos de sempre.
  const [plat, plng] = String(promover ?? "").split(",").map(Number);
  const pontoPromover = promover && pontoValido({ lat: plat, lng: plng }) ? { lat: plat, lng: plng } : null;
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
  const reportes = await reportesAbertos().catch(() => []);
  const [pontos, naoAchados] = await Promise.all([pontosPessoais().catch(() => []), naoAchadosAbertos().catch(() => [])]);
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
          { rotulo: "Locais pedidos (não achados)", valor: naoAchados.length, href: "#nao-achados" },
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

      <Panel title={emEdicao ? `Editar: ${emEdicao.nome}` : pontoPromover ? "Promover a âncora" : "Cadastrar destino"} className="mb-6" id="form-destino">
        {pontoPromover && !emEdicao && (
          <p className="mb-3 text-sm text-ink" data-testid="promover-aviso">
            O ponto veio de um lugar que muita gente usa como &ldquo;Outro local&rdquo;. Dê o nome, confira no mapa, salve e ative.
          </p>
        )}
        {/* E32: a key remonta o formulário (e o ponto em estado) ao trocar de destino: sem ela, "Editar" abria com latitude e longitude vazias. */}
        <DestinoForm key={emEdicao?.slug ?? (pontoPromover ? `promover-${promover}` : "novo")} inicial={emEdicao} pontoInicial={emEdicao ? null : pontoPromover} />
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
        <p className="mt-2 text-xs text-muted">Só a contagem por destino. Quem busca sem login não deixa endereço guardado.</p>
      </Panel>

      <Panel title={`Lugares que muita gente usa (${JANELA_AGREGADO_DIAS} dias)`} id="pontos-pessoais" className="mt-6">
        {pontos.length === 0 ? (
          <p className="text-sm text-muted" data-testid="pontos-pessoais-vazio">
            Nenhum ponto com {MIN_PESSOAS_AGREGADO} pessoas ou mais nos últimos {JANELA_AGREGADO_DIAS} dias.
          </p>
        ) : (
          <ul className="divide-y divide-sage-200 rounded-xl border border-sage-200" data-testid="pontos-pessoais">
            {pontos.map((c) => (
              <li key={c.celula} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm" data-testid="ponto-pessoal" data-pessoas={c.pessoas}>
                <span className="min-w-0 text-ink">
                  <span className="block font-semibold">{c.pessoas} pessoas</span>
                  <span className="block text-muted">
                    Região de ~300 m em {c.lat.toFixed(4)}, {c.lng.toFixed(4)}
                  </span>
                </span>
                <Link href={`/admin/destinos?promover=${c.lat},${c.lng}#form-destino`} className="text-sm font-semibold text-forest underline" data-testid="promover-ancora">
                  Promover a âncora
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-muted">
          Só o agregado: regiões de ~300 m com {MIN_PESSOAS_AGREGADO} pessoas distintas ou mais. O endereço e o nome que cada pessoa guarda ficam só com ela.
        </p>
      </Panel>

      <Panel title="Locais pedidos: “Não achei meu local”" id="nao-achados" className="mt-6">
        {naoAchados.length === 0 ? (
          <p className="text-sm text-muted">Nenhum pedido em aberto.</p>
        ) : (
          <ul className="divide-y divide-sage-200 rounded-xl border border-sage-200" data-testid="nao-achados">
            {naoAchados.map((n) => (
              <li key={n.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-sm" data-testid="nao-achado">
                <span className="min-w-0">
                  <span className="block font-semibold text-ink">{n.nome}</span>
                  <span className="block text-muted">
                    {n.cidade} · {dataBRT(n.criado_em)}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <Link href="#form-destino" className="text-sm font-semibold text-forest underline">
                    Cadastrar
                  </Link>
                  <ResolverNaoAchado id={n.id} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Lugares por perto marcados como errados" id="proximidades-erradas" className="mt-6">
        {reportes.length === 0 ? (
          <p className="text-sm text-muted">Nenhum aviso em aberto.</p>
        ) : (
          <ul className="divide-y divide-sage-200 rounded-xl border border-sage-200" data-testid="proximidades-reportes">
            {reportes.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-sm" data-testid="proximidade-reporte">
                <span className="min-w-0">
                  <span className="block font-semibold text-ink">{r.nome}</span>
                  <span className="block text-muted">
                    {r.motivo} · {r.properties?.title ?? "Anúncio"}
                    {r.properties?.city ? ` (${r.properties.city})` : ""} · {dataBRT(r.criado_em)}
                  </span>
                </span>
                <ResolverReporte id={r.id} />
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-muted">O dono marca um lugar achado pelo OpenStreetMap como errado. Confira e, se for o caso, corrija no OpenStreetMap.</p>
      </Panel>
    </>
  );
}
