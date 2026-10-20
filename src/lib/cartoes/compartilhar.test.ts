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

// ── Cartão do parceiro (partnercard, Prompt 31c) ───────────────────────────────────────────────────────────────
import {
  camposCartaoParceiro,
  FORMULAS_CARTAO_PARCEIRO,
  lerCookieRefParceiro,
  lerRefParceiro,
  limparTextoDoCartao,
  legendaParceiro,
  METRICAS_CARTAO_PARCEIRO,
  numerosCartaoParceiro,
  TEXTOS_PARCEIRO,
  urlDoCartaoParceiro,
  valorCookieRefParceiro,
} from "./compartilhar.ts";

const PARC = "22222222-3333-4444-8555-666666666666";
const urlParc = (meio: "qr" | "link" = "qr", ref = "ABCD-EFGH") =>
  new URL(urlDoCartaoParceiro({ base: "https://vivanomads.com.br", producao: true, chave: CHAVE, ref, parceiroId: PARC, slug: "ana-fotos", meio }));

test("partnercard: QR = /parceiros/<slug>?ref&utm_source=cartao&utm_medium=partnercard&sig=HMAC(ref+parceiroId), assinatura válida", () => {
  const u = urlParc();
  assert.equal(u.origin, "https://vivanomads.com.br");
  assert.equal(u.pathname, "/parceiros/ana-fotos");
  assert.deepEqual([...u.searchParams.keys()], ["ref", "utm_source", "utm_medium", "sig"]);
  assert.equal(u.searchParams.get("utm_source"), "cartao");
  assert.equal(u.searchParams.get("utm_medium"), "partnercard");
  assert.equal(u.searchParams.get("sig"), assinar(CHAVE, "ABCD-EFGH", PARC));
  const q = Object.fromEntries(u.searchParams);
  assert.deepEqual(lerRefParceiro(CHAVE, PARC, q), { ref: "ABCD-EFGH", meio: "qr", parceiroId: PARC });
  // O link curto (/c/<curto>) só acrescenta utm_content=link: a mesma assinatura vale, e a visita conta como link.
  assert.equal(lerRefParceiro(CHAVE, PARC, Object.fromEntries(urlParc("link").searchParams))?.meio, "link");
  assert.throws(() => urlDoCartaoParceiro({ base: "https://evil.com", producao: true, chave: CHAVE, ref: "ABCD-EFGH", parceiroId: PARC, slug: "ana-fotos", meio: "qr" }));
  assert.throws(() => urlDoCartaoParceiro({ base: "https://vivanomads.com.br", producao: true, chave: CHAVE, ref: "ABCD-EFGH", parceiroId: PARC, slug: "../admin", meio: "qr" }));
  assert.ok(METRICAS_CARTAO_PARCEIRO.includes("ref_partner_views") && METRICAS_CARTAO_PARCEIRO.includes("ref_partner_requests"));
});

test("partnercard: assinatura alterada, outro parceiro, ref trocado ou origem errada → sem atribuição", () => {
  const q = Object.fromEntries(urlParc().searchParams);
  const sig = q.sig;
  assert.equal(lerRefParceiro(CHAVE, PARC, { ...q, sig: (sig[0] === "a" ? "b" : "a") + sig.slice(1) }), null, "sig alterada");
  assert.equal(lerRefParceiro(CHAVE, OUTRO, q), null, "QR de outro parceiro");
  assert.equal(lerRefParceiro(CHAVE, PARC, { ...q, ref: "WXYZ-EFGH" }), null, "ref trocado");
  assert.equal(lerRefParceiro(CHAVE, PARC, { ...q, utm_source: "share_card" }), null);
  assert.equal(lerRefParceiro(CHAVE, PARC, { ...q, utm_medium: "ownercard" }), null);
  assert.equal(lerRefParceiro(CHAVE, PARC, {}), null);
  // A assinatura de um imóvel não vale para o parceiro (e vice-versa): o alvo faz parte do HMAC.
  assert.equal(lerRef(CHAVE, ID, { ...q, utm_source: "share_card", utm_medium: "qr", utm_campaign: "ownercard", utm_content: ID }), null, "QR do parceiro não vale num imóvel");
  assert.equal(lerRefParceiro(chaveDosCartoes("outro-segredo-qualquer-123"), PARC, q), null, "outra chave");
});

