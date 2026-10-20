/*
  Prompt 31a — regras puras dos parceiros: CPF/CNPJ, token, taxa, publicação, contato oculto, busca, view pública
  e a guarda de vocabulário (item 8). Roda: node --test src/lib/parceiros/regras.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  checklistCompleto,
  dividirValor,
  emailMascarado,
  faltaParaPublicar,
  filtrarParceiros,
  finalRecebimento,
  lerParceiroGeral,
  mesmoEmail,
  mostrarParceiroGeral,
  PAGAMENTO_EM_BREVE,
  recorteImagem,
  REGRAS_CLARAS,
  situacaoToken,
  slugBase,
  textoPreco,
  urlPublicaValida,
  validarRede,
  validarSolicitacao,
  type ParceiroNaBusca,
  type SolicitacaoEntrada,
} from "./regras.ts";
import { gerarToken, hashToken, tokenBemFormado } from "./token.ts";

const CPF_OK = "529.982.247-25";
const CNPJ_OK = "11.222.333/0001-81";
const base: SolicitacaoEntrada = {
  nome: "Marina Souza Fotos",
  tipoPessoa: "pf",
  documento: CPF_OK,
  categorias: ["fotografia"],
  cidades: ["Uberlândia", " uberlandia ", "Araguari"],
  portfolioUrl: "marinafotos.com.br",
  aceite: true,
};

test("CPF/CNPJ: dígitos verificadores conferidos; PF com CPF e PJ com CNPJ", () => {
  const ok = validarSolicitacao(base);
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.equal(ok.valor.documento, "52998224725");
    assert.deepEqual(ok.valor.cidades, ["Uberlândia", "Araguari"], "cidades repetidas (acento/maiúscula) saem");
    assert.equal(ok.valor.portfolioUrl, "https://marinafotos.com.br/");
  }
  assert.equal(validarSolicitacao({ ...base, documento: "529.982.247-26" }).ok, false);
  assert.equal(validarSolicitacao({ ...base, documento: "111.111.111-11" }).ok, false);
  assert.equal(validarSolicitacao({ ...base, tipoPessoa: "pj", documento: CNPJ_OK }).ok, true);
  assert.equal(validarSolicitacao({ ...base, tipoPessoa: "pj", documento: CPF_OK }).ok, false);
});

test("campos por categoria: fotografia exige portfólio; mudança empresa + veículo; demais, descrição", () => {
  assert.equal(validarSolicitacao({ ...base, portfolioUrl: "" }).ok, false);
  assert.equal(validarSolicitacao({ ...base, portfolioUrl: "javascript:alert(1)" }).ok, false);
  assert.equal(validarSolicitacao({ ...base, categorias: ["mudanca"], portfolioUrl: "" }).ok, false);
  assert.equal(validarSolicitacao({ ...base, categorias: ["mudanca"], empresa: "Leva Já", veiculo: "Baú 3/4" }).ok, true);
  assert.equal(validarSolicitacao({ ...base, categorias: ["limpeza"] }).ok, false);
  assert.equal(validarSolicitacao({ ...base, categorias: ["limpeza"], descricao: "Limpeza pós-obra e de saída." }).ok, true);
  assert.equal(validarSolicitacao({ ...base, aceite: false }).ok, false);
  assert.equal(validarSolicitacao({ ...base, telefone: "123" }).ok, false);
});

test("token: 32 bytes aleatórios, banco guarda só o sha256; 7 dias e uso único", () => {
  const t = gerarToken();
  assert.ok(tokenBemFormado(t));
  assert.notEqual(gerarToken(), t);
  assert.match(hashToken(t), /^[0-9a-f]{64}$/);
  assert.equal(tokenBemFormado("abc"), false);
  const agora = new Date("2026-10-19T12:00:00Z");
  assert.equal(situacaoToken({ status: "aprovada", tokenExpiraEm: "2026-10-26T12:00:00Z" }, agora), "valido");
  assert.equal(situacaoToken({ status: "aprovada", tokenExpiraEm: "2026-10-19T11:59:59Z" }, agora), "vencido");
  assert.equal(situacaoToken({ status: "ativada", tokenExpiraEm: "2026-10-26T12:00:00Z" }, agora), "usado");
  assert.equal(situacaoToken({ status: "recusada", tokenExpiraEm: null }, agora), "invalido");
  assert.equal(situacaoToken(null, agora), "invalido");
  assert.ok(mesmoEmail(" Marina@Exemplo.com ", "marina@exemplo.com"));
  assert.equal(mesmoEmail("a@x.com", "b@x.com"), false);
  assert.equal(emailMascarado("marina@exemplo.com"), "m•••@exemplo.com");
});

test("taxa de serviço: 10% em todas as categorias; divisão na origem 90/10 em centavos", () => {
  assert.deepEqual(dividirValor(500), { taxa: 50, parceiro: 450 });
  assert.deepEqual(dividirValor(333.33), { taxa: 33.33, parceiro: 300 });
  assert.deepEqual(dividirValor(-10), { taxa: 0, parceiro: 0 });
  assert.match(REGRAS_CLARAS[1], /10% sobre o valor do serviço, para todas as categorias/);
  assert.match(REGRAS_CLARAS[2], /90% vai direto para você e 10% para a Viva\. A Viva não guarda o seu dinheiro\./);
  assert.equal(PAGAMENTO_EM_BREVE, "Pagamento pela plataforma em breve.");
});

test("checklist: aprovar só com os 4 itens e o 'conferido em' do documento", () => {
  const tudo = { identidade: true, documento: true, area: true, categoria: true };
  assert.equal(checklistCompleto(tudo), false);
  assert.equal(checklistCompleto({ ...tudo, documento_conferido_em: "2026-10-19T12:00:00Z" }), true);
  assert.equal(checklistCompleto({ ...tudo, area: false, documento_conferido_em: "x" }), false);
});

test("publicação: foto, descrição, 1 serviço, 1 cidade e 3 fotos na galeria para fotografia", () => {
  const ok = { avatarPath: "a.webp", descricao: "Fotografia de imóveis mobiliados há 8 anos.", servicosAtivos: 1, cidades: ["Uberlândia"], categorias: ["fotografia"], fotosGaleria: 3 };
  assert.deepEqual(faltaParaPublicar(ok), []);
  assert.equal(faltaParaPublicar({ ...ok, fotosGaleria: 2 }).length, 1);
  assert.deepEqual(faltaParaPublicar({ ...ok, categorias: ["limpeza"], fotosGaleria: 0 }), []);
  assert.equal(faltaParaPublicar({ ...ok, avatarPath: null, servicosAtivos: 0, cidades: [] }).length, 3);
});

test("contato oculto: redes só https do domínio certo; recebimento só os 4 finais; preço ou 'Sob consulta'", () => {
  assert.deepEqual(validarRede("instagram", "instagram.com/marina"), { ok: true, valor: "https://instagram.com/marina" });
  assert.equal(validarRede("instagram", "https://evil.com/instagram.com").ok, false);
  assert.equal(validarRede("site", "mailto:a@b.com").ok, false);
  assert.equal(urlPublicaValida("https://user:senha@site.com"), null);
  assert.equal(finalRecebimento("marina@exemplo.com"), "•••• .com");
  assert.equal(finalRecebimento("12"), "••••");
  assert.equal(textoPreco(null, "por hora"), "Sob consulta");
  assert.equal(textoPreco(1500, "por serviço"), "R$ 1.500 por serviço");
  assert.equal(slugBase("Marina Souza Fotógrafa!"), "marina-souza-fotografa");
  assert.equal(slugBase("buscar"), "parceiro-buscar");
});

test("busca: só publicado e nunca conta de teste; cidade ou raio; nota real e depois os mais novos", () => {
  const p = (o: Partial<ParceiroNaBusca>): ParceiroNaBusca => ({ slug: "x", categorias: ["fotografia"], cidades: ["Uberlândia"], notaMedia: null, avaliacoesQtd: 0, publicadoEm: "2026-10-01T00:00:00Z", teste: false, status: "publicado", ...o });
  const lista = [
    p({ slug: "novo", publicadoEm: "2026-10-18T00:00:00Z" }),
    p({ slug: "antigo" }),
    p({ slug: "nota", notaMedia: 4.8, avaliacoesQtd: 3 }),
    p({ slug: "teste", teste: true }),
    p({ slug: "rascunho", status: "rascunho" }),
    p({ slug: "limpeza", categorias: ["limpeza"] }),
    p({ slug: "araguari", cidades: ["Araguari"], lat: -18.65, lng: -48.19, raioKm: 50 }),
  ];
  assert.deepEqual(filtrarParceiros(lista, { categoria: "fotografia", cidade: "uberlandia" }).map((x) => x.slug), ["nota", "novo", "antigo"]);
  assert.deepEqual(filtrarParceiros(lista, { categoria: "fotografia", cidade: "Uberlândia", ponto: { lat: -18.91, lng: -48.26 } }).map((x) => x.slug), ["nota", "novo", "antigo", "araguari"]);
  assert.deepEqual(filtrarParceiros(lista, { categoria: "mudanca", cidade: "Uberlândia" }), []);
});

test("cartão do parceiro geral: desligado por padrão, só na busca vazia e com nome", () => {
  assert.equal(mostrarParceiroGeral(lerParceiroGeral(null, false), 0), false);
  const g = lerParceiroGeral({ nome: "AquiResolve", cidade: "Uberlândia", descricao: "Pequenos reparos" }, true);
  assert.equal(mostrarParceiroGeral(g, 0), true);
  assert.equal(mostrarParceiroGeral(g, 2), false);
  assert.equal(mostrarParceiroGeral({ ...g, nome: "" }, 0), false);
});

test("imagens: recorte central (avatar 1:1, capa 3:1) e lado maior reduzido", () => {
  assert.deepEqual(recorteImagem(1000, 800, "avatar"), { sx: 100, sy: 0, sw: 800, sh: 800, ow: 512, oh: 512 });
  const b = recorteImagem(4000, 3000, "banner");
  assert.ok(Math.abs(b.sw / b.sh - 3) < 0.01);
  assert.equal(b.ow, 1800);
  assert.equal(recorteImagem(800, 600, "galeria").ow, 800);
});

const ler = (p: string) => readFileSync(p, "utf8");

test("view pública e migração 0190: sem documento, recebimento, telefone ou CEP; RLS só das partes; escrita só no servidor", () => {
  const m = ler("supabase/migrations/0190_parceiros_ciclo.sql");
  const funcao = m.slice(m.indexOf("create or replace function public.parceiros_publicos_lista()"), m.indexOf("create or replace view public.parceiros_publicos"));
  for (const proibido of ["documento", "dados_recebimento", "telefone", "cep_base", "email"]) assert.doesNotMatch(funcao, new RegExp(`p\\.${proibido}\\b`), proibido);
  assert.match(funcao, /where p\.status = 'publicado'/);
  assert.match(m, /create or replace view public\.parceiros_publicos\s+with \(security_invoker = on\)/);
  assert.match(m, /revoke all on public\.parceiros from public, anon, authenticated;\ngrant select on public\.parceiros to authenticated;/);
  assert.doesNotMatch(m, /grant (insert|update|delete)[^;]*to (anon|authenticated)/);
  assert.match(m, /using \(public\.parceiro_pedido_parte\(id\) or public\.is_admin\(\)\)/);
  assert.match(m, /parceiro_solicitacoes_uma_aberta_conta/);
  assert.match(m, /'PARCEIRO_GERAL_FALLBACK', false/);
  const ap = ler("supabase/producao/aplicar-0190.sql");
  assert.match(ap, /^begin;$/m);
  assert.match(ap, /'0190_parceiros_ciclo'/);
  assert.match(ler("supabase/producao/rollback/0190_rollback.sql"), /delete from supabase_migrations\.schema_migrations where version = '20261019000190'/);
});

test("ações: admin com 2FA (sessaoAal2) e registro de moderação; ativação confere o e-mail e é de uso único", () => {
  const admin = ler("src/lib/parceiros/admin-actions.ts");
  assert.match(admin, /sessaoAal2\(supabase\)/);
  for (const a of ["parceria_aprovada", "parceria_recusada", "parceria_ativacao_reenviada", "parceiro_suspenso"]) assert.match(admin, new RegExp(`logModeracao\\([^)]*"${a}"`), a);
  assert.match(admin, /if \(!checklistCompleto\(/);
  const at = ler("src/lib/parceiros/ativacao-actions.ts");
  assert.match(at, /if \(!mesmoEmail\(user\.email, sol\.email as string\)\)/);
  assert.match(at, /\.eq\("status", "aprovada"\)\s*\.select\("id"\)/);
  // O e-mail de ativação nunca leva o link no texto puro.
  assert.match(ler("src/lib/notifications/montar-email.ts"), /Use o botão "Ativar minha página" na versão completa deste e-mail/);
});

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? arquivos(p) : /\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
  });
}

test("guarda de vocabulário (item 8): parceiros e e-mails sem retém, repasse, intermediação, comissão, R$ 40/60/80, WhatsApp", () => {
  const alvo = [
    ...arquivos("src/app/(public)/parceiros"),
    ...arquivos("src/components/parceiros"),
    ...arquivos("src/lib/parceiros"),
    ...arquivos("src/app/(dashboard)/dashboard/parceiro"),
    ...arquivos("src/app/(dashboard)/admin/parceiros"),
  ];
  const emails = ler("src/lib/notifications/eventos-email.ts");
  const blocoEmails = emails.slice(emails.indexOf("parceria_recebida: {"), emails.indexOf("documento_recebido: {"));
  const textos = [...alvo.map((f) => [f, ler(f)] as const), ["eventos-email.ts (parceria)", blocoEmails] as const, ["montar-email.ts (ativação)", ler("src/lib/notifications/montar-email.ts").match(/export function emailParceriaAprovada[\s\S]*?\n}\n/)?.[0] ?? ""] as const];
  const proibidos = [/ret[ée]m\b/i, /repass/i, /intermedia/i, /comiss[ãa]o/i, /R\$\s?(40|60|80)(?![\d.,])/, /whatsapp/i, /a Viva não recebe esse dinheiro/i, /\baluguel\b/i, /apartamento/i];
  const achados: string[] = [];
  for (const [f, s] of textos) for (const r of proibidos) if (r.test(s)) achados.push(`${f}: ${r}`);
  assert.deepEqual(achados, []);
});
