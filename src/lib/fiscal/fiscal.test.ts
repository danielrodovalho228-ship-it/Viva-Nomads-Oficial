/*
  PR F1 — documentos da plataforma: recibo de aluguel, comprovante e termo de
  devolução da caução. Roda: node --test src/lib/fiscal/fiscal.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CODIGO_RE, conteudoDocumento, temContato, textoDocumento, totalComEncargos, type DadosDocumento } from "./documento.ts";
import { gerarPdf, sha256 } from "./pdf.ts";
import { regraDevolucao } from "./devolucao.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

const BASE: DadosDocumento = {
  tipo: "recibo_aluguel",
  numero: "REC-2026-000001",
  emitidoEm: "2026-10-06T15:00:00Z",
  locador: { nome: "Dono Um", doc: "123.456.789-00" },
  locatario: { nome: "Inquilina Dois", doc: "987.654.321-00" },
  imovelEndereco: "Rua das Flores 123, Uberlândia",
  contratoRef: "CT-D7400000",
  periodoInicio: "2026-10-01",
  periodoFim: "2026-11-30",
  valor: 3000,
  encargos: [
    { rotulo: "Condomínio", valor: 450 },
    { rotulo: "IPTU", valor: 120.5 },
  ],
  dataPagamento: "2026-10-05",
  forma: "pix",
  conferirUrl: "https://vivanomads.com.br/conferir/0123456789abcdef0123456789abcdef",
};

test("recibo: partes com CPF, imóvel, período, aluguel + encargos = total, e nunca 'nota fiscal' como título", () => {
  const c = conteudoDocumento(BASE);
  const t = textoDocumento(c);
  assert.equal(c.titulo, "Recibo de aluguel");
  assert.equal(totalComEncargos(BASE), 3570.5);
  for (const trecho of ["Dono Um (CPF/CNPJ 123.456.789-00)", "Inquilina Dois (CPF/CNPJ 987.654.321-00)", "Rua das Flores 123, Uberlândia", "01/10/2026 a 30/11/2026", "Condomínio", "IPTU", "R$ 3.570,50", "CT-D7400000", "Não é nota fiscal", "não recebe aluguel nem caução"]) {
    assert.ok(t.includes(trecho), trecho);
  }
  assert.doesNotMatch(c.titulo, /nota fiscal/i);
});

test("nenhum documento leva e-mail ou telefone", () => {
  for (const tipo of ["recibo_aluguel", "comprovante_caucao", "termo_devolucao_caucao"] as const) {
    assert.equal(temContato(textoDocumento(conteudoDocumento({ ...BASE, tipo, caucaoTotal: 3000, confirmadoEm: "2026-12-02" }))), false, tipo);
  }
  assert.equal(temContato("Fale com dono@exemplo.com"), true);
  assert.equal(temContato("ligue (34) 99999-8888"), true);
});

test("comprovante de caução: poupança e art. 38; nunca 'conta vinculada'", () => {
  const t = textoDocumento(conteudoDocumento({ ...BASE, tipo: "comprovante_caucao", valor: 3000, encargos: [] }));
  assert.match(t, /caderneta de poupança/);
  assert.match(t, /art\. 38, §2º/);
  assert.doesNotMatch(t, /conta vinculada/i);
});

test("termo de devolução: total, descontos e valor devolvido batem", () => {
  const t = textoDocumento(conteudoDocumento({ ...BASE, tipo: "termo_devolucao_caucao", valor: 2500, encargos: [], caucaoTotal: 3000, confirmadoEm: "2026-12-02" }));
  assert.match(t, /Caução depositada: R\$ 3\.000,00/);
  assert.match(t, /Descontos: R\$ 500,00/);
  assert.match(t, /Valor devolvido: R\$ 2\.500,00/);
  assert.match(t, /Confirmado pelo locatário em: 02\/12\/2026/);
});

test("PDF de verdade (pdf-lib) + hash sha256 de 64 hex; acentos e '≈' não quebram", async () => {
  const pdf = await gerarPdf(conteudoDocumento({ ...BASE, locador: { nome: "João Ação ≈ Teste", doc: null } }));
  assert.equal(Buffer.from(pdf.slice(0, 5)).toString(), "%PDF-");
  assert.ok(pdf.length > 1000);
  assert.match(sha256(pdf), /^[0-9a-f]{64}$/);
});

test("código de conferência: 32 hex (128 bits)", () => {
  assert.ok(CODIGO_RE.test("0123456789abcdef0123456789abcdef"));
  assert.ok(!CODIGO_RE.test("0001"));
  assert.match(ler("lib/fiscal/emitir.ts"), /randomBytes\(16\)\.toString\("hex"\)/);
});

test("devolução da caução: só com a locação encerrada, caução confirmada e valor entre 0 e o total", () => {
  const ok = { statusContrato: "encerrado_em_acerto", caucaoTotal: 3000, valorDevolvido: 3000, dataDevolucao: "2026-12-01", meio: "pix", jaTemAcerto: false };
  assert.deepEqual(regraDevolucao(ok), { ok: true, tipo: "devolucao_integral", valor: 3000 });
  assert.deepEqual(regraDevolucao({ ...ok, valorDevolvido: 2500 }), { ok: true, tipo: "desconto", valor: 2500 });
  assert.equal(regraDevolucao({ ...ok, statusContrato: "ativo" }).ok, false);
  assert.equal(regraDevolucao({ ...ok, caucaoTotal: 0 }).ok, false);
  assert.equal(regraDevolucao({ ...ok, valorDevolvido: 3001 }).ok, false);
  assert.equal(regraDevolucao({ ...ok, jaTemAcerto: true }).ok, false);
  assert.equal(regraDevolucao({ ...ok, meio: "cheque" }).ok, false);
});

/** Corpo de uma função exportada. */
function corpo(fonte: string, nome: string): string {
  const i = fonte.indexOf(`export async function ${nome}(`);
  assert.ok(i >= 0, nome);
  const j = fonte.indexOf("\nexport ", i + 10);
  return fonte.slice(i, j < 0 ? undefined : j);
}

