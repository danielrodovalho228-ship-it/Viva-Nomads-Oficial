/*
  E614 (achado da Pista 3 no #3946, t2123): um "Continuar" dado nos primeiros ~2 s depois de abrir o rascunho confirma
  preço/garantia/período na tela, mas a confirmação nunca era gravada. O primeiro autosave depois de abrir só fixa a base
  (E516) e o `confirmados` é campo de navegação (não conta como edição) — então a confirmação era engolida pela base e,
  sem outra mudança, nunca ia para o servidor.
  Regra: dentro da janela da base, uma confirmação grava EM SILÊNCIO (sem "Salvo às"); sem confirmação nem edição,
  abrir continua a não gravar nada (E516).
  Roda: node --test src/lib/anuncio/e614-confirmados-gravam-na-base.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decisaoAutosave } from "./salvo-fantasma.ts";

const pagina = readFileSync(new URL("../../app/(dashboard)/dashboard/imoveis/novo/page.tsx", import.meta.url), "utf8");

test("E614 — na janela da base, confirmar (sem editar) grava em silêncio; sem nada, abrir continua a ser só a base", () => {
  const c = '{"a":1}';
  assert.equal(decisaoAutosave({ aguardandoBase: true, editou: false, confirmou: true, base: null, conteudo: c }), "silencioso");
  assert.equal(decisaoAutosave({ aguardandoBase: true, editou: false, confirmou: false, base: null, conteudo: c }), "base");
  assert.equal(decisaoAutosave({ aguardandoBase: true, editou: true, confirmou: true, base: null, conteudo: c }), "edicao");
});

test("E614 — o assistente marca a confirmação (confirmouRef) e o autosave da base grava quando houve confirmação", () => {
  assert.match(pagina, /const confirmouRef = useRef\(false\)/);
  // toda confirmação passa pelo mesmo `confirmar` (Continuar e os botões do Passo 8)
  assert.match(pagina, /const confirmar = \(\.\.\.c: CampoConfirmavel\[\]\) => \{\s*confirmouRef\.current = true;/);
  // abrir um rascunho zera a marca junto com a da edição
  assert.match(pagina, /aguardandoBaseRef\.current = true;\s*editouRef\.current = false;\s*confirmouRef\.current = false;/);
  // na janela da base, sem edição: só sai sem gravar se não houve confirmação (nem troca de passo — E614 retomar)
  assert.match(pagina, /decisaoAutosave\(\{ aguardandoBase: true, confirmou: confirmouRef\.current, navegou, base: null, conteudo \}\) !== "silencioso"\) return;\s*decisao = "silencioso";/);
});
