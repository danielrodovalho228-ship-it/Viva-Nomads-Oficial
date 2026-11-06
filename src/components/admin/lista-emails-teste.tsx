import type { ReactNode } from "react";
import { Mail } from "lucide-react";
import { dataHoraBRT } from "@/lib/datas-brasilia";
import { Panel, EmptyState } from "@/components/dashboard/primitives";
import { imovelDoCorpo, linhaParaTela, type LinhaEmailTeste } from "@/lib/notifications/caixa-teste";

const quando = (iso: string) => dataHoraBRT(iso, { tabela: true });

/** E274/E434: a foto de capa de cada cartão de imóvel, EMBUTIDA como imagem — a URL crua nunca aparece no texto. */
function FotosDoCartao({ fotos }: { fotos: string[] }) {
  if (!fotos.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2" data-testid="emails-teste-fotos">
      {fotos.map((f) => (
        // eslint-disable-next-line @next/next/no-img-element -- a mesma URL que o cliente de e-mail carrega
        <img key={f} src={f} alt="Foto do cartão do imóvel" width={160} className="h-auto w-40 max-w-full rounded-lg border border-sage-200" loading="lazy" />
      ))}
    </div>
  );
}

/** E435: o que só o leitor de QA vê — destinatário por extenso, link de descadastro e a versão HTML (isolada). */
function ExtrasQa({ l }: { l: LinhaEmailTeste }) {
  return (
    <>
      {l.descadastro_url && (
        <p className="mt-2 break-all text-xs text-ink" data-testid="emails-teste-descadastro">
          Descadastro: <a href={l.descadastro_url} className="text-forest underline" rel="noreferrer" target="_blank">{l.descadastro_url}</a>
        </p>
      )}
      {l.html && (
        <details className="mt-2" data-testid="emails-teste-html">
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-forest">Ver a versão HTML</summary>
          {/* E632: um iframe por e-mail na mesma página — o título e o data-email-id dizem de QUAL e-mail é este HTML. */}
          {/* sandbox sem allow-scripts: o HTML guardado não roda script nem acessa a sessão do site. */}
          <iframe title={`Versão HTML do e-mail: ${l.assunto}`} data-email-id={l.id} sandbox="" srcDoc={l.html} className="h-[600px] w-full rounded-lg border border-sage-200 bg-white" />
        </details>
      )}
    </>
  );
}

/** E322/E435: o assunto encurta o título do imóvel; o nome inteiro vai na linha abaixo, sem cortar. */
function ImovelPorExtenso({ corpo }: { corpo: string }) {
  const nome = imovelDoCorpo(corpo);
  return nome ? (
    <p className="mt-1 break-words text-sm text-ink" data-testid="emails-teste-imovel">
      Imóvel: {nome}
    </p>
  ) : null;
}

/**
 * A lista de e-mails das caixas de teste — a MESMA em /admin/emails-teste e em /dashboard/qa/emails (QA-CAIXA-B).
 * Celular: cartões; computador: tabela. Tudo passa por `linhaParaTela`: nenhum e-mail completo aparece na tela.
 */
export function ListaEmailsTeste({ linhas, titulo = "Mais recentes primeiro", vazio, qa = false, rodape }: { linhas: LinhaEmailTeste[]; titulo?: string; vazio: { titulo: string; texto: string; acao?: ReactNode }; qa?: boolean; rodape?: ReactNode }) {
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
                  {quando(l.criado_em)} · {qa && l.destinatario ? l.destinatario : l.destinatario_mascarado}
                </p>
                <p className="mt-1 break-words font-semibold text-ink" data-testid="emails-teste-assunto">{l.assunto}</p>
                <ImovelPorExtenso corpo={l.corpo} />
                <details className="mt-2">
                  <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-forest">Ler o e-mail</summary>
                  <FotosDoCartao fotos={l.fotos} />
                  <pre className="whitespace-pre-wrap break-words text-sm text-ink">{l.corpo}</pre>
                  {qa && <ExtrasQa l={l} />}
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
                    <td className="break-words py-2 pr-2">{qa && l.destinatario ? l.destinatario : l.destinatario_mascarado}</td>
                    <td className="py-2">
                      <details>
                        <summary className="cursor-pointer break-words font-semibold text-ink">{l.assunto}</summary>
                        <ImovelPorExtenso corpo={l.corpo} />
                        <FotosDoCartao fotos={l.fotos} />
                        <pre className="mt-2 whitespace-pre-wrap break-words text-sm text-ink">{l.corpo}</pre>
                        {qa && <ExtrasQa l={l} />}
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {rodape}
    </Panel>
  );
}
