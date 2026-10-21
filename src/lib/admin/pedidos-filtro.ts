/** /admin/pedidos (F20): busca e abas por status sobre a lista já carregada — leitura, sem escrita. */
import { PEDIDO_STATUS_LABEL } from "../pedidos/pedidos.ts";

export type PedidoFiltravel = {
  id: string;
  status: string;
  cidade: string;
  motivo: string;
  bairros: string[] | null;
  colunas: { nome?: string | null } | null;
};

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function filtrarPedidosAdmin<T extends PedidoFiltravel>(lista: T[], f: { q: string; aba: string }): T[] {
  const q = semAcento(f.q.trim().slice(0, 60));
  return lista.filter((x) => {
    if (f.aba !== "todos" && x.status !== f.aba) return false;
    if (!q) return true;
    return semAcento([x.colunas?.nome ?? "", x.cidade, ...(x.bairros ?? [])].join(" ")).includes(q);
  });
}

export function abasPedidos(lista: PedidoFiltravel[]): { valor: string; rotulo: string; total: number }[] {
  const por = new Map<string, number>();
  for (const x of lista) por.set(x.status, (por.get(x.status) ?? 0) + 1);
  return [
    { valor: "todos", rotulo: "Todos", total: lista.length },
    ...[...por].map(([valor, total]) => ({ valor, rotulo: PEDIDO_STATUS_LABEL[valor] ?? valor, total })),
  ];
}
