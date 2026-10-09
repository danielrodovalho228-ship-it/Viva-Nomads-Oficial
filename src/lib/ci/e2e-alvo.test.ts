import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

function alvo(env: Record<string, string>): Record<string, string> {
  const out = execFileSync("bash", ["scripts/ci/e2e-alvo.sh"], {
    env: { NODE_ENV: "test", PATH: process.env.PATH ?? "", ...env },
    encoding: "utf8",
  });
  return Object.fromEntries(
    out.trim().split("\n").map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
  );
}

test("deploy de Production usa o domínio próprio, mesmo sem bypass", () => {
  const r = alvo({ EVENTO: "deployment_status", AMBIENTE: "Production", TARGET_URL: "https://x-abc.vercel.app", TEM_BYPASS: "false" });
  assert.equal(r.base_url, "https://vivanomads.com.br");
  assert.equal(r.rodar, "true");
  assert.equal(r.bypass, "false");
});

test("preview com bypass usa a URL do deploy e envia o bypass", () => {
  const r = alvo({ EVENTO: "deployment_status", AMBIENTE: "Preview", TARGET_URL: "https://x-abc.vercel.app", TEM_BYPASS: "true" });
  assert.equal(r.base_url, "https://x-abc.vercel.app");
  assert.equal(r.rodar, "true");
  assert.equal(r.bypass, "true");
});

test("preview sem bypass é pulado com aviso (caso negativo: não fica vermelho)", () => {
  const r = alvo({ EVENTO: "deployment_status", AMBIENTE: "Preview", TARGET_URL: "https://x-abc.vercel.app", TEM_BYPASS: "false" });
  assert.equal(r.rodar, "false");
  assert.match(r.aviso, /pulado/);
});

test("disparo manual usa a URL informada", () => {
  const r = alvo({ EVENTO: "workflow_dispatch", INPUT_URL: "https://vivanomads.com.br", TEM_BYPASS: "false" });
  assert.equal(r.base_url, "https://vivanomads.com.br");
  assert.equal(r.rodar, "true");
});

test("e2e.yml usa o script e não depende do bypass para produção", () => {
  const y = readFileSync(".github/workflows/e2e.yml", "utf8");
  assert.match(y, /scripts\/ci\/e2e-alvo\.sh/);
  assert.doesNotMatch(y, /TESTES_BASE_URL: \$\{\{ github\.event\.deployment_status\.target_url/);
});

test("produção roda só os specs públicos (sem login da conta de teste)", () => {
  const r = alvo({ EVENTO: "deployment_status", AMBIENTE: "Production", TARGET_URL: "https://x-abc.vercel.app", TEM_BYPASS: "false" });
  assert.equal(r.modo, "publico");
});

test("disparo manual na produção também é público; no preview segue completo", () => {
  assert.equal(alvo({ EVENTO: "workflow_dispatch", INPUT_URL: "https://vivanomads.com.br", TEM_BYPASS: "false" }).modo, "publico");
  assert.equal(alvo({ EVENTO: "deployment_status", AMBIENTE: "Preview", TARGET_URL: "https://x-abc.vercel.app", TEM_BYPASS: "true" }).modo, "completo");
});
