import { redirecionamentoDaConta, telaDaLargura } from "../../../src/lib/conta/redirecionar-no-servidor.ts";

/*
  E744, passo 2 (15/11/2026) — em que endereço a varredura tem de ESTAR depois de abrir `rota` nesta largura.

  Duas rotas da Conta só levam a outra tela, por decisão registrada, e desde o E798 (12/11) o servidor redireciona antes de
  desenhar:
    - E492/E552: no computador (≥ 1024 px), /dashboard/conta abre o Perfil (/dashboard/conta/perfil); no celular é o menu;
    - E679 (E85): /dashboard/conta/avaliacoes virou /dashboard/avaliacoes.
  Usa a mesma função do proxy (fonte única): se a regra mudar lá, a varredura acompanha. Para qualquer outra rota o
  caminho esperado é o próprio endereço, sem busca nem âncora.

  Quem chama espera a tela assentar (expect.poll): sem o cookie da largura (1ª tela da conta) o servidor não redireciona
  /dashboard/conta e é o navegador que leva ao Perfil logo depois de carregar. Guarda: tests/laboratorio/e744-rotas-da-conta.test.ts.
*/
export function caminhoEsperado(rota: string, largura: number): string {
  const u = new URL(rota, "http://varredura.local");
  const destino = redirecionamentoDaConta(u.pathname, u.searchParams, telaDaLargura(largura));
  return (destino ?? u.pathname).split(/[?#]/)[0];
}
