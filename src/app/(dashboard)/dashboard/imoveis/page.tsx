import { listMyProperties } from "@/lib/data/properties";
import { MyPropertiesClient } from "./imoveis-client";

/**
 * "Meus imóveis": o servidor busca a lista REAL do proprietário; a renderização
 * fica no client (imoveis-client), que suporta o modo demonstração do admin
 * (fonte vira o seed em memória — nada é gravado, nada se mistura).
 */
export default async function MyPropertiesPage() {
  const properties = await listMyProperties();
  return <MyPropertiesClient properties={properties} />;
}
