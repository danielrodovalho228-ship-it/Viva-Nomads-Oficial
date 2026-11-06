/*
  E414 (reprovado de novo em 05/11): a medição travava após ~30–35 s com "A medição não terminou. Confira a conexão e tente de novo.".
  Não era o prazo de 60 s (esse tem a própria mensagem): era um erro da biblioteca. Causas tratadas aqui:
   1. a biblioteca descarta pedidos que duram menos de 10 ms (bandwidthMinRequestDuration). Com envio de no máximo 1 MB, numa
      conexão rápida o upload ficava VAZIO → "incompleto" → rodada perdida. A lista de fases agora deixa a biblioteca subir
      o tamanho sozinha (ela mesma encerra o sentido quando os pedidos passam de 1 s);
   2. uma rodada que terminou bem era jogada fora quando a seguinte falhava. Agora vale o que terminou, com aviso honesto;
   3. toda falha dizia a mesma frase. Agora cada motivo diz a sua.
  Roda: node --test src/lib/internet-motor-e414b.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CONFIG_MOTOR, motivoDaFalha } from "./internet-motor.ts";
import { aproveitarRodadas, type Rodada } from "./internet-medida.ts";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
type Fase = { type: string; bytes?: number; count?: number; numPackets?: number };
const fases = CONFIG_MOTOR.measurements as unknown as Fase[];
const tamanhos = (tipo: string) => fases.filter((f) => f.type === tipo).map((f) => f.bytes ?? 0);

test("o envio e o download sobem de tamanho (a biblioteca só mede pedidos de 10 ms ou mais): conexão rápida não fica sem upload", () => {
  assert.ok(Math.max(...tamanhos("upload")) >= 1e7, "upload chega a 10 MB");
  assert.ok(Math.max(...tamanhos("download")) >= 2.5e7, "download chega a 25 MB");
  for (const t of ["upload", "download"]) {
    const v = tamanhos(t);
    assert.deepEqual([...v].sort((a, b) => a - b), v, `${t}: tamanhos em ordem crescente (a biblioteca encerra o sentido quando os pedidos passam de 1 s)`);
  }
});

test("continua só latência, download e upload: sem perda de pacote nem alcance (outros hosts) e sem envio de resultado", () => {
  assert.deepEqual([...new Set(fases.map((f) => f.type))].sort(), ["download", "latency", "upload"]);
  assert.equal(CONFIG_MOTOR.logAimApiUrl, null);
  assert.equal(CONFIG_MOTOR.logMeasurementApiUrl, null);
  assert.equal(CONFIG_MOTOR.includeCredentials, false);
});

test("cada falha tem o seu motivo", () => {
  assert.equal(motivoDaFalha(new Error("demorou")), "demorou");
  assert.equal(motivoDaFalha(new Error("incompleto")), "incompleto");
  assert.equal(motivoDaFalha(new Error("cancelado")), "cancelado");
  assert.equal(motivoDaFalha(new Error("Failed to fetch")), "rede");
  assert.equal(motivoDaFalha("qualquer coisa"), "rede");
});

const r = (d: number): Rodada => ({ downloadMbps: d, uploadMbps: 40, latenciaMs: 12 });

test("rodada que terminou vale mesmo quando a seguinte falha — e o resultado diz que veio de uma rodada só", () => {
  assert.deepEqual(aproveitarRodadas([r(100), r(120)], 2), { rodadas: [r(100), r(120)], parcial: false });
  assert.deepEqual(aproveitarRodadas([r(100)], 2), { rodadas: [r(100)], parcial: true });
  assert.equal(aproveitarRodadas([], 2), null);
  assert.equal(aproveitarRodadas([{ downloadMbps: 100, uploadMbps: 0, latenciaMs: 12 }], 2), null, "rodada sem upload não vale");
});

test("a tela usa o motivo e o aproveitamento parcial, sem prometer o que não mediu", () => {
  const t = ler("../components/anuncio/medir-internet.tsx");
  assert.match(t, /motivoDaFalha\(falha\)/);
  assert.match(t, /aproveitarRodadas\(rodadas, INTERNET\.rodadas\)/);
  assert.match(t, /data-testid="medir-internet-parcial"/);
  assert.match(t, /Só uma das duas rodadas terminou/);
  assert.match(t, /não conseguiu medir o envio/);
  // a frase genérica continua, só para o que não tem motivo próprio
  assert.match(t, /A medição não terminou\. Confira a conexão e tente de novo\./);
});
