/*
  Cartões compartilháveis — Fase 1 (só compartilhar; sem recompensa nem cupom).
  Roda: node --test src/lib/cartoes/compartilhar.test.ts
*/
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ALFABETO_CODIGO,
  assinar,
  assinaturaConfere,
  chaveDosCartoes,
  codigoValido,
  curtoValido,
  estadiaTerminou,
  FORMATOS,
  gerarCodigo,
  gerarCurto,
  legendaWhatsapp,
  lerCookieRef,
  lerRef,
  mesAno,
  METRICAS_CARTAO,
  nomeNoCartao,
  origemPropria,
  TEXTOS,
  textoValorPeriodo,
  urlDoCartao,
  valorCookieRef,
} from "./compartilhar.ts";

const CHAVE = chaveDosCartoes("segredo-de-teste-com-mais-de-16");
const ID = "11111111-2222-4333-8444-555555555555";
const OUTRO = "99999999-2222-4333-8444-555555555555";
const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("código da conta: XXXX-XXXX, alfabeto sem caracteres ambíguos, aleatório", () => {
  for (const ambiguo of ["0", "O", "1", "I", "L"]) assert.ok(!ALFABETO_CODIGO.includes(ambiguo), ambiguo);
  const vistos = new Set<string>();
  for (let i = 0; i < 2000; i++) {
    const c = gerarCodigo();
    assert.match(c, /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/);
    assert.ok(codigoValido(c));
    vistos.add(c);
  }
  assert.equal(vistos.size, 2000);
  assert.equal(codigoValido("ABCD-EFG0"), false);
  assert.equal(codigoValido("abcd-efgh"), false);
  assert.equal(codigoValido("ABCDEFGH"), false);
  assert.ok(curtoValido(gerarCurto()));
  // Sem viés: o gerador descarta bytes acima do maior múltiplo do alfabeto.
  assert.equal(gerarCodigo(() => new Uint8Array(16).fill(255 - (256 % ALFABETO_CODIGO.length) + 1).map((v, i) => (i % 2 ? v : 0))), "2222-2222");
});

test("assinatura HMAC-SHA256(ref + listing_id): confere a certa e recusa qualquer adulteração", () => {
  const sig = assinar(CHAVE, "ABCD-EFGH", ID);
  assert.match(sig, /^[0-9a-f]{64}$/);
  assert.equal(assinaturaConfere(CHAVE, "ABCD-EFGH", ID, sig), true);
  assert.equal(assinaturaConfere(CHAVE, "ABCD-EFGJ", ID, sig), false, "ref trocado");
  assert.equal(assinaturaConfere(CHAVE, "ABCD-EFGH", OUTRO, sig), false, "imóvel trocado");
  assert.equal(assinaturaConfere(CHAVE, "ABCD-EFGH", ID, sig.replace(/^./, sig[0] === "a" ? "b" : "a")), false, "sig alterada");
  assert.equal(assinaturaConfere(chaveDosCartoes("outro-segredo-qualquer-123"), "ABCD-EFGH", ID, sig), false, "outra chave");
  assert.equal(assinaturaConfere(CHAVE, "ABCD-EFGH", ID, ""), false);
  assert.throws(() => chaveDosCartoes(""));
});

test("URL do QR: só domínio próprio, https, com ref + UTM + sig; laboratório só fora de produção", () => {
  const url = new URL(urlDoCartao({ base: "https://vivanomads.com.br", producao: true, chave: CHAVE, ref: "ABCD-EFGH", listingId: ID, tipo: "ownercard", meio: "qr" }));
  assert.equal(url.origin, "https://vivanomads.com.br");
  assert.equal(url.pathname, `/imoveis/${ID}`);
  assert.equal(url.searchParams.get("ref"), "ABCD-EFGH");
  assert.equal(url.searchParams.get("utm_source"), "share_card");
  assert.equal(url.searchParams.get("utm_medium"), "qr");
  assert.equal(url.searchParams.get("utm_campaign"), "ownercard");
  assert.equal(url.searchParams.get("utm_content"), ID);
  assert.equal(url.searchParams.get("sig"), assinar(CHAVE, "ABCD-EFGH", ID));
  for (const fora of ["https://evil.com", "https://vivanomads.com.br.evil.com", "https://evil.com/vivanomads.com.br", "http://vivanomads.com.br", "javascript:alert(1)"]) {
    assert.throws(() => origemPropria(fora, true), fora);
  }
  assert.throws(() => origemPropria("http://localhost:3123", true), "localhost em produção");
  assert.equal(origemPropria("http://localhost:3123", false), "http://localhost:3123");
  assert.throws(() => urlDoCartao({ base: "https://vivanomads.com.br", producao: true, chave: CHAVE, ref: "abc", listingId: ID, tipo: "poststay", meio: "qr" }));
});

