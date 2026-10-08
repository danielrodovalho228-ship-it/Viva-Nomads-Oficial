/*
  Central humana (PURO, sem banco nem rede): persona, memória e conversa social
  dos agentes. Usado pelo chat (motor.ts), pelo Moacir gerente (gerente.ts) e
  pelos testes (node --test).
*/

export const MAX_MEMORIAS_NO_PROMPT = 30;
export const MAX_FATO = 500;
export const MAX_FATOS_POR_MENSAGEM = 3;
/** Teto de fatos guardados por agente: a memória é do Daniel, não um arquivo morto. */
export const MAX_MEMORIAS_POR_AGENTE = 200;

/** A Viva (atendimento a clientes) nunca tem persona: responde como assistente virtual, com o rodapé automático. */
export const SLUG_SEM_PERSONA = "viva";
export const MARCA_AGENTE_IA = "agente de IA";

/** Persona só vale para agentes internos. Para a Viva (ou slug vazio) volta sempre null, mesmo que o banco tenha texto. */
export function personaPermitida(slug: string, persona: string | null | undefined): string | null {
  if (!slug || slug.trim().toLowerCase() === SLUG_SEM_PERSONA) return null;
  return persona?.trim() ? persona : null;
}

export interface Memoria {
  id: string;
  agente_slug: string;
  fato: string;
  criado_em: string;
}

// ── Conversa social ──────────────────────────────────────────────────────────
const RE_SOCIAL =
  /^(oi+e?|ol[aá]|opa|e a[ií]|eai|fala|salve|hey|hello|bom dia|boa tarde|boa noite|tudo (bem|certo|bom|tranquilo)|como (vai|voc[eê] est[aá]|est[aá] voc[eê]|andam? as coisas)|obrigad[oa]|valeu|vlw|tchau|at[eé] (logo|mais|amanh[aã])|boa (semana|noite)|bom fim de semana|que bom)(?![\p{L}])/iu;
/** Se aparecer qualquer um destes, a mensagem é sobre o projeto — nada de resposta social. */
const RE_PROJETO =
  /chamad|ronda|\bpr\b|migra|deploy|cadastr|im[oó]ve|contrato|erro|pend[eê]n|urgente|status|n[uú]mero|relat[oó]rio|ordem|quantos|quantas|o que (aconteceu|rodou|tem)|como estamos|situa[cç][aã]o|bug|site|p0|p1|cliente|pedido|lead/i;

/** Cumprimento, agradecimento ou papo leve: responde direto, como uma pessoa, sem relatório nem ferramentas. */
export function ehConversaSocial(texto: string): boolean {
  const t = texto.trim();
  if (!t || t.length > 80) return false;
  if (RE_PROJETO.test(t)) return false;
  return RE_SOCIAL.test(t);
}

// ── Prompt ───────────────────────────────────────────────────────────────────
export const REGRAS_CONVERSA = `Como conversar (você é um colega de equipe, não um painel):
- Converse como uma pessoa: natural, calorosa e curta, no jeito da sua persona.
- Cumprimento recebe cumprimento (e, no máximo, uma pergunta de volta). Sem relatório, sem números, sem lista.
- Só traga dados do projeto quando o Daniel perguntar. Se houver P0/P1 aberto, avise numa linha curta ("tenho uma coisa urgente, quer ver?") e espere ele querer.
- Se o Daniel perguntar a sério se está falando com uma pessoa, diga que é um agente de IA com personagem.
- Não invente fatos sobre o Daniel. Só use o que está em "O que você sabe sobre o Daniel" ou o que ele disse nesta conversa.
- Para guardar na memória algo que o Daniel contou sobre ele (gosto, rotina, jeito de trabalhar), termine a resposta com uma linha separada: lembrar: ["fato curto na 3ª pessoa"] (até ${MAX_FATOS_POR_MENSAGEM} fatos, ${MAX_FATO} caracteres cada). Só quando ele contou algo novo.
- NUNCA guarde saúde, finanças, documentos, contatos nem dados de terceiros (clientes, parentes, amigos).`;

/** Persona (jeito de falar) + memórias (últimas 30, mais recentes primeiro) para o system prompt. */
export function blocoPersonaMemoria(persona: string | null | undefined, memorias: Memoria[]): string {
  const p = persona?.trim();
  const ms = memorias.slice(0, MAX_MEMORIAS_NO_PROMPT).map((m) => `- ${m.fato}`);
  return [
    p ? `Sua persona (perfil e jeito de falar):\n${p}` : "",
    ms.length ? `O que você sabe sobre o Daniel (ele mesmo contou):\n${ms.join("\n")}` : "",
    REGRAS_CONVERSA,
  ]
    .filter(Boolean)
    .join("\n\n");
}

// ── Memória: extrair e filtrar o que o modelo pediu para guardar ─────────────
const RE_LINHA_LEMBRAR = /^[ \t]*lembrar:[ \t]*(\[.*\])[ \t]*$/gim;
/** Saúde, finanças, documentos e contatos: nunca vão para a memória. */
const RE_SENSIVEL =
  /sa[uú]de|doen[cç]a|diabet|hipertens|gr[aá]vid|ganh[ao]|renda|faturament|r\$|diagn[oó]stic|rem[eé]dio|medic|cirurgia|terapia|c[aâ]ncer|depress|ansiedade|sal[aá]rio|d[ií]vida|saldo|cart[aã]o|conta banc|ban[cç]o|patrim[oô]nio|invest|imposto|\bcpf\b|\bcnpj\b|\brg\b|passaporte|documento|\bcnh\b|senha|e-?mail|telefone|whats|\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{4,}[-\s]?\d{4}|@/i;
/** Pessoas de fora: a memória é só sobre o Daniel. */
const RE_TERCEIROS = /\b(esposa|mulher d[eo]|marido|namorad[oa]|filh[oa]s?|m[aã]e d|pai d|irm[aã]o?s? d|cunhad|sogr|amig[oa] d|funcion[aá]ri|o cliente|a cliente|inquilin|propriet[aá]ri)/i;

export function fatoSeguro(fato: string): boolean {
  return fato.length > 0 && fato.length <= MAX_FATO && !RE_SENSIVEL.test(fato) && !RE_TERCEIROS.test(fato);
}

/** Separa a resposta da(s) linha(s) "lembrar: [...]". Fatos inválidos, sensíveis ou repetidos caem fora. */
export function extrairLembrar(resposta: string): { texto: string; fatos: string[] } {
  const fatos: string[] = [];
  const texto = resposta
    .replace(RE_LINHA_LEMBRAR, (_linha, json: string) => {
      try {
        const lista: unknown = JSON.parse(json);
        if (Array.isArray(lista)) {
          for (const f of lista) {
            if (typeof f !== "string") continue;
            const limpo = f.replace(/\s+/g, " ").trim();
            if (fatoSeguro(limpo) && !fatos.some((x) => x.toLowerCase() === limpo.toLowerCase())) fatos.push(limpo);
          }
        }
      } catch {
        /* JSON inválido: ignora a linha, não guarda nada */
      }
      return "";
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { texto, fatos: fatos.slice(0, MAX_FATOS_POR_MENSAGEM) };
}

/** Respostas do laboratório (sem IA) para conversa social. */
export function respostaSocialSimulada(nome: string): string {
  return `Oi! Aqui é o ${nome}. Tudo certo por aqui. E você, como está? (laboratório, sem IA)`;
}
