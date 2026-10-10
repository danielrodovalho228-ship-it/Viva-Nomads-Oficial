/*
  MOACIR GERENTE (PURO, testável). No chat da Central, o Moacir investiga:
  consulta o banco AO VIVO (consultas prontas, sem SQL livre, sem dado
  pessoal), pergunta ao agente responsável pelo organograma e, quando precisa
  de trabalho de verdade, dispara a rotina real (Executar agora). Volta com:
  O que encontrei / Quem está cuidando / Prazo / O que depende de você.
  Nunca diz que fez o que não fez: as ferramentas devolvem o que aconteceu.
*/
import { horaBrasilia } from "./retrato.ts";
import { REGRA_CEO } from "./central.ts";
import { blocoPersonaMemoria, type Memoria } from "./persona.ts";

export const CONSULTAS = ["chamados_abertos", "chamados_resolvidos", "contagens", "rondas_recentes", "ordens_pendentes", "ultimo_deploy", "migracoes"] as const;
export type Consulta = (typeof CONSULTAS)[number];

/** Organograma: assunto → quem cuida. */
export const ORGANOGRAMA: { assunto: string; slug: string; nome: string }[] = [
  { assunto: "atendimento, chamados, clientes", slug: "viva", nome: "Viva" },
  { assunto: "sistema, segurança, SEO técnico, erros do site", slug: "bruno", nome: "Bruno" },
  { assunto: "correções e fila (o Otávio encaminha ao Renato)", slug: "otavio", nome: "Otávio" },
  { assunto: "correção de código / abrir PR (execução)", slug: "renato", nome: "Renato" },
  { assunto: "pendências do Daniel", slug: "helena", nome: "Helena" },
  { assunto: "números e relatórios", slug: "carla", nome: "Carla" },
  { assunto: "marketing e vídeo", slug: "luana", nome: "Luana" },
  { assunto: "jurídico e contábil", slug: "sergio", nome: "Sérgio" },
  { assunto: "estratégia", slug: "rafael", nome: "Rafael" },
  { assunto: "parcerias e seguradoras", slug: "thiago", nome: "Thiago" },
];
const SLUGS = new Set(ORGANOGRAMA.map((o) => o.slug));
/** Nome de exibição pelo organograma (o banco pode ter o nome atualizado; este é o padrão). */
export const nomeDoOrganograma = (slug: string) => ORGANOGRAMA.find((o) => o.slug === slug)?.nome ?? slug;

interface Esquema {
  type: "object";
  properties: Record<string, unknown>;
  required: string[];
  additionalProperties: false;
}
export interface FerramentaGerente {
  name: string;
  description: string;
  input_schema: Esquema;
}

export const FERRAMENTAS_GERENTE: FerramentaGerente[] = [
  {
    name: "consultar_banco",
    description:
      "Consulta pronta e só de leitura, com dados AO VIVO. chamados_abertos: número, categoria, prioridade, status e prazos (sem dados pessoais). contagens: cadastros, imóveis, pedidos, leads, contratos. rondas_recentes: última ronda e achados P1/P2 de cada agente. chamados_resolvidos: resolvidos nos últimos 7 dias, com hora e nota. ordens_pendentes: ordens do Daniel ainda abertas. ultimo_deploy: versão no ar. migracoes: migrações aplicadas em produção (versão e nome) — confira aqui antes de dizer que uma migração está pendente.",
    input_schema: { type: "object", properties: { consulta: { type: "string", enum: [...CONSULTAS] } }, required: ["consulta"], additionalProperties: false },
  },
  {
    name: "perguntar_agente",
    description: "Pergunta ao agente responsável (pelo organograma). Ele responde com o briefing dele e os dados ao vivo da área. Use o slug.",
    input_schema: {
      type: "object",
      properties: { slug: { type: "string", enum: [...SLUGS] }, pergunta: { type: "string" } },
      required: ["slug", "pergunta"],
      additionalProperties: false,
    },
  },
  {
    name: "executar_agora",
    description:
      "Grava uma ordem e dispara AGORA a rotina real do agente (sessão com ferramentas). Use só quando precisa de trabalho de verdade (corrigir, abrir PR, refazer uma varredura). Correção de código vai para o renato. NUNCA para aplicar migração ou publicar: isso é só com o Daniel.",
    input_schema: {
      type: "object",
      properties: { slug: { type: "string", enum: [...SLUGS] }, ordem: { type: "string" } },
      required: ["slug", "ordem"],
      additionalProperties: false,
    },
  },
];

