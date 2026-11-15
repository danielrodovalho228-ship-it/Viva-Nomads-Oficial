/*
  E947 (prompt "E-empresas-ajuda" do coordenador) — a Central de Ajuda responde "Minha empresa pode alugar moradia para
  funcionários?", com link para /empresas. Fonte única: a frase da taxa e a do recibo saem de lib/empresas/textos (a
  página /empresas importa as MESMAS constantes) e o prazo do "Fale com a gente" é TEXTO_PRAZO_EMPRESAS. A remissão de
  "Como posso virar parceiro" aponta para a pergunta nova; /como-funciona ganha uma linha para /empresas.
  Roda: node --test src/lib/atendimento/e947-empresas-ajuda.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FAQ, buscarFaq } from "./faq.ts";
import { HREF_PERGUNTA_EMPRESAS, ID_PERGUNTA_EMPRESAS, PERGUNTA_EMPRESAS, RECIBO_EMPRESAS, TAXA_EMPRESAS } from "../empresas/textos.ts";
import { TEXTO_PRAZO_EMPRESAS } from "../../config/prazos-canais.ts";
import { perguntasDoTema } from "../ajuda/temas.ts";

const ler = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const artigo = FAQ.find((p) => p.id === ID_PERGUNTA_EMPRESAS);

test("E947: a pergunta existe, no tema de quem procura moradia, com o link /empresas", () => {
  assert.ok(artigo);
  assert.equal(artigo.pergunta, "Minha empresa pode alugar moradia para funcionários?");
  assert.equal(artigo.pergunta, PERGUNTA_EMPRESAS);
  assert.deepEqual(artigo.links, [{ rotulo: "Moradia para empresas", href: "/empresas" }]);
  assert.ok(perguntasDoTema("morador").includes(ID_PERGUNTA_EMPRESAS));
  for (const t of ["empresa", "funcionario", "colaborador", "rh", "equipe", "corporativo", "reembolso", "recibo"]) assert.ok(artigo.termos.includes(t), t);
});

test("E947: a resposta traz TEXTO_PRAZO_EMPRESAS e as frases comuns da taxa e do recibo, exatamente", () => {
  assert.ok(artigo!.resposta.includes(TEXTO_PRAZO_EMPRESAS));
  assert.ok(artigo!.resposta.includes(TAXA_EMPRESAS));
  assert.ok(artigo!.resposta.includes(RECIBO_EMPRESAS));
  assert.match(artigo!.resposta, /30 a 180 dias/);
  assert.match(artigo!.resposta, /RH/);
  assert.match(artigo!.resposta, /contrato é digital/);
});

test("E947: /empresas e a Ajuda importam as mesmas constantes (nada escrito à mão)", () => {
  const pg = ler("../../app/(public)/empresas/page.tsx");
  assert.match(pg, /import \{ RECIBO_EMPRESAS, TAXA_EMPRESAS \} from "@\/lib\/empresas\/textos"/);
  assert.doesNotMatch(pg, /const TAXA_EMPRESAS =/);
  assert.ok(!pg.includes(TAXA_EMPRESAS) && !pg.includes(RECIBO_EMPRESAS), "a página não repete as frases à mão");
  const faq = ler("./faq.ts");
  assert.match(faq, /from "\.\.\/empresas\/textos\.ts"/);
  assert.ok(!faq.includes(TAXA_EMPRESAS) && !faq.includes(RECIBO_EMPRESAS));
});

test("E947: a busca da Ajuda por 'funcionário', 'RH' e 'empresa' encontra a pergunta", () => {
  for (const q of ["funcionário", "RH", "empresa"]) assert.ok(buscarFaq(q).some((p) => p.id === ID_PERGUNTA_EMPRESAS), q);
});

test("E947: 'Como posso virar parceiro' remete à pergunta nova; /como-funciona tem a linha para /empresas", () => {
  const p = FAQ.find((x) => x.id === "como-virar-parceiro")!;
  assert.ok(p.resposta.includes(`veja a pergunta “${PERGUNTA_EMPRESAS}”`));
  assert.deepEqual(p.links, [{ rotulo: PERGUNTA_EMPRESAS, href: HREF_PERGUNTA_EMPRESAS }]);
  assert.match(ler("../../components/ajuda/central-ajuda.tsx"), /get\("pergunta"\)[\s\S]*?setAberta\(alvo\)/);
  assert.match(ler("../../app/(public)/como-funciona/page.tsx"), /data-testid="cf-empresas"[\s\S]*?href="\/empresas"/);
});
