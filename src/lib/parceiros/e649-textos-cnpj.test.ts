/**
 * E649 — superfícies esquecidas do E648: nenhum texto público, de atendimento ou do painel do parceiro oferece o CPF como
 * alternativa ao CNPJ. Regra vigente: parceiro só com CNPJ; o cadastro legado com CPF mostra a pendência do CNPJ.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PENDENCIA_CNPJ_PAINEL, MODELOS_RECUSA_PARCERIA, ITENS_CHECKLIST } from "./regras.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("/parceiros: o passo 'A Viva confere' pede CNPJ e a pergunta 'Preciso de CNPJ?' responde Sim", () => {
  const p = ler("src/app/(public)/parceiros/page.tsx");
  assert.match(p, /confere o seu documento e o CNPJ \(a verificação automática de identidade ainda não abriu\); para fotografia, também o portfólio\./); // E757: texto único da identidade
  assert.match(p, /p: "Preciso de CNPJ\?", r: "Sim: a Viva só trabalha com parceiros que têm CNPJ, em qualquer categoria\. O CPF não é aceito/);
  assert.doesNotMatch(p, /pessoa física \(CPF\) ou empresa/);
  assert.doesNotMatch(p, /Identidade e CPF ou CNPJ/);
});

test("atendimento: o texto do cadastro de parceiro diz CNPJ e que o CPF não é aceito", () => {
  const t = ler("src/lib/atendimento/parceiros-texto.ts");
  assert.match(t, /empresa com CNPJ \(MEI, onde a atividade permite; o CPF não é aceito\)/);
  assert.doesNotMatch(t, /pessoa física \(CPF\) ou empresa/);
});

test("painel do parceiro: cadastro legado com CPF mostra a pendência do CNPJ ao lado", () => {
  const b = ler("src/app/(dashboard)/dashboard/parceiro/painel-parceiro.tsx");
  assert.match(b, /Pessoa física \(CPF\) — cadastro antigo/);
  assert.match(b, /\{p\.tipoPessoa !== "pj" && \(\s*<p [^>]*data-testid="parceiro-pendencia-cnpj">\s*\{PENDENCIA_CNPJ_PAINEL\}/);
  assert.match(PENDENCIA_CNPJ_PAINEL, /apresente o CNPJ para voltar a receber serviço/);
});

test("admin/recusa: o checklist e o modelo de recusa do documento falam só de CNPJ", () => {
  assert.equal(ITENS_CHECKLIST.find((i) => i.chave === "documento")?.rotulo, "CNPJ com dígitos válidos e situação conferida na Receita");
  const m = MODELOS_RECUSA_PARCERIA.find((x) => x.chave === "documento");
  assert.equal(m?.rotulo, "CNPJ não conferido");
  assert.match(m?.texto ?? "", /^O CNPJ informado não pôde ser conferido/);
});
