import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  conferenciaPetComRegras,
  conferenciaQuantidade,
  cortarObservacoes,
  donoVeFichaPet,
  PRAZO_LINK_FICHA_PET_S,
  resumoPetsCandidatura,
  TEXTO_MAX_FOTOS_PET,
} from "./ficha-pet-dono.ts";
import type { RegrasPets } from "./pets-regras.ts";

/*
  Complemento do #876 (reteste do Muse): a ficha do pet chega ao DONO da candidatura (só por
  fichaPetsDaCandidatura, links de 10 minutos), com a conferência das regras do anúncio; e 3 retoques do inquilino.
*/
const ler = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const REGRAS = (p: Partial<RegrasPets> = {}): RegrasPets => ({ especies: ["cao"], porteMax: "M", qtdMax: 1, reforcoCaucao: 0, regrasCondominio: "", ...p });
const TOTO = { nome: "Totó", especie: "cao" as const, porte: "M" as const };

test("quando o dono vê: candidatura pendente, aceita ou com contrato em andamento", () => {
  assert.equal(donoVeFichaPet({ leadStatus: "new" }), true);
  assert.equal(donoVeFichaPet({ leadStatus: "accepted" }), true);
  assert.equal(donoVeFichaPet({ leadStatus: "accepted", contratoStatus: "ativo" }), true);
  // recusada, cancelada ou contrato encerrado → não vê mais
  assert.equal(donoVeFichaPet({ leadStatus: "rejected" }), false);
  assert.equal(donoVeFichaPet({ leadStatus: "cancelled" }), false);
  assert.equal(donoVeFichaPet({ leadStatus: null }), false);
  for (const c of ["concluido", "cancelado", "encerrado_sem_renovacao", "encerrado_em_acerto"]) {
    assert.equal(donoVeFichaPet({ leadStatus: "accepted", contratoStatus: c }), false, c);
  }
});

test("resumo do cartão: 'Com 1 pet · Totó (cão, porte médio)'", () => {
  assert.equal(resumoPetsCandidatura([TOTO]), "Com 1 pet · Totó (cão, porte médio)");
  assert.equal(
    resumoPetsCandidatura([TOTO, { nome: "Mia", especie: "gato", porte: "P" }]),
    "Com 2 pets · Totó (cão, porte médio), Mia (gato, porte pequeno)",
  );
  assert.equal(resumoPetsCandidatura([]), null);
});

test("conferência com as regras do anúncio (mesma regra de pets-regras.ts)", () => {
  assert.deepEqual(conferenciaPetComRegras(true, REGRAS(), TOTO), { ok: true, texto: "Dentro das regras: aceita cão de porte médio" });
  assert.deepEqual(conferenciaPetComRegras(true, REGRAS({ porteMax: "P" }), TOTO), { ok: false, texto: "Fora das regras: o anúncio aceita até porte pequeno" });
  assert.deepEqual(conferenciaPetComRegras(true, REGRAS({ especies: ["gato"] }), TOTO), { ok: false, texto: "Fora das regras: o anúncio não aceita cão" });
  assert.deepEqual(conferenciaPetComRegras(false, null, TOTO), { ok: false, texto: "Fora das regras: o anúncio não aceita animais" });
  assert.deepEqual(conferenciaPetComRegras(true, null, TOTO), { ok: true, texto: "Dentro das regras: o anúncio aceita pets" });
  assert.equal(conferenciaQuantidade(true, REGRAS(), 2), "Fora das regras: o anúncio aceita até 1 animal");
  assert.equal(conferenciaQuantidade(true, REGRAS({ qtdMax: 2 }), 2), null);
  assert.equal(conferenciaQuantidade(true, null, 3), null);
});

test("observações cortadas em ~120 caracteres, na palavra inteira, com 'ver mais'", () => {
  assert.deepEqual(cortarObservacoes("Calmo."), { curto: "Calmo.", cortado: false });
  const longo = "Muito calmo e sociável com outros cães, não late quando fica sozinho e está acostumado a apartamento com elevador e portaria 24 horas.";
  const r = cortarObservacoes(longo);
  assert.equal(r.cortado, true);
  assert.ok(r.curto.length <= 121, String(r.curto.length));
  assert.ok(r.curto.endsWith("…"));
  assert.ok(longo.startsWith(r.curto.slice(0, -1)));
});

