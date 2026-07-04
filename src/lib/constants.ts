import type { Persona } from "./types";
import { PLANOS, COMISSAO_POR_PLANO } from "@/config/planos";

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

/**
 * Cidades atendidas (com inventário) — usadas no footer e no sitemap.
 * Apenas Uberlândia por enquanto: evita "doorway pages" finas de SEO.
 * Outras cidades têm página, mas ficam noindex até haver imóveis.
 */
export const CITIES = [{ slug: "uberlandia", name: "Uberlândia", state: "MG" }];

/**
 * Planos de assinatura do proprietário — DERIVADOS da fonte única
 * `@/config/planos` (C2 do E2E). Mantém os nomes de campo usados pela /precos e
 * pela calculadora; para mudar preço/comissão/benefício, edite config/planos.ts.
 */
export const PLANS = PLANOS.map((p) => ({
  id: p.id,
  name: p.nome,
  price: p.precoMensal,
  commission: p.comissao,
  tagline: p.publico,
  featured: p.destaque,
  listingLimit: p.limiteAnuncios,
  features: p.beneficios,
  cost: p.custoLabel,
  cta: p.cta,
}));

/**
 * Comissão de fechamento por plano — DERIVADA da fonte única (config/planos.ts).
 * Gratuito 12% → Essencial 10% → Profissional 8% → Gestor 0% (comissão única por
 * contrato-mãe, sobre 1 mês).
 */
export const COMMISSION_BY_PLAN: Record<string, number> = COMISSAO_POR_PLANO;
