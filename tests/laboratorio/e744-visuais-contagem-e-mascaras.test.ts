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

test("t245: a única marca de falha esperada é a da tela de favoritos vazia (E990 nas duas larguras; a 1280 px também o E949)", () => {
  const t245 = ler("tests/e2e/specs/t245-visual-regressao.spec.ts");
  const teste05 = t245.slice(t245.indexOf('test("05 /favoritos vazio"'), t245.indexOf('test("06 /favoritos com 2 imóveis"'));
  const teste06 = t245.slice(t245.indexOf('test("06 /favoritos com 2 imóveis"'), t245.indexOf('test("07 /cidades/uberlandia"'));
  // 05: a 390 px só a linha do rodapé (E990); a 1280 px também o flutuante sobre a frase (E949).
  assert.match(teste05, /test\.fail\(\s*true,/);
  assert.match(teste05, /"E990 e E949 \(Gerente, 16\/11\/2026\)/, "a 1280 px a tela mostra os dois");
  assert.match(teste05, /"E990 \(Gerente, 16\/11\/2026\)/);
  // A marca vem depois de a página ficar pronta e imediatamente antes da comparação.
  assert.match(teste05, /await pronta\(page\);[\s\S]*test\.fail\([\s\S]*?\);\n\s+await print\(page, `05-favoritos-vazio-\$\{largura\}`\);/);
  // 06: sem marca. A do E994 (linha "Suporte" do rodapé em duas linhas a 1280 px) saiu por ordem do Gerente (ronda 04:19
  // de 17/11/2026): a correção entrou na main com o #3951, e a tela volta a ser comparada com a referência nas duas larguras.
  assert.doesNotMatch(teste06, /test\.fail\(/);
  assert.match(teste06, /await pronta\(page\);\n\s+await print\(page, `06-favoritos-\$\{largura\}`\);/);
  // O E994 não é mais citado em marca nenhuma do t245.
  assert.doesNotMatch(t245, /E994/);
  // Nenhuma outra tela do t245 é falha esperada, e nenhuma é pulada por causa dos defeitos.
  assert.equal((t245.match(/test\.fail\(/g) ?? []).length, 1);
  assert.doesNotMatch(t245, /test\.(skip|fixme)\([^)]*E99[0-9]/);
});

test("t271: só os dois painéis de listas vivas do Início do admin têm altura fixa e corpo escondido", () => {
  const t271 = ler("tests/e2e/specs/t271-admin-visual.spec.ts");
  assert.match(t271, /const PAINEIS_VIVOS_DO_INICIO = \['\[data-testid="admin-atencao"\]', '\[data-testid="admin-atividade"\]'\] as const;/);
  // Só na tela /admin, e depois de conferir que os dois painéis existem com o título.
  assert.match(t271, /if \(rota === "\/admin"\) \{[\s\S]*?toBeVisible\(\);\n\s+await page\.addStyleTag\(\{ content: ESTILO_DOS_PAINEIS_VIVOS \}\);\n\s+\}/);
  // O título fica: só o que não é o h2 do painel some.
  assert.match(t271, /> :not\(h2\) \{ display: none !important; \}/);
  assert.equal((t271.match(/ESTILO_DOS_PAINEIS_VIVOS/g) ?? []).length, 2, "definido uma vez e usado uma vez");
});

test("t263 e t271: a página do imóvel inteira é falha esperada do E990; Admin › Usuários deixou de ser (E991 corrigido no #3922)", () => {
  const t263 = ler("tests/e2e/specs/t263-visual-41.spec.ts");
  const t271 = ler("tests/e2e/specs/t271-admin-visual.spec.ts");
  // E990: a página do imóvel inteira (as duas larguras passam pelo mesmo teste). Estrita, com o item e a data, logo antes da comparação.
  assert.match(t263, /test\.fail\(true, "E990 \(Gerente, 16\/11\/2026\)[^"]*"\);\n\s+await expect\(page\)\.toHaveScreenshot\(`01-imovel-inteiro-\$\{largura\}\.png`/);
  assert.equal((t263.match(/test\.fail\(/g) ?? []).length, 1);
  // E991: a correção entrou na main (#3922). Decisão do Gerente (16/11/2026): a marca sai e a tela passa SEM ela.
  assert.equal((t271.match(/test\.fail\(/g) ?? []).length, 0, "nenhuma tela do admin é falha esperada");
  assert.doesNotMatch(t271, /FALHA ESPERADA/);
  // O travão do estouro lateral continua valendo para todas as telas do admin.
  assert.match(t271, /scrollWidth - window\.innerWidth\)\)\.toBeLessThanOrEqual\(1\)/);
  assert.doesNotMatch(t263 + t271, /test\.(skip|fixme)\([^)]*E99[0-9]/);
});
