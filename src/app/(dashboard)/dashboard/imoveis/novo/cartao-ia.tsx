"use client";

import { useRef } from "react";
import { buttonClasses } from "@/components/ui/button";
import { Camera, FileText, Loader2, Sparkles } from "lucide-react";
import { mensagemFaltamFotosIa, iaFotosLiberada } from "@/lib/ai/fotos-prompt";
import type { EstadoIaFotos, FalhaIaFotos } from "./tipos";
import { FalhaIa } from "./etapa-fotos";

export const ACEITA_FOTOS = "image/jpeg,image/png,image/webp";

/**
 * Passo 1 (prompt 20): o caminho principal é "a IA faz por mim". Um cartão só, no topo, no lugar das duas caixas
 * tracejadas: envia as fotos (sobem para a galeria do passo 2, com as mesmas regras) e a matrícula (o mesmo leitor
 * de documento do prompt 11). A IA das fotos roda sozinha em segundo plano enquanto o dono preenche o CEP.
 */
export function CartaoIa(p: {
  totalFotos: number;
  enviando: { feitas: number; total: number } | null;
  erroEnvio: string | null;
  iaEstado: EstadoIaFotos;
  iaFalha?: FalhaIaFotos | null;
  onTentarDeNovo?: () => void;
  resumoIa: string;
  onFotos: (files: File[]) => void;
  onMatricula: () => void;
  onVerPasso3: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const liberada = iaFotosLiberada(p.totalFotos);

  let status: React.ReactNode = null;
  if (p.enviando) {
    status = (
      <span className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Enviando {Math.min(p.enviando.feitas + 1, p.enviando.total)} de {p.enviando.total} fotos…
      </span>
    );
  } else if (p.totalFotos > 0 && !liberada) {
    status = mensagemFaltamFotosIa(p.totalFotos);
  } else if (liberada && p.iaEstado === "analisando") {
    status = (
      <span className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Analisando {p.totalFotos} fotos…
      </span>
    );
  } else if (liberada && p.iaEstado === "feita") {
    status = (
      <span>
        Pronto: {p.resumoIa ? <>encontramos {p.resumoIa}.</> : <>preenchemos o que dá para ver nas fotos.</>}{" "}
        <button type="button" onClick={p.onVerPasso3} className="font-semibold underline underline-offset-2" data-testid="cartao-ia-ver-passo3">
          Ver no passo 3
        </button>
      </span>
    );
  } else if (liberada && p.iaEstado === "erro" && p.iaFalha) {
    status = <FalhaIa falha={p.iaFalha} onTentarDeNovo={p.onTentarDeNovo} />;
  } else if (liberada && p.iaEstado === "sem_sugestoes") {
    status = "Fotos recebidas. A IA não encontrou o que sugerir: você confere tudo no passo 3.";
  } else if (liberada) {
    status = (
      <span className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Analisando {p.totalFotos} fotos…
      </span>
    );
  }

  return (
    <section className="rounded-xl border border-sage-200 bg-sage-50 p-4 sm:p-4" data-testid="cartao-ia" aria-labelledby="cartao-ia-titulo">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-forest" aria-hidden>
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 id="cartao-ia-titulo" className="font-title text-lg font-semibold text-ink">
            Deixe a IA preencher o anúncio para você
          </h3>
          <p className="mt-1 text-sm text-muted">
            Envie as fotos do imóvel (e, se tiver, a matrícula). A gente preenche endereço, quartos, mobília e destaques —
            você só confere.
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={!!p.enviando}
          className={buttonClasses({ variant: "secondary", className: "w-full disabled:opacity-60" })}
          data-testid="cartao-ia-fotos"
        >
          <Camera className="h-4 w-4" aria-hidden /> Enviar fotos
        </button>
        <button
          type="button"
          onClick={p.onMatricula}
          className={buttonClasses({ variant: "secondary", className: "w-full" })}
          data-testid="cartao-ia-matricula"
        >
          <FileText className="h-4 w-4" aria-hidden /> Enviar matrícula
        </button>
      </div>
      <input
        ref={input}
        type="file"
        accept={ACEITA_FOTOS}
        multiple
        className="hidden"
        data-testid="cartao-ia-input"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) p.onFotos(files);
        }}
      />
      {(status || p.erroEnvio) && (
        <div className="mt-3 rounded-lg bg-white px-3 py-2 text-sm text-forest" role="status" data-testid="cartao-ia-status" data-estado={p.enviando ? "enviando" : p.iaEstado}>
          {status}
          {p.erroEnvio && <p className="mt-1 text-xs text-red-700">{p.erroEnvio}</p>}
        </div>
      )}
    </section>
  );
}
