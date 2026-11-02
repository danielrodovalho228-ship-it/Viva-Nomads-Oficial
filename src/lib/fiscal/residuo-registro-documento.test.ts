/*
  Varredura ampliada — registrarDocumento (médio): o registro oficial dos documentos da Viva (número público, versão,
  hash, conferência em /conferir). Duas leituras não conferiam o erro:
   - a versão anterior (nova versão do mesmo documento): na falha, "sem anterior" → o documento ganhava um NÚMERO NOVO
     do contador em vez da versão seguinte do mesmo número (a v2 de um contrato descolada da v1);
   - a marca de teste das partes: na falha, o documento de uma conta de teste era registrado como real.
  Agora as duas lançam ErroRegistro — o mesmo caminho que a falha do próprio registro já seguia em quem chama.
  Roda: node --test src/lib/fiscal/residuo-registro-documento.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./registro.ts", import.meta.url), "utf8");
const fn = src.slice(src.indexOf("export async function registrarDocumento"), src.indexOf("\n}\n", src.indexOf("export async function registrarDocumento")));

test("nova versão: a falha ao ler a anterior lança (nunca um número novo do contador)", () => {
  assert.match(fn, /const \{ data: anterior, error: erroAnterior \} = await admin/);
  const g = fn.indexOf('if (erroAnterior) throw new ErroRegistro(');
  assert.ok(g > 0 && g < fn.indexOf("numero ??= await numeroDoContador("), "antes de tirar número do contador");
});

test("a falha ao ler a marca de teste das partes lança (nunca registro real por engano)", () => {
  assert.match(fn, /const \{ data: perfis, error: erroPerfis \} = partes\.length/);
  const g = fn.indexOf('if (erroPerfis) throw new ErroRegistro(');
  assert.ok(g > 0 && g < fn.indexOf('admin.rpc("registrar_documento"'));
});
