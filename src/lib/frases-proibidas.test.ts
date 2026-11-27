// ORDEM-DUET-534 (Gerente, 22/11/2026): a última faixa PUBLICADA passa de "16 ou mais" / "16+" a "16–19" (a partir de 20, a linha de carteiras, sem percentual). As asserções deste arquivo que cobravam "16 ou mais" foram ajustadas por essa decisão; o cálculo não mudou.
/*
  E776 — gate de frases proibidas no CI + fontes únicas das frases reguladas.
  Roda: node --test src/lib/frases-proibidas.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { FORA_DO_GATE, FRASES_PROIBIDAS, HISTORICO_078, achadosProibidos, semComentarios } from "./frases-proibidas.ts";
import { CAUCAO_FRASE, CONTATO_NUNCA_TROCADO, DIFERENCIAL_CHAT, FRASE_CONVERSA_CHAT, NOTA_CONTATO_MENSAGENS, NOTA_VISITA_DONO, PASSO_CONVERSE_TEXTO, TEXTO_REGRA_UNICA } from "../config/textos-regulados.ts";

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === "node_modules" || n === ".next" ? [] : arquivos(p);
    return /\.(ts|tsx)$/.test(n) && !/\.test\.ts$/.test(n) ? [p] : [];
  });
}

test("as regras pegam o que deve pegar e deixam passar o que é correto", () => {
  const ruim = {
    "contato-depois-do-aceite": ["telefone e contato direto só depois do aceite.", "Telefone e e-mail só aparecem depois do aceite.", "contato direto só depois do aceite"],
    "caucao-em-poupanca": ["Caução de até 3 vezes o valor mensal, depositada em poupança", "A Caução fica em uma poupança e volta", "Caução na poupança"],
    "taxa-cobrada-do-morador": ["a taxa é cobrada do morador no aceite", "taxa paga pelo inquilino"],
  } as const;
  for (const [id, frases] of Object.entries(ruim)) for (const f of frases) assert.ok(achadosProibidos(f).some((a) => a.id === id), `${id}: ${f}`);
  const boa = [FRASE_CONVERSA_CHAT, PASSO_CONVERSE_TEXTO, DIFERENCIAL_CHAT, NOTA_CONTATO_MENSAGENS, NOTA_VISITA_DONO, CAUCAO_FRASE, TEXTO_REGRA_UNICA, "Nome completo depois do aceite; telefone nunca é trocado.", "O endereço exato só é liberado após o aceite da candidatura."];
  for (const f of boa) assert.deepEqual(achadosProibidos(f), [], f);
});

test("GATE: nenhuma superfície de src/ usa uma formulação proibida (exceto as fora do gate, justificadas)", () => {
  const achados: string[] = [];
  for (const f of arquivos("src")) {
    const caminho = f.split("\\").join("/");
    if (FORA_DO_GATE.some((x) => caminho.startsWith(x.prefixo) || caminho === x.prefixo)) continue;
    if (caminho === "src/lib/frases-proibidas.ts") continue;
    for (const a of achadosProibidos(semComentarios(readFileSync(f, "utf8")).join("\n"), caminho)) achados.push(`${caminho} [${a.id}] ${a.trecho}`);
  }
  assert.deepEqual(achados, []);
});

test("as exceções do gate existem de verdade (nada de exceção para arquivo que sumiu)", () => {
  for (const x of FORA_DO_GATE) assert.ok(existsSync(x.prefixo), x.prefixo);
  assert.equal(new Set(FRASES_PROIBIDAS.map((r) => r.id)).size, FRASES_PROIBIDAS.length);
});

test("FONTE ÚNICA: as frases de contato vêm de textos-regulados e as telas as importam", () => {
  assert.match(FRASE_CONVERSA_CHAT, new RegExp(CONTATO_NUNCA_TROCADO));
  assert.match(PASSO_CONVERSE_TEXTO, new RegExp(CONTATO_NUNCA_TROCADO));
  const conversa = readFileSync("src/config/conversa-chat.ts", "utf8");
  assert.match(conversa, /from "\.\/textos-regulados\.ts"/);
  assert.doesNotMatch(conversa, /export const \w+ =/, "conversa-chat só reexporta");
  // E764 (main): o estado vazio das mensagens tem a própria fonte (lib/mensagens-vazio.ts); a tela só a usa, e o gate a varre.
  assert.match(readFileSync("src/app/(dashboard)/dashboard/mensagens/messages-client.tsx", "utf8"), /\{TEXTO_MENSAGENS_VAZIO\}/);
  assert.match(readFileSync("src/app/(dashboard)/dashboard/visitas/page.tsx", "utf8"), /NOTA_VISITA_DONO/);
  // Caução e taxas: uma fonte só, reexportada.
  const regulados = readFileSync("src/config/textos-regulados.ts", "utf8");
  assert.match(regulados, /export \{ CAUCAO_FRASE \} from "\.\.\/lib\/faixas\.ts"/);
  assert.match(regulados, /export \{ TEXTO_REGRA_UNICA \} from "\.\.\/lib\/cobranca\/regra\.ts"/);
});

test("E776: a frase que nega a troca de contato (E764) passa; o interior de comentário de bloco não é superfície", () => {
  assert.deepEqual(achadosProibidos("Telefone e e-mail nunca são trocados na conversa: aparecem como “contato protegido”, em qualquer fase, inclusive depois do aceite."), []);
  assert.equal(achadosProibidos("o telefone só aparece depois do aceite").length, 1, "a formulação proibida continua barrada");
  assert.deepEqual(semComentarios("/*\n  dizia telefone só depois do aceite\n*/\nconst a = 1;"), ["", "", "", "const a = 1;"]);
});

