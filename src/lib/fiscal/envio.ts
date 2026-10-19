/*
  Resultado do envio do documento por e-mail, por destinatário (PURO, node --test). Complemento do recibo, 19/10:
  antes, qualquer resposta de sendEmail (até a recusa do Resend e o modo simulado) contava como "enviado" e
  enviado_em era gravado sem o e-mail ter saído. Agora só conta o envio confirmado: resposta real, com id do Resend.
  Nunca guarda o endereço de e-mail.
*/

export type PapelEnvio = "locador" | "locatario";
export type StatusEnvio = "enviado" | "erro" | "simulado";

export interface EnvioDestinatario {
  papel: PapelEnvio;
  status: StatusEnvio;
  resend_id: string | null;
  erro: string | null;
  em: string;
}

/** O que sendEmail devolve (ou null, quando lançou). */
export interface RespostaEmail {
  demo?: boolean;
  id?: string;
  error?: string;
  captured?: boolean;
}

const ROTULO_PAPEL: Record<PapelEnvio, string> = { locador: "proprietário", locatario: "inquilino" };

export function resultadoEnvio(papel: PapelEnvio, r: RespostaEmail | null | undefined, em = new Date().toISOString()): EnvioDestinatario {
  if (r && !r.demo && r.id) return { papel, status: "enviado", resend_id: r.id, erro: null, em };
  if (r && r.demo) return { papel, status: "simulado", resend_id: null, erro: null, em };
  return { papel, status: "erro", resend_id: null, erro: (r?.error || "sem resposta do envio").slice(0, 200), em };
}

/** enviado_em só quando os DOIS destinatários têm envio confirmado. */
export function envioConfirmado(envio: EnvioDestinatario[]): boolean {
  return (["locador", "locatario"] as const).every((p) => envio.some((e) => e.papel === p && e.status === "enviado" && !!e.resend_id));
}

/**
 * Motivo para a fila "Documentos com falha" quando algum destinatário ficou com erro:
 * "e-mail não enviado: Resend 422: validation_error: … (inquilino)". Simulado (laboratório) não é falha.
 */
export function motivoFalhaEnvio(envio: EnvioDestinatario[]): string | null {
  const erros = envio.filter((e) => e.status === "erro");
  if (!erros.length) return null;
  return `e-mail não enviado: ${erros.map((e) => `${e.erro ?? "erro"} (${ROTULO_PAPEL[e.papel]})`).join("; ")}`.slice(0, 300);
}
