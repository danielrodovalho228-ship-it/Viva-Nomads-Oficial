import { Eye, Star } from "lucide-react";
import { mesEAno } from "@/lib/avaliacoes-responder";
import { notaPorExtenso, type NotaDoCriterio } from "@/lib/avaliacoes-perfil";
import { estrelasDaNota } from "@/lib/conta/tela-avaliacoes";
import { cn } from "@/lib/utils";

export interface AvaliacaoDoPerfil {
  id: string;
  /** Nome curto de quem avaliou ("Camila A."). */
  autorNome: string;
  nota: number;
  comentario: string;
  data: string | null;
  resposta: string | null;
}

function Estrelas({ nota }: { nota: number }) {
  const cheias = estrelasDaNota(nota);
  return (
    <span className="flex gap-1" role="img" aria-label={`Nota ${nota} de 5`} data-cheias={cheias}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Star key={i} className={cn("h-5 w-5", i < cheias ? "fill-amber-500 stroke-amber-600 text-amber-600" : "text-sage")} aria-hidden />
      ))}
    </span>
  );
}

/**
 * E679 (PR 4) — "Avaliações recebidas" + "Resumo das notas" nos perfis públicos do proprietário e do parceiro, iguais aos
 * mockups avaliacoes-perfil-*: cartão por avaliação (inicial, nome curto · mês e ano, estrelas, comentário, "Resposta de
 * …") e, à direita, a média de cada critério em barras. `aviso` é a faixa âmbar do parceiro (notas dele aos clientes).
 */
export function PerfilAvaliacoes({
  idSecao = "avaliacoes",
  avaliacoes,
  resumo,
  nomeResposta,
  rotuloTotal,
  aviso,
}: {
  idSecao?: string;
  avaliacoes: AvaliacaoDoPerfil[];
  resumo: NotaDoCriterio[];
  /** Quem responde ("Ricardo", "LimpaLar"): "Resposta de Ricardo". */
  nomeResposta: string;
  /** "27 avaliações de moradores" / "42 avaliações de clientes". */
  rotuloTotal: string;
  aviso?: string;
}) {
  const comNota = resumo.filter((r) => r.media !== null);
  return (
    <section id={idSecao} className="scroll-mt-28" aria-labelledby={`${idSecao}-titulo`} data-testid="perfil-avaliacoes">
      <h2 id={`${idSecao}-titulo`} className="font-title text-2xl font-semibold text-forest">
        Avaliações recebidas
      </h2>
      {aviso && (
        <p className="mt-3 flex items-start gap-3 rounded-xl bg-amber-100 px-4 py-3 text-sm text-amber-900" data-testid="perfil-aviso-notas">
          <Eye className="mt-1 h-5 w-5 shrink-0" aria-hidden /> {aviso}
        </p>
      )}
      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <ul className="grid gap-4">
          {avaliacoes.map((a) => (
            <li key={a.id} className="rounded-xl border border-line bg-white p-4 sm:p-6" data-testid="perfil-avaliacao">
              <div className="flex items-start gap-4">
                <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sage-100 text-lg font-semibold text-forest">
                  {a.autorNome.charAt(0)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-ink">
                    {a.autorNome}
                    {a.data && <span className="ml-2 font-normal text-muted">· {mesEAno(a.data)}</span>}
                  </p>
                  <div className="mt-1">
                    <Estrelas nota={a.nota} />
                  </div>
                </div>
              </div>
              {a.comentario && <p className="mt-3 text-base text-ink">{a.comentario}</p>}
              {a.resposta && (
                <div className="mt-3 rounded-xl border-l-4 border-sage bg-sage-100 px-4 py-3" data-testid="perfil-resposta">
                  <p className="text-sm font-semibold text-forest">Resposta de {nomeResposta}</p>
                  <p className="mt-1 text-base text-ink">{a.resposta}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
        {comNota.length > 0 && (
          <aside className="rounded-xl border border-line bg-white p-4 sm:p-6" aria-labelledby={`${idSecao}-resumo`} data-testid="perfil-resumo-notas">
            <h3 id={`${idSecao}-resumo`} className="text-xl font-semibold text-forest">
              Resumo das notas
            </h3>
            <ul className="mt-4 grid gap-4">
              {resumo.map((r) => (
                <li key={r.chave} data-testid="perfil-nota-criterio">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-base text-ink">{r.rotulo}</span>
                    <span className="text-lg font-semibold tabular-nums text-forest">{r.media === null ? "—" : notaPorExtenso(r.media)}</span>
                  </div>
                  <div className="mt-1 h-3 overflow-hidden rounded-full bg-sage-100" role="img" aria-label={r.media === null ? `${r.rotulo}: sem notas ainda` : `${r.rotulo}: ${notaPorExtenso(r.media)} de 5`}>
                    <div className="h-full rounded-full bg-forest" style={{ width: `${r.media === null ? 0 : (r.media / 5) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-muted" data-testid="perfil-base-notas">
              Baseado em {rotuloTotal.toLowerCase()}
            </p>
          </aside>
        )}
      </div>
    </section>
  );
}
