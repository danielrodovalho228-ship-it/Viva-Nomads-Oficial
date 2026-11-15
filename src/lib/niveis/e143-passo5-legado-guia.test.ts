/*
  E143 (Família 7, ORDEM-DUET-027) — o Passo 5 mandava o dono para a tela antiga "Nível, ruído e extras". Diretriz: tudo
  dentro do Passo 5 (ruído e extras com toggles — já na main, t477 caso 2); a página legada REDIRECIONA para o lugar do
  nível no anúncio; e o Passo 5 ganha o PDF guia da comprovação de nível. (O vídeo de instrução depende de um vídeo
  gravado que não existe no repositório — fica em "Dúvidas" do PR.)
  Roda: node --test src/lib/niveis/e143-passo5-legado-guia.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ANCORA_NIVEL_CADASTRO, destinoNivel, paginaNivelFica } from "./destino-nivel.ts";
import { HREF_GUIA_NIVEL, TITULO_GUIA_NIVEL, gerarGuiaNivelPdf, secoesGuiaNivel } from "./guia-comprovacao.ts";
import { TEXTO_ESSENCIAL_DECLARADO, TEXTO_SUBIR_NIVEL } from "./cadastro-passo5.ts";
import { AVISO_PROVA_NA_HORA } from "./prova-camera.ts";
import { ITENS_NIVEL, MATRIZ } from "../../config/niveis.ts";

const ler = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

test("E143: a página legada, aberta para um RASCUNHO fora da captura, redireciona ao Passo 5", () => {
  assert.equal(paginaNivelFica({ captura: false, vistoriaAtiva: false, status: "draft" }), false);
  assert.equal(paginaNivelFica({ captura: true, vistoriaAtiva: false, status: "draft" }), true, "captura (link do celular/QR) fica");
  assert.equal(paginaNivelFica({ captura: false, vistoriaAtiva: true, status: "draft" }), true, "a avaliação por avaliador mora aqui");
  assert.equal(paginaNivelFica({ captura: false, vistoriaAtiva: false, status: "active" }), true, "o publicado não tem Passo 5");
  assert.equal(destinoNivel("abc", "draft"), `/dashboard/imoveis/novo?draft=abc&etapa=comodidades#${ANCORA_NIVEL_CADASTRO}`);
  const p = ler("../../app/(dashboard)/dashboard/imoveis/[id]/nivel/page.tsx");
  assert.match(p, /if \(dados && !paginaNivelFica\(\{ captura, vistoriaAtiva: await vistoriaAtiva\(\), status \}\)\) redirect\(destinoNivel\(id, status\)\)/);
});

test("E143: o guia diz o Essencial declarado, como se prova (foto na hora) e o que Conforto e Premium pedem — das mesmas fontes da tela", () => {
  const s = secoesGuiaNivel();
  const tudo = s.flatMap((x) => [x.titulo, ...x.linhas]).join("\n");
  for (const t of [TEXTO_ESSENCIAL_DECLARADO, TEXTO_SUBIR_NIVEL, AVISO_PROVA_NA_HORA]) assert.ok(tudo.includes(t), t);
  const pedidos = new Set(Object.values(MATRIZ).flatMap((a) => [...a.conforto, ...a.premium]));
  for (const i of ITENS_NIVEL.filter((x) => pedidos.has(x.chave))) assert.ok(tudo.includes(i.criterio), i.chave);
});

test("E143: o guia é um PDF de verdade", async () => {
  const b = await gerarGuiaNivelPdf();
  assert.equal(Buffer.from(b.slice(0, 5)).toString(), "%PDF-");
  assert.ok(b.length > 1500);
});

test("E143: o Passo 5 (bloco do nível no cadastro) tem o link do guia; a rota serve o PDF", () => {
  const c = ler("../../components/niveis/nivel-cadastro.tsx");
  assert.match(c, /href=\{HREF_GUIA_NIVEL\}[\s\S]*?data-testid="nivel-cadastro-guia-pdf"[\s\S]*?\{TITULO_GUIA_NIVEL\} \(PDF\)/);
  assert.match(c, /from "@\/lib\/niveis\/guia-nivel-link"/, "o cliente importa só as constantes, não o pdf-lib");
  assert.equal(HREF_GUIA_NIVEL, "/api/guia-nivel");
  assert.ok(TITULO_GUIA_NIVEL.length > 0);
  const r = ler("../../app/api/guia-nivel/route.ts");
  assert.match(r, /"Content-Type": "application\/pdf"/);
  assert.match(r, /gerarGuiaNivelPdf\(\)/);
});
