/*
  E1019 (t1629, E916) — a busca da 404 não perde o texto quando o campo é trocado por um nó novo.
  Reprodução da Pista 3: digitado "Uberlândia", o campo chegava vazio ao clique (Expected "Uberlândia", Received "").
  Aqui: o script da página guarda o texto escutando no document; o campo novo (vazio) repõe o texto guardado.
  Roda: node --test src/lib/navegacao/e1019-busca-404.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { CHAVE_BUSCA_404, SCRIPT_GUARDA_BUSCA_404, VALIDADE_BUSCA_404_MS, guardarBusca404, textoParaRepor } from "./busca-404.ts";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

/** Um document mínimo: guarda os ouvintes de "input" e despacha um evento com o alvo dado. */
function ambiente() {
  const ouvintes: Array<(e: { target: unknown }) => void> = [];
  const store = new Map<string, string>();
  const ctx = {
    document: { addEventListener: (tipo: string, fn: (e: { target: unknown }) => void) => tipo === "input" && ouvintes.push(fn) },
    sessionStorage: { setItem: (k: string, v: string) => void store.set(k, v), getItem: (k: string) => store.get(k) ?? null },
    Date,
    JSON,
  };
  vm.runInNewContext(SCRIPT_GUARDA_BUSCA_404, ctx);
  return { digitar: (alvo: { id: string; value: string }) => ouvintes.forEach((fn) => fn({ target: alvo })), store };
}

test("E1019 — o texto digitado sobrevive à troca do campo (o nó novo vazio repõe 'Uberlândia')", () => {
  const { digitar, store } = ambiente();
  const antigo = { id: "nao-encontrada-local", value: "Uberlândia" };
  digitar(antigo); // a pessoa digita no campo servido pelo servidor (pode ser antes da hidratação)
  const novo = { id: "nao-encontrada-local", value: "" }; // a 404 volta a ser montada: campo novo, vazio
  assert.equal(textoParaRepor(novo.value, store.get(CHAVE_BUSCA_404) ?? null, Date.now()), "Uberlândia");
});

test("E1019 — o script só guarda o campo da busca da 404", () => {
  const { digitar, store } = ambiente();
  digitar({ id: "outro-campo", value: "segredo" });
  assert.equal(store.size, 0);
});

test("E1019 — não repõe por cima do que já está no campo, nem texto velho, vazio ou corrompido", () => {
  const agora = 1_000_000;
  const g = guardarBusca404("Uberlândia", agora);
  assert.equal(textoParaRepor("Santa Mônica", g, agora), null);
  assert.equal(textoParaRepor("", g, agora + VALIDADE_BUSCA_404_MS + 1), null);
  assert.equal(textoParaRepor("", guardarBusca404("   ", agora), agora), null);
  assert.equal(textoParaRepor("", "{nao-json", agora), null);
  assert.equal(textoParaRepor("", null, agora), null);
});

test("E1019 — a 404 usa a busca que repõe o texto e o script que guarda", () => {
  const pagina = ler("../../app/not-found.tsx");
  assert.match(pagina, /<BuscaNaoEncontrada \/>/);
  assert.match(pagina, /SCRIPT_GUARDA_BUSCA_404/);
  const busca = ler("../../components/layout/busca-nao-encontrada.tsx");
  // continua um formulário HTML para /buscar com o campo "local" (funciona sem JavaScript)
  assert.match(busca, /action="\/buscar"/);
  assert.match(busca, /name="local"/);
  assert.match(busca, /data-testid="nao-encontrada-busca"/);
  assert.match(busca, /textoParaRepor/);
});

/*
  E1019 — prova de chegada de 19/11 (ORDEM-DUET-194): digitado o termo, seguir por "Buscar imóveis" e voltar deixava o
  campo vazio (só sobrevivia pela cache do navegador). Vermelho sem a correção: o link era sempre "/buscar" e a URL da
  404 não guardava nada.
*/
import { hrefBuscarImoveis, termoDaUrl404, urlDa404ComTermo } from "./busca-404.ts";

test("E1019 (prova 19/11) — o \"Buscar imóveis\" leva o termo; sem termo, a /buscar de sempre", () => {
  assert.equal(hrefBuscarImoveis("apartamento teste e1019"), "/buscar?local=apartamento%20teste%20e1019");
  assert.equal(hrefBuscarImoveis("  Uberlândia "), "/buscar?local=Uberl%C3%A2ndia");
  assert.equal(hrefBuscarImoveis("   "), "/buscar");
  assert.equal(hrefBuscarImoveis(""), "/buscar");
});

test("E1019 (prova 19/11) — a URL da 404 guarda o termo (o Voltar volta a ela) e devolve-o", () => {
  const u = urlDa404ComTermo("/rota-que-nao-existe", "?x=1", "#a", "apartamento teste");
  assert.equal(u, "/rota-que-nao-existe?x=1&local=apartamento+teste#a");
  assert.equal(termoDaUrl404(u.slice(u.indexOf("?"), u.indexOf("#"))), "apartamento teste");
  assert.equal(urlDa404ComTermo("/r", "?local=velho", "", ""), "/r");
  assert.equal(termoDaUrl404(""), "");
});

test("E1019 (prova 19/11) — a 404 não tem mais o \"Buscar imóveis\" fixo; o componente usa o termo e a URL", () => {
  const pagina = ler("../../app/not-found.tsx");
  assert.doesNotMatch(pagina, /<ButtonLink href="\/buscar"/);
  const busca = ler("../../components/layout/busca-nao-encontrada.tsx");
  assert.match(busca, /<ButtonLink href=\{hrefBuscarImoveis\(termo\)\}/);
  assert.match(busca, /window\.history\.replaceState\(window\.history\.state, "", nova\)/);
  assert.match(busca, /termoDaUrl404\(window\.location\.search\)/);
});
