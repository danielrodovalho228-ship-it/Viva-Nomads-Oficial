import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FILTROS_CENTRAL, gravidadePeloPrazo, hrefCentral, montarCentral, textoPrazo, type LinhaCentral } from "./central-pendencias.ts";
import { DECISOES_ADMIN, montarDecisoesAdmin } from "./decisoes-admin.ts";

const AGORA = new Date("2026-10-23T12:00:00Z");
const h = (x: number) => new Date(AGORA.getTime() + x * 3_600_000).toISOString();
const linha = (o: Partial<LinhaCentral>): LinhaCentral => ({
  filtro: "conforto_abertas",
  id: Math.random().toString(36).slice(2),
  titulo: "Item",
  detalhe: null,
  desde: h(-5),
  prazoAte: null,
  gravidade: "media",
  acao: { rotulo: "Ver", href: "/admin" },
  teste: false,
  ...o,
});

test("Central: conta por filtro sem as contas de teste; teste aparece à parte; documentos contam pela quantidade", () => {
  const c = montarCentral(
    [
      linha({ filtro: "conforto_contestacoes", gravidade: "alta" }),
      linha({ filtro: "conforto_contestacoes", gravidade: "alta", teste: true }),
      linha({ filtro: "manutencao_fora_prazo", gravidade: "alta" }),
      linha({ filtro: "fotos_nivel", gravidade: "baixa" }),
      linha({ filtro: "documentos_pendentes", quantidade: 7 }),
    ],
    AGORA,
  );
  assert.equal(c.contagens.conforto_contestacoes, 1);
  assert.equal(c.contagens.documentos_pendentes, 7);
  assert.equal(c.total, 1 + 1 + 1 + 7);
  assert.equal(c.teste.length, 1);
  assert.equal(c.linhas.length, 4);
  for (const f of FILTROS_CENTRAL) assert.equal(typeof c.contagens[f.chave], "number");
});

test("Central: ordem por gravidade, depois prazo, depois idade; o filtro mostra só a fila pedida (a contagem é de todas)", () => {
  const c = montarCentral(
    [
      linha({ id: "baixa", gravidade: "baixa" }),
      linha({ id: "media-tarde", gravidade: "media", prazoAte: h(30) }),
      linha({ id: "media-cedo", gravidade: "media", prazoAte: h(2) }),
      linha({ id: "alta", gravidade: "alta", filtro: "manutencao_fora_prazo" }),
    ],
    AGORA,
  );
  assert.deepEqual(c.linhas.map((l) => l.id), ["alta", "media-cedo", "media-tarde", "baixa"]);
  const f = montarCentral(c.linhas, AGORA, "manutencao_fora_prazo");
  assert.deepEqual(f.linhas.map((l) => l.id), ["alta"]);
  assert.equal(f.total, 4);
});

test("Central conta igual ao topo de decisões: as filas do 59-A e as fotos de nível usam as contagens da Central", () => {
  const c = montarCentral([linha({ filtro: "manutencao_fora_prazo" }), linha({ filtro: "manutencao_fora_prazo" }), linha({ filtro: "conforto_contestacoes" }), linha({ filtro: "fotos_nivel" }), linha({ filtro: "fotos_nivel", teste: true })], AGORA);
  const d = montarDecisoesAdmin({
    manutencao_fora_prazo: { n: c.contagens.manutencao_fora_prazo },
    conforto_contestacoes: { n: c.contagens.conforto_contestacoes },
    fotos_nivel: { n: c.contagens.fotos_nivel },
  });
  const n = (k: string) => d.linhas.find((l) => l.chave === k)?.n ?? 0;
  assert.equal(n("manutencao_fora_prazo"), 2);
  assert.equal(n("conforto_contestacoes"), 1);
  assert.equal(n("fotos_nivel"), 1, "a conta de teste não entra");
  // As linhas do topo abrem a Central já filtrada (as filas do 59-A não são mais telas separadas).
  for (const k of ["manutencao_fora_prazo", "conforto_contestacoes", "fotos_nivel"] as const) assert.equal(DECISOES_ADMIN.find((x) => x.chave === k)!.href, hrefCentral(k));
  // O carregador do topo lê a Central (uma fonte de números).
  const fonte = readFileSync(new URL("../data/admin-decisoes.ts", import.meta.url), "utf8");
  assert.match(fonte, /centralDePendencias\(admin, agora\)/);
  assert.match(fonte, /central\.contagens\.manutencao_fora_prazo/);
  assert.doesNotMatch(fonte, /manutencaoForaDoPrazo\(|contestacoesConforto\(/);
});

test("gravidade e prazo: vencido = alta; perto do fim sobe a baixa para média; texto curto do prazo", () => {
  assert.equal(gravidadePeloPrazo(h(-1), AGORA, "baixa"), "alta");
  assert.equal(gravidadePeloPrazo(h(10), AGORA, "baixa"), "media");
  assert.equal(gravidadePeloPrazo(h(100), AGORA, "baixa"), "baixa");
  assert.equal(gravidadePeloPrazo(null, AGORA, "media"), "media");
  assert.equal(textoPrazo(h(5), AGORA), "vence em 5 h");
  assert.equal(textoPrazo(h(-72), AGORA), "venceu há 3 dias");
  assert.equal(textoPrazo(null, AGORA), null);
});
