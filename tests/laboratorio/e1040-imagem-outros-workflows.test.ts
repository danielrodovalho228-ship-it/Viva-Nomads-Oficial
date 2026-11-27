/*
  E1040 (ORDEM-DUET-216, ponto 4; ORDEM-DUET-229, item 4): o desenho do E1037 (#4034, laboratorio.yml) estende-se aos
  outros três workflows que corriam `npx playwright install --with-deps` (apt em tempo de execução): lab-critico.yml,
  e2e.yml (jobs e2e e prova-ao-vivo) e linhas-de-base.yml. A imagem OFICIAL do Playwright, na MESMA versão do pacote;
  só os passos que chamam `npx playwright` correm na imagem (`docker run --network host`), com a mesma função `npx`
  do laboratorio.yml. Nas linhas de base isto importa a dobrar: a suíte já corre na imagem desde o #4034, e as imagens-base
  têm de ser feitas no MESMO navegador (as mesmas fontes) em que são comparadas.
  Roda: node --test tests/laboratorio/e1040-imagem-outros-workflows.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const versao = (JSON.parse(readFileSync("node_modules/@playwright/test/package.json", "utf8")) as { version: string }).version;
const IMAGEM = `mcr.microsoft.com/playwright:v${versao}-noble`;
const WORKFLOWS = ["lab-critico.yml", "e2e.yml", "linhas-de-base.yml"] as const;

/** Os jobs de um workflow: nome → texto (do "  nome:" até ao próximo job de 2 espaços). */
function jobs(yml: string): Map<string, string> {
  const corpo = yml.slice(yml.indexOf("\njobs:\n") + 7);
  const marcas = [...corpo.matchAll(/^  ([a-z][a-z0-9-]*):\n/gm)];
  return new Map(marcas.map((m, i) => [m[1], corpo.slice(m.index, marcas[i + 1]?.index ?? corpo.length)]));
}
/** Os passos de um job: cada "- name:" até ao próximo. */
function passos(job: string): string[] {
  const marcas = [...job.matchAll(/^      - (?:name|uses):/gm)];
  return marcas.map((m, i) => job.slice(m.index, marcas[i + 1]?.index ?? job.length));
}

for (const w of WORKFLOWS) {
  const yml = readFileSync(`.github/workflows/${w}`, "utf8");

  test(`${w}: nenhum passo instala navegadores (sem \`playwright install\`, sem apt do Playwright)`, () => {
    assert.doesNotMatch(yml, /playwright install/);
    assert.doesNotMatch(yml, /- name: Instalar (Chromium|WebKit) do Playwright/);
  });

  test(`${w}: a imagem é a oficial, na MESMA versão do @playwright/test instalado`, () => {
    assert.ok(yml.includes(IMAGEM), `falta ${IMAGEM}`);
    for (const m of yml.matchAll(/mcr\.microsoft\.com\/playwright:v([\d.]+)-noble/g)) assert.equal(m[1], versao, "a imagem e o pacote não podem desalinhar");
  });

  for (const [nome, job] of jobs(yml)) {
    const ps = passos(job);
    const comPlaywright = ps.filter((p) => p.split("\n").some((l) => !/^\s*#/.test(l) && /npx playwright /.test(l)));
    if (comPlaywright.length === 0) continue;
    test(`${w} › ${nome}: a imagem é baixada num passo próprio, com tentativas, antes do 1.º passo do Playwright`, () => {
      const iBaixar = ps.findIndex((p) => p.includes("- name: Baixar a imagem do Playwright"));
      assert.ok(iBaixar >= 0, "existe o passo de baixar a imagem");
      assert.match(ps[iBaixar], /docker pull/);
      assert.match(ps[iBaixar], /for i in 1 2 3/);
      assert.ok(iBaixar < ps.indexOf(comPlaywright[0]), "o pull vem antes");
    });
    test(`${w} › ${nome}: todo passo com \`npx playwright\` define a função que o manda para a imagem, antes da 1.ª chamada`, () => {
      for (const p of comPlaywright) {
        assert.match(p, /npx\(\) \{\n\s+if \[ "\$\{1:-\}" != playwright \]; then command npx "\$@"; return; fi/, p.split("\n")[0]);
        assert.match(p, /docker run --rm --network host --ipc host --user "\$\(id -u\):\$\(id -g\)"/);
        const semComentarios = p.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n");
        assert.ok(semComentarios.indexOf("npx() {") < semComentarios.indexOf("npx playwright "), "a função vem antes das chamadas");
      }
    });
  }
}

test("e2e.yml: o segredo do bypass da prévia da Vercel chega ao Playwright dentro da imagem", () => {
  const yml = readFileSync(".github/workflows/e2e.yml", "utf8");
  const e2e = jobs(yml).get("e2e")!;
  for (const p of passos(e2e).filter((p) => /npx playwright /.test(p))) assert.match(p, /VERCEL_AUTOMATION_BYPASS_SECRET/);
});
