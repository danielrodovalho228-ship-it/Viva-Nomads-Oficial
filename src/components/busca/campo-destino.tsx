"use client";

import { Briefcase, X } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import { LocationSearch } from "@/components/location-search";
import type { GeoSuggestion } from "@/lib/integrations/geocoding";
import { ATE_OPCOES, ROTULO_MODO, rotuloLimpo, type ModoRota } from "@/lib/rotas/tempo";
import type { DestinoBusca, EstadoDestino } from "@/lib/busca/destino-busca";
import { useState } from "react";

export interface DestinoChip {
  slug: string;
  nome: string;
  cidade: string;
}

/**
 * "Onde você vai trabalhar ou estudar?" (prompt 37): chips dos destinos cadastrados da cidade, endereço livre, meio
 * e "até N min". Ônibus só aparece com a chave ligada (meio sem dado não aparece).
 */
export function CampoDestino({
  destinos,
  modos,
  valor,
  onChange,
}: {
  destinos: DestinoChip[];
  modos: ModoRota[];
  valor: EstadoDestino;
  onChange: (e: EstadoDestino) => void;
}) {
  const [texto, setTexto] = useState("");
  const { destino, modo, ate } = valor;
  const slug = destino && "slug" in destino ? destino.slug : null;
  const digitado = destino && !("slug" in destino) ? destino : null;
  const escolher = (d: DestinoBusca | null) => onChange({ destino: d, modo, ate: d ? ate : 0 });

  return (
    <section className="rounded-xl border border-line bg-white p-4" data-testid="campo-destino" aria-labelledby="titulo-destino">
      <h2 id="titulo-destino" className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Briefcase className="h-4 w-4" aria-hidden /> Onde você vai trabalhar ou estudar?
      </h2>
      {destinos.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2" data-testid="destinos-chips">
          {destinos.map((d) => (
            <Chip key={d.slug} ativo={slug === d.slug} data-testid={`destino-${d.slug}`} onClick={() => escolher(slug === d.slug ? null : { slug: d.slug })}>
              {d.nome}
            </Chip>
          ))}
        </div>
      )}
      <div className="mt-3 min-w-0">
        {digitado ? (
          <p className="inline-flex max-w-full items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm text-ink" data-testid="destino-digitado">
            <span className="truncate">{digitado.rot || "Endereço informado"}</span>
            <button type="button" aria-label="Tirar o endereço" onClick={() => escolher(null)} className="shrink-0 text-muted hover:text-ink">
              <X className="h-4 w-4" />
            </button>
          </p>
        ) : (
          <LocationSearch
            placeholder="Ou digite o endereço do trabalho"
            value={texto}
            onChange={setTexto}
            onSelect={(s: GeoSuggestion) => {
              setTexto("");
              escolher({ lat: s.lat, lng: s.lng, rot: rotuloLimpo(s.label) });
            }}
          />
        )}
      </div>
      {destino && (
        <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="destino-opcoes">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Como você vai">
            {modos.map((m) => (
              <Chip key={m} ativo={modo === m} data-testid={`modo-${m}`} onClick={() => onChange({ destino, modo: m, ate })}>
                {ROTULO_MODO[m]}
              </Chip>
            ))}
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-ink">
            até
            <select
              value={String(ate)}
              onChange={(e) => onChange({ destino, modo, ate: Number(e.target.value) })}
              aria-label="Tempo máximo até o trabalho"
              data-testid="destino-ate"
              className="h-10 rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus:border-ink"
            >
              <option value="0">qualquer tempo</option>
              {ATE_OPCOES.map((n) => (
                <option key={n} value={n}>
                  {n} min
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </section>
  );
}
