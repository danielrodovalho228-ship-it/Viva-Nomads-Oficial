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
