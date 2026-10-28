/*
  E84 — Central de Ajuda (mockups ajuda-central-desktop/mobile, aprovados pelo Daniel em 25/10): os quatro cartões de
  tema do hub. Cada tema filtra as perguntas frequentes (lib/atendimento/faq.ts, fonte única das respostas) — nenhuma
  resposta nova aqui. Os textos dos mockups que falam de check-in, reserva ou taxa de limpeza não entram (vocabulário
  aprovado). Puro.
*/
import { FAQ } from "../atendimento/faq.ts";

export type IdTema = "morador" | "proprietarios" | "contratos" | "seguranca";

export interface TemaAjuda {
  id: IdTema;
  titulo: string;
  resumo: string;
  /** Foto do acervo (public/images); sem foto, o cartão usa o ícone do escudo, como no mockup. */
  foto: string | null;
  alt: string;
  /** Perguntas do tema, na ordem em que aparecem. */
  perguntas: readonly string[];
}

export const TEMAS_AJUDA: readonly TemaAjuda[] = [
  {
    id: "morador",
    titulo: "Para quem procura moradia",
    resumo: "Pedido de moradia, prazos e o que você paga",
    foto: "/images/unicas/cf-renovacao.webp",
    alt: "Pessoa chegando com a mala a um apartamento mobiliado",
    perguntas: ["inquilino-paga", "prazo", "cancelar-pedido", "contato"],
  },
  {
    id: "proprietarios",
    titulo: "Para proprietários",
    resumo: "Anunciar, taxa de serviço e publicação",
    foto: "/images/home/home-proprietarios-chaves.webp",
    alt: "Proprietário segurando as chaves na sala do imóvel",
    perguntas: ["custo-anunciar", "anuncio-nao-publica", "contratar-fotografo", "limpeza-estadia"],
  },
  {
    id: "contratos",
    titulo: "Contratos e pagamentos",
    resumo: "Caução, renovação e manutenção",
    foto: "/images/unicas/proprietarios-contrato.webp",
    alt: "Contrato sendo assinado no celular",
    perguntas: ["caucao", "renovar", "manutencao", "prazo"],
  },
  {
    id: "seguranca",
    titulo: "Segurança e conta",
    resumo: "Pagamento por fora, código de acesso e senha",
    foto: null,
    alt: "",
    perguntas: ["golpe", "email-confirmacao", "senha", "contato"],
  },
] as const;

export function temaAjuda(id: string | null | undefined): TemaAjuda | null {
  return TEMAS_AJUDA.find((t) => t.id === id) ?? null;
}

/** Perguntas que o hub mostra: as do tema escolhido (na ordem do tema) ou todas. */
export function perguntasDoTema(id: string | null | undefined): string[] {
  const tema = temaAjuda(id);
  return tema ? [...tema.perguntas] : FAQ.map((p) => p.id);
}
