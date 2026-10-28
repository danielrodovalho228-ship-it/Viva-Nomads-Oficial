/*
  CADASTRO-MOLDURA (E89): o assistente sai da casca do painel — topo mínimo (logo sem link + "Precisa de ajuda?" + "Sair"),
  sem lateral, topo do painel, barra inferior nem "Fale com a Viva"; o rodapé é do fluxo, igual nos 10 passos
  ("Passo N de 10" + barra + Voltar + um só primário, "Publicar anúncio" no Passo 10). Sem botão "Salvar".
  Roda: node --test src/lib/anuncio/assistente-moldura.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isFlowRoute } from "../nav-mobile.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const pagina = ler("app/(dashboard)/dashboard/imoveis/novo/page.tsx");
const semComentario = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const revisar = semComentario(ler("app/(dashboard)/dashboard/imoveis/novo/etapa-revisar.tsx"));
const moldura = ler("components/layout/moldura-assistente.tsx");
const rodape = ler("app/(dashboard)/dashboard/imoveis/novo/rodape-assistente.tsx");

test("a casca do painel dá lugar à moldura do assistente, depois dos hooks e antes da lateral e do topo do painel", () => {
  const shell = ler("components/layout/dashboard-shell.tsx");
  assert.match(shell, /if \(ehAssistenteCadastro\(pathname\)\) return <MolduraAssistente>\{children\}<\/MolduraAssistente>;/);
  assert.ok(shell.indexOf("ehAssistenteCadastro(pathname)") < shell.indexOf("<aside"));
  assert.match(moldura, /export const ehAssistenteCadastro = \(pathname: string\) => pathname === "\/dashboard\/imoveis\/novo";/);
  assert.doesNotMatch(moldura, /Menu|PapelAtivo|MobileTabBar|aside/);
  assert.ok(isFlowRoute("/dashboard/imoveis/novo"), "a barra inferior não volta no assistente");
  // A proteção de login e de papel continua a do grupo (dashboard): a troca é dentro do layout dele.
  assert.match(ler("app/(dashboard)/layout.tsx"), /DashboardShell/);
});

test("topo mínimo: logo sem link, 'Precisa de ajuda?' e 'Sair' para Meus imóveis com a linha do rascunho salvo", () => {
  assert.match(moldura, /<Logo href=\{null\}[^>]*\/>/);
  assert.match(ler("components/ui/logo.tsx"), /if \(href === null\)/);
  assert.match(moldura, /href="\/ajuda"[\s\S]*?data-testid="assistente-ajuda"[\s\S]*?Precisa de ajuda\?/);
  assert.match(moldura, /export const HREF_SAIR_ASSISTENTE = "\/dashboard\/imoveis\?saiu=assistente";/);
  assert.match(moldura, /export const TEXTO_RASCUNHO_SALVO = "Seu rascunho fica salvo\.";/);
  assert.match(moldura, /href=\{HREF_SAIR_ASSISTENTE\}[\s\S]*?data-testid="assistente-sair"/);
  const meus = ler("app/(dashboard)/dashboard/imoveis/page.tsx");
  assert.match(meus, /\(await searchParams\)\.saiu === "assistente"/);
  assert.match(meus, /data-testid="rascunho-fica-salvo"[\s\S]*?\{TEXTO_RASCUNHO_SALVO\}/);
});

test("sem 'Fale com a Viva' flutuante no assistente (a ajuda é o link do topo)", () => {
  const linha = ler("components/ajuda/viva-chat.tsx").split("\n").find((l) => l.includes("const ESCONDER")) ?? "";
  assert.match(linha, /"\/dashboard\/imoveis\/novo"/);
});

test("rodapé do fluxo: 'Passo N de 10' + barra, Voltar (passos 2–10) e um só primário (Continuar; Publicar anúncio no 10)", () => {
  assert.match(pagina, /<RodapeAssistente\s+pos=\{pos\}\s+total=\{ORDEM_ETAPAS\.length\}\s+onVoltar=\{pos > 0 \? voltarEtapa : null\}/);
  // E135: o Continuar reflete o passo (esmaecido quando falta algo) e continua dizendo o que falta ao clicar.
  assert.match(pagina, /pos < ULTIMA_ETAPA\s+\? \{\s+rotulo: "Continuar",\s+onClick: avancarEtapa,\s+testid: "cadastro-continuar",\s+seta: true,\s+[^}]*pendente: faltaNoPasso\.length > 0/);
  // E133: no Passo 2 o "Continuar" fica desabilitado de verdade até o mínimo de fotos e sem aviso pendente.
  assert.match(pagina, /pos < ULTIMA_ETAPA\s+\? \{\s+rotulo: "Continuar",\s+onClick: avancarEtapa,\s+testid: "cadastro-continuar",\s+seta: true,/);
  assert.match(pagina, /editingId \? "Salvar alterações" : "Publicar anúncio"/);
  assert.match(pagina, /testid: "publicar-anuncio"/);
  assert.match(rodape, /role="progressbar" aria-label="Progresso do cadastro"/);
  assert.match(rodape, /\{p\.texto \?\? textoPasso\(p\.pos, p\.total\)\}/);
  assert.equal((rodape.match(/<Button\b/g) ?? []).length, 1, "um primário só");
  assert.match(rodape, /vn-rodape-fluxo fixed inset-x-0/, "fixo na largura toda");
  assert.match(ler("app/globals.css"), /\.vn-rodape-fluxo \{\s*bottom: 0;/, "encosta no fim da tela (E107: sem barra de fotos)");
  assert.match(rodape, /aria-hidden className="h-32" data-testid="assistente-rodape-espaco"/, "o espaçador reserva o lugar do rodapé");
  assert.doesNotMatch(pagina, /data-testid="cadastro-(continuar|voltar)"|Cancelar e voltar|<CabecalhoPassos/, "Continuar, Voltar e o passo só no rodapé");
});

test("sem botão 'Salvar' no cadastro novo: o rascunho salva sozinho ('Salvo às HH:MM'); o Publicar saiu da revisão", () => {
  assert.match(pagina, /Salvo\{savedAt \? ` às \$\{savedAt\}` : ""\}/);
  assert.doesNotMatch(revisar, /Salvar como rascunho|function BotaoPublicar|data-testid="publicar-anuncio"/);
  assert.match(revisar, /\{p\.editingId \? \(\s*<Button variant="outline" onClick=\{\(\) => p\.publish\(true\)\}/);
});
