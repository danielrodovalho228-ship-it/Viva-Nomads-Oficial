import Link from "next/link";
import { Panel } from "@/components/dashboard/primitives";
import { ESTADO_POR_GERAR, textoDoPeriodoDoFecho, type LinhaDoFecho } from "@/lib/fechamento/fechos-do-dono";

/**
 * E1090 — os textos novos do Fechamento (PROPOSTA DE TEXTO, para aprovação no PR — ORDEM-DUET-610, decisão 5).
 * Fonte única: a tela e a trava leem daqui.
 */
export const TEXTOS_FECHOS = {
  titulo: "Seus fechamentos",
  porGerar: ESTADO_POR_GERAR,
  naoEncontrado: "Não encontramos esse fechamento. Estes são os seus.",
  abertoAgora: "Aberto agora",
  abrir: "Abrir fechamento",
  verContrato: "Ver contrato",
  verOrcamento: "Ver orçamento",
  contratoNaoGerado: "O contrato desta estadia ainda não foi gerado.",
  teto: (n: number) => `Mais ${n} ${n === 1 ? "fechamento não aparece" : "fechamentos não aparecem"} aqui.`,
  verTodos: "Ver todos em Contratos",
  semPorFecharTitulo: "Nenhum fechamento por fazer agora",
  semPorFecharTexto:
    "As suas candidaturas aceitas voltaram para você decidir: a pré-aceitação expirou. Reabra a proposta em Interessados para seguir com o fechamento.",
} as const;

/** E1204: o período pela regra do E1089 (Entrada · Saída · diárias), a mesma nas três linhas. */
function periodoDaLinha(l: LinhaDoFecho): string | null {
  return textoDoPeriodoDoFecho(l.periodo);
}

/**
 * O bloco "Seus fechamentos" (R5, R6, R7, R9, R12): por cima do assistente quando o dono tem mais de um fecho, ou sempre
 * que o `?c=` pedido não é dele. Cada linha diz o imóvel, o morador, o período, os números e o estado; nenhum contato.
 */
export function SeusFechamentos({
  linhas,
  foraDoTeto,
  atual,
  naoEncontrado,
}: {
  linhas: LinhaDoFecho[];
  foraDoTeto: number;
  atual: string | null;
  naoEncontrado: boolean;
}) {
  return (
    <Panel title={TEXTOS_FECHOS.titulo} className="mb-4" data-testid="seus-fechamentos">
      {naoEncontrado && (
        <p role="status" data-testid="fechamento-nao-encontrado" className="mb-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {TEXTOS_FECHOS.naoEncontrado}
        </p>
      )}
      <ul className="divide-y divide-sage-100">
        {linhas.map((l) => {
          const eAtual = l.chave === atual;
          const periodo = periodoDaLinha(l);
          return (
            <li
              key={l.chave}
              data-testid="fecho-linha"
              data-chave={l.chave}
              data-candidatura={l.leadId}
              data-tipo={l.tipo}
              data-atual={eAtual ? "sim" : "nao"}
              aria-current={eAtual ? "true" : undefined}
              className={`flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between ${eAtual ? "rounded-lg bg-surface-2 px-3" : ""}`}
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink" data-testid="fecho-imovel">
                  {l.imovel}
                </p>
                <p className="text-sm text-muted">
                  <span data-testid="fecho-morador">{l.morador}</span>
                  {periodo && <span data-testid="fecho-periodo"> · {periodo}</span>}
                </p>
                <p className="text-xs text-muted">
                  {l.orcamento && <span data-testid="fecho-orcamento">{l.orcamento}</span>}
                  {l.orcamento && l.contrato && " · "}
                  {l.contrato && <span data-testid="fecho-contrato">{l.contrato}</span>}
                </p>
                {(l.acao.tipo === "orcamento" || (l.acao.tipo === "assistente" && l.acao.anterior)) && (
                  <p className="mt-1 text-xs text-muted" data-testid="fecho-contrato-nao-gerado">
                    {TEXTOS_FECHOS.contratoNaoGerado}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span data-testid="fecho-estado" className="rounded-full bg-sage-100 px-3 py-1 text-xs font-semibold text-forest">
                  {l.estado}
                </span>
                {eAtual ? (
                  <span className="text-sm font-semibold text-forest" data-testid="fecho-aberto-agora">
                    {TEXTOS_FECHOS.abertoAgora}
                  </span>
                ) : (
                  <Link href={l.acao.href} data-testid="fecho-acao" data-acao={l.acao.tipo} className="inline-flex min-h-11 items-center text-sm font-semibold text-forest underline">
                    {l.acao.tipo === "assistente" ? TEXTOS_FECHOS.abrir : l.acao.tipo === "contrato" ? TEXTOS_FECHOS.verContrato : TEXTOS_FECHOS.verOrcamento}
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {foraDoTeto > 0 && (
        <p className="mt-3 text-sm text-muted" data-testid="fechos-teto">
          {TEXTOS_FECHOS.teto(foraDoTeto)}{" "}
          <Link href="/dashboard/contratos" className="font-semibold text-forest underline">
            {TEXTOS_FECHOS.verTodos}
          </Link>
        </p>
      )}
    </Panel>
  );
}