export function systemGerente(p: { briefing: string; organograma?: typeof ORGANOGRAMA; agora: Date; contexto: string; persona?: string | null; memorias?: Memoria[] }): string {
  const org = (p.organograma ?? ORGANOGRAMA).map((o) => `- ${o.assunto} → ${o.slug}`).join("\n");
  return `${p.contexto}

Você é o Moacir, gerente geral. ${p.briefing}
${blocoPersonaMemoria(p.persona, p.memorias ?? [])}

Você trabalha como um gerente: quando a mensagem é sobre o projeto, INVESTIGA antes de responder (conversa social não chega aqui: é respondida direto, com a persona). Hora agora (Brasília): ${horaBrasilia(p.agora.toISOString())}.

Organograma (a quem perguntar):
${org}

Como trabalhar:
1. Comece com UMA linha dizendo o que vai verificar (ex.: "Vou ver os chamados abertos e confirmar com a Viva.").
2. Use as ferramentas: consultar_banco para dados ao vivo; perguntar_agente para quem cuida do assunto; executar_agora só se precisar de trabalho de verdade.
3. Em relatório sobre o projeto, termine com estas 4 linhas, curtas (o formato fixo é só para relatório; a linha "lembrar:" da memória, se houver, vem depois):
O que encontrei: …
Quem está cuidando: …
Prazo: …
O que depende de você: …
e por último "dados de <hora>" com a hora das consultas.

Decida e aja (o Daniel quer resolução, não perguntas):
- NUNCA faça pergunta de esclarecimento quando dá para decidir com um padrão razoável: decida, diga em 1 linha o que assumiu ("Assumi X") e aja.
- NUNCA adie para a rotina agendada nem para outro dia. Trabalho necessário vai para executar_agora JÁ, para o agente certo do organograma.
- Responda SÓ a última pergunta do Daniel; não puxe assunto antigo (ex.: PR de ontem) a menos que ele pergunte. "Sim", "ok", "pode", "faça", "peça", "traga agora" respondem à sua última oferta: cumpra-a.
- Números da empresa (cadastros por data, imóveis por status, pedidos, leads): use consultar_banco/retrato e responda na hora. Se o dado realmente não existe, diga em 1 frase o que falta e registre UMA ordem (se já há ordem aberta do mesmo assunto, cite-a). Sem markdown além de **negrito** e listas com "- ".
- Proibido "não sei de qual X você fala" quando a memória, o briefing ou os dados ao vivo têm a resposta: procure primeiro.

Sem repetição:
- A resposta final NÃO repete o que já está na trilha (o que você consultou, perguntou ou disparou já aparece acima dela).
- O bloco "O que encontrei / Quem está cuidando / Prazo / O que depende de você" aparece UMA vez e SÓ quando a pergunta é sobre status ou situação. Em pedido de trabalho, responda curto: o que assumiu e o que fez.

Regras:
- Use SÓ o que as ferramentas devolveram. Se não conseguiu verificar algo, diga "não consegui verificar X" e o próximo passo.
- Nunca diga que fez algo que não fez. Só diga "disparei" se executar_agora devolveu sucesso.
- Nunca aplique migração, publique, envie e-mail ou mensagem: isso é só com o Daniel.
- Pedido que você não pode fazer (ex.: mandar e-mail): NUNCA responda só "não consigo". Diga o que JÁ fez para resolver e onde está (ex.: "a apresentação está aqui: <link da memória>"; "o aviso por e-mail sai de moacir@ quando o PR 4 entrar") e dispare quem pode ajudar com executar_agora.
${REGRA_CEO}
- Em "O que depende de você:" liste no máximo 3 itens, só do que é do Daniel, cada um com a ação pronta; se não houver, escreva "nada para você agora".
- Sem dados pessoais (nome completo, e-mail, telefone, CPF, endereço).
- Português do Brasil; "imóveis mobiliados"; a garantia se chama "Caução".`;
}

// ── Motor ──────────────────────────────────────────────────────────────────
export interface BlocoGerente {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
}
export interface RespostaGerente {
  stop_reason: string | null;
  content: BlocoGerente[];
}
export type ModeloGerente = (req: { system: string; tools: FerramentaGerente[]; messages: { role: "user" | "assistant"; content: string | unknown[] }[] }) => Promise<RespostaGerente>;

export interface DepsGerente {
  consultar(c: Consulta): Promise<string>;
  perguntarAgente(slug: string, pergunta: string): Promise<{ nome: string; resposta: string }>;
  executar(slug: string, ordem: string): Promise<{ ok: boolean; texto: string }>;
  nomeDe(slug: string): string;
}

/** Linha da trilha que aparece no chat ("Moacir → Viva: …" / "Viva: …"). */
export interface PassoTrilha {
  autor: string; // slug de quem fala
  texto: string;
}

const norm = (t: string) => t.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Resposta final sem repetição: tira as linhas que já estão na trilha e o bloco
 * "O que encontrei…" repetido (fica só o primeiro).
 */
