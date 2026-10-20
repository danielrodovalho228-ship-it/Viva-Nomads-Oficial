import type { Property } from "./types.ts";
import { IDEAL_PARA, type IdealParaId } from "../config/selos.ts";

/**
 * "IDEAL PARA" (ordem 507074ce, complemento dos selos): camada DERIVADA dos dados
 * que o anúncio já tem. O proprietário não preenche nada novo e nenhum selo
 * existente muda. Máximo de 3 por imóvel; a ordem abaixo é a de prioridade.
 * "Com pet" vem PRIMEIRO (decisão do Daniel, #910 / Prompt 35A): quem aceita pet sempre mostra, e as outras duas
 * vagas seguem a ordem de antes.
 */
export const IDEAL_PARA_MAX = 3;

type Dados = Pick<Property, "workFeatures" | "internetTier" | "bedrooms" | "furnished" | "amenities" | "petsAllowed">;

const REGRAS: { id: IdealParaId; vale: (p: Dados) => boolean }[] = [
  // Com pet = aceita pet. PRIMEIRA regra: atributo declarado vence inferência — o dono DISSE que aceita pet; as
  // outras regras são deduzidas dos dados. Com petsAllowed === true, sempre ocupa uma das 3 vagas.
  { id: "comPet", vale: (p) => p.petsAllowed === true },
  // Home office = mesa de trabalho + internet informada.
  {
    id: "homeOffice",
    vale: (p) => (p.workFeatures ?? []).some((f) => /mesa/i.test(f)) && !!p.internetTier,
  },
  // Família = 2 ou mais quartos.
  { id: "familia", vale: (p) => (p.bedrooms ?? 0) >= 2 },
  // Executivo = mobiliado completo (o recibo para reembolso sai da plataforma em toda estadia).
  {
    id: "executivo",
    vale: (p) => p.furnished === true && (p.amenities ?? []).some((a) => /mobiliado completo/i.test(a)),
  },
];

/** Quem o imóvel atende, na ordem de prioridade, no máximo IDEAL_PARA_MAX. */
export function idealPara(p: Dados): IdealParaId[] {
  return REGRAS.filter((r) => r.vale(p))
    .map((r) => r.id)
    .slice(0, IDEAL_PARA_MAX);
}

/** Rótulos prontos para a tela ("Home office", "Família"…). */
export function idealParaRotulos(p: Dados): string[] {
  return idealPara(p).map((id) => IDEAL_PARA[id].nome);
}
