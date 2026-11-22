/*
  E682 (refino): prova de RENDERIZAÇÃO do bloco do dono com a chave VISTORIA_ATIVA desligada — só dentro do teste, com
  dados simulados (nada de Supabase real, nada de produção). Carrega o .tsx real; só as bordas são dublês.
  Prova: chave off + conta real => nada na tela e NENHUMA leitura de dados (então nenhum avaliador vaza); conta de teste
  => só leitura, sem lista de avaliadores nem botão Escolher e sem pedir a lista; chave on (controle) => lista aparece,
  com conduta e "avaliações feitas".
  Roda: node --test src/components/vistoria/bloco-avaliacao-dono.render.test.ts
*/
import assert from "node:assert/strict";
import { register } from "node:module";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

register("./render-harness/loader.mjs", import.meta.url);

const SEGREDO = { numero: "VN-AV-SEGREDO-777", nome: "Avaliadora Sigilosa" };

type Linhas = Record<string, unknown>;
function bancoFalso(isTeste: boolean, pedido: Linhas = {}) {
  const lidas: string[] = [];
  const dados: Linhas = {
    profiles: { is_teste: isTeste },
    properties: { id: "p1", owner_id: "u1", status: "active", city: "Uberlândia", bedrooms: 2 },
    vistoria_precos: [],
    vistoria_pedidos: [{ id: "ped1", status: "pedido", aguardando_avaliador: false, agendado_para: null, ocupado: false, concordancia_em: null, recebido_marcado_em: null, recebido_confirmado_em: null, valor_proposto: null, prazo_proposto_dias: null, proposta_em: null, proposta_aceita_em: null, teste: false, avaliadores_credenciamento: null, ...pedido }],
    vistoria_laudos: null,
    vistoria_bloqueios: [],
    avaliadores_credenciamento: [{ id: "a1", numero_credenciado: SEGREDO.numero, preco_proprio: 350, prazo_entrega_dias: 5, prazo_resposta_horas: 12, parceiros: { nome_publico: SEGREDO.nome } }],
  };
  const construtor = (tabela: string): unknown => {
    const b: Record<string, unknown> = {};
    for (const m of ["select", "eq", "in", "is", "order", "limit"]) b[m] = () => b;
    b.maybeSingle = async () => ({ data: Array.isArray(dados[tabela]) ? (dados[tabela] as unknown[])[0] ?? null : dados[tabela] ?? null, error: null });
    b.then = (ok: (v: unknown) => unknown) => ok({ data: dados[tabela] ?? [], error: null });
    return b;
  };
  return {
    lidas,
    from(tabela: string) {
      lidas.push(tabela);
      return construtor(tabela);
    },
    async rpc(nome: string) {
      lidas.push("rpc:" + nome);
      return { data: [{ numero_credenciado: SEGREDO.numero, nota_conduta: 4.5, avaliacoes_feitas: 7 }], error: null };
    },
  };
}

async function renderizar(opts: { chave: boolean; isTeste: boolean; pedido?: Linhas; outros?: number | null }) {
  const admin = bancoFalso(opts.isTeste, opts.pedido);
  const g = globalThis as unknown as { __VN: Record<string, unknown> };
  g.__VN = { chave: opts.chave, user: { id: "u1" }, admin, sugeridos: [{ id: "a1" }], sugeridosChamado: false, outros: opts.outros ?? null, outrosChamado: false };
  const { BlocoAvaliacaoDono } = (await import("./bloco-avaliacao-dono.tsx")) as { BlocoAvaliacaoDono: (p: { propertyId: string }) => Promise<unknown> };
  const arvore = await BlocoAvaliacaoDono({ propertyId: "p1" });
  const html = arvore ? renderToStaticMarkup(arvore as Parameters<typeof renderToStaticMarkup>[0]) : "";
  return { arvore, html, lidas: admin.lidas, sugeridosChamado: g.__VN.sugeridosChamado as boolean, outrosChamado: g.__VN.outrosChamado as boolean };
}

test("chave desligada + conta real: o bloco devolve null, sem nenhuma leitura de dados (nenhum avaliador vaza)", async () => {
  const r = await renderizar({ chave: false, isTeste: false });
  assert.equal(r.arvore, null);
  assert.equal(r.html, "");
  assert.ok(!r.lidas.includes("avaliadores_credenciamento") && !r.lidas.includes("rpc:avaliadores_publicos"));
  assert.equal(r.sugeridosChamado, false);
  assert.ok(!r.html.includes(SEGREDO.numero) && !r.html.includes(SEGREDO.nome));
});

