/*
  E267 (residual) — os últimos e-mails a clientes que saíam com o corpo genérico do modelo passam a nomear o imóvel e
  o fato (a pessoa vem do notify). Casos reais do QA: Apto Santa Mônica (Uberlândia), dono Daniel, morador Lara.
  Roda: node --test src/lib/notifications/corpo-e267-residual.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  corpoInternetAbaixo,
  corpoInternetRemedir,
  corpoLembreteInteressado,
  corpoManutencao,
  corpoManutencaoAtrasada,
  corpoPedidoEncerrado,
  corpoProvaCelular,
  paraNotify,
  type CorpoResidual,
} from "./corpo-e267-residual.ts";
import { TEMPLATES } from "./eventos-email.ts";
import { comMarca, problemasDoAssunto } from "./assuntos.ts";

const IMOVEL = { titulo: "Apto Santa Mônica", bairro: "Santa Mônica", cidade: "Uberlândia" };
const BLOCO = { rotulo: "Imóvel", valor: "Apto Santa Mônica · Santa Mônica, Uberlândia" };
// 30/10/2026 09:15 em Brasília.
const ABERTA = "2026-10-30T12:15:00Z";

test("manutenção: mudança de situação, solução provisória, confirmação e mensagem nomeiam quem, a categoria e o imóvel", () => {
  const d = { imovel: IMOVEL, categoria: "hidraulica", abertaEm: ABERTA, quem: "proprietario" as const };
  const st = corpoManutencao(d, { tipo: "status", para: "em_andamento" });
  assert.equal(st.subject, "Manutenção atualizada: Apto Santa Mônica");
  assert.equal(st.body("Lara"), 'Olá Lara, o proprietário mudou a manutenção de hidráulica em Apto Santa Mônica para "Em andamento". Veja o histórico pela plataforma.');
  assert.deepEqual(st.linhas, [
    BLOCO,
    { rotulo: "Manutenção", valor: "Hidráulica" },
    { rotulo: "Aberta em", valor: "30/10/2026 às 09:15 (horário de Brasília)" },
    { rotulo: "Situação agora", valor: "Em andamento" },
  ]);
  assert.equal(corpoManutencao(d, { tipo: "provisoria" }).body("Lara"), "Olá Lara, o proprietário marcou a solução provisória na manutenção de hidráulica em Apto Santa Mônica. O prazo da solução definitiva continua valendo.");
  const conf = corpoManutencao({ ...d, quem: "morador" }, { tipo: "confirmada" });
  assert.equal(conf.body("Daniel"), "Olá Daniel, o morador confirmou a solução da manutenção de hidráulica em Apto Santa Mônica. A ordem está concluída.");
  const msg = corpoManutencao({ ...d, quem: "morador" }, { tipo: "mensagem" });
  assert.equal(msg.subject, "Nova mensagem na manutenção: Apto Santa Mônica");
  assert.equal(msg.body("Daniel"), "Olá Daniel, o morador escreveu na manutenção de hidráulica em Apto Santa Mônica. Responda pela plataforma.");
  // "outros" não vira "manutenção de outros".
  assert.equal(corpoManutencao({ ...d, categoria: "outros" }, { tipo: "mensagem" }).body("Lara"), "Olá Lara, o proprietário escreveu na manutenção em Apto Santa Mônica. Responda pela plataforma.");
});

test("manutenção sem resposta no prazo (cron): categoria, imóvel, abertura e as horas do prazo", () => {
  const c = corpoManutencaoAtrasada({ imovel: IMOVEL, categoria: "eletrica", abertaEm: ABERTA, prazoHoras: 24 });
  assert.equal(c.subject, "Manutenção sem resposta: Apto Santa Mônica");
  assert.equal(c.body("Daniel"), "Olá Daniel, o pedido de manutenção de elétrica do seu morador em Apto Santa Mônica, aberto em 30/10/2026 às 09:15 (horário de Brasília), passou do prazo de 24 horas sem resposta. Responda pela plataforma.");
  assert.deepEqual(c.linhas.at(-1), { rotulo: "Prazo para responder", valor: "24 horas (vencido)" });
});

test("lembrete do interessado (pela Viva): quem aguarda (primeiro nome), o imóvel e desde quando", () => {
  const c = corpoLembreteInteressado({ imovel: IMOVEL, interessado: "Lara", desde: "2026-10-28T14:00:00Z" });
  assert.equal(c.subject, "Lembrete: interessado aguarda em Apto Santa Mônica");
  assert.equal(c.body("Daniel"), "Olá Daniel, Lara aguarda a sua resposta sobre Apto Santa Mônica desde 28/10/2026. Aceite, peça mais informações ou recuse pela plataforma.");
  assert.deepEqual(c.linhas, [BLOCO, { rotulo: "Interessado", valor: "Lara" }, { rotulo: "Candidatura enviada em", valor: "28/10/2026" }]);
});

test("pedido de moradia encerrado: a cidade do pedido e o imóvel com que o dono respondeu", () => {
  const c = corpoPedidoEncerrado({ cidade: "Uberlândia", imovel: IMOVEL });
  assert.equal(c.subject, "Pedido de moradia em Uberlândia encerrado");
  assert.equal(c.body("Daniel"), "Olá Daniel, o morador encerrou o pedido de moradia em Uberlândia que você respondeu com Apto Santa Mônica. Ele não aparece mais na sua lista.");
  assert.deepEqual(c.linhas, [{ rotulo: "Pedido em", valor: "Uberlândia" }, { rotulo: "Você respondeu com", valor: BLOCO.valor }]);
});

test("foto do nível pelo celular: o item, o imóvel e até quando o link vale", () => {
  const c = corpoProvaCelular({ imovel: IMOVEL, item: "Cadeira ergonômica", expiraEm: "2026-10-30T12:45:00Z" });
  assert.equal(c.body("Daniel"), 'Olá Daniel, abra este e-mail no celular e toque no botão para fotografar "Cadeira ergonômica" de Apto Santa Mônica na hora, pela câmera. O link vale por 30 minutos e uma vez só.');
  assert.deepEqual(c.linhas.at(-1), { rotulo: "O link vale até", valor: "30/10/2026 às 09:45 (horário de Brasília)" });
});

test("internet: remedir com a data em que vence; a medida do morador abaixo com os dois números", () => {
  const r = corpoInternetRemedir({ imovel: IMOVEL, validoAte: "2026-11-14T15:00:00Z" });
  assert.equal(r.subject, "Meça de novo a internet de Apto Santa Mônica até 14/11");
  assert.equal(r.body("Daniel"), "Olá Daniel, a medição da internet de Apto Santa Mônica vence em 14/11/2026. Meça de novo, conectado ao Wi-Fi do imóvel, para o anúncio continuar mostrando o número.");
  const a = corpoInternetAbaixo({ imovel: IMOVEL, morador: { download: 38.4, upload: 9.6 }, dono: { download: 302, upload: 98 } });
  assert.equal(a.body("Daniel"), "Olá Daniel, o morador mediu a internet de Apto Santa Mônica na entrada: 38 Mbps de download e 10 Mbps de upload, abaixo da metade da sua última medição (302 Mbps e 98 Mbps). Vale conferir o roteador ou a operadora e medir de novo.");
});

const TODOS = (im: typeof IMOVEL | null): [string, CorpoResidual][] => [
  ["manutencao_atualizada", corpoManutencao({ imovel: im, categoria: "hidraulica", abertaEm: ABERTA, quem: "proprietario" }, { tipo: "status", para: "resolvido" })],
  ["manutencao_mensagem", corpoManutencao({ imovel: im, categoria: "eletrica", abertaEm: ABERTA, quem: "morador" }, { tipo: "mensagem" })],
  ["manutencao_atrasada", corpoManutencaoAtrasada({ imovel: im, categoria: "internet", abertaEm: ABERTA, prazoHoras: 4 })],
  ["new_lead", corpoLembreteInteressado({ imovel: im, interessado: "Lara", desde: ABERTA })],
  ["pedido_encerrado", corpoPedidoEncerrado({ cidade: im ? "Uberlândia" : null, imovel: im })],
  ["nivel_prova_celular", corpoProvaCelular({ imovel: im, item: "Mesa", expiraEm: ABERTA })],
  ["internet_remedir", corpoInternetRemedir({ imovel: im, validoAte: "2026-11-14T15:00:00Z" })],
  ["internet_abaixo_medida", corpoInternetAbaixo({ imovel: im, morador: { download: 30, upload: 5 }, dono: { download: 300, upload: 90 } })],
];

test("todos: o imóvel no corpo, diferente do modelo genérico; assunto na régua; sem 'comissão'/'aluguel'", () => {
  const longo = { titulo: "apartamento enorme com vista para o mar e varanda gourmet 1201", bairro: "Centro", cidade: "Uberlândia" };
  for (const [ev, c] of TODOS(IMOVEL)) {
    assert.ok(c.body("Daniel").includes("Apto Santa Mônica"), ev);
    assert.notEqual(c.body("Daniel"), TEMPLATES[ev as keyof typeof TEMPLATES].body("Daniel"), ev);
    assert.doesNotMatch([c.subject, c.body("Daniel"), ...c.linhas.map((l) => l.valor)].join(" "), /comiss[ãa]o|aluguel|undefined|null/i, ev);
  }
  for (const [ev, c] of [...TODOS(IMOVEL), ...TODOS(longo)]) {
    if (c.subject) assert.deepEqual(problemasDoAssunto(comMarca(c.subject)), [], `${ev}: "${c.subject}"`);
  }
});

test("sem dado (imóvel apagado): frase inteira, sem lixo; o assunto volta ao do modelo", () => {
  for (const [ev, c] of TODOS(null)) {
    assert.equal(c.subject, null, ev);
    for (const s of [c.body(), c.body("Lara")]) assert.doesNotMatch(s, /undefined|null|NaN|—|\s{2}| ,|\.\.| em \.| de \./, `${ev}: "${s}"`);
  }
  // paraNotify: sem assunto não manda subject (vale o do modelo); bloco só com linhas.
  const p = paraNotify(corpoPedidoEncerrado({ cidade: null, imovel: null }));
  assert.equal("subject" in p, false);
  assert.equal("detailsHtml" in p, false);
  assert.match(paraNotify(TODOS(IMOVEL)[0][1]).detailsHtml ?? "", /Apto Santa Mônica/);
});

test("ponto de envio: os 6 lugares passam os fatos ao construtor", () => {
  const ler = (p: string) => readFileSync(p, "utf8");
  const manut = ler("src/lib/data/manutencao-actions.ts");
  assert.match(manut, /\.\.\.paraNotify\(corpoManutencao\(dadosDoEmail\(ordem, papel\), fato\)\)/);
  for (const f of ['{ tipo: "status", para: novo }', '{ tipo: "mensagem" }', '{ tipo: "provisoria" }', '{ tipo: "confirmada" }']) assert.ok(manut.includes(f), f);
  assert.match(manut, /properties\(title, address, city\)";/);
  const cron = ler("src/app/api/cron/atendimento/route.ts");
  assert.match(cron, /service_orders\(id, owner_id, priority, category, opened_at, first_response_at, status, properties\(title, address, city\)\)/);
  assert.match(cron, /corpoManutencaoAtrasada\(\{[\s\S]{0,300}prazoHoras: PRAZO_MANUTENCAO_H\[so\.priority\] \?\? 24/);
  assert.match(ler("src/lib/atendimento/viva-servidor.ts"), /\.\.\.paraNotify\(corpoLembreteInteressado\(\{ imovel: imovelDoLead\(lead\), interessado: await primeiroNomeDe\(admin, uid\)/);
  assert.match(ler("src/lib/data/pedidos-actions.ts"), /corpoPedidoEncerrado\(\{\s+cidade:/);
  assert.match(ler("src/lib/data/prova-actions.ts"), /corpoProvaCelular\(\{ imovel, item: ehChaveNivel\(chave\) \? itemNivel\(chave\)\.rotulo : null, expiraEm \}\)/);
  const net = ler("src/lib/internet-medida-servidor.ts");
  assert.match(net, /corpoInternetAbaixo\(\{/);
  assert.match(net, /corpoInternetRemedir\(\{ imovel:/);
});

/*
  E267 (restante, 01/11) — a varredura de todo notify() do repo achou três e-mails a clientes que ainda saíam com o corpo
  genérico no HTML: o conflito e a falha do calendário importado (sem o imóvel; as datas e a causa iam só na versão em
  texto) e a verificação parada (o motivo ia só na versão em texto). Agora o corpo e o bloco nomeiam o imóvel e o fato.
*/
test("calendário: conflito diz o imóvel, as datas de lá e o compromisso daqui; falha diz o imóvel e a causa", async () => {
  const { corpoCalendarioConflito, corpoCalendarioFalha } = await import("./corpo-e267-residual.ts");
  const c = corpoCalendarioConflito({ imovel: IMOVEL, importado: { inicio: "2026-12-10", fim: "2026-12-15" }, compromisso: { tipo: "contrato", inicio: "2026-12-01", fim: "2027-02-28" } });
  assert.equal(c.subject, "Datas importadas cruzam a agenda de Apto Santa Mônica");
  assert.equal(c.body("Daniel"), "Olá Daniel, o calendário importado marcou 10/12/2026 a 15/12/2026 como ocupado em Apto Santa Mônica, e na Viva há um contrato de 01/12/2026 a 28/02/2027. Nada foi cancelado: confira as datas e decida qual vale.");
  assert.deepEqual(c.linhas, [BLOCO, { rotulo: "Ocupado no outro site", valor: "10/12/2026 a 15/12/2026" }, { rotulo: "Na Viva", valor: "Um contrato de 01/12/2026 a 28/02/2027" }]);
  const f = corpoCalendarioFalha({ imovel: IMOVEL, causa: "O Airbnb recusou o link." });
  assert.equal(f.body("Daniel"), "Olá Daniel, tentamos ler o link do calendário do outro site de Apto Santa Mônica 3 vezes seguidas, sem sucesso (O Airbnb recusou o link). Enquanto isso, as datas de lá não chegam aqui.");
  assert.deepEqual(f.linhas, [BLOCO, { rotulo: "O que aconteceu", valor: "O Airbnb recusou o link." }]);
  // O HTML do e-mail leva o bloco (antes, só o texto levava o detalhe).
  assert.match(paraNotify(c).detailsHtml ?? "", /Ocupado no outro site/);
  const srv = readFileSync("src/lib/calendario/importar-servidor.ts", "utf8");
  assert.match(srv, /\.\.\.paraNotify\(c\)/);
  assert.match(srv, /corpoCalendarioConflito\(\{ imovel, importado: c\.importado, compromisso: c\.compromisso \}\)/);
  assert.match(srv, /corpoCalendarioFalha\(\{ imovel, causa \}\)/);
});

