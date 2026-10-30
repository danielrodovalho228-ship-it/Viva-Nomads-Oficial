/*
  E264-B — e-mails proativos: cartões, agrupamento, sem repetição, teto, silêncio, descadastro e a migração 0262.
  Roda: node --test src/lib/notifications/proativos.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cartaoImovel, cartaoPedido, fotoDoCartao, type ImovelDoCartao, type PedidoDoCartao } from "./cartoes-email.ts";
import { montarEmailProativo, type ItemProativo } from "./email-proativo.ts";
import {
  assinarDescadastro,
  cabeNoTeto,
  chaveProativo,
  comSugestoesDesligadas,
  conferirDescadastro,
  escolherLote,
  EVENTOS_PROATIVOS,
  eventoDoEnvio,
  MAX_CARTOES,
  podeEnviarProativo,
  urlsDescadastro,
} from "./proativos.ts";
import { montarNotificacao } from "./montar-email.ts";
import { cabecalhosDescadastro } from "./email.ts";
import { ROTULO_TOTAL_MES } from "../precos.ts";
import { CATEGORIAS_COM_INTERRUPTOR, categoriaDoEvento, eventoDesligadoPelaPessoa, ROTULO_CATEGORIA } from "../../config/matriz-notificacoes.ts";

const SITE = "https://vivanomads.com.br";
const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const FOTO = "https://esezeutgtycekfosxplk.supabase.co/storage/v1/object/public/property-photos/dono/foto.webp";
const imovel = (n: number): ImovelDoCartao => ({
  id: `aaaaaaaa-aaaa-4aaa-8aaa-00000000000${n}`,
  titulo: `Apto mobiliado ${n}`,
  bairro: "Santa Mônica",
  cidade: "Uberlândia",
  uf: "MG",
  totalMes: 3150,
  fotoCapa: FOTO,
});
const pedido: PedidoDoCartao = { id: "bbbbbbbb-bbbb-4bbb-8bbb-000000000001", cidade: "Uberlândia", uf: "MG", entrada: "2026-11-15", meses: 3, orcamento: 3200, pessoas: 2, pets: true };
const itensImovel = (n: number): ItemProativo[] => Array.from({ length: n }, (_, i) => ({ tipo: "imovel", imovel: imovel(i + 1) }));
const DESC = `${SITE}/avisos/desligar?u=x&t=y`;

test("cartão do imóvel: foto de capa real redimensionada, título, bairro e cidade, Total por mês (com contas) e 'Ver o imóvel'", () => {
  const c = cartaoImovel(SITE, imovel(1));
  assert.ok(c.html.includes(`${SITE}/_next/image?url=${encodeURIComponent(FOTO)}&amp;w=640&amp;q=70`) || c.html.includes(`${SITE}/_next/image?url=${encodeURIComponent(FOTO)}&w=640&q=70`));
  assert.match(c.html, /Apto mobiliado 1/);
  assert.match(c.html, /Santa Mônica, Uberlândia - MG/);
  assert.ok(c.html.includes(ROTULO_TOTAL_MES), "o rótulo da casa");
  assert.equal(ROTULO_TOTAL_MES, "Total por mês (com contas)");
  assert.match(c.html, /R\$ 3\.150/);
  assert.match(c.html, />Ver o imóvel</);
  assert.ok(c.html.includes(`${SITE}/imoveis/${imovel(1).id}`));
  assert.match(c.text, /Total por mês \(com contas\): R\$ 3\.150/);
  // Só foto do Storage público vira capa (nunca URL qualquer).
  assert.equal(fotoDoCartao(SITE, "https://evil.example.com/x.jpg"), null);
  assert.doesNotMatch(cartaoImovel(SITE, { ...imovel(2), fotoCapa: null }).html, /<img/);
  // Título com HTML é escapado.
  assert.doesNotMatch(cartaoImovel(SITE, { ...imovel(3), titulo: '<script>alert("x")</script>' }).html, /<script>/);
});

test("cartão do pedido: cidade, entrada e duração, orçamento, pessoas e pets — sem dado pessoal", () => {
  const c = cartaoPedido(pedido, { rotulo: "Responder ao pedido", url: `${SITE}/dashboard/pedidos-cidade?pedido=1` }, "Combina com “Apto 1”");
  for (const t of ["Uberlândia - MG", "15/11/2026 · 3 meses", "até R$ 3.200 por mês", ">2<", ">Sim<", "Responder ao pedido", "Combina com “Apto 1”"]) assert.ok(c.html.includes(t), t);
  assert.match(c.text, /Pets: Sim/);
  assert.doesNotMatch(c.html + c.text, /@|telefone|whatsapp|cpf/i);
});

test("os 5 e-mails saem com cartão no modelo único (assunto, abertura, cartões, descadastro)", () => {
  const casos: { evento: (typeof EVENTOS_PROATIVOS)[number]; itens: ItemProativo[]; cartao: string }[] = [
    { evento: "pedido_imovel_novo", itens: itensImovel(1), cartao: "imovel" },
    { evento: "saved_search_match", itens: itensImovel(1), cartao: "imovel" },
    { evento: "pedido_compativel", itens: [{ tipo: "pedido", pedido, urlBotao: `${SITE}/dashboard/pedidos-cidade` }], cartao: "pedido" },
    { evento: "pedido_resumo", itens: [1, 2].map((i) => ({ tipo: "pedido" as const, pedido: { ...pedido, id: `p${i}` }, urlBotao: `${SITE}/dashboard/pedidos-cidade` })), cartao: "pedido" },
    { evento: "pedido_expirando", itens: [{ tipo: "pedido", pedido, urlBotao: `${SITE}/dashboard/pedidos` }], cartao: "pedido" },
  ];
  assert.deepEqual(casos.map((c) => c.evento).sort(), [...EVENTOS_PROATIVOS].sort());
  for (const c of casos) {
    const m = montarEmailProativo({ siteUrl: SITE, evento: c.evento, itens: c.itens, descadastroUrl: DESC, diasParaExpirar: 4 });
    const e = montarNotificacao({ siteUrl: SITE, event: c.evento, nomeHtml: "Ana", nomeTexto: "Ana", subject: m.assunto, body: m.abertura, pushUrl: m.pushUrl, detailsHtml: m.detailsHtml, detailsText: m.detailsText });
    assert.ok(e.html.includes(`data-cartao="${c.cartao}"`), c.evento);
    assert.ok(e.html.includes("Não quero mais este tipo de e-mail"), c.evento);
    assert.ok(e.text.includes(`Não quero mais este tipo de e-mail: ${DESC}`), c.evento);
    assert.match(e.assunto, /· Viva Nomads$/);
    // Vocabulário da casa e nenhum dado do proprietário nem endereço exato (no corpo; o rodapé antigolpe cita o WhatsApp).
    assert.doesNotMatch(m.detailsHtml + m.detailsText + m.abertura("Ana") + m.assunto, /inquilino|hóspede|reserva|telefone|whatsapp|\bRua\b|\bAv\.|lat(itude)?=|lng=/i, c.evento);
  }
  // Urgência só com fato verdadeiro: os dias que faltam de verdade.
  assert.equal(montarEmailProativo({ siteUrl: SITE, evento: "pedido_expirando", itens: casos[4].itens, descadastroUrl: null, diasParaExpirar: 4 }).assunto, "Seu pedido de moradia expira em 4 dias");
  assert.equal(montarEmailProativo({ siteUrl: SITE, evento: "pedido_expirando", itens: casos[4].itens, descadastroUrl: null, diasParaExpirar: null }).assunto, "Seu pedido de moradia está perto de expirar");
});

test("agrupamento: 2 imóveis = 1 e-mail com 2 cartões; 5 imóveis = 1 e-mail com 3 cartões e 'Ver os 5 imóveis'", () => {
  const dois = montarEmailProativo({ siteUrl: SITE, evento: "pedido_imovel_novo", itens: itensImovel(2), descadastroUrl: DESC });
  assert.equal(dois.assunto, "2 imóveis combinam com o seu pedido");
  assert.equal(dois.cartoes, 2);
  assert.equal((dois.detailsHtml.match(/data-cartao="imovel"/g) ?? []).length, 2);
  assert.doesNotMatch(dois.detailsHtml, /Ver os \d/);
  const cinco = montarEmailProativo({ siteUrl: SITE, evento: "saved_search_match", itens: itensImovel(5), descadastroUrl: DESC });
  assert.equal(cinco.assunto, "5 imóveis combinam com a sua busca");
  assert.equal(cinco.cartoes, MAX_CARTOES);
  assert.equal((cinco.detailsHtml.match(/data-cartao="imovel"/g) ?? []).length, 3);
  assert.match(cinco.detailsHtml, /Ver os 5 imóveis →/);
  assert.match(cinco.detailsText, /Ver os 5 imóveis: https:\/\/vivanomads\.com\.br\/dashboard\/buscas/);
  // O pedido compatível com mais de um vira o resumo.
  assert.equal(eventoDoEnvio("pedido_compativel", 1), "pedido_compativel");
  assert.equal(eventoDoEnvio("pedido_compativel", 4), "pedido_resumo");
  assert.equal(montarEmailProativo({ siteUrl: SITE, evento: "pedido_resumo", itens: [], total: 4, descadastroUrl: null }).assunto, "4 pedidos de moradia combinam com os seus imóveis");
});

test("sem repetição: o caso de 23/10 (inquilino1 com dois pedidos que combinam com o mesmo imóvel) dá UMA linha na fila", () => {
  const inquilino1 = "11111111-1111-4111-8111-111111111111";
  const imovelNovo = "22222222-2222-4222-8222-222222222222";
  // Antes: um e-mail por pedido (chave pedido-imovel-novo:<pedido>), dois iguais no mesmo minuto. Agora: por (pessoa, imóvel).
  const pares = [
    { pedido: "bca576e6-ca3d-4d2b-be38-07f4c940f86e", inquilino: inquilino1, imovel: imovelNovo },
    { pedido: "a2462cd3-d879-470b-a216-68a7be2b6f7f", inquilino: inquilino1, imovel: imovelNovo },
  ];
  const chaves = new Set(pares.map((p) => chaveProativo(p.inquilino, "pedido_imovel_novo", p.imovel)));
  assert.equal(chaves.size, 1);
  // Outra pessoa, outro evento ou outro imóvel: outra chave.
  assert.notEqual(chaveProativo(inquilino1, "pedido_imovel_novo", imovelNovo), chaveProativo(inquilino1, "saved_search_match", imovelNovo));
  // O pedido que expira avisa uma vez por ciclo de validade.
  assert.notEqual(chaveProativo(inquilino1, "pedido_expirando", "p", "2026-11-01"), chaveProativo(inquilino1, "pedido_expirando", "p", "2026-12-01"));
  // A fila tem chave única no banco e o envio reserva as linhas antes de mandar (dois disparos não mandam o mesmo cartão).
  const mig = ler("supabase/migrations/0262_emails_proativos.sql");
  assert.match(mig, /chave text not null unique/);
  const srv = ler("src/lib/notifications/proativos-servidor.ts");
  assert.match(srv, /\.update\(\{ envio_id: envioId, enviado_em: agora\.toISOString\(\) \}\)[\s\S]*\.is\("enviado_em", null\)/);
  assert.match(ler("src/lib/data/pedidos-compat.ts"), /enfileirarProativo\(admin, \{ usuarioId: pedido\.inquilino_id, evento: "pedido_imovel_novo", refId: imovelId/);
  assert.doesNotMatch(ler("src/lib/data/pedidos-compat.ts"), /pedido-imovel-novo:/);
});

test("teto: no máximo 1 por dia (Brasília) e 3 por semana; o excedente espera o próximo envio; silêncio das 22h às 7h", () => {
  const agora = new Date("2026-10-30T15:00:00Z"); // 12h em Brasília
  assert.equal(cabeNoTeto([], agora), true);
  assert.equal(cabeNoTeto(["2026-10-30T11:00:00Z"], agora), false, "já saiu um hoje");
  assert.equal(cabeNoTeto(["2026-10-30T02:30:00Z"], agora), true, "23h30 de ontem em Brasília é ontem");
  assert.equal(cabeNoTeto(["2026-10-29T12:00:00Z", "2026-10-28T12:00:00Z"], agora), true, "2 na semana");
  assert.equal(cabeNoTeto(["2026-10-29T12:00:00Z", "2026-10-27T12:00:00Z", "2026-10-25T12:00:00Z"], agora), false, "3 na semana");
  assert.equal(cabeNoTeto(["2026-10-29T12:00:00Z", "2026-10-27T12:00:00Z", "2026-10-23T12:00:00Z"], agora), true, "o de 23/10 já saiu da janela de 7 dias");
  assert.equal(podeEnviarProativo([], new Date("2026-10-31T01:30:00Z")), "silencio", "22h30 em Brasília");
  assert.equal(podeEnviarProativo([], new Date("2026-10-30T09:59:00Z")), "silencio", "6h59 em Brasília");
  assert.equal(podeEnviarProativo(["2026-10-30T11:00:00Z"], agora), "teto");
  assert.equal(podeEnviarProativo([], agora), "ok");
  // O lote é o do pendente mais antigo; vão juntos todos os pendentes desse evento.
  const lote = escolherLote([
    { evento: "saved_search_match" as const, criado_em: "2026-10-30T10:00:00Z" },
    { evento: "pedido_imovel_novo" as const, criado_em: "2026-10-30T09:00:00Z" },
    { evento: "pedido_imovel_novo" as const, criado_em: "2026-10-30T11:00:00Z" },
  ]);
  assert.equal(lote?.evento, "pedido_imovel_novo");
  assert.equal(lote?.itens.length, 2);
  // Decisão e transacional não passam pela fila (só os 4 proativos entram nela).
  assert.match(ler("supabase/migrations/0262_emails_proativos.sql"), /evento in \('pedido_imovel_novo', 'saved_search_match', 'pedido_compativel', 'pedido_expirando'\)/);
});

test("categoria 'Sugestões e novidades': os 5 eventos, desligável; descadastro desliga SÓ ela", () => {
  for (const e of EVENTOS_PROATIVOS) assert.equal(categoriaDoEvento(e), "sugestoes", e);
  assert.ok((CATEGORIAS_COM_INTERRUPTOR as readonly string[]).includes("sugestoes"));
  assert.equal(ROTULO_CATEGORIA.sugestoes, "Sugestões e novidades");
  const desligadas = comSugestoesDesligadas(["mensagens"]);
  assert.deepEqual(desligadas, ["mensagens", "sugestoes"]);
  assert.deepEqual(comSugestoesDesligadas(desligadas), desligadas, "sem repetir");
  for (const e of EVENTOS_PROATIVOS) assert.equal(eventoDesligadoPelaPessoa(e, ["sugestoes"]), true, e);
  for (const e of ["proposta_recebida", "new_message", "checkin_lembrete", "parceiro_pedido_novo", "verification_ready"]) {
    assert.equal(eventoDesligadoPelaPessoa(e, ["sugestoes"]), false, e);
  }
});

test("descadastro de um clique: link assinado sem login, List-Unsubscribe + List-Unsubscribe-Post", () => {
  const u = "33333333-3333-4333-8333-333333333333";
  const t = assinarDescadastro(u, "segredo");
  assert.ok(conferirDescadastro(u, t, "segredo"));
  assert.equal(conferirDescadastro(u, t, "outro"), false);
  assert.equal(conferirDescadastro("44444444-4444-4444-8444-444444444444", t, "segredo"), false);
  assert.equal(conferirDescadastro("../x", t, "segredo"), false);
  const urls = urlsDescadastro(SITE, u, "segredo");
  assert.ok(urls.pagina.startsWith(`${SITE}/avisos/desligar?u=`));
  assert.ok(urls.umClique.startsWith(`${SITE}/api/avisos/desligar?u=`));
  const h = cabecalhosDescadastro({ descadastroUmCliqueUrl: urls.umClique, gerenciarAvisosUrl: `${SITE}/dashboard/notificacoes` });
  assert.equal(h.headers?.["List-Unsubscribe"], `<${urls.umClique}>, <${SITE}/dashboard/notificacoes>`);
  assert.equal(h.headers?.["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
  // Sem o one-click, só o "Gerenciar avisos" (o comportamento de antes) e sem o -Post.
  assert.deepEqual(cabecalhosDescadastro({ gerenciarAvisosUrl: `${SITE}/dashboard/notificacoes` }), { headers: { "List-Unsubscribe": `<${SITE}/dashboard/notificacoes>` } });
  const rota = ler("src/app/api/avisos/desligar/route.ts");
  assert.match(rota, /export async function POST/);
  assert.doesNotMatch(rota, /auth\.getUser|createClient\(/);
  assert.match(ler("src/lib/data/descadastro-servidor.ts"), /comSugestoesDesligadas/);
});

test("servidor: nunca lê endereço exato nem dado do proprietário para o cartão", () => {
  const srv = ler("src/lib/notifications/proativos-servidor.ts");
  const selects = srv.match(/\.select\("[^"]*"\)/g) ?? [];
  for (const s of selects) assert.doesNotMatch(s, /owner_id|street|logradouro|numero|cep|lat|lng|phone|telefone|full_name, phone/, s);
  assert.match(srv, /semPush: true/);
});

test("0262: categoria 'sugestoes' no check, quem desligou 'outros' fica sem sugestões, fila com RLS; aplicar e rollback", () => {
  const mig = ler("supabase/migrations/0262_emails_proativos.sql");
  const ap = ler("supabase/producao/aplicar-0262.sql");
  for (const sql of [mig, ap]) {
    assert.match(sql, /array\['mensagens', 'lembretes', 'outros', 'sugestoes'\]::text\[\]/);
    assert.match(sql, /where 'outros' = any \(notif_categorias_desligadas\)/);
    assert.match(sql, /create table if not exists public\.emails_proativos/);
    assert.match(sql, /alter table public\.emails_proativos enable row level security/);
    assert.match(sql, /revoke all on public\.emails_proativos from anon, authenticated/);
  }
  assert.match(ap, /^begin;$/m);
  assert.match(ap, /^commit;$/m);
  assert.match(ap, /'20261030000262', '0262_emails_proativos'/);
  const volta = ler("supabase/producao/rollback/0262_rollback.sql");
  assert.match(volta, /drop table if exists public\.emails_proativos/);
  assert.match(volta, /delete from supabase_migrations\.schema_migrations where version = '20261030000262'/);
});
