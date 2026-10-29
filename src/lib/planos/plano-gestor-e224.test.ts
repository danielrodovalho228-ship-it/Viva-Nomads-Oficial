/*
  E224 — os dois lados do Plano Gestor: a linha da Conta (N, quantos faltam, liberado) e o tipo da conta no admin
  (motivo obrigatório; só admin; o observador da QA é recusado).
  Roda: node --test src/lib/planos/plano-gestor-e224.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GESTOR_MIN_IMOVEIS_VALIDADOS, ROTULO_TIPO_CONTA, faltamParaGestor, gestorElegivel, motivoTipoValido, textoElegibilidadeGestor } from "./gestor.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("Conta › Plano: 'Você tem N; faltam M.' e o estado já liberado", () => {
  const min = GESTOR_MIN_IMOVEIS_VALIDADOS;
  const linha = (n: number, tipo = "individual") =>
    textoElegibilidadeGestor({ elegivel: gestorElegivel({ accountType: tipo, imoveisValidados: n }), imoveisValidados: n, faltam: faltamParaGestor(n) });
  assert.equal(linha(0), `Plano Gestor: liberado com ${min} imóveis com documento aprovado. Você tem 0; faltam ${min}.`);
  assert.equal(linha(3), `Plano Gestor: liberado com ${min} imóveis com documento aprovado. Você tem 3; faltam ${min - 3}.`);
  assert.equal(linha(min - 1), `Plano Gestor: liberado com ${min} imóveis com documento aprovado. Você tem ${min - 1}; faltam 1.`);
  assert.equal(linha(min), "Liberado. Fale com a Viva para ativar.");
  assert.equal(linha(0, "gestor"), "Liberado. Fale com a Viva para ativar.");
});

test("a tela do proprietário não promete checkout: sem botão, sem link, sem 'assinar'", () => {
  const comp = ler("src/components/account/plano-gestor-conta.tsx");
  assert.match(comp, /getGestorElegibilidade\(\)/);
  assert.match(comp, /textoElegibilidadeGestor\(e\)/);
  assert.doesNotMatch(comp, /<Button|<ButtonLink|<Link|<a |href=|Assinar|checkout/);
  const pag = ler("src/components/account/pagamentos-conta.tsx");
  assert.match(pag, /\{dono && <PlanoGestorConta \/>\}/);
  assert.match(ler("src/lib/conta/secoes.ts"), /plano: "pagamentos",/);
  // Sem sessão a elegibilidade fecha com o mínimo real (não um número solto).
  assert.match(ler("src/lib/data/planos-actions.ts"), /faltam: GESTOR_MIN_IMOVEIS_VALIDADOS,/);
});

test("tipo da conta: rótulos individual / administradora com os valores que a ação aceita; motivo obrigatório", () => {
  assert.deepEqual(ROTULO_TIPO_CONTA, { individual: "individual", gestor: "administradora" });
  assert.equal(motivoTipoValido(""), false);
  assert.equal(motivoTipoValido("   abc  "), false);
  assert.equal(motivoTipoValido(null), false);
  assert.equal(motivoTipoValido("Contrato de administradora"), true);
});

test("definirAccountType: só admin, recusa o observador, exige motivo — tudo antes de gravar; a trilha guarda o motivo", () => {
  const src = ler("src/lib/data/planos-actions.ts");
  const corpo = src.slice(src.indexOf("export async function definirAccountType("), src.indexOf("export interface MinhaAssinatura"));
  const pos = (re: RegExp) => {
    const i = corpo.search(re);
    assert.ok(i >= 0, String(re));
    return i;
  };
  const admin = pos(/supabase\.rpc\("is_admin"\)/);
  const soAdmin = pos(/if \(adm !== true\) return \{ ok: false, error: "Apenas administradores\." \};/);
  const observador = pos(/const recusaQa = await recusaObservador\(user\.id\);/);
  const motivo = pos(/if \(!motivoTipoValido\(motivo\)\) return \{ ok: false, error: "Escreva o motivo da troca\." \};/);
  const grava = pos(/\.update\(\{ account_type: novoTipo \}\)/);
  const trilha = pos(/from\("account_type_audit"\)\.insert\(/);
  assert.ok(admin < soAdmin && soAdmin < observador && observador < grava && motivo < grava && grava < trilha);
  assert.match(corpo, /reason: \(motivo \?\? ""\)\.trim\(\)\.slice\(0, 500\),/);
});

test("admin › Usuários: o controle chama definirAccountType com o motivo e só salva com motivo válido", () => {
  const ctl = ler("src/app/(dashboard)/admin/usuarios/tipo-conta.tsx");
  assert.match(ctl, /definirAccountType\(id, novo, motivo\)/);
  assert.match(ctl, /disabled=\{pendente \|\| !motivoTipoValido\(motivo\)\}/);
  assert.match(ctl, /Tipo da conta:/);
  const pagina = ler("src/app/(dashboard)/admin/usuarios/page.tsx");
  assert.match(pagina, /account_type"\)/);
  assert.equal((pagina.match(/<TipoConta id=\{u\.id\} tipo=\{u\.account_type === "gestor" \? "gestor" : "individual"\} \/>/g) ?? []).length, 2);
});
