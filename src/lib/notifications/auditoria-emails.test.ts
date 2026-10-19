/*
  Auditoria de TODOS os e-mails de cliente (rota rápida "e-mails profissionais", itens 1–6).
  Gera cada e-mail pelo catálogo (as mesmas funções da produção) e confere assunto, remetente, imagem, modelo único,
  links, botão, preheader e vocabulário. Roda: node --test src/lib/notifications/auditoria-emails.test.ts
*/
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { catalogoEmails, comFaixaDeTeste, EVENTOS_SO_EQUIPE } from "./catalogo-emails.ts";
import { assuntoChamado, assuntoDecisaoDocumento, comMarca, problemasDoAssunto, tituloNoAssunto } from "./assuntos.ts";
import { REMETENTE, remetenteDoEnvio } from "./remetente.ts";
import { IMAGENS_NO_REPOSITORIO, imagemDoEvento, TEMA_POR_EVENTO, TEMAS_NOVOS } from "./imagens-email.ts";
import { TEMPLATES, type NotificationEvent } from "./eventos-email.ts";
import { camposDiferentes, corpoConfigAuth } from "./supabase-auth-config.ts";
import { templatesSupabase } from "./templates-supabase.ts";

const SITE = "https://vivanomads.com.br";
const RAIZ = new URL("../../../", import.meta.url).pathname;
const PASTA_IMG = join(RAIZ, "public/media/email");
const todos = catalogoEmails(SITE);

