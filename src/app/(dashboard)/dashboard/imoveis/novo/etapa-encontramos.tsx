"use client";

import { Sparkles } from "lucide-react";
import type { Proximity } from "@/lib/types";
import type { LugarProximo } from "@/lib/proximidades/osm";
import { comodidadeValeParaTipo, comodidadesDoTipo, type GrupoDoTipo } from "@/lib/amenities";
import { ESSENCIAIS_TRABALHO, OPCIONAIS_TRABALHO } from "@/lib/anuncio/sugestoes-cadastro";
import { PrivacidadeCampos } from "@/components/anuncio/privacidade-campos";
import type { Privacidade } from "@/lib/anuncio/privacidade";
import { ProntoParaTrabalhar, ProximidadesAutomaticas } from "@/components/anuncio/blocos-cadastro";
import { avisoTituloBairro } from "@/lib/anuncio/titulo-bairro";
import { iconeDaComodidade } from "@/lib/anuncio/comodidades-icones";
import { cn } from "@/lib/utils";
import { Erro, Labeled, Toggle } from "./campos";
import type { CampoSugerido, EstadoIaFotos } from "./tipos";

const CHAVES_BLOCO_TRABALHO = new Set<string>([...ESSENCIAIS_TRABALHO, ...OPCIONAIS_TRABALHO].map((i) => i.chave));

/** Qual pedaço do cadastro esta tela mostra (assistente em 10 passos, mockups cadastro-imovel-01..10). */
export type ParteCadastro = "espaco" | "comodidades" | "regras" | "descricao";

/**
 * Campos do imóvel, com "Sugerido · confira" no que veio das fotos (prompt 10), divididos pelos passos do assistente:
 *   • espaco (passo 4, Detalhes): quartos, banheiros, pessoas (2 por quarto), área e vagas (o tipo é o passo 1);
 *   • comodidades (passo 5): bloco "Pronto para trabalhar de casa", grupos de comodidades (com "Segurança"), câmeras e
 *     acesso, proximidades;
 *   • regras (passo 6): mobiliado, pets, crianças e fumar;
 *   • descricao (passo 7): título e descrição.
 * Nenhuma imagem decorativa no meio do formulário.
 */
