/*
  E950 — varredura automática da área logada e do admin (alavanca 2). PURO: sem Playwright, sem rede, sem banco.
  Roda no `npm test` (tests/laboratorio/e950-varredura-classificador.test.ts) e é usado pela spec
  tests/e2e/specs/t1649-e950-varredura-logada-admin.spec.ts e por scripts/lab/juntar-varredura-logada.mjs.

  • lerInventario: as rotas do Apêndice A de docs/e793-painel-sessao-servidor.md (108 páginas).
  • rotasDaPersona / resolverRota: que rota cada persona varre e com que registro semeado; sem registro → "não varrida".
  • classificar: transforma o que a página mostrou (status, URL final, console, imagens, larguras, texto, esqueleto)
    em achados tipados. Achado NÃO é falha da spec: o Gerente transforma os achados em itens.
  • juntar / resumoMarkdown: o JSON de saída e o resumo do job, com a cobertura (rotas varridas ÷ rotas do inventário).
*/
import { achadosProibidos } from "../../../src/lib/frases-proibidas.ts";

export const PERSONAS = ["morador", "proprietario", "dois-papeis", "parceiro", "admin"] as const;
export type Persona = (typeof PERSONAS)[number];
export const LARGURAS = [390, 1280] as const;
export type Largura = (typeof LARGURAS)[number];

/** Conta da massa da varredura (scripts/lab/massa-varredura.mjs) de cada persona; o admin usa a sessão AAL2 do global-setup. */
export const CONTA_DA_PERSONA: Record<Exclude<Persona, "admin">, "INQUILINA" | "DONO17" | "TRES" | "PARCEIRO"> = {
  morador: "INQUILINA",
  proprietario: "DONO17",
  "dois-papeis": "TRES",
  parceiro: "PARCEIRO",
};

export const TIPOS_ACHADO = {
  http: "status HTTP diferente de 200 (ou a tela não abriu)",
  redirecionamento: "redirecionamento inesperado (a tela pedida não é a que abriu)",
  console: "erro de console",
  pageerror: "erro da página (exceção não tratada)",
  hidratacao: "erro de hidratação do React (Hydration / did not match / #418 #423 #425)",
  "imagem-quebrada": "imagem quebrada (naturalWidth === 0)",
  "estouro-horizontal": "estouro horizontal (scrollWidth > clientWidth no body)",
  "frase-proibida": "frase proibida (mesmo gate do E776/E785: src/lib/frases-proibidas.ts)",
  "texto-quebrado": "texto undefined, null, NaN, R$ NaN ou [object Object] visível",
  "esqueleto-preso": "esqueleto (auth-guard-carregando ou Skeleton*) ainda visível 5 s depois do carregamento",
} as const;
export type TipoAchado = keyof typeof TIPOS_ACHADO;

export const RE_HIDRATACAO = /Hydration|did not match|Minified React error #(418|423|425)/;
export const RE_TEXTO_QUEBRADO = /R\$\s?NaN|\[object Object\]|\bundefined\b|\bnull\b|\bNaN\b/g;
/** Seletor do esqueleto: a casca do auth-guard e os Skeleton* de src/components/ui/skeleton.tsx. */
export const SELETOR_ESQUELETO = '[data-testid="auth-guard-carregando"], [data-testid^="skeleton"], .animate-pulse';
export const ESPERA_ESQUELETO_MS = 5_000;

/**
 * Telas do fluxo de PARCEIROS ficam fora do gate de frases (mesma exceção explícita do FORA_DO_GATE em
 * src/lib/frases-proibidas.ts: depois do aceite, o contato do parceiro é liberado por regra própria, L2-B item 16).
 */
export const ROTAS_FORA_DO_GATE: { prefixo: string; motivo: string }[] = [
  { prefixo: "/dashboard/parceiro", motivo: "fluxo de parceiros (FORA_DO_GATE, L2-B item 16)" },
  { prefixo: "/dashboard/servicos", motivo: "fluxo de parceiros (FORA_DO_GATE, L2-B item 16)" },
  { prefixo: "/admin/parceiros", motivo: "fluxo de parceiros (FORA_DO_GATE, L2-B item 16)" },
];

