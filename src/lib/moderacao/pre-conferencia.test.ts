/*
  Cadastro confiável, parte B: quem opera o imóvel + pré-conferência.
  Roda: node --test src/lib/moderacao/pre-conferencia.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { nomesConferem, preConferir, type FatosPreConferencia } from "./pre-conferencia.ts";
import { autorizacaoOk, caminhoDoDono, exigeAutorizacao, OPERACOES, operacaoValida } from "../anuncio/operacao.ts";
import { fatosDaLinha, prontidaoAnuncio, type LinhaAnuncio } from "../anuncio/prontidao.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const DONO = "8f14e45f-ceea-467f-a0e5-1b2c3d4e5f60";

test("operação: três tipos; sublocação e administração exigem documento", () => {
  assert.deepEqual(OPERACOES.map((o) => o.valor), ["own", "subleased", "managed"]);
  assert.equal(OPERACOES[2].rotulo, "Administro para o proprietário");
  assert.ok(operacaoValida("managed") && !operacaoValida("outro"));
  assert.ok(!exigeAutorizacao("own") && exigeAutorizacao("subleased") && exigeAutorizacao("managed"));
});

test("autorização: declaração + arquivo NA PASTA DO DONO; nunca link externo, preview local ou pasta de outro", () => {
  const base = { owner_id: DONO, sublease_authorized: true };
  assert.ok(autorizacaoOk({ ownership_type: "own" }));
  assert.ok(autorizacaoOk({ ...base, ownership_type: "subleased", sublease_doc_url: `${DONO}/aut.pdf` }));
  assert.ok(autorizacaoOk({ ...base, ownership_type: "managed", sublease_doc_url: `${DONO}/proc.pdf` }));
  assert.ok(!autorizacaoOk({ ...base, ownership_type: "subleased", sublease_doc_url: null }));
  assert.ok(!autorizacaoOk({ ...base, sublease_authorized: false, ownership_type: "managed", sublease_doc_url: `${DONO}/proc.pdf` }));
  for (const c of ["outro/aut.pdf", "blob:http://x/1", "https://x.com/a.pdf", `${DONO}/../x/a.pdf`, `${DONO}/`])
    assert.ok(!caminhoDoDono(c, DONO), c);
});

test("prontidão: sublocado/administrado sem documento não publica (com a 0091); rótulo por tipo", () => {
  const linha: LinhaAnuncio = {
    title: "Studio", address: "Centro", city: "Uberlândia", bathrooms: 1, area_m2: 30, min_period_days: 30,
    monthly_price: 2000, garantias_aceitas: ["caucao"], ownership_type: "managed", sublease_authorized: true,
    autorizacao_anexada: false, description: "x".repeat(200), ready_to_live_badge: false, video_url: null,
  };
  const p = prontidaoAnuncio(fatosDaLinha(linha, 8, "approved", true));
  const item = p.obrigatorios.find((i) => i.key === "sublocacao");
  assert.ok(item && !item.ok);
  assert.equal(item.label, "Contrato de administração ou procuração");
  assert.ok(fatosDaLinha({ ...linha, autorizacao_anexada: true }, 8, "approved", true).sublocacaoOk);
  // Banco sem a 0091 (coluna ausente): vale a regra antiga, só a declaração.
  assert.ok(fatosDaLinha({ ...linha, autorizacao_anexada: undefined }, 8, "approved", true).sublocacaoOk);
  assert.equal(prontidaoAnuncio(fatosDaLinha({ ...linha, ownership_type: "subleased" }, 8, "approved", true)).obrigatorios.find((i) => i.key === "sublocacao")!.label, "Autorização de sublocação");
});

test("nomes: primeiro e último iguais, ou um contido no outro; acento e caixa não importam", () => {
  assert.ok(nomesConferem("Ana Lima", "ANA PAULA DE SOUZA LIMA"));
  assert.ok(nomesConferem("José da Silva", "Jose Silva"));
  assert.ok(nomesConferem("Imobiliária Boa Vista Ltda", "IMOBILIARIA BOA VISTA"));
  assert.ok(!nomesConferem("Ana Lima", "Bruno Lima"));
  assert.ok(!nomesConferem("", "Ana Lima"));
});

const ok: FatosPreConferencia = {
  documentoDono: { person_type: "pf", cpf: "52998224725" },
  nomeConta: "Dora Documento",
  titularInformado: "Dora Documento",
  duplicado: 0,
  operacao: "own",
  autorizacaoAnexada: true,
};

test("pré-conferência: tudo certo → 'Parece OK'; integrações sem chave não pesam", () => {
  const r = preConferir(ok);
  assert.equal(r.veredito, "Parece OK");
  assert.ok(r.pareceOk);
  assert.equal(r.itens.find((i) => i.chave === "ocr")!.estado, "nao_consultado");
});

test("pré-conferência: cada problema vira 'Atenção: <motivo>'", () => {
  assert.match(preConferir({ ...ok, documentoDono: { person_type: "pf", cpf: null } }).veredito, /^Atenção: dono ainda sem CPF válido/);
  assert.match(preConferir({ ...ok, titularInformado: "Carlos Pereira" }).veredito, /nome do titular diferente do nome da conta/);
  assert.match(preConferir({ ...ok, titularInformado: "" }).veredito, /dono não informou o nome do titular/);
  assert.match(preConferir({ ...ok, duplicado: 2 }).veredito, /mesmo arquivo enviado por outra conta \(2×\)/);
  assert.match(preConferir({ ...ok, operacao: "managed", autorizacaoAnexada: false, titularInformado: "Carlos Pereira" }).veredito, /contrato de administração ou procuração não anexada/);
  assert.match(preConferir({ ...ok, ocrTitular: "Outro Nome" }).veredito, /nome lido no documento é diferente do informado/);
  // PJ: CNPJ inativo é atenção; razão social confere com o titular.
  const pj = preConferir({
    ...ok,
    documentoDono: { person_type: "pj", cnpj: "11222333000181", company_name: "Boa Vista Imóveis Ltda", cpf_representante: "52998224725" },
    nomeConta: "Dora",
    titularInformado: "Boa Vista Imóveis",
    cnpjSituacao: "BAIXADA",
  });
  assert.equal(pj.veredito, "Atenção: situação: baixada");
});

test("pré-conferência: sublocado/administrado com autorização — titular diferente é o esperado", () => {
  const r = preConferir({ ...ok, operacao: "subleased", autorizacaoAnexada: true, titularInformado: "Carlos Pereira" });
  assert.equal(r.veredito, "Parece OK");
});

test("ligações: admin vê veredito e a autorização; service role só depois de confirmar admin; integrações em demo", () => {
  const adm = ler("lib/data/documentos-admin.ts");
  assert.match(adm, /const adm = user && \(await ehAdmin\(supabase, user\.id\)\) \? createAdminClient\(\) : null;/);
  assert.match(adm, /\.neq\("owner_id", ownerId\); \/\/ o próprio dono re-salvando/);
  assert.match(adm, /preConferencia = preConferir\(\{/);
  const tela = ler("app/(dashboard)/admin/documentos/admin-documentos-client.tsx");
  assert.match(tela, /data-testid="pre-conferencia"/);
  assert.match(tela, /Só uma ajuda\. Quem aprova ou recusa é você\./);
  const integ = ler("lib/integrations/conferencia-doc.ts");
  assert.match(integ, /process\.env\.CNPJ_API_TOKEN[^\n]*&& !integracoesSimuladas\(\)/);
  assert.match(integ, /process\.env\.OCR_API_TOKEN[^\n]*&& !integracoesSimuladas\(\)/);
  assert.doesNotMatch(integ, /exigirChaveEmProducao/); // pré-conferência nunca trava o admin
  const acoes = ler("lib/data/actions.ts");
  assert.equal((acoes.match(/caminhoDoDono\(input\.subleaseDocUrl, user\.id\)/g) ?? []).length, 2);
  const novo = ler("app/(dashboard)/dashboard/imoveis/novo/page.tsx");
  assert.match(novo, /if \(!asDraft && subleaseBlocked\)/);
  assert.match(novo, /<DocumentoUploader docs=\{subleaseDoc\}/);
  // O upload do documento passa pelo servidor (tipo real + hash), não direto no bucket.
  assert.match(ler("lib/data/storage.ts"), /fetch\("\/api\/upload\/documento"/);
});

test("0091: 'managed', documento obrigatório no banco, sem expor o caminho, sem DROP, marcada para aprovação", () => {
  const sql = ler("../supabase/migrations/0091_autorizacao_operacao.sql");
  const codigo = sql.replace(/--.*$/gm, "");
  assert.match(sql, /PRECISA APROVAÇÃO DO DANIEL — não aplicado/);
  assert.doesNotMatch(codigo, /\bdrop\b/i);
  assert.match(codigo, /alter type public\.ownership_type add value 'managed'/);
  assert.match(codigo, /autorizacao_anexada boolean generated always as \(sublease_doc_url is not null\) stored/);
  assert.match(codigo, /grant select \(autorizacao_anexada\) on public\.properties to anon, authenticated;/);
  assert.doesNotMatch(codigo, /grant select \([^)]*sublease_doc_url/);
  assert.match(codigo, /new\.sublease_doc_url !~ \('\^' \|\| new\.owner_id::text \|\| '\/\[\^\/\]\+\$'\)/);
});
