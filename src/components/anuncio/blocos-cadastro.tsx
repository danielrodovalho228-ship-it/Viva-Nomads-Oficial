"use client";

import { CampoReais } from "@/components/ui/campo-reais";
import { Briefcase, Check, MapPin, Percent, Plus, Trash2 } from "lucide-react";
import type { Proximity } from "@/lib/types";
import type { LugarProximo } from "@/lib/proximidades/osm";
import { ManualProximities } from "@/components/property/manual-proximities";
import {
  contadorEssenciais,
  essenciaisMarcados,
  ESSENCIAIS_TRABALHO,
  OPCIONAIS_TRABALHO,
  MARCA_SUGERIDO,
} from "@/lib/anuncio/sugestoes-cadastro";
import { itensDisponiveis, MAX_FAIXAS, PCT_MAX, type Negociacao, type LimitesPrivados } from "@/lib/anuncio/negociacao";
import { TEXTO_TETO_RODADAS } from "@/lib/propostas/regras";
import { cn, formatBRL } from "@/lib/utils";
import { textoDistancia } from "@/lib/anuncio/proximidades";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { SkeletonLinhas } from "@/components/ui/skeleton";
import { MedirInternet } from "./medir-internet";

/* ── Proximidades automáticas (OSM) ───────────────────────────────────────── */

export const chaveLugar = (l: { tipo?: string | null; nome?: string; name?: string }) => `${l.tipo ?? ""}|${l.nome ?? l.name ?? ""}`;

const ROTULO_CATEGORIA: Record<string, string> = { saude: "Saúde", educacao: "Educação", trabalho: "Trabalho", mercado: "Mercado", transporte: "Transporte" };

/**
 * "O que tem por perto" (prompt 10; PERTO-B): até 3 lugares por categoria achados pelo OpenStreetMap, com a distância
 * CALCULADA (sem minuto estimado). Marcado = mostra no anúncio; desmarcar = "não mostrar". "Está errado" manda um motivo
 * curto que a equipe vê. A mensagem é UMA só: carregando, a lista, "não achamos" (busca feita e vazia) ou "complete o
 * endereço" (busca ainda não feita). Adicionar à mão só o que faltou, com o endereço do lugar.
 */
export function ProximidadesAutomaticas({
  itens,
  carregando,
  buscou,
  desmarcados,
  onAlternar,
  manuais,
  onManuais,
  medir,
  reportar,
}: {
  itens: LugarProximo[] | null;
  carregando: boolean;
  /** A busca já rodou para o endereço atual (com ou sem resultado). */
  buscou: boolean;
  desmarcados: string[];
  onAlternar: (chave: string) => void;
  manuais: Proximity[];
  onManuais: (p: Proximity[]) => void;
  medir: (endereco: string) => Promise<number | null>;
  /** "Está errado": só com o anúncio já salvo (rascunho ou publicado). */
  reportar: ((l: LugarProximo, motivo: string) => Promise<{ ok: boolean; erro?: string }>) | null;
}) {
  const temItens = !carregando && !!itens && itens.length > 0;
  return (
    <div className="rounded-xl border border-sage-200 p-4" data-testid="proximidades-osm">
      <p className="flex items-center gap-2 text-sm font-semibold text-forest">
        <MapPin className="h-4 w-4" aria-hidden /> O que tem por perto
      </p>
      {carregando && <SkeletonLinhas linhas={4} testid="proximidades-carregando" />}
      {temItens && (
        <>
          <p className="mb-3 text-xs text-muted" data-testid="proximidades-achamos">
            Achamos pelo endereço, num raio de 2 km. Desmarque o que não quiser mostrar.
          </p>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {itens!.map((l) => (
              <ItemProximidade key={chaveLugar(l)} lugar={l} marcado={!desmarcados.includes(chaveLugar(l))} onAlternar={() => onAlternar(chaveLugar(l))} reportar={reportar} />
            ))}
          </ul>
        </>
      )}
      {!carregando && !temItens && buscou && (
        <p className="text-sm text-muted" data-testid="proximidades-vazio">
          Não achamos lugares automaticamente. Adicione à mão os que importam.
        </p>
      )}
      {!carregando && !temItens && !buscou && (
        <p className="text-sm text-muted" data-testid="proximidades-aguardando">
          Os lugares por perto aparecem aqui quando o endereço estiver completo (CEP e rua).
        </p>
      )}
      <details className="mt-3" open={!carregando && buscou && !temItens}>
        <summary className="inline-flex cursor-pointer items-center gap-1 text-sm font-medium text-forest">
          <Plus className="h-4 w-4" aria-hidden /> Adicionar outro
        </summary>
        <div className="mt-3">
          <ManualProximities value={manuais} onChange={onManuais} medir={medir} />
        </div>
      </details>
    </div>
  );
}

