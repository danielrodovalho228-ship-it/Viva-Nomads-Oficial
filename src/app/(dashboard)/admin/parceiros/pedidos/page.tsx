import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { ListaNumeros, NumeroHeroi } from "@/components/admin/numeros";
import { SeloTeste } from "@/components/admin/selo-teste";
import { idsContasTeste } from "@/lib/data/admin-indicadores";
import { dataHoraBRT } from "@/lib/datas-brasilia";
import { rotuloCategoria } from "@/lib/parceiros/regras";
import { contarPorGatilho, ROTULO_GATILHO, type Gatilho } from "@/lib/automacao/pedidos-do-evento";
import { RodarAutomacao } from "@/components/automacao/rodar-automacao";
import { FORMULAS_PEDIDOS_PARCEIRO, STATUS_ABERTOS, numerosPedidosParceiro, rotuloStatus, type PedidoParaNumeros } from "@/lib/parceiros/pedido";

export const metadata = { title: "Pedidos de parceiros — Admin" };
export const dynamic = "force-dynamic";

/** Filtros da lista (Prompt 46: todo número abre a lista que conta). Os mesmos grupos de numerosPedidosParceiro. */
const FILTROS = {
  reais: { titulo: "Pedidos (sem contas de teste)", passa: () => true },
  solicitado: { titulo: "Aguardando orçamento", passa: (s: string) => s === "solicitado" },
  abertos: { titulo: "Pedidos abertos", passa: (s: string) => (STATUS_ABERTOS as readonly string[]).includes(s) },
  fechados: { titulo: "Pedidos fechados", passa: (s: string) => ["aceito", "agendado", "em_execucao", "entregue", "concluido"].includes(s) },
  concluido: { titulo: "Pedidos concluídos", passa: (s: string) => s === "concluido" },
  cartao: { titulo: "Pedidos vindos de cartão", passa: () => true },
} as const;
type Filtro = keyof typeof FILTROS;

const brl = (n: number | string | null) => (n == null ? "—" : Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));

/**
 * Admin → Parceiros → Pedidos (Prompt 31b, item 9): lista com estado, valores, taxa, origem e ref do cartão, e os
 * números com a fórmula escrita (contas de teste fora). O layout de /admin exige admin.
 */
