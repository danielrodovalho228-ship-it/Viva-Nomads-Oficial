/*
  E223 — interesses de parceria no admin: botões pela ação que já existe, uma fonte só para a lista e o contador, e só
  admin com 2FA muda a situação. Roda: node --test src/lib/admin/interesse-parceria.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { STATUS_INTERESSE, botoesDoInteresse, diasDesde, ordenarInteresses, resumoInteresses } from "./interesse-parceria.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const acoes = ler("src/lib/parceiros/admin-actions.ts");
const acao = acoes.slice(acoes.indexOf("export async function atualizarStatusInteresse"), acoes.indexOf("// ── Prompt 31a"));
const pagina = ler("src/app/(dashboard)/admin/parceiros/page.tsx");
const lista = ler("src/app/(dashboard)/admin/parceiros/interesses.tsx");
const atalho = ler("src/app/(dashboard)/admin/atalhos-admin.tsx");
const fonte = ler("src/lib/admin/interesses-parceria.ts");

test("botões: novo → contatado → arquivado, arquivar direto e reabrir; nunca a situação atual", () => {
  assert.deepEqual(botoesDoInteresse("novo").map((b) => b.para), ["contatado", "arquivado"]);
  assert.deepEqual(botoesDoInteresse("contatado").map((b) => b.para), ["arquivado", "novo"]);
  assert.deepEqual(botoesDoInteresse("arquivado").map((b) => b.para), ["novo"]);
  assert.equal(botoesDoInteresse("arquivado")[0].rotulo, "Reabrir");
  assert.deepEqual(botoesDoInteresse("outra"), []);
  for (const s of STATUS_INTERESSE) for (const b of botoesDoInteresse(s)) assert.notEqual(b.para, s);
});

test("os destinos dos botões são exatamente os que a ação existente aceita (sem transição inventada)", () => {
  const aceitos = acoes.match(/const STATUS_VALIDOS: readonly StatusInteresse\[\] = \[([^\]]+)\]/)?.[1].match(/"(\w+)"/g)?.map((x) => x.replace(/"/g, ""));
  assert.deepEqual(aceitos, [...STATUS_INTERESSE]);
  const destinos = new Set(STATUS_INTERESSE.flatMap((s) => botoesDoInteresse(s).map((b) => b.para)));
  for (const d of destinos) assert.ok(aceitos!.includes(d));
  // A ação não restringe a situação de origem: "Reabrir" (arquivado → novo) cabe no desenho dela.
  assert.doesNotMatch(acao, /\.eq\("status"/);
});

test("contagem por situação e ordem: novos primeiro, o mais antigo no topo", () => {
  const itens = [
    { status: "arquivado" as const, criado_em: "2026-10-01T00:00:00Z" },
    { status: "novo" as const, criado_em: "2026-10-18T00:00:00Z" },
    { status: "contatado" as const, criado_em: "2026-10-05T00:00:00Z" },
    { status: "novo" as const, criado_em: "2026-10-12T00:00:00Z" },
  ];
  assert.deepEqual(resumoInteresses(itens), { novo: 2, contatado: 1, arquivado: 1 });
  assert.deepEqual(ordenarInteresses(itens).map((i) => i.criado_em.slice(0, 10)), ["2026-10-12", "2026-10-18", "2026-10-05", "2026-10-01"]);
  assert.equal(diasDesde("2026-10-12T12:00:00Z", new Date("2026-10-29T13:00:00Z")), 17);
});

test("uma fonte só: a lista e o contador da tela e o atalho do admin leem por lerInteressesParceria + resumoInteresses", () => {
  assert.match(fonte, /^import "server-only";/);
  assert.doesNotMatch(fonte, /^\s*["']use server["'];?\s*$/m, "a leitura não vira ação chamável pelo navegador");
  assert.match(pagina, /lerInteressesParceria\(sessao\)/);
  assert.match(pagina, /resumoInteresses\(interessesLidos \?\? \[\]\)/);
  assert.match(atalho, /lerInteressesParceria\(supabase\)\.then\(\(l\) => \(l \? resumoInteresses\(l\)\.novo : "—"\)\)/);
  assert.match(atalho, /href: "\/admin\/parceiros" \}/);
  // Nenhuma outra contagem própria da tabela.
  for (const t of [pagina, atalho]) assert.doesNotMatch(t, /from\("parceiros_interesse"\)/);
});

test("a tela usa a ação EXISTENTE (nenhuma ação nova) e só admin com 2FA a executa", () => {
  assert.match(lista, /^"use client";/);
  assert.match(lista, /import \{ atualizarStatusInteresse \} from "@\/lib\/parceiros\/admin-actions";/);
  assert.match(lista, /atualizarStatusInteresse\(i\.id, para\)/);
  assert.equal((acoes.match(/export async function atualizarStatusInteresse/g) ?? []).length, 1);
  assert.match(acao, /perfil\?\.role !== "admin" \|\| !\(await sessaoAal2\(supabase\)\)\) return \{ ok: false, erro: "Sem permissão\." \}/);
  assert.match(acao, /recusaObservador\(user\.id/, "o observador da QA continua sem escrever");
});
