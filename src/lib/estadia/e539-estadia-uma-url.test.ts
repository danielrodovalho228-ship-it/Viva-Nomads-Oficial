/*
  E539 (i) — a mesma estadia do morador em duas URLs: /dashboard/locacoes/<id> (o contrato) e /dashboard/estadia/<id>
  (a página da estadia), sem relação entre elas na URL. Correção: a estadia tem UMA URL, /dashboard/estadia/<id>; o
  contrato dela mora logo abaixo, em /dashboard/estadia/<id>/contrato. O endereço antigo /dashboard/locacoes/<id>
  (e-mails, avisos e favoritos já enviados) redireciona para lá; nenhum link do código aponta mais para ele.
  O dono segue com /dashboard/contratos/<id> (fora do E539, que é o painel do morador).
  Roda: node --test src/lib/estadia/e539-estadia-uma-url.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { HREF_CONTRATO_DA_ESTADIA, HREF_ESTADIA } from "./estadia.ts";
import { rotaDetalheContrato } from "../contrato-rota.ts";

const SRC = new URL("../../", import.meta.url).pathname;
const ler = (p: string) => readFileSync(join(SRC, p), "utf8");
const ID = "3f2c1a9e-1b2d-4c3e-8f4a-5b6c7d8e9f01";

test("o contrato do morador fica dentro da URL da estadia", () => {
  assert.equal(HREF_CONTRATO_DA_ESTADIA(ID), `${HREF_ESTADIA(ID)}/contrato`);
});

test("/dashboard/locacoes/<id> só redireciona para o contrato da estadia", () => {
  const antiga = ler("app/(dashboard)/dashboard/locacoes/[id]/page.tsx");
  assert.match(antiga, /permanentRedirect\(HREF_CONTRATO_DA_ESTADIA\(id\)\)/);
  assert.doesNotMatch(antiga, /<ContratoDetalhe\b/);
  const nova = ler("app/(dashboard)/dashboard/estadia/[contratoId]/contrato/page.tsx");
  assert.match(nova, /<ContratoDetalhe\s+id=\{contratoId\}\s+voltarHref=\{HREF_ESTADIA\(contratoId\)\}/);
  assert.match(nova, /<FalarComAViva\b/);
});

test("o proxy devolve 404 de verdade também no contrato da estadia", () => {
  assert.deepEqual(rotaDetalheContrato(HREF_CONTRATO_DA_ESTADIA(ID)), { tipo: "id", id: ID });
  assert.deepEqual(rotaDetalheContrato("/dashboard/estadia/123/contrato"), { tipo: "invalida" });
  // A página da estadia em si tem o próprio notFound/redirect do convidado: o proxy não mexe nela.
  assert.equal(rotaDetalheContrato(HREF_ESTADIA(ID)), null);
});

function arquivos(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) arquivos(p, out);
    else if (/\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n)) out.push(p);
  }
  return out;
}

test("nenhum link do código aponta para /dashboard/locacoes/<id>", () => {
  const achados = arquivos(SRC)
    .filter((p) => /\/dashboard\/locacoes\/\$\{/.test(readFileSync(p, "utf8")))
    .map((p) => p.slice(SRC.length));
  assert.deepEqual(achados, []);
});
