/**
 * Erro do banco → frase em pt-BR para a tela. Nunca mostra a mensagem técnica
 * em inglês ("new row violates row-level security policy…"). As mensagens que
 * NÓS levantamos nos triggers (raise exception … em português) passam como
 * estão. Sem imports — testável com node --test.
 */
export interface ErroBanco {
  code?: string | null;
  message?: string | null;
}

const GENERICO = "Não foi possível concluir agora. Tente novamente em instantes.";

/** A mensagem veio de um trigger nosso (português)? */
function ehNossa(msg: string): boolean {
  // Acentos ou palavras comuns das nossas mensagens; as do Postgres/PostgREST são em inglês.
  return /[áàâãéêíóôõúç]/i.test(msg) || /\b(não|anúncio|imóvel|contrato|pedido|documento|fotos?)\b/i.test(msg);
}

export function erroBancoPT(erro: ErroBanco | null | undefined, padrao = GENERICO): string {
  if (!erro) return padrao;
  const msg = String(erro.message ?? "").trim();
  if (msg && ehNossa(msg)) return msg;
  switch (erro.code) {
    case "42501":
      return "Você não tem permissão para esta ação.";
    case "23514":
      return "Algum dado está fora do permitido (por exemplo, valor, prazo ou data). Confira e tente de novo.";
    case "23505":
      return "Isso já foi registrado antes.";
    case "23503":
      return "Um item ligado a este registro não existe mais. Atualize a página.";
    case "23502":
      return "Falta preencher um campo obrigatório.";
    case "22P02":
    case "22007":
    case "22008":
      return "Algum campo está em formato inválido.";
    default:
      return padrao;
  }
}
