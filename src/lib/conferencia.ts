/*
  Conferência de entrada e de saída (ordem 404cd213, item 1) — regras puras, sem banco.
  As duas partes (proprietário e inquilino) registram cômodos, itens e fotos; cada uma
  confirma ou contesta uma vez. Os itens de cada parte congelam quando ela responde; tudo
  congela quando as duas respondem. Confirmar = responder ao registro da OUTRA parte (Prompt 35B, Opção B):
  os itens próprios são opcionais; só se responde depois que a outra parte registrou ao menos 1 item
  (ou, na entrada, depois do prazo) — ordem 99c7c1e0.
  O banco repete as regras de imutabilidade (migração 0110); aqui ficam testáveis.
*/
import { ETIQUETA_BRASILIA, horaBRT, instanteBRT, dataBRT } from "./datas-brasilia.ts";

export type TipoConferencia = "entrada" | "saida";
export type ParteConferencia = "proprietario" | "inquilino";
export type EstadoConferencia = "em_andamento" | "aguardando_outra_parte" | "confirmada" | "contestada";

export interface RespostaConferencia {
  parte: ParteConferencia;
  decisao: "confirmou" | "contestou";
  motivo: string | null;
}

/** A conferência de entrada vale até 48 h depois da entrada (dia de início + horário de entrada do imóvel). */
export const JANELA_ENTRADA_HORAS = 48;
export const DESCRICAO_MAX = 300;
export const MOTIVO_MAX = 1000;

/** Dia de início do contrato (AAAA-MM-DD, 1º bloco) e o horário de entrada do imóvel ("15:00"; vazio = 00:00). */
export interface EntradaDoContrato {
  inicio: string | null;
  checkinAfter?: string | null;
}

const HORA_ENTRADA = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * FONTE ÚNICA do prazo da conferência de entrada (Prompt 35B, F2): o INSTANTE em que o relógio de Brasília marca
 * o dia de início no horário de entrada do imóvel (00:00 sem horário), mais 48 h. A seção da conferência, a linha
 * do tempo, o bloqueio do servidor e `janelaEncerrada` usam esta função — nunca outra conta.
 */
export function prazoConferenciaEntrada(p: EntradaDoContrato): Date | null {
  const dia = (p.inicio ?? "").slice(0, 10);
  const hora = (p.checkinAfter ?? "").trim();
  const base = instanteBRT(dia, HORA_ENTRADA.test(hora) ? hora : "00:00");
  return base ? new Date(base.getTime() + JANELA_ENTRADA_HORAS * 3600_000) : null;
}

/** "até 20/10 às 15:00, horário de Brasília" — o mesmo texto na seção e na linha do tempo. */
export function textoPrazoConferencia(prazo: Date | string | null): string {
  if (!prazo) return "";
  const ddmm = dataBRT(prazo).slice(0, 5);
  return `até ${ddmm} às ${horaBRT(prazo)}, ${ETIQUETA_BRASILIA}`;
}

export function estadoConferencia(respostas: RespostaConferencia[]): EstadoConferencia {
  if (respostas.some((r) => r.decisao === "contestou")) return "contestada";
  if (respostas.length === 0) return "em_andamento";
  return new Set(respostas.map((r) => r.parte)).size >= 2 ? "confirmada" : "aguardando_outra_parte";
}

/** Os itens de uma parte mudam até ela responder; quando as duas respondem, nada mais muda. */
export function podeEditarItens(respostas: RespostaConferencia[], parte: ParteConferencia): boolean {
  const partes = new Set(respostas.map((r) => r.parte));
  return !partes.has(parte) && partes.size < 2;
}

/** A janela de 48 h só existe na entrada; na saída ninguém "perde o prazo" de registrar. */
export function janelaEncerrada(tipo: TipoConferencia, entrada: EntradaDoContrato | null, agora: Date = new Date()): boolean {
  if (tipo !== "entrada" || !entrada) return false;
  const prazo = prazoConferenciaEntrada(entrada);
  return prazo !== null && agora.getTime() > prazo.getTime();
}

/** A outra parte da conferência. */
export function outraParte(parte: ParteConferencia): ParteConferencia {
  return parte === "inquilino" ? "proprietario" : "inquilino";
}

const DA_PARTE: Record<ParteConferencia, string> = { proprietario: "do proprietário", inquilino: "do inquilino" };

/** Texto do botão: "Confirmar o registro do proprietário". */
export function rotuloConfirmar(minhaParte: ParteConferencia): string {
  return `Confirmar o registro ${DA_PARTE[outraParte(minhaParte)]}`;
}

