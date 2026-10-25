/* Roda: node --test src/lib/admin/decisoes-admin.test.ts — Prompt 46: "Hoje você tem N decisões" no /admin. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { DECISOES_ADMIN, avisoSemLeitura, haQuantoTempo, juntarParcerias, montarDecisoesAdmin, tituloDecisoesAdmin } from "./decisoes-admin.ts";

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
    fotos_nivel: { n: 0 },
    chamados_fora_promessa: { n: 0 },
    parceiros_sem_resposta_1_dia: { n: 0 },
    verificacao_analise_humana: { n: 0 },
    correcoes_sem_dono: { n: 0 },
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
  assert.equal(r.linhas[0].texto, "1 manutenção fora do prazo");
  // Adendo 59.1: a fila virou filtro da Central de Pendências.
  assert.equal(r.linhas[0].href, "/admin/pendencias?filtro=manutencao_fora_prazo");
});

test("Prompt 50: chamado fora da promessa vem antes de P1; parceria sem resposta em 1 dia útil e verificação na fila humana", () => {
  const r = montarDecisoesAdmin({ chamados_p1: { n: 1 }, chamados_fora_promessa: { n: 2 }, parceiros_para_aprovar: { n: 1 }, parceiros_sem_resposta_1_dia: { n: 1 }, verificacao_analise_humana: { n: 1 } });
  assert.deepEqual(r.linhas.map((l) => l.chave).slice(0, 2), ["chamados_fora_promessa", "chamados_p1"]);
  assert.equal(r.linhas[0].texto, "2 chamados sem resposta de uma pessoa há mais de 24 h");
  assert.ok(r.linhas.some((l) => l.chave === "parceiros_para_aprovar" && l.href === "/admin/parceiros?aba=pendentes" && l.detalhe === "1 sem resposta há mais de 1 dia útil"));
  assert.ok(r.linhas.some((l) => l.chave === "verificacao_analise_humana" && l.href === "/admin/documentos#verificacao"));
});

test("Prompt 51: Correção de qualidade sem dono ou prazo vira decisão e abre o painel de qualidade", () => {
  const r = montarDecisoesAdmin({ correcoes_sem_dono: { n: 2 } });
  assert.equal(r.total, 2);
  assert.equal(r.linhas[0].texto, "2 Correções de qualidade sem dono ou prazo");
  assert.equal(r.linhas[0].href, "/admin/qualidade#correcoes");
});

test("E175: a parceria atrasada conta uma vez só — o total bate com a lista da aba Pendentes", () => {
  // 5 parcerias pendentes, 3 delas sem resposta há mais de 1 dia útil: eram 2 linhas (5 + 3 = 8), agora 1 linha de 5.
  const r = montarDecisoesAdmin({ parceiros_para_aprovar: { n: 5 }, parceiros_sem_resposta_1_dia: { n: 3, detalhe: "mais antigo há 2 dias" } });
  assert.equal(r.total, 5);
  assert.equal(r.linhas.length, 1);
  assert.equal(r.linhas[0].texto, "5 pedidos de parceria para aprovar");
  assert.equal(r.linhas[0].detalhe, "3 sem resposta há mais de 1 dia útil · mais antigo há 2 dias");
  assert.equal(r.linhas[0].acao, "Analisar");
  assert.ok(!DECISOES_ADMIN.some((d) => d.chave === "parceiros_sem_resposta_1_dia"), "sem a segunda linha");
  // Nenhuma atrasada: a linha das pendentes fica como era; atrasadas sem ler as pendentes: fica fora da conta (avisa).
  assert.equal(montarDecisoesAdmin({ parceiros_para_aprovar: { n: 2, detalhe: "mais antigo há 3 h" }, parceiros_sem_resposta_1_dia: { n: 0 } }).linhas[0].detalhe, "mais antigo há 3 h");
  const semLer = montarDecisoesAdmin({ parceiros_para_aprovar: { n: null }, parceiros_sem_resposta_1_dia: { n: 3 } });
  assert.equal(semLer.total, 0);
  assert.ok(semLer.semLeitura.includes("parceiros_para_aprovar"));
  assert.ok(!("parceiros_sem_resposta_1_dia" in juntarParcerias({ parceiros_para_aprovar: { n: 5 }, parceiros_sem_resposta_1_dia: { n: 3 } })));
});
