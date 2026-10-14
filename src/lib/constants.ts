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
    text: "Trabalho remoto por alguns meses, especialização universitária ou intercâmbio profissional em outra cidade.",
    period: "30–90 dias",
    icon: "Laptop",
  },
];

/**
 * Navegação pública. `mais`: no desktop fica no menu "Mais" do cabeçalho (os 7
 * links lado a lado não cabem com o logo e os botões); no menu mobile, todos.
 */
export const PUBLIC_NAV = [
  { href: "/buscar", label: "Buscar imóveis" },
  { href: "/pedidos/novo", label: "Publicar pedido" },
  { href: "/como-funciona", label: "Como funciona", mais: true },
  { href: "/para-proprietarios", label: "Para proprietários" },
  { href: "/empresas", label: "Para empresas" },
  { href: "/precos", label: "Preços" },
  { href: "/parceiros", label: "Parceiros", mais: true },
] as { href: string; label: string; mais?: true }[];

/**
 * Cidades atendidas (com inventário) — usadas no footer e no sitemap.
 * Apenas Uberlândia por enquanto: evita "doorway pages" finas de SEO.
 * Outras cidades têm página, mas ficam noindex até haver imóveis.
 */
export const CITIES = [{ slug: "uberlandia", name: "Uberlândia", state: "MG" }];

/**
 * Condições LEGADAS (quem já estava em plano pago mantém até o fim do ciclo) — DERIVADAS da fonte única
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
 * Cai do Gratuito ao Gestor (zero); comissão única por contrato e por renovação, sobre o
 * valor total (aluguel × meses). Os percentuais vivem só em config/planos.ts.
 */
export const COMMISSION_BY_PLAN: Record<string, number> = COMISSAO_POR_PLANO;
