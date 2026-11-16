/*
  E744, pacote visual (julgamento do Gerente, 16/11/2026, #3894): duas correções de teste aprovadas antes de regravar
  as referências.
  1. t263, folha de ações da estadia: a contagem cobrada é a da regra do produto (E539 iv): 4 para o morador, antes e
     depois da liberação das instruções, e 5 para o proprietário. A contagem antiga (5/6/7) era de antes do E539.
  2. t271, admin: números, datas e nomes que mudam com a base ficam debaixo de máscara; a imagem guarda a anatomia.
  Roda: node --test tests/laboratorio/e744-visuais-contagem-e-mascaras.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { acoesDaEstadia, type ContratoDaEstadia } from "../../src/lib/estadia/acoes.ts";

const RAIZ = new URL("../../", import.meta.url).pathname;
const ler = (p: string) => readFileSync(RAIZ + p, "utf8");

test("t263: a contagem da folha da estadia é a da regra do produto (E539 iv): 4, 4 e 5", () => {
  const base: ContratoDaEstadia = { id: "11111111-2222-4333-8444-555555555555", fase: "antes", conversaId: "c", imovelId: "66666666-7777-4888-8999-aaaaaaaaaaaa", cidade: "Uberlândia", instrucoesLiberadas: false };
  const moradorAntes = acoesDaEstadia("inquilino", base).length;
  const moradorDepois = acoesDaEstadia("inquilino", { ...base, instrucoesLiberadas: true }).length;
  const proprietario = acoesDaEstadia("proprietario", { ...base, instrucoesLiberadas: true }).length;
  assert.deepEqual([moradorAntes, moradorDepois, proprietario], [4, 4, 5]);

  const spec = ler("tests/e2e/specs/t263-visual-41.spec.ts");
  assert.match(spec, new RegExp(`toHaveCount\\(quem === "proprietario" \\? ${proprietario} : ${moradorAntes}\\)`));
  assert.doesNotMatch(spec, /toHaveCount\(quem === "proprietario" \? 7/, "a contagem antiga (5/6/7) não volta");
});

test("t271: os dados que mudam com a base têm máscara", () => {
  const spec = ler("tests/e2e/specs/t271-admin-visual.spec.ts");
  const mascaras = spec.slice(spec.indexOf("function mascaras("), spec.indexOf('test.describe("T271'));
  for (const seletor of [
    '[data-testid="admin-atencao-todas"]', // "Ver todas (N)" no Início do admin
    '[data-testid^="numero-fonte-"]', // "Usuários: N reais · M de teste", estadias, chamados
    '[data-testid="fila-agora"] span', // "N na fila agora (…)"
    '[data-testid="conferencia-contadores"] > div > p:first-child',
    '[data-testid="matriculas-contadores"] > div > p:first-child',
    '[data-testid="admin-parceiros-tipos"] span', // "Todos · N"
    '[data-testid="contratos-totais"] [data-testid]', // contagem, valor total, taxa e percentual
    '[data-testid="admin-contrato"] h1', // "VN-CT-… · nome do imóvel"
    '[data-testid="admin-contrato-cabecalho"] p',
    '[data-testid="admin-contrato-resumo"] p',
    '[data-testid="admin-contrato-totais"]',
    '[data-testid="admin-contrato-taxa"]',
    '[data-testid="admin-conferencia-prazo"]',
    '[role="img"]', // gráficos: barras e meses do eixo
  ]) {
    assert.ok(mascaras.includes(seletor), `falta a máscara de ${seletor}`);
  }
  // Contagem entre parênteses em título ou aba, e frase com data ou hora.
  assert.match(mascaras, /main h2, main button"\)\.filter\(\{ hasText: /);
  assert.match(mascaras, /main p"\)\.filter\(\{ hasText: /);
});

test("t271: os nomes usados nas máscaras existem no produto", () => {
  const fontes = ["src/app", "src/components"];
  for (const nome of ["admin-atencao-todas", "numero-fonte-", "fila-agora", "conferencia-contadores", "matriculas-contadores", "admin-parceiros-tipos", "contratos-totais", "admin-contrato-cabecalho", "admin-contrato-resumo", "admin-contrato-totais", "admin-contrato-taxa", "admin-conferencia-prazo"]) {
    let achou = "";
    try {
      achou = execFileSync("grep", ["-rl", "--include=*.tsx", "--include=*.ts", nome, ...fontes.map((f) => RAIZ + f)], { encoding: "utf8" });
    } catch {
      /* grep sai com 1 quando não acha */
    }
    assert.ok(achou.trim().length > 0, `"${nome}" não existe mais no produto: a máscara do t271 ficou sem alvo`);
  }
});

test("as três telas dos defeitos registrados são falha esperada: estrita, com o item e a data, logo antes da comparação", () => {
  const t263 = ler("tests/e2e/specs/t263-visual-41.spec.ts");
  const t271 = ler("tests/e2e/specs/t271-admin-visual.spec.ts");
  // E990: a página do imóvel inteira (as duas larguras passam pelo mesmo teste).
  assert.match(t263, /test\.fail\(true, "E990 \(Gerente, 16\/11\/2026\)[^"]*"\);\n\s+await expect\(page\)\.toHaveScreenshot\(`01-imovel-inteiro-\$\{largura\}\.png`/);
  // E991: só Admin › Usuários a 1280 px.
  assert.match(t271, /test\.fail\(rota === "\/admin\/usuarios" && largura === 1280, "E991 \(Gerente, 16\/11\/2026\)[^"]*"\);\n\s+await expect\(page\)\.toHaveScreenshot\(/);
  // Nenhuma outra tela dos dois specs é falha esperada, e nenhuma é pulada por causa dos defeitos.
  assert.equal((t263.match(/test\.fail\(/g) ?? []).length, 1);
  assert.equal((t271.match(/test\.fail\(/g) ?? []).length, 1);
  assert.doesNotMatch(t263 + t271, /test\.(skip|fixme)\([^)]*E99[01]/);
});