test("GATE (fora de src/): e-mails, seeds, scripts e arquivos públicos também não usam formulação proibida", () => {
  // Inventário E776: supabase/ (seeds, templates de e-mail), public/ e scripts/ estavam sem varredura. tests/ e docs/ ficam de fora
  // de propósito: guardam as formulações ruins como exemplo de teste e descrevem as próprias regras.
  const achados: string[] = [];
  const varrer = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const n of readdirSync(dir)) {
      if (n === "node_modules" || n === ".next" || n === "saida") continue;
      const p = join(dir, n);
      const s = statSync(p);
      if (s.isDirectory()) { varrer(p); continue; }
      if (!/\.(ts|tsx|mjs|js|sql|json|md|html|txt)$/.test(n) || s.size > 2_000_000) continue;
      const bruto = readFileSync(p, "utf8");
      // Comentário de SQL ("-- …") também não é superfície (as migrações antigas são imutáveis e comentam o que fizeram).
      const texto = /\.(ts|tsx|mjs|js)$/.test(n) ? semComentarios(bruto).join("\n") : /\.sql$/.test(n) ? bruto.split("\n").filter((l) => !/^\s*--/.test(l)).join("\n") : bruto;
      // O arquivo vai só para a exceção de histórico (prompt 078); o escopo das regras continua sem caminho.
      for (const a of achadosProibidos(texto, undefined, p.split("\\").join("/"))) achados.push(`${p.split("\\").join("/")} [${a.id}] ${a.trecho}`);
    }
  };
  for (const raiz of ["supabase", "public", "scripts"]) varrer(raiz);
  assert.deepEqual(achados, []);
});

test("E785: variantes de 'contato protegido até o aceite' são barradas; as frases certas e as que NEGAM passam", () => {
  for (const ruim of [
    "Contato protegido até o aceite",
    "com o contato protegido até o aceite.",
    "O telefone fica oculto até o aceite",
    "Seu e-mail é liberado só depois do aceite",
    "Protegemos o seu contato até o aceite",
    "Contato do proprietário e identidade do morador ficam protegidos até o aceite.",
  ]) assert.ok(achadosProibidos(ruim).length >= 1, `deveria barrar: ${ruim}`);
  for (const boa of [
    "Perfil verificado",
    "telefone, e-mail e redes sociais nunca são trocados",
    "O nome completo do interessado aparece depois do aceite; telefone e e-mail nunca são trocados.",
    "Telefone e e-mail nunca são trocados: ficam protegidos, inclusive depois do aceite.",
  ]) assert.deepEqual(achadosProibidos(boa), [], `não deveria barrar: ${boa}`);
});

