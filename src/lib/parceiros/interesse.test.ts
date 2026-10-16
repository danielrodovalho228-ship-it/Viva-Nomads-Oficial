import test from "node:test";
import assert from "node:assert/strict";
import { TIPOS_PARCEIRO, validarInteresse } from "./interesse.ts";

const base = { tipo: "fotografo", nome: "Ana Fotos", cidade: "Uberlândia", uf: "mg", contato: "(34) 99999-1234", site: "", aceite: true };

test("interesse válido normaliza UF, WhatsApp e tipo", () => {
  const v = validarInteresse(base);
  assert.ok(v.ok);
  if (!v.ok) return;
  assert.equal(v.dados.uf, "MG");
  assert.equal(v.dados.whatsapp, "34999991234");
  assert.equal(v.dados.email, null);
  assert.equal(v.dados.tipo, "fotografo");
});

test("contato por e-mail também vale; site sem https ganha https e http é recusado", () => {
  const v = validarInteresse({ ...base, contato: "ana@exemplo.com", site: "instagram.com/ana" });
  assert.ok(v.ok);
  if (v.ok) { assert.equal(v.dados.email, "ana@exemplo.com"); assert.equal(v.dados.site, "https://instagram.com/ana"); }
  const ruim = validarInteresse({ ...base, site: "javascript:alert(1)" });
  assert.equal(ruim.ok, false);
  const http = validarInteresse({ ...base, site: "http://x.com" });
  assert.ok(http.ok && http.dados.site === "https://x.com/");
});

test("casos negativos: tipo fora da lista, sem aceite, contato inválido, UF inválida, nome curto", () => {
  assert.equal(validarInteresse({ ...base, tipo: "admin" }).ok, false);
  assert.equal(validarInteresse({ ...base, aceite: false }).ok, false);
  assert.equal(validarInteresse({ ...base, contato: "123" }).ok, false);
  assert.equal(validarInteresse({ ...base, uf: "ZZ" }).ok, false);
  assert.equal(validarInteresse({ ...base, nome: "A" }).ok, false);
  assert.equal(validarInteresse({ ...base, cidade: "x".repeat(81) }).ok, false);
});

test("armadilha preenchida (robô) é marcada para descartar sem erro", () => {
  const v = validarInteresse({ ...base, armadilha: "http://spam" });
  assert.ok(v.ok && v.descartar);
});

test("tipos cobrem os cards da tela", () => {
  assert.deepEqual([...TIPOS_PARCEIRO.map((t) => t.valor)].sort(), ["empresa", "fotografo", "gestor", "seguros", "servicos"]);
});

test("migração 0104: anon só insere com aceite, admin lê, aplicar registra 0104_", async () => {
  const { readFileSync } = await import("node:fs");
  const lei = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
  const mig = lei("supabase/migrations/0104_parceiros_interesse.sql");
  assert.match(mig, /grant insert \(tipo, nome, cidade, uf, whatsapp, email, site, aceite_contato\) on public\.parceiros_interesse to anon/);
  assert.doesNotMatch(mig, /grant select[^;]*to[^;]*anon/);
  assert.match(mig, /with check \(aceite_contato and status = 'novo'\)/);
  assert.match(mig, /using \(public\.is_admin\(\)\)/);
  const ap = lei("supabase/producao/aplicar-0104.sql");
  assert.match(ap, /^begin;$/m);
  assert.match(ap, /'0104_parceiros_interesse'/);
});

test("rota e página: limite por IP, sem dangerouslySetInnerHTML, textos da marca", async () => {
  const { readFileSync } = await import("node:fs");
  const lei = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
  assert.match(lei("src/app/api/parceiros-interesse/route.ts"), /consumirLimite\(`parceiros:ip:\$\{ipHash\(request\)\}`/);
  const tela = lei("src/app/(public)/parceiros/page.tsx") + lei("src/app/(public)/parceiros/parceiro-form.tsx");
  assert.doesNotMatch(tela, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(tela, /apartamentos?|comiss[ãa]o|corretagem|intermedia[çc][ãa]o|vistoria|aluguel/i);
  assert.match(tela, /taxa de parceria/i);
  assert.match(tela, /a Viva não recebe esse dinheiro/);
  assert.doesNotMatch(tela, /Uberl[âa]ndia/);
});
