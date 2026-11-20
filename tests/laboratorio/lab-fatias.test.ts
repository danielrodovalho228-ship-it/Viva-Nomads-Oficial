import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { acharResultados, juntar } from "../../scripts/lab/juntar-resultados.mjs";

/**
 * E744 — a suíte noturna é fatiada em jobs paralelos (--shard) e depois consolidada: nenhuma fatia pode ficar de fora
 * (a matriz cobre 1..N e o --shard usa o mesmo N), cada fatia entrega o resultado, e um consolidar grava UMA linha.
 */
const yml = readFileSync(".github/workflows/laboratorio.yml", "utf8");

test("a matriz cobre as fatias 1..N e o --shard usa o mesmo N", () => {
  const matriz = /fatia:\s*\[([^\]]+)\]/.exec(yml)?.[1]?.split(",").map((x) => Number(x.trim())) ?? [];
  const n = Number(/--shard=\$\{\{ matrix\.fatia \}\}\/(\d+)/.exec(yml)?.[1]);
  assert.ok(n >= 8, `fatias = ${n}`);
  // 20 gerais + 4 da varredura t48 (E744): a matriz tem n + PESADAS fatias (os casos 21..24 do case do workflow).
  // Asserção alterada pela T3 do plano de 17/11: com 1 worker as gerais passam de 16 para 20 e a varredura vai para 21..24.
  const pesadas = ["21", "22", "23", "24"].filter((k) => new RegExp(`\\n\\s+${k}\\) GREP=`).test(yml)).length;
  assert.equal(pesadas, 4);
  // Asserção alterada pela T3 do plano de 17/11 (E744): mais UMA fatia, a 25, só dos specs @sensivel-carga com 1 worker.
  const carga = /elif \[ "\$F" = 25 \]; then\n\s+LAB_PESADOS=fora npx playwright test --grep "@sensivel-carga"/.test(yml) ? 1 : 0;
  assert.equal(carga, 1);
  assert.deepEqual(matriz, Array.from({ length: n + pesadas + carga }, (_, i) => i + 1));
  assert.match(yml, /name: laboratorio \(fatia \$\{\{ matrix\.fatia \}\}\/\d+\)/);
  assert.equal(Number(/name: laboratorio \(fatia \$\{\{ matrix\.fatia \}\}\/(\d+)\)/.exec(yml)?.[1]), n + pesadas + carga, "o nome do job diz o total de fatias");
  assert.match(yml, /--esperadas \d+/);
  assert.equal(Number(/--esperadas (\d+)/.exec(yml)?.[1]), n + pesadas + carga, "o consolidar espera o mesmo número de fatias");
  assert.match(yml, /fail-fast: false/, "uma fatia vermelha não cancela as outras");
});

test("cada fatia guarda o próprio artifact e o consolidar grava uma linha só", () => {
  assert.match(yml, /name: laboratorio-\$\{\{ github\.run_id \}\}-fatia-\$\{\{ matrix\.fatia \}\}/);
  assert.match(yml, /pattern: laboratorio-\$\{\{ github\.run_id \}\}-fatia-\*/);
  assert.equal([...yml.matchAll(/- name: Registrar no banco/g)].length, 1);
  const [fatia, consolidar] = yml.split("  consolidar:");
  assert.ok(consolidar, "job consolidar existe");
  assert.doesNotMatch(fatia, /Registrar no banco/, "a fatia não grava no banco");
  // ORDEM-DUET-207: o consolidar espera também a guarda do agendado duplicado (peça 25).
  assert.match(consolidar, /needs: \[guarda, laboratorio\]/);
  assert.match(consolidar, /if: \$\{\{ !cancelled\(\) && needs\.guarda\.outputs\.coberta != 'true' \}\}/);
  assert.match(consolidar, /needs\.laboratorio\.result != 'success'/, "vermelho se alguma fatia falhou");
});