test("servidor: só o dono da candidatura viva, só a pasta do inquilino, links de 10 minutos, sem contato", () => {
  const s = ler("../data/pets-candidatura.ts");
  assert.equal(PRAZO_LINK_FICHA_PET_S, 600);
  assert.match(s, /^"use server";/);
  assert.match(s, /\.from\("leads"\)\.select\("id, owner_id, tenant_id, property_id, status"\)\.eq\("owner_id", user\.id\)/);
  assert.match(s, /if \(!l \|\| l\.owner_id !== user\.id\) return null;/);
  assert.match(s, /donoVeFichaPet\(\{ leadStatus: l\.status, contratoStatus \}\)/);
  assert.match(s, /caminhoFotoPetValido\(p, lead\.tenantId\)/);
  assert.match(s, /createSignedUrls\(caminhos, PRAZO_LINK_FICHA_PET_S\)/);
  // nunca contato nem identidade do inquilino
  assert.doesNotMatch(s, /email|phone|telefone|full_name|cpf/i);
  // fichaPetsDaCandidatura devolve vazio sem acesso
  assert.match(s, /const c = await candidaturaDoDono\(\{ leadId \}\);\s*if \(!c\) return vazio;/);
});

test("nada mudou no RLS de pets_inquilino nem nas políticas do bucket pets-fotos depois da 0179", () => {
  const dir = fileURLToPath(new URL("../../../supabase/migrations/", import.meta.url));
  for (const f of readdirSync(dir).filter((n) => /^\d{4}_/.test(n) && Number(n.slice(0, 4)) > 179)) {
    const sql = readFileSync(dir + f, "utf8");
    assert.doesNotMatch(sql, /pets_inquilino[\s\S]{0,200}policy|policy[\s\S]{0,200}pets_inquilino|pets-fotos/i, f);
  }
});

test("onde aparece: cartão do interessado, conversa, proposta (dono) e fechamento", () => {
  assert.match(ler("../../app/(dashboard)/dashboard/leads/leads-client.tsx"), /<FichaPetCandidatura alvo=\{\{ leadId: l\.id \}\} resumo=\{l\.fichaPet\}/);
  assert.match(ler("../../app/(dashboard)/dashboard/mensagens/messages-client.tsx"), /<FichaPetCandidatura[\s\S]{0,120}alvo=\{\{ propertyId: active\.propertyId, tenantId: active\.otherId \}\}/);
  assert.match(ler("../../app/(dashboard)/dashboard/propostas/[id]/proposta-detalhe.tsx"), /p\.papel === "owner" && <FichaPetCandidatura alvo=\{\{ leadId: p\.leadId \}\}/);
  assert.match(ler("../../app/(dashboard)/dashboard/fechamento/closing-flow.tsx"), /<FichaPetCandidatura alvo=\{\{ leadId: ctx\.leadId \}\}/);
  const c = ler("../../components/pets/ficha-pet-candidatura.tsx");
  assert.match(c, /"Ver ficha do pet"/);
  assert.match(c, /fichaPetsDaCandidatura\(leadId!\)/);
  // o cartão do interessado: "Com 1 pet · Totó (cão, porte médio)" no lugar do "Com 1 pet"
  const l = ler("../data/leads.ts");
  assert.match(l, /pets: fichaPet \? 0 : \(pets\.get\(r\.tenant_id\) \?\? 0\)/);
});

test("retoques do inquilino: 3 de 3 fotos, pet novo na hora, raça e observações com 'ver mais'", () => {
  assert.equal(TEXTO_MAX_FOTOS_PET, "Máximo de 3 fotos. Remova uma para trocar.");
  const f = ler("../../components/account/pets-ficha.tsx");
  assert.match(f, /!podeAdicionarFotoPet\("foto", p\.fotos\.length\) && \(\s*<span[^>]*>\{TEXTO_MAX_FOTOS_PET\}/);
  assert.match(f, /Raça: <span className="text-ink">\{p\.raca\}<\/span>/);
  assert.match(f, /cortarObservacoes\(p\.observacoes\)/);
  assert.match(f, /"ver mais"/);
  const a = ler("../data/pets-ficha-actions.ts");
  assert.match(a, /\.select\(COLUNAS\)\.single\(\);/);
  assert.match(a, /pets: \[\.\.\.atuais\.filter\(\(p\) => p\.id !== salvo\.id\), salvo\]/);
});
