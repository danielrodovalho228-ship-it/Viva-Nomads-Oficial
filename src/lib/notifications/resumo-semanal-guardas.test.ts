/*
  E375-B — guardas do resumo semanal: chave desligada por padrão, só às terças dentro do cron que já existe (sem cron
  novo), antes do despacho da fila; botão do QA só para contas de teste e com 2FA; evento nos registros; migrações.
  Roda: node --test src/lib/notifications/resumo-semanal-guardas.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const ler = (p: string) => readFileSync(p, "utf8");

test("chave RESUMO_SEMANAL_ATIVO: desligada por padrão (só '1' liga) e listada em /admin/sistema", () => {
  assert.match(ler("src/lib/flags.ts"), /export const RESUMO_SEMANAL_ATIVO = process\.env\.RESUMO_SEMANAL_ATIVO === "1";/);
  assert.match(ler("src/config/chaves-ambiente.ts"), /nome: "RESUMO_SEMANAL_ATIVO"/);
});

test("sem cron novo: roda dentro de /api/cron/resumo-pedidos, só às terças com a chave, ANTES do despacho da fila", () => {
  const vercel = ler("vercel.json");
  assert.doesNotMatch(vercel, /resumo-semanal/);
  const rota = ler("src/app/api/cron/resumo-pedidos/route.ts");
  assert.match(rota, /resumoRodaHoje\(agora, RESUMO_SEMANAL_ATIVO\)/);
  assert.ok(rota.indexOf("enviarResumosSemanais(agora)") < rota.indexOf("enviarResumosDiarios()"), "o resumo sai antes do despacho diário da fila");
});

test("servidor: destinatários por pedido ativo ou busca com alerta; teto e silêncio; reserva antes do envio; sem novidade, sem envio", () => {
  const s = ler("src/lib/notifications/resumo-semanal-servidor.ts");
  assert.match(s, /from\("pedidos_moradia"\)\.select\("inquilino_id"\)\.eq\("status", "ativo"\)/);
  assert.match(s, /from\("buscas_salvas"\)\.select\("usuario_id"\)\.eq\("alerta_ativo", true\)/);
  assert.doesNotMatch(s, /from\("eventos"\)/);
  assert.match(s, /podeEnviarProativo\(await enviosRecentes\(admin, usuarioId, agora\), agora\)/);
  assert.match(s, /if \(!temNovidade\(sel\)\) return "vazio";/);
  assert.ok(s.indexOf("upsert(linhas") < s.indexOf("await notify("), "as linhas são reservadas antes do envio");
  assert.match(s, /\.gte\("publicado_em", inicioDaJanela\(agora\)\)/);
  assert.match(s, /from\("quedas_preco"\)/);
  assert.match(s, /imovelBateComBusca\(b\.parametros, imovel\)/);
  assert.match(s, /paresCompat\(admin, \{ pedido: p\.id \}\)/);
});

test("botão do QA: só contas is_teste, admin com 2FA, registrado no log", () => {
  const a = ler("src/lib/data/resumo-semanal-qa-actions.ts");
  assert.match(a, /exigirAdminAal2\(sessao, user\.id\)/);
  assert.match(a, /enviarResumosSemanais\(new Date\(\), \{ soTeste: true, ignorarTeto: true \}\)/);
  assert.match(a, /ACOES_DADOS_TESTE\.resumoSemanalGerado/);
  const pagina = ler("src/app/(dashboard)/admin/dados-de-teste/page.tsx");
  assert.match(pagina, /<GerarResumoSemanal \/>/);
  assert.match(ler("src/app/(dashboard)/admin/dados-de-teste/gerar-resumo-semanal.tsx"), /Gerar resumo semanal agora/);
});

test("evento resumo_semanal registrado (texto, matriz na categoria sugestões, imagem) e aceito pela fila (0275)", () => {
  assert.match(ler("src/lib/notifications/eventos-email.ts"), /\| "resumo_semanal"/);
  assert.match(ler("src/config/matriz-notificacoes.ts"), /resumo_semanal: \{ categoria: "sugestoes", papeis: \["morador"\]/);
  assert.match(ler("src/lib/notifications/imagens-email.ts"), /resumo_semanal: "busca"/);
  const m = ler("supabase/migrations/0275_resumo_semanal.sql");
  assert.match(m, /'pedido_expirando', 'resumo_semanal'/);
});

test("migrações 0275 e 0276: aplicar idempotente registrado, rollback, massa só de teste e por id", () => {
  for (const n of ["0275", "0276"]) {
    assert.ok(existsSync(`supabase/producao/rollback/${n}_rollback.sql`), n);
    const ap = ler(`supabase/producao/aplicar-${n}.sql`);
    assert.match(ap, /^begin;$/m);
    assert.match(ap, /^commit;$/m);
    assert.match(ap, new RegExp(`'2026110100${n}', '${n}_`));
  }
  const massa = ler("supabase/migrations/0276_qa_massa_resumo_semanal.sql");
  assert.match(massa, /and is_teste;/);
  assert.doesNotMatch(massa, /VN-CT-D5D50247|AUTOMACOES_ATIVO\s*=/);
  assert.doesNotMatch(massa, /update public\.properties/);
  const rb = ler("supabase/producao/rollback/0276_rollback.sql");
  assert.match(rb, /a0276c00-0000-4000-8000-000000000001/);
  assert.match(rb, /title like '\[TESTE QA\] Resumo semanal 0276 %'/);
});
