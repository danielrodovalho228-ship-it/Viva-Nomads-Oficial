/*
  E951 — prova ao vivo automática por item, depois do deploy de produção. PURO (sem rede, sem Playwright).
  • extrairItens: os números de item (E\d+) do título e do corpo do PR mesclado no commit do deploy.
  • montarGrep: o --grep que roda SÓ os specs com @ao-vivo-seguro E com a etiqueta de um dos itens.
  • etiquetasDoSpec / indiceDeEtiquetas: as etiquetas (@E<n>, @ao-vivo-seguro) de cada spec, lidas do código.
  • motivosInseguros: a trava do @ao-vivo-seguro — spec que paga, assina, manda mensagem/e-mail para fora, escreve no
    banco por fora (chave de serviço) ou só roda no laboratório NÃO pode levar a etiqueta (teste estático em
    src/lib/ci/e951-ao-vivo-seguro.test.ts, que varre tests/e2e/specs/).
  • resultadoPorItem / comentarioDoPr: o que vai para lab_execucoes (gatilho 'ao-vivo') e para o comentário no PR.
  Sem etiqueta, sem prova automática: o item sem spec etiquetado sai como "prova automática: não há".
*/
import { fonteSemComentarios } from "../fonte-sem-comentarios.ts";

export const ETIQUETA_SEGURA = "@ao-vivo-seguro";
export const PRODUCAO = "https://vivanomads.com.br";

/** Números de item citados no título e no corpo, sem repetição, em ordem numérica ("E948", "E36"…). */
export function extrairItens(titulo: string | null | undefined, corpo?: string | null): string[] {
  const texto = `${titulo ?? ""}\n${corpo ?? ""}`;
  const nums = new Set<number>();
  // E seguido de dígitos, sem letra/dígito colado antes (não pega "PE948", "SE12" ou hashes) nem dígito depois.
  for (const m of texto.matchAll(/(?<![A-Za-z0-9_])E(\d{1,5})(?![A-Za-z0-9_])/g)) nums.add(Number(m[1]));
  return [...nums].sort((a, b) => a - b).map((n) => `E${n}`);
}

/** Lista digitada no workflow_dispatch ("E899, E948 e936") → itens normalizados. */
export function itensDaLista(lista: string | null | undefined): string[] {
  return extrairItens((lista ?? "").toUpperCase());
}

/**
 * O --grep único (o Playwright só aplica um): o teste precisa ter @ao-vivo-seguro E a etiqueta de algum dos itens.
 * As etiquetas entram no casamento do --grep junto com o título. Lookahead para exigir as duas; "(?![0-9])" para @E94 não
 * pegar @E948. Sem item → null (não roda nada genérico no lugar).
 */
export function montarGrep(itens: string[]): string | null {
  const validos = itens.filter((i) => /^E\d+$/.test(i));
  if (!validos.length) return null;
  return `(?=.*${ETIQUETA_SEGURA}(?![\\w-]))(?=.*@(?:${validos.join("|")})(?![0-9]))`;
}

