/*
  E445 item 5 (tela): regras puras do anexo no chat (navegador e servidor). O servidor confere de novo o tipo real
  pelos primeiros bytes; aqui é só para avisar antes de subir um arquivo que seria recusado.
*/
import { erroDoAnexo, type TipoAnexo } from "./anexos.ts";

const ACEITOS: readonly TipoAnexo[] = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

/** Valor do `accept` do campo de arquivo. */
export const ACEITA_ANEXO = ACEITOS.join(",");

export type TipoNaMensagem = "foto" | "pdf";

export function tipoDaMensagemAnexo(mime: string): TipoNaMensagem {
  return mime === "application/pdf" ? "pdf" : "foto";
}

export function rotuloDoAnexo(tipo: TipoNaMensagem): string {
  return tipo === "pdf" ? "Abrir PDF" : "Abrir foto";
}

/** Abre o anexo pela rota que só as partes alcançam (redireciona para a URL assinada de 10 minutos). */
export function urlDoAnexo(id: string): string {
  return `/api/mensagens/anexo/${id}`;
}

/** Erro para mostrar ANTES de enviar (tamanho e tipo declarado), ou null. */
export function erroAntesDeEnviar(arquivo: { size: number; type: string }): string | null {
  const tipo = (ACEITOS as readonly string[]).includes(arquivo.type) ? (arquivo.type as TipoAnexo) : null;
  return erroDoAnexo(arquivo.size, tipo);
}
