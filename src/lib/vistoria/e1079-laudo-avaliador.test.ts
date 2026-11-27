/*
  E1079 (ORDEM-DUET-385/397), fatia 5 — o laudo do avaliador pelo mockup aprovado (avaliador-laudo): "Laudo da
  avaliação", "Escolha o nível do imóvel", os três níveis em cartões de escolha, o resumo (fotos e checklist) e
  "Assinar laudo".
  ORDEM-DUET-397, ponto 1 (E1083, já na main): quem define o nível é o AVALIADOR, no laudo que assina. Esta fatia só
  muda o DESENHO do seletor: o campo continua "nivel", obrigatório, com os mesmos três valores.
  Roda: node --test src/lib/vistoria/e1079-laudo-avaliador.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NIVEIS } from "../../config/niveis.ts";
import { DESCRICAO_NIVEL_LAUDO, ROTULO_ASSINAR_LAUDO, SUBTITULO_LAUDO, TITULO_LAUDO, linhaChecklist, linhaFotos } from "./laudo-avaliador.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("os textos do desenho: título, subtítulo, a frase de cada nível e o botão", () => {
  assert.equal(TITULO_LAUDO, "Laudo da avaliação");
  assert.equal(SUBTITULO_LAUDO, "Escolha o nível do imóvel");
  assert.deepEqual(DESCRICAO_NIVEL_LAUDO, { essencial: "Simples e funcional", conforto: "Bem equipado e acolhedor", premium: "Acabamento superior" });
  assert.deepEqual(Object.keys(DESCRICAO_NIVEL_LAUDO), [...NIVEIS], "os mesmos três níveis, na ordem da casa");
  assert.equal(ROTULO_ASSINAR_LAUDO, "Assinar laudo");
});

test("resumo: as fotos enviadas e o estado do checklist vêm do sistema e nunca dizem 'completo' sem estar", () => {
  assert.deepEqual(linhaFotos(12), { ok: true, texto: "12 fotos enviadas" });
  assert.deepEqual(linhaFotos(1), { ok: true, texto: "1 foto enviada" });
  assert.deepEqual(linhaFotos(0), { ok: false, texto: "Nenhuma foto enviada" });
  assert.deepEqual(linhaChecklist(0), { ok: true, texto: "Checklist completo" });
  assert.deepEqual(linhaChecklist(1), { ok: false, texto: "Checklist incompleto: falta 1 item" });
  assert.deepEqual(linhaChecklist(4), { ok: false, texto: "Checklist incompleto: faltam 4 itens" });
});

test("o seletor de nível vira cartões de escolha e continua o campo 'nivel', obrigatório, nos dois formulários assinados", () => {
  const p = ler("app/(dashboard)/dashboard/parceiro/avaliacao/[pedido]/page.tsx");
  assert.equal((p.match(/<SeletorNivelLaudo /g) ?? []).length, 2, "enviar o laudo e confirmar a reverificação");
  assert.match(p, /type="radio" name="nivel" value=\{n\} defaultChecked=\{inicial === n\} required=\{obrigatorio\}/);
  assert.match(p, /data-testid=\{`laudo-nivel-\$\{n\}`\}/);
  assert.match(p, /\{DESCRICAO_NIVEL_LAUDO\[n\]\}/);
  assert.doesNotMatch(p, /<select name="nivel"/, "o seletor em lista saiu");
  // A plataforma continua sem calcular o nível: nada é pré-marcado na primeira emissão.
  assert.match(p, /<SeletorNivelLaudo obrigatorio \/>/);
});

test("a etapa do laudo: título e subtítulo do desenho, resumo com o que o sistema tem e 'Assinar laudo'", () => {
  const p = ler("app/(dashboard)/dashboard/parceiro/avaliacao/[pedido]/page.tsx");
  assert.match(p, /naEtapaDoLaudo \? TITULO_LAUDO : "Checklist da avaliação"/);
  assert.match(p, /linhaFotos\(fotosLista\.length\)/);
  assert.match(p, /linhaChecklist\(itensSemResposta\(respostasSalvas\)\.length\)/);
  assert.match(p, /\{ROTULO_ASSINAR_LAUDO\}/);
  // A declaração assinada (E648/E691) continua no formulário, antes do botão.
  assert.ok(p.indexOf('data-testid="assino-laudo"') < p.indexOf("{ROTULO_ASSINAR_LAUDO}"));
  assert.match(p, /name="assino" required/);
  // Na etapa do laudo o bloco de assinar vem ANTES do checklist; durante a visita, depois (o mesmo bloco, um só).
  assert.ok(p.indexOf("{naEtapaDoLaudo && fecho}") < p.indexOf("<ChecklistAvaliador"));
  assert.ok(p.indexOf("{!naEtapaDoLaudo && fecho}") > p.indexOf("<ChecklistAvaliador"));
});

test("os estilos do desenho ficam no arquivo de exceção que já existe", () => {
  const p = ler("app/(dashboard)/dashboard/parceiro/avaliacao/[pedido]/page.tsx");
  assert.match(ler("lib/conta/visual-mockup.ts"), /Laudo do avaliador \(E1079, fatia 5\)/);
  assert.match(p, /from "@\/lib\/conta\/visual-mockup"/);
  assert.doesNotMatch(p, /bg-\[#|text-\[#|shadow-\[|border-\[#/);
});
