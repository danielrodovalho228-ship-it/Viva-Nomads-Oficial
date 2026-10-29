/*
  A8 — Conta › Ajuda (mockup perfil-08): os quatro atalhos, na ordem do desenho, e o rodapé. Puro.
*/
/** E71: a frase do cartão de contato — o assistente responde na hora; uma pessoa, em até 24 h (a promessa pública). */
export const CONTATO_LINHA = "Assistente Viva 24 h · resposta de uma pessoa em até 24 h";

export interface LinkAjuda {
  id: "central" | "fale" | "termos" | "privacidade";
  rotulo: string;
  href: string;
  icone: "BookOpenText" | "MessageSquareText" | "FileText" | "ShieldCheck";
  /** E71: a linha curta embaixo do rótulo (as linhas pareciam iguais e levar ao mesmo lugar). */
  descricao: string;
}

export const LINKS_AJUDA_CONTA: readonly LinkAjuda[] = [
  { id: "central", rotulo: "Central de ajuda", href: "/ajuda", icone: "BookOpenText", descricao: "Guias e respostas rápidas" },
  // O atendimento da Viva (assistente + chamado com uma pessoa da equipe) tem página própria (E84).
  // E71: na tela ele é o cartão em destaque (CONTATO_AJUDA), não uma linha da lista.
  { id: "fale", rotulo: "Fale com a Viva", href: "/ajuda/fale-com-a-viva", icone: "MessageSquareText", descricao: CONTATO_LINHA },
  { id: "termos", rotulo: "Termos de uso", href: "/termos", icone: "FileText", descricao: "As regras da plataforma" },
  { id: "privacidade", rotulo: "Política de privacidade", href: "/privacidade", icone: "ShieldCheck", descricao: "Seus dados, suas regras" },
] as const;

/** O cartão em destaque e as linhas da lista (E71): o contato sai da lista e vira o cartão com foto. */
export const CONTATO_AJUDA = LINKS_AJUDA_CONTA.find((l) => l.id === "fale")!;
export const LINHAS_AJUDA = LINKS_AJUDA_CONTA.filter((l) => l.id !== "fale");
