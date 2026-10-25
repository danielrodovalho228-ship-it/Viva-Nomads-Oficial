import Link from "next/link";
import { Panel } from "@/components/dashboard/primitives";
import { ButtonLink } from "@/components/ui/button";
import { rotuloStatus } from "@/lib/parceiros/pedido";
import { rotuloCategoria } from "@/lib/parceiros/regras";
import { ROTULO_GATILHO } from "@/lib/automacao/pedidos-do-evento";
import type { DepoisDaSaida, SugestaoMorador } from "@/lib/automacao/estadia";
import { BotaoPedidoAutomatico } from "./botao-pedido-automatico";

/** Dono (Prompt 38): o que a Viva pediu, ou vai pedir, para depois da saída do morador. */
export function CartaoDepoisDaSaida({ dados, propertyId }: { dados: DepoisDaSaida; propertyId: string }) {
  const limpeza = dados.fixos.find((f) => f.categoria === "limpeza");
  return (
    <Panel title="Depois da saída" data-testid="estadia-depois-da-saida">
      {dados.pedidos.length > 0 ? (
        <ul className="divide-y divide-line">
          {dados.pedidos.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3" data-testid="depois-da-saida-pedido" data-status={p.status}>
              <span className="min-w-0 text-sm">
                <span className="block font-semibold text-ink">
                  {ROTULO_GATILHO[p.gatilho]} · {p.parceiro}
                </span>
                <span className="block text-muted">{p.aguardandoDono ? "Espera a sua confirmação" : p.semResposta ? "Sem resposta do parceiro em 24 horas" : rotuloStatus(p.status)}</span>
              </span>
              <span className="flex flex-wrap items-center gap-2">
                {p.aguardandoDono && <BotaoPedidoAutomatico pedidoId={p.id} acao="confirmar" />}
                {p.semResposta && <BotaoPedidoAutomatico pedidoId={p.id} acao="trocar" />}
                <Link href={`/dashboard/servicos/pedidos/${p.id}`} className="text-sm text-ink underline underline-offset-4">
                  Ver pedido
                </Link>
              </span>
            </li>
          ))}
        </ul>
      ) : limpeza ? (
        <p className="text-sm text-ink" data-testid="depois-da-saida-fixo">
          {rotuloCategoria("limpeza")} com {limpeza.parceiro}: {limpeza.status === "ativo" ? "o pedido sai 5 dias antes da saída." : "aguardando o parceiro aceitar o convite."}
        </p>
      ) : (
        <p className="text-sm text-muted" data-testid="depois-da-saida-vazio">
          Sem limpeza fixa no imóvel. Escolha um parceiro e a Viva pede a limpeza 5 dias antes de cada saída.
        </p>
      )}
      <div className="mt-3">
        <ButtonLink href={`/dashboard/imoveis/${propertyId}/parceiros`} variant="secondary" size="sm" data-testid="depois-da-saida-parceiros">
          Parceiros do imóvel
        </ButtonLink>
      </div>
    </Panel>
  );
}

/** Morador (Prompt 38): sugestão, nunca pedido em nome dele. Só nos 7 dias antes da entrada e da saída. */
export function CartaoAjudaMudanca({ dados }: { dados: SugestaoMorador }) {
  return (
    <Panel title="Precisa de ajuda com a mudança?" id="ajuda-mudanca" className="scroll-mt-24" data-testid="estadia-ajuda-mudanca" data-momento={dados.momento}>
      <p className="text-sm text-muted">
        {dados.momento === "entrada" ? "Parceiros da cidade para a mudança e a limpeza de chegada." : "Parceiros da cidade para a mudança de saída."} Peça um orçamento se quiser: nada é contratado sem você.
      </p>
      {dados.parceiros.length > 0 ? (
        <ul className="mt-3 divide-y divide-line">
          {dados.parceiros.map((p) => (
            <li key={`${p.categoria}-${p.slug}`} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span className="text-ink">
                {p.nome} <span className="text-muted">· {rotuloCategoria(p.categoria)}</span>
              </span>
              <Link href={`/parceiros/${p.slug}`} className="text-ink underline underline-offset-4" data-testid="ajuda-mudanca-parceiro">
                Ver e pedir orçamento
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-ink">
          <Link href="/parceiros/buscar?categoria=mudanca" className="underline underline-offset-4">
            Ver parceiros de mudança
          </Link>
        </p>
      )}
    </Panel>
  );
}
