/*
  RESUMO E AÇÕES do chamado (PURO, testável). Aparece no topo da tela do
  chamado no admin, gerado sozinho ao abrir e guardado como NOTA INTERNA (não
  gasta IA a cada abertura; "Atualizar resumo" refaz).

  • Resumo: 2-3 linhas do que a pessoa quer — sem dados pessoais.
  • Ações do Daniel: checklist, com o agente que ajuda quando fizer sentido.
  • Quem é e SLA: calculados pelo servidor/tela (dado real, não IA).
  Sem IA (laboratório) ou se a IA falhar: regras fixas a partir do texto.
*/
import { SITUACAO_VIVA } from "../../config/situacao-viva.ts";

export interface AcaoResumo {
  texto: string;
  /** Agente que ajuda (slug da Central), quando houver. */
  para: string | null;
}
export interface ResumoChamado {
  resumo: string;
  acoes: AcaoResumo[];
  origem: "ia" | "regras";
  geradoEm: string;
}

export const MARCA_RESUMO = "[resumo-e-acoes]";
export const ehNotaResumo = (corpo: string) => corpo.startsWith(MARCA_RESUMO);

export function notaResumo(r: ResumoChamado): string {
  return `${MARCA_RESUMO}\n${JSON.stringify(r)}`.slice(0, 5000);
}

const AGENTES_AJUDA = new Set(["thiago", "sergio", "renato", "helena", "carla", "luana", "bruno", "viva"]);
const CONTATO = /\b[\w.+-]+@[\w-]+\.[\w.]+\b|\(?\b\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b|\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const limpo = (t: unknown, max: number) => (typeof t === "string" ? t.replace(CONTATO, "[dado pessoal]").replace(/\s+/g, " ").trim().slice(0, max) : "");

/** Lê o JSON da IA (ou da nota) e saneia: tamanhos, no máx. 6 ações, sem e-mail/telefone/CPF. */
export function lerResumo(bruto: string, origem: ResumoChamado["origem"] = "ia", agora = new Date()): ResumoChamado | null {
  try {
    const i = bruto.indexOf("{");
    const j = bruto.lastIndexOf("}");
    if (i < 0 || j < i) return null;
    const v = JSON.parse(bruto.slice(i, j + 1)) as Partial<ResumoChamado>;
    const resumo = limpo(v.resumo, 400);
    if (!resumo) return null;
    const acoes = (Array.isArray(v.acoes) ? v.acoes : [])
      .map((a) => ({ texto: limpo(a?.texto, 160), para: typeof a?.para === "string" && AGENTES_AJUDA.has(a.para) ? a.para : null }))
      .filter((a) => a.texto)
      .slice(0, 6);
    return { resumo, acoes, origem: v.origem === "regras" || v.origem === "ia" ? v.origem : origem, geradoEm: typeof v.geradoEm === "string" ? v.geradoEm : agora.toISOString() };
  } catch {
    return null;
  }
}

export function resumoDaNota(corpo: string): ResumoChamado | null {
  return ehNotaResumo(corpo) ? lerResumo(corpo.slice(MARCA_RESUMO.length), "ia") : null;
}

const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Ações por regra (sem IA) — também servem de rede quando a IA falha. */
export function acoesPorRegra(texto: string, visitante: boolean): AcaoResumo[] {
  const t = norm(texto);
  const a: AcaoResumo[] = [];
  if (/segur(o|a|adora)|fianca/.test(t)) a.push({ texto: "Responder sobre seguros: ainda não oferecemos; estamos conversando com seguradoras", para: "thiago" });
  if (/caucao/.test(t)) a.push({ texto: "Explicar a regra do Caução (poupança, devolução após a vistoria de saída)", para: null });
  if (/contrato|juridic|advogad|lei\b|multa/.test(t)) a.push({ texto: "Conferir a dúvida de contrato/jurídico", para: "sergio" });
  if (/cobranc|pagament|boleto|pix|assinatura|plano/.test(t)) a.push({ texto: "Conferir cobrança ou plano da pessoa", para: null });
  if (/erro|bug|nao (funciona|carrega|abre|publica)|travou/.test(t)) a.push({ texto: "Reproduzir o problema no site e, se for falha, mandar ao Renato", para: "renato" });
  if (visitante) a.push({ texto: "Convidar para criar a conta gratuita (avisamos novidades)", para: null });
  a.push({ texto: "Responder a pessoa (a sugestão da Viva está na caixa Responder)", para: null });
  return a.slice(0, 6);
}

export function resumoPorRegra(textoPessoa: string, visitante: boolean, agora = new Date()): ResumoChamado {
  const t = limpo(textoPessoa, 220);
  return { resumo: t ? `A pessoa escreveu: "${t}${textoPessoa.length > 220 ? "…" : ""}"` : "Sem mensagem da pessoa.", acoes: acoesPorRegra(textoPessoa, visitante), origem: "regras", geradoEm: agora.toISOString() };
}

/** Sugestão de resposta por regra (laboratório, sem IA): só textos oficiais. */
export function sugestaoPorRegra(textoPessoa: string, nome: string | null, visitante: boolean): string {
  const t = norm(textoPessoa);
  const partes = [`Olá${nome ? `, ${nome}` : ""}! Obrigado por falar com a Viva Nomads.`];
  if (/caucao/.test(t)) partes.push("Sobre o Caução: ele fica depositado em poupança e volta no fim da locação, depois da vistoria de saída.");
  if (/segur(o|a|adora)|fianca/.test(t)) partes.push(visitante ? SITUACAO_VIVA.seguros.replace("em /auth", "no site") : SITUACAO_VIVA.segurosComConta);
  partes.push(SITUACAO_VIVA.fase);
  if (visitante && !/segur(o|a|adora)|fianca/.test(t)) partes.push("Se quiser, crie a conta gratuita no site para acompanhar as novidades.");
  partes.push("Qualquer dúvida, é só responder por aqui.");
  return partes.join(" ");
}

export const SYSTEM_RESUMO = `Você prepara, para o Daniel (dono da Viva Nomads), um RESUMO de um chamado de atendimento.
Responda SÓ com JSON: {"resumo":"...","acoes":[{"texto":"...","para":"slug ou null"}]}.
- resumo: 2 a 3 linhas, o que a pessoa quer e o que já foi respondido. SEM nome completo, e-mail, telefone, CPF ou endereço.
- acoes: o que o DANIEL precisa fazer, curto e no imperativo (ex.: "Responder sobre seguros", "Convidar para cadastro"), no máximo 6.
- para (opcional): agente que ajuda — thiago (parcerias e seguradoras), sergio (jurídico/contábil), renato (bug no site), helena (pendências do Daniel), carla (números), luana (marketing). Senão null.
- Fatos oficiais: ${SITUACAO_VIVA.fase} ${SITUACAO_VIVA.seguros}
- Diga "imóveis mobiliados" (nunca "apartamentos") e "Caução" para a garantia. Não invente nada que não esteja na conversa.`;
