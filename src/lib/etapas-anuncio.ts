/*
  Editor de anúncio — quais etapas do topo podem ser clicadas (bug 13 da L2).
  Voltar e pular para etapas JÁ VISITADAS é livre; avançar para uma etapa nova
  só pelo "Continuar" (que valida). A etapa mais avançada fica no rascunho,
  para a retomada não travar o que a pessoa já tinha percorrido. PURO.
*/

export function etapaMaisAvancada(anterior: number, ...atuais: number[]): number {
  return Math.max(anterior, ...atuais.filter((n) => Number.isFinite(n)));
}

export function etapaLiberada(i: number, atual: number, maisAvancada: number): boolean {
  return i <= Math.max(atual, maisAvancada);
}

/** Lê a etapa mais avançada de um rascunho salvo (antigos não têm: vale a etapa atual). */
export function etapaMaxDoRascunho(d: { step?: unknown; etapaMax?: unknown }, ultima: number): number {
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.min(ultima, Math.max(0, Math.round(v))) : 0);
  return Math.max(n(d.step), n(d.etapaMax));
}

/*
  "Fotos primeiro" (ordem 04e2fe5e, parte 1). As etapas têm um ID estável (o
  número que o rascunho já guarda em `step`): 0 Tipo, 1 Endereço, 2 Detalhes,
  3 Fotos, 4 Comodidades, 5 Preço, 6 Revisão. O que muda é só a ORDEM em que a
  pessoa as percorre: começa pelas fotos e deixa o que exige documento
  (qualificação, termo) para a Revisão, no fim. `etapaMax` passa a ser uma
  POSIÇÃO nesta ordem. PURO.
*/
export const ORDEM_ETAPAS = [3, 0, 2, 4, 1, 5, 6] as const;
/** Versão da ordem gravada no rascunho (rascunhos antigos não têm: ordem 1 = ids em sequência). */
export const VERSAO_ORDEM_ETAPAS = 2;

/** Posição (0..6) de uma etapa na ordem nova; id desconhecido cai na primeira. */
export function posicaoDaEtapa(id: number): number {
  const p = (ORDEM_ETAPAS as readonly number[]).indexOf(id);
  return p < 0 ? 0 : p;
}

/** ID da etapa numa posição (limitada ao intervalo válido). */
export function etapaNaPosicao(pos: number): number {
  const p = Math.min(ORDEM_ETAPAS.length - 1, Math.max(0, Math.round(Number.isFinite(pos) ? pos : 0)));
  return ORDEM_ETAPAS[p];
}

/** Etapa (ID) válida vinda de um rascunho; qualquer outra coisa vira a primeira da ordem. */
export function etapaDoRascunho(d: { step?: unknown }): number {
  const s = d.step;
  if (typeof s !== "number" || !Number.isFinite(s)) return ORDEM_ETAPAS[0];
  const id = Math.round(s);
  return (ORDEM_ETAPAS as readonly number[]).includes(id) ? id : ORDEM_ETAPAS[0];
}

/**
 * Posição mais avançada já visitada, lida de um rascunho. Rascunho novo
 * (`ordemEtapas` = 2) já guarda posição; o antigo guardava o ID mais alto
 * visitado em ordem sequencial — vale a maior posição entre os IDs até ele.
 */
export function posMaxDoRascunho(d: { step?: unknown; etapaMax?: unknown; ordemEtapas?: unknown }): number {
  const ultima = ORDEM_ETAPAS.length - 1;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.min(ultima, Math.max(0, Math.round(v))) : 0);
  const atual = posicaoDaEtapa(etapaDoRascunho(d));
  if (d.ordemEtapas === VERSAO_ORDEM_ETAPAS) return Math.max(atual, n(d.etapaMax));
  if (typeof d.etapaMax !== "number" || !Number.isFinite(d.etapaMax)) return atual;
  let maior = atual;
  for (let id = 0; id <= n(d.etapaMax); id++) maior = Math.max(maior, posicaoDaEtapa(id));
  return maior;
}
