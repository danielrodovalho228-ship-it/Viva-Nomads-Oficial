/* Roda: node --test src/lib/painel/e503-inicio-carregamento.test.ts — E503: Início do painel sem espera em série nem vão no fim. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const pagina = ler("app/(dashboard)/dashboard/inicio-dados.tsx");
const cliente = ler("app/(dashboard)/dashboard/visao-geral-client.tsx");

test("E503: depois do 1º lote, conta pausada, capa, parceria, fatos e agenda saem num lote só (nada de espera em série)", () => {
  const corpo = pagina.slice(pagina.indexOf("export async function InicioDados")); // E797: as leituras moraram para InicioDados
  // Um 2º Promise.all reúne as leituras que antes esperavam uma pela outra.
  const segundo = corpo.slice(corpo.indexOf("await Promise.all", corpo.indexOf("await Promise.all") + 1));
  for (const leitura of ["contaPausadaEm()", "capaDoRascunho(", "minhaParceria()", "fatosDaConta(draft)", "carregarAgendaDoDono()"]) {
    assert.ok(segundo.slice(0, 900).includes(leitura), `${leitura} no mesmo lote`);
  }
  assert.doesNotMatch(corpo, /situacaoParceiro\(await minhaParceria\(\)/);
  assert.doesNotMatch(corpo, /const fatos = await fatosDaConta/);
  assert.doesNotMatch(corpo, /const agendaHoje = imoveisDono\.length \? await carregarAgendaDoDono/);
});

test("E503: os recomendados guardam o lugar enquanto carregam (nada de página curta que termina em vão)", () => {
  assert.match(cliente, /const \{ properties: todosRecomendados, loading: carregandoRecomendados \} = useProperties\("\/api\/properties"\)/);
  assert.match(cliente, /carregandoRecomendados && recommended\.length === 0 &&/);
  assert.match(cliente, /<SkeletonGradeCartoes itens=\{4\}/);
});

test("E503: o Início fecha com um rodapé curto (Central de ajuda, Termos, Privacidade)", () => {
  // E797: o rodapé é parte FIXA da casca (page.tsx), fora do bloco de dados.
  assert.match(ler("app/(dashboard)/dashboard/page.tsx"), /<RodapeInicio \/>/);
  const rodape = ler("components/dashboard/rodape-inicio.tsx");
  for (const href of ["/ajuda", "/termos", "/privacidade"]) assert.ok(rodape.includes(`{ href: "${href}"`), href);
  assert.match(rodape, /data-testid="inicio-rodape"/);
});
