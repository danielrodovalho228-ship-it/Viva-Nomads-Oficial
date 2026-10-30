import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizarRegrasPets, linhasRegrasPets, compatibilidadePets, textoValorPet, linhaValorPetCandidatura, linhaPetsPublica, linhaCompatibilidadePets, erroRegrasPets } from "./pets-regras.ts";

const boa = { especies: ["cao", "gato"], porteMax: "M", qtdMax: 2, reforcoCaucao: 500, regrasCondominio: "Só no elevador de serviço" };

test("regras válidas passam e são normalizadas", () => {
  const r = normalizarRegrasPets(boa);
  assert.deepEqual(r?.especies, ["cao", "gato"]);
  assert.equal(r?.porteMax, "M");
  // Campo único: o reforço antigo vira Caução pet e o legado fica zerado.
  assert.equal(r?.reforcoCaucao, 0);
  assert.equal(r?.valorPet, 500);
  assert.equal(r?.valorPetTipo, "reembolsavel");
});

test("valor pet novo vence o reforço antigo; legado não soma", () => {
  const r = normalizarRegrasPets({ ...boa, valorPet: 200, valorPetTipo: "nao_reembolsavel" });
  assert.equal(r?.valorPet, 200);
  assert.equal(r?.valorPetTipo, "nao_reembolsavel");
  assert.equal(r?.reforcoCaucao, 0);
});

test("servidor recusa forma inválida", () => {
  assert.equal(normalizarRegrasPets(null), null);
  // E263-A: espécie é opcional — sem nenhuma válida marcada, vale qualquer animal.
  assert.deepEqual(normalizarRegrasPets({ ...boa, especies: [] })?.especies, ["cao", "gato", "outro"]);
  assert.deepEqual(normalizarRegrasPets({ ...boa, especies: ["dragao"] })?.especies, ["cao", "gato", "outro"]);
  assert.equal(normalizarRegrasPets({ ...boa, porteMax: "GG" }), null);
  assert.equal(normalizarRegrasPets({ ...boa, qtdMax: 9 }), null);
  assert.equal(normalizarRegrasPets({ ...boa, qtdMax: 0 }), null);
  assert.equal(normalizarRegrasPets({ ...boa, reforcoCaucao: -1 }), null);
  assert.equal(normalizarRegrasPets({ ...boa, reforcoCaucao: 1e9 }), null);
  assert.equal(normalizarRegrasPets({ ...boa, reforcoCaucao: 0, valorPet: 100001 }), null);
  assert.equal(normalizarRegrasPets({ ...boa, regrasCondominio: "x".repeat(201) }), null);
});

test("texto do condomínio perde caracteres de controle", () => {
  const r = normalizarRegrasPets({ ...boa, regrasCondominio: "a\u0000b\n\nc" });
  assert.equal(r?.regrasCondominio, "a b c");
});

test("linhas do anúncio mostram espécies, porte, quantidade e Caução", () => {
  const l = linhasRegrasPets(normalizarRegrasPets(boa)!).join(" | ");
  assert.match(l, /Aceita: cão e gato/);
  assert.match(l, /Porte máximo: médio/);
  assert.match(l, /Até 2 animais/);
  assert.match(l, /Caução pet R\$ 500,00 — devolvida no fim/);
  assert.doesNotMatch(l, /Reforço/);
  assert.doesNotMatch(l, /vistoria|temporada/i);
});

test("compatibilidade: porte, espécie, quantidade e imóvel sem pet", () => {
  const r = normalizarRegrasPets(boa);
  assert.equal(compatibilidadePets(true, r, [{ especie: "cao", porte: "P" }]).ok, true);
  const grande = compatibilidadePets(true, r, [{ especie: "cao", porte: "G" }]);
  assert.equal(grande.ok, false);
  assert.match(grande.motivos[0], /porte máximo/);
  assert.equal(compatibilidadePets(true, r, [{ especie: "outro", porte: "P" }]).ok, false);
  assert.equal(compatibilidadePets(true, r, Array(3).fill({ especie: "gato", porte: "P" })).ok, false);
  assert.equal(compatibilidadePets(false, null, [{ especie: "gato", porte: "P" }]).ok, false);
  assert.equal(compatibilidadePets(true, null, [{ especie: "gato", porte: "G" }]).ok, true);
  assert.equal(compatibilidadePets(false, null, []).ok, true);
});

