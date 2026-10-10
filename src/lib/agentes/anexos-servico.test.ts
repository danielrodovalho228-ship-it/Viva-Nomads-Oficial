import test from "node:test";
import assert from "node:assert/strict";
import { enviarAnexo, abrirAnexo, type DepsAnexos } from "./anexos-servico.ts";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

function deps(over: Partial<DepsAnexos> = {}): DepsAnexos & { guardados: string[] } {
  const guardados: string[] = [];
  return {
    guardados,
    adminId: async () => A,
    novoId: () => B,
    guardar: async (caminho) => {
      guardados.push(caminho);
      return true;
    },
    assinar: async (caminho) => `https://x/assinada/${caminho}`,
    ...over,
  };
}

const pdf = { nome: "../contrato.pdf", mime: "application/pdf", bytes: 1000, conteudo: new Uint8Array(1) };

test("admin envia PDF: vai para <admin>/<id>.pdf e o nome do cliente não entra no caminho", async () => {
  const d = deps();
  const r = await enviarAnexo(d, pdf);
  assert.equal(r.status, 200);
  assert.deepEqual(d.guardados, [`${A}/${B}.pdf`]);
  assert.equal((r.body as { nome: string }).nome, "contrato.pdf");
});

test("quem não é admin recebe 403 e nada é guardado", async () => {
  const d = deps({ adminId: async () => null });
  const r = await enviarAnexo(d, pdf);
  assert.equal(r.status, 403);
  assert.equal(d.guardados.length, 0);
});

test("tipo não aceito (exe) e arquivo acima de 20 MB dão 400", async () => {
  const d = deps();
  assert.equal((await enviarAnexo(d, { ...pdf, mime: "application/x-msdownload" })).status, 400);
  assert.equal((await enviarAnexo(d, { ...pdf, bytes: 21 * 1024 * 1024 })).status, 400);
  assert.equal(d.guardados.length, 0);
});

test("falha ao guardar não vaza detalhe interno", async () => {
  const d = deps({ guardar: async () => false });
  const r = await enviarAnexo(d, pdf);
  assert.equal(r.status, 500);
  assert.doesNotMatch(JSON.stringify(r.body), /bucket|storage|sql/i);
});

test("abrir: só o próprio caminho; de outro admin ou com .. dá 404; não-admin 403", async () => {
  assert.equal((await abrirAnexo(deps(), `${A}/${B}.pdf`)).status, 200);
  assert.equal((await abrirAnexo(deps(), `${B}/${B}.pdf`)).status, 404);
  assert.equal((await abrirAnexo(deps(), `${A}/../${B}/x.pdf`)).status, 404);
  assert.equal((await abrirAnexo(deps({ adminId: async () => null }), `${A}/${B}.pdf`)).status, 403);
});
