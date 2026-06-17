import type { Persona } from "./types";

/** Os 4 perfis de público-alvo (seção 0 do documento mestre). */
export const PERSONAS: Persona[] = [
  {
    id: "executivos",
    title: "Executivos em transferência",
    text: "Mudança de cidade, treinamento corporativo ou projeto temporário. Chegou para trabalhar — e precisa estar instalado já no primeiro dia.",
    period: "30–90 dias",
    icon: "Briefcase",
  },
  {
    id: "saude",
    title: "Médicos e profissionais de saúde",
    text: "Plantões, residência, consultorias temporárias ou acompanhamento de pacientes em tratamento prolongado.",
    period: "30–180 dias",
    icon: "Stethoscope",
  },
  {
    id: "familias",
    title: "Famílias em transição",
    text: "Mudança de casa, reforma, espera pelo imóvel próprio ou transição de carreira com a família junto.",
    period: "60–180 dias",
    icon: "Users",
  },
  {
    id: "nomades",
    title: "Nômades digitais e estudantes",
    text: "Trabalho remoto por temporada, especialização universitária ou intercâmbio profissional em outra cidade.",
    period: "30–90 dias",
    icon: "Laptop",
  },
];

/** Navegação pública. */
export const PUBLIC_NAV = [
  { href: "/buscar", label: "Buscar imóveis" },
  { href: "/como-funciona", label: "Como funciona" },
  { href: "/para-proprietarios", label: "Para proprietários" },
  { href: "/precos", label: "Planos" },
];

/** Cidades com landing de SEO (Fase 11 — começar por Uberlândia). */
export const CITIES = [
  { slug: "uberlandia", name: "Uberlândia", state: "MG" },
  { slug: "sao-paulo", name: "São Paulo", state: "SP" },
  { slug: "belo-horizonte", name: "Belo Horizonte", state: "MG" },
  { slug: "goiania", name: "Goiânia", state: "GO" },
];

/** Planos de assinatura do proprietário (modelo híbrido — Fase 10). */
export const PLANS = [
  {
    id: "free",
    name: "Gratuito",
    price: 0,
    commission: 0.12, // 12% no fechamento (porta de entrada)
    tagline: "Para testar a plataforma",
    featured: false,
    listingLimit: 1,
    features: [
      "1 anúncio ativo (limitado)",
      "Aparece na busca",
      "Recebe consultas de inquilinos",
      "Checklist de qualificação",
      "Comissão de 12% no fechamento",
    ],
    cta: "Começar grátis",
  },
  {
    id: "essential",
    name: "Essencial",
    price: 49,
    commission: 0.1, // 10% no fechamento
    tagline: "Para quem tem alguns imóveis",
    featured: true,
    listingLimit: 5,
    features: [
      "Até 5 anúncios ativos",
      "Selo Pronto para Trabalho",
      "Destaque na busca",
      "Painel de leads e mensagens",
      "Comissão de 10% no fechamento",
    ],
    cta: "Assinar Essencial",
  },
  {
    id: "pro",
    name: "Profissional",
    price: 129,
    commission: 0.08, // 8% no fechamento (por volume)
    tagline: "Para quem vive de locação",
    featured: false,
    listingLimit: 20,
    features: [
      "Até 20 anúncios ativos",
      "Tudo do Essencial",
      "Prioridade máxima na busca",
      "Geração de contrato via ZapSign",
      "Comissão de 8% no fechamento",
    ],
    cta: "Assinar Profissional",
  },
  {
    id: "gestor",
    name: "Gestor",
    price: null, // sob consulta
    commission: null, // escalonada por volume
    tagline: "Administradoras e coordenadores",
    featured: false,
    listingLimit: 999,
    features: [
      "Imóveis ilimitados",
      "Tudo do Profissional",
      "Comissão escalonada por volume",
      "Gestão de carteira e múltiplos proprietários",
      "Atendimento dedicado",
    ],
    cta: "Falar com vendas",
  },
];

/** Comissão de fechamento por plano (Atualização 1 — rodada 2). */
export const COMMISSION_BY_PLAN: Record<string, number> = {
  free: 0.12,
  essential: 0.1,
  pro: 0.08,
  gestor: 0.08,
};
