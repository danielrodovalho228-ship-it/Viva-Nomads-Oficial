"use client";

import { useState } from "react";
import { Star, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { avaliar } from "@/lib/data/avaliacoes-actions";
import { CRITERIOS, ETIQUETAS, MAX_ETIQUETAS, type ParAvaliacao } from "@/lib/avaliacoes-criterios";
import { TEXTOS_AVALIAR } from "@/lib/avaliacoes-pagina";
import { LIMITE_COMENTARIO, TEXTO_AVALIACAO_FECHADA, partesDaAvaliacao, prazoAvaliacao, validarAvaliacao } from "@/lib/avaliacoes";
import { cn } from "@/lib/utils";
import { semQuedaDeRede } from "@/lib/erro-de-rede";

/**
 * Formulário de avaliação reutilizável (avaliação bidirecional). Serve para o
 * proprietário avaliar o inquilino e para o inquilino avaliar o proprietário —
 * basta trocar `papelAutor`, o alvo e os textos.
 */
export function AvaliacaoForm({
  contratoId,
  alvoId,
  papelAutor,
  abrirLabel,
  titulo,
  placeholder,
  demo,
  encerradoEm,
  fechada = false,
  abertoInicial = false,
}: {
  contratoId: string;
  alvoId: string;
  papelAutor: "proprietario" | "inquilino";
  abrirLabel: string;
  titulo: string;
  placeholder: string;
  demo?: boolean;
  /** Fim do contrato: dá o prazo (14 dias) mostrado nas duas partes. */
  encerradoEm?: string | null;
  /**
   * E544: a janela de avaliação ainda não abriu (estadia futura ou em andamento). Mostra o estado pendente com o prazo e
   * NÃO oferece o botão — o servidor recusaria (0089: só contrato encerrado, até 14 dias depois do fim).
   */
  fechada?: boolean;
  /** E679: na página própria de avaliar o formulário já nasce aberto (sem o botão "Avaliar…"). */
  abertoInicial?: boolean;
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comentario, setComentario] = useState("");
  const par: ParAvaliacao = papelAutor === "inquilino" ? "morador_avalia_dono" : "dono_avalia_morador";
  const [criterios, setCriterios] = useState<Record<string, number>>({});
  const [etiquetas, setEtiquetas] = useState<string[]>([]);
  const [recomendaria, setRecomendaria] = useState<boolean | null>(null);
  const [notaPrivadaParte, setNotaPrivadaParte] = useState("");
  const [notaPrivadaViva, setNotaPrivadaViva] = useState("");
  const [aberto, setAberto] = useState(abertoInicial);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [moderacao, setModeracao] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Sem leitura no servidor ao abrir a tela (Prompt 42: nenhuma server action na navegação do painel); o estado
  // "Aguardando a outra parte" vem do envio desta visita, e o banco recusa uma segunda avaliação do mesmo contrato.
  // Na página própria (abertoInicial) a faixa de sigilo do mockup já diz o prazo; o bloco das duas partes só volta depois do envio.
  const partes = abertoInicial && !enviado ? null : <PartesAvaliacao euEnviei={enviado} prazo={prazoAvaliacao(encerradoEm)} />;

  async function enviar() {
    setErro(null);
    const msg = validarAvaliacao(rating, comentario);
    if (msg) {
      setErro(msg);
      return;
    }
    setEnviando(true);
    const r = await semQuedaDeRede(avaliar({ contratoId, alvoId, papelAutor, rating, comentario, criterios, etiquetas, recomendaria, notaPrivadaParte, notaPrivadaViva }));
    setEnviando(false);
    if (r.ok) {
      setModeracao(!!r.moderacao);
      setEnviado(true);
    }
    else setErro(r.error ?? "Não foi possível avaliar.");
  }

  if (enviado) {
    return (
      <>
      {partes}
      <p className="mt-3 inline-flex items-center gap-2 text-sm text-forest">
        <Check className="h-4 w-4" />
        {demo
          ? "Avaliação de exemplo registrada."
          : moderacao
            ? "Avaliação recebida. Ela passa por uma revisão da equipe antes de aparecer (o comentário tinha contato ou palavra que não publicamos)."
            : "Avaliação enviada. Ela aparece quando a outra parte também avaliar, ou em até 14 dias depois do fim do contrato."}
      </p>
      </>
    );
  }

  if (fechada) {
    return (
      <>
        {partes}
        <p className="mt-3 text-sm text-muted" data-testid="avaliacao-fechada">
          {TEXTO_AVALIACAO_FECHADA}
        </p>
      </>
    );
  }

  if (!aberto) {
    return (
      <>
        {partes}
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-forest hover:underline"
        >
          <Star className="h-4 w-4" /> {abrirLabel}
        </button>
      </>
    );
  }

  const textos = TEXTOS_AVALIAR[par];
  // Marcada: dourado do mockup com contorno amber-600 (≥ 3:1 no branco); vazia: contorno sage (~5,2:1), o próprio controle.
  const estrela = (ativa: boolean) => (ativa ? "fill-amber-500 stroke-amber-600 text-amber-600" : "text-sage");
  return (
    <div>
      {partes}
      {titulo && <p className="mt-3 text-sm font-semibold text-ink">{titulo}</p>}
      {/* E679 (mockup avaliacoes-avaliar-*): nota geral grande, três critérios com as estrelas à direita, tags rápidas,
          texto público com contador, recomendaria e o botão cheio. */}
      <h3 className="mt-4 text-xl font-semibold text-forest">{textos.geral}</h3>
      <div className="mt-2 flex items-center gap-1" role="radiogroup" aria-label="Nota de 1 a 5" data-testid="avaliacao-geral">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setRating(n)}
            className="min-h-11 min-w-11"
          >
            <Star className={cn("mx-auto h-8 w-8 transition-colors", estrela((hover || rating) >= n))} />
          </button>
        ))}
      </div>
      <fieldset className="mt-4 divide-y divide-line border-t border-line" data-testid="avaliacao-criterios">
        <legend className="sr-only">Avalie cada ponto</legend>
        {CRITERIOS[par].map((c) => (
          <div key={c.chave} className="flex flex-wrap items-center justify-between gap-2 py-1">
            <span className="text-base text-ink">{c.rotulo}</span>
            <div className="flex items-center" role="radiogroup" aria-label={`${c.rotulo}, de 1 a 5`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={criterios[c.chave] === n}
                  aria-label={`${c.rotulo}: ${n}`}
                  onClick={() => setCriterios((x) => ({ ...x, [c.chave]: n }))}
                  className="min-h-11 min-w-11"
                >
                  <Star className={cn("mx-auto h-6 w-6", estrela((criterios[c.chave] ?? 0) >= n))} />
                </button>
              ))}
            </div>
          </div>
        ))}
      </fieldset>
      <h3 className="mt-4 text-xl font-semibold text-forest">{textos.etiquetas}</h3>
      <div className="mt-2 flex flex-wrap gap-2" aria-label="Etiquetas rápidas">
        {ETIQUETAS[par].map((t) => {
          const on = etiquetas.includes(t);
          return (
            <button
              key={t}
              type="button"
              aria-pressed={on}
              disabled={!on && etiquetas.length >= MAX_ETIQUETAS}
              onClick={() => setEtiquetas((x) => (on ? x.filter((y) => y !== t) : [...x, t]))}
              className={cn("min-h-11 rounded-full border px-4 text-sm font-semibold", on ? "border-forest bg-forest text-white" : "border-sage-200 bg-sage-100 text-forest")}
            >
              {t}
            </button>
          );
        })}
      </div>
      <h3 className="mt-4 text-xl font-semibold text-forest">{textos.texto}</h3>
      <div className="relative mt-2">
        <textarea
          rows={3}
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          maxLength={LIMITE_COMENTARIO}
          placeholder={placeholder}
          aria-label={textos.texto}
          className="w-full rounded-xl border border-sage-200 px-3 pb-6 pt-2 text-base outline-none focus:border-sage"
        />
        <span className="pointer-events-none absolute bottom-2 right-3 text-xs text-muted" data-testid="avaliacao-contador">
          {comentario.length}/{LIMITE_COMENTARIO}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2" role="radiogroup" aria-label="Recomendaria" data-testid="avaliacao-recomenda">
        <span className="text-lg font-semibold text-forest">{textos.recomenda}</span>
        <div className="flex gap-2">
          {[true, false].map((v) => (
            <button
              key={String(v)}
              type="button"
              role="radio"
              aria-checked={recomendaria === v}
              onClick={() => setRecomendaria(v)}
              className={cn("min-h-11 min-w-16 rounded-full border px-4 text-base font-semibold", recomendaria === v ? "border-forest bg-forest text-white" : "border-sage-200 bg-white text-forest")}
            >
              {v ? "Sim" : "Não"}
            </button>
          ))}
        </div>
      </div>
      <details className="mt-4 rounded-xl border border-line p-3" data-testid="avaliacao-recados-privados">
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-ink">Recados privados (opcional)</summary>
        <textarea
          rows={2}
          value={notaPrivadaParte}
          onChange={(e) => setNotaPrivadaParte(e.target.value)}
          maxLength={LIMITE_COMENTARIO}
          placeholder="Recado privado para a outra parte (só ela vê; opcional)"
          className="mt-2 w-full rounded-xl border border-sage-200 px-3 py-2 text-sm outline-none focus:border-sage"
        />
        <textarea
          rows={2}
          value={notaPrivadaViva}
          onChange={(e) => setNotaPrivadaViva(e.target.value)}
          maxLength={LIMITE_COMENTARIO}
          placeholder="Recado privado para a Viva (só a equipe vê; opcional)"
          className="mt-2 w-full rounded-xl border border-sage-200 px-3 py-2 text-sm outline-none focus:border-sage"
        />
      </details>
      {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
      <div className="mt-4 grid gap-2">
        <Button variant="primary" size="lg" className="w-full" onClick={enviar} disabled={enviando || rating === 0 || recomendaria === null || CRITERIOS[par].some((c) => !criterios[c.chave])}>
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Enviar avaliação
        </Button>
        {!abertoInicial && (
          <button type="button" onClick={() => setAberto(false)} className="min-h-11 text-sm font-semibold text-muted underline hover:text-ink">
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}

/** As duas partes da avaliação, com o prazo (Prompt 43, item 8). Às cegas: nunca diz se a outra parte já enviou. */
function PartesAvaliacao({ euEnviei, prazo }: { euEnviei: boolean; prazo: string | null }) {
  const p = partesDaAvaliacao(euEnviei, prazo);
  return (
    <div className="mt-4 border-t border-line pt-3" data-testid="avaliacao-partes" data-estado={euEnviei ? "aguardando" : "pendente"}>
      <p className="text-sm font-semibold text-ink">Avaliação · {p.estado}</p>
      <dl className="mt-1 divide-y divide-line text-sm">
        {p.linhas.map((l) => (
          <div key={l.quem} className="flex flex-wrap justify-between gap-x-3 py-2">
            <dt className="text-ink">{l.quem}</dt>
            <dd className="text-muted">{l.estado}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