export function semRepeticao(resposta: string, trilha: PassoTrilha[]): string {
  const naTrilha = new Set(trilha.flatMap((p) => p.texto.split("\n")).map(norm).filter((l) => l.length > 15));
  const out: string[] = [];
  let blocos = 0;
  for (const l of resposta.split("\n")) {
    const n = norm(l);
    if (/^o que encontrei:/.test(n)) blocos++;
    if (blocos > 1) break; // bloco repetido: descarta dele em diante
    if (n.length > 15 && naTrilha.has(n)) continue;
    out.push(l);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() || resposta;
}

export const MAX_VOLTAS_GERENTE = 6;
/** Prefixo das ordens que o Moacir dispara (o retorno procura por ele). */
export const PREFIXO_MOACIR = "Pedido do Moacir (chat da Central): ";

export async function investigar(
  pergunta: string,
  system: string,
  modelo: ModeloGerente,
  d: DepsGerente,
  anteriores: { role: "user" | "assistant"; content: string }[] = []
): Promise<{ resposta: string; trilha: PassoTrilha[] }> {
  const trilha: PassoTrilha[] = [];
  const msgs: { role: "user" | "assistant"; content: string | unknown[] }[] = [...anteriores, { role: "user", content: pergunta }];
  for (let volta = 0; volta < MAX_VOLTAS_GERENTE; volta++) {
    const r = await modelo({ system, tools: FERRAMENTAS_GERENTE, messages: msgs });
    const usos = r.content.filter((b) => b.type === "tool_use" && b.id && b.name);
    const texto = r.content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n").trim();
    if (!usos.length) return { resposta: texto || "Não consegui concluir a investigação agora. Tente de novo em instantes.", trilha };
    msgs.push({ role: "assistant", content: r.content });
    const resultados: unknown[] = [];
    for (const u of usos) {
      const inp = (u.input && typeof u.input === "object" ? u.input : {}) as Record<string, unknown>;
      let conteudo: string;
      try {
        if (u.name === "consultar_banco" && CONSULTAS.includes(inp.consulta as Consulta)) {
          conteudo = await d.consultar(inp.consulta as Consulta);
        } else if (u.name === "perguntar_agente" && typeof inp.slug === "string" && SLUGS.has(inp.slug) && typeof inp.pergunta === "string") {
          const q = inp.pergunta.slice(0, 600);
          trilha.push({ autor: "moacir", texto: `Moacir → ${d.nomeDe(inp.slug)}: ${q}` });
          const a = await d.perguntarAgente(inp.slug, q);
          trilha.push({ autor: inp.slug, texto: `${a.nome}: ${a.resposta}` });
          conteudo = a.resposta;
        } else if (u.name === "executar_agora" && typeof inp.slug === "string" && SLUGS.has(inp.slug) && typeof inp.ordem === "string") {
          const e = await d.executar(inp.slug, inp.ordem.slice(0, 1500));
          // "Registrei para X; o Moacir aciona na ronda das HH:37" não é disparo: não diz "Disparei".
          trilha.push({ autor: "moacir", texto: e.ok && /^Registrei para /.test(e.texto) ? e.texto : `${e.ok ? "Disparei" : "Não consegui disparar"} ${d.nomeDe(inp.slug)}: ${e.texto}` });
          conteudo = e.texto;
        } else {
          conteudo = "Ferramenta ou parâmetro inválido.";
        }
      } catch {
        conteudo = "Falhou ao consultar agora.";
      }
      resultados.push({ type: "tool_result", tool_use_id: u.id, content: conteudo.slice(0, 6000) });
    }
    msgs.push({ role: "user", content: resultados });
  }
  return { resposta: "Não consegui concluir a investigação em poucas etapas. Me pergunte de forma mais específica.", trilha };
}

/**
 * Modelo SIMULADO do laboratório (sem IA): segue o roteiro de um gerente com
 * as ferramentas reais — chamados → pergunta à Viva → resposta no formato.
 */
export function modeloGerenteSimulado(agora: Date): ModeloGerente {
  return async ({ messages }) => {
    const pergunta = String(messages[0]?.content ?? "").toLowerCase();
    const resultados = messages.filter((m) => m.role === "user" && Array.isArray(m.content)).flatMap((m) => m.content as { content?: string }[]);
    const sobreChamado = /chamad|cliente|atendimento|suporte/.test(pergunta);
    if (resultados.length === 0) {
      return {
        stop_reason: "tool_use",
        content: [
          { type: "text", text: sobreChamado ? "Vou ver os chamados abertos e confirmar com a Viva." : "Vou olhar os números e as últimas rondas." },
          { type: "tool_use", id: "t1", name: "consultar_banco", input: { consulta: sobreChamado ? "chamados_abertos" : "contagens" } },
        ],
      };
    }
    if (resultados.length === 1 && sobreChamado) {
      return { stop_reason: "tool_use", content: [{ type: "tool_use", id: "t2", name: "perguntar_agente", input: { slug: "viva", pergunta: "Algum chamado novo precisa do Daniel?" } }] };
    }
    const dados = resultados.map((r) => r.content ?? "").join("\n");
    const primeiro = dados.match(/VN-\d+[^\n]*/)?.[0] ?? "nenhum chamado aberto";
    const prazo = dados.match(/prazo 1ª resposta ([^;\n]+)/)?.[1] ?? "—";
    return {
      stop_reason: "end_turn",
      content: [
        {
          type: "text",
          text: `O que encontrei: ${sobreChamado ? primeiro : "números do retrato abaixo"}.\nQuem está cuidando: ${sobreChamado ? "Viva (atendimento) e você" : "equipe"}.\nPrazo: ${prazo}.\nO que depende de você: ${sobreChamado ? "responder ou aprovar a sugestão no /admin/atendimento" : "nada agora"}.\ndados de ${horaBrasilia(agora.toISOString())} (laboratório, sem IA)`,
        },
      ],
    };
  };
}
