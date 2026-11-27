/*
  E627 (rodada 6): contrato encerrado de fato aparecia "Em vigência" e sem o botão da ação. Causa: o ciclo diário só fechava o contrato
  quando o PRÓPRIO ciclo encerrava um bloco; um bloco já 'encerrado' (válido no schema, vindo do caminho manual e da massa 0268) ficava
  de fora para sempre, o contrato seguia 'ativo' sem encerrado_em, e a avaliação (0089) nunca abria. A 0306 acrescenta o passo (e).
  Roda: node --test src/lib/e627-ciclo-fecha-contrato.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { podeAvaliarLocacao } from "./contrato-assinar.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const mig = ler("supabase/migrations/0306_ciclo_fecha_contrato_encerrado_e627.sql");
const semComentario = (s: string) => s.replace(/--.*$/gm, "");
const passos = (s: string) => semComentario(s).replace(/\s+/g, " ").trim();

test("E627: a 0306 mantém os passos (0) a (d) exatamente como a 0063 (nada regride)", () => {
  const antiga = ler("supabase/migrations/0063_dinheiro_regras.sql");
  const trecho = (s: string) => {
    const i = s.indexOf("create or replace function public.avancar_ciclo_blocos()");
    const f = s.indexOf("-- (e) E627");
    return passos(s.slice(i, f === -1 ? s.indexOf("end\n$fn$;", i) : f));
  };
  assert.equal(trecho(mig), trecho(antiga));
});

test("E627: o passo (e) fecha o contrato ativo cujos blocos todos acabaram, com encerrado_em no fim real da estadia", () => {
  const e = passos(mig.slice(mig.indexOf("-- (e) E627")));
  assert.match(e, /update contratos c set status = 'encerrado_sem_renovacao'/);
  assert.match(e, /encerrado_em = coalesce\(c\.encerrado_em, \(\(\(select max\(b\.fim\) from contrato_blocos b where b\.contrato_id = c\.id\) \+ 1\)::timestamp at time zone 'America\/Sao_Paulo'\)\)/);
  assert.match(e, /where c\.status = 'ativo'/);
  assert.match(e, /b\.status in \('encerrado', 'encerrado_sem_renovacao'\)/); // o 'encerrado' que o ciclo ignorava
  assert.match(e, /not exists \(select 1 from contrato_blocos b where b\.contrato_id = c\.id and b\.status in \('agendado', 'ativo', 'pendente_aceite'\)\)/); // renovação pendente segura o contrato
  assert.match(e, /\(select max\(b\.fim\) from contrato_blocos b where b\.contrato_id = c\.id\) < hoje/); // o último dia já passou
});

test("E627: exceção TEMPORÁRIA e explícita — o contrato do E289 (a0268b00) não é tocado até a decisão do Daniel", () => {
  assert.match(mig, /and c\.id <> 'a0268b00-0000-4000-8000-000000000011'/);
  assert.match(mig, /EXCEÇÃO TEMPORÁRIA/);
  assert.equal((mig.match(/a0268b00-0000-4000-8000-000000000011/g) ?? []).length, 1);
  assert.doesNotMatch(mig, /d5d50247|AUTOMACOES_ATIVO/);
});

test("E627: aplicar embrulha o mesmo corpo, se registra e o rollback volta à função da 0063", () => {
  const ap = ler("supabase/producao/aplicar-0306.sql");
  assert.ok(ap.includes(mig.trim()));
  assert.match(ap, /'20261105000306', '0306_ciclo_fecha_contrato_encerrado_e627'/);
  const rb = ler("supabase/producao/rollback/0306_rollback.sql");
  assert.doesNotMatch(semComentario(rb), /\(e\)|max\(b\.fim\)/);
  assert.match(rb, /version = '20261105000306'/);
});

test("E627: o botão 'Avaliar' só abre com status encerrado + encerrado_em — por isso o contrato tem de ser fechado no banco, não só no selo", () => {
  const dia = (d: string) => new Date(d);
  assert.equal(podeAvaliarLocacao("ativo", null, dia("2026-11-06T12:00:00Z")), false); // o defeito: período acabou, banco ainda 'ativo'
  // depois do passo (e): status encerrado + encerrado_em no fim real (31/10 00h BRT) → dentro dos 14 dias
  assert.equal(podeAvaliarLocacao("encerrado_sem_renovacao", "2026-10-31T03:00:00Z", dia("2026-11-06T12:00:00Z")), true);
  assert.equal(podeAvaliarLocacao("encerrado_sem_renovacao", "2026-10-31T03:00:00Z", dia("2026-11-20T12:00:00Z")), false); // passou a janela
});
