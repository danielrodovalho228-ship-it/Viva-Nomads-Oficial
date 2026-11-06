/*
  E634 (aprovado pelo Daniel em 05/11/2026): FICHA-RESUMO do contrato — página-resumo gerada dos dados do contrato:
  datas de início e fim, valor, vencimento e conta de recebimento, com AUTORIZAÇÃO EXPRESSA registrada quando a conta for de
  terceiro. Construída atrás de chave DESLIGADA (FICHA_RESUMO_ATIVA); entra no ar junto com o modelo de contrato da
  Dra. Beatriz. Só guarda o FINAL do documento e da conta/Pix (a Viva guarda a chave e o resultado, não o dado bruto).
  Roda: node --test src/lib/e634-ficha-resumo-contrato.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  VERSAO_TEXTO_AUTORIZACAO,
  diaVencimentoValido,
  finalDe,
  montarFicha,
  textoAutorizacaoTerceiro,
  validarContaRecebimento,
  type DadosFicha,
} from "./contrato-ficha-resumo.ts";
import { CHAVES_AMBIENTE } from "../config/chaves-ambiente.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

const propria = { titularNome: "Marcos Lima", titularDocumento: "123.456.789-09", instituicao: "Nubank", referencia: "marcos@exemplo.com", titularProprio: true, autorizo: false };
const terceiro = { titularNome: "Ana Souza", titularDocumento: "98765432100", instituicao: "Itaú", referencia: "00123-4", titularProprio: false, autorizo: true };

test("o final do documento e da conta: só os últimos caracteres; nunca o dado inteiro", () => {
  assert.equal(finalDe("123.456.789-09", 4), "8909");
  assert.equal(finalDe("marcos@exemplo.com", 4), ".com");
  assert.equal(finalDe("12", 4), "12");
});

test("dia de vencimento: de 1 a 28 (existe em todo mês)", () => {
  assert.equal(diaVencimentoValido(1), true);
  assert.equal(diaVencimentoValido(28), true);
  assert.equal(diaVencimentoValido(29), false);
  assert.equal(diaVencimentoValido(0), false);
  assert.equal(diaVencimentoValido(5.5), false);
});

test("conta do próprio proprietário: vale sem autorização; grava só os finais", () => {
  const r = validarContaRecebimento(propria, "Marcos Lima");
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.valor.titularProprio, true);
    assert.equal(r.valor.titularDocumentoFinal, "8909");
    assert.equal(r.valor.referenciaFinal, ".com");
    assert.equal(r.valor.precisaAutorizacao, false);
    assert.ok(!JSON.stringify(r.valor).includes("123.456.789"), "o documento inteiro nunca é guardado");
  }
});

test("conta de TERCEIRO: sem autorização expressa não vale; com ela, precisa registrar quem, quando e qual texto", () => {
  const sem = validarContaRecebimento({ ...terceiro, autorizo: false }, "Marcos Lima");
  assert.equal(sem.ok, false);
  if (!sem.ok) assert.ok(sem.erros.some((e) => /autoriza/i.test(e)));
  const com = validarContaRecebimento(terceiro, "Marcos Lima");
  assert.ok(com.ok);
  if (com.ok) {
    assert.equal(com.valor.titularProprio, false);
    assert.equal(com.valor.precisaAutorizacao, true);
  }
  assert.match(textoAutorizacaoTerceiro("Ana Souza"), /Ana Souza/);
  assert.match(textoAutorizacaoTerceiro("Ana Souza"), /autorizo/i);
  assert.ok(VERSAO_TEXTO_AUTORIZACAO.length > 0);
});

test('dizer "é minha" com o titular de outro nome não passa (cai como erro, não como conta própria)', () => {
  const r = validarContaRecebimento({ ...terceiro, titularProprio: true, autorizo: false }, "Marcos Lima");
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.erros.some((e) => /terceiro|outro nome|não é o do proprietário/i.test(e)));
});

test("campos obrigatórios da conta", () => {
  const r = validarContaRecebimento({ ...propria, titularNome: "", instituicao: "", referencia: "", titularDocumento: "12" }, "Marcos Lima");
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.erros.length >= 4);
});

const base: DadosFicha = {
  numero: "VN-CT-D5D50247", imovel: "Apto Santa Mônica", proprietario: "Marcos Lima", inquilino: "Ana Souza",
  inicio: "2026-11-01", fim: "2027-02-28", aluguelMensal: 2700, diaVencimento: 5,
  conta: { titularNome: "Marcos Lima", titularDocumentoFinal: "8909", instituicao: "Nubank", referenciaFinal: ".com", titularProprio: true, autorizacaoEm: null },
};

test("a ficha traz início, fim, valor, vencimento e conta de recebimento, e fica completa", () => {
  const f = montarFicha(base);
  const por = Object.fromEntries(f.linhas.map((l) => [l.rotulo, l.valor]));
  assert.equal(por["Início"], "01/11/2026");
  assert.equal(por["Fim"], "28/02/2027");
  assert.match(por["Aluguel mensal"], /2\.700/);
  assert.match(por["Vencimento"], /dia 5/);
  assert.match(por["Conta de recebimento"], /Marcos Lima/);
  assert.match(por["Conta de recebimento"], /final 8909/);
  assert.equal(f.completa, true);
  assert.deepEqual(f.pendencias, []);
});

test("conta de terceiro: a ficha mostra a autorização expressa e a data em que foi registrada", () => {
  const f = montarFicha({ ...base, conta: { ...base.conta!, titularNome: "Ana Souza", titularProprio: false, autorizacaoEm: "2026-11-03T15:00:00Z" } });
  const por = Object.fromEntries(f.linhas.map((l) => [l.rotulo, l.valor]));
  assert.match(por["Titularidade da conta"], /terceiro/i);
  assert.match(por["Titularidade da conta"], /autorização expressa/i);
  assert.match(por["Titularidade da conta"], /03\/11\/2026/);
  assert.equal(f.completa, true);
});

test("conta de terceiro SEM autorização registrada deixa a ficha incompleta (pendência dita)", () => {
  const f = montarFicha({ ...base, conta: { ...base.conta!, titularProprio: false, autorizacaoEm: null } });
  assert.equal(f.completa, false);
  assert.ok(f.pendencias.some((p) => /autoriza/i.test(p)));
});

test("faltando vencimento ou conta, a ficha não inventa: diz o que falta", () => {
  const f = montarFicha({ ...base, diaVencimento: null, conta: null });
  assert.equal(f.completa, false);
  assert.ok(f.pendencias.some((p) => /vencimento/i.test(p)));
  assert.ok(f.pendencias.some((p) => /conta de recebimento/i.test(p)));
});

test("chave FICHA_RESUMO_ATIVA: registrada, DESLIGADA por padrão, e a página e as ações param quando desligada", () => {
  assert.ok(CHAVES_AMBIENTE.some((c) => c.nome === "FICHA_RESUMO_ATIVA" && c.variavel === "NEXT_PUBLIC_FICHA_RESUMO_ATIVA"));
  const flags = ler("src/lib/flags.ts");
  assert.match(flags, /export const FICHA_RESUMO_ATIVA = process\.env\.NEXT_PUBLIC_FICHA_RESUMO_ATIVA === "on";/);
  assert.match(flags, /Beatriz/);
  const pagina = ler("src/app/(dashboard)/dashboard/contratos/[id]/ficha/page.tsx");
  assert.match(pagina, /if \(!FICHA_RESUMO_ATIVA\) notFound\(\);/);
  const acoes = ler("src/lib/data/ficha-resumo-actions.ts");
  assert.match(acoes, /if \(!FICHA_RESUMO_ATIVA\)/);
});

test("servidor: só o proprietário grava; a autorização do terceiro registra quem, quando e a versão do texto", () => {
  const acoes = ler("src/lib/data/ficha-resumo-actions.ts");
  assert.match(acoes, /owner_id/);
  assert.match(acoes, /autorizacao_terceiro_em/);
  assert.match(acoes, /autorizacao_terceiro_por/);
  assert.match(acoes, /autorizacao_texto_versao: v\.valor\.precisaAutorizacao \? VERSAO_TEXTO_AUTORIZACAO : null/);
  assert.match(acoes, /validarContaRecebimento\(/);
  assert.doesNotMatch(acoes, /titular_documento:\s/, "o documento inteiro não é gravado");
});

test("migração 0308: tabela nova com RLS, só finais, e a autorização do terceiro é obrigatória no próprio banco", () => {
  const m = ler("supabase/migrations/0308_contrato_ficha_resumo_e634.sql");
  assert.match(m, /create table if not exists public\.contrato_ficha_resumo/);
  assert.match(m, /enable row level security/);
  assert.match(m, /revoke all on public\.contrato_ficha_resumo from anon, authenticated/);
  assert.match(m, /dia_vencimento smallint/);
  assert.match(m, /between 1 and 28/);
  assert.match(m, /conta_titular_proprio is not false\s+or/);
  assert.match(m, /autorizacao_terceiro_em is not null/);
  assert.match(m, /autorizacao_terceiro_por is not null/);
  assert.doesNotMatch(m, /titular_documento text/, "só o final do documento");
  assert.ok(existsSync(new URL("../../supabase/producao/aplicar-0308.sql", import.meta.url)));
  assert.ok(existsSync(new URL("../../supabase/producao/rollback/0308_rollback.sql", import.meta.url)));
  const ap = ler("supabase/producao/aplicar-0308.sql");
  assert.match(ap, /begin;/);
  assert.match(ap, /20261105000308/);
  assert.match(ap, /0308_contrato_ficha_resumo_e634/);
  assert.match(ap, /commit;/);
});

test("retenção: a tabela está no inventário (final do documento e da conta ligados a uma pessoa)", () => {
  assert.match(ler("src/config/retencao.ts"), /i\("contrato_ficha_resumo", "public\.contrato_ficha_resumo"/);
});
