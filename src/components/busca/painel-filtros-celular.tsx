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
import { COMODIDADES_FILTRO } from "@/lib/busca/filtro-comodidades";
import { CHIPS_INTERNET, rotuloVerNaoMedidos } from "@/lib/busca/filtro-internet";
import { ROTULO_DATAS_FLEXIVEIS } from "@/lib/busca/datas-flexiveis";
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
}) {
  const [rascunho, setRascunho] = useState<FiltrosPainel>(inicial);
  const n = contar(rascunho);
  const extras = contarNaoMedidos ? contarNaoMedidos(rascunho) : 0;
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
        </div>
      }
    >
      <div className="space-y-6">
        <Grupo titulo="Preço por mês">
          {OPCOES_PRECO.map((o) => (
            <Chip key={o.valor} ativo={rascunho.maxPrice === o.valor} onClick={() => alterna("maxPrice", o.valor)}>
              {o.rotulo}
            </Chip>
          ))}
        </Grupo>
        <Grupo titulo="Quartos">
          {OPCOES_QUARTOS.map((o) => (
            <Chip key={o.valor} ativo={rascunho.minBedrooms === o.valor} onClick={() => alterna("minBedrooms", o.valor)}>
              {o.rotulo}
            </Chip>
          ))}
        </Grupo>
        <Grupo titulo="Estadia" testId="painel-estadia">
          {OPCOES_ESTADIA.map((o) => (
            <Chip key={o.valor} ativo={rascunho.periodo === o.valor} onClick={() => alterna("periodo", o.valor)}>
              {o.rotulo}
            </Chip>
          ))}
        </Grupo>
        {/* Prompt 55 B2: a data vem da busca; aqui só a flexibilidade (a contagem acima já a considera). */}
        {rascunho.entrada && (
          <Grupo titulo={`Entrada em ${rascunho.entrada.split("-").reverse().join("/")}`} testId="painel-datas">
            <Chip ativo={rascunho.datasFlexiveis} onClick={() => muda("datasFlexiveis", !rascunho.datasFlexiveis)}>
              {ROTULO_DATAS_FLEXIVEIS}
            </Chip>
          </Grupo>
        )}
        <Grupo titulo="Tipo de imóvel" testId="painel-tipo">
          {OPCOES_TIPO.map((o) => (
            <Chip key={o.valor} ativo={rascunho.tipo === o.valor} onClick={() => alterna("tipo", o.valor)}>
              {o.rotulo}
            </Chip>
          ))}
        </Grupo>
        <Grupo titulo="Do seu jeito">
          <Chip ativo={rascunho.petsOnly} onClick={() => setRascunho((r) => ({ ...r, petsOnly: !r.petsOnly, petPorte: "" }))}>
            Aceita pets
          </Chip>
          <Chip
            ativo={rascunho.homeOfficeOnly}
            onClick={() => setRascunho((r) => ({ ...r, homeOfficeOnly: !r.homeOfficeOnly, soInternetMedida: r.homeOfficeOnly ? false : r.soInternetMedida }))}
          >
            Para trabalhar de casa
          </Chip>
          <Chip ativo={rascunho.readyToLiveOnly} onClick={() => muda("readyToLiveOnly", !rascunho.readyToLiveOnly)}>
            Pronto para Morar
          </Chip>
        </Grupo>
        {rascunho.petsOnly && (
          <div data-testid="painel-porte-pet">
            <Grupo titulo="Porte do pet">
              {OPCOES_PORTE_PET.map((o) => (
                <Chip key={o.valor} ativo={rascunho.petPorte === o.valor} onClick={() => alterna("petPorte", o.valor)}>
                  {o.rotulo}
                </Chip>
              ))}
            </Grupo>
          </div>
        )}
        {rascunho.homeOfficeOnly && (
          <Grupo titulo="Para trabalhar de casa" testId="painel-home-office">
            <Chip ativo={rascunho.soInternetMedida} onClick={() => muda("soInternetMedida", !rascunho.soInternetMedida)}>
              Só com internet medida
            </Chip>
          </Grupo>
        )}
        <Grupo titulo="Internet medida a partir de" testId="painel-internet">
          {CHIPS_INTERNET.map((v) => (
            <Chip key={v} ativo={rascunho.internetMin === v} onClick={() => alterna("internetMin", v)}>
              {v} Mbps
            </Chip>
          ))}
        </Grupo>
        <Grupo titulo="Contrato" testId="painel-garantia">
          {garantias.map((g) => (
            <Chip key={g.key} ativo={rascunho.garantia === g.key} onClick={() => alterna("garantia", g.key)}>
              {g.label}
            </Chip>
          ))}
          <Chip ativo={rascunho.seguroOnly} onClick={() => muda("seguroOnly", !rascunho.seguroOnly)}>
            Aceita Seguro-Fiança
          </Chip>
          <Chip ativo={rascunho.gestorOnly} onClick={() => muda("gestorOnly", !rascunho.gestorOnly)}>
            Gestor profissional
          </Chip>
          {comNotaFiscal && (
            <Chip ativo={rascunho.notaOnly} onClick={() => muda("notaOnly", !rascunho.notaOnly)}>
              Com Nota Fiscal
            </Chip>
          )}
        </Grupo>
        <Grupo titulo="Comodidades" testId="painel-comodidades">
          {COMODIDADES_FILTRO.map((c) => {
            const ligado = rascunho.comodidades.includes(c.chave);
            return (
              <Chip
                key={c.chave}
                ativo={ligado}
                title={c.dica}
                onClick={() => muda("comodidades", ligado ? rascunho.comodidades.filter((x) => x !== c.chave) : [...rascunho.comodidades, c.chave])}
              >
                {c.rotulo}
              </Chip>
            );
          })}
        </Grupo>
      </div>
    </BottomSheet>
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
