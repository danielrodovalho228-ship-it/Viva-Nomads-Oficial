/*
  E690 — ativação automática do avaliador: regra pura, ligações atrás da chave e migração. Roda: node --test src/lib/vistoria/e690-ativacao-automatica.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DECIDIDO_PELO_SISTEMA, decidirAtivo, decidirEmTeste, registroDoSistema } from "./ativacao-automatica.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const completo = { identidadeVerificada: true, cpfTitularOuSocio: true as boolean | null, experiencia: true, condutaAceita: true, cidade: true };

test("solicitado → em_teste só com TODOS os critérios; sem identidade nunca avança", () => {
  assert.deepEqual(decidirEmTeste(completo), { ok: true });
  const sem = decidirEmTeste({ ...completo, identidadeVerificada: false });
  assert.equal(sem.ok, false);
  assert.match(String((sem as { falta: string[] }).falta), /identidade verificada/);
  for (const k of ["experiencia", "condutaAceita", "cidade"] as const) assert.equal(decidirEmTeste({ ...completo, [k]: false }).ok, false, k);
});

test("CPF titular/sócio do CNPJ: não conferido (null) ou negativo (false) não avança", () => {
  assert.equal(decidirEmTeste({ ...completo, cpfTitularOuSocio: null }).ok, false);
  assert.equal(decidirEmTeste({ ...completo, cpfTitularOuSocio: false }).ok, false);
});

test("em_teste → ativo exige teste concluído, aprovado na conferência e identidade", () => {
  assert.deepEqual(decidirAtivo({ testeConcluido: true, conferenciaPassou: true, identidadeVerificada: true }), { ok: true });
  assert.equal(decidirAtivo({ testeConcluido: false, conferenciaPassou: false, identidadeVerificada: true }).ok, false);
  assert.equal(decidirAtivo({ testeConcluido: true, conferenciaPassou: false, identidadeVerificada: true }).ok, false);
  assert.equal(decidirAtivo({ testeConcluido: true, conferenciaPassou: true, identidadeVerificada: false }).ok, false);
});

test("o registro diz 'decidido pelo sistema' com os critérios do momento e a fonte simulada", () => {
  const r = registroDoSistema("em_teste", completo, { identidade: "simulada", cpf: "simulada" }, new Date("2026-11-08T12:00:00Z"));
  assert.equal(r.decididoPeloSistema, true);
  assert.ok(r.motivo.startsWith(DECIDIDO_PELO_SISTEMA));
  assert.match(r.motivo, /identidade verificada \(simulada, conta de teste\)/);
  assert.match(r.motivo, /CPF verificado é titular ou sócio do CNPJ \(simulado, conta de teste\)/);
  assert.ok(r.motivo.length <= 500);
  assert.equal(r.criterios.etapa, "em_teste");
  assert.equal((r.criterios as { identidadeVerificada: boolean }).identidadeVerificada, true);
});

test("a chave nasce desligada e tudo só age com ela; o servidor nunca lança e usa a MESMA fonte de identidade", () => {
  assert.match(ler("src/lib/flags.ts"), /export const AVALIADOR_ATIVACAO_AUTOMATICA_ATIVA = process\.env\.NEXT_PUBLIC_AVALIADOR_ATIVACAO_AUTOMATICA_ATIVA === "on";/);
  assert.match(ler("src/config/chaves-ambiente.ts"), /nome: "AVALIADOR_ATIVACAO_AUTOMATICA_ATIVA"/);
  const srv = ler("src/lib/vistoria/ativacao-automatica-servidor.ts");
  assert.match(srv, /if \(!AVALIADOR_ATIVACAO_AUTOMATICA_ATIVA\) return NADA/);
  assert.match(srv, /estadoIdentidade\(admin, c\.user_id\)/);
  assert.match(srv, /catch \(e\)/);
  assert.match(srv, /\.eq\("status", "solicitado"\)/); // passo guardado pelo status de origem
  assert.match(srv, /\.eq\("status", "em_teste"\)/);
  assert.match(srv, /decidido_por: null/);
  // Conta real: o CPF do titular/sócio não é conferível ainda → nada avança sozinho.
  assert.match(srv, /teste \? \{ valor: true, fonte: "simulada" \} : \{ valor: null, fonte: "real" \}/);
  assert.doesNotMatch(srv, /AUTOMACOES_ATIVO/);
});

test("as três ligações: pedido de credenciamento, identidade verificada e laudo de teste emitido", () => {
  assert.match(ler("src/lib/vistoria/actions.ts"), /await tentarAtivacaoAutomatica\(s\.admin, \{ userId: s\.userId \}\)/);
  assert.match(ler("src/app/api/caf/verify/route.ts"), /await tentarAtivacaoAutomatica\(admin, \{ userId: user\.id \}\)/);
  assert.match(ler("src/lib/vistoria/laudo-servidor.ts"), /if \(p\.teste && p\.avaliador_id\) await tentarAtivacaoAutomatica\(admin, \{ credenciamentoId: p\.avaliador_id \}\)/);
});

test("a migração 0335 só acrescenta colunas opcionais e tem aplicar e rollback", () => {
  for (const f of ["supabase/migrations/0335_avaliador_decidido_pelo_sistema_e690.sql", "supabase/producao/aplicar-0335.sql"]) {
    const sql = ler(f).replace(/^\s*--.*$/gm, "");
    assert.match(sql, /add column if not exists decidido_pelo_sistema boolean not null default false/);
    assert.match(sql, /add column if not exists criterios_decisao jsonb/);
    assert.doesNotMatch(sql, /\b(update|delete)\s+(from\s+)?public\./i);
  }
  assert.match(ler("supabase/producao/aplicar-0335.sql"), /'20261107000335', '0335_avaliador_decidido_pelo_sistema_e690'/);
  assert.match(ler("supabase/producao/rollback/0335_rollback.sql"), /drop column if exists decidido_pelo_sistema/);
});