test("ligações: servidor valida ao gravar, anúncio mostra, migração é idempotente", async () => {
  const { readFileSync } = await import("node:fs");
  const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
  assert.match(ler("src/lib/data/actions.ts"), /normalizarRegrasPets\(input\.petsRegras\)/);
  // E263-A: a página mostra "Aceita pets" e as condições numa linha só.
  assert.match(ler("src/components/property/stay-rules.tsx"), /linhaPetsPublica\(true, property\.petsRegras\)/);
  const sql = ler("supabase/producao/aplicar-0119.sql");
  assert.match(sql, /add column if not exists pets_regras/);
  assert.match(sql, /^begin;/m);
  assert.match(sql, /commit;\s*$/);
  assert.match(sql, /0119_pets_regras/);
});

test("valor pet: Caução pet reembolsável e Taxa pet não reembolsável", () => {
  const cau = normalizarRegrasPets({ ...boa, valorPet: "300", valorPetTipo: "reembolsavel" });
  assert.equal(cau?.valorPet, 300);
  assert.equal(textoValorPet(cau), "Caução pet R$ 300,00 — devolvida no fim");
  const taxa = normalizarRegrasPets({ ...boa, valorPet: 150.5, valorPetTipo: "nao_reembolsavel" });
  assert.equal(textoValorPet(taxa), "Taxa pet R$ 150,50 — não reembolsável");
  assert.match(linhasRegrasPets(taxa!).join(" | "), /Taxa pet R\$ 150,50 — não reembolsável/);
  assert.doesNotMatch(linhasRegrasPets(taxa!).join(" | "), /vistoria|aluguel|comissão/i);
});

test("valor pet é opcional e o servidor recusa valor ruim", () => {
  const sem = normalizarRegrasPets({ ...boa, reforcoCaucao: 0 });
  assert.equal(sem?.valorPet, 0);
  assert.equal(textoValorPet(sem), null);
  assert.equal(normalizarRegrasPets({ ...boa, reforcoCaucao: 0, valorPet: "" })?.valorPet, 0);
  assert.equal(normalizarRegrasPets({ ...boa, valorPet: -1 }), null);
  assert.equal(normalizarRegrasPets({ ...boa, valorPet: 1e9 }), null);
  assert.equal(normalizarRegrasPets({ ...boa, valorPet: "abc" }), null);
  assert.equal(normalizarRegrasPets({ ...boa, valorPet: 100, valorPetTipo: "outro" }), null);
  assert.equal(normalizarRegrasPets({ ...boa, valorPet: 100 })?.valorPetTipo, "reembolsavel");
});

test("imóvel que não aceita pet não grava valor pet; só o dono grava", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../../../src/lib/data/actions.ts", import.meta.url), "utf8");
  assert.match(src, /input\.petsAllowed \? normalizarRegrasPets\(input\.petsRegras\) : null/);
  assert.match(src, /update\(\{ pets_regras: regras \}\)\.eq\("id", id\)\.eq\("owner_id", user\.id\)/);
});

test("candidatura: valor pet em linha própria, só com pet na ficha e imóvel que aceita (ordem 0a746da1, parte 3)", () => {
  const regras = normalizarRegrasPets({ ...boa, reforcoCaucao: 0, valorPet: 300, valorPetTipo: "nao_reembolsavel" });
  assert.equal(linhaValorPetCandidatura(true, regras, 1), "Valor pet: Taxa pet R$ 300,00 — não reembolsável");
  const caucao = normalizarRegrasPets({ ...boa, reforcoCaucao: 0, valorPet: 450, valorPetTipo: "reembolsavel" });
  assert.equal(linhaValorPetCandidatura(true, caucao, 2), "Valor pet: Caução pet R$ 450,00 — devolvida no fim");
  // negativos: sem pet na candidatura, imóvel sem pet, sem valor, sem regras
  assert.equal(linhaValorPetCandidatura(true, regras, 0), null);
  assert.equal(linhaValorPetCandidatura(false, regras, 1), null);
  assert.equal(linhaValorPetCandidatura(undefined, regras, 1), null);
  assert.equal(linhaValorPetCandidatura(true, normalizarRegrasPets({ ...boa, reforcoCaucao: 0 }), 1), null);
  assert.equal(linhaValorPetCandidatura(true, null, 1), null);
});