function ItemProximidade({
  lugar: l,
  marcado,
  onAlternar,
  reportar,
}: {
  lugar: LugarProximo;
  marcado: boolean;
  onAlternar: () => void;
  reportar: ((l: LugarProximo, motivo: string) => Promise<{ ok: boolean; erro?: string }>) | null;
}) {
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [estado, setEstado] = useState<"" | "enviando" | "enviado" | string>("");
  async function enviar() {
    if (!reportar || motivo.trim().length < 3) return;
    setEstado("enviando");
    const r = await reportar(l, motivo.trim()).catch(() => ({ ok: false, erro: "Sem conexão. Tente de novo." }));
    setEstado(r.ok ? "enviado" : (r.erro ?? "Não foi possível enviar agora."));
  }
  return (
    <li className="rounded-lg border border-sage-200" data-testid="proximidade-item-bloco">
      <button
        type="button"
        aria-pressed={marcado}
        onClick={onAlternar}
        data-testid="proximidade-item"
        className={cn("flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm", marcado ? "bg-sage-100" : "text-muted")}
      >
        <span className={cn("mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-lg border", marcado ? "border-forest bg-forest text-white" : "border-sage-200")}>
          {marcado && <Check className="h-3 w-3" />}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-medium text-ink">{l.nome}</span>
          <span className="block text-xs text-muted" data-testid="proximidade-distancia">
            {ROTULO_CATEGORIA[l.categoria] ?? l.categoria} · {textoDistancia(l.distanciaM)}
            {marcado ? "" : " · não aparece no anúncio"}
          </span>
        </span>
      </button>
      {reportar && (
        <div className="px-3 pb-2">
          {estado === "enviado" ? (
            <p className="text-xs text-muted" data-testid="proximidade-reportada">Obrigado. A equipe vai conferir.</p>
          ) : aberto ? (
            <div className="mt-1 flex flex-col gap-2 sm:flex-row">
              <input
                value={motivo}
                onChange={(e) => setMotivo(e.target.value.slice(0, 200))}
                placeholder="O que está errado? (ex.: fechou)"
                aria-label={`O que está errado em ${l.nome}`}
                className="min-w-0 flex-1 rounded-lg border border-sage-200 px-3 py-2 text-sm"
                data-testid="proximidade-errado-motivo"
              />
              <Button type="button" variant="secondary" size="sm" onClick={enviar} disabled={motivo.trim().length < 3 || estado === "enviando"} data-testid="proximidade-errado-enviar">
                Enviar
              </Button>
              {estado && estado !== "enviando" && <p className="text-xs text-red-700" role="alert">{estado}</p>}
            </div>
          ) : (
            <button type="button" onClick={() => setAberto(true)} className="text-xs text-muted underline underline-offset-2 hover:text-ink" data-testid="proximidade-errado">
              Está errado
            </button>
          )}
        </div>
      )}
    </li>
  );
}

/* ── Pronto para trabalhar de casa ────────────────────────────────────────── */

/**
 * Bloco de destaque no topo das comodidades (prompt 10). Os 4 essenciais são os da etiqueta "Para trabalhar de
 * casa" (mesma regra da qualificação); silêncio, iluminação e tomadas são opcionais.
 */
