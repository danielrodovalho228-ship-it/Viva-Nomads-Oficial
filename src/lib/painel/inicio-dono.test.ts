/*
  PROP-6 — Início do dono (mockup painel-proprietario).
  Roda: node --test src/lib/painel/inicio-dono.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ATALHOS_INICIO_DONO, PECA_NA_VIVA, alertaDoTopo, blocoPrincipalDono, lugarDoChecklistDono } from "./inicio-dono.ts";
import type { Decisao } from "./decisoes.ts";

const dec = (id: string, extra: Partial<Decisao> = {}): Decisao => ({ id, tipo: "proposta", texto: `Decisão ${id}`, href: `/x/${id}`, prazo: null, prazoTexto: null, atrasada: false, ...extra });

test("a faixa mostra UMA pendência: a atrasada antes, depois o prazo mais próximo", () => {
  assert.equal(alertaDoTopo([]), null);
  assert.equal(alertaDoTopo([dec("a"), dec("b", { prazo: "2026-11-02" }), dec("c", { prazo: "2026-11-01" })])?.id, "c");
  assert.equal(alertaDoTopo([dec("b", { prazo: "2026-11-01" }), dec("d", { atrasada: true, prazo: "2026-12-01" })])?.id, "d");
});

const itens = [
  { label: "Fotos e título", ok: true, href: "/e/fotos" },
  { label: "Detalhes básicos (banheiros e área)", ok: false, href: "/e/detalhes" },
  { label: "Preço e regras", ok: false, href: "/e/preco" },
];

test("com rascunho: 'Continue seu anúncio', % pronto, próximo passo e 'Continuar de onde parou' no item que falta", () => {
  const b = blocoPrincipalDono({ rascunho: { id: "r1", pct: 47, pronto: false, itens, foto: "https://x/capa.webp" }, decisoes: [dec("a")], temAnuncio: false, fotoAnuncio: null });
  assert.equal(b.tipo, "rascunho");
  assert.equal(b.titulo, "Continue seu anúncio");
  assert.equal(b.pct, 47);
  assert.equal(b.linha, "Próximo passo: detalhes básicos (banheiros e área)");
  assert.deepEqual(b.botao, { rotulo: "Continuar de onde parou", href: "/e/detalhes" });
  assert.deepEqual(b.passos.map((p) => [p.rotulo, p.feito]), [["Fotos e título", true], ["Detalhes básicos (banheiros e área)", false], ["Preço e regras", false]]);
  assert.equal(b.foto, "https://x/capa.webp");
});

test("sem rascunho: a decisão vira 'Próximo passo'; sem nada, o caminho real; sem anúncio, SEM foto", () => {
  const d = blocoPrincipalDono({ rascunho: null, decisoes: [dec("a", { atrasada: true })], temAnuncio: true, fotoAnuncio: "https://x/f.webp" });
  assert.deepEqual([d.tipo, d.titulo, d.linha, d.botao.href, d.foto], ["decisao", "Próximo passo", "Decisão a", "/x/a", "https://x/f.webp"]);
  const p = blocoPrincipalDono({ rascunho: null, decisoes: [], temAnuncio: false, fotoAnuncio: null });
  assert.deepEqual([p.tipo, p.foto, p.botao.href], ["primeiro_anuncio", null, "/dashboard/imoveis/novo"]);
  const e = blocoPrincipalDono({ rascunho: null, decisoes: [], temAnuncio: true, fotoAnuncio: null });
  assert.deepEqual([e.tipo, e.foto], ["em_dia", null]);
});

test("Peça na Viva (um botão cheio) e os três atalhos do mockup", () => {
  assert.equal(PECA_NA_VIVA.principal.rotulo, "Publicar pedido de moradia");
  assert.equal(PECA_NA_VIVA.secundario.rotulo, "Pedir um serviço");
  assert.deepEqual(ATALHOS_INICIO_DONO.map((a) => a.rotulo), ["Agenda", "Simulador de rentabilidade", "Recibos e notas"]);
  const c = readFileSync("src/components/painel/inicio-dono.tsx", "utf8");
  assert.match(c, /href=\{PECA_NA_VIVA\.secundario\.href\} variant="outline"/);
  // Sem foto: nada de imagem inventada.
  assert.match(c, /\{bloco\.foto && \(/);
  const v = readFileSync("src/app/(dashboard)/dashboard/visao-geral-client.tsx", "utf8");
  assert.match(v, /if \(mode === "owner" && !demo && inicioDono\)/);
});

test("E218 (L-71): o checklist de ativação do dono volta ao Início — dentro de 'Anuncie seu primeiro imóvel', abaixo nos outros", () => {
  assert.equal(lugarDoChecklistDono("primeiro_anuncio"), "dentro");
  assert.equal(lugarDoChecklistDono("rascunho"), "abaixo");
  assert.equal(lugarDoChecklistDono("decisao"), "abaixo");
  assert.equal(lugarDoChecklistDono("em_dia"), "abaixo");
  const ler = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
  const visao = ler("../../app/(dashboard)/dashboard/visao-geral-client.tsx");
  // O modo dono passa o checklist do proprietário ao InicioDono...
  assert.match(visao, /<InicioDono [^>]*checklist=\{checklists\.find\(\(c\) => c\.papel === "proprietario"\) \?\? null\}/);
  // ...e o modo morador continua sem ele (E167, #1392).
  assert.match(visao, /const blocosMorador = checklists\.filter\(\(c\) => c\.papel !== "proprietario"\)/);
  const inicio = ler("../../components/painel/inicio-dono.tsx");
  assert.match(inicio, /lugar === "dentro" && <ChecklistAtivacaoBloco checklist=\{checklist\} embutido \/>/);
  assert.match(inicio, /lugar === "abaixo" && <ChecklistAtivacaoBloco checklist=\{checklist\} \/>/);
});
