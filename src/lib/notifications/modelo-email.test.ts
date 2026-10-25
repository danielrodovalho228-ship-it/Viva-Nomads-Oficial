import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { layoutEmail, rodapeOpcionalHtml, rodapeTexto, blocoDados, RODAPE_OPCIONAL } from "./modelo-email.ts";
import { REDES_OFICIAIS } from "../../config/redes.ts";
import { TEMPLATES } from "./eventos-email.ts";
import { instrucoesSupabase, templatesSupabase } from "./templates-supabase.ts";

const PROIBIDAS = /aluguel|alugu[ée]is|comiss|vistoria|corretagem|intermedia|temporada|art\. ?48/i;
const SITE = "https://vivanomads.com.br";

test("modelo único: cabeçalho com Entrar, ajuda, site, avisos, fase de testes e modo escuro", () => {
  const h = layoutEmail("<p>oi</p>", { siteUrl: SITE });
  assert.match(h, /alt="Viva Nomads"/);
  assert.ok(h.includes(`href="${SITE}/auth"`) && />Entrar</.test(h));
  assert.ok(h.includes(`href="${SITE}/ajuda"`) && h.includes("Central de Ajuda"));
  assert.ok(h.includes(`href="${SITE}/dashboard/notificacoes"`) && h.includes("Gerenciar avisos"));
  assert.ok(h.includes("Plataforma em fase de testes. Lançamento oficial em 2027."));
  assert.match(h, /prefers-color-scheme: dark/);
  assert.match(h, /name="color-scheme"/);
  assert.doesNotMatch(h, PROIBIDAS);
});

test("rodapé opcional: lojas e endereço prontos mas DESLIGADOS; redes LIGADAS com REDES_OFICIAIS (35A, item 4)", () => {
  assert.equal(RODAPE_OPCIONAL.lojas.ativo || RODAPE_OPCIONAL.endereco.ativo, false);
  assert.equal(RODAPE_OPCIONAL.redes.ativo, true);
  assert.deepEqual(RODAPE_OPCIONAL.redes.links, [...REDES_OFICIAIS]);
  const padrao = rodapeOpcionalHtml();
  for (const r of REDES_OFICIAIS) {
    assert.ok(padrao.includes(`<a href="${r.url}" rel="noopener"`), r.url);
    assert.ok(padrao.includes(`>${r.nome}</a>`), r.nome);
  }
  assert.ok(layoutEmail("x", { siteUrl: SITE }).includes("https://www.instagram.com/vivanomads/"));
  assert.doesNotMatch(layoutEmail("x", { siteUrl: SITE }), /App Store|Google Play/);
  const ligado = rodapeOpcionalHtml({
    lojas: { ativo: true, ios: "https://apps.apple.com/x", android: "https://play.google.com/x" },
    redes: { ativo: true, links: [{ nome: "Instagram", url: "https://instagram.com/x" }] },
    endereco: { ativo: true, texto: "Endereço da empresa" },
  });
  assert.match(ligado, /App Store/);
  assert.match(ligado, /Google Play/);
  assert.match(ligado, /Instagram/);
  assert.match(ligado, /Endereço da empresa/);
});

test("texto puro e bloco de dados", () => {
  const t = rodapeTexto(SITE);
  assert.ok(t.includes(`${SITE}/ajuda`) && t.includes(`${SITE}/dashboard/notificacoes`) && t.includes("fase de testes"));
  assert.match(blocoDados([{ rotulo: "Imóvel", valor: "Studio" }]), /Imóvel[\s\S]*Studio/);
  assert.equal(blocoDados([]), "");
});

test("eventos: cada um tem botão específico e destino interno, e texto sem termos proibidos", () => {
  const eventos = Object.entries(TEMPLATES);
  assert.ok(eventos.length >= 30);
  for (const [ev, t] of eventos) {
    assert.ok(t.cta.length > 2 && t.cta !== "Abrir no Viva Nomads", `${ev}: botão genérico`);
    assert.match(t.path, /^\/(?!\/)/, `${ev}: destino deve ser caminho interno`);
    assert.doesNotMatch(`${t.subject} ${t.body("Ana")} ${t.cta}`, PROIBIDAS, `${ev}: termo proibido`);
  }
});

test("e-mails de conta do Supabase: 6 modelos, assunto do código, código grande e arquivos em dia", () => {
  const ts = templatesSupabase();
  assert.equal(ts.length, 6);
  const cod = ts.find((t) => t.arquivo === "codigo-de-acesso.html")!;
  assert.equal(cod.assunto, "Seu código de acesso · Viva Nomads");
  assert.match(cod.html, /\{\{ \.Token \}\}/);
  assert.match(cod.html, /font-size:38px/);
  assert.match(cod.html, /ignore este e-mail/i);
  // Prompt 49: vale 10 minutos; o 1º código da conta nova sai pelo "Confirm signup", com o mesmo assunto e o
  // código em destaque; e-mail de código não tem link de login (nem no topo).
  assert.match(cod.html, /10 minutos/);
  const comCodigo = ["codigo-de-acesso.html", "confirmar-cadastro.html", "reautenticacao.html"];
  const conf = ts.find((t) => t.arquivo === "confirmar-cadastro.html")!;
  assert.equal(conf.assunto, "Seu código de acesso · Viva Nomads");
  assert.match(conf.html, /\{\{ \.Token \}\}/);
  for (const t of ts) {
    assert.doesNotMatch(t.html, PROIBIDAS, t.arquivo);
    assert.doesNotMatch(t.html, /1 hora/, t.arquivo);
    assert.ok(t.html.includes("Central de Ajuda"), t.arquivo);
    if (comCodigo.includes(t.arquivo)) {
      assert.ok(!t.html.includes(">Entrar<") && !/\/auth["?]/.test(t.html) && !/TokenHash/.test(t.html), `${t.arquivo}: código sem link de login`);
    } else {
      assert.ok(t.html.includes(">Entrar<"), t.arquivo);
    }
    if (!comCodigo.includes(t.arquivo)) assert.match(t.html, /\{\{ \.SiteURL \}\}\/auth\/confirm\?token_hash=\{\{ \.TokenHash \}\}&type=(signup|recovery|email_change|invite)&next=\//, t.arquivo);
    assert.doesNotMatch(t.html, /ConfirmationURL/, `${t.arquivo}: use token_hash (correção #182)`);
    const emDisco = readFileSync(new URL(`../../../supabase/templates/${t.arquivo}`, import.meta.url), "utf8");
    assert.equal(emDisco, t.html + "\n", `${t.arquivo} desatualizado: rode npm run templates:supabase`);
  }
  assert.equal(readFileSync(new URL("../../../supabase/templates/LEIA-ME.md", import.meta.url), "utf8"), instrucoesSupabase());
  const arquivos = readdirSync(new URL("../../../supabase/templates/", import.meta.url)).filter((f) => f.endsWith(".html"));
  assert.equal(arquivos.length, ts.length);
});
