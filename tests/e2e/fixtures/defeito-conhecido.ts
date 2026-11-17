import { test } from "@playwright/test";

/*
  E744 (T1, plano de 17/11): a marca de "falha conhecida" de um defeito real que já tem item registrado.

  O teste continua rodando e cobrando a regra certa. Enquanto o defeito existe, a falha é a esperada e a rodada noturna
  conta o teste como "conhecida", não como "falhou". No dia em que alguém corrigir o defeito, o teste passa, o Playwright
  acusa "era para falhar e passou" e a rodada fica vermelha: é o aviso de que a marca tem de sair, no mesmo PR da correção.

  Chamar na primeira linha do teste:
    defeitoConhecido("E975", "o sobrenome de exemplo viaja no JavaScript do painel");
  Com condição, quando só uma das larguras (ou um dos casos) falha:
    defeitoConhecido("E987", "a foto 2 não reaproveita a miniatura", largura === 1280);

  A anotação { type: "defeito", description: "E<item>" } vai para o relatório do Playwright; o consolidar do laboratório
  lê o item dali. A lista dos specs marcados e o item de cada um fica em tests/laboratorio/disposicao-falhas.json.
*/
export function defeitoConhecido(item: string, motivo: string, quando = true): void {
  if (!/^E\d+$/.test(item)) throw new Error(`defeitoConhecido: "${item}" não é um item registrado (E<número>)`);
  if (!quando) return;
  test.info().annotations.push({ type: "defeito", description: item });
  test.fail(true, `${item}: ${motivo}`);
}
