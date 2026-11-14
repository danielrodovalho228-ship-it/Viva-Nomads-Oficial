/*
  E906: as remissões internas das respostas da Ajuda e dos guias eram texto simples ("em /parceiros/buscar", "em /empresas"…)
  sem link. Agora viram links clicáveis para os destinos vivos: /parceiros/buscar, /parceiros/fotografos, /empresas,
  /parceiros, /auth, /seguranca. A remissão a /precos NÃO vira link (página suspensa) e sai do artigo "Quanto custa
  anunciar?" junto com o E836. Roda: node --test src/lib/ajuda/e906-remissoes-links.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DESTINOS_REMISSAO, pedacosComRemissoes } from "./remissoes.ts";
import { FAQ, respostaPara } from "../atendimento/faq.ts";
import { GUIAS } from "../guias/guias.ts";

const links = (t: string) => pedacosComRemissoes(t).filter((p) => p.href).map((p) => p.href);

test("E906: os destinos vivos viram link; o texto inteiro se mantém", () => {
  assert.deepEqual([...DESTINOS_REMISSAO].sort(), ["/auth", "/empresas", "/parceiros", "/parceiros/buscar", "/parceiros/fotografos", "/seguranca"]);
  const t = "A busca é em /parceiros/buscar (categoria); fotógrafos em /parceiros/fotografos. Empresas: /empresas. Peça em /parceiros. Crie a conta em /auth. Leia /seguranca.";
  assert.deepEqual(links(t), ["/parceiros/buscar", "/parceiros/fotografos", "/empresas", "/parceiros", "/auth", "/seguranca"]);
  assert.equal(pedacosComRemissoes(t).map((p) => p.texto).join(""), t);
});

test("E906: /precos e caminhos que não são destinos da lista ficam como texto", () => {
  assert.deepEqual(links("A tabela completa está em /precos."), []);
  assert.deepEqual(links("Veja /parceiros/avaliadores e /parceirosX."), []);
  assert.deepEqual(links("Sem remissão nenhuma."), []);
});

test("E906: todas as respostas da Ajuda e os guias com remissão a destino vivo ganham link", () => {
  const ids = (id: string) => FAQ.find((p) => p.id === id)!;
  assert.deepEqual(links(respostaPara(ids("contratar-fotografo"), "visitante")), ["/parceiros/buscar", "/parceiros/fotografos"]);
  assert.deepEqual(links(respostaPara(ids("como-virar-parceiro"), "visitante")).sort(), ["/auth", "/empresas", "/empresas", "/parceiros", "/parceiros"].sort());
  const guiaSeguranca = GUIAS.flatMap((g) => g.secoes.flatMap((s) => s.paragrafos)).filter((p) => p.includes("/seguranca"));
  assert.ok(guiaSeguranca.length > 0);
  for (const p of guiaSeguranca) assert.ok(links(p).includes("/seguranca"), p);
});

test("E906 + E836: o artigo 'Quanto custa anunciar?' não remete mais a /precos", () => {
  const p = FAQ.find((x) => x.id === "custo-anunciar")!;
  assert.equal(p.pergunta.includes("Quanto custa anunciar"), true);
  for (const perfil of ["visitante", "sem_contrato", "com_contrato"] as const) assert.doesNotMatch(respostaPara(p, perfil), /\/precos/);
});

test("E906: a Central de Ajuda e a página do guia desenham o texto com as remissões ligadas", () => {
  const central = readFileSync(new URL("../../components/ajuda/central-ajuda.tsx", import.meta.url), "utf8");
  assert.match(central, /<TextoComRemissoes texto=\{respostaPara\(p, perfil\)\} \/>/);
  const guia = readFileSync(new URL("../../app/(public)/guias/[slug]/page.tsx", import.meta.url), "utf8");
  assert.match(guia, /<TextoComRemissoes texto=\{p\} \/>/);
});
