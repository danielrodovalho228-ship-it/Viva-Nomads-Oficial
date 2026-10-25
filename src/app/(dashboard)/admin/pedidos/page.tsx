import { adminListPedidos, getChaveSmsAdmin, getMetricasPedidosAdmin } from "@/lib/data/pedidos-admin";
import { colunasPedidosAdmin } from "@/lib/data/pedidos-admin-colunas";
import { ChaveSmsPainel } from "./chave-sms";
import { adminDaPagina, idsContasTeste, intervaloBRT, pedidosExpirandoSemResposta, pedidosParaMetrica } from "@/lib/data/admin-indicadores";
import { periodoDaLista, recorteDaUrl, respostaPedidos, ROTULO_RECORTE_PEDIDOS, textoComCompativel } from "@/lib/admin/indicadores";
import { rotuloPeriodo, somarDias } from "@/lib/admin/visao-geral";
import { chaveCidade } from "@/lib/cidades";
import { hojeBR } from "@/lib/utils";
import { AdminPedidosClient } from "./admin-pedidos-client";
import { tituloDoAdmin } from "@/config/menu-admin";

/**
 * Admin → Pedidos. Cartões e lista com o MESMO recorte (complemento do P29, item 5b): período (padrão: 30 dias) e
 * Real · Teste · Todos (padrão: Real, contas de teste fora). "Pedidos com resposta" e "Tempo até a 1ª resposta" saem
 * de respostaPedidos(pedidosParaMetrica) — a mesma função da home. Vindo da home: "Pedidos ativos" (status=ativo, agora)
 * e "Pedidos expirando sem resposta" (expirando=1, agora) abrem a lista que cada número contou.
 */
export const metadata = { title: tituloDoAdmin("/admin/pedidos") };

export default async function AdminPedidosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const um = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim().slice(0, 80) : "");
  const hoje = hojeBR();
  const dePeriodo = periodoDaLista({ de: um("de"), ate: um("ate") });
  const p = dePeriodo ?? { inicio: somarDias(hoje, -29), fim: hoje };
  const status = um("status");
  const expirando = um("expirando") === "1";
  const cidade = um("cidade") || null;
  const recorte = recorteDaUrl(um("tipo"));

  const admin = await adminDaPagina();
  const [pedidos, metricas, metrica, teste, idsExpirando, chave] = await Promise.all([
    adminListPedidos(),
    getMetricasPedidosAdmin(),
    admin ? pedidosParaMetrica(admin, intervaloBRT(p.inicio, p.fim), cidade, recorte) : Promise.resolve([]),
    admin ? idsContasTeste(admin) : Promise.resolve(new Set<string>()),
    admin && expirando ? pedidosExpirandoSemResposta(admin) : Promise.resolve([] as string[]),
    getChaveSmsAdmin(),
  ]);
  const resposta = respostaPedidos(metrica);
  const comCompativel = metrica.filter((m) => m.compativeis > 0).length;
  const doPeriodo = new Set(metrica.map((m) => m.id));
  const noRecorte = (inq: unknown) => (recorte === "todos" ? true : recorte === "teste" ? teste.has(String(inq)) : !teste.has(String(inq)));
  const daCidade = (c: unknown) => !cidade || chaveCidade(String(c ?? "")) === chaveCidade(cidade);
  // Lista: "agora" (status ou expirando, vindos da home) ou os pedidos do período — sempre no mesmo recorte dos cartões.
  const agora = expirando || (!!status && !dePeriodo);
  const lista = expirando
    ? pedidos.filter((x) => idsExpirando.includes(String(x.id)))
    : pedidos.filter(
        (x) => noRecorte(x.inquilino_id) && daCidade(x.cidade) && (agora ? true : doPeriodo.has(String(x.id))) && (!status || x.status === status)
      );
  const rotuloFiltro = [
    expirando ? "ativos que vencem em até 3 dias, sem nenhuma resposta (agora)" : agora ? `situação: ${status} (agora)` : `criados ${rotuloPeriodo(p.inicio, p.fim)}`,
    !expirando && status && !agora ? `situação: ${status}` : null,
    cidade,
    expirando ? ROTULO_RECORTE_PEDIDOS.real : ROTULO_RECORTE_PEDIDOS[recorte],
  ]
    .filter(Boolean)
    .join(" · ");
  // Prompt 30, item 7: nome curto, selos e nº de respostas de donos em cada linha.
  const colunas = admin
    ? await colunasPedidosAdmin(admin, lista.map((x) => ({ id: String(x.id), inquilino_id: String(x.inquilino_id) }))).catch(() => new Map())
    : new Map();
  const listaComColunas = lista.map((x) => ({ ...x, colunas: colunas.get(String(x.id)) ?? null }));
  return (
    <>
    {chave && <ChaveSmsPainel ligada={chave.ligada} ligadaEm={chave.ligadaEm} />}
    <AdminPedidosClient
      pedidos={listaComColunas}
      metricas={metricas}
      resposta={{ ...resposta, janela: `${rotuloPeriodo(p.inicio, p.fim)} · ${ROTULO_RECORTE_PEDIDOS[recorte]}`, compativel: textoComCompativel(comCompativel, metrica.length) }}
      rotuloFiltro={rotuloFiltro}
      recorte={recorte}
      filtroUrl={{ de: p.inicio, ate: p.fim, cidade, status: status || null, expirando }}
    />
    </>
  );
}
