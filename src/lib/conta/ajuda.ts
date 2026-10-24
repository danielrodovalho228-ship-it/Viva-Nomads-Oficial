/*
  A8 — Conta › Ajuda (mockup perfil-08): os quatro atalhos, na ordem do desenho, e o rodapé. Puro.
*/
export interface LinkAjuda {
  id: "central" | "fale" | "termos" | "privacidade";
  rotulo: string;
  href: string;
  icone: "BookOpenText" | "MessageSquareText" | "FileText" | "ShieldCheck";
}

export const LINKS_AJUDA_CONTA: readonly LinkAjuda[] = [
  { id: "central", rotulo: "Central de ajuda", href: "/ajuda", icone: "BookOpenText" },
  // O atendimento da Viva (assistente + chamado com uma pessoa da equipe) abre pela Central, como o "Falar com a Viva".
  { id: "fale", rotulo: "Fale com a Viva", href: "/ajuda?novo=1", icone: "MessageSquareText" },
  { id: "termos", rotulo: "Termos de uso", href: "/termos", icone: "FileText" },
  { id: "privacidade", rotulo: "Política de privacidade", href: "/privacidade", icone: "ShieldCheck" },
] as const;

export const RODAPE_AJUDA_CONTA = "Viva Nomads · Uberlândia, MG";
