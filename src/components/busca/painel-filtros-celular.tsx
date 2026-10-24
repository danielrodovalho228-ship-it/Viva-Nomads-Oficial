"use client";

import { useState } from "react";
import {
  FILTROS_PAINEL_VAZIOS,
  OPCOES_ESTADIA,
  OPCOES_PORTE_PET,
  OPCOES_PRECO,
  OPCOES_QUARTOS,
  OPCOES_TIPO,
  rotuloMostrar,
  type FiltrosPainel,
} from "@/lib/busca/painel-filtros";
import { COMODIDADES_FILTRAVEIS } from "@/lib/busca/filtro-comodidades";
import { TEXTO_GARANTIA_MINIMA } from "@/lib/busca/garantia-minima";
import { rotuloVerNaoMedidos } from "@/lib/busca/filtro-internet";
import { ROTULO_DATAS_FLEXIVEIS } from "@/lib/busca/datas-flexiveis";
import { NIVEIS, ROTULO_NIVEL, type Nivel } from "@/config/niveis";
import { TEXTO_SEM_NIVEIS, grupoNivel } from "@/lib/busca/filtro-nivel";
import {
  TEXTO_SEM_INTERNET_MEDIDA,
  faixasInternet,
  facetaComodidade,
  facetaInterruptor,
  facetaPorte,
  facetaUnica,
  secaoInternetVisivel,
  type Faceta,
} from "@/lib/busca/facetas";
import { buttonClasses } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Chip } from "@/components/ui/chip";

/**
 * Folha de filtros da /buscar (ordem 314f764e; Prompt 40): no celular sobe de
 * baixo (bottom-sheet.tsx); no computador é um painel na lateral direita.
 * Edita um RASCUNHO e mostra, ao vivo, quantos imóveis aparecem antes de
 * aplicar ("Mostrar 23 imóveis" usa a MESMA função da lista). "Limpar tudo"
 * (terciário) zera o rascunho. Todas as escolhas são chips: tocar de novo
 * desliga — sem opção "Qualquer", "Ambos", "Indiferente" ou "Tanto faz".
 *
 * Regra de forma por tipo de controle (veredito do coordenador, QA do Prompt 40; guarda em
 * src/lib/estilo/estilo-padrao.test.ts):
 *   - chip de opção = pill (<Chip>, variante "chip");
 *   - campo (número, seleção, data) = 8 px (rounded-lg);
 *   - botão "Mostrar N imóveis" = 8 px (primário de buttonClasses);
 *   - "Limpar tudo" = texto (terciário, sublinhado, sem caixa).
 */