/** Ajuda ao lado do botão (F1): confirmar responde ao registro da outra parte; os próprios itens são opcionais. */
export function ajudaConfirmar(minhaParte: ParteConferencia): string {
  return `${rotuloConfirmar(minhaParte)}. Seus próprios itens são opcionais.`;
}

export const ERRO_ANTES_DA_OUTRA_PARTE = "Você só pode responder depois que a outra parte registrar ao menos um item.";

/**
 * A parte já pode responder? Depois de a outra registrar ao menos 1 item, ou com a janela de entrada encerrada.
 * Também quando a outra parte JÁ respondeu: os itens dela congelaram (podeEditarItens), então esperar por eles
 * travaria a conferência — na saída, que não tem prazo, para sempre.
 */
export function podeResponder(p: {
  parte: ParteConferencia;
  itensPorParte: Record<ParteConferencia, number>;
  janelaEncerrada?: boolean;
  respostas?: RespostaConferencia[];
}): boolean {
  const outra = outraParte(p.parte);
  return !!p.janelaEncerrada || p.itensPorParte[outra] >= 1 || (p.respostas ?? []).some((r) => r.parte === outra);
}

export type EstadoConferenciaLista = EstadoConferencia | "nao_aberta";

/** Rótulo único do estado (seção da conferência, admin do contrato e coluna da lista do admin). */
export const ROTULO_ESTADO_CONFERENCIA: Record<EstadoConferenciaLista, string> = {
  nao_aberta: "Não aberta",
  em_andamento: "Em andamento",
  aguardando_outra_parte: "Aguardando a outra parte",
  confirmada: "Confirmada pelas duas partes",
  contestada: "Contestada",
};

/** Estado da conferência para a lista do admin: sem conferência criada = "Não aberta". */
export function estadoConferenciaLista(aberta: boolean, respostas: RespostaConferencia[]): EstadoConferenciaLista {
  return aberta ? estadoConferencia(respostas) : "nao_aberta";
}

export type Decisao = { ok: true; motivo: string | null } | { ok: false; erro: string };

export function decidirResposta(p: {
  respostas: RespostaConferencia[];
  parte: ParteConferencia;
  decisao: "confirmou" | "contestou";
  motivo: string;
  /** Itens já registrados por cada parte. */
  itensPorParte: Record<ParteConferencia, number>;
  /** Entrada com a janela de 48 h fechada: dá para responder mesmo que a outra parte não tenha registrado (e sem itens próprios). */
  janelaEncerrada?: boolean;
}): Decisao {
  if (p.respostas.some((r) => r.parte === p.parte)) return { ok: false, erro: "Você já respondeu esta conferência e ela não pode mais ser alterada." };
  // Opção B (Prompt 35B, F1): os itens próprios são opcionais; só a outra parte precisa ter registrado (ou o prazo acabou).
  if (!podeResponder(p)) return { ok: false, erro: ERRO_ANTES_DA_OUTRA_PARTE };
  const motivo = p.motivo.trim();
  if (p.decisao === "contestou") {
    if (!motivo) return { ok: false, erro: "Conte o motivo da contestação." };
    if (motivo.length > MOTIVO_MAX) return { ok: false, erro: `O motivo deve ter até ${MOTIVO_MAX} caracteres.` };
    return { ok: true, motivo };
  }
  return { ok: true, motivo: null };
}

export type ValidacaoItem = { ok: true } | { ok: false; erro: string };

/** Foto precisa estar na pasta de quem enviou (caminho `<uid>/arquivo`), sem sair dela. */
const CAMINHO_FOTO = /^[0-9a-zA-Z-]+\/[0-9a-zA-Z._-]+$/;

export function validarItem(i: { comodo: string; descricao: string; fotoPath: string | null }): ValidacaoItem {
  if (!i.comodo.trim()) return { ok: false, erro: "Informe o cômodo." };
  if (i.comodo.trim().length > 60) return { ok: false, erro: "O nome do cômodo deve ter até 60 caracteres." };
  if (!i.descricao.trim()) return { ok: false, erro: "Descreva o item ou o estado do cômodo." };
  if (i.descricao.trim().length > DESCRICAO_MAX) return { ok: false, erro: `A descrição deve ter até ${DESCRICAO_MAX} caracteres.` };
  if (i.fotoPath !== null && (!CAMINHO_FOTO.test(i.fotoPath) || i.fotoPath.includes(".."))) return { ok: false, erro: "Foto inválida." };
  return { ok: true };
}

