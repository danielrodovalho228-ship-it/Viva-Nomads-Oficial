import { PASSO_CONVERSE_TEXTO } from "./conversa-chat.ts";

/**
 * O caminho de reserva do morador — fonte única dos passos da página Como funciona ("Para quem busca um imóvel") e do
 * "Ver o caminho para morar" do anúncio de exemplo (E530).
 */
export const PASSOS_MORADOR = [
  { titulo: "Busque", texto: "Encontre imóveis mobiliados por cidade, período e orçamento." },
  { titulo: "Converse", texto: PASSO_CONVERSE_TEXTO },
  { titulo: "Candidate-se", texto: "Envie sua candidatura pela plataforma. A verificação de identidade chega em breve." },
  { titulo: "Assine", texto: "Assine o contrato digital com validade jurídica e receba as chaves." },
] as const;