test("juntar: concatena as suites e soma os stats; fatia sem arquivo não derruba", () => {
  const j = juntar([
    { stats: { expected: 3, unexpected: 1, skipped: 0 }, suites: [{ file: "t1.spec.ts" }] },
    { stats: { expected: 5, unexpected: 0, skipped: 2 }, suites: [{ file: "t2.spec.ts" }, { file: "t3.spec.ts" }] },
  ]);
  assert.equal(j.suites.length, 3);
  assert.deepEqual([j.stats.expected, j.stats.unexpected, j.stats.skipped], [8, 1, 2]);
  assert.equal(juntar([]).suites.length, 0);
  const raiz = mkdtempSync(join(tmpdir(), "fatias-"));
  for (const n of ["a", "b"]) {
    mkdirSync(join(raiz, n, "tests", "laboratorio", "saida"), { recursive: true });
    writeFileSync(join(raiz, n, "tests", "laboratorio", "saida", "resultado.json"), "{}");
  }
  assert.equal(acharResultados(raiz).length, 2);
  assert.deepEqual(acharResultados(join(raiz, "nao-existe")), []);
});

test("o resumo da suíte inteira vai ao banco por arquivo, nunca como argumento do psql (E2BIG, run 42536824482)", () => {
  const consolidar = yml.split("  consolidar:")[1];
  assert.doesNotMatch(consolidar, /-v resumo=/, "o resumo passa de 128 KB: não pode ir em argv");
  assert.doesNotMatch(consolidar, /-v categoria=/);
  assert.match(consolidar, /\\set resumo `cat "\$RESUMO_ARQ"`/);
  assert.match(consolidar, /:'resumo'::jsonb/);
});

test("o supabase start da fatia tenta 5 vezes e reinicia o Docker da 2ª em diante (porta 54322 presa, fatias 11 e 4)", () => {
  // E792: o laço mora em scripts/lab/subir-supabase.sh (o mesmo dos 4 jobs), que além disso troca a porta presa do banco.
  const fatia = yml.split("  consolidar:")[0];
  assert.match(fatia, /run: scripts\/lab\/subir-supabase\.sh/);
  const script = readFileSync("scripts/lab/subir-supabase.sh", "utf8");
  assert.match(script, /TENTATIVAS="\$\{1:-5\}"/);
  assert.match(script, /if \[ "\$tentativa" -ge 2 \]; then sudo systemctl restart docker/);
  assert.match(script, /supabase start falhou \$TENTATIVAS vezes/);
});

