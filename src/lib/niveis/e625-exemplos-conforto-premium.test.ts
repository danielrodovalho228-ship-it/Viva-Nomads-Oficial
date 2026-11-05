/*
  E625 — a busca só tinha Essencial. O motor está certo (Conforto/Premium exigem foto na hora, internet medida e ruído); a massa
  de QA é que não alcançava. A 0304 semeia dois anúncios de teste PELAS TABELAS REAIS, e o motor concorda com o nível gravado.
  Roda: node --test src/lib/niveis/e625-exemplos-conforto-premium.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { graduarSemente, itensFotoDoAlvo } from "./e625-semente.ts";
import { FILTROS_PAINEL_VAZIOS, passaNoPainel } from "../busca/painel-filtros.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const mig = ler("supabase/migrations/0304_qa_exemplos_conforto_premium_e625.sql");
const AGORA = new Date("2026-11-05T12:00:00Z");

test("E625: o motor gradua a semente em Conforto e em Premium (limiares corretos: o que faltava era a massa)", () => {
  assert.equal(graduarSemente("conforto", AGORA).nivel, "conforto");
  assert.equal(graduarSemente("premium", AGORA).nivel, "premium");
});

test("E625: sem as provas (só o padrão mínimo) o motor devolve Essencial — o caso das sementes de antes", () => {
  const sem = graduarSemente("conforto", AGORA);
  assert.ok(sem.itensQueDefinem.length > 0);
});

test("E625: a migração grava exatamente os itens, o nível e as áreas que o motor devolve", () => {
  for (const alvo of ["conforto", "premium"] as const) {
    const r = graduarSemente(alvo, AGORA);
    for (const k of itensFotoDoAlvo(alvo)) assert.ok(mig.includes(`'${k}'`), `${alvo}: ${k}`);
    const porArea = JSON.stringify(r.porArea);
    const norm = (s: string) => s.replace(/\s/g, "");
    assert.ok(norm(mig).includes(norm(porArea)), `${alvo}: por_area`);
    assert.ok(norm(mig).includes(norm(JSON.stringify(r.diferenciais))), `${alvo}: diferenciais`);
  }
  // o Conforto não leva os itens do Premium
  const conforto = mig.slice(mig.indexOf("when 'conforto' then"), mig.indexOf("else array["));
  assert.ok(!conforto.includes("sono_padrao_hotel"));
});

test("E625: massa de QA honesta — marcador, só ativo em Essencial, nunca sobrescreve, medições de teste", () => {
  assert.match(mig, /MASSA DE QA/);
  assert.match(mig, /'e625e625' \|\| substr\(md5/);
  assert.match(mig, /n\.nivel = 'essencial'/);
  assert.match(mig, /p\.status::text = 'active'/);
  assert.equal((mig.match(/on conflict \(property_id(, chave)?\) do nothing/g) ?? []).length, 2);
  assert.match(mig, /'quarto_principal', 120\.0, 60\.0, 18/);
  assert.match(mig, /'trabalho', 110\.0, 55\.0, 20/);
  assert.doesNotMatch(mig, /AUTOMACOES_ATIVO|update public\.properties|delete from/);
});

test("E625: aplicar embrulha o mesmo corpo, se registra e o rollback desfaz só o marcado", () => {
  const ap = ler("supabase/producao/aplicar-0304.sql");
  assert.ok(ap.includes(mig.trim()));
  assert.match(ap, /'20261105000304', '0304_qa_exemplos_conforto_premium_e625'/);
  const rb = ler("supabase/producao/rollback/0304_rollback.sql");
  assert.match(rb, /foto_hash like 'e625e625%'/);
  assert.match(rb, /version = '20261105000304'/);
});

test("E625: o filtro de Nível da busca conta Conforto e Premium quando existem (mesma regra 'a partir de')", () => {
  const casas = [{ nivel: "conforto" }, { nivel: "premium" }, { nivel: "essencial" }] as never[];
  const conta = (n: "essencial" | "conforto" | "premium") => casas.filter((p) => passaNoPainel(p, { ...FILTROS_PAINEL_VAZIOS, nivelMin: n })).length;
  assert.deepEqual([conta("essencial"), conta("conforto"), conta("premium")], [3, 2, 1]);
});
