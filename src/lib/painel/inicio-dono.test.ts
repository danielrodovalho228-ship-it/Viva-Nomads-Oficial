/*
  PROP-3 (E113): os números do Início do dono vêm da MESMA função das páginas de destino. Auditoria (proprietario1):
  Visualizações 0 no Início × 2 no Desempenho; Mensagens 0 × 1 conversa; prévia com 2 de 3 ativos; "Buscas salvas"
  (de morador) no Início do dono. Roda: node --experimental-strip-types --test src/lib/painel/inicio-dono.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { contar, janelas, type Evento } from "../anuncio/desempenho.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("Visualizações do Início = a mesma conta do Desempenho (contar), somada nos imóveis do dono", () => {
  const agora = new Date("2026-10-24T12:00:00Z");
  const j = janelas(agora);
  const ev = (usuario_id: string | null, dias: number): Evento => ({ tipo: "ver_anuncio", criado_em: new Date(agora.getTime() - dias * 86_400_000).toISOString(), usuario_id });
  // 2 visitas reais no período, 1 do próprio dono e 1 antiga: o Desempenho mostra 2; o Início tem de mostrar 2.
  const eventos = [ev(null, 1), ev("visitante", 3), ev("dono", 2), ev("visitante", 40)];
  assert.equal(contar(eventos, j.atual, { donoId: "dono", contasTeste: new Set() }).visualizacoes, 2);
  const servidor = ler("lib/data/desempenho-anuncio.ts");
  const corpo = servidor.slice(servidor.indexOf("export async function visualizacoesDoDono"));
  assert.match(corpo, /contar\(eventos, j\.atual, fora\)\.visualizacoes/);
  assert.match(corpo, /contasDeTeste\(admin/);
});

test("Início do dono: sem números fixos, prévia com todos os ativos, Mensagens = lista de /dashboard/mensagens, sem Buscas salvas", () => {
  const vg = ler("app/(dashboard)/dashboard/visao-geral-client.tsx");
  const pagina = ler("app/(dashboard)/dashboard/page.tsx");
  assert.doesNotMatch(vg, /label="Visualizações"\s*value=\{demo \? [^:]+: "0"\}/, "Visualizações não é mais '0' fixo");
  assert.doesNotMatch(vg, /label="Mensagens" value=\{demo \? String\(DEMO_KPIS\.mensagens\) : "0"\}/);
  assert.doesNotMatch(vg, /allProperties\.slice\(0, 2\)/, "a prévia não corta em 2");
  assert.match(vg, /\{!ehDono && <StatCard label="Buscas salvas"/);
  assert.match(pagina, /visualizacoesDoDono\(agora\)/);
  assert.match(pagina, /listConversations\(\)/);
  assert.match(pagina, /totalConversas=\{conversas\.length\}/);
});
