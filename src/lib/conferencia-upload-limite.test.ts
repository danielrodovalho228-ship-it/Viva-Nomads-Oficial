/*
  Lab t85 teste 4 (lab 2073af3): o laudo (até 15 MB) e a foto (até 8 MB) da conferência sobem por Server Action,
  e o Next recusa corpo acima de 1 MB por padrão — a recusa nunca chegava à validação do servidor.
  Roda: node --test src/lib/conferencia-upload-limite.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LAUDO_MAX_BYTES, FOTO_CONFERENCIA_MAX_BYTES } from "./conferencia.ts";

const MB = 1024 * 1024;

test("next.config: o corpo das Server Actions comporta o maior arquivo da conferência", () => {
  const cfg = readFileSync(new URL("../../next.config.ts", import.meta.url), "utf8");
  const m = cfg.match(/bodySizeLimit:\s*["'](\d+)\s*mb["']/i);
  assert.ok(m, "next.config.ts precisa de experimental.serverActions.bodySizeLimit (padrão do Next: 1 MB)");
  const limite = Number(m[1]) * MB;
  assert.ok(limite > LAUDO_MAX_BYTES, "o limite precisa ficar acima do laudo de 15 MB (o corpo leva campos a mais)");
  assert.ok(limite > FOTO_CONFERENCIA_MAX_BYTES);
});
