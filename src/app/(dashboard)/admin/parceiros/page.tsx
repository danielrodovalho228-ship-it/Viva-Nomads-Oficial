import Link from "next/link";
import { SeloTeste } from "@/components/admin/selo-teste";
import { Handshake } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { nomeCurto } from "@/lib/perfil/perfil-publico";
import { dataBRT, dataHoraBRT } from "@/lib/datas-brasilia";
import { PageTitle, Panel, EmptyState, FilaVazia } from "@/components/dashboard/primitives";
import { ListaNumeros, NumeroHeroi } from "@/components/admin/numeros";
import { buttonClasses, ButtonLink } from "@/components/ui/button";
import { estadosIdentidade } from "@/lib/identidade/estado-servidor";
import { PAGAMENTO_PARCEIROS_ATIVO } from "@/lib/flags";
import { textoTaxaServicoParceiros } from "@/config/taxa-servico-parceiros";
import { lerParceiroGeral, rotuloCategoria } from "@/lib/parceiros/regras";
import { FORMULAS_CARTAO_PARCEIRO, numerosCartaoParceiro } from "@/lib/cartoes/compartilhar";
import { FichaSolicitacao, LinhaAprovada, LinhaAtiva, SuporteForm, type Ficha } from "./fichas";
import { HREF_SISTEMA } from "@/config/chaves-ambiente";
import { rotuloDoAdmin, tituloDoAdmin } from "@/config/menu-admin";
import { TIPOS_PARCEIRO, contarPorTipo, doTipo, hrefParceiros, tipoDoParam } from "@/lib/admin/parceiros-tipo";
import { diasNaFila, ordenarPendentes } from "@/lib/parceiros/fila-pendentes";

export const metadata = { title: tituloDoAdmin("/admin/parceiros") };

const ABAS = [
  { valor: "pendentes", rotulo: "Pendentes" },
  { valor: "aprovadas", rotulo: "Aprovadas" },
  { valor: "ativas", rotulo: "Ativas" },
  { valor: "recusadas", rotulo: "Recusadas" },
] as const;
type Aba = (typeof ABAS)[number]["valor"];

const ROTULO_PAPEL: Record<string, string> = { owner: "Proprietário", tenant: "Inquilino", admin: "Admin" };

/**
 * Admin → Parceiros (Prompt 31a, item 3): pedidos de parceria em abas (Pendentes · Aprovadas · Ativas · Recusadas),
 * ficha com checklist, aprovar (link de ativação por e-mail), recusar (motivo obrigatório), reenviar ativação e
 * suspender. Tudo grava pelo servidor com admin + 2FA e entra no registro de moderação. O layout de /admin exige admin.
 * ADMIN-2: os Fotógrafos moram aqui, na aba de tipo "Todos | Fotógrafos | Outros" (?tipo=); /admin/fotografos redireciona.
 */