export function ProntoParaTrabalhar({
  marcadas,
  onAlternar,
  sugeridas,
  mbps,
  onMbps,
  imovelId,
}: {
  marcadas: Record<string, boolean>;
  onAlternar: (chave: string) => void;
  sugeridas: string[];
  mbps: string;
  onMbps: (v: string) => void;
  /** Com o rascunho salvo, o dono mede a internet aqui mesmo (Prompt 57). */
  imovelId?: string | null;
}) {
  const n = essenciaisMarcados(marcadas);
  const item = (it: { chave: string; rotulo: string }, essencial: boolean) => {
    const on = !!marcadas[it.chave];
    return (
      <button
        key={it.chave}
        type="button"
        aria-pressed={on}
        onClick={() => onAlternar(it.chave)}
        data-testid={`trabalho-${it.chave}`}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium",
          on ? "border-forest bg-forest text-white" : "border-sage-200 bg-white text-ink hover:border-sage",
        )}
      >
        {on && <Check className="h-3.5 w-3.5" aria-hidden />}
        {it.rotulo}
        {essencial && <span className={on ? "text-white/80" : "text-muted"}> · essencial</span>}
        {sugeridas.includes(it.chave) && on && <span className="sr-only"> ({MARCA_SUGERIDO})</span>}
      </button>
    );
  };
  return (
    <div className="rounded-xl border-2 border-forest/30 bg-sage-50 p-4" data-testid="pronto-trabalhar">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-title text-base font-semibold text-forest">
          <Briefcase className="h-4 w-4" aria-hidden /> Pronto para trabalhar de casa
        </p>
        <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", n === ESSENCIAIS_TRABALHO.length ? "bg-forest text-white" : "bg-white text-forest")} data-testid="trabalho-contador">
          {contadorEssenciais(marcadas)}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted">Profissionais procuram isso primeiro.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {ESSENCIAIS_TRABALHO.map((it) => item(it, true))}
        {OPCIONAIS_TRABALHO.map((it) => item(it, false))}
      </div>
      {marcadas.internet_fibra && (
        <label className="mt-3 block max-w-xs text-sm text-ink">
          Velocidade da internet informada (opcional)
          <span className="mt-1 flex items-center gap-2">
            <input inputMode="numeric" value={mbps} onChange={(e) => onMbps(e.target.value.replace(/\D/g, "").slice(0, 5))} className="input" placeholder="500" aria-label="Velocidade da internet em Mbps" />
            <span className="text-xs text-muted">Mbps</span>
          </span>
        </label>
      )}
      {marcadas.internet_fibra && imovelId && <MedirInternet imovelId={imovelId} origem="cadastro" />}
      <p className="mt-3 text-xs text-muted">
        Com os 4 essenciais, o anúncio pode ganhar a etiqueta “Para trabalhar de casa” na qualificação.
      </p>
    </div>
  );
}

/* ── Negociação (prompt 17, §8) ───────────────────────────────────────────── */

/**
 * "Negociação" na etapa Preço e disponibilidade: aceita negociar? o que pode ser negociado; desconto automático por
 * estadia mais longa; e o limite PRIVADO (só o dono vê; nunca vai ao anúncio).
 */
