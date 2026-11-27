/*
  Roda: node --test tests/laboratorio/e744-t3-sensivel-carga.test.ts
  E744, T3 (plano de 17/11): instabilidade por carga.

  O spec que falha 1 vez em 3 rodando em paralelo e passa 15 de 15 sozinho ganha a etiqueta @sensivel-carga.
  Uma fatia própria (a 25) roda só esses specs, com 1 worker; as fatias gerais os excluem.
  A lista dos etiquetados, com a medida que justifica cada um, fica em tests/laboratorio/sensiveis-a-carga.json.
  Não é quarentena: a fatia 25 bloqueia como as outras e os testes dela entram no veredito da noite.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";

type Entrada = { spec: string; item?: string; sozinho: { passou: number; rodou: number }; emParalelo: { falhou: number; rodou: number }; nasCorridas: string; medidoEm: string };
const SPECS = "tests/e2e/specs";
const ETIQUETA = "@sensivel-carga";
const arquivo = JSON.parse(readFileSync("tests/laboratorio/sensiveis-a-carga.json", "utf8")) as { etiqueta: string; entradas: Entrada[] };
const yml = readFileSync(".github/workflows/laboratorio.yml", "utf8");
const fatia = yml.slice(yml.indexOf("\n  laboratorio:"), yml.indexOf("\n  construir:"));
const consolidar = yml.slice(yml.indexOf("\n  consolidar:"));

test("cada etiquetado tem a medida que o plano pede: passa sozinho pelo menos 15 de 15 e falha em paralelo", () => {
  assert.equal(arquivo.etiqueta, ETIQUETA);
  assert.ok(arquivo.entradas.length > 0);
  for (const e of arquivo.entradas) {
    assert.ok(existsSync(`${SPECS}/${e.spec}`), `${e.spec}: o spec não existe`);
    assert.ok(e.sozinho.rodou >= 15 && e.sozinho.passou === e.sozinho.rodou, `${e.spec}: sozinho ${e.sozinho.passou} de ${e.sozinho.rodou}`);
    assert.ok(e.emParalelo.falhou >= 1 && e.emParalelo.rodou >= e.emParalelo.falhou, `${e.spec}: sem falha medida em paralelo`);
    assert.ok(e.nasCorridas.length > 10, `${e.spec}: sem o que se viu nas corridas`);
    assert.match(e.medidoEm, /^\d{4}-\d{2}-\d{2}$/);
  }
  assert.equal(new Set(arquivo.entradas.map((e) => e.spec)).size, arquivo.entradas.length, "um spec por entrada");
});

test("a etiqueta está no describe de topo de cada spec da lista, e em nenhum outro spec", () => {
  const comEtiqueta = readdirSync(SPECS).filter((f) => f.endsWith(".spec.ts") && readFileSync(`${SPECS}/${f}`, "utf8").includes(ETIQUETA));
  assert.deepEqual(comEtiqueta.sort(), arquivo.entradas.map((e) => e.spec).sort());
  for (const e of arquivo.entradas) {
    const fonte = readFileSync(`${SPECS}/${e.spec}`, "utf8");
    // No describe de topo (começo de linha): o spec inteiro muda de fatia, e a cadeia em série dele não se parte.
    assert.match(fonte, /^test\.describe\("[^"\n]+", \{ tag: \["@sensivel-carga"\] \}, \(\) => \{$/m, `${e.spec}: etiqueta fora do describe de topo`);
    assert.equal((fonte.match(/@sensivel-carga/g) ?? []).length, 1, `${e.spec}: a etiqueta aparece uma vez`);
  }
});

test("a etiqueta não é pulo: os specs etiquetados não ganharam test.skip, .only nem mais tentativas", () => {
  const pulosDeAntes: Record<string, number> = { "t194-passo1-ia-cep.spec.ts": 1, "t646-cadastro-titulo-nao-pula.spec.ts": 1 };
  for (const e of arquivo.entradas) {
    const fonte = readFileSync(`${SPECS}/${e.spec}`, "utf8");
    assert.equal((fonte.match(/test\.(skip|fixme)\(/g) ?? []).length, pulosDeAntes[e.spec], `${e.spec}: o número de pulos mudou`);
    assert.doesNotMatch(fonte, /\.only\(|retries:/);
  }
});

test("a fatia 25 roda só os etiquetados, com 1 worker, e bloqueia como as outras", () => {
  assert.match(fatia, /fatia: \[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25\]/);
  const linha = /[^\n]*npx playwright test --grep "@sensivel-carga"[^\n]*/.exec(fatia)?.[0] ?? "";
  assert.match(linha, /LAB_PESADOS=fora npx playwright test --grep "@sensivel-carga" "\$\{FORA\[@\]\}" --pass-with-no-tests /);
  assert.match(linha, /--workers=1 /);
  assert.doesNotMatch(linha, /--shard|--repeat-each|--retries/);
  assert.match(fatia, /elif \[ "\$F" = 25 \]; then/);
  // Bloqueia: é uma fatia de verdade (artifact "fatia-25", conta nas esperadas) e só a quarentena fica fora do veredito.
  assert.match(consolidar, /juntar-resultados\.mjs fatias tests\/laboratorio\/saida\/resultado\.json --esperadas 25/);
  assert.match(consolidar, /numeros-por-fatia\.mjs fatias --esperadas 25 /);
  assert.doesNotMatch(yml, /--esperadas (20|21)\b/);
  assert.match(fatia, /matrix\.fatia != 'quarentena' \}\}\n\s+run: exit 1/);
});

