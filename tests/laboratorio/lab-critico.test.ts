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
