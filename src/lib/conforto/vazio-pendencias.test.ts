/* Erros/estados vazios: falha ao ler as pendências do padrão mínimo nunca vira "sem pendências" (o painel sumia). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("pendenciasConforto devolve null na falha; a tela do contrato avisa em vez de esconder o painel", () => {
  const srv = readFileSync(new URL("./servidor.ts", import.meta.url), "utf8");
  const i = srv.indexOf("export async function pendenciasConforto(");
  const f = srv.slice(i, srv.indexOf("\n}\n", i));
  assert.match(f, /Promise<PendenciaParaTela\[\] \| null>/);
  assert.match(f, /if \(error\) return null;/);
  const tela = readFileSync(new URL("../../components/contrato/contrato-detalhe.tsx", import.meta.url), "utf8");
  assert.match(tela, /pendencias\.pendencias === null && \([\s\S]{0,200}data-testid="pendencias-conforto-indisponivel"/);
});
