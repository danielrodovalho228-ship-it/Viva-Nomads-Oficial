/**
 * Padrão E56 (Daniel, 23/10): bloco condicional/opcional do formulário do anúncio. Puro: sem tela.
 *   1. nasce FECHADO atrás de um toggle claro;
 *   2. ligar abre o grupo inteiro;
 *   3. com dados salvos nasce ABERTO;
 *   4. desligar com dados pede confirmação (e, confirmado, os dados do grupo saem no próximo salvamento).
 * No medidor de completude, bloco desligado é "não se aplica" (não conta nem como feito nem como falta).
 */

/** 1 + 3: o estado inicial do toggle vem só de haver dado salvo. */
export function nasceLigado(temDadosSalvos: boolean): boolean {
  return temDadosSalvos;
}

export type AcaoToggle = "ligar" | "desligar" | "confirmar";

/** 2 + 4: o que acontece ao tocar no toggle. Desligar um bloco com dados preenchidos pede confirmação antes. */
export function aoTocarToggle(ligado: boolean, temDados: boolean): AcaoToggle {
  if (!ligado) return "ligar";
  return temDados ? "confirmar" : "desligar";
}

export interface EstadoBloco {
  chave: string;
  ligado: boolean;
  /** Ligado e com o mínimo do grupo preenchido (cada bloco diz o que é "preenchido"). */
  preenchido: boolean;
}

export interface CompletudeBlocos {
  /** Ligados e preenchidos. */
  feitos: number;
  /** Ligados ainda sem o mínimo. */
  faltam: number;
  /** Desligados: não se aplica — fora da conta. */
  naoSeAplica: number;
  /** 0–100 sobre os ligados; sem nenhum ligado, 100 (nada a fazer). */
  pct: number;
}

export function completudeBlocos(blocos: EstadoBloco[]): CompletudeBlocos {
  const ligados = blocos.filter((b) => b.ligado);
  const feitos = ligados.filter((b) => b.preenchido).length;
  const naoSeAplica = blocos.length - ligados.length;
  return {
    feitos,
    faltam: ligados.length - feitos,
    naoSeAplica,
    pct: ligados.length === 0 ? 100 : Math.round((feitos / ligados.length) * 100),
  };
}

/** Linha do medidor: "2 de 3 preenchidos · 3 não se aplicam". */
export function textoCompletude(c: CompletudeBlocos): string {
  const ligados = c.feitos + c.faltam;
  const partes: string[] = [];
  if (ligados > 0) partes.push(`${c.feitos} de ${ligados} ${ligados === 1 ? "preenchido" : "preenchidos"}`);
  else partes.push("Nenhum detalhe opcional ligado");
  if (c.naoSeAplica > 0) partes.push(`${c.naoSeAplica} não ${c.naoSeAplica === 1 ? "se aplica" : "se aplicam"}`);
  return partes.join(" · ");
}