export default async function AdminParceirosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const aba = (ABAS.some((a) => a.valor === sp.aba) ? sp.aba : "pendentes") as Aba;
  const tipo = tipoDoParam(sp.tipo);
  const admin = createAdminClient();
  if (!admin) {
    return (
      <>
        <PageTitle title={rotuloDoAdmin("/admin/parceiros")} subtitle="Rede de parceiros da Viva." />
        <EmptyState icon={Handshake} title="Modo demonstração" text="Sem conexão com o banco: nenhum dado real para mostrar." action={<ButtonLink href="/admin" variant="secondary" size="sm">Voltar ao painel</ButtonLink>} />
      </>
    );
  }

  const COLS = "id, user_id, email, nome, tipo_pessoa, documento, telefone, categorias, cidades, portfolio_url, descricao, dados_categoria, status, motivo_recusa, checklist, origem, token_expira_em, novo_link_pedido_em, decidido_em, criado_em";
  const statusDaAba: Record<Aba, string[]> = { pendentes: ["pendente", "aguardando_email"], aprovadas: ["aprovada"], ativas: ["ativada"], recusadas: ["recusada"] };
  const [sols, contagem, parceiros, geralLinha, avisos] = await Promise.all([
    aba === "ativas" ? Promise.resolve({ data: [] as Record<string, unknown>[] }) : admin.from("parceiro_solicitacoes").select(COLS).in("status", statusDaAba[aba]).not("categorias", "cs", "{vistoria}").order("criado_em", { ascending: aba === "pendentes" }).limit(500),
    // Correção 62-B3: o pedido do avaliador credenciado é decidido em /admin/avaliadores (sem duplicidade aqui).
    admin.from("parceiro_solicitacoes").select("status, categorias").not("categorias", "cs", "{vistoria}"),
    aba === "ativas" ? admin.from("parceiros").select("id, user_id, slug, nome_publico, categorias, cidades, status, publicado_em").order("criado_em", { ascending: false }).limit(300) : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    admin.from("chaves_plataforma").select("ligada, valor").eq("chave", "PARCEIRO_GERAL_FALLBACK").maybeSingle(),
    admin.from("interesse_fotografo_cidade").select("user_id, uf, chave, cidade, categoria, criado_em").is("avisado_em", null).order("criado_em", { ascending: false }).limit(2000),
  ]);
  // Fila vazia (Prompt 48): "Nada pendente" com a data da última decisão sobre um pedido de parceria.
  const ultimaDecisaoParceria =
    aba === "pendentes"
      ? (((await admin.from("parceiro_solicitacoes").select("decidido_em").not("decidido_em", "is", null).order("decidido_em", { ascending: false }).limit(1)).data?.[0]?.decidido_em as string | null | undefined) ?? null)
      : null;
  const conta = (s: string[]) => (contagem.data ?? []).filter((r) => s.includes(r.status as string) && doTipo(tipo, r.categorias as string[] | null)).length;

  // Cartão do parceiro (31c): cartões gerados e pedidos vindos de cartão; contas de teste fora dos totais.
  const [cartoesP, pedidosP, donosP, testesP] = await Promise.all([
    admin.from("cartoes_compartilhaveis").select("parceiro_id, usuario_id").eq("tipo", "partnercard").limit(5000),
    admin.from("parceiro_pedidos").select("parceiro_id, cliente_id").eq("ref_tipo", "partnercard").limit(10000),
    admin.from("parceiros").select("id, user_id").limit(5000),
    admin.from("profiles").select("id").eq("is_teste", true).limit(5000),
  ]);
  const numCartao = numerosCartaoParceiro({
    cartoes: (cartoesP.data ?? []) as { parceiro_id: string | null; usuario_id: string }[],
    pedidos: (pedidosP.data ?? []) as { parceiro_id: string; cliente_id: string }[],
    donoDoParceiro: new Map(((donosP.data ?? []) as { id: string; user_id: string }[]).map((p) => [p.id, p.user_id])),
    contasTeste: new Set(((testesP.data ?? []) as { id: string }[]).map((p) => p.id)),
  });
  // ADMIN-2: um contador só, da mesma consulta (Todos = Fotógrafos + Outros).
  const { data: todosParceiros } = await admin.from("parceiros").select("id, categorias").limit(5000);
  const porTipo = contarPorTipo((todosParceiros ?? []) as { categorias: string[] | null }[]);
  const ativos = porTipo[tipo];

  const filtrada = ((sols.data ?? []) as Record<string, unknown>[]).filter((s) => doTipo(tipo, s.categorias as string[] | null));
  // E227-B: "Pendentes" do mais antigo para o mais novo (a fila única de parceria).
  const lista = aba === "pendentes" ? ordenarPendentes(filtrada as (Record<string, unknown> & { id: string; criado_em: string })[]) : filtrada;
  const ativosDoTipo = ((parceiros.data ?? []) as Record<string, unknown>[]).filter((p) => doTipo(tipo, p.categorias as string[] | null));
  const ids = [...new Set([...lista.map((s) => s.user_id as string | null), ...((parceiros.data ?? []) as Record<string, unknown>[]).map((p) => p.user_id as string)].filter((x): x is string => !!x))];
  const avisosLinhas = (avisos.data ?? []) as { user_id: string; uf: string; chave: string; cidade: string; categoria: string; criado_em: string }[];
  const todosIds = [...new Set([...ids, ...avisosLinhas.map((a) => a.user_id)])];
  const [identidades, { data: perfis }] = await Promise.all([
    estadosIdentidade(admin, ids),
    todosIds.length ? admin.from("profiles").select("id, full_name, role, is_teste").in("id", todosIds) : Promise.resolve({ data: [] }),
  ]);
  const perfil = new Map(((perfis ?? []) as { id: string; full_name: string | null; role: string | null; is_teste: boolean | null }[]).map((p) => [p.id, p]));

  const agora = new Date().getTime();
  const fichas: Ficha[] = lista.map((s) => {
    const uid = (s.user_id as string | null) ?? null;
    const id = uid ? identidades.get(uid) : null;
    return {
      id: s.id as string,
      nome: s.nome as string,
      email: (s.email as string | null) ?? null,
      tipoPessoa: (s.tipo_pessoa as string | null) ?? null,
      documento: (s.documento as string | null) ?? null,
      telefone: (s.telefone as string | null) ?? null,
      categorias: (s.categorias as string[]) ?? [],
      cidades: (s.cidades as string[]) ?? [],
      portfolioUrl: (s.portfolio_url as string | null) ?? null,
      descricao: (s.descricao as string | null) ?? null,
      dadosCategoria: (s.dados_categoria as Record<string, string>) ?? {},
      status: s.status as string,
      motivoRecusa: (s.motivo_recusa as string | null) ?? null,
      checklist: (s.checklist as Record<string, unknown>) ?? {},
      origem: s.origem as string,
      criadoEm: s.criado_em as string,
      tokenExpiraEm: (s.token_expira_em as string | null) ?? null,
      novoLinkPedidoEm: (s.novo_link_pedido_em as string | null) ?? null,
      linkVencido: !s.token_expira_em || Date.parse(s.token_expira_em as string) <= agora,
      identidade: id ? { estado: id.estado, texto: id.texto } : null,
      teste: uid ? perfil.get(uid)?.is_teste === true : false,
      diasNaFila: diasNaFila(s.criado_em as string, new Date(agora)),
    };
  });
  const geral = lerParceiroGeral(geralLinha.data?.valor, geralLinha.data?.ligada === true);

  const avisosPorCidade = Object.values(
    avisosLinhas.reduce<Record<string, { cidade: string; uf: string; categoria: string; total: number }>>((acc, a) => {
      const k = `${a.uf}|${a.chave}|${a.categoria}`;
      acc[k] = { cidade: a.cidade, uf: a.uf, categoria: a.categoria, total: (acc[k]?.total ?? 0) + 1 };
      return acc;
    }, {}),
  ).sort((a, b) => b.total - a.total);

  return (
    <>
      <PageTitle
        title={rotuloDoAdmin("/admin/parceiros")}
        subtitle="Pedidos de parceria, páginas ativas e avisos por cidade."
        action={
          <span className="flex flex-wrap gap-2">
            <Link href="/admin/parceiros/pedidos" className={buttonClasses({ variant: "secondary", size: "sm" })} data-testid="admin-parceiros-pedidos-link">
              Pedidos de serviço
            </Link>
          </span>
        }
      />

      <nav aria-label="Tipo de parceiro" className="mb-4 flex flex-wrap gap-2" data-testid="admin-parceiros-tipos">
        {TIPOS_PARCEIRO.map((t) => (
          <Link
            key={t.valor}
            href={hrefParceiros({ aba, tipo: t.valor })}
            aria-current={tipo === t.valor ? "page" : undefined}
            className={`inline-flex h-11 items-center gap-1 rounded-full border px-4 text-sm font-semibold ${tipo === t.valor ? "border-ink bg-white text-forest" : "border-line bg-white text-ink"}`}
            data-testid={`admin-parceiros-tipo-${t.valor}`}
            data-n={porTipo[t.valor]}
          >
            {t.rotulo} <span className="tabular-nums text-muted">· {porTipo[t.valor]}</span>
          </Link>
        ))}
      </nav>

      <NumeroHeroi rotulo={tipo === "fotografo" ? "Pedidos de fotógrafo pendentes" : "Pedidos de parceria pendentes"} valor={conta(["pendente", "aguardando_email"])} href={hrefParceiros({ aba: "pendentes", tipo })} />
      <ListaNumeros
        className="mb-6"
        itens={[
          { rotulo: "Aprovadas (sem ativar)", valor: conta(["aprovada"]), href: hrefParceiros({ aba: "aprovadas", tipo }) },
          { rotulo: tipo === "fotografo" ? "Fotógrafos ativos" : "Parceiros ativos", valor: ativos, href: hrefParceiros({ aba: "ativas", tipo }) },
          { rotulo: "Recusadas", valor: conta(["recusada"]), href: hrefParceiros({ aba: "recusadas", tipo }) },
        ]}
      />

      <Panel title="Cartão do parceiro" className="mb-6">
        <dl className="grid grid-cols-2 gap-3 text-sm" data-testid="admin-cartao-parceiro">
          <div className="rounded-lg bg-surface-2 px-3 py-2">
            <dt className="text-muted">Cartões gerados</dt>
            <dd className="font-title text-2xl font-semibold text-ink" data-testid="admin-cartoes-gerados">
              {numCartao.total.gerados}
            </dd>
          </div>
          <div className="rounded-lg bg-surface-2 px-3 py-2">
            <dt className="text-muted">Pedidos vindos de cartão</dt>
            <dd className="font-title text-2xl font-semibold text-ink" data-testid="admin-pedidos-cartao">
              {numCartao.total.pedidos}
            </dd>
          </div>
        </dl>
        <ul className="mt-3 space-y-1 text-xs text-muted" data-testid="admin-cartao-formula">
          <li>{FORMULAS_CARTAO_PARCEIRO.gerados}</li>
          <li>{FORMULAS_CARTAO_PARCEIRO.pedidos}</li>
          <li>{FORMULAS_CARTAO_PARCEIRO.teste} Por parceiro (aba Ativas), os números aparecem na linha de cada um.</li>
        </ul>
      </Panel>

      <nav aria-label="Situação dos pedidos" className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="admin-parceiros-abas">
        {ABAS.map((a) => (
          <Link
            key={a.valor}
            href={hrefParceiros({ aba: a.valor, tipo })}
            aria-current={aba === a.valor ? "page" : undefined}
            className={`flex h-11 items-center justify-center rounded-lg border text-sm font-semibold ${aba === a.valor ? "border-ink bg-white text-forest" : "border-line bg-white text-ink"}`}
            data-testid={`admin-parceiros-aba-${a.valor}`}
          >
            {a.rotulo}
          </Link>
        ))}
      </nav>

      <div className="space-y-4" data-testid={`admin-parceiros-lista-${aba}`}>
        {aba === "ativas" ? (
          ativosDoTipo.length === 0 ? (
            <EmptyState icon={Handshake} title="Nenhum parceiro ativo ainda" text="Quem tem a parceria aprovada e ativa a página aparece aqui." action={<ButtonLink href="/admin/parceiros?aba=pendentes" variant="secondary" size="sm">Ver pedidos de parceria</ButtonLink>} />
          ) : (
            <Panel>
              <ul className="divide-y divide-line">
                {ativosDoTipo.map((p) => (
                  <LinhaAtiva
                    key={p.id as string}
                    p={{
                      id: p.id as string,
                      slug: p.slug as string,
                      nome: p.nome_publico as string,
                      categorias: ((p.categorias as string[]) ?? []).map(rotuloCategoria),
                      cidades: (p.cidades as string[]) ?? [],
                      status: p.status as string,
                      teste: perfil.get(p.user_id as string)?.is_teste === true,
                      identidade: identidades.get(p.user_id as string)?.texto ?? null,
                      cartao: numCartao.porParceiro.get(p.id as string) ?? { gerados: 0, pedidos: 0 },
                    }}
                  />
                ))}
              </ul>
            </Panel>
          )
        ) : fichas.length === 0 && aba === "pendentes" ? (
          <FilaVazia ultimaDecisao={ultimaDecisaoParceria} />
        ) : fichas.length === 0 ? (
          <EmptyState icon={Handshake} title="Nada por aqui" text="Nenhum pedido nesta situação." action={<ButtonLink href="/admin/parceiros?aba=pendentes" variant="secondary" size="sm">Ver os pendentes</ButtonLink>} />
        ) : aba === "aprovadas" ? (
          <Panel>
            <ul className="divide-y divide-line">
              {fichas.map((f) => (
                <LinhaAprovada key={f.id} f={f} />
              ))}
            </ul>
          </Panel>
        ) : (
          fichas.map((f) => <FichaSolicitacao key={f.id} f={f} />)
        )}
      </div>

      <Panel title="Abrir pedido por alguém (suporte)" className="mt-6">
        <SuporteForm />
      </Panel>

      <Panel title="Taxa de serviço dos parceiros" className="mt-4">
        <p className="text-sm text-muted" data-testid="texto-taxa-parceria">{textoTaxaServicoParceiros(PAGAMENTO_PARCEIROS_ATIVO)}</p>
      </Panel>

      {/* ADMIN-3: as chaves moram em Sistema; aqui, só o estado em uma linha. */}
      <p className="mt-4 text-sm text-muted" data-testid="aviso-chaves-parceiros">
        Pagamento de parceiros pela plataforma {PAGAMENTO_PARCEIROS_ATIVO ? "ligado" : "desligado"} · cartão do parceiro geral {geral.ligado ? "ligado" : "desligado"} ·{" "}
        <Link href={`${HREF_SISTEMA}#chaves`} className="font-semibold text-forest underline">
          alterar em Sistema
        </Link>
      </p>

      <Panel title="Pedidos de aviso por cidade" className="mt-4">
        {avisosPorCidade.length === 0 ? (
          <p className="text-sm text-muted">Ninguém pediu aviso ainda.</p>
        ) : (
          <>
            <ul className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2" data-testid="avisos-fotografo-cidade">
              {avisosPorCidade.map((a) => (
                <li key={`${a.uf}-${a.cidade}-${a.categoria}`} className="flex justify-between rounded-lg bg-surface-2 px-3 py-2">
                  <span>
                    {a.cidade}/{a.uf} · {rotuloCategoria(a.categoria)}
                  </span>
                  <strong>{a.total}</strong>
                </li>
              ))}
            </ul>
            <ul className="mt-4 divide-y divide-line text-sm" data-testid="avisos-fotografo-lista">
              {avisosLinhas.map((a) => {
                const q = perfil.get(a.user_id);
                return (
                  <li key={`${a.user_id}-${a.uf}-${a.chave}-${a.categoria}`} className="flex flex-wrap items-center justify-between gap-2 py-2" data-testid="aviso-fotografo-linha">
                    <span className="min-w-0">
                      <span className="font-semibold text-ink">
                        {a.cidade}/{a.uf}
                      </span>
                      <span className="text-muted">
                        {" "}
                        · {rotuloCategoria(a.categoria)} · {ROTULO_PAPEL[q?.role ?? ""] ?? "—"} · {nomeCurto(q?.full_name ?? null) ?? "Conta removida"}
                      </span>
                      {q?.is_teste && <SeloTeste />}
                    </span>
                    <span className="text-xs text-muted">{dataHoraBRT(a.criado_em, { tabela: true })}</span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Panel>
      <p className="mt-4 text-xs text-muted">Atualizado em {dataBRT(new Date().toISOString())}.</p>
    </>
  );
}