export function BlocoNegociacao({
  valor,
  onValor,
  limites,
  onLimites,
  valorMensal,
}: {
  valor: Negociacao;
  onValor: (n: Negociacao) => void;
  limites: LimitesPrivados;
  onLimites: (l: LimitesPrivados) => void;
  valorMensal: number;
}) {
  const itens = itensDisponiveis();
  const faixas = valor.descontos;
  const setFaixa = (i: number, campo: "mesesMin" | "pct", v: number) =>
    onValor({ ...valor, descontos: faixas.map((f, j) => (j === i ? { ...f, [campo]: v } : f)) });
  return (
    <div className="rounded-xl border border-sage-200 p-4" data-testid="bloco-negociacao">
      <p className="text-sm font-semibold text-ink">Negociação</p>
      <p className="text-xs text-muted">Quem vai ficar mais tempo costuma pedir condições. Você decide o que dá para negociar.</p>
      <p className="mt-1 text-xs text-muted" data-testid="negociacao-rodadas">
        {TEXTO_TETO_RODADAS}
      </p>

      <div className="mt-3 flex gap-2" role="radiogroup" aria-label="Aceito negociar?">
        {[
          { v: true, r: "Aceito negociar" },
          { v: false, r: "Valor fixo" },
        ].map((o) => (
          <button
            key={o.r}
            type="button"
            role="radio"
            aria-checked={valor.aceita === o.v}
            onClick={() => onValor({ ...valor, aceita: o.v, itens: o.v ? valor.itens : [] })}
            className={cn(
              "flex-1 rounded-lg border px-3 py-2 text-sm font-medium",
              valor.aceita === o.v ? "border-forest bg-forest text-white" : "border-sage-200 text-ink hover:border-sage",
            )}
            data-testid={o.v ? "negociar-sim" : "negociar-nao"}
          >
            {o.r}
          </button>
        ))}
      </div>
      {!valor.aceita && <p className="mt-2 text-xs text-muted">Quem se interessar só pode aceitar ou recusar. O anúncio mostra “Valor fixo”.</p>}

      {valor.aceita && (
        <fieldset className="mt-3">
          <legend className="text-xs font-semibold text-muted">O que pode ser negociado</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {itens.map((i) => {
              const on = valor.itens.includes(i.chave);
              return (
                <button
                  key={i.chave}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onValor({ ...valor, itens: on ? valor.itens.filter((x) => x !== i.chave) : [...valor.itens, i.chave] })}
                  className={cn("rounded-full border px-3 py-2 text-xs font-medium", on ? "border-forest bg-forest text-white" : "border-sage-200 text-ink")}
                  data-testid={`negociavel-${i.chave}`}
                >
                  {i.rotulo}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="mt-4">
        <p className="flex items-center gap-1 text-xs font-semibold text-muted">
          <Percent className="h-3.5 w-3.5" aria-hidden /> Desconto por estadia mais longa (opcional)
        </p>
        <p className="text-xs text-muted">Aplica sozinho na proposta e aparece no anúncio. É sobre o valor mensal.</p>
        <ul className="mt-2 space-y-2" data-testid="faixas-desconto">
          {faixas.map((f, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
              <span>A partir de</span>
              <input type="number" min={2} max={12} value={f.mesesMin} onChange={(e) => setFaixa(i, "mesesMin", Number(e.target.value))} className="input w-20" aria-label={`Meses da faixa ${i + 1}`} />
              <span>meses:</span>
              <input type="number" min={1} max={PCT_MAX} value={f.pct} onChange={(e) => setFaixa(i, "pct", Number(e.target.value))} className="input w-20" aria-label={`Desconto da faixa ${i + 1}`} />
              <span>%</span>
              {valorMensal > 0 && f.pct > 0 && <span className="text-xs text-muted">→ {formatBRL(Math.round(valorMensal * (1 - f.pct / 100)))}/mês</span>}
              <button type="button" onClick={() => onValor({ ...valor, descontos: faixas.filter((_, j) => j !== i) })} className="ml-auto rounded-lg p-1 text-muted hover:text-red-600" aria-label="Remover faixa">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
        {faixas.length < MAX_FAIXAS && (
          <button
            type="button"
            onClick={() => onValor({ ...valor, descontos: [...faixas, { mesesMin: faixas.length ? Math.min(12, faixas[faixas.length - 1].mesesMin + 3) : 3, pct: faixas.length ? faixas[faixas.length - 1].pct + 3 : 3 }] })}
            className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-forest underline"
            data-testid="adicionar-faixa"
          >
            <Plus className="h-4 w-4" aria-hidden /> Adicionar faixa de desconto
          </button>
        )}
      </div>

      {valor.aceita && (
        <div className="mt-4 rounded-lg bg-surface-2 p-3" data-testid="limites-privados">
          <p className="text-xs font-semibold text-ink">Seu limite (privado: só você vê)</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm text-ink">
              Menor valor mensal que aceito (R$)
              <CampoReais
                semPrefixo
                value={limites.valorMinimo}
                onChange={(v) => onLimites({ ...limites, valorMinimo: v != null && v > 0 ? v : null })}
                className="input mt-1"
                placeholder="Ex.: 2.900"
                testid="limite-valor-minimo"
              />
            </label>
            <label className="block text-sm text-ink">
              Limpezas por mês que posso incluir
              <select
                value={limites.limpezasMax == null ? "" : String(limites.limpezasMax)}
                onChange={(e) => onLimites({ ...limites, limpezasMax: e.target.value === "" ? null : Number(e.target.value) })}
                className="input mt-1"
                data-testid="limite-limpezas"
              >
                <option value="">Sem limite</option>
                <option value="0">Nenhuma</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>
                    Até {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="mt-2 text-xs text-muted">
            Abaixo do mínimo, avisamos o interessado sem mostrar o seu número. Você ainda pode aceitar manualmente.
          </p>
        </div>
      )}
    </div>
  );
}