/**
 * Rotas que redirecionam de propósito (ORDEM-DUET-102): a tabela "Redirecionam de propósito" do Apêndice A. Para cada uma,
 * a varredura AFIRMA o destino: ir para o destino nomeado é a regra (sem achado); ir para outro lugar, ou ficar na própria
 * tela, continua sendo achado de redirecionamento. `larguraMinima`: a regra só vale a partir dessa largura (ex.: a Conta).
 */
export interface RedirecionamentoDeProposito {
  de: string;
  para: string;
  larguraMinima?: number;
  motivo: string;
}

const TITULO_REDIRECIONAMENTOS = "### Redirecionam de propósito";

/** A tabela "Redirecionam de propósito" do Apêndice A: | `de` | `para` | larguras | motivo |. */
export function lerRedirecionamentos(markdown: string): RedirecionamentoDeProposito[] {
  const i = markdown.indexOf(TITULO_REDIRECIONAMENTOS);
  if (i < 0) return [];
  const resto = markdown.slice(i);
  const fim = resto.search(/\n##? /);
  const bloco = fim < 0 ? resto : resto.slice(0, fim);
  const regras: RedirecionamentoDeProposito[] = [];
  for (const linha of bloco.split("\n")) {
    const m = /^\|\s*`(\/[^`]*)`\s*\|\s*`(\/[^`]*)`\s*\|\s*([^|]*)\|\s*([^|]*)\|/.exec(linha);
    if (!m) continue;
    const minima = /(\d+)\s*px/.exec(m[3]);
    regras.push({ de: m[1], para: m[2], ...(minima ? { larguraMinima: Number(minima[1]) } : {}), motivo: m[4].trim() });
  }
  return regras;
}

// ───────────────────────────── inventário ─────────────────────────────

/** As rotas da tabela do Apêndice A (a 1ª coluna, entre crases), na ordem do documento, sem repetição. */
export function lerInventario(markdown: string): string[] {
  const i = markdown.indexOf("## Apêndice A");
  if (i < 0) return [];
  const resto = markdown.slice(i);
  const fim = resto.indexOf("\n## ", 5);
  let bloco = fim < 0 ? resto : resto.slice(0, fim);
  // A tabela dos redirecionamentos de propósito fica dentro do Apêndice A, mas não é inventário (as telas dela já estão nele).
  const sub = bloco.indexOf(TITULO_REDIRECIONAMENTOS);
  if (sub >= 0) bloco = bloco.slice(0, sub);
  const rotas: string[] = [];
  for (const linha of bloco.split("\n")) {
    const m = /^\|\s*`(\/[^`]*)`\s*\|/.exec(linha);
    if (m && !rotas.includes(m[1])) rotas.push(m[1]);
  }
  return rotas;
}

/** O admin varre o /admin; as outras quatro personas varrem o painel (/dashboard e as demais rotas fora do /admin). */
export function rotasDaPersona(persona: Persona, inventario: string[]): string[] {
  return inventario.filter((r) => (persona === "admin" ? r === "/admin" || r.startsWith("/admin/") : !(r === "/admin" || r.startsWith("/admin/"))));
}

export interface Massa {
  ids?: Record<string, string>;
  imovel17?: string;
  imovelTres?: string;
  contrato?: string;
  contratoTres?: string;
  parceiro?: string;
  parceiroTres?: string;
}

/** Seções de /dashboard/conta/[secao] (os `case` de src/app/(dashboard)/dashboard/conta/[secao]/page.tsx). */
export const SECOES_CONTA = ["perfil", "papeis", "dados", "privacidade", "notificacoes", "pagamentos", "ajuda"] as const;

/**
 * Rotas com parâmetro cujo registro a spec procura no banco do laboratório (só leitura, chave de serviço): o primeiro
 * registro da tabela em que a conta da persona aparece numa das colunas. `qualquer: true` = o admin vê qualquer um.
 */
export const BUSCAS_NO_BANCO: { rota: string; tabela: string; colunas: string[]; qualquer?: boolean; usaParceiro?: boolean; viaAvaliador?: boolean }[] = [
  { rota: "/dashboard/leads/[id]", tabela: "leads", colunas: ["owner_id", "tenant_id"] },
  { rota: "/dashboard/propostas/[id]", tabela: "propostas", colunas: ["owner_id", "tenant_id"] },
  { rota: "/dashboard/visitas/[id]", tabela: "visitas_video", colunas: ["owner_id", "tenant_id"] },
  { rota: "/dashboard/servicos/pedidos/[id]", tabela: "parceiro_pedidos", colunas: ["cliente_id", "parceiro_id"], usaParceiro: true },
  { rota: "/dashboard/avaliacao-imovel/[id]", tabela: "vistoria_pedidos", colunas: ["owner_id", "morador_id"] },
  // avaliador_id aponta para avaliadores_credenciamento (não para a conta): a spec acha o credenciamento do parceiro da persona.
  { rota: "/dashboard/parceiro/avaliacao/[pedido]", tabela: "vistoria_pedidos", colunas: ["avaliador_id"], viaAvaliador: true },
  { rota: "/admin/atendimento/[id]", tabela: "chamados", colunas: [], qualquer: true },
  { rota: "/admin/parceiros/pedidos/[id]", tabela: "parceiro_pedidos", colunas: [], qualquer: true },
];

export type Resolucao = { urls: string[] } | { motivo: string };
/** Achados do banco: rota → persona → id (ou null quando a busca não achou registro). */
export type ExtrasDoBanco = Partial<Record<string, Partial<Record<Persona, string | null>>>>;

const IMOVEL: Partial<Record<Persona, keyof Massa>> = { proprietario: "imovel17", "dois-papeis": "imovelTres" };
const CONTRATO: Partial<Record<Persona, keyof Massa>> = { morador: "contrato", "dois-papeis": "contratoTres", admin: "contrato" };

/** A(s) URL(s) de uma rota do inventário para a persona, com os registros da semeadura; sem registro → o motivo. */
export function resolverRota(rota: string, persona: Persona, massa: Massa | null, extras: ExtrasDoBanco = {}): Resolucao {
  if (!rota.includes("[")) return { urls: [rota] };
  if (rota === "/dashboard/conta/[secao]") return { urls: SECOES_CONTA.map((s) => `/dashboard/conta/${s}`) };
  const troca = (campo: keyof Massa | undefined, rotulo: string): Resolucao => {
    const id = campo && massa ? (massa[campo] as string | undefined) : undefined;
    if (!massa) return { motivo: "laboratório sem a massa da varredura (tests/laboratorio/saida/varredura.json)" };
    if (!id) return { motivo: `a semeadura do lab não cria ${rotulo} para a persona ${persona}` };
    return { urls: [rota.replace(/\[[^\]]+\]/, id)] };
  };
  if (rota.startsWith("/dashboard/imoveis/[id]")) return troca(IMOVEL[persona], "imóvel");
  if (rota.startsWith("/dashboard/estadia/[contratoId]") || rota.startsWith("/dashboard/contratos/[id]") || rota === "/dashboard/locacoes/[id]" || rota === "/admin/contratos/[id]")
    return troca(CONTRATO[persona], "contrato");
  const busca = BUSCAS_NO_BANCO.find((b) => b.rota === rota);
  if (busca) {
    const id = extras[rota]?.[persona];
    if (id) return { urls: [rota.replace(/\[[^\]]+\]/, id)] };
    return { motivo: `a semeadura do lab não cria registro em ${busca.tabela} para a persona ${persona}` };
  }
  return { motivo: "rota com parâmetro sem regra de resolução na varredura" };
}

// ───────────────────────────── classificação ─────────────────────────────

/** O que a spec observou numa tela (uma rota, uma persona, uma largura). */
export interface Observacao {
  /** Caminho pedido (sem query). */
  pedido: string;
  /** Largura da janela (px); decide os redirecionamentos que só valem a partir de uma largura. */
  largura?: number;
  /** Caminho em que a tela parou (sem query); null se nem abriu. */
  final: string | null;
  status: number | null;
  /** Erro do goto (timeout, rede), quando houve. */
  erroAbertura?: string;
  console: string[];
  pageErrors: string[];
  /** src (sem query) das imagens com naturalWidth === 0. */
  imagensQuebradas: string[];
  scrollWidth: number;
  clientWidth: number;
  /** Texto visível da tela (innerText do body). */
  texto: string;
  /** Seletores de esqueleto ainda visíveis depois de ESPERA_ESQUELETO_MS. */
  esqueletoVisivel: string[];
}

export interface Achado {
  tipo: TipoAchado;
  detalhe: string;
}

const curto = (s: string, n = 200) => s.replace(/\s+/g, " ").trim().slice(0, n);

export function classificar(o: Observacao, redirecionamentos: RedirecionamentoDeProposito[] = []): Achado[] {
  const achados: Achado[] = [];
  if (o.erroAbertura) achados.push({ tipo: "http", detalhe: `não abriu: ${curto(o.erroAbertura, 140)}` });
  else if (o.status !== null && o.status !== 200) achados.push({ tipo: "http", detalhe: `HTTP ${o.status}` });

  const regra = redirecionamentos.find((r) => r.de === o.pedido && (r.larguraMinima === undefined || (o.largura ?? 0) >= r.larguraMinima));
  const noLogin = (f: string) => f === "/auth" || f.startsWith("/auth/");
  if (regra) {
    // Redireciona de propósito: a varredura afirma o destino. Outro destino, ou ficar na própria tela, é achado.
    if (o.final !== null && o.final !== regra.para)
      achados.push({
        tipo: "redirecionamento",
        detalhe: o.final === o.pedido ? `devia ir para ${regra.para} e ficou na própria tela` : `devia ir para ${regra.para} e foi para ${noLogin(o.final) ? `o login (${o.final})` : o.final}`,
      });
  } else if (o.final !== null && o.final !== o.pedido) {
    achados.push({ tipo: "redirecionamento", detalhe: noLogin(o.final) ? `caiu no login (${o.final})` : `foi para ${o.final}` });
  }

  for (const c of uniq(o.console)) achados.push({ tipo: RE_HIDRATACAO.test(c) ? "hidratacao" : "console", detalhe: curto(c) });
  for (const e of uniq(o.pageErrors)) achados.push({ tipo: RE_HIDRATACAO.test(e) ? "hidratacao" : "pageerror", detalhe: curto(e) });

  for (const src of uniq(o.imagensQuebradas)) achados.push({ tipo: "imagem-quebrada", detalhe: curto(src || "(sem src)", 160) });

  if (o.scrollWidth > o.clientWidth) achados.push({ tipo: "estouro-horizontal", detalhe: `scrollWidth ${o.scrollWidth} > clientWidth ${o.clientWidth} (+${o.scrollWidth - o.clientWidth}px)` });

  const fora = ROTAS_FORA_DO_GATE.find((f) => o.pedido.startsWith(f.prefixo));
  if (!fora) {
    // Caminho "" = só as regras sem escopo (as com escopo valem para caminhos de código específicos, não para a tela renderizada).
    for (const a of achadosProibidos(o.texto, "")) achados.push({ tipo: "frase-proibida", detalhe: `${a.id}: "${curto(a.trecho, 120)}"` });
  }

  for (const t of textoQuebrado(o.texto)) achados.push({ tipo: "texto-quebrado", detalhe: t });

  for (const s of uniq(o.esqueletoVisivel)) achados.push({ tipo: "esqueleto-preso", detalhe: `${s} visível ${ESPERA_ESQUELETO_MS / 1000} s depois do carregamento` });
  return achados;
}

/** As ocorrências de texto quebrado, cada uma com um pedaço do contexto (linha da tela), sem repetição. */
export function textoQuebrado(texto: string): string[] {
  const out: string[] = [];
  for (const linha of texto.split("\n")) {
    const achou = linha.match(RE_TEXTO_QUEBRADO);
    if (!achou) continue;
    const item = `${[...new Set(achou)].join(", ")} em "${curto(linha, 100)}"`;
    if (!out.includes(item)) out.push(item);
  }
  return out;
}

const uniq = (xs: string[]) => [...new Set(xs)];

// ───────────────────────────── saída ─────────────────────────────

export interface Registro {
  rota: string;
  url: string;
  persona: Persona;
  largura: Largura;
  achados: Achado[];
  /** Print da tela (caminho relativo à raiz do repo), só quando houve achado. */
  captura: string | null;
}
export interface NaoVarrida {
  rota: string;
  persona: Persona;
  motivo: string;
}
/** "completa" (workflow varredura-logada.yml, LAB_VARREDURA_E950=completa) ou "amostra" (as 3 primeiras telas da persona:
 *  é o modo do lab-critico e das fatias gerais, que têm teto curto). */
export type Modo = "completa" | "amostra";
export const TELAS_DA_AMOSTRA = 3;
export interface Parcial {
  modo?: Modo;
  persona: Persona;
  largura: Largura;
  terminou: boolean;
  registros: Registro[];
  naoVarridas: NaoVarrida[];
}
export interface Saida {
  geradoEm: string;
  modo: Modo;
  inventario: { fonte: string; total: number };
  cobertura: { varridas: number; total: number; percentual: number; rotasNaoVarridas: string[] };
  execucoes: { persona: Persona; largura: Largura; terminou: boolean; telas: number }[];
  porTipo: Record<TipoAchado, number>;
  registros: Registro[];
  naoVarridas: NaoVarrida[];
}

/** Junta as parciais (uma por persona × largura) na saída única, com a cobertura sobre o inventário. */
export function juntar(parciais: Parcial[], inventario: string[], geradoEm: string): Saida {
  const registros = parciais.flatMap((p) => p.registros);
  const varridas = new Set(registros.map((r) => r.rota));
  const total = inventario.length;
  const nVarridas = inventario.filter((r) => varridas.has(r)).length;
  const naoVarridas: NaoVarrida[] = [];
  for (const n of parciais.flatMap((p) => p.naoVarridas)) if (!naoVarridas.some((x) => x.rota === n.rota && x.persona === n.persona)) naoVarridas.push(n);
  const porTipo = Object.fromEntries(Object.keys(TIPOS_ACHADO).map((t) => [t, 0])) as Record<TipoAchado, number>;
  for (const r of registros) for (const a of r.achados) porTipo[a.tipo]++;
  return {
    geradoEm,
    modo: parciais.length > 0 && parciais.every((p) => p.modo === "completa") ? "completa" : "amostra",
    inventario: { fonte: "docs/e793-painel-sessao-servidor.md (Apêndice A)", total },
    cobertura: { varridas: nVarridas, total, percentual: total ? Math.round((nVarridas / total) * 1000) / 10 : 0, rotasNaoVarridas: inventario.filter((r) => !varridas.has(r)) },
    execucoes: parciais.map((p) => ({ persona: p.persona, largura: p.largura, terminou: p.terminou, telas: p.registros.length })),
    porTipo,
    registros,
    naoVarridas,
  };
}

/** Resumo do job (GITHUB_STEP_SUMMARY): cobertura, execuções, achados por tipo e as rotas não varridas com o motivo. */
export function resumoMarkdown(s: Saida): string {
  const l: string[] = [];
  l.push("## E950 — varredura logada e admin (laboratório)");
  l.push("");
  if (s.modo === "amostra") l.push(`> Modo **amostra** (${TELAS_DA_AMOSTRA} telas por persona e largura): a cobertura abaixo não é a da varredura completa.`, "");
  l.push(`**Cobertura:** ${s.cobertura.varridas} de ${s.cobertura.total} rotas do inventário varridas (${s.cobertura.percentual}%).`);
  const comAchado = s.registros.filter((r) => r.achados.length > 0).length;
  l.push(`**Telas abertas:** ${s.registros.length} (rota × persona × largura) · **com achado:** ${comAchado}. Achado não deixa o job vermelho: o Gerente transforma em itens.`);
  l.push("");
  l.push("| Persona | Largura | Terminou | Telas |");
  l.push("|---|---|---|---|");
  for (const e of s.execucoes) l.push(`| ${e.persona} | ${e.largura} | ${e.terminou ? "sim" : "**não**"} | ${e.telas} |`);
  l.push("");
  l.push("| Achado | Quantos |");
  l.push("|---|---|");
  for (const [t, n] of Object.entries(s.porTipo)) l.push(`| ${t} | ${n} |`);
  if (s.cobertura.rotasNaoVarridas.length) {
    l.push("");
    l.push(`<details><summary>Rotas não varridas (${s.cobertura.rotasNaoVarridas.length})</summary>`);
    l.push("");
    for (const r of s.cobertura.rotasNaoVarridas) {
      const motivos = [...new Set(s.naoVarridas.filter((n) => n.rota === r).map((n) => n.motivo))];
      l.push(`- \`${r}\`: ${motivos.join("; ") || "nenhuma persona chegou a abrir"}`);
    }
    l.push("");
    l.push("</details>");
  }
  l.push("");
  l.push("Detalhe: `tests/laboratorio/saida/varredura-logada.json` (rota, persona, largura, achado e captura).");
  return l.join("\n");
}
