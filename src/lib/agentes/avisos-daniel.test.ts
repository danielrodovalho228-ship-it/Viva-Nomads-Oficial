/*
  Avisos do Moacir por e-mail (0094): dedupe, limite de 6/dia, resumo das 19h, variável ausente,
  link assinado e a migração. Roda: node --test src/lib/agentes/avisos-daniel.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  LIMITE_EMAILS_DIA,
  linkAssinadoAprovar,
  linkDecisao,
  linkValido,
  processarAvisos,
  REMETENTE_MOACIR,
  type Aviso,
  type Deps,
  type Mensagem,
} from "./avisos-daniel.ts";

const SEGREDO = "segredo-de-teste";
const aviso = (n: number, extra: Partial<Aviso> = {}): Aviso => ({
  id: `a${n}`,
  origem_ronda: `00000000-0000-4000-8000-00000000000${n % 10}`,
  assunto: `Assunto ${n}`,
  corpo: "Detalhe curto.",
  prioridade: "P2",
  link: null,
  ...extra,
});

function deps(
  avisos: Aviso[],
  o: { destino?: string | undefined; ja?: number; resumoFeito?: boolean; hora?: number; falha?: boolean } = {}
) {
  const enviadas: Mensagem[] = [];
  const marcados: Record<string, string> = {};
  const erros: { id: string; erro: string; contar: boolean }[] = [];
  // hora de Brasília → UTC (+3)
  const agora = new Date(Date.UTC(2026, 9, 8, (o.hora ?? 12) + 3, 0, 0));
  const d: Deps = {
    destino: () => ("destino" in o ? o.destino : "daniel@exemplo.test"),
    siteUrl: "https://vivanomads.com.br",
    segredo: SEGREDO,
    agora: () => agora,
    pendentes: async () => avisos,
    emailsHoje: async () => o.ja ?? 0,
    resumoHoje: async () => o.resumoFeito ?? false,
    reservar: async (id, via) => {
      if (id in marcados) return false;
      marcados[id] = via;
      return true;
    },
    falhou: async (id, erro, contar) => {
      erros.push({ id, erro, contar });
    },
    enviar: async (m) => {
      if (o.falha) return { ok: false, erro: "Resend 500" };
      enviadas.push(m);
      return { ok: true };
    },
  };
  return { d, enviadas, marcados, erros };
}

test("envia pelo remetente do Moacir, com reply-to moacir@ e sem inventar destino", async () => {
  const { d, enviadas } = deps([aviso(1)]);
  const r = await processarAvisos(d);
  assert.equal(r.enviados, 1);
  assert.equal(enviadas[0].from, REMETENTE_MOACIR);
  assert.equal(enviadas[0].replyTo, "moacir@vivanomads.com.br");
  assert.equal(enviadas[0].to, "daniel@exemplo.test");
  assert.match(enviadas[0].text, /O que aconteceu/);
  assert.match(enviadas[0].text, /O que precisa de você/);
});

test("sem AVISO_DANIEL_EMAIL: não envia, registra o erro e não gasta tentativa", async () => {
  const { d, enviadas, erros } = deps([aviso(1), aviso(2)], { destino: undefined });
  const r = await processarAvisos(d);
  assert.equal(enviadas.length, 0);
  assert.match(r.erro ?? "", /AVISO_DANIEL_EMAIL/);
  assert.equal(erros.length, 2);
  assert.ok(erros.every((e) => e.contar === false));
});

test("destino em branco conta como variável ausente (caso negativo)", async () => {
  const { d, enviadas } = deps([aviso(1)], { destino: "   " });
  const r = await processarAvisos(d);
  assert.equal(enviadas.length, 0);
  assert.ok(r.erro);
});

test("limite: no máximo 6 e-mails por dia; o 7º espera (antes das 19h)", async () => {
  const lista = Array.from({ length: 8 }, (_, i) => aviso(i + 1));
  const { d, enviadas } = deps(lista, { hora: 12 });
  const r = await processarAvisos(d);
  assert.equal(r.enviados, LIMITE_EMAILS_DIA);
  assert.equal(r.adiados, 2);
  assert.equal(r.resumidos, 0);
  assert.equal(enviadas.length, 6);
});

test("limite considera o que já saiu hoje", async () => {
  const { d, enviadas } = deps([aviso(1), aviso(2)], { ja: 5 });
  const r = await processarAvisos(d);
  assert.equal(enviadas.length, 1);
  assert.equal(r.adiados, 1);
});

test("P0 passa por cima do limite", async () => {
  const { d, enviadas } = deps([aviso(1, { prioridade: "P0" }), aviso(2)], { ja: 6 });
  const r = await processarAvisos(d);
  assert.equal(r.enviados, 1);
  assert.equal(enviadas[0].subject.includes("P0"), true);
  assert.equal(r.adiados, 1);
});

test("às 19h o que passou do limite vai num resumo só, uma vez por dia", async () => {
  const lista = Array.from({ length: 8 }, (_, i) => aviso(i + 1));
  const { d, enviadas, marcados } = deps(lista, { ja: 0, hora: 19 });
  const r = await processarAvisos(d);
  assert.equal(r.enviados, 6);
  assert.equal(r.resumidos, 2);
  assert.equal(enviadas.length, 7);
  assert.match(enviadas[6].subject, /Resumo do dia — 2 aviso/);
  assert.equal(marcados.a7, "resumo");

  const depois = deps(lista.slice(6), { ja: 6, hora: 20, resumoFeito: true });
  const r2 = await processarAvisos(depois.d);
  assert.equal(r2.resumidos, 0);
  assert.equal(depois.enviadas.length, 0);
  assert.equal(r2.adiados, 2);
});

test("duas execuções ao mesmo tempo não mandam o mesmo aviso duas vezes", async () => {
  const { d, enviadas } = deps([aviso(1)]);
  await processarAvisos(d);
  await processarAvisos(d); // reservar() devolve false na segunda
  assert.equal(enviadas.length, 1);
});

test("falha no envio devolve o aviso para a fila e soma uma tentativa", async () => {
  const { d, erros } = deps([aviso(1)], { falha: true });
  const r = await processarAvisos(d);
  assert.equal(r.enviados, 0);
  assert.deepEqual(erros, [{ id: "a1", erro: "Resend 500", contar: true }]);
});

test("texto do aviso não vira link clicável nem HTML (sem golpe pelo e-mail)", async () => {
  const { d, enviadas } = deps([aviso(1, { assunto: "<b>x</b> veja http://golpe.exemplo.com/a", origem_ronda: null })]);
  await processarAvisos(d);
  assert.doesNotMatch(enviadas[0].html, /<b>x/);
  assert.doesNotMatch(enviadas[0].html, /golpe\.exemplo/);
});

test("primeiro aviso (apresentação) leva o link e nenhum link assinado", async () => {
  const { d, enviadas } = deps([
    aviso(1, { origem_ronda: null, prioridade: "P3", assunto: "Apresentação da Viva Nomads (14 slides)", link: "https://claude.ai/artifact/VVqFDPcKhT9Xq3GvKMTewn" }),
  ]);
  await processarAvisos(d);
  assert.match(enviadas[0].html, /href="https:\/\/claude\.ai\/artifact\/VVqFDPcKhT9Xq3GvKMTewn"/);
  assert.doesNotMatch(enviadas[0].html, /aprovar/);
});

test("link do e-mail não dá 404: até a tela /aprovar existir, aponta para a Central", () => {
  const agora = new Date("2026-10-08T15:00:00Z");
  const url = new URL(linkDecisao("11111111-1111-4111-8111-111111111111", agora, "https://vivanomads.com.br", SEGREDO));
  assert.equal(url.pathname, "/admin/agentes");
  assert.equal(url.search, "");
});

test("e-mail de aviso de ronda sem link próprio leva o link da Central", async () => {
  const { d, enviadas } = deps([aviso(1)]);
  await processarAvisos(d);
  assert.match(enviadas[0].html, /href="https:\/\/vivanomads\.com\.br\/admin\/agentes"/);
  assert.doesNotMatch(enviadas[0].html, /aprovar/);
});

test("Daniel só recebe e-mail do Moacir: aviso de ronda de outro agente não sai", async () => {
  const { d, enviadas, erros, marcados } = deps([
    aviso(1, { origem_agente: "otavio" }),
    aviso(2, { origem_agente: "moacir" }),
    aviso(3, { origem_agente: null, origem_ronda: null, link: "https://claude.ai/artifact/abc" }),
  ]);
  const r = await processarAvisos(d);
  assert.equal(r.enviados, 2);
  assert.equal(enviadas.length, 2);
  assert.equal(enviadas.some((m) => m.subject.includes("Assunto 1")), false);
  assert.equal("a1" in marcados, false);
  assert.equal(erros.length, 1);
  assert.equal(erros[0].id, "a1");
  assert.equal(erros[0].contar, true);
});

test("link de decisão: só abre a tela, assinado, expira em 72 h, adulterado não vale", () => {
  const agora = new Date("2026-10-08T15:00:00Z");
  const ronda = "11111111-1111-4111-8111-111111111111";
  const url = new URL(linkAssinadoAprovar(ronda, agora, "https://vivanomads.com.br", SEGREDO));
  assert.equal(url.pathname, "/admin/agentes/aprovar");
  const e = Number(url.searchParams.get("e"));
  const s = url.searchParams.get("s") ?? "";
  assert.equal(e - Math.floor(agora.getTime() / 1000), 72 * 3600);
  assert.equal(linkValido(ronda, e, s, new Date(agora.getTime() + 71 * 3600_000), SEGREDO), true);
  assert.equal(linkValido(ronda, e, s, new Date(agora.getTime() + 73 * 3600_000), SEGREDO), false);
  assert.equal(linkValido("22222222-2222-4222-8222-222222222222", e, s, agora, SEGREDO), false);
  assert.equal(linkValido(ronda, e + 3600, s, agora, SEGREDO), false);
  assert.equal(linkValido(ronda, e, s, agora, "outro-segredo"), false);
  assert.equal(linkValido(ronda, e, "", agora, SEGREDO), false);
});

test("migração 0094: tabela só admin, trigger com dedupe de 24 h, apresentação como 1º aviso, registro e rollback", () => {
  const raiz = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
  const mig = raiz("supabase/migrations/0094_avisos_daniel.sql");
  const prod = raiz("supabase/producao/aplicar-0094.sql");
  for (const sql of [mig, prod]) {
    assert.match(sql, /enable row level security/);
    assert.match(sql, /revoke all on public\.avisos_daniel from public, anon, authenticated/);
    assert.match(sql, /using \(public\.is_admin\(\)\)|for select to authenticated using \(public\.is_admin\(\)\)/);
    assert.match(sql, /agente_slug <> 'moacir'/);
    assert.match(sql, /status <> 'alerta'/);
    assert.match(sql, /lower\(coalesce\(a->>'para', ''\)\) = 'daniel'/);
    assert.match(sql, /assunto = v_assunto and criado_em > now\(\) - interval '24 hours'/);
    assert.match(sql, /exception when others then/);
    assert.match(sql, /https:\/\/claude\.ai\/artifact\/VVqFDPcKhT9Xq3GvKMTewn/);
    assert.match(sql, /where not exists \(select 1 from public\.avisos_daniel where assunto = 'Apresentação/);
    // nenhum e-mail de destino no SQL (só o remetente e o autor do registro, que o padrão das migrações já traz)
    assert.doesNotMatch(sql.replace(/moacir@vivanomads\.com\.br/g, "").replace(/danielrodovalho228@gmail\.com/g, ""), /@[a-z]/);
    assert.doesNotMatch(sql, /^\s*drop\s/im);
  }
  assert.match(prod, /^begin;$/m);
  assert.match(prod, /^commit;$/m);
  assert.match(prod, /'0094_avisos_daniel'/);
  assert.match(raiz("supabase/producao/rollback/0094_rollback.sql"), /drop table if exists public\.avisos_daniel/);
});

test("rota do cron exige CRON_SECRET e a chave do e-mail só é lida da variável", () => {
  const raiz = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
  const rota = raiz("src/app/api/cron/avisos-daniel/route.ts");
  assert.match(rota, /CRON_SECRET não configurado/);
  assert.match(rota, /authorization"\) !== `Bearer \$\{segredo\}`/);
  assert.match(raiz("src/lib/agentes/avisos-daniel-servidor.ts"), /process\.env\.AVISO_DANIEL_EMAIL/);
  assert.match(raiz("vercel.json"), /"\/api\/cron\/avisos-daniel", "schedule": "0 22 \* \* \*"/);
});
