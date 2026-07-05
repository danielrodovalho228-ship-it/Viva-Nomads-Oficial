"use client";

import { useState } from "react";
import { Star, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { avaliar } from "@/lib/data/avaliacoes-actions";
import { validarAvaliacao } from "@/lib/avaliacoes";
import { cn } from "@/lib/utils";

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
}: {
  contratoId: string;
  alvoId: string;
  papelAutor: "proprietario" | "inquilino";
  abrirLabel: string;
  titulo: string;
  placeholder: string;
  demo?: boolean;
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comentario, setComentario] = useState("");
  const [aberto, setAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar() {
    setErro(null);
    const msg = validarAvaliacao(rating, comentario);
    if (msg) {
      setErro(msg);
      return;
    }
    setEnviando(true);
    const r = await avaliar({ contratoId, alvoId, papelAutor, rating, comentario });
    setEnviando(false);
    if (r.ok) setEnviado(true);
    else setErro(r.error ?? "Não foi possível avaliar.");
  }

  if (enviado) {
    return (
      <p className="mt-4 inline-flex items-center gap-1.5 border-t border-sage-200 pt-3 text-sm text-forest">
        <Check className="h-4 w-4" />
        {demo
          ? "Avaliação de exemplo registrada."
          : "Avaliação enviada — obrigado por construir a reputação da plataforma."}
      </p>
    );
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="mt-4 inline-flex items-center gap-1.5 border-t border-sage-200 pt-3 text-sm font-medium text-forest hover:underline"
      >
        <Star className="h-4 w-4" /> {abrirLabel}
      </button>
    );
  }

  return (
    <div className="mt-4 border-t border-sage-200 pt-4">
      <p className="text-sm font-medium text-ink">{titulo}</p>
      <div className="mt-2 flex items-center gap-1" role="radiogroup" aria-label="Nota de 1 a 5">
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
          >
            <Star
              className={cn(
                "h-6 w-6 transition-colors",
                (hover || rating) >= n ? "fill-champagne text-champagne" : "text-sage-200"
              )}
            />
          </button>
        ))}
      </div>
      <textarea
        rows={2}
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
        placeholder={placeholder}
        className="mt-3 w-full rounded-xl border border-sage-200 px-3 py-2 text-sm outline-none focus:border-sage"
      />
      {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
      <div className="mt-3 flex items-center gap-3">
        <Button variant="gold" size="sm" onClick={enviar} disabled={enviando || rating === 0}>
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Enviar avaliação
        </Button>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="text-xs font-medium text-muted underline hover:text-ink"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