/* ---- Laudo independente e foto por cômodo (ordem d3c60126) ---- */

export const LAUDO_MAX_BYTES = 15 * 1024 * 1024; // 15 MB
export const FOTO_CONFERENCIA_MAX_BYTES = 8 * 1024 * 1024; // 8 MB

export type ArquivoValidado = { ok: true; tipo: string; ext: string } | { ok: false; erro: string };

const ehPdf = (b: Uint8Array) => b.length >= 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46; // "%PDF"

/** Tipo REAL da foto pelos primeiros bytes (a extensão e o Content-Type declarados não valem). */
function tipoFoto(b: Uint8Array): { tipo: string; ext: string } | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { tipo: "image/jpeg", ext: "jpg" };
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return { tipo: "image/png", ext: "png" };
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return { tipo: "image/webp", ext: "webp" };
  return null;
}

export const ERRO_LAUDO_GRANDE = "O laudo deve ter até 15 MB.";

/** Confere o tamanho antes de enviar: acima do limite do corpo das Server Actions o Next recusa sem chegar à validação. */
export function erroTamanhoLaudo(tamanho: number): string | null {
  if (tamanho <= 0) return "Arquivo vazio.";
  return tamanho > LAUDO_MAX_BYTES ? ERRO_LAUDO_GRANDE : null;
}

/** Laudo de parceiro independente: PDF de verdade, até 15 MB. */
export function validarLaudo(a: { bytes: Uint8Array; tamanho: number }): ArquivoValidado {
  const tam = erroTamanhoLaudo(a.tamanho);
  if (tam) return { ok: false, erro: tam };
  if (!ehPdf(a.bytes)) return { ok: false, erro: "Envie o laudo em PDF." };
  return { ok: true, tipo: "application/pdf", ext: "pdf" };
}

/** Foto do cômodo: JPG, PNG ou WebP, até 8 MB. */
export function validarFotoConferencia(a: { bytes: Uint8Array; tamanho: number }): ArquivoValidado {
  if (a.tamanho <= 0) return { ok: false, erro: "Arquivo vazio." };
  if (a.tamanho > FOTO_CONFERENCIA_MAX_BYTES) return { ok: false, erro: "A foto deve ter até 8 MB." };
  const t = tipoFoto(a.bytes);
  if (!t) return { ok: false, erro: "Envie a foto em JPG, PNG ou WebP." };
  return { ok: true, ...t };
}

/** Quando existe laudo independente, ele prevalece sobre as fotos das partes. */
export function fonteDaConferencia(temLaudo: boolean): "fotos" | "laudo_independente" {
  return temLaudo ? "laudo_independente" : "fotos";
}

/** Item de cômodo como a tela o mostra (foto já com link temporário). */
export type ItemTela = {
  id: string;
  parte: ParteConferencia;
  comodo: string;
  descricao: string;
  fotoUrl: string | null;
  criadoEm: string;
};

/**
 * Junta os itens vindos do servidor com os que a própria pessoa acabou de registrar.
 * O item novo aparece na hora, sem esperar a página recarregar; quando o servidor já o
 * traz, vale a versão do servidor (sem repetir). Ordem: do mais antigo para o mais novo.
 */
export function mesclarItens(servidor: ItemTela[], locais: ItemTela[]): ItemTela[] {
  const ids = new Set(servidor.map((i) => i.id));
  return [...servidor, ...locais.filter((i) => !ids.has(i.id))].sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
}

/** Laudo como a tela o mostra (o link temporário só vem do servidor, depois do refresh). */
export type LaudoTela = { url: string | null; parte: ParteConferencia; criadoEm: string };

/** O laudo recém-anexado aparece na hora; quando o servidor já o traz, vale o do servidor (com o link do PDF). */
export function mesclarLaudo(servidor: LaudoTela | null, local: LaudoTela | null): LaudoTela | null {
  return servidor ?? local;
}

/** Resposta como a tela a mostra (com a hora em que foi dada). */
export type RespostaTela = RespostaConferencia & { decididoEm: string };

/**
 * Junta as respostas do servidor com a que a própria pessoa acabou de dar, para o estado
 * ("Aguardando a outra parte") mudar na hora. Uma resposta por parte; vale a do servidor.
 */
export function mesclarRespostas(servidor: RespostaTela[], locais: RespostaTela[]): RespostaTela[] {
  const partes = new Set(servidor.map((r) => r.parte));
  return [...servidor, ...locais.filter((r) => !partes.has(r.parte))];
}
