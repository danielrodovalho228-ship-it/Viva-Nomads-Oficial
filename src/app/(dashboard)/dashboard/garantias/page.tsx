import { getMeusContratos } from "@/lib/data/contratos-actions";
import { GarantiasClient } from "./garantias-client";

export const metadata = { title: "Garantias" };

export default async function GarantiasPage() {
  const contratos = await getMeusContratos();
  return <GarantiasClient contratos={contratos} />;
}
