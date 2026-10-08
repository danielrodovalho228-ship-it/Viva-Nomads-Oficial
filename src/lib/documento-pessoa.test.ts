/*
  Cadastro confiável — documento da pessoa (CPF/CNPJ) e as travas.
  Roda: node --test src/lib/documento-pessoa.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cnpjValido, cpfValido, documentoCompleto, documentoParaContrato, motivoBloqueioAprovacao, mascararCnpj, mascararCpf, MSG_DOCUMENTO, validarDocumento } from "./documento-pessoa.ts";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("CPF e CNPJ: dígitos verificadores, sequências repetidas e tamanho", () => {
  for (const v of ["529.982.247-25", "52998224725", "123.456.789-09"]) assert.ok(cpfValido(v), v);
  for (const v of ["529.982.247-24", "111.111.111-11", "1234567890", "", null]) assert.ok(!cpfValido(v), String(v));
  for (const v of ["11.222.333/0001-81", "11444777000161"]) assert.ok(cnpjValido(v), v);
  for (const v of ["11.222.333/0001-80", "00000000000000", "1122233300018", undefined]) assert.ok(!cnpjValido(v), String(v));
});

test("máscara: CPF só o miolo; CNPJ só a raiz", () => {
  assert.equal(mascararCpf("52998224725"), "***.982.247-**");
  assert.equal(mascararCnpj("11222333000181"), "11.222.333/****-**");
  assert.equal(mascararCpf("123"), null);
});

test("validar: PF pede CPF; PJ pede CNPJ, razão social e CPF do representante", () => {
  assert.deepEqual(validarDocumento({ tipo: "pf", cpf: "529.982.247-25" }), { ok: true, doc: { tipo: "pf", cpf: "52998224725", cnpj: null, razaoSocial: null, cpfRepresentante: null } });
  assert.match((validarDocumento({ tipo: "pf", cpf: "111.111.111-11" }) as { erro: string }).erro, /CPF inválido/);
  assert.match((validarDocumento({ tipo: "pj", cnpj: "11222333000181", razaoSocial: "", cpfRepresentante: "52998224725" }) as { erro: string }).erro, /razão social/);
  assert.match((validarDocumento({ tipo: "pj", cnpj: "11222333000181", razaoSocial: "Viva LTDA", cpfRepresentante: "1" }) as { erro: string }).erro, /representante/);
  assert.match((validarDocumento({ tipo: "pj", cnpj: "11222333000181", razaoSocial: "<b>x</b>", cpfRepresentante: "52998224725" }) as { erro: string }).erro, /Razão social inválida/);
  const ok = validarDocumento({ tipo: "pj", cnpj: "11.222.333/0001-81", razaoSocial: "  Imóveis   Silva LTDA ", cpfRepresentante: "529.982.247-25" });
  assert.deepEqual(ok, { ok: true, doc: { tipo: "pj", cpf: null, cnpj: "11222333000181", razaoSocial: "Imóveis Silva LTDA", cpfRepresentante: "52998224725" } });
});

test("completo e documento do contrato", () => {
  assert.ok(documentoCompleto({ person_type: "pf", cpf: "52998224725" }));
  assert.ok(!documentoCompleto({ person_type: "pf", cpf: null }));
  assert.ok(!documentoCompleto({ person_type: "pj", cnpj: "11222333000181", company_name: "X", cpf_representante: null }), "PJ sem representante");
  assert.ok(documentoCompleto({ person_type: "pj", cnpj: "11222333000181", company_name: "X LTDA", cpf_representante: "52998224725" }));
  assert.equal(documentoParaContrato({ person_type: "pj", cnpj: "11222333000181", company_name: "X LTDA", cpf_representante: "52998224725" }), "11222333000181");
  assert.equal(documentoParaContrato({ person_type: "pf", cpf: "" }), null);
});

test("0090: dígitos no banco, NOT VALID, um CPF por conta, campos protegidos, marcada para aprovação, sem DROP", () => {
  const sql = ler("../supabase/migrations/0090_documento_pessoa.sql");
  const codigo = sql.replace(/--.*$/gm, "");
  assert.match(sql, /PRECISA APROVAÇÃO DO DANIEL — não aplicado/);
  assert.doesNotMatch(codigo, /\bdrop\b/i);
  for (const t of ["create or replace function public.cpf_valido(v text)", "create or replace function public.cnpj_valido(v text)", "add column cpf_representante text", "create unique index profiles_cpf_unico on public.profiles (cpf) where cpf is not null", "revoke update (company_name) on public.profiles from authenticated"])
    assert.ok(codigo.includes(t), t);
  assert.equal((codigo.match(/\) not valid;/g) ?? []).length, 3);
  for (const c of ["cpf", "cnpj", "company_name", "cpf_representante", "role", "is_verified", "person_type"]) assert.match(codigo, new RegExp(`(if|or) new\\.${c}\\s+is distinct from old\\.${c}`));
});

test("travas: aceitar candidatura, assinar plano e fechar contrato exigem o documento", () => {
  const leads = ler("lib/data/leads-actions.ts");
  const i = leads.indexOf("export async function aceitarCandidatura");
  const trava = leads.indexOf("if (!(await temDocumento(admin, user.id))) return { ok: false, error: MSG_DOCUMENTO.aceitar };", i);
  const grava = leads.indexOf('status: "accepted"', i);
  assert.ok(trava > i && trava < grava, "a trava vem ANTES de gravar o aceite");
  const ass = ler("app/api/assinatura/route.ts");
  assert.match(ass, /if \(!documento\) return NextResponse\.json\(\{ error: MSG_DOCUMENTO\.assinar \}, \{ status: 400 \}\);/);
  assert.match(ass, /cpfCnpj: documento,/);
  const fech = ler("lib/data/fechamento-servidor.ts");
  assert.match(fech, /if \(!docDono\) return \{ status: 409, error: MSG_DOCUMENTO\.fecharDono \};/);
  assert.match(fech, /if \(!documentoParaContrato\(docInquilino\)\) return \{ status: 409, error: MSG_DOCUMENTO\.fecharInquilino \};/);
  assert.match(MSG_DOCUMENTO.aceitar, /Conta → Documento/);
});

test("o número inteiro não sai do servidor: a tela recebe só a máscara", () => {
  const acoes = ler("lib/data/perfil-actions.ts");
  const i = acoes.indexOf("export async function getMeuDocumento");
  const corpo = acoes.slice(i, acoes.indexOf("\n}\n", i));
  assert.match(corpo, /cpf: mascararCpf\(p\.cpf\)/);
  assert.match(corpo, /cnpj: mascararCnpj\(p\.cnpj\)/);
  assert.match(corpo, /cpfRepresentante: mascararCpf\(p\.cpf_representante\)/);
  assert.doesNotMatch(ler("components/account/conta-secoes.tsx"), /from "@\/lib\/supabase\/client"[\s\S]*\.select\([^)]*cpf/);
});

test("admin: Aprovar documento bloqueado sem CPF (PF) ou CNPJ completo (PJ)", () => {
  assert.match(motivoBloqueioAprovacao(null) ?? "", /CPF válido/);
  assert.match(motivoBloqueioAprovacao({ person_type: "pf", cpf: "111.111.111-11" }) ?? "", /CPF válido/);
  assert.match(motivoBloqueioAprovacao({ person_type: "pj", cnpj: "11222333000181", company_name: "", cpf_representante: "52998224725" }) ?? "", /CNPJ/);
  assert.match(motivoBloqueioAprovacao({ person_type: "pj" }) ?? "", /CNPJ/);
  assert.equal(motivoBloqueioAprovacao({ person_type: "pf", cpf: "52998224725" }), null);
  assert.equal(motivoBloqueioAprovacao({ person_type: "pj", cnpj: "11222333000181", company_name: "Viva LTDA", cpf_representante: "52998224725" }), null);
});

test("admin: moderarDocumento confere o documento do dono ao aprovar; tela desabilita Aprovar", () => {
  const srv = ler("lib/data/documentos-admin.ts");
  assert.match(srv, /if \(aprovado\) \{[\s\S]*?motivoBloqueioAprovacao\(await lerDocumento\(createAdminClient\(\), alvo\.owner_id as string\)\)/);
  const ui = ler("app/(dashboard)/admin/documentos/admin-documentos-client.tsx");
  assert.match(ui, /doc\.bloqueioAprovacao/);
  assert.match(ui, /disabled=\{busy \|\| !podeAprovar \|\| !!doc\.bloqueioAprovacao\}/);
});
