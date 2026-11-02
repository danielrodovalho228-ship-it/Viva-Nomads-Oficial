/*
  E420 — URL de rascunho desconhecido ou de outra conta (`/dashboard/imoveis/novo?draft=<id>`). Antes, a página abria o
  Passo 1 como cadastro novo em silêncio — e o primeiro salvamento criava outro rascunho. Agora avisa. Uma mensagem só
  para "não existe" e "é de outra conta": a página não revela se o anúncio de outra pessoa existe.
  Roda: node --test src/lib/anuncio/rascunho-nao-encontrado.test.ts
*/
export type MotivoRascunhoFechado = "nao_encontrado" | "indisponivel";

export const TEXTO_RASCUNHO_FECHADO: Record<MotivoRascunhoFechado, { titulo: string; texto: string }> = {
  nao_encontrado: {
    titulo: "Rascunho não encontrado",
    texto: "Este rascunho não existe ou não é desta conta. Confira se entrou com a conta certa.",
  },
  indisponivel: {
    titulo: "Não deu para abrir o rascunho",
    texto: "Não conseguimos carregar este rascunho agora. Tente de novo em instantes.",
  },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * E420 (resíduo): o rascunho é desta conta? Só o DONO abre. A leitura privada (property_private_details) devolve a linha
 * também ao admin e a quem tem candidatura no imóvel — com o draft_data nulo —, e a página abria um cadastro vazio em
 * cima do anúncio de outra pessoa. Agora: linha que não existe ou é de outra conta → "Rascunho não encontrado".
 */
export function rascunhoDaConta(linha: { owner_id?: string | null } | null | undefined, userId: string | null | undefined): boolean {
  return !!linha && !!userId && linha.owner_id === userId;
}

/** O id do rascunho na URL tem o formato certo? Sem ele, nem pergunta ao servidor. */
export function idDeRascunhoValido(id: string | null | undefined): boolean {
  return UUID.test(String(id ?? ""));
}