/** As etiquetas de um spec: as do `tag: [...]` (string ou lista) e as escritas no título (`"… @E948 …"`). */
export function etiquetasDoSpec(fonte: string): string[] {
  const out = new Set<string>();
  for (const m of fonte.matchAll(/tag:\s*(\[[^\]]*\]|"[^"]*"|'[^']*')/g)) for (const t of m[1].matchAll(/@[\w-]+/g)) out.add(t[0]);
  for (const m of fonte.matchAll(/test(?:\.describe)?(?:\.\w+)?\(\s*(["'`])([^"'`]*)\1/g)) for (const t of m[2].matchAll(/@[\w-]+/g)) out.add(t[0]);
  return [...out].sort();
}

/** spec → etiquetas, só os specs que têm alguma. */
export function indiceDeEtiquetas(specs: Record<string, string>): Record<string, string[]> {
  const idx: Record<string, string[]> = {};
  for (const [arq, fonte] of Object.entries(specs)) {
    const e = etiquetasDoSpec(fonte);
    if (e.length) idx[arq] = e;
  }
  return idx;
}

/** Os specs que provam cada item ao vivo (têm @ao-vivo-seguro e @<item>). Item sem nenhum → lista vazia. */
export function specsPorItem(itens: string[], indice: Record<string, string[]>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const i of itens) out[i] = Object.entries(indice).filter(([, e]) => e.includes(ETIQUETA_SEGURA) && e.includes(`@${i}`)).map(([s]) => s).sort();
  return out;
}

/**
 * A trava: o que um spec @ao-vivo-seguro NÃO pode fazer em produção. Cada regra diz o motivo. A leitura é do código do
 * spec (e não do que ele importa): na dúvida, o spec não leva a etiqueta e a prova fica manual.
 */
export const FLUXOS_PROIBIDOS_AO_VIVO: { id: string; motivo: string; re: RegExp }[] = [
  {
    id: "pagamento",
    motivo: "chama fluxo de pagamento (Asaas, cobrança, checkout, Pix, cartão)",
    re: /\basaas\b|\/api\/(?:pagamentos?|cobranc|checkout|asaas|pix)|\b(?:gerar|criar|pagar)Cobranca\b|name:\s*\/[^/\n]*\b(?:Pagar|Confirmar pagamento|Gerar (?:Pix|boleto))\b/i,
  },
  {
    id: "assinatura",
    motivo: "chama fluxo de assinatura (ZapSign, assinar contrato)",
    re: /zapsign|\/api\/(?:assinatura|assinar|contratos\/[^"'`]*\/assinar)|\bassinarContrato\b|\btornarContratoVigente\b|name:\s*\/[^/\n]*\bAssinar\b/i,
  },
  {
    id: "envio-externo",
    motivo: "manda mensagem, e-mail ou WhatsApp (envio para fora das caixas de teste)",
    re: /\/api\/(?:mensagens|chat|emails?|whatsapp|notifica|enviar)|\bresend\b|\bwhatsapp\b|\b(?:enviarMensagem|gravarMensagem|enviarEmail)\b|name:\s*\/[^/\n]*\bEnviar(?: mensagem| e-mail| proposta| candidatura)?\b/i,
  },
  {
    id: "escrita-por-fora",
    motivo: "escreve no banco pela chave de serviço (conta/imóvel/contrato criado por fora: não é conta de teste da produção)",
    re: /\badm\(\)|SUPABASE_SERVICE_ROLE_KEY|\bcriarConta\(|\bcriarImovelPronto\(|\bcriarAdmin\(|\bcriarLead\(/,
  },
  {
    id: "formulario-publico",
    motivo: "envia formulário público (código de acesso por e-mail, lead, contato, cadastro de parceiro, pedido): grava e dispara envio em produção",
    re: /\/api\/(?:auth\/codigo|codigo|leads?|empresas|contato|pedidos|parceiros\/(?:cadastro|pedido)|orcamento|chamados|atendimento)\b|\/auth\/(?:enviar|codigo)/i,
  },
  {
    id: "login",
    motivo: "precisa de login: as contas de teste vivem no projeto de TESTE, não em produção (tests/e2e/global-setup.ts, TESTES_SO_PUBLICO)",
    re: /\bstorageState:(?!\s*\{\s*cookies:\s*\[\]\s*,\s*origins:\s*\[\]\s*\})|\bauthFile\(|\bloginAs\(|\bentrar(?:NaPagina)?\(|\babrirComoConta\(|\bhasAccount\(/,
  },
  {
    id: "so-laboratorio",
    motivo: "só roda no laboratório (NO_LABORATORIO / integrações simuladas): em produção se pularia e não provaria nada",
    re: /\bNO_LABORATORIO\b|INTEGRACOES_SIMULADAS|lerSaida\(|LAB_OUTBOX/,
  },
];

/**
 * Comentário de código não conta (a regra vale para o que o spec FAZ). E1164: o comentário de bloco sai pelo ajudante
 * único (um "/*" dentro de um texto não apaga mais o código até ao comentário seguinte); o fim de linha continua aqui.
 */
function semComentarios(fonte: string): string {
  return fonteSemComentarios(fonte).replace(/(^|[^:])\/\/.*$/gm, "$1");
}

export function motivosInseguros(fonte: string): { id: string; motivo: string }[] {
  const codigo = semComentarios(fonte);
  return FLUXOS_PROIBIDOS_AO_VIVO.filter((r) => r.re.test(codigo)).map(({ id, motivo }) => ({ id, motivo }));
}

// ───────────────────────────── resultado ─────────────────────────────

export type SituacaoItem = "passou" | "falhou" | "não há";
export interface ResultadoItem {
  situacao: SituacaoItem;
  specs: string[];
  passou: number;
  falhou: number;
  pulou: number;
}

/** Testes do relatório JSON do Playwright, achatados: arquivo, etiquetas e status final. */
export interface TesteExecutado {
  arquivo: string;
  etiquetas: string[];
  status: "passed" | "failed" | "timedOut" | "skipped" | "interrupted" | "flaky";
}

/** Achata o relatório --reporter=json (suites aninhadas) em testes com as etiquetas e o status final. */
export function testesDoRelatorio(relatorio: unknown): TesteExecutado[] {
  const out: TesteExecutado[] = [];
  type Suite = { file?: string; suites?: Suite[]; specs?: { file?: string; tags?: string[]; title?: string; tests?: { status?: string; tags?: string[]; results?: { status?: string }[] }[] }[] };
  const andar = (s: Suite, arquivo?: string) => {
    const arq = s.file ?? arquivo ?? "";
    for (const sp of s.specs ?? []) {
      for (const t of sp.tests ?? []) {
        const ultimo = t.results?.[t.results.length - 1]?.status;
        const st = t.status === "flaky" ? "flaky" : t.status === "skipped" ? "skipped" : ultimo === "passed" ? "passed" : (ultimo as TesteExecutado["status"]) ?? "failed";
        const tags = [...(sp.tags ?? []), ...(t.tags ?? [])].map((x) => (x.startsWith("@") ? x : `@${x}`));
        out.push({ arquivo: sp.file ?? arq, etiquetas: [...new Set(tags)], status: st });
      }
    }
    for (const filho of s.suites ?? []) andar(filho, arq);
  };
  for (const s of ((relatorio as { suites?: Suite[] })?.suites ?? [])) andar(s);
  return out;
}

/** Resultado por item: "não há" sem spec etiquetado; senão passou só se todos passaram (instável conta como falha). */
export function resultadoPorItem(itens: string[], testes: TesteExecutado[], porItem: Record<string, string[]>): Record<string, ResultadoItem> {
  const out: Record<string, ResultadoItem> = {};
  for (const i of itens) {
    const specs = porItem[i] ?? [];
    const meus = testes.filter((t) => t.etiquetas.includes(`@${i}`) && t.etiquetas.includes(ETIQUETA_SEGURA));
    const passou = meus.filter((t) => t.status === "passed").length;
    const pulou = meus.filter((t) => t.status === "skipped").length;
    const falhou = meus.length - passou - pulou;
    const situacao: SituacaoItem = !specs.length || meus.length === 0 || passou === 0 && falhou === 0 ? "não há" : falhou > 0 ? "falhou" : "passou";
    out[i] = { situacao, specs, passou, falhou, pulou };
  }
  return out;
}

/** Comentário no PR (uma linha por item; sem dado pessoal, só contagens e nomes de spec). */
export function comentarioDoPr(resultado: Record<string, ResultadoItem>, o: { alvo: string; sha: string; runUrl: string }): string {
  const linhas = [`### Prova ao vivo automática (E951) — ${o.alvo}`, "", `Commit \`${o.sha.slice(0, 9)}\` · [execução](${o.runUrl})`, "", "| Item | Prova automática | Specs | Passou / falhou / pulou |", "|---|---|---|---|"];
  for (const [item, r] of Object.entries(resultado)) {
    const marca = r.situacao === "passou" ? "passou" : r.situacao === "falhou" ? "falhou" : "prova automática: não há";
    linhas.push(`| ${item} | ${marca} | ${r.specs.map((s) => `\`${s.replace(/^tests\/e2e\/specs\//, "")}\``).join(", ") || "—"} | ${r.situacao === "não há" ? "—" : `${r.passou} / ${r.falhou} / ${r.pulou}`} |`);
  }
  if (!Object.keys(resultado).length) linhas.push("| — | o PR não cita nenhum item (E\\d+): nada rodou | — | — |");
  linhas.push("", "Só rodam specs com `@ao-vivo-seguro` e a etiqueta do item. Sem etiqueta, sem prova automática: nada genérico roda no lugar.");
  return linhas.join("\n");
}