test("as fatias gerais excluem os etiquetados e a quarentena, num --grep-invert só", () => {
  assert.match(fatia, /GERAL=\(--grep-invert "@sensivel-carga\$\{QUARENTENA:\+\|\$QUARENTENA\}"\)/);
  assert.match(fatia, /LAB_PESADOS=fora npx playwright test --shard=\$\{\{ matrix\.fatia \}\}\/\d+ "\$\{GERAL\[@\]\}" /);
  // O padrão junto casa um teste etiquetado e um teste em quarentena, e não casa o resto.
  const quarentena = "(^| )(t29-chat-sem-aprovacao\\.spec\\.ts (.* )?x( @|$))";
  const junto = new RegExp(`@sensivel-carga|${quarentena}`, "gi");
  const casa = (t: string) => new RegExp(junto.source, "gi").test(t);
  assert.ok(casa(" chromium t646-cadastro-titulo-nao-pula.spec.ts T646 — cadastro @sensivel-carga 390 px — mesma altura"));
  assert.ok(casa(" chromium t29-chat-sem-aprovacao.spec.ts T29 x"));
  assert.ok(!casa(" chromium t1-home.spec.ts a home abre"));
});

test("a listagem do commit continua com os etiquetados: eles rodam na fatia 25 e entram na completude", () => {
  const construir = yml.slice(yml.indexOf("\n  construir:"), yml.indexOf("\n  consolidar:"));
  assert.match(construir, /npx playwright test --list --reporter=json "\$\{FORA\[@\]\}" > lista\.json/);
  assert.doesNotMatch(construir, /sensivel-carga/);
});

test("o resumo e o nome do job dizem 25 fatias", () => {
  assert.match(fatia, /name: laboratorio \(fatia \$\{\{ matrix\.fatia \}\}\/25\)/);
  assert.match(consolidar, /\(25 fatias: 20 gerais \+ 4 da varredura t48 \+ 1 dos sensíveis à carga\)/);
});

test("fatias gerais com 1 worker e em 20 partes (medida de 17/11); no máximo 20 jobs ao mesmo tempo", () => {
  const geral = /[^\n]*--shard=\$\{\{ matrix\.fatia \}\}\/20[^\n]*/.exec(fatia)?.[0] ?? "";
  assert.match(geral, /--workers=1 /);
  assert.doesNotMatch(fatia, /--workers=2/);
  assert.match(fatia, /elif \[ "\$F" -le 20 \]; then/);
  // A varredura vai para 21..24, com os mesmos quatro grupos.
  for (const [n, g] of [["21", "visitante|endereços inexistentes|sitemap limpo"], ["22", "inquilino: todas as telas logadas"], ["23", "proprietário: todas as telas logadas"], ["24", "admin: todas as telas logadas"]]) {
    assert.ok(fatia.includes(`${n}) GREP="${g}" ;;`), `fatia ${n}`);
  }
  assert.match(fatia, /max-parallel: 20\n/);
  // O teto das gerais não mudou (65 min): com 1 worker e 16 fatias a maior chegou a 62 min; com 20, cada uma leva menos.
  assert.match(geral, /--global-timeout=3900000/);
  // A medida que justifica a troca está no arquivo dos sensíveis à carga, para a decisão ficar junto do que ela muda.
  const medida = JSON.parse(readFileSync("tests/laboratorio/sensiveis-a-carga.json", "utf8")).medida;
  assert.equal(medida.run, 44091181966);
  assert.ok(medida.umWorker.instaveisNasGerais < Math.min(...medida.doisWorkers.instaveisNasGerais), "1 worker derrubou a instabilidade");
  assert.ok(medida.umWorker.maiorFatiaMin <= 65, "cada fatia coube no teto das gerais");
});

test("o portão de PR (lab-critico) também respeita a etiqueta: os etiquetados rodam à parte, com 1 worker, com a mesma exigência", () => {
  // Caso real (17/11, #3960): o PR que etiquetou o t646 teve o lab-critico reprovado porque o portão rodou o t646 com 2
  // workers, ao lado dos outros specs, e ele ficou instável — o mesmo motivo da etiqueta.
  const critico = readFileSync(".github/workflows/lab-critico.yml", "utf8");
  const passo = critico.slice(critico.indexOf("- name: Rodar os fluxos críticos"), critico.indexOf("- name: Resultado (cole no corpo do PR)"));
  const linhas = passo.split("\n").filter((l) => l.includes("npx playwright test"));
  assert.equal(linhas.length, 2, "duas corridas: o resto e os etiquetados");
  const [resto, carga] = linhas;
  assert.match(resto, /"\$\{SPECS\[@\]\}" --grep-invert "@sensivel-carga" /);
  assert.match(resto, /--workers=2 --retries=1 --fail-on-flaky-tests/);
  assert.match(carga, /"\$\{SPECS\[@\]\}" --grep "@sensivel-carga" /);
  assert.match(carga, /--workers=1 --retries=1 --fail-on-flaky-tests --pass-with-no-tests/);
  // Qualquer uma das duas vermelha reprova o portão; nenhuma perdoa instável.
  assert.match(passo, /\[ "\$RESTO" -eq 0 \] && \[ "\$CARGA" -eq 0 \] \|\| exit 1/);
  assert.doesNotMatch(passo, /--retries=[2-9]|\|\| true/);
  // O resultado das duas corridas vai para o resumo do job.
  const resultado = critico.slice(critico.indexOf("- name: Resultado (cole no corpo do PR)"));
  assert.match(resultado, /e2e-carga\.txt/);
});
