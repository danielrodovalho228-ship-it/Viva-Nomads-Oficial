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
function bancoFalso(isTeste: boolean, contaDoAvaliador: string | null = null) {
  const lidas: string[] = [];
  const dados: Linhas = {
    profiles: { is_teste: isTeste },
    properties: { id: "p1", owner_id: "u1", status: "active", city: "Uberlândia", bedrooms: 2 },
    vistoria_precos: [],
    vistoria_pedidos: [{ id: "ped1", status: "pedido", aguardando_avaliador: false, agendado_para: null, ocupado: false, concordancia_em: null, recebido_marcado_em: null, recebido_confirmado_em: null, valor_proposto: null, prazo_proposto_dias: null, proposta_em: null, proposta_aceita_em: null, teste: false, avaliadores_credenciamento: null }],
    vistoria_laudos: null,
    vistoria_bloqueios: [],
    avaliadores_credenciamento: [{ id: "a1", numero_credenciado: SEGREDO.numero, preco_proprio: 350, prazo_entrega_dias: 5, prazo_resposta_horas: 12, parceiros: { nome_publico: SEGREDO.nome, ...(contaDoAvaliador ? { user_id: contaDoAvaliador } : {}) } }],
  };
  const construtor = (tabela: string): unknown => {
    const b: Record<string, unknown> = {};
    for (const m of ["select", "eq", "in", "is", "order", "limit"]) b[m] = () => b;
    b.maybeSingle = async () => ({ data: Array.isArray(dados[tabela]) ? (dados[tabela] as unknown[])[0] ?? null : dados[tabela] ?? null, error: null });
    // E1096: com a conta do avaliador na massa, o bloco também lê a LISTA de contas (foto); o dublê devolve lista vazia.
    b.then = (ok: (v: unknown) => unknown) => ok({ data: contaDoAvaliador && tabela === "profiles" ? [] : dados[tabela] ?? [], error: null });
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

async function renderizar(opts: { chave: boolean; isTeste: boolean; contaDoAvaliador?: string; identidades?: string[] }) {
  const admin = bancoFalso(opts.isTeste, opts.contaDoAvaliador ?? null);
  const g = globalThis as unknown as { __VN: Record<string, unknown> };
  g.__VN = { chave: opts.chave, user: { id: "u1" }, admin, sugeridos: [{ id: "a1" }], sugeridosChamado: false, identidades: opts.identidades ?? [] };
  const { BlocoAvaliacaoDono } = (await import("./bloco-avaliacao-dono.tsx")) as { BlocoAvaliacaoDono: (p: { propertyId: string }) => Promise<unknown> };
  const arvore = await BlocoAvaliacaoDono({ propertyId: "p1" });
  const html = arvore ? renderToStaticMarkup(arvore as Parameters<typeof renderToStaticMarkup>[0]) : "";
  return { arvore, html, lidas: admin.lidas, sugeridosChamado: g.__VN.sugeridosChamado as boolean };
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
  // E1096 (ORDEM-DUET-453, asserção alterada): o título do bloco passou a ser "Escolher avaliador" (mockup), por isso a
  // palavra já não pode ser proibida em qualquer lugar; o que continua proibido é o BOTÃO "Escolher" e qualquer cartão.
  assert.doesNotMatch(r.html, /<button[^>]*>Escolher/);
  assert.doesNotMatch(r.html, /data-testid="avaliacao-sugerido"/);
});

test("controle (chave ligada): a lista aparece com conduta e 'avaliações feitas' — o teste não é vazio", async () => {
  const r = await renderizar({ chave: true, isTeste: false });
  assert.equal(r.sugeridosChamado, true);
  assert.ok(r.html.includes(SEGREDO.nome));
  assert.match(r.html, /conduta 4,5 · 7 avaliações feitas/);
  // E1096 (asserção alterada, pelo mesmo motivo): o controle exige o BOTÃO, não a palavra solta (que o título já traz).
  assert.match(r.html, /<button[^>]*>Escolher/);
});

// E1096 (ORDEM-DUET-453/460): o cartão da escolha conforme o mockup.
test("E1096: o cartão traz o título e o botão do mockup, as estrelas com a nota publicada e a frase do valor sob a lista", async () => {
  const r = await renderizar({ chave: true, isTeste: false });
  assert.match(r.html, /data-testid="avaliacao-escolha-titulo"[^>]*>Escolher avaliador</);
  assert.match(r.html, /<button>Escolher<\/button>/);
  assert.doesNotMatch(r.html, /Escolher este avaliador|Escolha o avaliador/);
  assert.match(r.html, /data-testid="avaliacao-sugerido-estrelas"[^>]*data-cheias="5"|data-cheias="5"[^>]*data-testid="avaliacao-sugerido-estrelas"/);
  assert.match(r.html, /data-testid="avaliacao-sugerido-reputacao"[^>]*>4,5 \(7 avaliações\)</);
  assert.doesNotMatch(r.html, /Novo na Viva/);
});

test("E1096: 'Identidade verificada pela Viva' no cartão só de quem tem a identidade confirmada", async () => {
  const sem = await renderizar({ chave: true, isTeste: false, contaDoAvaliador: "av1", identidades: [] });
  assert.ok(sem.html.includes(SEGREDO.nome), "o controle: o cartão aparece");
  assert.doesNotMatch(sem.html, /Identidade verificada pela Viva/);
  const com = await renderizar({ chave: true, isTeste: false, contaDoAvaliador: "av1", identidades: ["av1"] });
  assert.match(com.html, /data-testid="avaliacao-sugerido-identidade"[^>]*>Identidade verificada pela Viva</);
});
