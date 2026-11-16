/*
  E977 (Família 8) — registrar a taxa fixada pelo admin era só por SQL. Agora há a tela /admin/taxas-fixadas (formulário +
  histórico), que só INSERE em comissao_fixada_admin (0096) e mostra, por proprietário, a mesma linha que a cobrança usa.
  Roda: node --test src/lib/cobranca/e977-taxa-fixada-tela.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { estadosDasFixacoes, fimDoDiaEmBrasilia, pctDaTaxa, taxaDoPercentual, validarFixacao } from "./fixacao-admin.ts";
import { BARRA_ADMIN, rotuloDoAdmin } from "../../config/menu-admin.ts";

const agora = new Date("2026-11-16T15:00:00Z");
const ler = (p: string) => readFileSync(p, "utf8");

test("E977 — validação: e-mail, taxa em % (0–100, até 2 casas), motivo 3–300 e validade de hoje em diante (fim do dia em Brasília)", () => {
  const ok = validarFixacao({ email: " Marcia@Exemplo.com ", taxa: "4,5", motivo: "Acordo de carteira", validoAte: "2027-11-16" }, agora);
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.equal(ok.fixacao.email, "marcia@exemplo.com");
    assert.equal(ok.fixacao.taxa, 0.045);
    assert.equal(ok.fixacao.validoAte.toISOString(), "2027-11-17T02:59:59.999Z");
  }
  assert.ok(validarFixacao({ email: "a@b.co", taxa: "4", motivo: "abc", validoAte: "2026-11-16" }, agora).ok, "hoje vale");
  for (const [campo, valor] of [["email", "sem-arroba"], ["taxa", "101"], ["taxa", "4,555"], ["taxa", "-1"], ["motivo", "  x "], ["validoAte", "2026-11-15"], ["validoAte", "2026-02-30"]] as const) {
    const e = { email: "a@b.co", taxa: "4", motivo: "Acordo", validoAte: "2027-01-01", [campo]: valor };
    assert.equal(validarFixacao(e, agora).ok, false, `${campo}=${valor}`);
  }
  assert.equal(taxaDoPercentual("0"), 0);
  assert.equal(fimDoDiaEmBrasilia("2026-13-01"), null);
  assert.equal(pctDaTaxa(0.045), "4,5%");
});

test("E977 — estado de cada linha = a regra do servidor: por dono, a mais recente dentro da validade vale; as outras não", () => {
  const l = (id: string, owner: string, criado: string, ate: string) => ({ id, owner_id: owner, taxa: 0.04, motivo: "Acordo", valido_ate: ate, criado_em: criado });
  const r = estadosDasFixacoes(
    [l("a1", "A", "2026-10-01T00:00:00Z", "2027-01-01T00:00:00Z"), l("a2", "A", "2026-11-01T00:00:00Z", "2026-12-01T00:00:00Z"), l("a0", "A", "2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z"), l("b1", "B", "2026-05-01T00:00:00Z", "2026-11-17T00:00:00Z")],
    agora,
  );
  assert.deepEqual(Object.fromEntries(r.map((x) => [x.id, x.estado])), { a2: "vigente", a1: "substituida", a0: "vencida", b1: "vigente" });
  assert.deepEqual(r.map((x) => x.id), ["a2", "a1", "b1", "a0"], "mais recentes primeiro");
  // A leitura do servidor é a mesma: mais recente (criado_em desc) dentro da validade.
  assert.match(ler("src/lib/cobranca/taxa-servidor.ts"), /\.from\("comissao_fixada_admin"\)[\s\S]{0,200}\.gte\("valido_ate", agora\.toISOString\(\)\)\s*\.order\("criado_em", \{ ascending: false \}\)/);
});

test("E977 — a ação só insere (nunca apaga nem edita), com o portão do admin (AAL2) e a recusa do observador da QA", () => {
  const a = ler("src/lib/cobranca/fixacao-actions.ts");
  assert.match(a, /^"use server";/);
  assert.match(a, /perfil\?\.role === "admin" && \(await sessaoAal2\(supabase\)\)/);
  assert.match(a, /await recusaObservador\(adm\.userId\)/);
  assert.match(a, /\.from\("comissao_fixada_admin"\)\.insert\(\{[\s\S]*criado_por: adm\.userId/);
  assert.doesNotMatch(a, /\.(delete|update|upsert)\(/);
});

test("E977 — a tela está na barra do admin (Números) e desenha formulário e histórico", () => {
  const numeros = BARRA_ADMIN.find((i) => i.id === "admin-numeros")!;
  assert.ok(numeros.filhos!.some((f) => f.href === "/admin/taxas-fixadas"));
  assert.equal(rotuloDoAdmin("/admin/taxas-fixadas"), "Taxas fixadas");
  const p = ler("src/app/(dashboard)/admin/taxas-fixadas/page.tsx");
  assert.match(p, /<FormTaxaFixada hoje=\{hoje\} \/>/);
  assert.match(p, /estadosDasFixacoes\(/);
  assert.match(p, /soLeitura \? <SoLeituraQa \/>/);
});
