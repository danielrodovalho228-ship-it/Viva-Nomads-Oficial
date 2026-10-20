import { test } from "node:test";
import assert from "node:assert/strict";
import { testRouteForbidden, emProducaoVercel } from "./test-guard.ts";

function comEnv<T>(env: Record<string, string | undefined>, fn: () => T): T {
  const antes: Record<string, string | undefined> = {};
  for (const k of Object.keys(env)) {
    antes[k] = process.env[k];
    if (env[k] === undefined) delete process.env[k];
    else process.env[k] = env[k];
  }
  try {
    return fn();
  } finally {
    for (const k of Object.keys(env)) {
      if (antes[k] === undefined) delete process.env[k];
      else process.env[k] = antes[k];
    }
  }
}

const req = (qs = "") => new Request(`https://vivanomads.com.br/api/test-email${qs}`);

test("produção na Vercel: 404 com chave, sem chave e com chave errada", () => {
  comEnv({ VERCEL_ENV: "production", TEST_ROUTES_KEY: "segredo" }, () => {
    assert.equal(testRouteForbidden(req())?.status, 404);
    assert.equal(testRouteForbidden(req("?key=segredo"))?.status, 404);
    assert.equal(testRouteForbidden(req("?key=errada"))?.status, 404);
  });
});

test("produção: o corpo do 404 não revela que a rota existe", async () => {
  await comEnv({ VERCEL_ENV: "production", TEST_ROUTES_KEY: "segredo" }, async () => {
    const texto = await testRouteForbidden(req())!.text();
    assert.doesNotMatch(texto, /TEST_ROUTES_KEY|protegida/i);
  });
});

test("preview: segue 403 sem chave e libera com a chave certa", () => {
  comEnv({ VERCEL_ENV: "preview", TEST_ROUTES_KEY: "segredo" }, () => {
    assert.equal(testRouteForbidden(req())?.status, 403);
    assert.equal(testRouteForbidden(req("?key=errada"))?.status, 403);
    assert.equal(testRouteForbidden(req("?key=segredo")), null);
  });
});

test("sem TEST_ROUTES_KEY fora de produção: bloqueada (403)", () => {
  comEnv({ VERCEL_ENV: "preview", TEST_ROUTES_KEY: undefined }, () => {
    assert.equal(testRouteForbidden(req("?key=x"))?.status, 403);
  });
});

test("emProducaoVercel só é verdadeiro com VERCEL_ENV=production", () => {
  assert.equal(comEnv({ VERCEL_ENV: "production" }, emProducaoVercel), true);
  assert.equal(comEnv({ VERCEL_ENV: "preview" }, emProducaoVercel), false);
  assert.equal(comEnv({ VERCEL_ENV: undefined }, emProducaoVercel), false);
});
