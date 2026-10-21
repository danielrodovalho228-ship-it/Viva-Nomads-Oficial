import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

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
  assert.match(yml, /exit "\$\{PIPESTATUS\[0\]\}"/);
  assert.doesNotMatch(yml, /continue-on-error/);
});

test("portão de PR: a suíte completa não roda em PR e, na main e no noturno, falha deixa o job vermelho", () => {
  const lab = readFileSync(".github/workflows/laboratorio.yml", "utf8");
  const gatilhos = lab.split("\npermissions:")[0];
  assert.doesNotMatch(gatilhos, /^\s+pull_request:/m);
  assert.match(gatilhos, /push:\s+branches: \[main\]/);
  assert.match(gatilhos, /schedule:/);
  assert.match(lab, /- name: Marcar a execução como falha se algum teste falhou\n\s+if: \$\{\{ steps\.e2e\.outcome == 'failure'/);
});