test("E785: a fonte única tem o selo e a frase da negociação, e as telas as importam", () => {
  const regulados = readFileSync("src/config/textos-regulados.ts", "utf8");
  assert.match(regulados, /export const SELO_PERFIL_VERIFICADO = "Perfil verificado"/);
  assert.match(regulados, /export const FRASE_NEGOCIACAO_NA_PLATAFORMA/);
  assert.match(readFileSync("src/app/(public)/page.tsx", "utf8"), /SELO_VERIFICACOES_ANUNCIANTE/); // E827: a faixa usa o selo com lastro
  assert.match(readFileSync("src/lib/precos-pagina.ts", "utf8"), /FRASE_NEGOCIACAO_NA_PLATAFORMA/);
});

test("E785 (decisão de 09/11): 'contato do proprietário' entregue/revelado pela plataforma entra; 'sem contato por fora' não", () => {
  for (const ruim of [
    "Passamos o contato do proprietário para você.",
    "A Viva entrega o contato do proprietário depois da visita.",
    "Você recebe o contato do dono assim que o pedido é aceito.",
    "Contato do proprietário liberado após a assinatura.",
    "O contato do anfitrião é revelado no chat.",
  ]) assert.ok(achadosProibidos(ruim).some((a) => a.id === "plataforma-entrega-contato-do-proprietario"), `deveria barrar: ${ruim}`);
  for (const boa of [
    "Sem contato por fora: tudo pelo chat da Viva.",
    "Combine tudo pelo chat; sem contato por fora da plataforma.",
    "A Viva nunca entrega o contato do proprietário: telefone e e-mail nunca são trocados.",
    "Não passamos o contato do proprietário.",
    "Fale com o proprietário pelo chat da Viva.",
  ]) assert.deepEqual(achadosProibidos(boa).filter((a) => a.id === "plataforma-entrega-contato-do-proprietario"), [], `não deveria barrar: ${boa}`);
});

test("078 (Daniel, 16/11/2026): 'Plano Gestor' e a taxa de 4% são barrados em qualquer superfície; a escada nova e a linha de carteiras passam", () => {
  for (const ruim of [
    "Ver o Plano Gestor",
    "Taxa menor por volume e plano gestor.",
    "O Plano  Gestor tem taxa de 4%, sem mensalidade.",
  ]) assert.ok(achadosProibidos(ruim).some((a) => a.id === "plano-gestor-publico"), `deveria barrar: ${ruim}`);
  for (const ruim of [
    "Quanto mais imóveis, menor a taxa (até 4%).",
    "Taxa de serviço de 4% sobre o valor total de cada contrato",
    "4% por contrato, sem assinatura",
    "Gestor: 4 % para carteiras de 20 ou mais imóveis",
    "Para administradoras a Viva cobra 4%",
  ]) assert.ok(achadosProibidos(ruim).some((a) => a.id === "taxa-de-4-publica"), `deveria barrar: ${ruim}`);
  for (const boa of [
    "Quanto mais imóveis ativos, menor a taxa: 1–2 imóveis: 12% · 3–5 imóveis: 10% · 6–15 imóveis: 8% · 16–19 imóveis: 6%. Carteira a partir de 20 imóveis ou administradora de imóveis: fale com a Viva.",
    "Anunciar é grátis. A Viva cobra 12% sobre o valor total do contrato fechado. Quanto mais imóveis, menor a taxa (até 6%). Sem mensalidade.",
    "A taxa de 14% do concorrente",
    "taxa de 4,5% do cartão",
    "Gestor profissional",
    "o proprietário tem até 4 horas para responder",
  ]) assert.deepEqual(achadosProibidos(boa), [], `não deveria barrar: ${boa}`);
});

test("078: a exceção de histórico vale só para as duas regras novas, e cada arquivo de histórico existe", () => {
  for (const h of HISTORICO_078) assert.ok(existsSync(h.prefixo), h.prefixo);
  const frase = "o Plano Gestor tem taxa de 4% por contrato";
  assert.deepEqual(achadosProibidos(frase, undefined, "supabase/migrations/0293_faixa_gestor_4.sql"), []);
  assert.equal(achadosProibidos(frase, "src/app/(public)/page.tsx").length, 2, "em tela, as duas regras pegam");
  // O histórico não libera as outras regras.
  assert.equal(achadosProibidos("a taxa é cobrada do morador no aceite", undefined, "supabase/migrations/0293_faixa_gestor_4.sql").length, 1);
  for (const id of ["plano-gestor-publico", "taxa-de-4-publica"]) assert.ok(FRASES_PROIBIDAS.find((r) => r.id === id)?.historico?.length, id);
});
