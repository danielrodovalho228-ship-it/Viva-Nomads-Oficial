/* Roda: node --test src/lib/admin/decisoes-admin.test.ts — Prompt 46: "Hoje você tem N decisões" no /admin. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { DECISOES_ADMIN, avisoSemLeitura, haQuantoTempo, montarDecisoesAdmin, tituloDecisoesAdmin } from "./decisoes-admin.ts";

test("as 6 decisões do Prompt 46 existem, cada uma com botão e lista do admin", () => {
  const chaves = DECISOES_ADMIN.map((d) => d.chave);
  for (const k of ["documentos_pendentes", "chamados_p1", "chamados_p2", "parceiros_para_aprovar", "encerramentos", "pedidos_parceiro_sem_resposta", "falhas_documento", "backup"]) {
    assert.ok(chaves.includes(k as never), k);
  }
  for (const d of DECISOES_ADMIN) {
    assert.match(d.href, /^\/admin(\/|\?|#|$)/, `${d.chave} leva a uma tela do admin`);
    assert.ok(d.acao.length > 0 && d.acao.length <= 16, `${d.chave}: verbo curto no botão`);
    assert.doesNotMatch(`${d.um} ${d.varios}`, /comiss|aluguel|vistoria|garantia/i, "vocabulário público");
  }
  assert.equal(new Set(chaves).size, chaves.length, "sem chave repetida");
});

test("só entram linhas com n > 0; N é a soma; ordem de urgência (P1 antes de tudo)", () => {
  const r = montarDecisoesAdmin({
    documentos_pendentes: { n: 3, detalhe: "mais antigo há 5 h" },
    chamados_p1: { n: 1 },
    chamados_p2: { n: 0 },
    backup: { n: 1, detalhe: "A última cópia falhou." },
    encerramentos: { n: 2 },
    parceiros_para_aprovar: { n: 0 },
    pedidos_parceiro_sem_resposta: { n: 0 },
    falhas_documento: { n: 0 },
    chamados_urgentes_sem_resposta: { n: 0 },
    candidaturas_sem_resposta_48h: { n: 0 },
    comissoes_vencidas: { n: 0 },
    pedidos_sem_resposta_expirando: { n: 0 },
    manutencao_fora_prazo: { n: 0 },
    conforto_contestacoes: { n: 0 },
  });
  assert.equal(r.total, 7);
  assert.deepEqual(r.linhas.map((l) => l.chave), ["chamados_p1", "backup", "documentos_pendentes", "encerramentos"]);
  assert.equal(r.linhas[0].texto, "1 chamado P1 aberto");
  assert.equal(r.linhas[2].texto, "3 documentos na fila para conferir");
  assert.equal(r.linhas[2].detalhe, "mais antigo há 5 h");
  assert.deepEqual(r.semLeitura, []);
});

test("fonte que não foi lida não vira zero: fica em semLeitura e fora da soma", () => {
  const r = montarDecisoesAdmin({ chamados_p1: { n: 2 }, backup: null, documentos_pendentes: { n: null } });
  assert.equal(r.total, 2);
  assert.ok(r.semLeitura.includes("backup"));
  assert.ok(r.semLeitura.includes("documentos_pendentes"));
  assert.ok(r.semLeitura.includes("encerramentos"), "ausente também conta como não lido");
});

test("título: singular, plural e nenhum", () => {
  assert.equal(tituloDecisoesAdmin(0), "Nada pede sua decisão hoje");
  assert.equal(tituloDecisoesAdmin(1), "Hoje você tem 1 decisão");
  assert.equal(tituloDecisoesAdmin(12), "Hoje você tem 12 decisões");
});

test("há quanto tempo", () => {
  assert.equal(haQuantoTempo(null), null);
  assert.equal(haQuantoTempo(0.2), "há menos de 1 h");
  assert.equal(haQuantoTempo(5), "há 5 h");
  assert.equal(haQuantoTempo(72), "há 3 dias");
});

test("aviso de fila não lida diz o nome das filas", () => {
  assert.equal(avisoSemLeitura([]), null);
  assert.equal(avisoSemLeitura(["backup"]), "Não deu para ler agora: backup. Essa fila fica fora da conta.");
  assert.equal(avisoSemLeitura(["falhas_documento", "backup", "chamados_p1"]), "Não deu para ler agora: chamados P1, backup e recibos. Essas filas ficam fora da conta.");
});

test("Prompt 59: 'Manutenção fora do prazo' abre a lista; a contestação do padrão mínimo vem logo depois", () => {
  assert.deepEqual(DECISOES_ADMIN.slice(0, 2).map((d) => d.chave), ["manutencao_fora_prazo", "conforto_contestacoes"]);
  const r = montarDecisoesAdmin(Object.fromEntries(DECISOES_ADMIN.map((d) => [d.chave, { n: d.chave === "manutencao_fora_prazo" || d.chave === "chamados_p1" ? 1 : 0 }])));
  assert.deepEqual(r.linhas.map((l) => l.chave), ["manutencao_fora_prazo", "chamados_p1"]);
  assert.equal(r.linhas[0].texto, "1 manutenção fora do prazo de solução");
  assert.equal(r.linhas[0].href, "/admin/solicitacoes?fora_prazo=1");
});
