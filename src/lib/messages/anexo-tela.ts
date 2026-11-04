/*
  E445 item 5 (tela, Pista A): anexar foto ou PDF na conversa e a prévia na bolha. PURO.
  O backend é da Pista B (0288, src/app/api/mensagens/anexo, src/lib/messages/anexos.ts): tipo real pelos primeiros
  bytes, bucket privado, URL assinada só para as partes. Aqui só o que a tela decide ANTES de enviar e como mostrar.
  Roda: node --test src/lib/messages/anexo-tela.test.ts
*/
import { ANEXO_MAX_BYTES, erroDoAnexo, type TipoAnexo } from "./anexos.ts";

export const ROTA_ENVIAR_ANEXO = "/api/mensagens/anexo";
const TIPOS: readonly TipoAnexo[] = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
/** O `accept` do seletor de arquivo. */
export const ACEITA_ANEXO = TIPOS.join(",");

export type TipoNaTela = "foto" | "pdf";
export interface AnexoNaBolha {
  id: string;
  tipo: TipoNaTela;
}

export function tipoNaTela(mime: string): TipoNaTela | null {
  if (mime === "application/pdf") return "pdf";
  return TIPOS.includes(mime as TipoAnexo) ? "foto" : null;
}

/** Validação da tela pelo tipo declarado e o tamanho (o servidor confere de novo pelos bytes). Mesmas mensagens. */
export function validarAnexoNaTela(f: { size: number; type: string }): string | null {
  const tipo = TIPOS.includes(f.type as TipoAnexo) ? (f.type as TipoAnexo) : null;
  if (f.size > ANEXO_MAX_BYTES) return erroDoAnexo(f.size, tipo ?? "application/pdf");
  return erroDoAnexo(f.size, tipo);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** O anexo abre só pela rota do servidor (redireciona para URL assinada de 10 min, só para as partes). */
export function urlDoAnexo(id: string): string {
  if (!UUID.test(id)) throw new Error("anexo inválido");
  return `/api/mensagens/anexo/${id}`;
}

/** Conversa entre pessoas (com a outra parte conhecida), fora da demonstração, do suporte e do pedido de parceiro. */
export function podeAnexar(c: { otherId?: string; papel?: string; pedidoParceiroId?: string }, demo: boolean): boolean {
  return !demo && !!c.otherId && c.papel !== "suporte" && !c.pedidoParceiroId;
}

/** Linhas de mensagens_anexos → anexo de cada mensagem (tipo fora da lista não vira anexo). */
export function anexoDaMensagem(linhas: readonly { id: string; message_id: string; mime: string }[]): Map<string, AnexoNaBolha> {
  const mapa = new Map<string, AnexoNaBolha>();
  for (const l of linhas) {
    const tipo = tipoNaTela(l.mime);
    if (tipo) mapa.set(l.message_id, { id: l.id, tipo });
  }
  return mapa;
}

/** Tamanho para a prévia ("2,4 MB", "830 KB"). */
export function tamanhoLegivel(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
