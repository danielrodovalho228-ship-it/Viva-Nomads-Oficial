/*
  Guardas do Prompt 31b (contratação de parceiros) — leitura do código, sem banco.
  Roda: node --test src/lib/parceiros/pedido-guardas.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { guardContactInfo } from "../messages/contact-guard.ts";

const ler = (p: string) => readFileSync(p, "utf8");
const ACOES = ler("src/lib/parceiros/pedido-actions.ts");

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? arquivos(p) : /\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
  });
}

/** Corpo de cada `export async function` do arquivo de ações. */
function funcoes(fonte: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /^export async function (\w+)/gm;
  const achadas = [...fonte.matchAll(re)];
  achadas.forEach((m, i) => out.set(m[1], fonte.slice(m.index!, achadas[i + 1]?.index ?? fonte.length)));
  return out;
}

test("filtro de contato na conversa do pedido: telefone, e-mail e apps de mensagem são mascarados", () => {
  for (const t of ["me liga 34 99876-5432", "manda pra fulano@exemplo.com", "chama no wa.me/5534998765432", "t.me/fulano"]) {
    const g = guardContactInfo(t);
    assert.equal(g.masked, true, t);
  }
  // Toda mensagem do pedido passa pelo filtro antes de gravar (e o gatilho mask_contact do banco vale igual).
  const corpo = funcoes(ACOES);
  // A função mensagem mora em pedido-servidor.ts (usada também pelo pedido automático do Prompt 38).
  assert.match(ler("src/lib/parceiros/pedido-servidor.ts"), /async function mensagem\([\s\S]*?body: guardContactInfo\(texto\)\.text/);
  assert.match(corpo.get("enviarMensagemDoPedido")!, /await mensagem\(c\.admin, c\.p, c\.userId, t\)/);
  assert.match(ler("supabase/migrations/0057_p1_contratos_candidaturas_contato.sql"), /mask_contact/);
});

test("só o servidor grava, e toda ação confere a sessão e a parte antes", () => {
  const leituras = new Set(["meusPedidosDeServico", "pedidosDoMeuParceiro", "cidadeDosMeusServicos", "meusImoveisParaServico", "registrarVistaDoAdmin"]);
  for (const [nome, corpo] of funcoes(ACOES)) {
    if (leituras.has(nome)) continue;
    assert.match(corpo, /(await|return) (carregar|sessao|mudar)\(/, `${nome}: confere a sessão/parte`);
  }
  // Mudança de estado só pela regra pura e com o estado conferido na gravação (dois cliques não passam os dois).
  assert.match(ACOES, /if \(!podeFazer\(acao, c\.p\.status, c\.papel\)\)/);
  assert.match(ACOES, /\.eq\("status", c\.p\.status\)/);
  // Quem não é parte não descobre que o pedido existe.
  assert.match(ACOES, /if \(!papel\) return \{ erro: "Pedido não encontrado\." \}/);
});

test("privacidade antes do aceite: o endereço exato só é lido para o cliente ou depois do aceite", () => {
  const detalhe = funcoes(ACOES).get("detalheDoPedido")!;
  const leitura = detalhe.indexOf('.select("exact_address")');
  assert.ok(leitura > 0);
  const antes = detalhe.slice(0, leitura);
  assert.match(antes, /papel === "cliente" \|\| \(STATUS_COM_DADOS_LIBERADOS as readonly string\[\]\)\.includes\(p\.status\)/);
  assert.match(detalhe, /visaoDoParceiro\(p\.status/);
});

test("ref do cartão: só com o cookie gravado depois da assinatura conferida, pelo helper da 31c", () => {
  const solicitar = funcoes(ACOES).get("solicitarOrcamento")!;
  assert.match(solicitar, /atribuicaoDoPedidoParceiro\(admin, \{ parceiroId: parceiro\.id, clienteId: userId, cookieValor: jar\.get\(REF_COOKIE_PARCEIRO\)\?\.value \}\)/);
  const rota = ler("src/app/api/cartoes/visita/route.ts");
  // O cookie do parceiro só é gravado depois de lerRefParceiro (que confere a assinatura HMAC).
  assert.ok(rota.indexOf("lerRefParceiro(chaveServidor()") < rota.indexOf("res.cookies.set(REF_COOKIE_PARCEIRO"));
});

test("pagamento: nenhum botão de pagar de verdade; só 'Simular pagamento' (registro) com a chave desligada", () => {
  const tela = ler("src/app/(dashboard)/dashboard/servicos/pedidos/[id]/pedido-tela.tsx");
  assert.doesNotMatch(tela, /Pagar agora|Pagar com|>Pagar</);
  assert.match(tela, /Simular pagamento/);
  assert.doesNotMatch(ACOES, /pagamento_status: "pago"/);
  assert.match(funcoes(ACOES).get("simularPagamento")!, /podeSimularPagamento\(\{ chaveLigada: PAGAMENTO_PARCEIROS_ATIVO/);
});

test("vocabulário e custódia: telas e e-mails do pedido sem retém, repasse, intermediação, comissão, WhatsApp, aluguel ou 'em breve'; nenhum window.confirm/alert", () => {
  const telas = [
    ...arquivos("src/app/(dashboard)/dashboard/servicos"),
    ...arquivos("src/app/(dashboard)/admin/parceiros/pedidos"),
    "src/components/parceiros/solicitar-orcamento.tsx",
    "src/lib/parceiros/pedido.ts",
    "src/lib/parceiros/pedido-actions.ts",
  ];
  const emails = ler("src/lib/notifications/eventos-email.ts");
  const blocoEmails = emails.slice(emails.indexOf("parceiro_pedido_novo: {"), emails.indexOf("parceiro_avaliacao: {") + 400);
  const proibidos = [/ret[ée]m\b/i, /repass/i, /intermedia/i, /comiss[ãa]o/i, /whatsapp/i, /\baluguel\b/i, /em breve/i, /window\.(confirm|alert|prompt)/];
  const achados: string[] = [];
  for (const [f, s] of [...telas.map((f) => [f, ler(f)] as const), ["e-mails do 31b", blocoEmails] as const]) {
    for (const r of proibidos) if (r.test(s)) achados.push(`${f}: ${r}`);
  }
  assert.deepEqual(achados, []);
  assert.ok(blocoEmails.length > 400, "os e-mails do 31b estão no catálogo");
});

test("página pública do parceiro: 'Solicitar orçamento' ativo, sem o 'Em breve' antigo (QA do Muse, 21/10)", () => {
  const pagina = ler("src/app/(public)/parceiros/[slug]/page.tsx");
  assert.match(pagina, /<SolicitarOrcamento\b/);
  assert.match(pagina, /export const dynamic = "force-dynamic"/, "sempre do banco: sem página antiga em cache");
  assert.doesNotMatch(pagina, /Em breve|disabled/);
  const botao = ler("src/components/parceiros/solicitar-orcamento.tsx");
  // O botão que abre a folha nunca é desabilitado; sem login ele vira link para a entrada.
  assert.match(botao, /<ButtonLink href=\{`\/auth\?redirect=\$\{encodeURIComponent\(voltarPara\)\}`\}[^>]*data-testid="solicitar-orcamento"/);
  assert.match(botao, /<Button variant="primary" className="w-full" onClick=\{abrir\} data-testid="solicitar-orcamento">/);
  // E o deploy de produção roda o T253 (subconjunto público), que falha com o botão morto ou o texto antigo.
  const pkg = JSON.parse(ler("package.json")) as { scripts: Record<string, string> };
  assert.match(pkg.scripts["testes:publico"], /t253-orcamento-na-pagina-do-parceiro/);
  const spec = ler("tests/e2e/specs/t253-orcamento-na-pagina-do-parceiro.spec.ts");
  assert.match(spec, /toBeEnabled\(\)/);
  assert.match(spec, /not\.toContainText\(TEXTO_ANTIGO\)/);
});
