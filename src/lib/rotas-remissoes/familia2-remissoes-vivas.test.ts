import { test } from "node:test";
import assert from "node:assert/strict";
import { GUIAS, textoDoGuia } from "../guias/guias.ts";
import { FAQ } from "../atendimento/faq.ts";
import * as PARCEIROS_TEXTO from "../atendimento/parceiros-texto.ts";
import { fontes, SYSTEM_VIVA } from "../atendimento/viva-prompt.ts";
import { TEMAS_AJUDA } from "../ajuda/temas.ts";
import { caminhosNoTexto, rotaViva } from "./rotas-vivas.ts";

/*
  Família 2 (varredura): nenhuma remissão interna do CONTEÚDO (guias, Central de Ajuda, textos de parceiros e o que a
  Viva responde) aponta para rota morta ou suspensa. A lista de rotas vivas sai do próprio app (src/app/<rota>/page.tsx).
*/
const temas = TEMAS_AJUDA.map((t) => t.id);
const textos: [string, string][] = [
  ...GUIAS.map((g) => [`guia ${g.slug}`, textoDoGuia(g)] as [string, string]),
  ...FAQ.flatMap((p) => [[`FAQ ${p.id}`, p.resposta], ...Object.entries(p.porPerfil ?? {}).map(([k, v]) => [`FAQ ${p.id}/${k}`, v as string]), ...(p.links ?? []).map((l) => [`FAQ ${p.id} link`, l.href])] as [string, string][]),
  ...Object.entries(PARCEIROS_TEXTO).filter(([, v]) => typeof v === "string").map(([k, v]) => [`parceiros-texto ${k}`, v as string] as [string, string]),
  ["Viva: fontes()", fontes()],
  ["Viva: SYSTEM_VIVA", Array.isArray(SYSTEM_VIVA) ? SYSTEM_VIVA.join("\n") : String(SYSTEM_VIVA)],
];

test("toda remissão interna do conteúdo aponta para uma rota viva (nem 404, nem suspensa)", () => {
  const mortas: string[] = [];
  for (const [onde, t] of textos) for (const c of caminhosNoTexto(t)) if (!rotaViva(c, temas)) mortas.push(`${onde}: ${c}`);
  assert.deepEqual(mortas, []);
});

test("o verificador reconhece as rotas: vivas, suspensas e de tema inexistente", () => {
  assert.equal(rotaViva("/empresas", temas), true);
  assert.equal(rotaViva("/imoveis/ube-001", temas), true);
  assert.equal(rotaViva("/ajuda/seguranca", temas), true);
  assert.equal(rotaViva("/precos", temas), false);
  assert.equal(rotaViva("/ajuda/para-empresas", temas), false, "tema que não existe");
  assert.equal(rotaViva("/rota-que-nao-existe", temas), false);
});