test("partnercard: código revogado → sem atribuição (a rota confere o código ATIVO da conta do parceiro)", () => {
  // Simula a conferência da rota /api/cartoes/visita: assinatura certa + código ativo + código da conta do parceiro.
  const ativos = new Map<string, string>([["ABCD-EFGH", "dono-1"]]);
  const parceiroDono = "dono-1";
  const atribui = (q: Record<string, string>) => {
    const p = lerRefParceiro(CHAVE, PARC, q);
    return !!p && ativos.get(p.ref) === parceiroDono;
  };
  const q = Object.fromEntries(urlParc().searchParams);
  assert.equal(atribui(q), true);
  ativos.delete("ABCD-EFGH"); // trocarCodigo: revogado_em preenchido
  ativos.set("JKMN-PQRS", "dono-1");
  assert.equal(atribui(q), false, "QR antigo, código revogado");
  assert.equal(atribui(Object.fromEntries(urlParc("qr", "JKMN-PQRS").searchParams)), true, "QR novo");
  // A rota liga as três condições (assinatura, código ativo, dono = parceiro, página publicada).
  const rota = ler("src/app/api/cartoes/visita/route.ts");
  assert.match(rota, /lerRefParceiro\(chaveServidor\(\), parceiroId, parametros\)/);
  assert.match(rota, /codigoAtivo\(admin, p\.ref\)/);
  assert.match(rota, /parceiro\.status !== "publicado" \|\| parceiro\.user_id !== dono\.usuarioId/);
  assert.match(rota, /"ref_partner_views"/);
  // Cookie do pedido separado do vn_ref do imóvel.
  const c = valorCookieRefParceiro({ ref: "ABCD-EFGH", meio: "qr", parceiroId: PARC });
  assert.deepEqual(lerCookieRefParceiro(c), { ref: "ABCD-EFGH", parceiroId: PARC });
  assert.equal(lerCookieRefParceiro("ABCD-EFGH|poststay|x"), null);
});

test("guarda de conteúdo: os campos da imagem do partnercard nunca levam telefone, e-mail, WhatsApp, documento, preço ou rede", () => {
  const PROIBIDO = /@|\d{4,}|whats|wpp|zap|telefone|e-?mail|cpf|cnpj|r\$|instagram|insta\b|facebook|tiktok|linkedin|https?:|www\./i;
  const sujo = {
    nomePublico: "Ana Fotos (34) 99999-1234 ana@exemplo.com WhatsApp R$ 150 instagram.com/ana 123.456.789-09",
    categorias: ["fotografia", "limpeza"],
    cidades: ["Uberlândia 34999991234", "Araguari", "Uberaba"],
    notaMedia: null,
    avaliacoesQtd: 0,
    fotoUrl: "https://x.supabase.co/storage/v1/object/public/parceiros/a.webp",
    // campos que a página tem mas o cartão nunca usa:
    telefone: "34999991234",
    email: "ana@exemplo.com",
    documento: "12345678909",
    preco_base: 150,
    instagram: "https://instagram.com/ana",
  };
  for (const mostrar of [true, false]) {
    const c = camposCartaoParceiro(sujo, mostrar);
    assert.deepEqual(Object.keys(c).sort(), ["categoria", "cidades", "fotoUrl", "nota", "selo", "titulo"]);
    const texto = [c.titulo, c.categoria, c.cidades, c.nota, c.selo].join(" | ");
    assert.doesNotMatch(texto, PROIBIDO, texto);
    assert.equal(c.categoria, "Fotografia", "só a categoria principal");
    assert.equal(c.cidades, "Uberlândia · Araguari", "até 2 cidades");
    assert.equal(c.nota, "Novo na Viva", "sem avaliação real");
    assert.equal(c.selo, "Parceiro Viva Nomads");
  }
  assert.equal(camposCartaoParceiro(sujo, false).titulo, "Fotografia", "sem o opt-in, o cartão mostra a categoria");
  assert.equal(camposCartaoParceiro(sujo, true).titulo, "Ana Fotos");
  assert.equal(camposCartaoParceiro({ ...sujo, notaMedia: 4.8, avaliacoesQtd: 12 }, true).nota, "★ 4,8 · 12 avaliações");
  assert.equal(camposCartaoParceiro({ ...sujo, notaMedia: 5, avaliacoesQtd: 0 }, true).nota, "Novo na Viva", "nota sem avaliação não aparece");
  assert.equal(camposCartaoParceiro({ ...sujo, fotoUrl: "javascript:alert(1)" }, true).fotoUrl, null);
  assert.equal(limparTextoDoCartao("Zap 34 9 9999-1234"), "");
  for (const t of [...Object.values(TEXTOS_PARCEIRO), legendaParceiro({ categoria: "Fotografia", cidade: "Uberlândia", link: "https://vivanomads.com.br/c/ABCDEFGHJK" })]) {
    assert.doesNotMatch(t, /whats|telefone|e-?mail|cupom|desconto|recompensa|comiss|aluguel|intermedia/i, t);
  }
  // A rota de imagem do partnercard só desenha camposCartaoParceiro (via dadosDoCartaoParceiro), e o servidor lê só
  // a view pública (sem documento, telefone, recebimento, CEP ou contato).
  const img = ler("src/app/cartoes/[curto]/imagem/route.tsx");
  const blocoParceiro = img.slice(img.indexOf("async function imagemDoParceiro"), img.indexOf("async function fotoComoDataUri"));
  assert.match(blocoParceiro, /dadosDoCartaoParceiro\(admin, cartao\)/);
  assert.doesNotMatch(blocoParceiro, /telefone|documento|preco|instagram|facebook|tiktok|linkedin|whats/i);
  const srv = ler("src/lib/data/cartoes-servidor.ts");
  const sel = /from\("parceiros_publicos"\)\s*\.select\("([^"]+)"\)/.exec(srv)?.[1] ?? "";
  assert.equal(sel, "id, slug, nome_publico, categorias, cidades, avatar_path, banner_path, nota_media, avaliacoes_qtd, teste");
  assert.match(srv, /camposCartaoParceiro\(/);
});

