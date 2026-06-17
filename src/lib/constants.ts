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
    tagline: "Para testar a plataforma",
    featured: false,
    listingLimit: 1,
    features: [
      "1 anúncio ativo (limitado)",
      "Aparece na busca",
      "Recebe consultas de inquilinos",
      "Checklist de qualificação",
    ],
    cta: "Começar grátis",
  },
  {
    id: "essential",
    name: "Essencial",
    price: 49,
    tagline: "Para quem tem alguns imóveis",
    featured: true,
    listingLimit: 5,
    features: [
      "Até 5 anúncios ativos",
      "Selo Pronto para Trabalho",
      "Destaque na busca",
      "Painel de leads e mensagens",
      "Mapa de espaços de trabalho próximos",
    ],
    cta: "Assinar Essencial",
  },
  {
    id: "pro",
    name: "Profissional",
    price: 129,
    tagline: "Para quem vive de locação",
    featured: false,
    listingLimit: 20,
    features: [
      "Até 20 anúncios ativos",
      "Tudo do Essencial",
      "Prioridade máxima na busca",
      "Geração de contrato via ZapSign",
      "Análise de inquilino por IA (CAF)",
      "Selo de verificação",
    ],
    cta: "Assinar Profissional",
  },
];
