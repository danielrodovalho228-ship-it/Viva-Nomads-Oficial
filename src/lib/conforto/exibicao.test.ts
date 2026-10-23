/*
  Prompt 59-A — exibição do padrão mínimo e do compromisso de manutenção: textos exatos, taxa oculta abaixo de 3,
  o que falta para publicar, estados do chamado, filas do admin e um primário por tela.
  Roda: node --test src/lib/conforto/exibicao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ITENS_CONFORTO, CHAVES_CONFORTO } from "../../config/conforto-minimo.ts";
import { TEXTO_PADRAO_CONFIRMADO, TITULO_PADRAO_MINIMO, itensNaoConfirmados, rotuloTaxaManutencao, textoCompromissoManutencao, textoFaltaConfirmar } from "./exibicao.ts";
import { prontidaoAnuncio } from "../anuncio/prontidao.ts";
import { ETAPA } from "../anuncio/etapas-ids.ts";
import { DECISOES_ADMIN, montarDecisoesAdmin } from "../admin/decisoes-admin.ts";
import { decisoesDoProprietario } from "../painel/decisoes.ts";

const SRC = new URL("../../", import.meta.url).pathname;
const ler = (p: string) => readFileSync(SRC + p, "utf8");

test("os 12 itens da lista v2 (Adendo 59.1), cada um com o critério em uma linha", () => {
  assert.equal(ITENS_CONFORTO.length, 12);
  for (const i of ITENS_CONFORTO) {
    assert.ok(i.criterio.length > 0 && i.criterio.length <= 90, i.chave);
    assert.doesNotMatch(i.criterio, /\n/);
  }
  assert.equal(TITULO_PADRAO_MINIMO, "Padrão mínimo da Viva");
});

test("o que falta para publicar: 'Falta confirmar: [itens]' na ordem da lista; tudo marcado, nada", () => {
  assert.equal(textoFaltaConfirmar(CHAVES_CONFORTO), null);
  const semDois = CHAVES_CONFORTO.filter((k) => k !== "agua_quente" && k !== "iluminacao");
  assert.equal(textoFaltaConfirmar(semDois), "Falta confirmar: Água quente, Iluminação.");
  assert.equal(itensNaoConfirmados([]).length, 12);
  // O botão Publicar nunca fica desabilitado em silêncio: a Revisão mostra a lista ao lado dele.
  const rv = ler("app/(dashboard)/dashboard/imoveis/novo/etapa-revisar.tsx");
  assert.match(rv, /data-testid="publicar-falta"/);
  assert.match(rv, /textoFaltaConfirmar\(p\.conforto\)/);
  assert.doesNotMatch(rv, /<ChecklistConforto/, "o checklist saiu da Revisão");
});

test("o checklist fica no passo Comodidades, e o 'Resolver' do portão leva até ele", () => {
  const pg = ler("app/(dashboard)/dashboard/imoveis/novo/page.tsx");
  const comodidades = pg.slice(pg.indexOf("{step === ETAPA.comodidades && ("), pg.indexOf("{step === ETAPA.regras && ("));
  assert.match(comodidades, /<ChecklistConforto\s+marcados=\{conforto\}/);
  const p = prontidaoAnuncio({
    enderecoOk: true, detalhesOk: true, periodoOk: true, fotos: 8, titulo: "Studio", descricao: "x".repeat(80), comodidades: 5, preco: 3000,
    garantiaOk: true, operacao: "proprio", documento: "approved", limitePlanoOk: null, selo: false, video: false, confortoFaltam: 2, sublocacaoOk: true, privacidadeOk: true,
  } as unknown as Parameters<typeof prontidaoAnuncio>[0]);
  const item = p.obrigatorios.find((i) => i.key === "conforto");
  assert.equal(item?.etapa, ETAPA.comodidades);
  assert.equal(p.podePublicar, false);
});

test("compromisso de manutenção: o texto exato, dos prazos do 59", () => {
  assert.equal(
    textoCompromissoManutencao(),
    "Manutenção: urgente com solução provisória em até 24 h e definitiva em até 72 h · comum em até 72 h · demais em até 7 dias",
  );
  assert.equal(TEXTO_PADRAO_CONFIRMADO, "Padrão mínimo da Viva: confirmado pelo proprietário");
  const bloco = ler("components/conforto/padrao-minimo-imovel.tsx");
  assert.match(bloco, /\{confirmado && \(/, "a linha do padrão mínimo só aparece confirmada");
  assert.match(bloco, /O que é o padrão mínimo/);
  assert.match(bloco, /Os \{ITENS_CONFORTO\.length\} itens/, "a folha conta os itens pela lista, não por número fixo");
});

test("taxa de manutenção no prazo: oculta abaixo de 3 chamados resolvidos", () => {
  assert.equal(rotuloTaxaManutencao(null), null);
  assert.equal(rotuloTaxaManutencao({ taxa: 1, resolvidos: 2 }), null);
  assert.equal(rotuloTaxaManutencao({ taxa: 2 / 3, resolvidos: 3 }), "Manutenção resolvida no prazo: 67%");
  assert.equal(rotuloTaxaManutencao({ taxa: 1, resolvidos: 12 }), "Manutenção resolvida no prazo: 100%");
  const pagina = ler("app/(public)/imoveis/[id]/page.tsx");
  assert.match(pagina, /isExemplo\(property\) \? Promise\.resolve\(null\) : exibicao59DoImovel/, "exemplo nunca mostra taxa nem padrão");
});

test("chamado: os 4 estados do prazo de solução e os botões de cada lado", () => {
  const c = ler("components/manutencao/cartao-ordem.tsx");
  assert.match(c, /no_prazo: "No prazo", vencido: "Vencido", resolvido_no_prazo: "Resolvido no prazo", resolvido_fora: "Fora do prazo"/);
  assert.match(c, /Ainda não resolveu/);
  assert.doesNotMatch(c, />\s*Reabrir\s*</);
  assert.match(c, /data-testid="ordem-responder-ate"/);
  assert.match(c, /papel === "proprietario"[\s\S]{0,200}=== "vencido"[\s\S]{0,600}Chamar um parceiro de manutenção/);
});

test("um primário por tela: nada no cartão do chamado nem no bloco do imóvel usa o botão primário", () => {
  for (const arq of ["components/manutencao/cartao-ordem.tsx", "components/conforto/padrao-minimo-imovel.tsx"]) {
    const t = ler(arq);
    for (const m of t.matchAll(/<Button\b[^>]*>/g)) assert.match(m[0], /variant="(secondary|outline|ghost)"/, `${arq}: ${m[0].slice(0, 80)}`);
  }
});

test("admin: 'Manutenção fora do prazo' e 'pendências de conforto contestadas' no topo das decisões", () => {
  assert.deepEqual(DECISOES_ADMIN.slice(0, 2).map((d) => d.chave), ["manutencao_fora_prazo", "conforto_contestacoes"]);
  const r = montarDecisoesAdmin(Object.fromEntries(DECISOES_ADMIN.map((d) => [d.chave, { n: d.chave === "conforto_contestacoes" ? 2 : d.chave === "manutencao_fora_prazo" ? 1 : 0 }])));
  assert.deepEqual(r.linhas.map((l) => l.texto), ["1 manutenção fora do prazo", "2 pendências de conforto contestadas"]);
  assert.equal(r.linhas[1].acao, "Decidir");
});

test("painel do dono: 'Confirme o padrão mínimo de [imóvel] até [data]' numa frase só", () => {
  const agora = new Date("2026-10-22T12:00:00Z");
  const d = decisoesDoProprietario({ confortoPrazos: [{ propertyId: "p1", imovel: "Studio Centro", prazoAte: "2026-11-21T12:00:00Z", pausado: false }] } as never, agora);
  const linha = d.find((x) => x.id === "conforto-p1");
  assert.equal(linha?.texto, "Confirme o padrão mínimo de Studio Centro até 21/11/2026");
  assert.equal(linha?.href, "/dashboard/imoveis/p1/conforto");
});