test("servidor: recibo só depois da confirmação do inquilino; papéis conferidos na devolução", () => {
  assert.match(corpo(ler("lib/data/contratos-actions.ts"), "confirmarPagamento"), /after\(\(\) => emitirDoPagamento\(pagamentoId\)\)/);
  assert.match(corpo(ler("lib/fiscal/emitir.ts"), "emitirDoPagamento"), /!pg\.confirmado_pelo_inquilino/);
  const docs = ler("lib/data/documentos-actions.ts");
  assert.match(corpo(docs, "registrarDevolucaoCaucao"), /ctx\.papel !== "dono"/);
  assert.match(corpo(docs, "responderDevolucaoCaucao"), /ctx\.papel !== "inquilino"/);
  assert.match(corpo(ler("lib/fiscal/emitir.ts"), "emitirTermoDevolucao"), /devolvida_integral", "desconto_confirmado"/);
});

test("download só pelo RLS da pessoa + URL assinada de 10 min; conferência pública com limite de 20/h e sem CPF", () => {
  const rota = ler("app/api/documentos/[id]/route.ts");
  assert.match(rota, /supabase\.from\("documentos_fiscais"\)\.select\("pdf_path"\)/);
  assert.doesNotMatch(rota, /createAdminClient/);
  assert.match(ler("lib/fiscal/emitir.ts"), /createSignedUrl\(pdfPath, 600/);
  const conferir = ler("app/(public)/conferir/[codigo]/page.tsx");
  assert.match(conferir, /LIMITE_HORA = 20/);
  assert.match(conferir, /rpc\("conferir_documento"/);
  assert.doesNotMatch(conferir, /locador_doc|locatario_doc|\.cpf\b|"cpf"/);
  assert.match(conferir, /robots: \{ index: false, follow: false \}/);
});

test("achados do #271: /precos condiciona a NF à NFSE_ATIVA; exemplos sem avaliação inventada e sem 'emite nota fiscal'", () => {
  const precos = ler("app/(public)/precos/page.tsx");
  assert.match(precos, /NFSE_ATIVA \? "emitida automaticamente a cada cobrança" : "emitida após a abertura do CNPJ"/);
  const exemplos = ler("lib/properties.ts");
  assert.doesNotMatch(exemplos, /reviews: \[/);
  assert.doesNotMatch(exemplos, /rating: [1-9]|reviewCount: [1-9]/);
  assert.doesNotMatch(exemplos, /issuesInvoice: true/);
  assert.doesNotMatch(exemplos, /nota fiscal/i);
  // QA 06/out: "imóveis mobiliados", nunca "Apartamento…" no texto dos exemplos; seguro-fiança sem parceiro não é "Recomendada".
  assert.doesNotMatch(exemplos.replace(/propertyType: "Apartamento"/g, ""), /apartamento/i);
  assert.doesNotMatch(precos, /Recomendad/);
});
