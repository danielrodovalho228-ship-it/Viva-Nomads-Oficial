import type { ReactNode } from "react";
import { Mail } from "lucide-react";
import { dataHoraBRT } from "@/lib/datas-brasilia";
import { Panel, EmptyState } from "@/components/dashboard/primitives";
import { linhaParaTela, type LinhaEmailTeste } from "@/lib/notifications/caixa-teste";

const quando = (iso: string) => dataHoraBRT(iso, { tabela: true });

/**
 * A lista de e-mails das caixas de teste — a MESMA em /admin/emails-teste e em /dashboard/qa/emails (QA-CAIXA-B).
 * Celular: cartões; computador: tabela. Tudo passa por `linhaParaTela`: nenhum e-mail completo aparece na tela.
 */
export function ListaEmailsTeste({ linhas, titulo = "Mais recentes primeiro", vazio }: { linhas: LinhaEmailTeste[]; titulo?: string; vazio: { titulo: string; texto: string; acao?: ReactNode } }) {
  const itens = linhas.map(linhaParaTela);
  return (
    <Panel title={titulo} id="lista" className="scroll-mt-24">
      {itens.length === 0 ? (
        <EmptyState icon={Mail} title={vazio.titulo} text={vazio.texto} action={vazio.acao} />
      ) : (
        <>
          {/* Celular: cartões */}
          <ul className="space-y-3 md:hidden" data-testid="emails-teste-cartoes">
            {itens.map((l) => (
              <li key={l.id} className="min-w-0 rounded-xl border border-sage-200 p-3">
                <p className="text-xs text-muted">
                  {quando(l.criado_em)} · {l.destinatario_mascarado}
                </p>
                <p className="mt-1 break-words font-semibold text-ink">{l.assunto}</p>
                <details className="mt-2">
                  <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-forest">Ler o e-mail</summary>
                  <pre className="whitespace-pre-wrap break-words text-sm text-ink">{l.corpo}</pre>
                </details>
              </li>
            ))}
          </ul>
          {/* Computador: tabela */}
          <div className="hidden md:block">
            <table className="w-full table-fixed text-left text-sm" data-testid="emails-teste-tabela">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="w-32 py-2">Quando</th>
                  <th className="w-44 py-2">Para</th>
                  <th className="py-2">Assunto e texto</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((l) => (
                  <tr key={l.id} className="border-t border-sage-200 align-top">
                    <td className="py-2 pr-2">{quando(l.criado_em)}</td>
                    <td className="break-words py-2 pr-2">{l.destinatario_mascarado}</td>
                    <td className="py-2">
                      <details>
                        <summary className="cursor-pointer break-words font-semibold text-ink">{l.assunto}</summary>
                        <pre className="mt-2 whitespace-pre-wrap break-words text-sm text-ink">{l.corpo}</pre>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Panel>
  );
}
