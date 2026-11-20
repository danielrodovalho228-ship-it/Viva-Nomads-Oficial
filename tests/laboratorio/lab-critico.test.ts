import { test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Ordem d86d0678 (trava de lab verde): todo PR e todo merge na main rodam um conjunto curto de fluxos
 * críticos e publicam o status check "lab-critico". A lista mora em tests/laboratorio/fluxos-criticos.json.
 */
const yml = readFileSync(".github/workflows/lab-critico.yml", "utf8");
const { fluxos } = JSON.parse(readFileSync("tests/laboratorio/fluxos-criticos.json", "utf8")) as {
  fluxos: Record<string, string[]>;
};

test("cobre os cinco fluxos pedidos, cada um com ao menos um spec", () => {
  for (const f of ["login", "publicar-anuncio", "candidatura-contrato-assinatura", "abrir-chamado", "upload-de-foto"]) {
    assert.ok(fluxos[f]?.length > 0, `fluxo sem spec: ${f}`);
  }
});

test("todo spec da lista existe em tests/e2e/specs", () => {
  for (const spec of Object.values(fluxos).flat()) {
    assert.ok(existsSync(`tests/e2e/specs/${spec}.spec.ts`), `spec inexistente: ${spec}`);
  }
});

test("o workflow roda em todo PR e na main, e o job se chama lab-critico", () => {
  assert.match(yml, /\n {2}pull_request:\n(?! {4}paths)/, "pull_request sem filtro de paths");
  assert.match(yml, /push:\n\s+branches: \[main\]/);
  assert.match(yml, /\n {2}lab-critico:\n {4}name: lab-critico\n/);
});

test("o workflow lê a lista do arquivo e não usa segredo de produção", () => {
  assert.match(yml, /scripts\/lab\/fluxos-criticos\.mjs/);
  assert.doesNotMatch(yml, /secrets\./);
  assert.match(yml, /INTEGRACOES_SIMULADAS: "on"/);
});

test("o script imprime um spec por linha, na ordem do arquivo", () => {
  const saida = execFileSync("node", ["scripts/lab/fluxos-criticos.mjs"], { encoding: "utf8" }).trim().split("\n");
  assert.deepEqual(saida, Object.values(fluxos).flat().map((s) => `${s}.spec.ts`));
});

/**
 * Portão de PR (decisão do Muse, 21/10): em PR o lab-critico roda a lista crítica + os specs do próprio PR, e falha
 * (inclusive "só passou no retry") deixa o job vermelho. A suíte completa sai do PR e fica na main e no noturno.
 */
test("portão de PR: a lista crítica vem primeiro; specs alterados entram uma vez, só os que existem em tests/e2e/specs", async () => {
  const { specsDoPortao } = (await import("../../scripts/lab/fluxos-criticos.mjs")) as {
    specsDoPortao: (c: string[], a: string[], existe?: (p: string) => boolean) => string[];
  };
  const existe = (p: string) => p !== "tests/e2e/specs/t9-apagado.spec.ts";
  assert.deepEqual(
    specsDoPortao(
      ["t55-login", "t57-contrato"],
      [
        "tests/e2e/specs/t256-pagina-da-estadia.spec.ts",
        "tests/e2e/specs/t57-contrato.spec.ts", // já está na lista crítica
        "tests/e2e/specs/t256-pagina-da-estadia.spec.ts", // repetido
        "tests/e2e/specs/t9-apagado.spec.ts", // não existe mais
        "tests/e2e/fixtures/laboratorio.ts", // não é spec
        "tests/e2e/specs/sub/t1-x.spec.ts", // fora da pasta dos specs
      ],
      existe,
    ),
    ["t55-login.spec.ts", "t57-contrato.spec.ts", "t256-pagina-da-estadia.spec.ts"],
  );
  assert.deepEqual(specsDoPortao(["t55-login"], [], existe), ["t55-login.spec.ts"]);
});

test("portão de PR: o lab-critico usa a base do PR, reprova teste instável e não engole falha", () => {
  assert.match(yml, /fetch-depth: 0/);
  assert.match(yml, /BASE_SHA: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/);
  assert.match(yml, /fluxos-criticos\.mjs --alterados-desde "\$BASE_SHA"/);
  assert.match(yml, /--fail-on-flaky-tests/);
  // Asserção alterada pela T3 do plano de 17/11 (E744): o portão faz duas corridas (o resto com 2 workers e os specs
  // @sensivel-carga com 1). Cada uma guarda a saída do Playwright, e qualquer uma diferente de zero reprova o portão.
  assert.match(yml, /RESTO="\$\{PIPESTATUS\[0\]\}"/);
  assert.match(yml, /CARGA="\$\{PIPESTATUS\[0\]\}"/);
  assert.match(yml, /\[ "\$RESTO" -eq 0 \] && \[ "\$CARGA" -eq 0 \] \|\| exit 1/);
  assert.equal((yml.match(/--fail-on-flaky-tests/g) ?? []).length, 2, "as duas corridas reprovam instável");
  assert.doesNotMatch(yml, /continue-on-error/);
});

test("portão de PR: a suíte completa não roda em PR e, na main e no noturno, falha deixa o job vermelho", () => {
  const lab = readFileSync(".github/workflows/laboratorio.yml", "utf8");
  const gatilhos = lab.split("\npermissions:")[0];
  assert.doesNotMatch(gatilhos, /^\s+pull_request:/m);
  // Frente 0 (coordenador, 11/11/2026): sem push na main; a suíte inteira roda no agendado e no disparo manual.
  assert.doesNotMatch(gatilhos, /^\s+push:/m);
  assert.match(gatilhos, /workflow_dispatch:/);
  assert.match(gatilhos, /schedule:/);
  // E744: a suíte é fatiada; falha numa fatia deixa a fatia vermelha, e o consolidar fica vermelho se qualquer fatia falhou.
  assert.match(lab, /- name: Marcar a fatia como falha se algum teste falhou\n\s+if: \$\{\{ steps\.e2e\.outcome == 'failure'/);
  assert.match(lab, /- name: Marcar a execução como falha se alguma fatia falhou\n\s+if: \$\{\{ needs\.laboratorio\.result != 'success'/);
});

// ---------------------------------------------------------------------------------------------------------------------
// Instalação dos navegadores: E1040 (ORDEM-DUET-216, ponto 4; ORDEM-DUET-229) substitui a instalação resistente de 17/11
// (DUET-1819: 6 tentativas de 7 min de `playwright install --with-deps`, limpando a trava do dpkg). Pelo desenho do E1037
// (#4034), o lab-critico deixa de instalar navegadores com apt: baixa a imagem OFICIAL do Playwright, da mesma versão do
// pacote, e só `npx playwright …` corre nela. Os testes que prendiam o passo de instalação passam a prender o passo da
// imagem, com os mesmos limites de tempo dos testes e do job (ORDEM-DUET-216, ponto 2: a asserção acompanha a correção).
// ---------------------------------------------------------------------------------------------------------------------
const passoDaImagem = yml.slice(yml.indexOf("- name: Baixar a imagem do Playwright"), yml.indexOf("- name: Rodar os fluxos críticos"));
const TENTATIVAS = 3;
const SEGUNDOS_POR_TENTATIVA = 300;
const ESPERA_ENTRE_TENTATIVAS = 30;

test("a imagem do Playwright: 3 tentativas de 5 minutos, com espera entre elas; sem imagem, o passo reprova (nada de apt)", () => {
  assert.ok(passoDaImagem.length > 40, "existe o passo de baixar a imagem");
  assert.doesNotMatch(yml, /playwright install/);
  assert.match(passoDaImagem, /for i in 1 2 3; do\n/);
  assert.match(passoDaImagem, /timeout 300 docker pull mcr\.microsoft\.com\/playwright:v[\d.]+-noble && exit 0\n/);
  // A espera não acontece depois da última tentativa.
  assert.match(passoDaImagem, /if \[ "\$i" -lt 3 \]; then sleep 30; fi\n/);
  // Se nenhuma tentativa baixar, o passo reprova: nada de seguir sem navegador.
  assert.match(passoDaImagem, /\n {10}done\n {10}exit 1\n/);
  assert.doesNotMatch(passoDaImagem, /continue-on-error/);
});

test("a imagem do Playwright: os limites de tempo cabem — o job comporta o pull mais os testes, e os testes mantêm os 35 min", () => {
  const limiteDoPasso = Number(/timeout-minutes: (\d+)/.exec(passoDaImagem)?.[1]);
  assert.equal(limiteDoPasso, 15);
  // O teto do passo corta o pior caso das tentativas (3 × 5 min + 2 × 30 s); cortado, o passo reprova como sem imagem.
  assert.ok(limiteDoPasso * 60 <= TENTATIVAS * SEGUNDOS_POR_TENTATIVA + (TENTATIVAS - 1) * ESPERA_ENTRE_TENTATIVAS + 60);
  const passoDosTestes = yml.slice(yml.indexOf("- name: Rodar os fluxos críticos"), yml.indexOf("- name: Resultado (cole no corpo do PR)"));
  const limiteDosTestes = Number(/\n {8}timeout-minutes: (\d+)\n/.exec(passoDosTestes)?.[1]);
  assert.equal(limiteDosTestes, 35);
  const limiteDoJob = Number(/\n {4}timeout-minutes: (\d+)\n/.exec(yml)?.[1]);
  assert.ok(limiteDoJob >= 10 + limiteDoPasso + limiteDosTestes, `o job tem ${limiteDoJob} min para 10 de preparação + ${limiteDoPasso} + ${limiteDosTestes}`);
});

/** Roda o script do passo com comandos de mentira: o `docker pull` falha nas primeiras `falhas` chamadas e depois baixa. */
function rodarPull(falhas: number) {
  const script = passoDaImagem.slice(passoDaImagem.indexOf("run: |\n") + 7).split("\n").map((l) => l.replace(/^ {10}/, "")).join("\n");
  const dir = mkdtempSync(join(tmpdir(), "lab-critico-imagem-"));
  const cmd = (nome: string, corpo: string) => {
    writeFileSync(join(dir, nome), `#!/bin/bash\n${corpo}\n`);
    chmodSync(join(dir, nome), 0o755);
  };
  cmd("docker", `n=$(cat "${dir}/chamadas" 2>/dev/null || echo 0); n=$((n + 1)); echo $n > "${dir}/chamadas"; echo "docker $*" >> "${dir}/log"; [ "$n" -gt ${falhas} ]`);
  cmd("timeout", `echo "timeout $1" >> "${dir}/log"; shift; exec "$@"`);
  cmd("sleep", `echo "sleep $1" >> "${dir}/log"; exit 0`);
  writeFileSync(join(dir, "passo.sh"), script);
  const r = spawnSync("bash", ["-e", join(dir, "passo.sh")], { env: { ...process.env, PATH: `${dir}:/usr/bin:/bin` }, encoding: "utf8" });
  const log = existsSync(join(dir, "log")) ? readFileSync(join(dir, "log"), "utf8").trim().split("\n") : [];
  return { saida: r.status, texto: r.stdout, log };
}

test("a imagem do Playwright, rodando o passo de verdade: baixa na 2.ª tentativa depois de 1 falha; desiste na 3.ª com saída 1", () => {
  const segunda = rodarPull(1);
  assert.equal(segunda.saida, 0);
  assert.deepEqual(segunda.texto.trim().split("\n"), ["tentativa 1 do pull falhou"]);
  assert.equal(segunda.log.filter((l) => l.startsWith("docker pull mcr.microsoft.com/playwright:v")).length, 2);
  assert.equal(segunda.log.filter((l) => l === "timeout 300").length, 2);
  assert.equal(segunda.log.filter((l) => l === "sleep 30").length, 1, "uma espera depois da falha");
  // Runner bom: baixa de primeira, sem espera nenhuma.
  const primeira = rodarPull(0);
  assert.equal(primeira.saida, 0);
  assert.equal(primeira.log.filter((l) => l.startsWith("sleep")).length, 0);
  // Nunca baixa: três tentativas, duas esperas (nenhuma depois da última) e o passo reprova.
  const nunca = rodarPull(99);
  assert.equal(nunca.saida, 1);
  assert.equal(nunca.log.filter((l) => l.startsWith("docker")).length, 3);
  assert.equal(nunca.log.filter((l) => l === "sleep 30").length, 2);
  assert.match(nunca.texto, /tentativa 3 do pull falhou/);
});