export function FolhaFiltros({
  inicial,
  contar,
  contarNaoMedidos,
  onAplicar,
  onFechar,
  garantias,
  comNotaFiscal = false,
  medicoes = [],
}: {
  inicial: FiltrosPainel;
  contar: (f: FiltrosPainel) => number;
  /** Prompt 57 fase 2: imóveis com internet informada, mas não medida (linha "Mais N…" no fim da lista). */
  contarNaoMedidos?: (f: FiltrosPainel) => number;
  onAplicar: (f: FiltrosPainel) => void;
  onFechar: () => void;
  /** Garantias do filtro público (caução unificada + seguro-fiança). */
  garantias: { key: string; label: string }[];
  /** "Com Nota Fiscal" só com a chave do selo ligada. */
  comNotaFiscal?: boolean;
  /** FILTROS-1 (E40): downloads medidos (Mbps) dos anúncios da busca atual — sem nenhum, a seção de internet some. */
  medicoes?: number[];
}) {
  const [rascunho, setRascunho] = useState<FiltrosPainel>(inicial);
  const n = contar(rascunho);
  const extras = contarNaoMedidos ? contarNaoMedidos(rascunho) : 0;
  // NIVEL-BUSCA-A: contagem ao vivo de cada nível; opção em 0 desabilitada, as três em 0 tiram o grupo.
  const porNivel = Object.fromEntries(NIVEIS.map((v) => [v, contar({ ...rascunho, nivelMin: v })])) as Record<Nivel, number>;
  const nivel = grupoNivel(porNivel, rascunho.nivelMin ?? "");
  // Adendo 3 (E40): a seção só existe com medição na busca; aí as três faixas, cada uma com a contagem.
  const internetVisivel = secaoInternetVisivel(medicoes);
  const faixas = faixasInternet(medicoes);
  const muda = <K extends keyof FiltrosPainel>(k: K, v: FiltrosPainel[K]) => setRascunho((r) => ({ ...r, [k]: v }));
  /** Escolha única: tocar na escolhida desliga o filtro (volta ao valor vazio). */
  const alterna = <K extends "maxPrice" | "minBedrooms" | "periodo" | "tipo" | "petPorte" | "garantia" | "internetMin">(k: K, v: FiltrosPainel[K]) =>
    setRascunho((r) => ({ ...r, [k]: r[k] === v ? FILTROS_PAINEL_VAZIOS[k] : v }));

  return (
    <BottomSheet
      open
      onClose={onFechar}
      title="Filtros"
      lateral
      testId="painel-filtros"
      footer={
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setRascunho(FILTROS_PAINEL_VAZIOS)}
            data-testid="limpar-tudo"
            className={buttonClasses({ variant: "tertiary" })}
          >
            Limpar tudo
          </button>
          <button
            type="button"
            onClick={() => onAplicar(rascunho)}
            disabled={n === 0 && extras === 0}
            data-testid="aplicar-filtros"
            data-total={n}
            data-nao-medidos={extras}
            className={buttonClasses({ className: "min-w-0 flex-1 px-4 tabular-nums sm:flex-none sm:px-6" })}
          >
            {n === 0 && extras > 0 ? rotuloVerNaoMedidos(extras) : <>{rotuloMostrar(n)}</>}
          </button>
          {/* E6: a contagem nunca muda em silêncio — o leitor de tela ouve o novo total a cada escolha. */}
          <span className="sr-only" role="status" aria-live="polite" data-testid="painel-total-anuncio">
            {rotuloMostrar(n)}
          </span>
        </div>
      }
    >
      <div className="space-y-6">
        <Grupo titulo="Preço por mês">
          {OPCOES_PRECO.map((o) => (
            <ChipFaceta key={o.valor} f={facetaUnica(contar, rascunho, "maxPrice", o.valor)} ativo={rascunho.maxPrice === o.valor} onClick={() => alterna("maxPrice", o.valor)} testId={`faceta-preco-${o.valor}`}>
              {o.rotulo}
            </ChipFaceta>
          ))}
        </Grupo>
        <Grupo titulo="Quartos">
          {OPCOES_QUARTOS.map((o) => (
            <ChipFaceta key={o.valor} f={facetaUnica(contar, rascunho, "minBedrooms", o.valor)} ativo={rascunho.minBedrooms === o.valor} onClick={() => alterna("minBedrooms", o.valor)} testId={`faceta-quartos-${o.valor}`}>
              {o.rotulo}
            </ChipFaceta>
          ))}
        </Grupo>
        <Grupo titulo="Estadia" testId="painel-estadia">
          {OPCOES_ESTADIA.map((o) => (
            <ChipFaceta key={o.valor} f={facetaUnica(contar, rascunho, "periodo", o.valor)} ativo={rascunho.periodo === o.valor} onClick={() => alterna("periodo", o.valor)} testId={`faceta-estadia-${o.valor}`}>
              {o.rotulo}
            </ChipFaceta>
          ))}
        </Grupo>
        {/* Prompt 55 B2: a data vem da busca; aqui só a flexibilidade (a contagem acima já a considera). */}
        {rascunho.entrada && (
          <Grupo titulo={`Entrada em ${rascunho.entrada.split("-").reverse().join("/")}`} testId="painel-datas">
            <ChipFaceta f={facetaInterruptor(contar, rascunho, "datasFlexiveis")} ativo={rascunho.datasFlexiveis} onClick={() => muda("datasFlexiveis", !rascunho.datasFlexiveis)} testId="faceta-datas-flexiveis">
              {ROTULO_DATAS_FLEXIVEIS}
            </ChipFaceta>
          </Grupo>
        )}
        <Grupo titulo="Tipo de imóvel" testId="painel-tipo">
          {OPCOES_TIPO.map((o) => (
            <ChipFaceta key={o.valor} f={facetaUnica(contar, rascunho, "tipo", o.valor)} ativo={rascunho.tipo === o.valor} onClick={() => alterna("tipo", o.valor)} testId={`faceta-tipo-${o.valor}`}>
              {o.rotulo}
            </ChipFaceta>
          ))}
        </Grupo>
        <Grupo titulo="Do seu jeito">
          <ChipFaceta f={facetaInterruptor(contar, rascunho, "petsOnly")} ativo={rascunho.petsOnly} onClick={() => setRascunho((r) => ({ ...r, petsOnly: !r.petsOnly, petPorte: "" }))} testId="faceta-pets">
            Aceita pets
          </ChipFaceta>
          <ChipFaceta
            f={facetaInterruptor(contar, rascunho, "homeOfficeOnly")}
            ativo={rascunho.homeOfficeOnly}
            onClick={() => setRascunho((r) => ({ ...r, homeOfficeOnly: !r.homeOfficeOnly, soInternetMedida: r.homeOfficeOnly ? false : r.soInternetMedida }))}
            testId="faceta-home-office"
          >
            Para trabalhar de casa
          </ChipFaceta>
          {/* E43: "Pronto para Morar" mora só aqui (saiu da barra de cima). */}
          <ChipFaceta f={facetaInterruptor(contar, rascunho, "readyToLiveOnly")} ativo={rascunho.readyToLiveOnly} onClick={() => muda("readyToLiveOnly", !rascunho.readyToLiveOnly)} testId="faceta-pronto">
            Pronto para Morar
          </ChipFaceta>
        </Grupo>
        {rascunho.petsOnly && (
          <div data-testid="painel-porte-pet">
            <Grupo titulo="Porte do pet">
              {OPCOES_PORTE_PET.map((o) => (
                <ChipFaceta key={o.valor} f={facetaPorte(contar, rascunho, o.valor)} ativo={rascunho.petPorte === o.valor} onClick={() => alterna("petPorte", o.valor)} testId={`faceta-porte-${o.valor}`}>
                  {o.rotulo}
                </ChipFaceta>
              ))}
            </Grupo>
          </div>
        )}
        {rascunho.homeOfficeOnly && internetVisivel && (
          <Grupo titulo="Para trabalhar de casa" testId="painel-home-office">
            <ChipFaceta f={facetaInterruptor(contar, rascunho, "soInternetMedida")} ativo={rascunho.soInternetMedida} onClick={() => muda("soInternetMedida", !rascunho.soInternetMedida)} testId="faceta-so-medida">
              Só com internet medida
            </ChipFaceta>
          </Grupo>
        )}
        {/* Adendo 59.1: "a partir de" — Conforto mostra Conforto e Premium. A contagem de cada chip é ao vivo, com os
            outros filtros do rascunho. Nível não muda a ordem da lista. */}
        {nivel.visivel ? (
          <Grupo titulo="Nível a partir de" testId="painel-nivel">
            {NIVEIS.map((v) => (
              <Chip
                key={v}
                ativo={rascunho.nivelMin === v}
                disabled={nivel.desabilitado[v]}
                onClick={() => muda("nivelMin", rascunho.nivelMin === v ? "" : v)}
                data-testid={`filtro-nivel-${v}`}
                className="disabled:cursor-not-allowed disabled:opacity-50"
              >
                {ROTULO_NIVEL[v]} <span className="tabular-nums text-muted" data-testid={`filtro-nivel-${v}-n`}>· {porNivel[v]}</span>
              </Chip>
            ))}
          </Grupo>
        ) : (
          <p className="text-sm text-muted" data-testid="painel-nivel-vazio">
            {TEXTO_SEM_NIVEIS}
          </p>
        )}
        {/* E40 (Adendo 3): sem nenhuma medição na busca, a seção some (e o filtro da URL é ignorado na /buscar). */}
        {internetVisivel ? (
          <Grupo titulo="Internet medida a partir de" testId="painel-internet">
            {faixas.map((v) => (
              <ChipFaceta key={v} f={facetaUnica(contar, rascunho, "internetMin", v)} ativo={rascunho.internetMin === v} onClick={() => alterna("internetMin", v)} testId={`faceta-internet-${v}`}>
                {v} Mbps
              </ChipFaceta>
            ))}
          </Grupo>
        ) : (
          <p className="text-sm text-muted" data-testid="painel-internet-vazio">
            {TEXTO_SEM_INTERNET_MEDIDA}
          </p>
        )}
        <Grupo titulo="Contrato" testId="painel-garantia">
          {/* E43: um chip só para seguro-fiança (o antigo chip de seguro era o mesmo critério). */}
          {garantias.map((g) => (
            <ChipFaceta key={g.key} f={facetaUnica(contar, rascunho, "garantia", g.key)} ativo={rascunho.garantia === g.key} onClick={() => alterna("garantia", g.key)} testId={`faceta-garantia-${g.key}`}>
              {g.label}
            </ChipFaceta>
          ))}
          <ChipFaceta f={facetaInterruptor(contar, rascunho, "gestorOnly")} ativo={rascunho.gestorOnly} onClick={() => muda("gestorOnly", !rascunho.gestorOnly)} testId="faceta-gestor">
            Gestor profissional
          </ChipFaceta>
          {comNotaFiscal && (
            <ChipFaceta f={facetaInterruptor(contar, rascunho, "notaOnly")} ativo={rascunho.notaOnly} onClick={() => muda("notaOnly", !rascunho.notaOnly)} testId="faceta-nota">
              Com Nota Fiscal
            </ChipFaceta>
          )}
        </Grupo>
        <Grupo titulo="Comodidades" testId="painel-comodidades">
          {/* FILTROS-2: Cozinha equipada é do padrão mínimo (garantia, não filtro) — a linha abaixo diz isso. Adendo 3
              (E39): Wi-Fi não é mais comodidade; a internet só se filtra pela velocidade medida. */}
          {COMODIDADES_FILTRAVEIS.map((c) => {
            const ligado = rascunho.comodidades.includes(c.chave);
            return (
              <ChipFaceta
                key={c.chave}
                f={facetaComodidade(contar, rascunho, c.chave)}
                ativo={ligado}
                title={c.dica}
                onClick={() => muda("comodidades", ligado ? rascunho.comodidades.filter((x) => x !== c.chave) : [...rascunho.comodidades, c.chave])}
                testId={`faceta-comodidade-${c.chave}`}
              >
                {c.rotulo}
              </ChipFaceta>
            );
          })}
        </Grupo>
        <p className="text-sm text-muted" data-testid="painel-garantia-minima">
          {/* "Wi-Fi" não quebra no hífen em 390 px. */}
          {TEXTO_GARANTIA_MINIMA.split("Wi-Fi").flatMap((t, i) => (i ? [<span key={i} className="whitespace-nowrap">Wi-Fi</span>, t] : [t]))}
        </p>
      </div>
    </BottomSheet>
  );
}

/**
 * FILTROS-1 (E42): chip com a contagem da busca se ele for escolhido ("· 12") e desabilitado em 0 — o mesmo jeito do
 * grupo de níveis. A opção escolhida nunca desabilita (precisa dar para desligar).
 */
function ChipFaceta({
  f,
  ativo,
  onClick,
  testId,
  title,
  children,
}: {
  f: Faceta;
  ativo: boolean;
  onClick: () => void;
  testId: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <Chip ativo={ativo} disabled={f.desabilitado} onClick={onClick} title={title} data-testid={testId} data-n={f.n} className="disabled:cursor-not-allowed disabled:opacity-50">
      {/* O nome acessível continua sendo o rótulo; o total ao vivo é anunciado pelo status do rodapé. */}
      {children} <span aria-hidden="true" className="tabular-nums opacity-70" data-testid={`${testId}-n`}>· {f.n}</span>
    </Chip>
  );
}

function Grupo({ titulo, testId, children }: { titulo: string; testId?: string; children: React.ReactNode }) {
  return (
    <fieldset data-testid={testId}>
      <legend className="mb-3 text-base font-semibold text-ink">{titulo}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}
