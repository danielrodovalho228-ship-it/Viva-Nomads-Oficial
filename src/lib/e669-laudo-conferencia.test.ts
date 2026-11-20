/*
  E669 — "Anexar laudo independente" (conferência de saída) aceitava QUALQUER arquivo que começasse com "%PDF" (um PDF de teste de
  193 bytes foi aceito na hora, com o aviso de que o laudo "prevalece sobre as fotos") e não oferecia remover nem trocar o anexo.
  Agora: (1) o arquivo é validado — PDF de verdade (cabeçalho + fim "%%EOF") e com tamanho mínimo de laudo; (2) o AUTOR pode
  remover ou trocar o laudo enquanto a conferência está aberta, com registro de quem, quando e por quê.
  Roda: node --test src/lib/e669-laudo-conferencia.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { validarLaudo, LAUDO_MIN_BYTES, ERRO_LAUDO_PEQUENO, ERRO_LAUDO_INCOMPLETO } from "./conferencia.ts";

const raiz = new URL("../../", import.meta.url);
const ler = (p: string) => readFileSync(new URL(p, raiz), "utf8");
const enc = new TextEncoder();
const pdf = (n: number, fim = "\n%%EOF\n") => {
  const cab = "%PDF-1.4\n";
  const corpo = "1 0 obj\n<< /Type /Catalog >>\nendobj\n";
  const miolo = "% preenchimento\n".repeat(Math.max(0, Math.ceil((n - cab.length - corpo.length - fim.length) / 16)));
  return enc.encode(cab + corpo + miolo + fim);
};

test("o PDF de teste de 193 bytes NÃO é aceito: pequeno demais para ser um laudo", () => {
  const b = pdf(193);
  const r = validarLaudo({ bytes: b, tamanho: b.length });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.erro, ERRO_LAUDO_PEQUENO);
  assert.ok(LAUDO_MIN_BYTES >= 1024);
});

test("só o cabeçalho %PDF com bytes de sobra, sem o fim do arquivo, também não passa", () => {
  const b = pdf(5000, "\n");
  const r = validarLaudo({ bytes: b, tamanho: b.length });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.erro, ERRO_LAUDO_INCOMPLETO);
});

test("um PDF completo (cabeçalho, corpo e %%EOF) do tamanho de um laudo passa; não-PDF e acima de 15 MB seguem recusados", () => {
  const b = pdf(5000);
  assert.deepEqual(validarLaudo({ bytes: b, tamanho: b.length }), { ok: true, tipo: "application/pdf", ext: "pdf" });
  const txt = enc.encode("não sou pdf ".repeat(300));
  assert.equal(validarLaudo({ bytes: txt, tamanho: txt.length }).ok, false);
  assert.equal(validarLaudo({ bytes: b, tamanho: 16 * 1024 * 1024 }).ok, false);
  assert.equal(validarLaudo({ bytes: new Uint8Array(), tamanho: 0 }).ok, false);
});

test("remover/trocar: ação do servidor só para o autor, conferência aberta, com limite e registro", () => {
  const a = ler("src/lib/data/conferencia-actions.ts");
  assert.match(a, /export async function retirarLaudoConferencia\(/);
  assert.match(a, /trocar_laudo_conferencia/);
  // quem anexou (enviado_por) é quem remove; a outra parte não
  assert.match(a, /nao_autor/);
  assert.match(a, /fechada/);
  // trocar = anexar com substituir=1: o arquivo novo é validado e subido ANTES de retirar o antigo
  assert.match(a, /formData\.get\("substituir"\)/);
});

test("a tela oferece Remover e Trocar para o autor (conferência aberta) e esconde para quem não anexou", () => {
  const t = ler("src/components/contrato/conferencia-contrato.tsx");
  assert.match(t, /data-testid=\{`conferencia-\$\{tipo\}-laudo-remover`\}/);
  assert.match(t, /data-testid=\{`conferencia-\$\{tipo\}-laudo-trocar`\}/);
  assert.match(t, /retirarLaudoConferencia/);
  assert.match(t, /laudo\.parte === parte/);
});

test("migração 0319: tabela de registro, troca atômica só pelo servidor, aplicar idempotente e rollback", () => {
  const mig = ler("supabase/migrations/0319_laudo_conferencia_retirada_e669.sql");
  const ap = ler("supabase/producao/aplicar-0319.sql");
  assert.ok(existsSync(new URL("supabase/producao/rollback/0319_rollback.sql", raiz)));
  for (const t of [mig, ap]) {
    assert.match(t, /create table if not exists public\.conferencia_laudos_retirados/);
    assert.match(t, /create or replace function public\.trocar_laudo_conferencia/);
    assert.match(t, /security definer/);
    assert.match(t, /revoke all on function public\.trocar_laudo_conferencia[\s\S]*from public, anon, authenticated/);
    assert.match(t, /grant execute on function public\.trocar_laudo_conferencia[\s\S]*to service_role/);
    assert.match(t, /viva\.laudo_troca/);
  }
  assert.match(ap, /^begin;/m);
  assert.match(ap, /commit;\s*$/);
  assert.match(ap, /insert into supabase_migrations\.schema_migrations[\s\S]*0319_laudo_conferencia_retirada_e669[\s\S]*where not exists/);
  assert.doesNotMatch(mig + ap, /drop table|truncate/i);
});

test("a tabela nova entra no inventário de retenção", () => {
  assert.match(ler("src/config/retencao.ts"), /conferencia_laudos_retirados/);
});
