/*
  E326 (desenho do Muse) — o lembrete de VÉSPERA da visita confirmada (vídeo e presencial):
   • nunca leva o link cru da chamada (segurança: o link vive na plataforma e some depois do uso — revisão do #1786);
   • o botão leva à página AUTENTICADA da visita (/dashboard/visitas): "Entrar na chamada" no vídeo, "Ver a visita" na
     presencial (lá estão o endereço, o mapa e o estado);
   • respeita a régua dos proativos: nada sai entre 22h e 7h (Brasília); a chave de envio (uma por pessoa, visita e
     horário) só é gravada quando sai, então o disparo diário pega a visita depois.
  Roda: node --test src/lib/visitas/e326-vespera-sem-link.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { vesperaTexto } from "../notifications/emails-e205b.ts";
import { emSilencio } from "../notifications/silencio.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("vídeo e presencial: botão para a página autenticada da visita, nunca um link externo", () => {
  const video = vesperaTexto({ modalidade: "video", paraMorador: true, horario: "qui., 05/11 às 10:00", imovel: "Apto Santa Mônica", quando: "amanhã" });
  assert.equal(video.cta, "Entrar na chamada");
  assert.equal(video.url, "/dashboard/visitas");
  assert.doesNotMatch(video.abertura("Lara"), /https?:\/\//);
  const presencial = vesperaTexto({ modalidade: "presencial", paraMorador: true, horario: "x", endereco: { texto: "Rua A, 10", mapa: "https://maps.example/?q=1" }, quando: "hoje" });
  assert.equal(presencial.cta, "Ver a visita");
  assert.equal(presencial.url, "/dashboard/visitas");
  assert.ok(presencial.linhas.some((l) => l.rotulo === "Endereço"));
  for (const t of [video, presencial]) assert.ok(t.linhas.every((l) => !/meet\.|zoom\.|https?:\/\//.test(l.valor)), "nenhum link nas linhas");
});

test("o servidor da véspera não lê o link da chamada, não monta botão externo e respeita o silêncio", () => {
  const src = ler("src/lib/visitas/avisos-servidor.ts");
  assert.doesNotMatch(src, /link_chamada/);
  const fn = src.slice(src.indexOf("async function enviarVespera"), src.indexOf("/** Cron: a véspera de todas"));
  assert.match(fn, /if \(emSilencio\(agora\)\) return 0;/);
  assert.match(fn, /detalhes\(\{ linhas: t\.linhas, externo: null \}\)/);
  assert.match(fn, /ctaLabel: t\.cta,/);
  // A chave (um por pessoa, visita e horário) é gravada depois do silêncio: o disparo diário ainda pega a visita.
  assert.ok(fn.indexOf("emSilencio(agora)") < fn.indexOf("automacoes_envios"));
  // O disparo diário roda às 10h de Brasília (13:00 UTC), fora do silêncio.
  assert.match(ler("vercel.json"), /"path": "\/api\/cron\/automacoes", "schedule": "0 13 \* \* \*"/);
  assert.equal(emSilencio(new Date("2026-11-01T13:00:00Z")), false);
  assert.equal(emSilencio(new Date("2026-11-02T02:00:00Z")), true);
});
