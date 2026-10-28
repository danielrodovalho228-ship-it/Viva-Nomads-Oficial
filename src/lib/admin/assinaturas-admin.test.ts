/*
  E197 — o detalhe do contrato no admin não diz "Nenhuma assinatura ainda" quando o contrato tem as duas datas.
  Roda: node --test src/lib/admin/assinaturas-admin.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TEXTO_SEM_HASH, assinaturasDoAdmin } from "./assinaturas-admin.ts";

const cmp = { estado: "igual" as const, texto: "igual ao resumo atual" };
const ler = (rel: string) => readFileSync(new URL(`../../../${rel}`, import.meta.url), "utf8");

test("datas no contrato sem registro com hash (VN-CT-D5D50247): as duas assinaturas aparecem, sem hash", () => {
  const a = assinaturasDoAdmin([], { proprietario: "2026-09-30T15:00:00Z", inquilino: "2026-09-30T15:30:00Z" });
  assert.deepEqual(a.map((x) => [x.papel, x.em, x.hash]), [["proprietario", "2026-09-30T15:00:00Z", null], ["inquilino", "2026-09-30T15:30:00Z", null]]);
  assert.match(TEXTO_SEM_HASH, /Sem o registro do hash/);
});

test("o registro com hash vale; a data do contrato só completa o papel que falta", () => {
  const a = assinaturasDoAdmin([{ papel: "inquilino", em: "2026-10-02T10:00:00Z", hash: "abc", comparacao: cmp }], { proprietario: "2026-10-01T10:00:00Z", inquilino: "2026-10-02T10:00:00Z" });
  assert.deepEqual(a.map((x) => [x.papel, x.hash]), [["proprietario", null], ["inquilino", "abc"]]);
  assert.equal(assinaturasDoAdmin([], { proprietario: null, inquilino: null }).length, 0);
});

test("o detalhe usa as duas fontes; o pacote de provas segue só com os registros com hash", () => {
  const dados = ler("src/lib/data/contrato-admin.ts");
  assert.match(dados, /assinado_proprietario_em, assinado_inquilino_em/);
  assert.match(dados, /assinaturas: assinaturasDoAdmin\(/);
  assert.match(dados, /montarDadosProvas\(\{[\s\S]*assinaturas: ass \?\? \[\]/);
  const tela = ler("src/app/(dashboard)/admin/contratos/[id]/page.tsx");
  assert.match(tela, /data-testid="admin-assinatura-sem-hash"/);
});

test("E197 lista × detalhe no MESMO contrato (VN-CT-D5D50247: as duas datas, sem hash, sem pagamento): assinaturas e selo iguais", async () => {
  const { seloParaEquipe } = await import("../contrato-estado.ts");
  const { faltaAssinar } = await import("./indicadores.ts");
  const linha = { status: "ativo", assinado_proprietario_em: "2026-10-25T15:17:28Z", assinado_inquilino_em: "2026-10-25T15:30:00Z", pagamentos_bloco: [] };
  // Lista: a linha de assinatura e o selo pela fonte única.
  assert.equal(faltaAssinar({ assinadoDono: true, assinadoInquilino: true }), "Assinado pelas duas partes");
  const seloLista = seloParaEquipe(linha);
  // Detalhe: as duas assinaturas (das datas do contrato) e o MESMO selo.
  const ass = assinaturasDoAdmin([], { proprietario: linha.assinado_proprietario_em, inquilino: linha.assinado_inquilino_em });
  assert.equal(ass.length, 2, "nunca 'Nenhuma assinatura ainda.' com as duas datas");
  assert.equal(seloLista, "Aguardando 1º pagamento", "assinado pelas duas e sem pagamento: o próximo passo é o 1º pagamento");
  // Pagamento anulado não conta (nem na lista nem no detalhe: as duas leem anulado_em).
  assert.equal(seloParaEquipe({ ...linha, pagamentos_bloco: [{ tipo: "aluguel", confirmado_pelo_inquilino: true, anulado_em: "2026-10-26T10:00:00Z" }] }), "Aguardando 1º pagamento");
  assert.equal(seloParaEquipe({ ...linha, pagamentos_bloco: [{ tipo: "aluguel", confirmado_pelo_inquilino: true, anulado_em: null }] }), "Em vigência");
});

test("GUARDA E197: lista e detalhe leem as mesmas colunas de estado e o mesmo selo (um fato, uma fonte)", () => {
  const detalhe = ler("src/lib/data/contrato-assinar-actions.ts");
  const lista = ler("src/lib/data/admin-indicadores.ts");
  const pagina = ler("src/app/(dashboard)/admin/contratos/page.tsx");
  for (const [nome, fonte] of [["detalhe", detalhe], ["lista", lista]] as const) {
    assert.match(fonte, /pagamentos_bloco\(tipo, confirmado_pelo_inquilino, anulado_em\)/, `${nome}: lê anulado_em`);
    assert.match(fonte, /seloParaEquipe\(/, `${nome}: selo pela fonte única`);
  }
  assert.match(pagina, /data-testid="contrato-selo">\{c\.selo\}/, "a lista mostra o selo único, não o status cru");
  assert.doesNotMatch(pagina, /\{STATUS\[c\.status\] \?\? c\.status\}/);
  assert.match(ler("src/lib/data/contrato-admin.ts"), /assinaturasDoAdmin\(/);
});
