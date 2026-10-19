import Link from "next/link";
import type { PedidoServicoView } from "@/lib/data/servicos-morador-actions";
import { FAIXAS_HORARIO, codigoDoPedido, rotuloEstado } from "@/lib/servicos-morador";

const dataBR = (iso: string) => iso.split("-").reverse().join("/");

/** S3: lista de pedidos com o estado e "Algo deu errado? Fale com a Viva" (abre o atendimento com o código). */
export function PedidosServico({ pedidos }: { pedidos: PedidoServicoView[] }) {
  if (pedidos.length === 0) return <p className="text-sm text-muted">Você ainda não fez nenhum pedido de serviço.</p>;
  return (
    <ul className="grid gap-3" data-testid="servicos-pedidos-lista">
      {pedidos.map((p) => {
        const codigo = codigoDoPedido(p.id);
        return (
          <li key={p.id} className="rounded-xl border border-sage-200 p-3" data-testid="servico-pedido">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-ink">{p.servico}</p>
              <span className="rounded-full bg-sage-100 px-3 py-1 text-xs font-semibold text-forest" data-testid="servico-pedido-estado">
                {rotuloEstado(p.status)}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted">
              {dataBR(p.dataDesejada)} · {FAIXAS_HORARIO.find((f) => f.id === p.faixa)?.rotulo ?? p.faixa} · {p.prestador}
            </p>
            <p className="mt-1 text-xs text-muted">Código do pedido: {codigo}</p>
            <Link
              href={`/ajuda?novo=1&servico=${codigo}`}
              className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-forest underline-offset-2 hover:underline"
              data-testid="servico-fale-com-viva"
            >
              Algo deu errado? Fale com a Viva
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
