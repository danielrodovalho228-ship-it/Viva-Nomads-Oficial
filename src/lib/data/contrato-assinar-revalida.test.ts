/*
  Lab t205/t57: depois de assinar, a tela do contrato (inquilino em Minhas locações, dono em Contratos) tem de trazer o
  aviso novo na MESMA resposta da Server Action — sem depender só do router.refresh() do cliente.
  Roda: node --test src/lib/data/contrato-assinar-revalida.test.ts
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const fonte = readFileSync(new URL("./contrato-assinar-actions.ts", import.meta.url), "utf8");
const corpoAssinar = fonte.slice(fonte.indexOf("export async function assinarContrato"));

test("assinarContrato revalida o detalhe do contrato dos dois lados e as listas, depois de gravar", () => {
  assert.match(fonte, /import \{ revalidatePath \} from "next\/cache"/);
  assert.match(corpoAssinar, /revalidatePath\("\/dashboard\/locacoes\/\[id\]", "page"\)/);
  assert.match(corpoAssinar, /revalidatePath\("\/dashboard\/contratos\/\[id\]", "page"\)/);
  assert.match(corpoAssinar, /revalidatePath\("\/dashboard\/contratos"\)/);
  assert.match(corpoAssinar, /revalidatePath\("\/dashboard\/locacoes"\)/);
  assert.ok(
    corpoAssinar.indexOf("revalidatePath(") > corpoAssinar.indexOf('update({ [coluna]: agora })'),
    "revalidar só depois de gravar a assinatura",
  );
});