export function EtapaEncontramos(p: {
  parte: ParteCadastro;
  propertyType: string;
  setPropertyType: (v: string) => void;
  tipoSugerido: boolean;
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
  /** Detecção-A: comodidades achadas nas fotos e ainda não confirmadas — tracejadas, com "Confirme". */
  comodidadesDetectadas?: string[];
  internetMbps: string;
  setInternetMbps: (v: string) => void;
  /** E102-B: "Não tem internet" — o campo de velocidade não é pedido. */
  semInternet?: boolean;
  /** Id do rascunho já salvo (a medição da internet precisa do imóvel gravado). */
  imovelId?: string | null;
  proxOsm: LugarProximo[] | null;
  proxCarregando: boolean;
  proxBuscou: boolean;
  medirLugar: (endereco: string) => Promise<number | null>;
  reportarLugar: ((l: LugarProximo, motivo: string) => Promise<{ ok: boolean; erro?: string }>) | null;
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
  const aviso = p.iaEstado === "feita" && (
        <p className="flex items-start gap-2 rounded-lg bg-champagne/15 px-3 py-2 text-sm text-forest" data-testid="ia-resumo">
          <Sparkles className="mt-1 h-4 w-4 shrink-0" aria-hidden />
          Preenchemos pelo que aparece nas fotos. Confira cada campo marcado “Sugerido · confira”: tudo é editável.
        </p>
  );

  if (p.parte === "regras") {
    return (
      <div className="space-y-2" data-testid="etapa-regras-casa">
        {/* E110: "Regras da casa" já é o título do passo (H1); não se repete aqui. */}
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
    );
  }

  if (p.parte === "descricao") {
    return (
      <div className="space-y-4" data-testid="etapa-descricao">
        {aviso}
        <Labeled label="Título do anúncio" sugerido={p.sugerido("titulo")}>
          <input value={p.title} onChange={campo("titulo", p.setTitle)} maxLength={80} placeholder="Ex.: Studio mobiliado no Centro" className="input" data-testid="cadastro-titulo" />
          <Erro msg={p.erros.titulo} />
          <AvisoBairro titulo={p.title} bairro={p.neighborhood} />
        </Labeled>
        <Labeled label="Descrição" sugerido={p.sugerido("descricao")}>
          <textarea rows={5} value={p.description} onChange={campo("descricao", p.setDescription)} className="input" placeholder="Descreva o imóvel…" data-testid="cadastro-descricao" />
        </Labeled>
      </div>
    );
  }

  if (p.parte === "espaco") {
    return (
      <div className="space-y-4" data-testid="etapa-espaco">
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
      </div>
    );
  }

  // E111-A: os grupos e itens que o tipo do imóvel mostra (o marcado que o tipo não mostra fica salvo, só não aparece).
  const grupos = comodidadesDoTipo(p.propertyType);
  const sugeridas = p.comodidadesSugeridas.filter((k) => comodidadeValeParaTipo(k, p.propertyType));
  return (
    <div className="space-y-4" data-testid="etapa-encontramos" data-tipo-imovel={p.propertyType || undefined}>
      {aviso}
      <ProntoParaTrabalhar
        marcadas={p.amenityKeys}
        onAlternar={alternar}
        sugeridas={sugeridas}
        mbps={p.internetMbps}
        onMbps={p.setInternetMbps}
        imovelId={p.imovelId}
        semInternet={p.semInternet}
      />
      {p.qualTHome && <p className="text-xs text-forest">Da qualificação: etiqueta “Para trabalhar de casa” ativa.</p>}

      {grupos.filter((g) => g.category !== "seguranca").map((g) => (
        <GrupoComodidades key={g.category} grupo={g} titulo={g.titulo} marcadas={p.amenityKeys} sugeridas={sugeridas} detectadas={p.comodidadesDetectadas} onAlternar={alternar} />
      ))}
      {sugeridas.length > 0 && (
        <p className="text-xs text-muted">
          <Sparkles className="mr-1 inline h-3 w-3" aria-hidden />
          Comodidades com a estrela foram sugeridas pelas fotos. Toque para desmarcar o que não tiver.
        </p>
      )}

      <section className="space-y-3 border-t border-line pt-4" data-testid="seguranca-imovel">
        <h3 className="text-base font-semibold text-ink">Segurança e imóvel</h3>
        {grupos.filter((g) => g.category === "seguranca").map((g) => (
          <GrupoComodidades key={g.category} grupo={g} titulo={g.titulo} marcadas={p.amenityKeys} sugeridas={sugeridas} detectadas={p.comodidadesDetectadas} onAlternar={alternar} />
        ))}
        <PrivacidadeCampos valor={p.privacidade} onChange={p.setPrivacidade} />
      </section>

      <ProximidadesAutomaticas
        itens={p.proxOsm}
        carregando={p.proxCarregando}
        buscou={p.proxBuscou}
        medir={p.medirLugar}
        reportar={p.reportarLugar}
        desmarcados={p.proxDesmarcados}
        onAlternar={(k) => p.setProxDesmarcados((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))}
        manuais={p.manualProximities}
        onManuais={p.setManualProximities}
      />

    </div>
  );
}

function GrupoComodidades(p: {
  grupo: GrupoDoTipo;
  titulo: string;
  marcadas: Record<string, boolean>;
  sugeridas: string[];
  detectadas?: string[];
  onAlternar: (k: string) => void;
}) {
  const itens = p.grupo.items.filter((it) => !CHAVES_BLOCO_TRABALHO.has(it.key));
  if (itens.length === 0) return null;
  return (
    <div data-grupo={p.grupo.category}>
      <p className="text-sm font-semibold text-forest">{p.titulo}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {itens.map((it) => {
          const on = !!p.marcadas[it.key];
          const sug = on && p.sugeridas.includes(it.key);
          // Detecção-A: achada numa foto e ainda não marcada — tracejada, com "Confirme"; tocar marca (confirma).
          const detectada = !on && !!p.detectadas?.includes(it.key);
          const Icone = iconeDaComodidade(it.key);
          return (
            <button
              key={it.key}
              type="button"
              aria-pressed={on}
              onClick={() => p.onAlternar(it.key)}
              data-sugerido={sug ? "1" : undefined}
              data-detectada={detectada ? "1" : undefined}
              data-comodidade={it.key}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition-colors",
                on ? "border-forest bg-forest text-white" : detectada ? "border-dashed border-forest bg-white text-forest" : "border-line bg-white text-ink hover:border-ink"
              )}
            >
              {sug ? <Sparkles className="h-4 w-4" aria-label="Sugerido · confira" /> : <Icone className="h-4 w-4" aria-hidden />}
              {it.label}
              {detectada && (
                <span className="font-medium underline underline-offset-2" data-testid={`comodidade-confirme-${it.key}`}>
                  Confirme
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AvisoBairro({ titulo, bairro }: { titulo: string; bairro: string }) {
  const aviso = avisoTituloBairro(titulo, bairro);
  return aviso ? (
    <p role="status" className="mt-1 text-xs text-amber-700" data-testid="aviso-titulo-bairro">{aviso}</p>
  ) : null;
}
