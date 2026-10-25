/*
  L2-B itens 12 e 13 — um estado da caução para a Garantias, os Contratos e as telas do inquilino.
  Roda: node --test src/lib/caucao-estado.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { acertoMaisRecente, caucaoDoChecklist, estadoCaucao, type EntradaCaucao } from "./caucao-estado.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const BLOCOS = [{ caucao: 3200, caucaoStatus: "pendente" }, { caucao: 3200, caucaoStatus: "pendente" }];

test("contrato sem blocos não é 'pendente': diz o estado real", () => {
  assert.equal(estadoCaucao({ blocos: [], pagamentos: [] }).chave, "sem_caucao");
  assert.equal(estadoCaucao({ blocos: [], pagamentos: [] }).pendente, false);
  // Sem blocos, mas com o recebimento da caução registrado e confirmado: recebida, com o valor do registro.
  const r = estadoCaucao({ blocos: [], pagamentos: [{ tipo: "caucao", valor: 3200, confirmado: true }] });
  assert.deepEqual([r.chave, r.valor], ["recebida", 3200]);
});

test("a receber → registrada → recebida → devolvida", () => {
  const base: EntradaCaucao = { blocos: BLOCOS, pagamentos: [] };
  assert.deepEqual([estadoCaucao(base).chave, estadoCaucao(base).valor, estadoCaucao(base).pendente], ["a_receber", 6400, true]);
  const reg = { ...base, pagamentos: [{ tipo: "caucao", valor: 6400, confirmado: false }] };
  assert.equal(estadoCaucao(reg).chave, "aguardando_confirmacao");
  const conf = { ...base, pagamentos: [{ tipo: "caucao", valor: 6400, confirmado: true }] };
  assert.equal(estadoCaucao(conf).chave, "recebida");
  assert.equal(estadoCaucao({ blocos: [{ caucao: 6400, caucaoStatus: "comprovada" }], pagamentos: [] }).chave, "recebida", "comprovada no bloco também vale");
  // Recebimento anulado não conta.
  assert.equal(estadoCaucao({ ...base, pagamentos: [{ tipo: "caucao", valor: 6400, confirmado: true, anulado: true }] }).chave, "a_receber");
  // Pagamento de aluguel não é caução.
  assert.equal(estadoCaucao({ ...base, pagamentos: [{ tipo: "aluguel", valor: 6400, confirmado: true }] }).chave, "a_receber");
  for (const [status, chave] of [
    ["aguardando_confirmacao", "devolucao_aguardando"],
    ["devolvida_integral", "devolvida"],
    ["desconto_confirmado", "devolvida_com_desconto"],
    ["desconto_contestado", "desconto_contestado"],
  ] as const) {
    assert.equal(estadoCaucao({ ...conf, acerto: { status } }).chave, chave);
  }
  assert.equal(estadoCaucao({ ...base, garantia: "seguro_fianca" }).chave, "dispensada");
});

test("checklist da Estadia: três estados pela mesma fonte", () => {
  assert.equal(caucaoDoChecklist(estadoCaucao({ blocos: [], pagamentos: [] })), "dispensada");
  assert.equal(caucaoDoChecklist(estadoCaucao({ blocos: BLOCOS, pagamentos: [] })), "pendente");
  assert.equal(caucaoDoChecklist(estadoCaucao({ blocos: BLOCOS, pagamentos: [{ tipo: "caucao", valor: 1, confirmado: false }] })), "pendente");
  assert.equal(caucaoDoChecklist(estadoCaucao({ blocos: BLOCOS, pagamentos: [{ tipo: "caucao", valor: 1, confirmado: true }] })), "recebida");
  assert.equal(caucaoDoChecklist(estadoCaucao({ blocos: BLOCOS, pagamentos: [], garantia: "seguro_fianca" })), "dispensada");
  assert.equal(acertoMaisRecente([{ created_at: "2026-01-01", s: "a" }, { created_at: "2026-03-01", s: "b" }])?.s, "b");
});

test("a mesma caução nas duas telas (e na do inquilino): todas leem estadoCaucao", () => {
  const acoes = ler("src/lib/data/contratos-actions.ts");
  // Dono (Contratos e Garantias) e inquilino (Minhas locações) recebem `caucao` da mesma função, com o acerto junto.
  assert.equal((acoes.match(/caucao: caucaoDaLinha\(/g) ?? []).length, 2);
  assert.match(acoes, /caucao_acertos\(status, valor_devolvido, created_at\)/);
  // PROP-5: a Caução lista por bloco (lib/contratos/area-dono.ts), com o status de estadoCaucao e a devolução do
  // estado do contrato (c.caucao, que já traz o acerto).
  const garantias = ler("src/app/(dashboard)/dashboard/garantias/garantias-client.tsx");
  assert.match(garantias, /linhasCaucaoPorBloco\(demoOn \? demoContratos\(\) : contratos\)/);
  assert.doesNotMatch(garantias, /caucaoStatus === "pendente"/);
  assert.match(garantias, /\{linha\.status\}/);
  const area = ler("src/lib/contratos/area-dono.ts");
  assert.match(area, /const e = estadoCaucao\(\{ blocos: \[b\], pagamentos: c\.pagamentos \}\)/);
  assert.match(area, /c\.caucao\.rotulo : DEVOLUCAO_AO_FIM/);
  assert.match(ler("src/app/(dashboard)/dashboard/contratos/contratos-client.tsx"), /data-testid="caucao-contrato-estado"[^>]*>\s*\{contrato\.caucao\.rotulo\}/);
  assert.match(ler("src/app/(dashboard)/dashboard/locacoes/locacoes-client.tsx"), /data-testid="locacao-caucao"[\s\S]{0,200}\{l\.caucao\.rotulo\}/);
  assert.match(ler("src/lib/data/estadia.ts"), /caucaoDoChecklist\(\s*estadoCaucaoUnico\(/);
});
