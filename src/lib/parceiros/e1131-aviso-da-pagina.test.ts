/*
  E1131 (ORDEM-DUET-572; achado da prova ao vivo do E1112): a recusa de contacto na página do parceiro era SILENCIOSA.
  A action já recusava (`salvarPagina` → `CONTATO_AVISO`, nada grava), mas o painel desenhava o aviso no topo, entre as
  abas e o conteúdo — longe do botão "Salvar apresentação", que fica depois da capa e da galeria. Quem salvava não via
  nada. Agora o aviso aparece JUNTO do botão que o causou (no padrão E818 das outras superfícies: a mensagem ao lado do
  sítio, com role="alert", e a página rola até ela). O pedido de parceria já seguia esse padrão; a trava confirma-o.
  Roda: node --test src/lib/parceiros/e1131-aviso-da-pagina.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CONTATO_AVISO, contemContato } from "../pedidos/pedidos.ts";
import { validarSolicitacao } from "./regras.ts";

const ler = (p: string) => readFileSync(p, "utf8");
const PAINEL = "src/app/(dashboard)/dashboard/parceiro/painel-parceiro.tsx";

test("E1131: a action da página continua a recusar contacto com o aviso da casa (o que o painel vai mostrar)", () => {
  const acoes = ler("src/lib/parceiros/painel-actions.ts");
  const fn = acoes.slice(acoes.indexOf("export async function salvarPagina"), acoes.indexOf("function ehWebp"));
  assert.match(fn, /contemContato\(t\)\)\) return \{ ok: false, erro: CONTATO_AVISO \};/);
  assert.ok(contemContato("Ana Limpezas (34) 99876-5432"));
  assert.ok(CONTATO_AVISO.length > 0);
});

test("E1131: o aviso da recusa ao salvar a apresentação aparece JUNTO do botão, como alerta, e a página rola até ele", () => {
  const s = ler(PAINEL);
  const aba = s.slice(s.indexOf("function AbaPagina"), s.indexOf("function FotoGaleria"));
  // O salvar da apresentação marca o resultado como seu ("pagina")…
  assert.match(aba, /rodar\(\(\) => salvarPagina\(\{ nomePublico: nome, descricao, descricaoCurta: curta, redes \}\), "Salvo\.", "pagina"\)/);
  // …e o aviso é desenhado logo a seguir ao botão, com role="alert" na recusa.
  const iBotao = aba.indexOf('data-testid="parceiro-salvar-pagina"');
  // O mesmo data-testid de sempre ("parceiro-msg"), agora junto do botão: as specs t236 e t2230 continuam a ler o aviso.
  const iAviso = aba.indexOf('data-testid="parceiro-msg" data-onde="pagina"');
  assert.ok(iBotao > 0 && iAviso > iBotao, "o aviso vem logo depois do botão Salvar apresentação");
  assert.match(aba, /msg\?\.onde === "pagina"/);
  assert.match(aba, /role=\{msg\.ok \? "status" : "alert"\}/);
  // E1137 (ORDEM-DUET-601): não basta haver um scrollIntoView no arquivo — a rolagem tem de disparar com o resultado do
  // "Salvar apresentação" (onde "pagina") e ir até ao aviso desse botão. O comportamento na tela é guardado pela t2230
  // (caso 1, com o botão no fundo do ecrã a 390×844); aqui fica o elo entre o resultado e a rolagem.
  const efeito = aba.slice(aba.indexOf("useEffect(() => {"), aba.indexOf("}, [msg]);") + "}, [msg]);".length);
  assert.match(efeito, /if \(msg\?\.onde === "pagina"\) avisoPagina\.current\?\.scrollIntoView\(\{ block: "center"/, "a rolagem dispara com o resultado do botão da página");
  assert.match(efeito, /\}, \[msg\]\);$/, "e volta a correr a cada novo resultado");
  assert.match(aba, /<p ref=\{avisoPagina\}[^>]*data-testid="parceiro-msg" data-onde="pagina"/, "e vai até ao aviso junto do botão");
  // O aviso do topo não repete a mensagem que já está junto do botão.
  const corpo = s.slice(s.indexOf("export function PainelParceiro"), s.indexOf("type Rodar"));
  assert.match(corpo, /\{msg && !msg\.onde && \(/);
});

test("E1131: o pedido de parceria já mostra a recusa de contacto junto do campo (padrão E818) — fica travado", () => {
  const base = { nome: "Ana Limpezas", tipoPessoa: "pj" as const, documento: "11.222.333/0001-81", categorias: ["limpeza"], cidades: ["Uberlândia"], aceite: true, descricao: "Limpeza residencial", emiteNota: true };
  assert.deepEqual(validarSolicitacao({ ...base, descricao: "Chama no zap" }), { ok: false, erro: CONTATO_AVISO, campo: "descricao" });
  assert.deepEqual(validarSolicitacao({ ...base, nome: "Ana 34 99999-1234" }), { ok: false, erro: CONTATO_AVISO, campo: "nome" });
  const form = ler("src/components/parceiros/seja-parceiro-form.tsx");
  assert.match(form, /nome: "sp-nome"/);
  assert.match(form, /descricao: "sp-descricao"/);
  assert.match(form, /else falhar\(r\.erro, "campo" in r \? r\.campo : undefined\);/);
  assert.match(form, /data-testid=\{`sp-erro-\$\{k\}`\}/);
});
