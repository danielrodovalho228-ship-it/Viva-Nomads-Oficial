/*
  Segurança do hóspede (ordem f92bc582, item 4): "Encontrei câmera/dispositivo de gravação"
  é P1 (avisa o Daniel na hora), vai para a fila antifraude e tem orientação fixa.
  Roda: node --test src/lib/atendimento/camera-escondida.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { CATEGORIAS, categoria, classificar, detectarRiscoP1, ORIENTACAO_CAMERA } from "./classificar.ts";
import { filaDaCategoria } from "./filas.ts";
import { ehSensivel } from "./acolhimento.ts";
import { rotear } from "./viva-regras.ts";

test("categoria 'camera' existe no formulário, é P1 e de segurança", () => {
  const c = categoria("camera");
  assert.ok(c);
  assert.equal(c.prioridade, "p1");
  assert.equal(c.tipo, "seguranca");
  assert.ok(!c.interna && !c.exigeContrato);
  assert.ok(CATEGORIAS.some((x) => x.key === "camera" && /câmera/i.test(x.rotulo)));
});

test("classificar: categoria camera fica P1 mesmo com texto neutro", () => {
  assert.equal(classificar("camera", "achei um aparelho estranho").prioridade, "p1");
});

test("texto sobre câmera escondida sobe para P1 em qualquer categoria", () => {
  for (const t of [
    "Encontrei uma câmera escondida no quarto",
    "tem uma camera no detector de fumaça",
    "achei um microfone escondido na sala",
    "estou sendo filmado dentro do imóvel",
    "dispositivo de gravação no relógio",
  ]) assert.equal(detectarRiscoP1(t), true, t);
  assert.equal(detectarRiscoP1("a câmera do meu celular não funciona"), false);
  assert.equal(detectarRiscoP1("o imóvel tem câmera na portaria do prédio"), false);
});

test("fila antifraude, categoria sensível e rota P1", () => {
  assert.equal(filaDaCategoria("camera"), "antifraude");
  assert.equal(ehSensivel("camera"), true);
  assert.equal(rotear("achei uma câmera escondida", { categoria: "camera" }).rota, "p1");
});

test("orientação: não mexer, fotografar, polícia opcional, sem prometer reembolso nem 'vistoria'", () => {
  assert.match(ORIENTACAO_CAMERA, /não mexa/i);
  assert.match(ORIENTACAO_CAMERA, /fotografe/i);
  assert.match(ORIENTACAO_CAMERA, /polícia/i);
  assert.match(ORIENTACAO_CAMERA, /sair do imóvel/i);
  assert.doesNotMatch(ORIENTACAO_CAMERA, /reembols|vistoria/i);
});

test("chat da Viva: câmera escondida recebe a orientação fixa, sem IA, e sugere pessoa", async () => {
  const { responderChatViva } = await import("./viva-chat.ts");
  const deps = { gerar: async () => { throw new Error("IA não deve ser chamada"); } } as unknown as Parameters<typeof responderChatViva>[0];
  const r = await responderChatViva(deps, { mensagens: [{ role: "user", content: "Achei uma câmera escondida no quarto" }] });
  assert.equal(r.status, 200);
  assert.equal(r.body.prioridade, "p1");
  assert.equal(r.body.sugerePessoa, true);
  assert.match(r.body.resposta, /Não mexa no aparelho/);
});
