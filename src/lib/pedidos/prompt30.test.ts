/*
  Prompt 30 — pedido de moradia completo: validade de 30 dias, campos novos, abas do dono, portas da busca e as guardas
  (sem WhatsApp, sem window.confirm, contato nunca no cartão do dono).
  Roda: node --test src/lib/pedidos/prompt30.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  BAIRROS_MAX,
  QUALQUER_BAIRRO,
  TEXTO_AVISO_RENOVAR,
  deveAvisarRenovar,
  expiraEmPedido,
  dataPedidoBR,
  textoBairros,
  textoFaixaValor,
  textoNecessidades,
  textoQuartos,
  validarCamposNovos,
} from "./campos.ts";
import { ABAS_DONO, MENSAGEM_OFERTA_PADRAO, abaDoPedido } from "./mural-dono.ts";
import { detectarContato } from "./pedidos.ts";
import { MIN_REAIS_SEM_CARTAO, TEXTO_CARTAO_PEDIDO, mostrarCartaoPedido, semExemplosQuandoHaReal } from "../busca/exemplos-e-pedido.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("item 2: validade de 30 dias e nunca antes da data de entrada", () => {
  // Entrada 01/03/2027 publicada em 18/10/2026 → não vence antes de 01/03/2027.
  assert.equal(dataPedidoBR(expiraEmPedido("2027-03-01", "2026-10-18T15:00:00Z")), "01/03/2027");
  // Entrada próxima: vale 30 dias depois de publicar.
  assert.equal(dataPedidoBR(expiraEmPedido("2026-10-25", "2026-10-18T15:00:00Z")), "17/11/2026");
  // Renovar recomeça os 30 dias.
  assert.equal(dataPedidoBR(expiraEmPedido("2026-10-25", "2026-11-15T15:00:00Z")), "15/12/2026");
  const sql = ler("supabase/migrations/0184_pedido_moradia_completo.sql");
  assert.match(sql, /coalesce\(p_base, now\(\)\) \+ interval '30 days'/);
  assert.match(sql, /\(p_data_inicio::timestamp \+ time '23:59:59'\) at time zone 'America\/Sao_Paulo'/);
  assert.match(sql, /set expira_em = public\.pedido_expira_calculado\(data_inicio, coalesce\(renovado_em, criado_em\)\)\s+where status in \('ativo', 'pausado'\)/);
});

test("item 2: aviso 5 dias antes ('Ainda procurando? Renove com um clique'), uma vez por ciclo", () => {
  const agora = new Date("2026-11-10T12:00:00Z");
  const base = { status: "ativo", expiraEm: "2026-11-14T12:00:00Z", avisoRenovarEm: null, renovadoEm: null };
  assert.equal(deveAvisarRenovar(base, agora), true);
  assert.equal(deveAvisarRenovar({ ...base, expiraEm: "2026-11-20T12:00:00Z" }, agora), false, "faltam mais de 5 dias");
  assert.equal(deveAvisarRenovar({ ...base, avisoRenovarEm: "2026-11-09T12:00:00Z" }, agora), false, "já avisou");
  assert.equal(deveAvisarRenovar({ ...base, avisoRenovarEm: "2026-10-01T12:00:00Z", renovadoEm: "2026-10-15T12:00:00Z" }, agora), true, "novo ciclo");
  assert.equal(deveAvisarRenovar({ ...base, status: "pausado" }, agora), false);
  assert.equal(TEXTO_AVISO_RENOVAR, "Ainda procurando? Renove com um clique");
  assert.match(ler("src/lib/notifications/eventos-email.ts"), /pedido_expirando: \{ subject: "Ainda procurando\? Renove com um clique"/);
});

test("item 2: contrato da Viva assinado pelas duas partes fecha o pedido como 'atendido'", () => {
  const sql = ler("supabase/migrations/0184_pedido_moradia_completo.sql");
  assert.match(sql, /new\.assinado_proprietario_em is not null and new\.assinado_inquilino_em is not null/);
  assert.match(sql, /set status = 'atendido'\s+where inquilino_id = new\.tenant_id and status in \('ativo', 'pausado'\)/);
});

test("item 3: campos novos validados no servidor", () => {
  const ok = validarCamposNovos(
    { bairros: ["Santa Mônica", "santa monica", " Centro ", "Umuarama"], quartosMin: 2, orcamentoMin: 2500, necessidades: ["home_office", "garagem"], portePet: "medio" },
    { orcamentoMax: 3500, pets: true },
  );
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.deepEqual(ok.valor.bairros, ["Santa Mônica", "Centro", "Umuarama"], "repetido (sem acento) sai");
    assert.equal(ok.valor.portePet, "medio");
    assert.equal(ok.valor.quartosMin, 2);
  }
  assert.equal(validarCamposNovos({ bairros: ["A1", "B2", "C3", "D4"] }, { orcamentoMax: 3000, pets: false }).ok, false, `até ${BAIRROS_MAX} bairros`);
  assert.equal(validarCamposNovos({ orcamentoMin: 4000 }, { orcamentoMax: 3000, pets: false }).ok, false, "mínimo ≤ máximo");
  assert.equal(validarCamposNovos({ necessidades: ["piscina"] }, { orcamentoMax: 3000, pets: false }).ok, false);
  assert.equal(validarCamposNovos({ quartosMin: 7 }, { orcamentoMax: 3000, pets: false }).ok, false);
  const semPet = validarCamposNovos({ portePet: "grande" }, { orcamentoMax: 3000, pets: false });
  assert.ok(semPet.ok && semPet.valor.portePet === null, "porte só com pet");
  assert.equal(textoFaixaValor(2500, 3500), "R$ 2.500 a R$ 3.500");
  assert.equal(textoFaixaValor(null, 3500), "até R$ 3.500");
  assert.equal(textoQuartos(0), "Estúdio");
  assert.equal(textoQuartos(3), "3 ou mais");
  assert.equal(textoBairros([]), QUALQUER_BAIRRO);
  assert.deepEqual(textoNecessidades(["aceita_dividir", "acessibilidade"]), ["Aceito dividir", "Acessibilidade"]);
  // Bairro com telefone é barrado como o resto do texto do pedido.
  assert.equal(detectarContato("Centro 34 99999-1234"), "telefone");
});

test("item 3: a compatibilidade usa todos os campos novos", () => {
  const sql = ler("supabase/migrations/0184_pedido_moradia_completo.sql");
  for (const r of [
    /ped\.quartos_min is null or ped\.quartos_min = 0 or coalesce\(im\.bedrooms, 0\) >= ped\.quartos_min/,
    /cardinality\(ped\.bairros\) = 0/,
    /'home_office' = any \(ped\.necessidades\) or im\.tem_home_office/,
    /'garagem' = any \(ped\.necessidades\) or im\.tem_garagem/,
    /'mobiliado_completo' = any \(ped\.necessidades\) or im\.tem_mobiliado/,
    /'acessibilidade' = any \(ped\.necessidades\) or im\.tem_acessibilidade/,
    /'aceita_dividir' = any \(ped\.necessidades\) or coalesce\(im\.property_type, ''\) <> 'quarto'/,
    /im\.porte_aceito >= case ped\.porte_pet when 'pequeno' then 1 when 'medio' then 2 else 3 end/,
    /when f\.fixas and f\.r4 and f\.r5 and f\.r6 then 'compativel'/,
  ])
    assert.match(sql, r);
  // compativeis_ao_publicar sai da mesma função (publicar e editar).
  const compat = ler("src/lib/data/pedidos-compat.ts");
  assert.match(compat, /update\(\{ compativeis_ao_publicar: compat\.length \}\)/);
  assert.match(ler("src/lib/data/pedidos-actions.ts"), /compativeis = \(await avisarCompativeisDoPedido\(pedidoId\)\)\.compativeis/);
});

test("item 4: excluir some para os donos, avisa respostas em andamento e deixa o histórico só para a equipe", () => {
  const sql = ler("supabase/migrations/0184_pedido_moradia_completo.sql");
  assert.match(sql, /'removido_admin', 'excluido'/);
  assert.match(sql, /if old\.status = 'excluido' and new\.status is distinct from old\.status then/);
  assert.match(sql, /where p\.status = 'ativo' and p\.expira_em > now\(\)/, "o mural só lista ativos");
  const acoes = ler("src/lib/data/pedidos-actions.ts");
  assert.match(acoes, /update\(\{ status: "excluido", excluido_em:/);
  assert.match(acoes, /\.in\("status", \["enviada", "vista", "aceita_para_conversa"\]\)/);
  assert.match(acoes, /event: "pedido_encerrado"/);
  assert.match(acoes, /\.neq\("status", "excluido"\)/, "a lista do inquilino não mostra o excluído");
  // Confirmação na página, nunca window.confirm/alert.
  for (const f of ["src/app/(dashboard)/dashboard/pedidos/pedidos-client.tsx", "src/app/(dashboard)/dashboard/pedidos-cidade/pedidos-dono-client.tsx", "src/app/(dashboard)/admin/pedidos/chave-sms.tsx"]) {
    assert.doesNotMatch(ler(f), /window\.confirm|\balert\(|\bconfirm\(/, f);
  }
  assert.match(ler("src/app/(dashboard)/dashboard/pedidos/pedidos-client.tsx"), /data-testid="pedido-excluir-confirmacao"/);
});

test("item 5: abas do dono e a oferta com mensagem padrão (sem contato)", () => {
  assert.deepEqual(ABAS_DONO.map((a) => a.rotulo), ["Novos para você", "Respondidos", "Ignorados"]);
  assert.equal(abaDoPedido({ respondido: false, ignorado: false }), "novos");
  assert.equal(abaDoPedido({ respondido: true, ignorado: true }), "respondidos");
  assert.equal(abaDoPedido({ respondido: false, ignorado: true }), "ignorados");
  assert.equal(detectarContato(MENSAGEM_OFERTA_PADRAO), null);
  // O cartão do dono nunca recebe contato; nome e foto só depois do aceite.
  const acoes = ler("src/lib/data/pedidos-actions.ts");
  const tipo = acoes.slice(acoes.indexOf("export interface PedidoParaDono"), acoes.indexOf("export async function getPedidosParaProprietario"));
  assert.doesNotMatch(tipo, /email:|phone|telefone:|whatsapp|inquilino_id/i);
  assert.match(acoes, /inquilino: minha\?\.status === "aceita_para_conversa" && inqId \? perfis\.get\(inqId\) \?\? null : null/);
  assert.match(acoes, /supabase\.rpc\("pedidos_mural"\)/);
});

test("item 6: exemplos somem com imóvel real; menos de 3 reais → cartão do pedido", () => {
  const ehEx = (x: { id: string }) => x.id.startsWith("ube-");
  assert.deepEqual(semExemplosQuandoHaReal([{ id: "ube-1" }, { id: "r1" }], ehEx).map((x) => x.id), ["r1"]);
  assert.deepEqual(semExemplosQuandoHaReal([{ id: "ube-1" }, { id: "ube-2" }], ehEx).map((x) => x.id), ["ube-1", "ube-2"]);
  assert.equal(MIN_REAIS_SEM_CARTAO, 3);
  assert.equal(mostrarCartaoPedido([{ id: "r1" }, { id: "r2" }, { id: "ube-1" }], ehEx), true);
  assert.equal(mostrarCartaoPedido([{ id: "r1" }, { id: "r2" }, { id: "r3" }], ehEx), false);
  assert.equal(TEXTO_CARTAO_PEDIDO, "Não achou? Publique um pedido e os proprietários vêm até você");
  const busca = ler("src/app/(public)/buscar/search-client.tsx");
  assert.match(busca, /data-testid="busca-publicar-pedido-topo"/);
  assert.match(busca, /data-testid="busca-publicar-pedido"/);
  assert.match(busca, /data-testid="busca-cartao-pedido"/);
  assert.match(ler("src/app/(public)/page.tsx"), /Publicar pedido de moradia/);
  assert.match(ler("src/config/menu-por-papel.ts"), /rotulo: "Publicar pedido de moradia", icone: "pedidos", href: "\/pedidos\/novo"/);
});

test("item 7: admin com nome curto, entrada, faixa, bairros, selos e nº de respostas; fórmulas escritas", () => {
  const cli = ler("src/app/(dashboard)/admin/pedidos/admin-pedidos-client.tsx");
  for (const r of [/Inquilino · motivo · cidade/, />Entrada</, /Faixa · bairros/, />Selos</, />Respostas</, /data-testid="formulas-pedidos"/, /Com compatível ao publicar = /])
    assert.match(cli, r);
  assert.match(ler("src/app/(dashboard)/admin/pedidos/page.tsx"), /colunasPedidosAdmin\(admin/);
});

test("item 8: sem 'Avisar por WhatsApp' e sem envio por WhatsApp dos avisos de pedido e atendimento", () => {
  const raiz = new URL("../../", import.meta.url).pathname;
  const ruins: string[] = [];
  const andar = (d: string) => {
    for (const n of readdirSync(d)) {
      const c = join(d, n);
      if (statSync(c).isDirectory()) andar(c);
      else if (/\.(ts|tsx)$/.test(n) && !/\.test\.ts$/.test(n) && /Avisar por WhatsApp|Avisos por WhatsApp|notif_whatsapp: prefs/.test(readFileSync(c, "utf8"))) ruins.push(c);
    }
  };
  andar(raiz);
  assert.deepEqual(ruins, []);
  assert.doesNotMatch(ler("src/lib/data/pedidos-actions.ts"), /phone: r\.notif_whatsapp|notif_whatsapp/);
  assert.match(ler("src/lib/atendimento/servidor.ts"), /phone: undefined,/);
});

test("chave SMS_ATIVO: lida no servidor de UMA linha do banco; o passo para ligar está na tela da equipe", () => {
  const leitura = ler("src/lib/data/chave-sms.ts");
  assert.match(leitura, /from\("chaves_plataforma"\)\.select\("ligada, ligada_em"\)\.eq\("chave", "SMS_ATIVO"\)/);
  const admin = ler("src/lib/data/pedidos-admin.ts");
  assert.match(admin, /export async function definirChaveSms\(ligar: boolean\)/);
  assert.match(admin, /event: "pedido_confirmar_telefone"/);
  assert.match(admin, /ehAdmin\(supabase, user\.id\)/);
});
