import { InicioDados } from "./inicio-dados";
import { InicioTopo, InicioFixo } from "./visao-geral-client";
import { RodapeInicio } from "@/components/dashboard/rodape-inicio";

/**
 * E797 — decisão de desenho do chat principal (opção b): o Início chega em SEÇÕES.
 *  • 1º quadro: a CASCA do Início (loading.tsx desta rota) — topo (saudação), o marcador do bloco de dados e as partes
 *    fixas (Peça na Viva e Ferramentas, no modo dono). Nunca o esqueleto de página inteira.
 *  • Quando as leituras terminam, esta página troca o marcador pelo bloco de dados, no mesmo lugar.
 * Por que não um Suspense interno aqui: com ele, a casca hidratava antes e o bloco ficava ~1 s visível mas inerte —
 * um toque nesse intervalo se perdia (t266, "Resolver agora"). Pelo loading.tsx, a página hidrata inteira de uma vez.
 */
export default function DashboardPage() {
  return (
    <div data-testid="inicio-secoes">
      <InicioTopo />
      <InicioDados />
      <InicioFixo />
      {/* E503: o Início fecha com um rodapé curto, em vez de terminar num vão sem nada. */}
      <RodapeInicio />
    </div>
  );
}
