/*
  E1205 (ORDEM-DUET-979 e 1012) — a varredura do contrato sem taxa reservada.
  O furo: a reserva da taxa (cobrancas_fechamento, tipo "comissao") depende de a tela chamar /api/comissao DEPOIS do
  registo do contrato; fechar a aba entre os dois passos deixaria um contrato sem taxa reservada. Em produção, nenhuma
  vítima observada (ORDEM-979): os 16 contratos sem registo têm todos proposta_id nulo (massa semeada/legada).
  O desenho decidido (ORDEM-1012): uma rotina de hora em hora procura contratos COM proposta ligada, SEM o registo da
  taxa, com mais de 30 minutos. NÃO cobra nada: o contrato entra na fila da Central ("Contrato sem taxa reservada",
  com o VN-CT, a proposta e a data) e o dono recebe um aviso com a ligação para o assistente daquela estadia. Um aviso
  por contrato, nunca repetido. Contratos sem proposta ficam fora.
  Roda: node --test src/lib/fechamento/e1205-contrato-sem-taxa.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MINUTOS_SEM_TAXA, assuntoDoAvisoSemTaxa, contratosSemTaxa, corpoDoAvisoSemTaxa, hrefAssistenteDaEstadia, linhaCentralSemTaxa, TEXTOS_SEM_TAXA } from "./contratos-sem-taxa.ts";
import { FILTROS_CENTRAL } from "../admin/central-pendencias.ts";
import { fonteSemComentarios } from "../fonte-sem-comentarios.ts";
import { categoriaDoEvento } from "../../config/matriz-notificacoes.ts";

const AGORA = new Date("2026-11-26T12:00:00Z");
const ha = (min: number) => new Date(AGORA.getTime() - min * 60_000).toISOString();
const C = (id: string, extra: Partial<{ lead_id: string; proposta_id: string | null; created_at: string; status: string }> = {}) => ({
  id, lead_id: `lead-${id}`, proposta_id: `orc-${id}`, created_at: ha(45), status: "ativo", ...extra,
});

test("E1205 (1): entra só o contrato com proposta, sem a reserva da taxa dessa proposta, com mais de 30 minutos", () => {
  assert.equal(MINUTOS_SEM_TAXA, 30);
  const contratos = [
    C("a"), // com proposta, sem reserva, 45 min → entra
    C("b"), // com a reserva da comissão → fora
    C("c", { proposta_id: null }), // sem proposta (legado/semeado) → fora do âmbito
    C("d", { created_at: ha(29) }), // ainda dentro dos 30 minutos → fora
    C("e", { created_at: ha(30) }), // exatamente 30 → entra
    C("f"), // reserva de OUTRA proposta da mesma candidatura → entra (a chave inclui a proposta)
  ];
  const reservas = [
    { lead_id: "lead-b", tipo: "comissao", proposta_id: "orc-b" },
    { lead_id: "lead-f", tipo: "comissao", proposta_id: "orc-outra" },
    { lead_id: "lead-a", tipo: "contrato", proposta_id: "orc-a" }, // a reserva da GERAÇÃO não é a taxa
  ];
  assert.deepEqual(contratosSemTaxa(contratos, reservas, AGORA).map((c) => c.id), ["a", "e", "f"]);
});

test("E1205 (1b, ajuste B do coordenador — ORDEM-DUET-1041): só o contrato ATIVO entra; cancelado, concluído e encerrado ficam fora", () => {
  // Um contrato CANCELADO com proposta e sem taxa há 31 minutos não gera aviso nem item na Central.
  const fora = ["cancelado", "concluido", "encerrado_sem_renovacao", "encerrado_em_acerto"].map((status) => C(status, { status, created_at: ha(31) }));
  assert.deepEqual(contratosSemTaxa([...fora, C("ativo", { created_at: ha(31) })], [], AGORA).map((c) => c.id), ["ativo"]);
  // A fonte única das duas leituras (a rotina e a Central) filtra na consulta.
  const srv = fonteSemComentarios(readFileSync("src/lib/data/contratos-sem-taxa-servidor.ts", "utf8"));
  assert.match(srv, /from\("contratos"\)\.select\("id, lead_id, proposta_id, created_at, property_id, status"\)\.eq\("status", "ativo"\)\.not\("proposta_id", "is", null\)/);
});

test("E1205 (2): o item da Central diz o VN-CT, a proposta e a data; leva ao contrato no admin; nada de cobrança", () => {
  assert.ok(FILTROS_CENTRAL.some((f) => f.chave === "contratos_sem_taxa" && f.rotulo === TEXTOS_SEM_TAXA.tituloCentral && f.lado === "equipe"));
  const l = linhaCentralSemTaxa(
    { id: "8f2c11aa-0000-0000-0000-000000000000", lead_id: "lead-a", proposta_id: "orc-a", created_at: "2026-11-25T10:00:00Z", status: "ativo" },
    { numeroProposta: "ORC-2026-0015", teste: false },
  );
  assert.equal(l.filtro, "contratos_sem_taxa");
  assert.equal(l.titulo, "Contrato sem taxa reservada");
  assert.equal(l.detalhe, "VN-CT-8F2C11AA · ORC-2026-0015 · 25/11/2026");
  assert.equal(l.desde, "2026-11-25T10:00:00Z");
  assert.equal(l.acao.href, "/admin/contratos/8f2c11aa-0000-0000-0000-000000000000");
  assert.equal(l.teste, false);
});

test("E1205 (3): o aviso ao dono leva ao assistente DAQUELA estadia e nomeia o contrato e a proposta", () => {
  assert.equal(hrefAssistenteDaEstadia("lead-a", "orc-a"), "/dashboard/fechamento?c=lead-a&p=orc-a");
  assert.equal(
    corpoDoAvisoSemTaxa("8f2c11aa-0000-0000-0000-000000000000", "ORC-2026-0015")("Dora"),
    "Olá, Dora. O contrato VN-CT-8F2C11AA (proposta ORC-2026-0015) foi gerado, mas o fechamento não terminou: falta a etapa da taxa de serviço. Abra o fechamento da estadia para concluir.",
  );
  // Os textos aprovados pelo coordenador (resposta à ORDEM-DUET-1018, aplicados na ORDEM-1020).
  assert.equal(assuntoDoAvisoSemTaxa("Apto Santa Mônica"), "Falta concluir o fechamento — Apto Santa Mônica");
  assert.equal(TEXTOS_SEM_TAXA.ctaAviso, "Concluir o fechamento");
  assert.equal(TEXTOS_SEM_TAXA.tituloCentral, "Contrato sem taxa reservada");
});

test("E1205 (4): a rotina — de hora em hora, sem cobrar, um aviso por contrato, e regista o caso real", () => {
  const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as { crons: { path: string; schedule: string }[] };
  const cron = vercel.crons.find((c) => c.path === "/api/cron/contratos-sem-taxa");
  assert.ok(cron, "a rotina está no vercel.json");
  assert.match(cron!.schedule, /^\d{1,2} \* \* \* \*$/, "de hora em hora");
  const rota = fonteSemComentarios(readFileSync("src/app/api/cron/contratos-sem-taxa/route.ts", "utf8"));
  assert.match(rota, /request\.headers\.get\("authorization"\) !== `Bearer \$\{segredo\}`/);
  assert.match(rota, /avisarContratosSemTaxa\(admin, agora\)/);
  const srv = fonteSemComentarios(readFileSync("src/lib/data/contratos-sem-taxa-servidor.ts", "utf8"));
  // Não cobra nada: nenhuma chamada de cobrança nem escrita na reserva da taxa.
  assert.doesNotMatch(srv, /\/api\/comissao|criarCobranca|cobrarTaxa|asaas/i);
  assert.doesNotMatch(srv, /from\("cobrancas_fechamento"\)\.(insert|update|upsert|delete)/);
  // Um aviso por contrato: procura o aviso já gravado (qualquer estado) antes de avisar.
  assert.match(srv, /from\("avisos"\)\.select\("ref_id"\)\.eq\("evento", "contrato_sem_taxa"\)\.in\("ref_id", /);
  assert.match(srv, /event: "contrato_sem_taxa"/);
  // ORDEM-DUET-1017 §3: a âncora (o aviso no sino) grava-se ANTES do e-mail; sem âncora, nada sai (tenta na hora seguinte).
  assert.match(srv, /const ancorado = await gravarAviso\(\{ usuarioId: c\.donoId, evento: "contrato_sem_taxa", papel: "dono", refId: c\.id, url: hrefAssistenteDaEstadia\(c\.lead_id, c\.proposta_id\) \}\);\s*if \(!ancorado\) continue;/);
  assert.ok(srv.indexOf("gravarAviso({") < srv.indexOf("notify({"), "a âncora vem antes do envio");
  assert.match(srv, /refId: c\.id/);
  assert.match(srv, /pushUrl: hrefAssistenteDaEstadia\(c\.lead_id, c\.proposta_id\)/);
  assert.match(srv, /body: corpoDoAvisoSemTaxa\(c\.id, c\.numeroProposta\)/);
  assert.match(srv, /subject: assuntoDoAvisoSemTaxa\(c\.imovel\)/);
  // A regra do desenho: um caso real fica registado (a decisão vira — a reserva passa para dentro da ação do contrato).
  assert.match(srv, /console\.warn\("\[E1205\] caso real/);
});

test("E1205 (5): a Central lê a mesma regra (uma fonte) e o aviso existe no catálogo, só por e-mail e sino", () => {
  const central = fonteSemComentarios(readFileSync("src/lib/data/central-pendencias.ts", "utf8"));
  assert.match(central, /lerContratosSemTaxa\(admin, agora\)/);
  const eventos = readFileSync("src/lib/notifications/eventos-email.ts", "utf8");
  assert.match(eventos, /\| "contrato_sem_taxa"/);
  assert.match(eventos, /contrato_sem_taxa: \{ subject: TEXTOS_SEM_TAXA\.assuntoAviso,/);
  // ORDEM-DUET-1039: a categoria do aviso é "decisao" — a que o notify nunca desliga pela preferência da pessoa.
  assert.equal(categoriaDoEvento("contrato_sem_taxa"), "decisao");
});
