// ORDEM-DUET-534 (Gerente, 22/11/2026): a última faixa PUBLICADA passa de "16 ou mais" / "16+" a "16–19" (a partir de 20, a linha de carteiras, sem percentual). As asserções deste arquivo que cobravam "16 ou mais" foram ajustadas por essa decisão; o cálculo não mudou.
/*
  E224 — os dois lados do Plano Gestor: a linha da Conta (N, quantos faltam, liberado) e o tipo da conta no admin
  (motivo obrigatório; só admin; o observador da QA é recusado).
  Roda: node --test src/lib/planos/plano-gestor-e224.test.ts
  Asserções alteradas pelo prompt 078 (Daniel, 16/11/2026): a linha de Conta › Plano não fala mais do Plano Gestor ("Você tem N; faltam
  M." / "taxa de 4% nos próximos contratos") — diz a taxa de serviço de hoje da conta (textoTaxaNaConta) + a frase da escada com a linha
  das carteiras; a tela lê getTaxaDaConta (antes getGestorElegibilidade). O lado do admin (tipo da conta, motivo, trilha) não mudou.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as gestor from "./gestor.ts";
import { ROTULO_TIPO_CONTA, motivoTipoValido, textoTaxaNaConta } from "./gestor.ts";
import { faixaPorImoveisAtivos } from "../cobranca/regra.ts";
import { FRASE_ESCADA_TAXAS } from "../../config/textos-regulados.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("Conta › Plano: 'Sua taxa de serviço hoje é de X% (N imóveis ativos).' + a escada; taxa combinada diz que é combinada (078: sem Plano Gestor)", () => {
  // 078 (Daniel, 16/11/2026): antes a linha era textoElegibilidadeGestor (a meta do Plano Gestor); as funções de elegibilidade saíram.
  for (const saiu of ["textoElegibilidadeGestor", "gestorElegivel", "faltamParaGestor", "GESTOR_MIN_IMOVEIS_VALIDADOS"]) assert.equal(saiu in gestor, false, saiu);
  // A linha é a taxa da FAIXA dos imóveis ativos — o tipo da conta (individual ou administradora) nem entra na função.
  const linha = (n: number) => textoTaxaNaConta({ taxa: faixaPorImoveisAtivos(n).taxa, origem: "faixa", imoveisAtivos: n });
  const escada = "Quanto mais imóveis ativos, menor a taxa: 1–2 imóveis: 12% · 3–5 imóveis: 10% · 6–15 imóveis: 8% · 16–19 imóveis: 6%. Carteira a partir de 20 imóveis ou administradora de imóveis: fale com a Viva.";
  assert.equal(FRASE_ESCADA_TAXAS, escada);
  // 078 (Daniel, 16/11/2026): antes "Plano Gestor: taxa de 4% com 20 imóveis ativos (…). Você tem 0; faltam 20."
  assert.equal(linha(0), `Sua taxa de serviço hoje é de 12%. ${escada}`);
  assert.equal(linha(1), `Sua taxa de serviço hoje é de 12% (1 imóvel ativo). ${escada}`);
  // 078 (Daniel, 16/11/2026): antes "… Você tem 3; faltam 17."
  assert.equal(linha(3), `Sua taxa de serviço hoje é de 10% (3 imóveis ativos). ${escada}`);
  // 078 (Daniel, 16/11/2026): antes "… Você tem 19; faltam 1."
  assert.equal(linha(19), `Sua taxa de serviço hoje é de 6% (19 imóveis ativos). ${escada}`);
  // 078 (Daniel, 16/11/2026): antes, com 20 imóveis (ou conta de administradora), "Plano Gestor: taxa de 4% nos próximos contratos, sem
  // assinatura." Agora 20 imóveis = 6%, a última faixa; e a administradora vê a taxa da faixa dela como qualquer conta.
  assert.equal(linha(20), `Sua taxa de serviço hoje é de 6% (20 imóveis ativos). ${escada}`);
  // 078 (Daniel, 16/11/2026): os 4% só aparecem quando a taxa foi fixada pelo admin — e a linha diz que é combinada.
  assert.equal(textoTaxaNaConta({ taxa: 0.04, origem: "admin", imoveisAtivos: 3 }), `Sua taxa de serviço hoje é de 4%, combinada com a Viva. ${escada}`);
  for (const n of [0, 1, 3, 19, 20, 50]) assert.doesNotMatch(linha(n), /Plano Gestor|(?<![\d,.])4\s?%|faltam/);
});

test("a tela do proprietário não promete checkout: sem botão, sem link, sem 'assinar'", () => {
  const comp = ler("src/components/account/plano-gestor-conta.tsx");
  // 078 (Daniel, 16/11/2026): antes /getGestorElegibilidade\(\)/ e /textoElegibilidadeGestor\(e\)/ — a tela lê a taxa da conta e, sem
  // leitura, mostra só a frase da escada (nunca um número solto).
  assert.match(comp, /getTaxaDaConta\(\)/);
  assert.match(comp, /\{t === undefined \? "Carregando…" : t \? textoTaxaNaConta\(t\) : FRASE_ESCADA_TAXAS\}/);
  assert.doesNotMatch(comp, /getGestorElegibilidade|textoElegibilidadeGestor|data-elegivel/);
  assert.match(comp, /data-testid="conta-plano-gestor-texto" data-taxa=\{t \? String\(t\.taxa\) : undefined\} data-origem=\{t\?\.origem\}/);
  assert.doesNotMatch(comp, /<Button|<ButtonLink|<Link|<a |href=|Assinar|checkout/);
  const pag = ler("src/components/account/pagamentos-conta.tsx");
  assert.match(pag, /\{dono && <PlanoGestorConta \/>\}/);
  assert.match(ler("src/lib/conta/secoes.ts"), /plano: "pagamentos",/);
  // 078 (Daniel, 16/11/2026): antes "sem sessão a elegibilidade fecha com o mínimo real" (/faltam: GESTOR_MIN_IMOVEIS_VALIDADOS,/).
  // Agora, sem sessão (ou sem leitura), a ação devolve null — nenhuma taxa inventada —, e a taxa vem da MESMA leitura que congela a
  // taxa no aceite (taxaDoDonoAgora).
  const acoes = ler("src/lib/data/planos-actions.ts");
  const corpo = acoes.slice(acoes.indexOf("export async function getTaxaDaConta("), acoes.indexOf("export async function definirAccountType("));
  assert.ok(acoes.indexOf("export async function getTaxaDaConta(") > 0 && corpo.length > 0);
  assert.match(corpo, /if \(!user\) return null;/);
  assert.match(corpo, /const t = await taxaDoDonoAgora\(admin, user\.id\)\.catch\(\(\) => null\);/);
  assert.match(corpo, /return t \? \{ taxa: t\.taxa, origem: t\.origem, imoveisAtivos: t\.imoveisAtivos \} : null;/);
  assert.doesNotMatch(corpo, /0[.,]\d|\d ?%/, "nenhuma taxa escrita à mão na ação");
  assert.doesNotMatch(acoes, /getGestorElegibilidade|GESTOR_MIN_IMOVEIS_VALIDADOS|gestorElegivel|faltamParaGestor/);
});

test("tipo da conta: rótulos individual / administradora com os valores que a ação aceita; motivo obrigatório", () => {
  assert.deepEqual(ROTULO_TIPO_CONTA, { individual: "individual", gestor: "administradora" });
  assert.equal(motivoTipoValido(""), false);
  assert.equal(motivoTipoValido("   abc  "), false);
  assert.equal(motivoTipoValido(null), false);
  assert.equal(motivoTipoValido("Contrato de administradora"), true);
});

test("definirAccountType: só admin, recusa o observador, exige motivo — tudo antes de gravar; a trilha guarda o motivo", () => {
  const src = ler("src/lib/data/planos-actions.ts");
  const corpo = src.slice(src.indexOf("export async function definirAccountType("), src.indexOf("export interface MinhaAssinatura"));
  const pos = (re: RegExp) => {
    const i = corpo.search(re);
    assert.ok(i >= 0, String(re));
    return i;
  };
  const admin = pos(/supabase\.rpc\("is_admin"\)/);
  const soAdmin = pos(/if \(adm !== true\) return \{ ok: false, error: "Apenas administradores\." \};/);
  const observador = pos(/const recusaQa = await recusaObservador\(user\.id\);/);
  const motivo = pos(/if \(!motivoTipoValido\(motivo\)\) return \{ ok: false, error: "Escreva o motivo da troca\." \};/);
  const grava = pos(/\.update\(\{ account_type: novoTipo \}\)/);
  const trilha = pos(/from\("account_type_audit"\)\.insert\(/);
  assert.ok(admin < soAdmin && soAdmin < observador && observador < grava && motivo < grava && grava < trilha);
  assert.match(corpo, /reason: \(motivo \?\? ""\)\.trim\(\)\.slice\(0, 500\),/);
});

test("admin › Usuários: o controle chama definirAccountType com o motivo e só salva com motivo válido", () => {
  const ctl = ler("src/app/(dashboard)/admin/usuarios/tipo-conta.tsx");
  assert.match(ctl, /definirAccountType\(id, novo, motivo\)/);
  assert.match(ctl, /disabled=\{pendente \|\| !motivoTipoValido\(motivo\)\}/);
  assert.match(ctl, /Tipo da conta:/);
  const pagina = ler("src/app/(dashboard)/admin/usuarios/page.tsx");
  assert.match(pagina, /account_type"\)/);
  assert.equal((pagina.match(/<TipoConta id=\{u\.id\} tipo=\{u\.account_type === "gestor" \? "gestor" : "individual"\}(?: compacto)? \/>/g) ?? []).length, 2); // E991: na tabela, sem o rótulo visível
});
