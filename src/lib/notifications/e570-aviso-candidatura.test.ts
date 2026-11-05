/*
  E570: o aviso de candidatura no sino nomeia o morador (regra de máscara: "Candidato(a)" até o aceite) e o imóvel, e o
  clique cai no cartão daquela candidatura. Roda: node --test src/lib/notifications/e570-aviso-candidatura.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CANDIDATO_MASCARADO, tituloAvisoCandidatura } from "./avisos.ts";

const ler = (p: string) => readFileSync(p, "utf8");

test("título nomeia o morador mascarado e o imóvel; sem imóvel, 'o seu imóvel'", () => {
  assert.equal(CANDIDATO_MASCARADO, "Candidato(a)");
  assert.equal(tituloAvisoCandidatura({ imovel: "Casa mobiliada 2 quartos no Centro" }), "Nova candidatura de Candidato(a) para Casa mobiliada 2 quartos no Centro");
  assert.equal(tituloAvisoCandidatura({ imovel: "" }), "Nova candidatura de Candidato(a) para o seu imóvel");
  assert.equal(tituloAvisoCandidatura({ candidato: "Ana Lima", imovel: "Studio" }), "Nova candidatura de Ana Lima para Studio");
  assert.doesNotMatch(tituloAvisoCandidatura({ imovel: "Studio <b>x</b>" }), /[<>]/);
  assert.ok(tituloAvisoCandidatura({ imovel: "x".repeat(400) }).length <= 160);
});

test("a candidatura grava o aviso com o título nomeado, a candidatura como refId e o link do cartão dela", () => {
  const a = ler("src/lib/data/actions.ts");
  assert.match(a, /tituloAviso: tituloAvisoCandidatura\(\{ candidato: CANDIDATO_MASCARADO, imovel: propertyTitle \}\), refId: leadId/);
  assert.match(a, /pushUrl: kind === "candidatura" && leadId \? linkCandidaturaDono\(leadId\) : "\/dashboard\/leads",/);
  assert.match(ler("src/lib/notifications/index.ts"), /titulo: params\.tituloAviso \?\? mensagem\?\.titulo, texto: mensagem\?\.texto, imovelId: params\.imovelId \}/);
  // O título específico passa pelo filtro de contato antes de ir ao banco.
  assert.match(ler("src/lib/notifications/avisos-servidor.ts"), /let titulo = p\.titulo \? tituloDoAviso\(guardContactInfo\(p\.titulo\)\.text\) : tituloDoAviso\(base\.subject\);/);
});
