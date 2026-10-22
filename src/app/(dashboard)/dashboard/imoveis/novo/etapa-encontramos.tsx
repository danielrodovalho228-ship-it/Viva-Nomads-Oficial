"use client";

import { Sparkles } from "lucide-react";
import type { Proximity } from "@/lib/types";
import type { LugarProximo } from "@/lib/proximidades/osm";
import { AMENITY_GROUPS } from "@/lib/amenities";
import { ESSENCIAIS_TRABALHO, OPCIONAIS_TRABALHO } from "@/lib/anuncio/sugestoes-cadastro";
import { PrivacidadeCampos } from "@/components/anuncio/privacidade-campos";
import type { Privacidade } from "@/lib/anuncio/privacidade";
import { ProntoParaTrabalhar, ProximidadesAutomaticas } from "@/components/anuncio/blocos-cadastro";
import { avisoTituloBairro } from "@/lib/anuncio/titulo-bairro";
import { cn } from "@/lib/utils";
import { Erro, Labeled, Toggle } from "./campos";
import type { CampoSugerido, EstadoIaFotos } from "./tipos";

const CHAVES_BLOCO_TRABALHO = new Set<string>([...ESSENCIAIS_TRABALHO, ...OPCIONAIS_TRABALHO].map((i) => i.chave));

/**
 * Etapa 3 — O que encontramos (prompt 10): tudo numa tela, já preenchido pelas fotos, com "Sugerido · confira":
 * quartos, banheiros, capacidade (2 por quarto), comodidades com o bloco "Pronto para trabalhar de casa",
 * proximidades, título e descrição. Área e vagas são manuais. Nenhuma imagem decorativa no meio do formulário.
 */
