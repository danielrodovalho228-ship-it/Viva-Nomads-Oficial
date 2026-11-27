/*
  E516 (QA de cliques do proprietário, 02/11) — abrir o assistente atualizava "Salvo às …" sem nenhuma edição: aplicar o
  rascunho carregado mudava o estado do formulário, o JSON do autosave mudava e, 2 s depois, o autosave gravava e
  carimbava a hora. Regra: só uma mudança de CONTEÚDO conta como salvamento visível. A navegação entre passos (passo
  atual, o mais longe visitado, a versão da ordem) segue gravada em silêncio, sem mexer no "Salvo às". PURO.
  Roda: node --test src/lib/anuncio/salvo-fantasma.test.ts
*/

/** Campos de navegação do JSON do rascunho: gravados, mas não são "edição". */
/** E614: `confirmados` também — o "Continuar" confirma o valor pronto (preço, garantia, período) sem editar nada. */
export const CAMPOS_DE_NAVEGACAO = ["step", "etapaMax", "ordemEtapas", "confirmados"] as const;

/** O conteúdo do rascunho sem os campos de navegação (para comparar com o que já estava salvo). */
export function conteudoDoRascunho(json: string): string {
  try {
    const o = JSON.parse(json) as Record<string, unknown>;
    for (const k of CAMPOS_DE_NAVEGACAO) delete o[k];
    return JSON.stringify(o);
  } catch {
    return json;
  }
}

export type DecisaoAutosave = "base" | "silencioso" | "edicao";

/**
 * O que fazer com uma mudança do JSON do rascunho:
 *  - "base": o rascunho acabou de ser aberto (aplicado) e ninguém mexeu — esse estado é o ponto de partida; não grava
 *    nem carimba (se a pessoa já digitou/marcou algo nesse meio-tempo, é "edicao"; se só confirmou um valor pronto
 *    com o Continuar, é "silencioso" — E614: a confirmação tem de chegar ao servidor);
 *  - "silencioso": só a navegação mudou — grava sem mostrar "Salvando…"/"Salvo às";
 *  - "edicao": o conteúdo mudou — grava e mostra "Salvo às …".
 */
export function decisaoAutosave(i: { aguardandoBase: boolean; editou?: boolean; confirmou?: boolean; navegou?: boolean; base: string | null; conteudo: string }): DecisaoAutosave {
  // Uma edição real (digitar, marcar) logo depois de abrir não é engolida pela base: vale como edição.
  // E614: uma confirmação (Continuar) nesse meio-tempo também não é engolida: grava em silêncio.
  // E614 (retoma): nem a navegação — trocar de passo antes de o rascunho aberto assentar grava o passo em silêncio
  // (antes virava base e o passo retomado não persistia).
  if (i.aguardandoBase) return i.editou ? "edicao" : i.confirmou || i.navegou ? "silencioso" : "base";
  if (i.base !== null && i.conteudo === i.base) return "silencioso";
  return "edicao";
}

/**
 * E614 (regra do Gerente, DUET-1719): o rascunho retomado mostra sempre "Salvo às HH:MM" da última gravação — também
 * no Passo 3 e sem nenhuma edição. Cada gravação carimba `salvoEm` (ISO) no draft_data; aqui vira a hora do indicador,
 * no fuso dado (o do navegador quando omitido). Sem carimbo válido (rascunho anterior à regra): null.
 */
export function salvoAsDoRascunho(d: { salvoEm?: unknown }, timeZone?: string): string | null {
  if (typeof d.salvoEm !== "string") return null;
  const t = Date.parse(d.salvoEm);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", ...(timeZone ? { timeZone } : {}) });
}

/** Carimbo utilizável: uma data ISO que o navegador sabe ler. */
function carimboValido(v: unknown): v is string {
  return typeof v === "string" && Number.isFinite(Date.parse(v));
}

/**
 * E614 (ORDEM-DUET-137/139): o rascunho sem `salvoEm` (anterior à regra, ou gravado por outro caminho) reabria sem
 * "Salvo às". A hora que se conhece dele vem da linha do imóvel: a da última gravação (`updated_at`, 0346) e, enquanto
 * a linha não for regravada, a da criação (`created_at`, a primeira gravação). Vale até a próxima gravação carimbar a
 * verdadeira. Com carimbo válido, nada muda. Devolve uma cópia: abrir não altera o rascunho gravado (E516).
 */
