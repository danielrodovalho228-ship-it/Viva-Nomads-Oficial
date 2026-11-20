/* Roda: node --test src/lib/anuncio/e1035-rascunho-sem-dados-abre-das-colunas.test.ts
   E1035 (ORDEM-DUET-179, 19/11/2026; era a Dúvida 1 do #4015). O rascunho cuja linha tem as colunas e as fotos mas não
   tem `draft_data` abria com o formulário vazio. O E1034 impediu que abrir gravasse por cima; editar um campo ainda
   gravava o formulário (com o resto vazio) por cima das outras colunas e das fotos.
   Regra: esse rascunho abre com o que a linha tem gravado, pela MESMA carga da edição (`aplicarImovel`); abrir não é
   editar (E516); e, se a carga falhar, o rascunho não abre (nada é gravado por cima). */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pagina = readFileSync("src/app/(dashboard)/dashboard/imoveis/novo/page.tsx", "utf8");

test("E1035: a carga da edição é uma função só, usada pela edição e pelo rascunho sem draft_data", () => {
  const fn = pagina.slice(pagina.indexOf("function aplicarImovel(p: ImovelGravado) {"), pagina.indexOf("function aplicarImovelComoBase("));
  assert.ok(fn.length > 0, "a função existe");
  // O que a gravação do rascunho escreve nas colunas e nas tabelas-filhas tem de vir carregado: título, cidade, preço,
  // bairro, quartos, banheiros, área, descrição, a operação, a chegada e as fotos.
  for (const carga of [
    /setTitle\(p\.title \|\| ""\);/,
    /setCity\(p\.city \|\| "Uberlândia"\);/,
    /setMonthlyPrice\(p\.monthlyPrice \? String\(p\.monthlyPrice\) : ""\);/,
    /setNeighborhood\(p\.neighborhood \|\| ""\);/,
    /setBedrooms\(p\.bedrooms \? String\(p\.bedrooms\) : ""\);/,
    /setBathrooms\(p\.bathrooms \? String\(p\.bathrooms\) : ""\);/,
    /setAreaM2\(p\.areaM2 \? String\(p\.areaM2\) : ""\);/,
    /setDescription\(p\.description \|\| ""\);/,
    /setOwnershipType\(operacaoValida\(p\.ownershipType\) \? p\.ownershipType : "own"\);/,
    /setChegada\(formDeChegada\(p\.chegadaEPedido\)\);/,
    /setPhotos\(\(p\.photos \|\| \[\]\)\.map\(\(url, i\) => \(\{ id: `edit-\$\{i\}`, url, name: "", path: null, demo: false \}\)\)\);/,
  ]) assert.match(fn, carga);
  // A edição usa a mesma função (a carga não foi copiada).
  const inicioDaEdicao = pagina.indexOf("const p = await loadPropertyForEdit(editId);");
  const edicao = pagina.slice(inicioDaEdicao, pagina.indexOf("}, [editId]);", inicioDaEdicao));
  assert.match(edicao, /setEditingId\(editId\);[\s\S]*?aplicarImovel\(p\);/);
  assert.doesNotMatch(edicao, /setTitle\(p\.title/);
});

test("E1035: o rascunho da URL sem draft_data abre com a linha gravada; sem conseguir carregar, não abre", () => {
  const abrir = pagina.slice(pagina.indexOf("const r = await abrirRascunho(draftParam)"), pagina.indexOf("// E660: sem ficha no rascunho"));
  const carga = abrir.indexOf("gravado = await loadPropertyForEdit(draftParam).catch(() => null);");
  const adota = abrir.indexOf("draftIdRef.current = draftParam;");
  assert.ok(carga > 0, "carrega o imóvel gravado");
  assert.match(abrir, /if \(rascunhoAbertoSemDados\(d\)\) \{\s+gravado = await loadPropertyForEdit\(draftParam\)/);
  // A falha da carga fecha o rascunho ANTES de o assistente adotar o id (sem id adotado, nada grava nesta linha).
  assert.match(abrir, /if \(!gravado\) \{\s+setFechado\(\{ id: draftParam, motivo: "indisponivel" \}\);\s+return;\s+\}/);
  assert.ok(carga < adota, "a carga vem antes de adotar o rascunho");
  assert.match(abrir, /if \(d && typeof d === "object"\) aplicarDraft\(d as Record<string, unknown>\);\s+else if \(gravado\) aplicarImovelComoBase\(gravado\);/);
});

test("E1035: abrir não é editar — o estado carregado é a base do autosave", () => {
  const fn = pagina.slice(pagina.indexOf("function aplicarImovelComoBase("), pagina.indexOf("const p = await loadPropertyForEdit(editId);"));
  assert.match(fn, /aguardandoBaseRef\.current = true;\s+editouRef\.current = false;\s+confirmouRef\.current = false;\s+navegacaoBaseRef\.current = null;\s+aplicarImovel\(p\);/);
});
