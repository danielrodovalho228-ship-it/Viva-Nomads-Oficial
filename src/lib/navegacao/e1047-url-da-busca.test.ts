/*
  E1047 (ORDEM-DUET-268, 20/11): a /buscar não reescreve a URL quando ela não muda.
  No Next desta versão, cada history.replaceState feito pela página vira uma ação "restore" do router
  (app-router.js: applyUrlFromHistoryPushReplace → navigator.restore), e uma ação restore com uma navegação pendente
  descarta essa navegação (app-router-instance.js: "Navigations (including back/forward) take priority over any pending
  actions … Mark the pending action as discarded"). A sincronização da URL da /buscar corria 2 a 3 vezes por carga, todas
  para a MESMA URL, até ~1 s depois de os cards aparecerem (sonda 44759440673). O primeiro toque num card que caísse entre
  o clique e o pushState do <Link> perdia-se: a URL ficava na /buscar (a etapa 3 da t2157, ~8 % no lab-critico).
  Roda: node --test src/lib/navegacao/e1047-url-da-busca.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sincronizarUrlDaBusca } from "./url-da-busca.ts";

function janela(pathname: string, search: string) {
  const chamadas: string[] = [];
  return {
    chamadas,
    alvo: {
      location: { pathname, search },
      history: { replaceState: (_d: unknown, _u: string, url: string) => void chamadas.push(url) },
    },
  };
}

test("URL igual à atual: não chama o replaceState (não dispara o restore do router)", () => {
  const { chamadas, alvo } = janela("/buscar", "?local=Uberl%C3%A2ndia");
  assert.equal(sincronizarUrlDaBusca("/buscar?local=Uberl%C3%A2ndia", alvo), false);
  assert.deepEqual(chamadas, []);
});

test("sem parâmetros e já sem busca na URL: também não chama", () => {
  const { chamadas, alvo } = janela("/buscar", "");
  assert.equal(sincronizarUrlDaBusca("/buscar", alvo), false);
  assert.deepEqual(chamadas, []);
});

test("URL diferente (a pessoa mexeu num filtro): chama uma vez, com a URL nova", () => {
  const { chamadas, alvo } = janela("/buscar", "?local=Uberl%C3%A2ndia");
  assert.equal(sincronizarUrlDaBusca("/buscar?local=Uberl%C3%A2ndia&quartos=2", alvo), true);
  assert.deepEqual(chamadas, ["/buscar?local=Uberl%C3%A2ndia&quartos=2"]);
});

test("a /buscar sincroniza a URL só por este caminho", () => {
  const busca = readFileSync("src/app/(public)/buscar/search-client.tsx", "utf8");
  assert.match(busca, /import \{ sincronizarUrlDaBusca \} from "@\/lib\/navegacao\/url-da-busca";/);
  assert.match(busca, /sincronizarUrlDaBusca\(qs \? `\$\{window\.location\.pathname\}\?\$\{qs\}` : window\.location\.pathname\);/);
  assert.doesNotMatch(busca, /history\.replaceState\(/);
});
