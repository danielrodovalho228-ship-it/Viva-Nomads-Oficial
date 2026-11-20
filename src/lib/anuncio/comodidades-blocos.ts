import type { AmenityGroup } from "../types.ts";
import { AMENITY_LABEL, tipoEmCondominio } from "../amenities.ts";
import type { ComodidadesAgrupadas } from "./comodidades.ts";

/*
  E661 — dois blocos na página do imóvel: "O imóvel e o que está incluso" (o que é do apartamento: dados do dono) ×
  "Estrutura do condomínio" (informado pelo proprietário, pode variar). Fonte única da divisão. Wi-Fi/internet do
  APARTAMENTO e a vaga ficam no bloco do dono; portaria, academia, piscina, salão, coworking etc. vão ao do condomínio.
  Casa e chácara não têm condomínio: tudo fica no bloco do dono. Só dado cadastrado: nada é inventado nem some.
  (Quando a ficha do E660, da Pista B, entrar, ela alimenta o bloco do dono; a divisão não muda.)
*/
export const CHAVES_DO_CONDOMINIO = [
  "portaria_24h",
  "elevador",
  "academia",
  "piscina",
  "churrasqueira",
  "salao_festas",
  "lavanderia",
  "bicicletario",
  "sala_reuniao",
  "coworking",
  "cabine_chamadas",
] as const;

const ROTULOS_DO_CONDOMINIO = new Set(CHAVES_DO_CONDOMINIO.map((k) => AMENITY_LABEL[k]).filter(Boolean));

export const NOTA_ESTRUTURA_CONDOMINIO = "Informado pelo proprietário, pode variar.";

export function blocosDeComodidades(a: ComodidadesAgrupadas, propertyType: string | null | undefined): { imovel: AmenityGroup[]; condominio: string[] } {
  if (!tipoEmCondominio(propertyType)) return { imovel: a.grupos, condominio: [] };
  const condominio: string[] = [];
  const imovel: AmenityGroup[] = [];
  for (const g of a.grupos) {
    const fica: string[] = [];
    for (const item of g.items) (ROTULOS_DO_CONDOMINIO.has(item) ? condominio : fica).push(item);
    if (fica.length > 0) imovel.push({ category: g.category, items: fica });
  }
  return { imovel, condominio };
}