test("E263-A: tudo opcional — porte, quantidade, taxa mensal e observação; sem nada além do sim, vale o aceite geral", () => {
  assert.equal(normalizarRegrasPets({ especies: [], porteMax: "", qtdMax: "", taxaMensal: "", observacao: "" }), null);
  assert.equal(normalizarRegrasPets({}), null);
  const so = normalizarRegrasPets({ especies: [], taxaMensal: 50 })!;
  assert.deepEqual(so.especies, ["cao", "gato", "outro"]);
  assert.equal(so.porteMax, undefined);
  assert.equal(so.qtdMax, undefined);
  assert.equal(linhaPetsPublica(true, so), "Aceita pets · Taxa pet R$ 50,00/mês");
  assert.equal(linhaPetsPublica(false, so), "Não aceita pets");
  assert.equal(linhaPetsPublica(true, null), "Aceita pets");
});

test("E263-A: 'Aceita pets' + condições numa linha só; 3 = '3 ou mais'", () => {
  const r = normalizarRegrasPets({ especies: ["cao", "gato", "outro"], porteMax: "M", qtdMax: "2", taxaMensal: "80", observacao: "Gatos castrados." })!;
  assert.equal(r.taxaMensal, 80);
  assert.equal(linhaPetsPublica(true, r), "Aceita pets · porte até médio · até 2 animais · Taxa pet R$ 80,00/mês · Gatos castrados.");
  const tres = normalizarRegrasPets({ especies: ["cao"], qtdMax: 3 })!;
  assert.equal(linhaPetsPublica(true, tres), "Aceita pets · cão · 3 ou mais animais");
});

test("E263-A: o servidor recusa observação longa e valores inválidos, com a mensagem em português", () => {
  assert.equal(erroRegrasPets({ observacao: "x".repeat(140) }), null);
  assert.match(erroRegrasPets({ observacao: "x".repeat(141) }) ?? "", /até 140 caracteres/);
  assert.match(erroRegrasPets({ taxaMensal: -5 }) ?? "", /taxa mensal/i);
  assert.match(erroRegrasPets({ porteMax: "GG" }) ?? "", /porte/);
  assert.match(erroRegrasPets({ qtdMax: 4 }) ?? "", /quantidade/);
  assert.equal(normalizarRegrasPets({ especies: ["cao"], observacao: "x".repeat(141) }), null);
});

test("E263-A: compatibilidade neutra só com porte e quantidade dos dois lados; nunca bloqueia", () => {
  const completo = normalizarRegrasPets({ especies: ["cao", "gato"], porteMax: "M", qtdMax: 1 })!;
  const grande = [{ especie: "cao" as const, porte: "G" as const }];
  const pequeno = [{ especie: "gato" as const, porte: "P" as const }];
  // 1. dentro das condições
  assert.deepEqual(linhaCompatibilidadePets(true, completo, pequeno), { dentro: true, texto: "Seus pets estão dentro das condições do dono." });
  // 2. fora: "confira com o dono", com o motivo
  const fora = linhaCompatibilidadePets(true, completo, grande)!;
  assert.equal(fora.dentro, false);
  assert.match(fora.texto, /^Confira com o dono: .*porte máximo/);
  // 3. o dono não informou porte ou quantidade (ou o morador não tem pet): nenhuma linha
  assert.equal(linhaCompatibilidadePets(true, normalizarRegrasPets({ especies: ["cao"], porteMax: "M" }), grande), null);
  assert.equal(linhaCompatibilidadePets(true, normalizarRegrasPets({ especies: ["cao"], qtdMax: 2 }), grande), null);
  assert.equal(linhaCompatibilidadePets(true, completo, []), null);
});

test("E263-A: Passo 6 e editor usam o mesmo bloco; a proposta pré-preenche a taxa só com pet no perfil", () => {
  const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
  assert.match(ler("app/(dashboard)/dashboard/imoveis/novo/etapa-encontramos.tsx"), /\{p\.petsOk && <PetsRegrasCampos value=\{p\.petsRegras\} onChange=\{p\.setPetsRegras\} \/>\}/);
  assert.match(ler("app/(dashboard)/dashboard/imoveis/novo/page.tsx"), /petsRegras: petsOk \? petsRegras : undefined/);
  assert.match(ler("app/(dashboard)/dashboard/imoveis/[id]/editar/editar-client.tsx"), /<PetsRegrasCampos value=\{petsRegras\}/);
  const prop = ler("lib/data/propostas-actions.ts");
  assert.match(prop, /from\("pets_inquilino"\)\.select\("id", \{ count: "exact", head: true \}\)\.eq\("user_id", tenantId\)/);
  assert.match(prop, /return \(count \?\? 0\) > 0 \? taxa : 0;/);
});
