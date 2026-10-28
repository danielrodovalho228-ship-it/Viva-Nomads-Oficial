import { getContratosDoInquilino, getMeusContratos } from "@/lib/data/contratos-actions";
import { GarantiasClient } from "./garantias-client";

export const metadata = { title: "Caução" };

/** Caução do DONO: só os contratos dos imóveis da pessoa (E188). Do lado morador, só a contagem para o aviso. */
export default async function GarantiasPage() {
  const [contratos, doInquilino] = await Promise.all([getMeusContratos(), getContratosDoInquilino()]);
  return <GarantiasClient contratos={contratos} temContratoDeMorador={doInquilino.length > 0} />;
}