export default async function AdminPedidosParceirosPage({ searchParams }: { searchParams: Promise<{ origem?: string; filtro?: string }> }) {
  const sp = await searchParams;
  const soAutomaticos = sp.origem === "automatico";
  const filtro = (sp.filtro && sp.filtro in FILTROS ? sp.filtro : null) as Filtro | null;
  const admin = createAdminClient();
  if (!admin) return <EmptyState icon={ClipboardList} title="Modo demonstração" text="Sem conexão com o banco: nenhum dado real para mostrar." />;
  const [{ data }, testes, { data: parcs }] = await Promise.all([
    admin
      .from("parceiro_pedidos")
      .select("id, codigo, status, categoria, cliente_id, parceiro_id, valor_combinado, valor_taxa, valor_parceiro, pagamento_status, origem, gatilho, ref_tipo, ref_codigo, criado_em")
      .order("criado_em", { ascending: false })
      .limit(1000),
    idsContasTeste(admin),
    admin.from("parceiros").select("id, user_id, nome_publico").limit(5000),
  ]);
  const pedidos = (data ?? []) as (PedidoParaNumeros & { id: string; codigo: string; categoria: string; valor_combinado: number | string | null; valor_parceiro: number | string | null; origem: string; gatilho: Gatilho | null; ref_codigo: string | null; criado_em: string })[];
  const parceiros = (parcs ?? []) as { id: string; user_id: string; nome_publico: string }[];
  const dono = new Map(parceiros.map((p) => [p.id, p.user_id]));
  const nome = new Map(parceiros.map((p) => [p.id, p.nome_publico]));
  const n = numerosPedidosParceiro(pedidos, testes, dono);
  const ehTeste = (p: { cliente_id: string; parceiro_id: string }) => testes.has(p.cliente_id) || testes.has(dono.get(p.parceiro_id) ?? "");
  // Prompt 38: pedidos gerados pela regra do imóvel, por gatilho (contas de teste fora).
  const porGatilho = contarPorGatilho(pedidos.map((p) => ({ origem: p.origem, gatilho: p.gatilho, teste: ehTeste(p) })));
  // Com filtro, a lista é a mesma conta do número (contas de teste fora); sem filtro, todos (teste com selo).
  const lista = filtro
    ? pedidos.filter((p) => !ehTeste(p) && FILTROS[filtro].passa(p.status) && (filtro !== "cartao" || p.ref_tipo === "partnercard"))
    : soAutomaticos
      ? pedidos.filter((p) => p.origem === "automatico")
      : pedidos;
  const aqui = (f: Filtro) => `/admin/parceiros/pedidos?filtro=${f}#lista`;

  return (
    <>
      <PageTitle title="Pedidos de parceiros" subtitle="Orçamentos, aceites e entregas. A Viva só conecta: nenhum dinheiro passa por aqui." />
      <p className="mb-4 text-sm">
        <Link href="/admin/parceiros" className="text-forest underline underline-offset-2">
          Voltar para Parceiros
        </Link>
      </p>
      <NumeroHeroi rotulo="Pedidos abertos" valor={n.abertos} href={aqui("abertos")} nota={FORMULAS_PEDIDOS_PARCEIRO.abertos} />
      <ListaNumeros
        testId="admin-pedidos-numeros"
        itens={[
          { rotulo: "Pedidos", valor: n.total, href: aqui("reais"), nota: FORMULAS_PEDIDOS_PARCEIRO.total },
          { rotulo: "Fechados", valor: `${n.fechados} (${n.conversao}%)`, href: aqui("fechados"), nota: `${FORMULAS_PEDIDOS_PARCEIRO.fechados} ${FORMULAS_PEDIDOS_PARCEIRO.conversao}` },
          { rotulo: "Concluídos", valor: n.concluidos, href: aqui("concluido"), nota: FORMULAS_PEDIDOS_PARCEIRO.concluidos },
          { rotulo: "Taxa registrada", valor: brl(n.taxaRegistrada), href: aqui("fechados"), nota: FORMULAS_PEDIDOS_PARCEIRO.taxaRegistrada },
          {
            rotulo: "Pedidos vindos de cartão",
            valor: n.vindosDeCartao,
            href: aqui("cartao"),
            nota: FORMULAS_PEDIDOS_PARCEIRO.vindosDeCartao,
            atributos: { "data-testid": "admin-pedidos-de-cartao", "data-valor": n.vindosDeCartao },
          },
        ]}
      />
      <Panel title="Gerados automaticamente" className="mt-6" data-testid="admin-pedidos-automaticos">
        <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
          {(Object.keys(ROTULO_GATILHO) as Gatilho[]).map((g) => (
            <div key={g} className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2" data-testid={`admin-gatilho-${g}`} data-valor={porGatilho[g]}>
              <dt className="text-muted">{ROTULO_GATILHO[g]}</dt>
              <dd className="font-semibold text-ink">{porGatilho[g]}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-muted">Pedidos com origem automática, por gatilho, sem contas de teste.</p>
        <div className="mt-3">
          <RodarAutomacao />
        </div>
      </Panel>
      <Panel title={filtro ? FILTROS[filtro].titulo : soAutomaticos ? "Pedidos gerados automaticamente" : "Todos os pedidos"} className="mt-6 scroll-mt-24" id="lista">
        <p className="mb-2 text-sm">
          {filtro || soAutomaticos ? (
            <Link href="/admin/parceiros/pedidos" className="text-forest underline underline-offset-2" data-testid="admin-filtro-todos">
              Ver todos
            </Link>
          ) : (
            <Link href="/admin/parceiros/pedidos?origem=automatico" className="text-forest underline underline-offset-2" data-testid="admin-filtro-automaticos">
              Só os gerados automaticamente
            </Link>
          )}
        </p>
        {lista.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Nenhum pedido ainda" text="Os pedidos de orçamento aparecem aqui assim que alguém pedir." />
        ) : (
          <ul className="divide-y divide-line" data-testid="admin-pedidos-lista">
            {lista.map((p) => (
              <li key={p.id}>
                <Link href={`/admin/parceiros/pedidos/${p.id}`} className="flex min-h-11 flex-wrap items-center justify-between gap-2 py-3 text-sm" data-testid="admin-pedido">
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink">
                      {p.codigo} · {rotuloCategoria(p.categoria)} · {nome.get(p.parceiro_id) ?? "Parceiro"} {ehTeste(p) && <SeloTeste />}
                    </span>
                    <span className="block text-xs text-muted">
                      {dataHoraBRT(p.criado_em)} · origem {p.origem}
                      {p.gatilho ? ` · ${ROTULO_GATILHO[p.gatilho]}` : ""}
                      {p.ref_tipo ? ` · cartão ${p.ref_codigo}` : ""} · pagamento {p.pagamento_status}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block font-semibold text-ink">{rotuloStatus(p.status)}</span>
                    <span className="block text-xs text-muted">
                      {brl(p.valor_combinado)} · taxa {brl(p.valor_taxa)} · parceiro {brl(p.valor_parceiro)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