test("leitura da visita: só atribui com sig certa, mesmo imóvel, campanha e origem conhecidas", () => {
  const q = Object.fromEntries(new URL(urlDoCartao({ base: "https://vivanomads.com.br", producao: true, chave: CHAVE, ref: "ABCD-EFGH", listingId: ID, tipo: "poststay", meio: "qr" })).searchParams);
  assert.deepEqual(lerRef(CHAVE, ID, q), { ref: "ABCD-EFGH", tipo: "poststay", meio: "qr", listingId: ID });
  assert.equal(lerRef(CHAVE, OUTRO, q), null, "QR de outro imóvel");
  assert.equal(lerRef(CHAVE, ID, { ...q, ref: "WXYZ-EFGH" }), null, "ref adulterado");
  assert.equal(lerRef(CHAVE, ID, { ...q, sig: "0".repeat(64) }), null, "sig adulterada");
  assert.equal(lerRef(CHAVE, ID, { ...q, utm_campaign: "cupom" }), null);
  assert.equal(lerRef(CHAVE, ID, { ...q, utm_source: "outro" }), null);
  assert.equal(lerRef(CHAVE, ID, { ...q, utm_content: OUTRO }), null);
  assert.equal(lerRef(CHAVE, ID, {}), null);
  // A troca de meio (qr ↔ link) não muda a assinatura: o mesmo cartão vale nos dois.
  assert.equal(lerRef(CHAVE, ID, { ...q, utm_medium: "link" })?.meio, "link");
  const cookie = valorCookieRef(lerRef(CHAVE, ID, q)!);
  assert.deepEqual(lerCookieRef(cookie), { ref: "ABCD-EFGH", tipo: "poststay", listingId: ID });
  assert.equal(lerCookieRef("ABCD-EFGH|cupom|x"), null);
});

test("sem dado pessoal além do primeiro nome com consentimento; datas só mês/ano", () => {
  assert.equal(nomeNoCartao("Ana Lima Souza", false), "");
  assert.equal(nomeNoCartao("Ana Lima Souza", true), "Ana");
  assert.equal(nomeNoCartao("ana@exemplo.com", true), "");
  assert.equal(nomeNoCartao("  <b>Ana</b> Lima", true), "bAnab");
  assert.equal(mesAno("2026-10-19"), "outubro de 2026");
  assert.equal(mesAno("2027-01-05T10:00:00Z"), "janeiro de 2027");
  assert.equal(mesAno(null), "");
  assert.doesNotMatch(mesAno("2026-10-19"), /19/);
  assert.equal(textoValorPeriodo(3200, 30), "R$ 3.200 por mês · mínimo de 30 dias");
  assert.equal(textoValorPeriodo(null, null), "");
});

test("textos travados e legenda do WhatsApp: vocabulário da Viva, sem preço de 'aluguel', sem contato", () => {
  const PROIBIDAS = /alugu[eé]l|temporada|comiss|apartamento|vistoria|cupom|desconto|recompensa|garantia/i;
  const tudo = [TEXTOS.poststay.frase, TEXTOS.ownercard.frase, TEXTOS.poststay.rodape, TEXTOS.qr].join(" ");
  assert.doesNotMatch(tudo, PROIBIDAS);
  const l1 = legendaWhatsapp({ tipo: "poststay", cidade: "Uberlândia", link: "https://vivanomads.com.br/c/ABCDEFGHJK" });
  const l2 = legendaWhatsapp({ tipo: "ownercard", cidade: "Uberlândia", bairro: "Centro", link: "https://vivanomads.com.br/c/ABCDEFGHJK" });
  assert.match(l1, /Uberlândia.*https:\/\/vivanomads\.com\.br\/c\/ABCDEFGHJK$/);
  assert.match(l2, /Centro, Uberlândia/);
  for (const l of [l1, l2]) assert.doesNotMatch(l, PROIBIDAS);
  assert.deepEqual(FORMATOS, { retrato: { largura: 1080, altura: 1350 }, quadrado: { largura: 1080, altura: 1080 } });
  assert.deepEqual([...METRICAS_CARTAO], ["cards_generated", "cards_shared", "qr_scans", "ref_listing_views", "ref_bookings"]);
});

