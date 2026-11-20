/*
  E477 (resíduo, re-prova de 06/11 23:31): a observadora da QA (só leitura) ainda via os controles de escrita HABILITADOS em
  três painéis — Pendências (Aceitar/Recusar da foto do nível, decidir contestação e revisão), Fotos de perfil
  (Aprovar/Remover) e Imóveis (Pausar) —, porque o dono dessas linhas é conta de TESTE e a regra do QA-LOGIN-B v2 libera dado de teste
  ao observador. Nestes três painéis a observadora é só leitura em TODA linha: o servidor recusa sem olhar o alvo e a tela
  não oferece o controle, mostrando "Só leitura" (o mesmo padrão do #3033).
  Roda: node --test src/lib/qa/e477-paineis-so-leitura.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { linhasSoLeitura } from "./observador-regras.ts";

const raiz = new URL("../../../", import.meta.url);
const ler = (p: string) => readFileSync(new URL(p, raiz), "utf8");

test("linha sem alvo é só leitura para a observadora MESMO com dono de teste; quem não é observadora nunca é afetada", () => {
  const donoDe = new Map([["properties:i1", "u-teste"]]);
  const teste = new Set(["u-teste"]);
  assert.deepEqual(linhasSoLeitura(true, [{ id: "a" }, { id: "b" }], donoDe, teste), ["a", "b"]);
  assert.deepEqual(linhasSoLeitura(true, [{ id: "a", alvo: { imoveis: ["i1"] } }], donoDe, teste), [], "com alvo de teste a regra antiga libera");
  assert.deepEqual(linhasSoLeitura(false, [{ id: "a" }], donoDe, teste), []);
});

test("servidor: as ações destes painéis recusam a observadora sem olhar o alvo (dado de teste incluído)", () => {
  const pausar = ler("src/lib/data/imoveis-admin-actions.ts");
  assert.match(pausar, /const recusaQa = await recusaObservador\(user\.id\);/);
  assert.doesNotMatch(pausar, /recusaObservador\(user\.id, \{/);

  const fotos = ler("src/lib/data/fotos-perfil-actions.ts");
  assert.equal((fotos.match(/const recusaQa = await recusaObservador\(a\.user\.id\);/g) ?? []).length, 2);
  assert.doesNotMatch(fotos, /recusaObservador\(a\.user\.id, \{/);

  assert.match(ler("src/lib/data/nivel-actions.ts"), /const recusaQa = await recusaObservador\(s\.uid\);\n\s*if \(recusaQa\) return \{ ok: false, erro: recusaQa \};\n\s*if \(!ehChaveNivel/);
  const conforto = ler("src/lib/data/conforto-actions.ts");
  assert.match(conforto, /if \(acao === "decidir"\) \{\n\s*const recusaQa = await recusaObservador\(s\.uid\);/);
  assert.match(ler("src/lib/data/avaliacoes-resposta-actions.ts"), /const recusaQa = await recusaObservador\(user\.id\);\n\s*if \(recusaQa\) return \{ ok: false, error: recusaQa \};\n\s*const \{ error \} = await adm\s*\.from\("avaliacao_contestacoes"\)/);
});

test("tela: Pendências, Fotos de perfil e Imóveis não oferecem o controle à observadora e mostram 'Só leitura'", () => {
  const pend = ler("src/app/(dashboard)/admin/pendencias/page.tsx");
  assert.match(pend, /alvosDaCentral\(admin, \[\.\.\.central\.linhas, \.\.\.central\.teste\], true\)/, "linhas da central sem alvo para a observadora");
  const alvos = ler("src/lib/qa/alvos-central.ts");
  assert.match(alvos, /semAlvo/);
  const fotos = ler("src/app/(dashboard)/admin/fotos-perfil/page.tsx");
  assert.match(fotos, /soLeituraNaTela\(fila\.map\(\(f\) => \(\{ id: f\.id \}\)\)\)/);
  const imoveis = ler("src/app/(dashboard)/admin/imoveis/page.tsx");
  assert.match(imoveis, /soLeituraNaTela\(pausaveis\.map\(\(i\) => \(\{ id: i\.id \}\)\)\)/);
  assert.match(imoveis, /SoLeituraQa/);
});
