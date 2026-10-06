/*
  COPILOTO DA EQUIPE no chamado (PURO, testável com node --test).

  "A IA prepara, a equipe decide":
  • Sugerir resposta — a Viva consulta os dados da pessoa (SÓ ferramentas de
    leitura, nenhuma ação) e escreve um RASCUNHO. Vem junto a lista de fontes
    consultadas. Nada é enviado: quem envia é a pessoa da equipe, depois de ler.
  • Quem é a pessoa — resumo mínimo (LGPD): papel, conta desde, anúncios com o
    que falta, contratos, pedidos e chamados anteriores. Sem CPF, sem telefone,
    e-mail mascarado. Cada consulta fica no histórico do chamado.
  • Devolver para a Viva — só P3/P4. P1/P2 nunca voltam para a IA.
*/
import { FERRAMENTAS_LEITURA, FERRAMENTAS_VIVA, SYSTEM_VIVA } from "./viva-prompt.ts";
import { validarResposta } from "./viva-regras.ts";
import type { ChamarModelo, Ferramentas, MensagemModelo, ResultadoFerramenta } from "./viva-motor.ts";

const MAX_VOLTAS = 4;

export const SYSTEM_COPILOTO = [
  SYSTEM_VIVA,
  "",
  "# MODO RASCUNHO PARA A EQUIPE (vale acima de tudo)",
  "- Você NÃO está falando com a pessoa. Você escreve um rascunho que uma pessoa da equipe vai ler, ajustar e enviar com o nome dela.",
  "- Escreva em nome da equipe Viva Nomads (\"conferimos\", \"vamos\"). Não se apresente, não diga que é assistente virtual e não diga que é uma pessoa.",
  "- Antes de responder, consulte os dados da pessoa com as ferramentas de consulta que fizerem sentido para o pedido.",
  "- Responda só com o texto do rascunho, pronto para enviar. Sem títulos, sem observações para a equipe.",
].join("\n");

export interface Fonte {
  ferramenta: string;
  /** Primeiras linhas do que a ferramenta devolveu (o que a Viva leu). */
  resumo: string;
  erro: boolean;
}

export interface Sugestao {
  ok: boolean;
  texto: string;
  fontes: Fonte[];
  /** Algo para a equipe conferir antes de enviar (ex.: a regra barrou um trecho). */
  aviso: string | null;
  uso: { chamadas: number; entrada: number; saida: number; cacheLida: number; cacheEscrita: number };
}

const ROTULO_FERRAMENTA: Record<string, string> = {
  ver_meus_pedidos: "Pedidos de Moradia",
  ver_meus_contratos: "Contratos",
  ver_status_caucao: "Caução",
  ver_status_documento: "Documento do imóvel",
  ver_status_anuncio: "Prontidão do anúncio",
};
export const rotuloFerramenta = (n: string) => ROTULO_FERRAMENTA[n] ?? n;

/** Rascunho da resposta, com as fontes. Nunca executa ação: só ferramentas de leitura. */
export async function sugerirRespostaMotor(conversa: string, modelo: ChamarModelo, ferramentas: Ferramentas): Promise<Sugestao> {
  const leitura = new Set<string>(FERRAMENTAS_LEITURA);
  const tools = FERRAMENTAS_VIVA.filter((t) => leitura.has(t.name));
  const mensagens: MensagemModelo[] = [{ role: "user", content: `${conversa}\n\nEscreva o rascunho da próxima resposta da equipe.` }];
  const fontes: Fonte[] = [];
  const uso = { chamadas: 0, entrada: 0, saida: 0, cacheLida: 0, cacheEscrita: 0 };
  const falha = (aviso: string): Sugestao => ({ ok: false, texto: "", fontes, aviso, uso });

  try {
    for (let volta = 0; volta < MAX_VOLTAS; volta++) {
      const resp = await modelo({ system: SYSTEM_COPILOTO, tools, messages: mensagens });
      uso.chamadas++;
      uso.entrada += resp.usage?.input_tokens ?? 0;
      uso.saida += resp.usage?.output_tokens ?? 0;
      uso.cacheLida += resp.usage?.cache_read_input_tokens ?? 0;
      uso.cacheEscrita += resp.usage?.cache_creation_input_tokens ?? 0;
      if (resp.stop_reason === "refusal" || resp.stop_reason === "max_tokens") return falha(`a IA parou (${resp.stop_reason})`);

      const usos = resp.content.filter((b) => b.type === "tool_use" && b.id && b.name);
      if (usos.length === 0) {
        const bruto = resp.content
          .filter((b) => b.type === "text")
          .map((b) => b.text ?? "")
          .join("\n")
          .trim();
        const conf = validarResposta(bruto);
        // A equipe lê antes de enviar: o rascunho vem mesmo se a regra apontar algo, com o aviso.
        return { ok: !!conf.texto, texto: conf.texto, fontes, aviso: conf.ok ? null : `Confira antes de enviar: ${conf.motivo}.`, uso };
      }

      mensagens.push({ role: "assistant", content: resp.content });
      const resultados: unknown[] = [];
      for (const u of usos) {
        const nome = u.name as string;
        const input = (u.input && typeof u.input === "object" ? u.input : {}) as Record<string, unknown>;
        const exec = leitura.has(nome) ? ferramentas[nome] : undefined;
        let res: ResultadoFerramenta;
        if (!exec) res = { conteudo: "Ferramenta não disponível no rascunho (só consultas).", erro: true };
        else {
          try {
            res = await exec(input);
          } catch {
            res = { conteudo: "Não foi possível consultar agora.", erro: true };
          }
        }
        if (leitura.has(nome)) fontes.push({ ferramenta: nome, resumo: res.conteudo.replace(/\s+/g, " ").slice(0, 280), erro: !!res.erro });
        resultados.push({ type: "tool_result", tool_use_id: u.id, content: res.conteudo.slice(0, 6000), ...(res.erro ? { is_error: true } : {}) });
      }
      mensagens.push({ role: "user", content: resultados });
    }
  } catch {
    return falha("falha ao chamar a IA");
  }
  return falha(`a IA não concluiu em ${MAX_VOLTAS} voltas`);
}

/** Transcrição pública do chamado para o rascunho (notas internas ficam de fora). */
export function transcricaoParaRascunho(
  contexto: string,
  mensagens: { autor: "usuario" | "ia" | "admin" | "sistema"; corpo: string; interno?: boolean }[]
): string {
  const quem = { usuario: "Pessoa", ia: "Viva", admin: "Equipe", sistema: "Sistema" } as const;
  const corpo = mensagens
    .filter((m) => !m.interno)
    .map((m) => `${quem[m.autor]}: ${m.corpo}`)
    .join("\n");
  return `${contexto}\n\nConversa até agora:\n${corpo}`.slice(0, 12000);
}

// Regras pequenas (também usadas na tela, sem trazer o prompt para o navegador).
export { contarPorStatus, ehContaNova, mascararEmail, papelLegivel, podeDevolverParaViva, type PessoaResumo } from "./copiloto-regras.ts";
