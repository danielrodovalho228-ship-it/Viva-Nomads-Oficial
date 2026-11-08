/*
  E708 (L-106) — o E66 moveu a lista de vínculos do LinkedIn de /dashboard/conta/privacidade para /dashboard/conta/seguranca,
  mas as rotas de retorno do fluxo continuavam apontando para a página antiga (sem a linha nem o aviso do resultado).
  Agora há UMA constante e as três rotas a usam. Roda: node --test src/lib/linkedin/e708-rotas-de-retorno.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { ROTA_CONTA_LINKEDIN } from "./rotas.ts";

const raiz = new URL("../../../", import.meta.url).pathname;
const ler = (p: string) => readFileSync(join(raiz, p), "utf8");

test("E708: a volta do LinkedIn é a página de Segurança (onde a lista e o aviso moram)", () => {
  assert.equal(ROTA_CONTA_LINKEDIN, "/dashboard/conta/seguranca");
});

test("E708: conectar, retorno e o cron do vencimento usam a constante, sem a rota antiga", () => {
  for (const f of ["src/app/api/conta/linkedin/conectar/route.ts", "src/app/api/conta/linkedin/retorno/route.ts"]) {
    const s = ler(f);
    assert.match(s, /import \{ ROTA_CONTA_LINKEDIN \} from "@\/lib\/linkedin\/rotas";/, f);
    assert.match(s, /const CONTA = ROTA_CONTA_LINKEDIN;/, f);
    assert.doesNotMatch(s, /conta\/privacidade/, f);
  }
  const cron = ler("src/app/api/cron/linkedin/route.ts");
  assert.match(cron, /"linkedin_vencendo", ROTA_CONTA_LINKEDIN\)/);
  assert.doesNotMatch(cron, /conta\/privacidade/);
});

test("E708: nenhum código do fluxo do LinkedIn aponta para Privacidade", () => {
  const achados: string[] = [];
  const varrer = (dir: string) => {
    for (const nome of readdirSync(join(raiz, dir))) {
      const rel = `${dir}/${nome}`;
      if (statSync(join(raiz, rel)).isDirectory()) varrer(rel);
      else if (/\.(ts|tsx)$/.test(nome) && !/\.test\./.test(nome) && /conta\/privacidade/.test(ler(rel))) achados.push(rel);
    }
  };
  for (const d of ["src/app/api/conta/linkedin", "src/app/api/cron/linkedin", "src/lib/linkedin"]) varrer(d);
  assert.deepEqual(achados, []);
});
