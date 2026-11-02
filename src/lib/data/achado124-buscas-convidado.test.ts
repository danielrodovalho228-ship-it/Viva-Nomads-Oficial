/*
  Frente 1, rodada 3 — achado 124 (média-baixa): a mescla das buscas do convidado (ao entrar na conta) lia as buscas da
  conta sem conferir o erro. Na falha, gravava as do aparelho em dobro e passava do limite de buscas salvas. Agora a
  falha não grava e devolve ok: false — o aparelho guarda as buscas para a próxima mescla.
  Roda: node --test src/lib/data/achado124-buscas-convidado.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("mescla de buscas: sem as buscas da conta, não grava; o aparelho só apaga as dele com ok", () => {
  const src = ler("./convidado-actions.ts");
  const fn = src.slice(src.indexOf("export async function mesclarBuscasConvidado"));
  const guarda = fn.indexOf("if (error) return { ok: false, salvas: 0 };");
  assert.ok(guarda > 0 && guarda < fn.indexOf('.from("buscas_salvas").insert('), "a guarda vem antes de gravar");
  assert.match(ler("../convidado/mesclar.ts"), /const r = await a\.mesclarBuscasConvidado\(buscas\);\s*if \(r\.ok\) \{/);
});