test("partnercard: admin conta sem contas de teste e escreve a fórmula; migração 0192 preserva os eventos da 0186", () => {
  const n = numerosCartaoParceiro({
    cartoes: [
      { parceiro_id: "p1", usuario_id: "u1" },
      { parceiro_id: "p2", usuario_id: "uTeste" },
      { parceiro_id: null, usuario_id: "u3" },
    ],
    pedidos: [
      { parceiro_id: "p1", cliente_id: "c1" },
      { parceiro_id: "p1", cliente_id: "cTeste" },
      { parceiro_id: "p2", cliente_id: "c1" },
    ],
    donoDoParceiro: new Map([["p1", "u1"], ["p2", "uTeste"]]),
    contasTeste: new Set(["uTeste", "cTeste"]),
  });
  assert.deepEqual(n.total, { gerados: 1, pedidos: 1 });
  assert.deepEqual(n.porParceiro.get("p1"), { gerados: 1, pedidos: 2 });
  assert.deepEqual(n.porParceiro.get("p2"), { gerados: 1, pedidos: 1 });
  const admin = ler("src/app/(dashboard)/admin/parceiros/page.tsx");
  assert.match(admin, /FORMULAS_CARTAO_PARCEIRO\.gerados/);
  assert.match(admin, /FORMULAS_CARTAO_PARCEIRO\.pedidos/);
  assert.match(FORMULAS_CARTAO_PARCEIRO.pedidos, /ref_tipo = partnercard/);
  const sql = ler("supabase/migrations/0192_cartao_parceiro.sql");
  assert.match(sql, /'cards_generated', 'cards_shared', 'qr_scans', 'ref_listing_views', 'ref_bookings',\s*'ref_partner_views', 'ref_partner_requests'/);
  assert.match(sql, /'busca', 'ver_anuncio', 'favoritar', 'iniciar_candidatura', 'enviar_candidatura',\s*'iniciar_cadastro', 'concluir_cadastro', 'publicar_pedido', 'iniciar_anuncio', 'publicar_anuncio'/);
  assert.match(sql, /tipo = 'partnercard' and parceiro_id is not null and property_id is null/);
  assert.match(sql, /create trigger trg_cartao_ref_pedido_parceiro/);
  const aplicar = ler("supabase/producao/aplicar-0192.sql");
  assert.match(aplicar, /^begin;/m);
  assert.match(aplicar, /set local lock_timeout = '5s';/);
  assert.match(aplicar, /'20261019000192', '0192_cartao_parceiro'/);
  assert.match(aplicar, /where not exists \(select 1 from supabase_migrations\.schema_migrations where version = '20261019000192'\)/);
  assert.match(ler("supabase/producao/rollback/0192_rollback.sql"), /delete from supabase_migrations\.schema_migrations where version = '20261019000192'/);
  // Painel: sem página publicada o botão fica desabilitado com o motivo; ação dentro de startTransition, sem refresh.
  const painel = ler("src/app/(dashboard)/dashboard/parceiro/painel-parceiro.tsx");
  assert.match(painel, /Publique sua página para gerar o cartão/);
  assert.match(painel, /disabled=\{!publicada \|\| pendente\}/);
  assert.match(painel, /Quem escanear cai na sua página na Viva e pede orçamento por lá\. Contato sempre pela plataforma\./);
  assert.doesNotMatch(painel, /router\.refresh|revalidatePath/);
  assert.match(ler("src/app/(public)/parceiros/[slug]/page.tsx"), /<RefDaVisita parceiroId=\{p\.id\} \/>/);
});
