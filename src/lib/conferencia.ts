/*
  Conferência de entrada e de saída (ordem 404cd213, item 1) — regras puras, sem banco.
  As duas partes (proprietário e inquilino) registram cômodos, itens e fotos; cada uma
  confirma ou contesta uma vez; depois da primeira resposta nada mais muda.
  O banco repete estas regras (migração 0110); aqui ficam testáveis.
*/

export type TipoConferencia = "entrada" | "saida";
export type ParteConferencia = "proprietario" | "inquilino";
export type EstadoConferencia = "em_andamento" | "aguardando_outra_parte" | "confirmada" | "contestada";

export interface RespostaConferencia {
  parte: ParteConferencia;
  decisao: "confirmou" | "contestou";
  motivo: string | null;
}

/** A conferência de entrada vale até 48 h depois do início do contrato. */
export const JANELA_ENTRADA_HORAS = 48;
export const DESCRICAO_MAX = 300;
export const MOTIVO_MAX = 1000;

export function prazoEntrada(inicioContrato: string | Date): Date {
  return new Date(new Date(inicioContrato).getTime() + JANELA_ENTRADA_HORAS * 3600_000);
}

export function estadoConferencia(respostas: RespostaConferencia[]): EstadoConferencia {
  if (respostas.some((r) => r.decisao === "contestou")) return "contestada";
  if (respostas.length === 0) return "em_andamento";
  return new Set(respostas.map((r) => r.parte)).size >= 2 ? "confirmada" : "aguardando_outra_parte";
}

/** Imutável depois de confirmado ou contestado: itens só mudam antes da primeira resposta. */
export function podeEditarItens(respostas: RespostaConferencia[]): boolean {
  return respostas.length === 0;
}

export type Decisao = { ok: true; motivo: string | null } | { ok: false; erro: string };

export function decidirResposta(p: {
  respostas: RespostaConferencia[];
  parte: ParteConferencia;
  decisao: "confirmou" | "contestou";
  motivo: string;
  qtdItens: number;
}): Decisao {
  if (p.respostas.some((r) => r.parte === p.parte)) return { ok: false, erro: "Você já respondeu esta conferência e ela não pode mais ser alterada." };
  if (p.qtdItens < 1) return { ok: false, erro: "Registre ao menos um item antes de responder." };
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

/** Laudo de parceiro independente: PDF de verdade, até 15 MB. */
export function validarLaudo(a: { bytes: Uint8Array; tamanho: number }): ArquivoValidado {
  if (a.tamanho <= 0) return { ok: false, erro: "Arquivo vazio." };
  if (a.tamanho > LAUDO_MAX_BYTES) return { ok: false, erro: "O laudo deve ter até 15 MB." };
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
