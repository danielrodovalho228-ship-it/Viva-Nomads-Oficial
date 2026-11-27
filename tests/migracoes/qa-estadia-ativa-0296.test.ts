/*
  0296 — E486 (só a massa): estadia ATIVA de teste da inquilino2@ (Ana) para a prova da manutenção do E485.
  Guardas: só contas de teste; anúncio de teste 4a693a63 (proprietario2@); a seed do D-5 (VN-CT-D5D50247) intocada;
  o contrato nasce EM VIGÊNCIA pela mesma regra que a manutenção usa; idempotente; o desfazer anula (não apaga) o registro.
  Roda: node --test tests/migracoes/qa-estadia-ativa-0296.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { contratoPermiteManutencao } from "../../src/lib/manutencao-solicitacoes.ts";

const ler = (p: string) => readFileSync(p, "utf8");
const semComentarios = (s: string) => s.replace(/--.*$/gm, "");
const corpo = (s: string) => {
  const c = semComentarios(s);
  return c.slice(c.indexOf("do $$"), c.indexOf("end\n$$;") + 7);
};
const mig = ler("supabase/migrations/0296_qa_estadia_ativa_inquilino2_e486.sql");
const aplicar = ler("supabase/producao/aplicar-0296.sql");
const volta = ler("supabase/producao/rollback/0296_rollback.sql");
const CONTRATO = "e4860000-0000-4000-8000-0000000000c1";

test("0296: o aplicar repete o corpo da migração, entre begin/commit, e se registra com o nome dela", () => {
  assert.ok(corpo(mig).length > 500);
  assert.equal(corpo(aplicar), corpo(mig));
  assert.match(aplicar, /^begin;$/m);
  assert.match(aplicar, /^commit;$/m);
  assert.match(aplicar, /select '20261105000296', '0296_qa_estadia_ativa_inquilino2_e486',/);
  assert.match(aplicar, /where not exists \(select 1 from supabase_migrations\.schema_migrations where version = '20261105000296'\)/);
});

test("0296: só contas de teste e o anúncio de teste do dono de teste; sem sobreposição; idempotente", () => {
  const c = semComentarios(mig);
  assert.match(c, /lower\(email\) = 'proprietario2@vivanomads\.com\.br' and is_teste/);
  assert.match(c, /lower\(email\) = 'inquilino2@vivanomads\.com\.br' and is_teste/);
  assert.match(c, /if v_dono is null or v_morador is null then[\s\S]*?return;/);
  assert.match(c, /c_imovel constant uuid := '4a693a63-8f4e-453c-a888-cd0ea9ccc4ff'/);
  assert.match(c, /where id = c_imovel and owner_id = v_dono and status = 'active' and title like 'TESTE QA%'/);
  assert.match(c, /if exists \(select 1 from public\.contratos where id = c_contrato\) then[\s\S]*?return;/);
  assert.match(c, /property_id = c_imovel and status in \('ativo', 'encerrado_em_acerto'\)\) then[\s\S]*?return;/);
  assert.match(c, /tenant_id = v_morador and status in \('ativo', 'encerrado_em_acerto'\)\) then[\s\S]*?return;/);
});

test("0296: a seed do D-5 e as outras massas ficam intocadas; só insere (e devolve o status dos pedidos da Ana)", () => {
  const c = semComentarios(mig);
  assert.doesNotMatch(c, /d5d50247|330ebf37|proprietario3cnpj|a0260|a0261|a0263|a0276|ddf86c66|AUTOMACOES_ATIVO|automacoes_envios|emails_teste/i);
  assert.doesNotMatch(c, /\bdelete\b/i);
  const updates = [...c.matchAll(/\bupdate public\.(\w+)/g)].map((m) => m[1]);
  assert.deepEqual(updates, ["pedidos_moradia"]);
  assert.match(c, /where pm\.id = antes\.id and pm\.status is distinct from antes\.status;/);
  const inserts = [...c.matchAll(/insert into public\.(\w+)/g)].map((m) => m[1]);
  assert.deepEqual(inserts, ["contratos", "contrato_blocos", "pagamentos_bloco"]);
});

test("0296: nasce EM VIGÊNCIA — ativo, as duas assinaturas e o 1º aluguel confirmado; bloco dentro de 180 dias e caução ≤ 3 aluguéis", () => {
  const c = semComentarios(mig);
  assert.match(c, /v_inicio date := current_date - 7;/);
  assert.match(c, /v_fim date := current_date \+ 52;/);
  assert.match(c, /values \(c_contrato, c_imovel, v_morador, 'ativo', 'temporada', daterange\(v_inicio, v_fim \+ 1, '\[\)'\), 'caucao'/);
  assert.match(c, /\(v_inicio - 1\)::timestamptz \+ interval '12 hours', \(v_inicio - 1\)::timestamptz \+ interval '12 hours'\);/);
  assert.match(c, /values \(c_bloco, c_contrato, 1, v_inicio, v_fim, 2, 6400, 3200, 'avista', 'pendente', 'ativo'\);/);
  assert.match(c, /values \(c_pagamento, c_bloco, c_contrato, 'aluguel', 3200, 'pix', v_inicio, v_dono, true,/);

  // A mesma linha, lida pela regra da manutenção (contratoPermiteManutencao), libera o pedido.
  const dia = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
  const linha = {
    status: "ativo",
    periodo: `[${dia(-7)},${dia(53)})`,
    assinado_proprietario_em: `${dia(-8)}T12:00:00Z`,
    assinado_inquilino_em: `${dia(-8)}T12:00:00Z`,
    pagamentos_bloco: [{ tipo: "aluguel", confirmado_pelo_inquilino: true, anulado_em: null }],
  };
  assert.equal(contratoPermiteManutencao(linha), true);
  // Sem o pagamento confirmado, não libera (por isso a massa traz o 1º aluguel).
  assert.equal(contratoPermiteManutencao({ ...linha, pagamentos_bloco: [] }), false);
});

test("0296: o desfazer sai pelo id fixo, solta os filhos sem cascata antes do contrato e anula (não apaga) o VN-CT", () => {
  const c = semComentarios(volta);
  assert.match(c, new RegExp(`c_contrato constant uuid := '${CONTRATO}'`));
  const ordem = [
    "delete from public.automacoes_envios",
    "delete from public.service_orders",
    "delete from public.parceiro_pedidos",
    "delete from public.conforto_pendencias",
    "delete from public.documentos_fiscais",
    "update public.documentos_registro",
    "delete from public.contratos",
  ];
  let pos = -1;
  for (const passo of ordem) {
    const i = c.indexOf(passo);
    assert.ok(i > pos, `ordem: ${passo}`);
    pos = i;
  }
  assert.doesNotMatch(c, /delete from public\.documentos_registro/);
  assert.match(c, /set status = 'anulado'/);
  assert.match(c, /delete from supabase_migrations\.schema_migrations where version = '20261105000296';/);
  assert.doesNotMatch(c, /d5d50247|330ebf37/);
  assert.match(c, /^begin;$/m);
  assert.match(c, /^commit;$/m);
});