export function rascunhoComHoraConhecida(draft: unknown, atualizadoEm: string | null | undefined, criadoEm?: string | null): unknown {
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) return draft;
  if (carimboValido((draft as { salvoEm?: unknown }).salvoEm)) return draft;
  const hora = carimboValido(atualizadoEm) ? atualizadoEm : carimboValido(criadoEm) ? criadoEm : null;
  return hora ? { ...(draft as Record<string, unknown>), salvoEm: hora } : draft;
}

/**
 * E614 (ORDEM-DUET-137): toda gravação do rascunho sai do servidor com a hora, venha de onde vier — o rascunho criado
 * ao sair da Qualificação nascia sem carimbo (só o autosave carimbava). O carimbo que a tela já manda fica como veio.
 */
export function rascunhoCarimbado(data: unknown, agora: Date): unknown {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data;
  if (carimboValido((data as { salvoEm?: unknown }).salvoEm)) return data;
  return { ...(data as Record<string, unknown>), salvoEm: agora.toISOString() };
}

/**
 * E614 (ORDEM-DUET-137): o autosave não cria no servidor um anúncio ainda vazio — mas, se o rascunho JÁ existe lá
 * (nasceu na Qualificação, ou foi reaberto), grava mesmo sem conteúdo: é assim que o passo em que o dono está chega ao
 * servidor. Antes, o rascunho só com o tipo escolhido nunca gravava o passo e a retoma voltava ao Passo 1.
 */
export function autosaveSemNadaAGravar(i: { vazio: boolean; rascunhoNoServidor: boolean }): boolean {
  return i.vazio && !i.rascunhoNoServidor;
}

/**
 * E1034 (ORDEM-DUET-174): o rascunho aberto veio SEM o estado do editor (`draft_data` nulo)? É a linha que só tem as
 * colunas e as fotos (criada por outro caminho que não o autosave). O formulário abre vazio, mas o rascunho não é vazio.
 */
export function rascunhoAbertoSemDados(draft: unknown): boolean {
  return !draft || typeof draft !== "object";
}

/**
 * E1034 (ORDEM-DUET-174): o formulário vazio de um rascunho aberto sem `draft_data` não é o conteúdo dele: gravá-lo
 * regravava a linha inteira (título, preço, bairro, quartos, banheiros, área, descrição) e apagava as fotos, só por
 * abrir o assistente. Não grava por cima. A regra do E614 (o rascunho só com o tipo grava o passo) segue valendo: esse
 * rascunho tem `draft_data`.
 */
export function formularioVazioNaoEDoRascunho(i: { vazio: boolean; abertoSemDados: boolean }): boolean {
  return i.vazio && i.abertoSemDados;
}

/**
 * E614 (ORDEM-DUET-139, condição b): a cópia do rascunho no navegador também leva a hora — é a outra fonte da retoma
 * ("Continuar de onde parei" sem rascunho no servidor). Se o conteúdo é o mesmo que já estava guardado, a cópia fica
 * como estava, com a hora dela: reabrir a tela não carimba (E516).
 */
export function copiaLocalCarimbada(draftJson: string, anterior: string | null, agora: Date): string {
  try {
    const a = anterior ? (JSON.parse(anterior) as Record<string, unknown> | null) : null;
    if (a && typeof a === "object" && carimboValido(a.salvoEm)) {
      const semHora = { ...a };
      delete semHora.salvoEm;
      if (JSON.stringify(semHora) === draftJson) return anterior as string;
    }
  } catch {
    /* cópia antiga ilegível: vale a nova, carimbada */
  }
  try {
    const novo = JSON.parse(draftJson) as unknown;
    if (!novo || typeof novo !== "object" || Array.isArray(novo)) return draftJson;
    return JSON.stringify({ ...(novo as Record<string, unknown>), salvoEm: agora.toISOString() });
  } catch {
    return draftJson;
  }
}

/**
 * E985: os controles de ESCOLHA do assistente (cartões, opções, interruptores) são botões: o clique não dispara
 * input/change. Sem isto, escolher um cartão nos 2 s depois de abrir o rascunho virava "base" e não era gravado.
 */
export const SELETOR_ESCOLHA = '[role="radio"],[role="checkbox"],[role="switch"],[aria-pressed]';

/** O clique caiu num controle de escolha (ou dentro dele)? */
export function cliqueEhEscolha(alvo: { closest?: (s: string) => unknown } | null | undefined): boolean {
  return !!alvo && typeof alvo.closest === "function" && !!alvo.closest(SELETOR_ESCOLHA);
}
