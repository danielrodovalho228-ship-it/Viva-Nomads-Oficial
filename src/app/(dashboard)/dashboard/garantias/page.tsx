import { EmConstrucao } from "@/components/dashboard/primitives";
import { FERRAMENTAS_REAIS } from "@/lib/flags";
import { getMeusContratos } from "@/lib/data/contratos-actions";
import { GarantiasClient } from "./garantias-client";

export const metadata = { title: "Garantias" };

export default async function GarantiasPage() {
  // Ferramenta EM DESENVOLVIMENTO (B2): com a flag OFF, abre o placeholder dentro
  // da casca; a versão real (GarantiasClient) fica preservada atrás da flag.
  if (!FERRAMENTAS_REAIS) {
    return (
      <EmConstrucao
        title="Garantia locatícia"
        text="O acompanhamento de garantias e cauções está em desenvolvimento e chega em breve, aqui no seu painel."
      />
    );
  }
  const contratos = await getMeusContratos();
  return <GarantiasClient contratos={contratos} />;
}