export function EtapaEncontramos(p: {
  iaEstado: EstadoIaFotos;
  sugerido: (c: CampoSugerido) => boolean;
  tirarSugestao: (c: CampoSugerido) => void;
  bedrooms: string;
  setBedrooms: (v: string) => void;
  bathrooms: string;
  setBathrooms: (v: string) => void;
  maxGuests: string;
  setMaxGuests: (v: string) => void;
  areaM2: string;
  /** Campos preenchidos pela matrícula (prompt 19). */
  daMatricula?: Set<string>;
  setAreaM2: (v: string) => void;
  parkingSpots: string;
  setParkingSpots: (v: string) => void;
  amenityKeys: Record<string, boolean>;
  setAmenityKeys: (fn: (s: Record<string, boolean>) => Record<string, boolean>) => void;
  comodidadesSugeridas: string[];
  internetMbps: string;
  setInternetMbps: (v: string) => void;
  proxOsm: LugarProximo[] | null;
  proxCarregando: boolean;
  proxDesmarcados: string[];
  setProxDesmarcados: (fn: (s: string[]) => string[]) => void;
  manualProximities: Proximity[];
  setManualProximities: (p: Proximity[]) => void;
  neighborhood: string;
  title: string;
  setTitle: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  furnished: boolean;
  setFurnished: (fn: (v: boolean) => boolean) => void;
  petsOk: boolean;
  setPetsOk: (fn: (v: boolean) => boolean) => void;
  childrenAllowed: boolean;
  setChildrenAllowed: (fn: (v: boolean) => boolean) => void;
  smokingAllowed: boolean;
  setSmokingAllowed: (fn: (v: boolean) => boolean) => void;
  privacidade: Privacidade;
  setPrivacidade: (v: Privacidade) => void;
  qualTHome: boolean;
  erros: Record<string, string>;
}) {
  const campo = (c: CampoSugerido, set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    set(e.target.value);
    p.tirarSugestao(c);
  };
  const alternar = (k: string) => p.setAmenityKeys((s) => ({ ...s, [k]: !s[k] }));
  return (
    <div className="space-y-5" data-testid="etapa-encontramos">
      {p.iaEstado === "feita" && (
        <p className="flex items-start gap-2 rounded-lg bg-champagne/15 px-3 py-2 text-sm text-forest" data-testid="ia-resumo">
          <Sparkles className="mt-1 h-4 w-4 shrink-0" aria-hidden />
          Preenchemos pelo que aparece nas fotos. Confira cada campo marcado “Sugerido · confira”: tudo é editável.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 [&>*]:min-w-0">
        <Labeled label="Quartos" sugerido={p.sugerido("quartos")}>
          <input type="number" min={0} value={p.bedrooms} onChange={campo("quartos", p.setBedrooms)} className="input" data-testid="cadastro-quartos" />
        </Labeled>
        <Labeled label="Banheiros" sugerido={p.sugerido("banheiros")}>
          <input type="number" min={0} value={p.bathrooms} onChange={campo("banheiros", p.setBathrooms)} className="input" data-testid="cadastro-banheiros" />
          <Erro msg={p.erros.banheiros} />
        </Labeled>
        <Labeled label="Pessoas" sugerido={p.sugerido("capacidade")} ajuda="Quantas podem morar">
          <input type="number" min={1} value={p.maxGuests} onChange={campo("capacidade", p.setMaxGuests)} className="input" placeholder="Ex.: 2" data-testid="cadastro-capacidade" />
          <Erro msg={p.erros.capacidade} />
        </Labeled>
        <Labeled label="Área (m²)" daMatricula={p.daMatricula?.has("area")}>
          <input type="number" min={0} value={p.areaM2} onChange={(e) => p.setAreaM2(e.target.value)} className="input" data-testid="cadastro-area" />
          <Erro msg={p.erros.area} />
        </Labeled>
        <Labeled label="Vagas" daMatricula={p.daMatricula?.has("vagas")}>
          <input type="number" min={0} value={p.parkingSpots} onChange={(e) => p.setParkingSpots(e.target.value)} className="input" />
        </Labeled>
      </div>

      <ProntoParaTrabalhar
        marcadas={p.amenityKeys}
        onAlternar={alternar}
        sugeridas={p.comodidadesSugeridas}
        mbps={p.internetMbps}
        onMbps={p.setInternetMbps}
      />
      {p.qualTHome && <p className="text-xs text-forest">Da qualificação: etiqueta “Para trabalhar de casa” ativa.</p>}

      {AMENITY_GROUPS.map((g) => {
        const itens = g.items.filter((it) => !CHAVES_BLOCO_TRABALHO.has(it.key));
        if (itens.length === 0) return null;
        return (
          <div key={g.category}>
            <p className="text-sm font-semibold text-forest">{g.category === "trabalho" ? "No prédio" : g.label}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {itens.map((it) => {
                const on = !!p.amenityKeys[it.key];
                const sug = on && p.comodidadesSugeridas.includes(it.key);
                return (
                  <button
                    key={it.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => alternar(it.key)}
                    data-sugerido={sug ? "1" : undefined}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-3 py-2 text-xs font-medium transition-colors",
                      on ? "border-forest bg-forest text-white" : "border-sage-200 text-ink hover:border-sage"
                    )}
                  >
                    {sug && <Sparkles className="h-3 w-3" aria-label="Sugerido · confira" />}
                    {it.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      {p.comodidadesSugeridas.length > 0 && (
        <p className="text-xs text-muted">
          <Sparkles className="mr-1 inline h-3 w-3" aria-hidden />
          Comodidades com a estrela foram sugeridas pelas fotos. Toque para desmarcar o que não tiver.
        </p>
      )}

      <ProximidadesAutomaticas
        itens={p.proxOsm}
        carregando={p.proxCarregando}
        desmarcados={p.proxDesmarcados}
        onAlternar={(k) => p.setProxDesmarcados((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))}
        manuais={p.manualProximities}
        onManuais={p.setManualProximities}
      />

      <Labeled label="Título do anúncio" sugerido={p.sugerido("titulo")}>
        <input value={p.title} onChange={campo("titulo", p.setTitle)} maxLength={80} placeholder="Ex.: Studio mobiliado no Centro" className="input" data-testid="cadastro-titulo" />
        <Erro msg={p.erros.titulo} />
        <AvisoBairro titulo={p.title} bairro={p.neighborhood} />
      </Labeled>
      <Labeled label="Descrição" sugerido={p.sugerido("descricao")}>
        <textarea rows={5} value={p.description} onChange={campo("descricao", p.setDescription)} className="input" placeholder="Descreva o imóvel…" data-testid="cadastro-descricao" />
      </Labeled>

      <div className="space-y-2">
        <p className="text-sm font-medium text-ink">Regras</p>
        <Toggle
          checked={p.furnished}
          onChange={() => {
            p.setFurnished((v) => !v);
            p.tirarSugestao("mobiliado");
          }}
          label="Mobiliado e equipado"
          hint="Pré-requisito das estadias de 30 a 180 dias da Viva Nomads."
          sugerido={p.sugerido("mobiliado")}
        />
        <Toggle checked={p.petsOk} onChange={() => p.setPetsOk((v) => !v)} label="Aceita pets" hint="Amplia o público interessado." />
        <Toggle checked={p.childrenAllowed} onChange={() => p.setChildrenAllowed((v) => !v)} label="Aceita crianças" />
        <Toggle checked={p.smokingAllowed} onChange={() => p.setSmokingAllowed((v) => !v)} label="Permite fumar" />
      </div>
      <PrivacidadeCampos valor={p.privacidade} onChange={p.setPrivacidade} />
    </div>
  );
}

function AvisoBairro({ titulo, bairro }: { titulo: string; bairro: string }) {
  const aviso = avisoTituloBairro(titulo, bairro);
  return aviso ? (
    <p role="status" className="mt-1 text-xs text-amber-700" data-testid="aviso-titulo-bairro">{aviso}</p>
  ) : null;
}
