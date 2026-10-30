/*
  0261 — massa da prova ao vivo do E213 (limpeza da saída × renovação): dois contratos de teste com saída em D+4, o
  parceiro fixo de limpeza de teste em automático e o pedido da saída já criado — (a) sem aceite, (b) aceito e agendado.
  Guardas: só contas e anúncios de teste, longe da seed do D-5 e da 0260; a chave do pedido é a do cron; e as regras do
  E213 levam cada caminho aonde o roteiro diz.
  Roda: node --test src/lib/qa/massa-e213.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chaveAutomacao, janelaDaLimpeza, DIAS_ANTES_LIMPEZA, DIAS_ANTES_SUGESTAO } from "../automacao/pedidos-do-evento.ts";
import { chaveRemarcada, chaveSugestaoMorador, decidirRecusaDaNovaData, decidirRemarcacao, reagendamentoPendente } from "../automacao/remarcacao.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const somaDias = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

const IMOVEL_A = "b30ddd02-48d9-4d37-9520-a92c894af6bb";
const IMOVEL_B = "57bcac8e-e45a-4fa6-a430-1579f9035a94";
const CONTRATO_A = "a0261a00-0000-4000-8000-000000000022";
const CONTRATO_B = "a0261b00-0000-4000-8000-000000000032";

test("0261: só contas e anúncios de teste, ids fixos, fora da seed do D-5 e da 0260; aplicar idempotente e desfazer", () => {
  const mig = ler("supabase/migrations/0261_qa_limpeza_renovacao_e213.sql");
  const aplicar = ler("supabase/producao/aplicar-0261.sql");
  for (const sql of [mig, aplicar]) {
    for (const email of ["proprietario1", "cadastro-teste-2310", "cadastro2", "cadastro3"]) {
      assert.match(sql, new RegExp(`lower\\(email\\) = '${email}@vivanomads\\.com\\.br' and is_teste`), email);
    }
    assert.match(sql, /title like '\[TESTE QA%'/);
    assert.match(sql, new RegExp(`c_imovel_a constant uuid := '${IMOVEL_A}'`));
    assert.match(sql, new RegExp(`c_imovel_b constant uuid := '${IMOVEL_B}'`));
    // Guardas: estadia ativa, parceiro de limpeza no anúncio, conta já parceira → nada a fazer.
    assert.match(sql, /property_id in \(c_imovel_a, c_imovel_b\) and status = 'ativo'/);
    assert.match(sql, /categoria = 'limpeza' and status in \('pendente', 'ativo'\)/);
    assert.match(sql, /from public\.parceiros where user_id = v_parceiro_user/);
    // Nada da seed do D-5 (contrato, Premium, parceiro proprietario3cnpj, Ana), da 0260 (Carteira 2, cadastro1) nem chaves.
    const codigo = sql.replace(/--.*$/gm, "");
    assert.doesNotMatch(codigo, /d5d50247|330ebf37|proprietario3cnpj|inquilino2@|a0260000|297b71ec|cadastro1@|AUTOMACOES_ATIVO|automacoes_envios|emails_teste/);
    // Saída em D+4 (dentro do D-5 e do D-7 de agora); os dois pedidos nos dois caminhos.
    assert.match(sql, /v_saida date := current_date \+ 4;/);
    assert.match(sql, /'VN-SV-E213A261'[\s\S]*'solicitado', false/);
    assert.match(sql, /'VN-SV-E213B261'[\s\S]*'agendado', false[\s\S]*250, 0\.100, 25, 225\)/);
    // A chave do pedido é a do cron (imóvel:limpeza:contrato:saida): o D-5 não cria um segundo.
    assert.match(sql, /c_imovel_a \|\| ':limpeza:' \|\| c_contrato_a \|\| ':saida'/);
    assert.match(sql, /c_imovel_b \|\| ':limpeza:' \|\| c_contrato_b \|\| ':saida'/);
    assert.match(sql, /'automatico', 'ativo', now\(\)\)/);
  }
  assert.match(aplicar, /^begin;$/m);
  assert.match(aplicar, /^commit;$/m);
  assert.match(aplicar, /'20261030000261', '0261_qa_limpeza_renovacao_e213'/);
  const volta = ler("supabase/producao/rollback/0261_rollback.sql");
  assert.match(volta, new RegExp(`'${CONTRATO_A}', '${CONTRATO_B}'`));
  assert.match(volta, /contrato_id = any \(c_contratos\) or parceiro_id = c_parceiro/);
  assert.match(volta, /delete from public\.automacoes_envios e/);
  assert.match(volta, /delete from supabase_migrations\.schema_migrations where version = '20261030000261';/);
  assert.doesNotMatch(volta.replace(/--.*$/gm, ""), /d5d50247|330ebf37|a0260000/);
});

test("0261: a chave e a janela da massa são as que o código usa", () => {
  assert.equal(chaveAutomacao(IMOVEL_A, "limpeza", CONTRATO_A, "saida"), `${IMOVEL_A}:limpeza:${CONTRATO_A}:saida`);
  // Saída às 11:00 de Brasília (o anúncio não tem horário): janela das 13:00 do dia da saída até 48 h depois das 11:00.
  const j = janelaDaLimpeza({ id: CONTRATO_A, propertyId: IMOVEL_A, saida: "2026-11-03", checkoutBefore: null, proximaEntrada: null });
  assert.equal(j.inicio, "2026-11-03T16:00:00.000Z");
  assert.equal(j.fim, "2026-11-05T14:00:00.000Z");
});

test("E213: (a) sem aceite e a nova saída longe → cancela com o sufixo, e o cron refaz no D-5 da nova saída", () => {
  const D = "2026-10-31";
  const novaSaida = somaDias(D, 4 + 30); // prorrogação de 1 mês
  assert.equal(decidirRemarcacao("solicitado", novaSaida, D), "cancelar_remarcado");
  assert.equal(decidirRemarcacao("orcado", novaSaida, D), "cancelar_remarcado");
  const chave = chaveAutomacao(IMOVEL_A, "limpeza", CONTRATO_A, "saida");
  assert.match(chaveRemarcada(chave, 1), new RegExp(`^${chave}:remarcado:1$`));
  // O cron cria o pedido quando a saída está a até 5 dias: o 1º dia é a nova saída − 5.
  assert.equal(somaDias(novaSaida, -DIAS_ANTES_LIMPEZA), somaDias(D, 29));
});

test("E213: (b) aceito/agendado → reagendamento; recusa da nova data longe → cancela com o sufixo", () => {
  const D = "2026-10-31";
  const novaSaida = somaDias(D, 34);
  assert.equal(decidirRemarcacao("agendado", novaSaida, D), "reagendar");
  assert.equal(decidirRemarcacao("aceito", novaSaida, D), "reagendar");
  // Depois do reagendamento o pedido fica "aceito" esperando o parceiro; confirmar o horário encerra a espera.
  assert.equal(reagendamentoPendente("aceito", ["reagendamento", "solicitado"]), true);
  assert.equal(reagendamentoPendente("agendado", ["confirmar_horario", "reagendamento"]), false);
  assert.equal(decidirRecusaDaNovaData(novaSaida, D), "cancelar_remarcado");
  // Em execução, entregue ou concluído: a renovação não mexe.
  assert.equal(decidirRemarcacao("entregue", novaSaida, D), "nada");
});

test("E213: a sugestão à moradora leva a data da saída — sai de novo no D-7 da nova saída", () => {
  const D = "2026-10-31";
  const antes = chaveSugestaoMorador(CONTRATO_A, "m", "saida", somaDias(D, 4));
  const depois = chaveSugestaoMorador(CONTRATO_A, "m", "saida", somaDias(D, 34));
  assert.notEqual(antes, depois);
  assert.equal(somaDias(somaDias(D, 34), -DIAS_ANTES_SUGESTAO), somaDias(D, 27));
});