/** Texto que a pessoa VÊ no corpo (sem <style>, sem tags, sem entidades comuns). */
function visivel(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

test("catálogo cobre todos os e-mails de cliente: eventos do notify, códigos, recibos, exclusão e os 6 de conta", () => {
  const chaves = new Set(todos.map((e) => e.chave));
  for (const ev of Object.keys(TEMPLATES) as NotificationEvent[]) {
    if (!EVENTOS_SO_EQUIPE.includes(ev)) assert.ok(chaves.has(ev), `falta ${ev}`);
  }
  for (const c of ["codigo:assinatura", "codigo:2fa", "conta:exclusao", "fiscal:recibo", "fiscal:comprovante", "fiscal:termo", "documento:agrupado", "chamado_aberto:numero"]) assert.ok(chaves.has(c), c);
  assert.equal(todos.filter((e) => e.origem === "conta").length, 6);
  assert.ok(todos.length >= 60, `só ${todos.length} e-mails no catálogo`);
});

test("item 2: todo assunto segue a regra (≤70, sem caixa alta, sem código, sem slug, termina com '· Viva Nomads')", () => {
  for (const e of todos) assert.deepEqual(problemasDoAssunto(e.assunto), [], `${e.chave}: "${e.assunto}"`);
  // A regra pega os erros da auditoria.
  for (const ruim of ["03-link-de-acesso", "Proposta ORC-2026-0001", "Comprovante de caução CAU-2026-000001 — Viva Nomads", "Manutenção URGENTE no imóvel", "[TESTE] Recibo", "Viva Nomads — e-mail de teste ✅"]) {
    assert.notDeepEqual(problemasDoAssunto(comMarca(ruim)), [], ruim);
  }
  // Chamado: o número só no fim, entre parênteses.
  assert.deepEqual(problemasDoAssunto(comMarca(assuntoChamado("chamado_aberto", "VN-0001"))), []);
  assert.equal(comMarca("Recebemos seu chamado (VN-0001)"), "Recebemos seu chamado (VN-0001) · Viva Nomads");
  assert.equal(comMarca(comMarca("Seu recibo de pagamento")), "Seu recibo de pagamento · Viva Nomads");
});

test("item 2: assuntos da tabela da ordem", () => {
  const por = new Map(todos.map((e) => [e.chave, e.assunto]));
  assert.equal(por.get("conta:codigo-de-acesso"), "Seu código de acesso · Viva Nomads");
  assert.equal(por.get("conta:reautenticacao"), "Seu código de verificação · Viva Nomads");
  assert.equal(por.get("codigo:2fa"), "Seu código de segurança · Viva Nomads");
  assert.equal(por.get("codigo:assinatura"), "Seu código para assinar o contrato · Viva Nomads");
  assert.equal(por.get("fiscal:recibo"), "Seu recibo de pagamento · Viva Nomads");
  assert.equal(por.get("fiscal:comprovante"), "Seu comprovante de Caução · Viva Nomads");
  assert.equal(por.get("fiscal:termo"), "Termo de devolução da Caução · Viva Nomads");
  assert.equal(por.get("proposta:recebida"), "Você recebeu uma proposta · Viva Nomads");
  assert.equal(por.get("proposta:aceita"), "Sua proposta foi aceita · Viva Nomads");
  assert.equal(por.get("contrato:falta-voce"), "Falta a sua assinatura no contrato · Viva Nomads");
  assert.equal(por.get("contrato:assinado"), "Contrato assinado pelas duas partes · Viva Nomads");
  assert.equal(por.get("manutencao:urgente"), "Manutenção urgente no seu imóvel · Viva Nomads");
  assert.equal(por.get("renovacao_aviso"), "Seu período termina em 15 dias: quer renovar? · Viva Nomads");
  assert.equal(por.get("chamado_aberto:numero"), "Recebemos seu chamado (VN-0001) · Viva Nomads");
  // Número da proposta/documento vai no corpo.
  assert.match(visivel(todos.find((e) => e.chave === "proposta:recebida")!.html), /ORC-2026-0001/);
  assert.match(visivel(todos.find((e) => e.chave === "fiscal:recibo")!.html), /REC-2026-000004/);
});

test("item 1: remetente único 'Viva Nomads Brasil <suporte@vivanomads.com.br>' em todo e-mail de cliente, mesmo com RESEND_FROM diferente", () => {
  assert.equal(REMETENTE, "Viva Nomads Brasil <suporte@vivanomads.com.br>");
  for (const e of todos) assert.equal(e.remetente, REMETENTE, e.chave);
  assert.deepEqual(remetenteDoEnvio({ resendFrom: "Viva Nomads <nao-responder@vivanomads.com.br>" }), { from: REMETENTE, replyTo: "suporte@vivanomads.com.br" });
  assert.deepEqual(remetenteDoEnvio({ from: "Outro <x@y.com>" }), { from: REMETENTE, replyTo: "suporte@vivanomads.com.br" });
  // Interno mantém o dele.
  assert.equal(remetenteDoEnvio({ interno: true, from: "Moacir <m@vivanomads.com.br>" }).from, "Moacir <m@vivanomads.com.br>");
  // Chamados não usam mais "Viva Nomads Suporte".
  assert.doesNotMatch(readFileSync(join(RAIZ, "src/lib/notifications/index.ts"), "utf8"), /Viva Nomads Suporte/);
  // O Supabase recebe o mesmo remetente pela Action.
  const cfg = corpoConfigAuth();
  assert.equal(cfg.smtp_admin_email, "suporte@vivanomads.com.br");
  assert.equal(cfg.smtp_sender_name, "Viva Nomads Brasil");
});

test("item 3: toda imagem existe no repositório e é do tema certo (documento nunca usa candidatura nem pedido)", () => {
  const noDisco = new Set(readdirSync(PASTA_IMG).filter((f) => f.endsWith(".jpg")).map((f) => f.replace(/\.jpg$/, "")));
  assert.deepEqual([...IMAGENS_NO_REPOSITORIO].sort(), [...noDisco].sort(), "IMAGENS_NO_REPOSITORIO desatualizado: acrescente o arquivo novo");
  for (const e of todos) {
    assert.ok(e.imagem && existsSync(join(PASTA_IMG, e.imagem)), `${e.chave}: imagem ${e.imagem}`);
    assert.ok(statSync(join(PASTA_IMG, e.imagem)).size <= 300_000, `${e.chave}: imagem pesada`);
  }
  for (const ev of ["documento_aprovado", "documento_recusado", "verification_ready", "checklist_aprovado", "visita_confirmada", "contract_status", "avaliacao_pedido"] as const) {
    assert.notEqual(imagemDoEvento(ev).arquivo, "candidatura-recebida", ev);
  }
  for (const ev of ["documento_aprovado", "documento_recusado"] as const) assert.notEqual(imagemDoEvento(ev).arquivo, "pedido-resposta", ev);
  assert.notEqual(imagemDoEvento("contract_status").arquivo, "pedido-resposta");
  assert.notEqual(imagemDoEvento("avaliacao_pedido").arquivo, "nova-mensagem");
  // Quando o arquivo novo chega, o tema passa a usá-lo.
  assert.equal(imagemDoEvento("documento_aprovado", new Set([...IMAGENS_NO_REPOSITORIO, "documentos"])).arquivo, "documentos");
  assert.ok(Object.keys(TEMAS_NOVOS).includes("documentos"));
  for (const tema of new Set(Object.values(TEMA_POR_EVENTO))) assert.ok(TEMAS_NOVOS[tema] || IMAGENS_NO_REPOSITORIO.has(tema), tema);
});

test("itens 3 e 5: modelo único, um botão, nenhum endereço cru, links com rótulo, imagens com alt/width/https e preheader", () => {
  for (const e of todos) {
    const h = e.html;
    assert.match(h, /class="vn-card"/, `${e.chave}: fora do modelo único`);
    assert.match(h, /display:none;max-height:0/, `${e.chave}: sem preheader`);
    const v = visivel(h);
    assert.doesNotMatch(v, /https?:\/\/|token/i, `${e.chave}: URL/token visível`);
    assert.doesNotMatch(v, /\S{30,}/, `${e.chave}: texto de 30+ caracteres sem espaço`);
    assert.ok((h.match(/padding:13px 28px/g) ?? []).length <= 1, `${e.chave}: mais de um botão principal`);
    for (const [, rotulo] of h.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)) {
      const r = visivel(rotulo);
      assert.ok(r.length > 0 && !/^https?:|^www\./i.test(r), `${e.chave}: link sem rótulo humano`);
    }
    for (const [img] of h.matchAll(/<img\b[^>]*>/gi)) {
      assert.match(img, /\balt="[^"]+"/, `${e.chave}: img sem alt`);
      assert.match(img, /\bwidth="\d+"/, `${e.chave}: img sem width`);
      assert.match(img, /src="https:\/\/vivanomads\.com\.br\//, `${e.chave}: img fora do domínio`);
    }
    // Pelo menos 2 parágrafos de texto além da imagem.
    assert.ok(v.length > 120, `${e.chave}: pouco texto`);
    // Texto puro: nunca URL com token.
    assert.doesNotMatch(e.text, /[?&](?:token|token_hash|code)=/i, `${e.chave}: texto puro com token`);
  }
});

test("vocabulário: sem 'aluguel', 'comissão', 'intermediação', 'vistoria'; Caução com maiúscula no texto novo", () => {
  const PROIBIDAS = /alugu[eé]l|alugu[eé]is|comiss|intermedia|vistoria|temporada|\[TESTE\]|✅/i;
  for (const e of todos) {
    assert.doesNotMatch(`${e.assunto} ${visivel(e.html)}`, PROIBIDAS, e.chave);
    assert.doesNotMatch(e.assunto, /\bcaução\b/, `${e.chave}: caução minúscula no assunto`);
  }
  assert.doesNotMatch(readFileSync(join(RAIZ, "src/lib/fiscal/documento.ts"), "utf8"), /"Recibo de aluguel"/);
});

test("item 4: e-mails de conta sem URL crua (o link fica só no botão) e LEIA-ME com a Action e os assuntos novos", () => {
  for (const t of templatesSupabase()) {
    assert.doesNotMatch(t.html, /Copie este endereço/, t.arquivo);
    const v = visivel(t.html);
    assert.doesNotMatch(v, /token_hash|\{\{ \.SiteURL \}\}/, t.arquivo);
    if (/token_hash/.test(t.html)) assert.match(v, /O botão não abre\? Peça um novo link na tela de entrada\./, t.arquivo);
  }
  const leia = readFileSync(join(RAIZ, "supabase/templates/LEIA-ME.md"), "utf8");
  assert.match(leia, /Aplicar e-mails de conta no Supabase/);
  assert.match(leia, /SUPABASE_ACCESS_TOKEN/);
  assert.match(leia, /Seu código de acesso · Viva Nomads/);
  // O modelo antigo (origem do "03-link-de-acesso") saiu do repositório.
  assert.equal(existsSync(join(RAIZ, "docs/email-templates")), false);
  // A Action e o script existem; sem o segredo, a mensagem manda colar pelo LEIA-ME.
  const wf = readFileSync(join(RAIZ, ".github/workflows/aplicar-emails-supabase.yml"), "utf8");
  assert.match(wf, /workflow_dispatch/);
  assert.match(wf, /secrets\.SUPABASE_ACCESS_TOKEN/);
  assert.match(readFileSync(join(RAIZ, "scripts/aplicar-templates-supabase.ts"), "utf8"), /Cole os 6 modelos pelo LEIA-ME/);
  const cfg = corpoConfigAuth();
  for (const k of ["confirmation", "recovery", "email_change", "invite", "magic_link", "reauthentication"]) {
    assert.ok(cfg[`mailer_subjects_${k}`] && cfg[`mailer_templates_${k}_content`], k);
  }
  assert.deepEqual(camposDiferentes(cfg, { ...cfg }), []);
  assert.deepEqual(camposDiferentes({ a: "x" }, { a: "y" }), ["a"]);
});

test("item 5: List-Unsubscribe só em aviso (não em documento, verificação ou segurança) e rota de amostras sem [TESTE] no assunto", () => {
  const idx = readFileSync(join(RAIZ, "src/lib/notifications/index.ts"), "utf8");
  assert.match(idx, /SEM_GERENCIAR_AVISOS = new Set<NotificationEvent>\(\["documento_aprovado", "documento_recusado", "checklist_aprovado", "checklist_recusado", "verification_ready"\]\)/);
  assert.match(readFileSync(join(RAIZ, "src/lib/notifications/email.ts"), "utf8"), /"List-Unsubscribe"/);
  const rota = readFileSync(join(RAIZ, "src/app/api/test-email/route.ts"), "utf8");
  assert.doesNotMatch(rota, /\[TESTE\]|✅/);
  assert.match(rota, /catalogoEmails\(SITE_URL\)/);
  assert.match(comFaixaDeTeste(todos[0].html), /<body[^>]*><div[^>]*>Exemplo para revisão/);
});

test("GUARDA: assunto literal só nos e-mails internos; o resto sai de assuntos.ts", () => {
  const INTERNOS = new Set(["src/app/api/plano-gestor/route.ts", "src/app/api/empresas/route.ts", "src/lib/agentes/avisos-daniel.ts", "src/lib/atendimento/servidor.ts", "src/app/api/test-email/route.ts"]);
  const ruins: string[] = [];
  const andar = (d: string) => {
    for (const n of readdirSync(d)) {
      const c = join(d, n);
      if (statSync(c).isDirectory()) andar(c);
      else if (/\.tsx?$/.test(n) && !/\.test\.ts$/.test(n)) {
        const rel = c.slice(RAIZ.length);
        if (rel.endsWith("eventos-email.ts") || INTERNOS.has(rel)) continue;
        if (/\bsubject: [`"]/.test(readFileSync(c, "utf8"))) ruins.push(rel);
      }
    }
  };
  andar(join(RAIZ, "src"));
  assert.deepEqual(ruins, []);
  // No servidor de atendimento, o literal que sobra é o alerta da equipe (interno).
  const at = readFileSync(join(RAIZ, "src/lib/atendimento/servidor.ts"), "utf8");
  assert.equal((at.match(/\bsubject: `/g) ?? []).length, 1);
  assert.match(at, /interno: true,\s*subject: `\$\{c\.prioridade/);
});

test("título do imóvel no assunto: até 40 caracteres, sem link, e o assunto inteiro cabe em 70", () => {
  assert.equal(tituloNoAssunto("Apartamento enorme com vista para o mar e varanda gourmet"), "Apartamento enorme com vista para o mar…");
  assert.equal(tituloNoAssunto("Studio https://golpe.com no Centro"), "Studio no Centro");
  assert.equal(tituloNoAssunto(""), "seu imóvel");
  assert.equal(tituloNoAssunto("Apto 1201 Fone 34999990000"), "Apto Fone");
  assert.deepEqual(problemasDoAssunto(comMarca(assuntoDecisaoDocumento({ titulo: "Apto 1201", linhas: [{ aprovado: true }] }))), []);
  const longo = "Apartamento enorme com vista para o mar e varanda gourmet";
  for (const linhas of [[{ aprovado: true }], [{ aprovado: false }], [{ aprovado: true }, { aprovado: false }]]) {
    assert.deepEqual(problemasDoAssunto(comMarca(assuntoDecisaoDocumento({ titulo: longo, linhas }))), []);
  }
});

test("item 5: conferência do DNS do e-mail (SPF, DKIM, DMARC) e o registro DMARC exato quando falta", async () => {
  const { avaliarDns, DMARC_SUGERIDO, NOMES_DNS, tabelaDns } = await import("./dns-remetente.ts");
  const ok = avaliarDns({ raiz: [], envio: ["v=spf1 include:amazonses.com ~all"], dkim: ["p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQ"], dmarc: ["v=DMARC1; p=none"] });
  assert.deepEqual(ok.map((i) => i.ok), [true, true, true]);
  const falta = avaliarDns({ raiz: [], envio: [], dkim: [], dmarc: [] });
  assert.deepEqual(falta.map((i) => i.ok), [false, false, false]);
  assert.match(falta[2].detalhe, new RegExp(`${NOMES_DNS.dmarc.replace(/\./g, "\\.")}`));
  assert.ok(falta[2].detalhe.includes(DMARC_SUGERIDO));
  assert.match(DMARC_SUGERIDO, /^v=DMARC1; p=none; rua=mailto:/);
  assert.match(tabelaDns(falta), /\| DMARC \| falta \|/);
  assert.match(readFileSync(join(RAIZ, ".github/workflows/ci.yml"), "utf8"), /node scripts\/conferir-dns-email\.ts/);
});
