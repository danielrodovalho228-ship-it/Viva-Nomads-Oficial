import { adminListPedidos, getMetricasPedidosAdmin } from "@/lib/data/pedidos-admin";
import { adminDaPagina, idsContasTeste, intervaloBRT, pedidosParaMetrica } from "@/lib/data/admin-indicadores";
import { periodoDaLista, respostaPedidos } from "@/lib/admin/indicadores";
import { rotuloPeriodo, somarDias } from "@/lib/admin/visao-geral";
import { chaveCidade } from "@/lib/cidades";
import { hojeBR } from "@/lib/utils";
import { AdminPedidosClient } from "./admin-pedidos-client";

/**
 * Admin → Pedidos. "Pedidos com resposta" e "Tempo até a 1ª resposta" saem de respostaPedidos(pedidosParaMetrica) —
 * a MESMA função da home (Prompt 29, item 8). Vindo de um cartão da home (de/até, situação, cidade), a lista mostra
 * exatamente o que o número contou: só contas reais, com o mesmo filtro.
 */
export default async function AdminPedidosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const um = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim().slice(0, 80) : "");
  const hoje = hojeBR();
  const dePeriodo = periodoDaLista({ de: um("de"), ate: um("ate") });
  const p = dePeriodo ?? { inicio: somarDias(hoje, -29), fim: hoje };
  const status = um("status");
  const cidade = um("cidade") || null;
  const filtrado = !!dePeriodo || !!status || !!cidade;

  const admin = await adminDaPagina();
  const [pedidos, metricas, metrica, teste] = await Promise.all([
    adminListPedidos(),
    getMetricasPedidosAdmin(),
    admin ? pedidosParaMetrica(admin, intervaloBRT(p.inicio, p.fim), cidade) : Promise.resolve([]),
    admin && filtrado ? idsContasTeste(admin) : Promise.resolve(new Set<string>()),
  ]);
  const resposta = respostaPedidos(metrica);
  const doPeriodo = new Set(metrica.map((m) => m.id));
  const lista = filtrado
    ? pedidos.filter(
        (x) =>
          !teste.has(String(x.inquilino_id)) &&
          (!dePeriodo || doPeriodo.has(String(x.id))) &&
          (!status || x.status === status) &&
          (!cidade || chaveCidade(String(x.cidade ?? "")) === chaveCidade(cidade))
      )
    : pedidos;
  const rotuloFiltro = filtrado
    ? [dePeriodo ? `criados ${rotuloPeriodo(p.inicio, p.fim)}` : null, status ? `situação: ${status}` : null, cidade, "só contas reais"].filter(Boolean).join(" · ")
    : null;
  return (
    <AdminPedidosClient
      pedidos={lista}
      metricas={metricas}
      resposta={{ ...resposta, janela: rotuloPeriodo(p.inicio, p.fim) }}
      rotuloFiltro={rotuloFiltro}
    />
  );
}
