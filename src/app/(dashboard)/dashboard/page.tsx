import { Suspense } from "react";
import { InicioDados } from "./inicio-dados";
import { InicioTopo, MarcadorSecaoInicio, InicioFixo } from "@/components/painel/inicio-secoes";
import { RodapeInicio } from "@/components/dashboard/rodape-inicio";

/**
 * E797 — decisão de desenho do chat principal (opção b): o Início chega em SEÇÕES.
 *  • o topo (saudação) e as partes fixas (Peça na Viva e Ferramentas, no modo dono) pintam no 1º quadro;
 *  • o bloco de dados (decisões, KPIs, bloco principal) chega pelo fluxo, com o SEU marcador;
 *  • esta página não espera nenhuma leitura: o esqueleto de página inteira (SkeletonLista do loading.tsx) nunca aparece aqui.
 */
export default function DashboardPage() {
  return (
    <div data-testid="inicio-secoes">
      <InicioTopo />
      <Suspense fallback={<MarcadorSecaoInicio />}>
        <InicioDados />
      </Suspense>
      <InicioFixo />
      {/* E503: o Início fecha com um rodapé curto, em vez de terminar num vão sem nada. */}
      <RodapeInicio />
    </div>
  );
}
