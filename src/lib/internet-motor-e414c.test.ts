/*
  E414 (3ª reprova, prova ao vivo de 06/11): tentativa 1 falhou após ~100 s com "A medição demorou demais e parou"; tentativa 2
  falhou em < 60 s com "A medição não terminou". DIAGNÓSTICO com a biblioteca real (@cloudflare/speedtest 1.14.2 no Chromium,
  servidor local imitando /__down e /__up com velocidade controlada):
   - servidor normal, 300 / 50 / 8 Mbps: a rodada conclui em 9 / 26 / 28 s (as fases atuais servem);
   - pedido PARADO (upload sem resposta): a biblioteca NUNCA termina nem dá erro (bandwidthAbortRequestDuration = 0); só o
     nosso prazo de 60 s corta → "demorou demais" (com 40 s da 1ª rodada + 60 s = os ~100 s da QA);
   - conexão cai no meio / 429 / 500: a biblioteca chama onError em < 1 s … 15 s com a mensagem própria ("Connection
     failed to …", "Gave up after 3 retries", "Request failed with 500") → a tela descartava o texto e dizia "não terminou".
  São DOIS caminhos reais (travou × erro de rede). Correção: (1) a biblioteca aborta o pedido parado em 30 s, dizendo qual
  sentido; (2) cada erro da biblioteca vira um motivo com mensagem e código próprios; (3) o que já foi medido (latência +
  download + upload) vale mesmo se o erro vier depois; (4) o motivo vai para o registro do servidor, para a próxima prova ter
  evidência em vez de suposição.
  Roda: node --test src/lib/internet-motor-e414c.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CONFIG_MOTOR, FalhaMedicao, HOST_SERVIDOR_TESTE, classificarErroDaBiblioteca, motivoDaFalha, resumoCompleto, mensagemDaFalha } from "./internet-motor.ts";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("a biblioteca aborta o pedido parado (sem isso ela espera para sempre) em até 30 s", () => {
  const c = CONFIG_MOTOR as unknown as Record<string, unknown>;
  assert.equal(c.bandwidthAbortRequestDuration, 30_000);
});

test("cada erro real da biblioteca vira um motivo com o sentido (download/envio) quando houver", () => {
  const c = classificarErroDaBiblioteca;
  assert.deepEqual(c("Upload measurement of 1000000 bytes aborted. Measurement exceeded bandwidthAbortRequestDuration (30000ms)"), { motivo: "travou", fase: "envio" });
  assert.deepEqual(c("Download measurement of 25000000 bytes aborted. Measurement exceeded bandwidthAbortRequestDuration (30000ms)"), { motivo: "travou", fase: "download" });
  assert.deepEqual(c("Connection failed to https://speed.cloudflare.com/__down?during=idle&bytes=0. Gave up after 3 retries."), { motivo: "limite", fase: "latencia" });
  assert.deepEqual(c("Request failed with 500: https://speed.cloudflare.com/__up?bytes=100000"), { motivo: "servidor", fase: "envio", status: 500 });
  assert.deepEqual(c("Connection failed to https://speed.cloudflare.com/__down?bytes=1000000."), { motivo: "conexao", fase: "download" });
  assert.deepEqual(c("qualquer outra coisa"), { motivo: "rede", fase: "desconhecida" });
  assert.deepEqual(c(undefined), { motivo: "rede", fase: "desconhecida" });
});

test("a falha carrega o motivo e o motivoDaFalha a lê; os motivos antigos seguem iguais", () => {
  const f = new FalhaMedicao("conexao", "download", 812);
  assert.equal(motivoDaFalha(f), "conexao");
  assert.equal(motivoDaFalha(new Error("demorou")), "demorou");
  assert.equal(motivoDaFalha(new Error("incompleto")), "incompleto");
  assert.equal(motivoDaFalha("x"), "rede");
});

test("cada motivo tem frase própria e um código curto para a QA citar; só 'rede' sem motivo usa a frase genérica", () => {
  const frases = new Set<string>();
  for (const [m, fase] of [["demorou", "geral"], ["incompleto", "geral"], ["travou", "envio"], ["travou", "download"], ["limite", "latencia"], ["servidor", "envio"], ["conexao", "download"], ["rede", "desconhecida"]] as const) {
    const t = mensagemDaFalha(new FalhaMedicao(m, fase, 1, m === "servidor" ? 500 : undefined));
    assert.match(t, /Código: E414-[a-z-]+/);
    frases.add(t.split(" Código")[0]);
  }
  assert.equal(frases.size, 8, "nenhuma frase repetida");
  assert.match(mensagemDaFalha(new FalhaMedicao("travou", "envio", 1)), /envio/);
  assert.match(mensagemDaFalha(new FalhaMedicao("servidor", "envio", 1, 500)), /500/);
  assert.match(mensagemDaFalha(new FalhaMedicao("limite", "latencia", 1)), /esper/);
});

test("o que já foi medido vale: só com latência, download e upload presentes e positivos", () => {
  assert.deepEqual(resumoCompleto({ download: 50e6, upload: 10e6, latency: 20 }), { downloadMbps: 50, uploadMbps: 10, latenciaMs: 20 });
  assert.equal(resumoCompleto({ download: 50e6, latency: 20 }), null, "sem upload não vale");
  assert.equal(resumoCompleto({ download: 0, upload: 1e6, latency: 20 }), null);
  assert.equal(resumoCompleto(undefined), null);
});

test("o motor usa tudo isso: erro com resumo completo vale, erro sem resumo vira motivo; o motivo vai para o servidor", () => {
  const motor = ler("./internet-motor.ts");
  assert.match(motor, /m\.onError = \(msg: string\) => \{[\s\S]*resumoCompleto\(m\.results\.getSummary\(\)\)[\s\S]*classificarErroDaBiblioteca\(msg\)/);
  assert.match(motor, /new FalhaMedicao\(/);
  const tela = ler("../components/anuncio/medir-internet.tsx");
  assert.match(tela, /mensagemDaFalha\(falha\)/);
  assert.match(tela, /fetch\("\/api\/internet\/falhas"/);
  const rota = ler("../app/api/internet/falhas/route.ts");
  assert.match(rota, /origin !== new URL\(request\.url\)\.origin/);
  assert.match(rota, /console\.warn\("\[internet-falha\]"/);
  assert.doesNotMatch(rota, /headers\.get\("(x-forwarded-for|x-real-ip|user-agent|cookie)"\)/i, "nenhum dado pessoal no registro");
});

test("E414 (4ª reprova, 06/11): falha de conexão com o servidor de teste diz QUAL é o servidor e o caminho — o teste não passa pelo site da Viva", () => {
  const t = mensagemDaFalha(new FalhaMedicao("conexao", "latencia", 1545));
  assert.match(t, /speed\.cloudflare\.com/);
  assert.match(t, /teste de resposta/);
  assert.match(t, /direto|não passa pelo site da Viva/i);
  assert.match(t, /libere|outra rede/i);
  assert.match(t, /Código: E414-conexao-latencia\./);
  assert.equal(HOST_SERVIDOR_TESTE, "speed.cloudflare.com");
  // As outras frases não citam o host (só a falha de conexão/bloqueio).
  for (const m of ["demorou", "incompleto", "limite", "rede"] as const) assert.doesNotMatch(mensagemDaFalha(new FalhaMedicao(m, "geral", 1)), /speed\.cloudflare/);
});

test("E414: o host vem da biblioteca e do que a QA vê — o motor aponta para o mesmo servidor que a mensagem cita", () => {
  const motor = ler("./internet-motor.ts");
  assert.match(motor, /export const HOST_SERVIDOR_TESTE = "speed\.cloudflare\.com";/);
});