test("chave desligada + conta de teste: só leitura, sem lista de avaliadores nem botão Escolher, sem pedir a lista", async () => {
  const r = await renderizar({ chave: false, isTeste: true });
  assert.match(r.html, /avaliacao-modo-teste/);
  assert.equal(r.sugeridosChamado, false);
  assert.ok(!r.lidas.includes("avaliadores_credenciamento") && !r.lidas.includes("rpc:avaliadores_publicos"));
  assert.ok(!r.html.includes(SEGREDO.numero) && !r.html.includes(SEGREDO.nome));
  assert.doesNotMatch(r.html, /Escolher/);
});

test("controle (chave ligada): a lista aparece com conduta e 'avaliações feitas' — o teste não é vazio", async () => {
  const r = await renderizar({ chave: true, isTeste: false });
  assert.equal(r.sugeridosChamado, true);
  assert.ok(r.html.includes(SEGREDO.nome));
  assert.match(r.html, /conduta 4,5 · 7 avaliações feitas/);
  assert.match(r.html, /Escolher/);
});

// ── E1100 (ORDEM-DUET-465): a troca de avaliador com a proposta viva ──────────────────────────────────────────────
const COM_PROPOSTA: Linhas = {
  status: "designado",
  valor_proposto: 380,
  prazo_proposto_dias: 5,
  proposta_em: "2026-11-22T12:00:00Z",
  avaliadores_credenciamento: { numero_credenciado: "UDI-002", prazo_resposta_horas: 24 },
};

test("E1100: com a proposta viva, o bloco entrega à confirmação o que se perde e quantos avaliadores sobram", async () => {
  const r = await renderizar({ chave: true, isTeste: false, pedido: COM_PROPOSTA, outros: 2 });
  assert.equal(r.outrosChamado, true, "o bloco lê quantos sobram ANTES do clique");
  assert.match(r.html, /data-testid="troca-harness" data-pedido="ped1" data-sem-outro="0"/);
  assert.match(r.html, /Escolher outro avaliador\? \| O avaliador nº UDI-002 sai deste pedido e não volta a aparecer na lista\. \| A proposta dele é descartada: R\$ 380\.00 · laudo em 5 dias\. \| Não dá para desfazer\. \| Depois, você escolhe entre os 2 avaliadores disponíveis em Uberlândia\./);
  // O botão de um clique saiu: o texto "Escolher outro avaliador" só existe dentro da confirmação.
  assert.doesNotMatch(r.html, /<button>Escolher outro avaliador<\/button>/);
  assert.match(r.html, /<button>Aceitar valor e prazo<\/button>/);
});

test("E1100: um só avaliador na cidade — o aviso de que o pedido fica aguardando vem antes do clique", async () => {
  const r = await renderizar({ chave: true, isTeste: false, pedido: COM_PROPOSTA, outros: 0 });
  assert.match(r.html, /data-testid="troca-harness" data-pedido="ped1" data-sem-outro="1"/);
  assert.match(r.html, /Atenção: não há outro avaliador disponível em Uberlândia agora\. Se você descartar, o pedido fica aguardando/);
});

test("E1100: sem proposta viva não há troca (aguardando a resposta do avaliador, ou proposta já aceita)", async () => {
  const semProposta = await renderizar({ chave: true, isTeste: false, pedido: { ...COM_PROPOSTA, valor_proposto: null, prazo_proposto_dias: null, proposta_em: null }, outros: 2 });
  assert.equal(semProposta.outrosChamado, false);
  assert.doesNotMatch(semProposta.html, /troca-harness/);
  const aceita = await renderizar({ chave: true, isTeste: false, pedido: { ...COM_PROPOSTA, proposta_aceita_em: "2026-11-22T13:00:00Z" }, outros: 2 });
  assert.equal(aceita.outrosChamado, false);
  assert.doesNotMatch(aceita.html, /troca-harness/);
});

test("E1100: o pedido de volta à escolha leva o aviso de depois da troca (com lista, ou aguardando)", async () => {
  const comLista = await renderizar({ chave: true, isTeste: false });
  assert.match(comLista.html, /data-testid="depois-harness" data-pedido="ped1" data-aguardando="0"/);
  const aguardando = await renderizar({ chave: true, isTeste: false, pedido: { aguardando_avaliador: true } });
  assert.match(aguardando.html, /data-testid="depois-harness" data-pedido="ped1" data-aguardando="1"/);
  const designado = await renderizar({ chave: true, isTeste: false, pedido: COM_PROPOSTA, outros: 1 });
  assert.doesNotMatch(designado.html, /depois-harness/);
});
