/*
  E1108 (ORDEM-DUET-491) — o detalhe do pedido do avaliador:
   (a) os valores submetidos não apareciam do lado do avaliador no piloto: `linhaDoValor` tratava TODO pedido de teste
       como "sem valor". Só a avaliação de teste do credenciamento (de teste e sem escolha do dono) não tem valor; o
       pedido do piloto com proposta mostra "Proposta enviada: R$ 250,00 em 2 dias" e, depois do aceite, o estado aceito
       com os mesmos valores;
   (b) o detalhe e a linha da lista não diziam de que imóvel era o pedido: passam a mostrar o título do anúncio e o
       código VN do imóvel (o código que o imóvel já tem). Dois pedidos da mesma cidade e porte ficavam indistinguíveis.
  Roda: node --test src/lib/vistoria/e1108-pedido-identifica-o-imovel.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { identificacaoDoImovel, linhaDoPrazoDoLaudo, linhaDoValor, resumoDoValorNaLista } from "./pedido-avaliador.ts";
import { codigoDoImovel } from "../imovel-pagina.ts";
import { fonteSemComentarios as semComentarios } from "../fonte-sem-comentarios.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const ESCOLHIDO = "2026-11-22T12:00:00Z";
const piloto = { valor_tabela: 350, valor_proposto: 250 as number | null, prazo_proposto_dias: 2 as number | null, teste: true, escolhido_em: ESCOLHIDO as string | null };

test("E1108 (a): o pedido do piloto (de teste, escolhido pelo dono) mostra os valores submetidos", () => {
  assert.deepEqual(linhaDoValor("proposta_enviada", piloto), { texto: "Proposta enviada: R$ 250,00 em 2 dias", recebe: false });
  assert.deepEqual(linhaDoValor("aceito", piloto), { texto: "Você recebe R$ 250,00", recebe: true });
  // Antes de propor: a referência da tabela, como em qualquer pedido.
  assert.deepEqual(linhaDoValor("novo", { ...piloto, valor_proposto: null, prazo_proposto_dias: null }), { texto: "Valor de referência: R$ 350,00", recebe: false });
});

test("E1108 (a): a avaliação de teste do credenciamento (de teste, sem escolha do dono) segue sem valor", () => {
  const credenciamento = { ...piloto, valor_tabela: 0, valor_proposto: null, prazo_proposto_dias: null, escolhido_em: null };
  for (const etapa of ["novo", "proposta_enviada", "aceito"] as const) {
    assert.deepEqual(linhaDoValor(etapa, credenciamento), { texto: "Avaliação de teste: sem valor a receber", recebe: false }, etapa);
  }
  // Quem chama sem dizer se o dono escolheu (as chamadas antigas) continua a ser lido como credenciamento.
  assert.equal(linhaDoValor("aceito", { valor_tabela: 0, valor_proposto: null, prazo_proposto_dias: null, teste: true }).texto, "Avaliação de teste: sem valor a receber");
});

test("E1108 (a): o pedido real não muda", () => {
  const real = { ...piloto, teste: false };
  assert.equal(linhaDoValor("proposta_enviada", real).texto, "Proposta enviada: R$ 250,00 em 2 dias");
  assert.equal(linhaDoValor("aceito", real).texto, "Você recebe R$ 250,00");
  assert.equal(linhaDoValor("proposta_enviada", { ...real, prazo_proposto_dias: 1 }).texto, "Proposta enviada: R$ 250,00 em 1 dia");
});

test("E1108 (a): depois do aceite o prazo combinado também aparece (os dois valores submetidos)", () => {
  assert.equal(linhaDoPrazoDoLaudo("aceito", piloto), "Laudo em 2 dias");
  assert.equal(linhaDoPrazoDoLaudo("aceito", { ...piloto, prazo_proposto_dias: 1 }), "Laudo em 1 dia");
  // Antes do aceite o prazo já vai na linha da proposta; no credenciamento não há proposta.
  assert.equal(linhaDoPrazoDoLaudo("proposta_enviada", piloto), null);
  assert.equal(linhaDoPrazoDoLaudo("novo", piloto), null);
  assert.equal(linhaDoPrazoDoLaudo("aceito", { ...piloto, escolhido_em: null }), null);
  assert.equal(linhaDoPrazoDoLaudo("aceito", { ...piloto, prazo_proposto_dias: null }), null);
});

test("E1108 (a): na lista, a mesma regra — o piloto mostra os valores; o credenciamento diz 'avaliação de teste'", () => {
  assert.equal(resumoDoValorNaLista(piloto), "R$ 250,00 · 2 dias");
  assert.equal(resumoDoValorNaLista({ ...piloto, prazo_proposto_dias: 1 }), "R$ 250,00 · 1 dia");
  assert.equal(resumoDoValorNaLista({ ...piloto, valor_proposto: null, prazo_proposto_dias: null }), "referência R$ 350,00");
  assert.equal(resumoDoValorNaLista({ ...piloto, escolhido_em: null }), "avaliação de teste");
  assert.equal(resumoDoValorNaLista({ ...piloto, teste: false }), "R$ 250,00 · 2 dias");
});

test("E1108 (b): a identificação do imóvel — o título do anúncio e o código VN que o imóvel já tem", () => {
  const id = "1202df7a-3c5e-4f1b-9a77-0c2d4e6f8a10";
  assert.equal(codigoDoImovel(id), "VN-1202DF");
  assert.equal(identificacaoDoImovel("[TESTE QA] Trecho1 Anunciar 20-11", id), "[TESTE QA] Trecho1 Anunciar 20-11 · VN-1202DF");
  assert.equal(identificacaoDoImovel("  Casa   da  Serra ", id), "Casa da Serra · VN-1202DF");
  // Sem título lido, o código basta para distinguir (nunca vazio).
  assert.equal(identificacaoDoImovel(null, id), "VN-1202DF");
  assert.equal(identificacaoDoImovel("", id), "VN-1202DF");
});

test("E1108: a tela do pedido, a tela da visita e a lista leem daqui", () => {
  const tela = semComentarios(ler("src/app/(dashboard)/dashboard/parceiro/avaliacao/[pedido]/page.tsx"));
  // O imóvel é lido com o título, nos dois ramos (pedido e visita/laudo).
  assert.match(tela, /\.from\("properties"\)\.select\("title, exact_address, address, city, state, draft_data"\)/);
  assert.match(tela, /imovel=\{identificacaoDoImovel\(imovel\?\.title, p\.property_id as string\)\}/);
  assert.match(tela, /valor=\{linhaDoValor\(etapa, dados\)\}/);
  assert.match(tela, /prazoLaudo=\{linhaDoPrazoDoLaudo\(etapa, dados\)\}/);
  assert.match(tela, /<IdentificacaoDoImovel texto=\{identificacaoDoImovel\(\(imovelDaVisita as /, "a tela da visita e do laudo também diz o imóvel");
  const comp = semComentarios(ler("src/components/avaliadores/pedido.tsx"));
  assert.match(comp, /<IdentificacaoDoImovel texto=\{imovel\}/);
  // Um componente só escreve a linha, nos três lugares; o código VN não quebra de linha.
  const linha = ler("src/components/avaliadores/identificacao-do-imovel.tsx");
  assert.match(linha, /data-testid="pedido-imovel"/);
  assert.match(linha, /<span className="whitespace-nowrap">\{codigo\}<\/span>/);
  assert.match(comp, /data-testid="pedido-prazo-laudo"/);
  // Só os comentários de linha saem: o `accept="image/*"` do formulário de credenciamento abriria um bloco falso aqui.
  const lista = semComentarios(ler("src/app/(dashboard)/dashboard/parceiro/avaliacao/page.tsx"));
  assert.match(lista, /identificacaoDoImovel\(/);
  assert.match(lista, /resumoDoValorNaLista\(p\)/);
  assert.match(lista, /<IdentificacaoDoImovel texto=\{imovel\} \/>/);
  assert.doesNotMatch(lista, /p\.teste \? "avaliação de teste"/, "a lista já não chama todo pedido de teste de 'avaliação de teste'");
  // Só os imóveis dos pedidos do próprio avaliador são lidos.
  // E1148 (ORDEM-DUET-679): a mesma leitura passou a trazer também o bairro (`address`), para o item encerrado.
  assert.match(lista, /\.from\("properties"\)\.select\("id, title, address"\)\.in\("id", /);
});