test("cartão-postal só depois da saída", () => {
  const base = { status: "ativo", assinadoProprietarioEm: "2026-09-01", assinadoInquilinoEm: "2026-09-01", fimUltimoBloco: "2026-10-30" };
  assert.equal(estadiaTerminou(base, "2026-10-19"), false, "ainda morando");
  assert.equal(estadiaTerminou(base, "2026-10-31"), true, "último bloco já terminou");
  assert.equal(estadiaTerminou({ ...base, status: "concluido" }, "2026-10-19"), true);
  assert.equal(estadiaTerminou({ ...base, status: "encerrado_em_acerto" }, "2026-10-19"), true);
  assert.equal(estadiaTerminou({ ...base, status: "cancelado", fimUltimoBloco: "2026-01-01" }, "2026-10-19"), false);
  assert.equal(estadiaTerminou({ ...base, assinadoInquilinoEm: null, fimUltimoBloco: "2026-01-01" }, "2026-10-19"), false, "sem as duas assinaturas");
});

test("ligação: imagem só com campos aprovados, QR do domínio, cartão ao publicar, atribuição no lead e ref_bookings no banco", () => {
  const srv = ler("src/lib/data/cartoes-servidor.ts");
  assert.match(srv, /select\("title, address, city, monthly_price, min_period_days"\)/);
  assert.doesNotMatch(srv, /exact_address|phone|email|cpf/);
  const img = ler("src/app/cartoes/[curto]/imagem/route.tsx");
  assert.match(img, /nomeNoCartao\(d\.nomeCompleto, d\.mostrarNome\)/);
  assert.match(img, /mesAno\(d\.inicioEstadia\)/);
  assert.match(img, /AbortSignal\.timeout\(1200\)/, "foto lenta não segura o cartão");
  assert.match(img, /urlAssinada\(admin, cartao, "qr"\)/);
  assert.match(ler("src/lib/data/actions.ts"), /garantirCartao\(adm, \{ tipo: "ownercard", usuarioId: user\.id, propertyId: id \}\)/);
  assert.match(ler("src/lib/data/actions.ts"), /atribuirLead\(adm, \{ propertyId, tenantId: user\.id/);
  assert.match(ler("src/lib/data/contrato-assinar-actions.ts"), /event: "anuncio_compartilhar"/);
  assert.match(ler("src/app/api/cron/automacoes/route.ts"), /gerarCartoesAutomaticos\(admin, hoje\)/);
  const sql = ler("supabase/migrations/0186_cartoes_compartilhaveis.sql");
  assert.match(sql, /'cards_generated', 'cards_shared', 'qr_scans', 'ref_listing_views', 'ref_bookings'/);
  assert.match(sql, /create trigger trg_cartao_ref_booking/);
  assert.match(sql, /codigos_compartilhamento_um_ativo on public\.codigos_compartilhamento \(usuario_id\) where revogado_em is null/);
  const aplicar = ler("supabase/producao/aplicar-0186.sql");
  assert.match(aplicar, /^begin;/m);
  assert.match(aplicar, /20261019000186/);
  assert.match(ler("supabase/producao/rollback/0186_rollback.sql"), /delete from supabase_migrations\.schema_migrations where version = '20261019000186'/);
  // Fase 1: nada de recompensa, cupom ou texto livre.
  for (const f of ["src/lib/cartoes/compartilhar.ts", "src/lib/data/cartoes-actions.ts", "src/components/cartoes/cartao-compartilhar.tsx"]) {
    const codigo = ler(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
    assert.doesNotMatch(codigo, /cupom|recompensa|cr[eé]dito|desconto|textarea/i, f);
  }
});
