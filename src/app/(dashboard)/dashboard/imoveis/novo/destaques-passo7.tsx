"use client";

import { cn } from "@/lib/utils";
import { destaquesDoAnuncio, type EstadoDestaques } from "./destaques-logica";

/**
 * Passo 7, linha "Destaques" do mockup aprovado (cadastro-imovel-07-descricao): três pílulas logo abaixo da descrição —
 * Mobiliado, Wi-Fi incluído, Aceita pets. Decisão do Muse (06/11): em conflito entre regra genérica e mockup, vale o mockup.
 * Sem dado novo (nada de coluna): cada pílula liga/desliga o MESMO fato dos passos 5 e 6 (mobiliado, internet e pets), então a
 * linha, a prévia e os cartões dos outros passos nunca divergem. Pílula selecionada = verde-escuro com texto branco; a outra, contorno.
 */
export function DestaquesPasso7({ estado, onAlternar }: { estado: EstadoDestaques; onAlternar: (chave: "mobiliado" | "wifi" | "pets") => void }) {
  return (
    <div data-testid="destaques-passo7">
      <p className="text-sm font-medium text-ink">Destaques</p>
      <p className="mt-1 text-xs text-muted">O que aparece em primeiro no seu anúncio. É o mesmo que você marcou nos outros passos.</p>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Destaques do anúncio">
        {destaquesDoAnuncio(estado).map((d) => (
          <button
            key={d.chave}
            type="button"
            aria-pressed={d.on}
            onClick={() => onAlternar(d.chave)}
            data-testid={`destaque-${d.chave}`}
            className={cn(
              "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium transition-colors",
              d.on ? "border-forest bg-forest text-white" : "border-sage-200 bg-white text-ink hover:border-sage",
            )}
          >
            {d.rotulo}
          </button>
        ))}
      </div>
    </div>
  );
}