test("a varredura t48 (cadeia serial de ~100 min) sai das fatias gerais e roda em 4 fatias próprias, uma por grupo de testes", () => {
  const cfg = readFileSync("playwright.config.ts", "utf8");
  assert.match(cfg, /export const SPECS_PESADOS = \/t48-varredura\\\.spec\\\.ts\//);
  assert.match(cfg, /testIgnore: process\.env\.LAB_PESADOS === "fora" \? SPECS_PESADOS : undefined/);
  assert.match(yml, /LAB_PESADOS=fora npx playwright test --shard=\$\{\{ matrix\.fatia \}\}\/20/);
  assert.match(yml, /npx playwright test t48-varredura --grep "\$GREP"/);
  assert.match(yml, /if \[ "\$F" -le 20 \]/);
  // Os 4 grupos cobrem os 6 testes do t48 sem sobrepor: visitante (3) + uma fatia por persona logada (3).
  const spec = readFileSync("tests/e2e/specs/t48-varredura.spec.ts", "utf8");
  assert.match(spec, /mode: "serial"/, "a razão da separação: a cadeia é serial");
  for (const g of ["inquilino: todas as telas logadas", "proprietário: todas as telas logadas", "admin: todas as telas logadas"]) assert.ok(yml.includes(g), g);
  for (const t of ["visitante: todas as rotas do sitemap", "visitante a 1280 px", "endereços inexistentes", "sitemap limpo"]) assert.ok(spec.includes(t), t);
});

test("as fatias da varredura t48 têm teto maior que as gerais (a do admin levou 56 min) e cabem no timeout do job", () => {
  const job = Number(/timeout-minutes:\s*(\d+)/.exec(yml)?.[1]);
  const geral = Number(/LAB_PESADOS=fora[^\n]*--global-timeout=(\d+)/.exec(yml)?.[1]);
  const varredura = Number(/t48-varredura[^\n]*--global-timeout=(\d+)/.exec(yml)?.[1]);
  assert.ok(varredura > geral, `varredura ${varredura} > geral ${geral}`);
  assert.ok(varredura >= 90 * 60_000, "folga sobre os 56 min medidos");
  assert.ok(varredura < job * 60_000 - 10 * 60_000, "sobra tempo do job para preparo e para guardar o resultado");
});

// E744 (decisão do Gerente, 16/11/2026, aprovada pelo Daniel): além do artefato, o disparo manual grava as imagens refeitas
// num ramo de evidência descartável (`linhas-de-base-evidencia`), porque o armazenamento dos artefatos não é alcançável por
// toda sessão. A regra que este teste guarda continua: a GERAÇÃO é só leitura e nada é comitado em ramo de trabalho;
// aprovar imagem é decisão humana, via PR. A única escrita é a do job `publicar-evidencia`, coberta em
// tests/laboratorio/e744-linhas-de-base-evidencia.test.ts.
test("a rotina de linhas de base visuais (E744) gera sem escrever: não comita, não faz push em ramo de trabalho, cobre os 3 specs de captura", () => {
  const w = readFileSync(".github/workflows/linhas-de-base.yml", "utf8");
  assert.match(w, /npx playwright test t245-visual-regressao t263-visual-41 t271-admin-visual --update-snapshots/);
  assert.match(w, /actions\/upload-artifact@v4/);
  assert.match(w, /node-version: "24\.22\.1"/);
  assert.match(w, /permissions:\s*\n\s*contents: read/, "somente leitura: aprovar imagem é decisão humana, via PR");
  assert.doesNotMatch(w, /git (commit|push)/);
  const gerar = w.slice(w.indexOf("  gerar:"), w.indexOf("  publicar-evidencia:"));
  assert.ok(gerar.includes("--update-snapshots"), "o job que gera as imagens");
  assert.doesNotMatch(gerar, /contents: write/, "o job que gera as imagens não tem permissão de escrita");
  assert.equal((w.match(/contents: write/g) ?? []).length, 1, "só o job publicar-evidencia escreve, e só no ramo de evidência");
  // mesmo ambiente do laboratório: mesmas etapas de banco, seed, build e site
  // E792: o Supabase sobe pelo script comum dos jobs do laboratório.
  // E1040: o navegador é o da imagem oficial do Playwright, o MESMO em que a suíte compara as imagens desde o E1037 (#4034).
  for (const passo of ["scripts/lab/subir-supabase.sh", "seed-lab.mjs", "npm run build", "next start -p 3123", "docker pull mcr.microsoft.com/playwright:v"]) assert.ok(w.includes(passo), passo);
  assert.doesNotMatch(w, /playwright install/);
  // os 3 specs existem com esse nome
  for (const f of ["t245-visual-regressao", "t263-visual-41", "t271-admin-visual"]) assert.ok(readFileSync(`tests/e2e/specs/${f}.spec.ts`, "utf8").length > 0, f);
});

// E744: sob 2 workers no runner, 17 testes estouravam os 45 s do gate de PR (t78, t71, t176, t778…); as fatias gerais da noite dão 90 s por teste.
test("fatias gerais do noturno dão 90 s por teste (o gate de PR segue em 45 s)", () => {
  const yml = readFileSync(".github/workflows/laboratorio.yml", "utf8");
  assert.match(yml, /--shard=\$\{\{ matrix\.fatia \}\}\/20[^\n]*--timeout=90000/);
  assert.match(readFileSync("playwright.config.ts", "utf8"), /timeout: 45_000/);
});

// E1037 (ORDEM-DUET-212/213) substitui o desenho E744 da instalação (Chromium primeiro e sozinho, WebKit que não derruba a
// fatia): os navegadores vêm na imagem oficial do Playwright e nenhuma fatia instala com apt (lab-imagem-playwright.test.ts).
test("E744/E1037: nenhuma fatia instala navegadores; a imagem do Playwright é baixada antes da suíte", () => {
  const y = readFileSync(".github/workflows/laboratorio.yml", "utf8");
  const fatias = y.slice(y.indexOf("\n  laboratorio:\n"), y.indexOf("\n  construir:\n"));
  assert.doesNotMatch(fatias, /playwright install/);
  assert.ok(fatias.indexOf("- name: Baixar a imagem do Playwright") > 0 && fatias.indexOf("- name: Baixar a imagem do Playwright") < fatias.indexOf("- name: Rodar a suíte E2E"));
});