test("verificação parada: o motivo e o próximo passo no corpo e no bloco do e-mail", async () => {
  const { corpoVerificacaoParada } = await import("./corpo-e267-residual.ts");
  const v = corpoVerificacaoParada({ titulo: "Foto escura", proximoPasso: "Tire de novo perto de uma janela, com luz de frente e sem flash." });
  assert.equal(v.body("Lara"), "Olá Lara, a última tentativa de verificar sua identidade não passou: foto escura. Tire de novo perto de uma janela, com luz de frente e sem flash.");
  assert.match(paraNotify(v).detailsHtml ?? "", /O que fazer agora/);
  assert.match(readFileSync("src/lib/lembretes/servidor.ts", "utf8"), /\.\.\.paraNotify\(corpoVerificacaoParada\(m\)\)/);
});

test("varredura: nenhum notify() a cliente sai só com o corpo do modelo (fora vistoria, push puro e avisos à equipe)", () => {
  // Push puro (sem e-mail), avisos à equipe e a família da vistoria (Onda 6) ficam fora; os demais precisam de body/detailsHtml.
  const SO_PUSH_OU_EQUIPE = new Set(["anuncio_compartilhar", "pedido_compativel", "new_message", "documento_recebido"]);
  // Conferidos sem imóvel por natureza (parceria, selo do parceiro): a pessoa e o fato já estão no modelo.
  const SEM_IMOVEL = new Set(["parceria_recebida", "parceria_convite", "parceiro_selo_nota_removido"]);
  const arquivos = (d: string): string[] => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? arquivos(join(d, n)) : /\.tsx?$/.test(n) && !/\.test\./.test(n) ? [join(d, n)] : []));
  const genericos: string[] = [];
  for (const f of arquivos("src")) {
    const s = readFileSync(f, "utf8");
    for (const m of s.matchAll(/\bnotify\(\{/g)) {
      let i = (m.index ?? 0) + 7;
      let d = 1;
      while (d && i < s.length) {
        if (s[i] === "{") d++;
        else if (s[i] === "}") d--;
        i++;
      }
      const obj = s.slice(m.index, i);
      const ev = (obj.match(/event:\s*"([a-z_]+)"/) ?? [])[1];
      if (!ev || ev.startsWith("vistoria_") || SO_PUSH_OU_EQUIPE.has(ev) || SEM_IMOVEL.has(ev) || /interno:\s*true/.test(obj)) continue;
      if (!/\bbody\b\s*[:,]|\.\.\.|detailsHtml/.test(obj)) genericos.push(`${f}: ${ev}`);
    }
  }
  assert.deepEqual(genericos, []);
});
