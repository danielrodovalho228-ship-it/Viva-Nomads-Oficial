/**
 * E348 — a ficha de aprovação de parceiro mostra a PROVA de cada item, não só a caixinha. PURO e testável.
 *  • Identidade: resultado, data, modo (DEMONSTRAÇÃO enquanto o CAF/Certta não está contratado) e nome do cadastro × nome
 *    devolvido pelo fornecedor (quando o laudo guardou um); nada é inventado: o que não foi registrado diz "não registrado".
 *  • CPF/CNPJ: situação e data da consulta (a consulta na Receita é manual: sem consulta, o texto diz isso).
 *  • Cada caixinha de atestação manual guarda QUEM conferiu, QUANDO e com BASE em quê (dentro do jsonb `checklist.registro`,
 *    sem coluna nova).
 */
import type { LaudoCafGravado } from "../documento/conferencia-matricula.ts";

export interface LinhaProva {
  rotulo: string;
  valor: string;
}
export interface ProvaIdentidade {
  /** "demonstracao": laudo simulado/demo ou conta sem CAF real; "real": laudo do fornecedor; "sem_laudo": nada registrado. */
  modo: "demonstracao" | "real" | "sem_laudo";
  titulo: string;
  linhas: LinhaProva[];
  /** Frase de atenção (demonstração ou ausência de laudo). */
  aviso: string | null;
}

export const AVISO_DEMONSTRACAO =
  "Identidade em DEMONSTRAÇÃO: o serviço de verificação (Certta/CAF) ainda não está contratado, então o resultado abaixo é simulado e não prova quem a pessoa é. Confira o documento com foto e registre a conferência manual.";
export const AVISO_SEM_LAUDO = "Nenhum laudo de identidade registrado para esta pessoa. Confira o documento com foto e registre a conferência manual.";

const dataHoraBR = (iso: string | null | undefined) => {
  const d = new Date(String(iso ?? ""));
  return Number.isFinite(d.getTime())
    ? d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";
};
const simNao = (v: unknown) => (v === true ? "sim" : v === false ? "não" : "—");
const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Protocolo e nome devolvido, quando o laudo os guardou (chaves usadas pelo fornecedor/leitor). */
function protocoloDoLaudo(c: Record<string, unknown>): string | null {
  return texto(c.protocolo) ?? texto(c.transactionId) ?? texto(c.transaction_id) ?? texto(c.id);
}
function nomeDevolvido(c: Record<string, unknown>): string | null {
  return texto(c.nomeRetornado) ?? texto(c.nome_retornado) ?? texto(c.name) ?? texto(c.nome);
}
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

export function provaDaIdentidade(laudo: LaudoCafGravado | null, nomeCadastro: string | null, contaDeTeste = false): ProvaIdentidade {
  const c = laudo?.caf_result ?? null;
  if (!laudo || !c) {
    return { modo: "sem_laudo", titulo: "Sem laudo de identidade", linhas: [{ rotulo: "Nome do cadastro", valor: nomeCadastro?.trim() || "—" }], aviso: AVISO_SEM_LAUDO };
  }
  const demo = c.simulado === true || c.demo === true || contaDeTeste;
  const linhas: LinhaProva[] = [
    { rotulo: "Resultado", valor: `identidade ${simNao(c.identity)} · documento ${simNao(c.document)} · prova de vida ${simNao(c.liveness)}` },
    { rotulo: "Semáforo", valor: texto(laudo.traffic_light) ?? texto(c.light) ?? "—" },
    { rotulo: "Data do laudo", valor: dataHoraBR(laudo.created_at) },
  ];
  if (laudo.valid_until) linhas.push({ rotulo: "Vale até", valor: dataHoraBR(laudo.valid_until).slice(0, 10) });
  linhas.push({ rotulo: "Protocolo", valor: protocoloDoLaudo(c) ?? "não registrado" });
  const devolvido = nomeDevolvido(c);
  const cadastro = nomeCadastro?.trim() || "—";
  linhas.push({ rotulo: "Nome do cadastro", valor: cadastro });
  linhas.push({
    rotulo: "Nome devolvido pelo serviço",
    valor: devolvido
      ? `${devolvido} ${devolvido && cadastro !== "—" && norm(devolvido) === norm(cadastro) ? "(confere com o cadastro)" : "(DIFERE do cadastro — confira)"}`
      : "não registrado — compare o documento com foto",
  });
  return {
    modo: demo ? "demonstracao" : "real",
    titulo: demo ? "Identidade — DEMONSTRAÇÃO (simulada)" : "Identidade — laudo do serviço de verificação",
    linhas,
    aviso: demo ? AVISO_DEMONSTRACAO : null,
  };
}

export interface ProvaDocumento {
  situacao: string;
  consultadoEm: string | null;
  porQuem: string | null;
}
export function provaDoDocumento(checklist: Record<string, unknown> | null | undefined, porNome: string | null): ProvaDocumento {
  const em = texto(checklist?.documento_conferido_em);
  if (checklist?.documento === true && em) {
    return { situacao: "Situação conferida na Receita (consulta manual pela equipe)", consultadoEm: dataHoraBR(em), porQuem: porNome };
  }
  return { situacao: "Ainda não consultada na Receita — abra a consulta e marque o item", consultadoEm: null, porQuem: null };
}

/** Quem conferiu cada item, quando e com base em quê (guardado em `checklist.registro[chave]`). */
export interface RegistroConferencia {
  por: string | null;
  porNome: string | null;
  em: string | null;
  base: string | null;
}
export function registroDoItem(checklist: Record<string, unknown> | null | undefined, chave: string): RegistroConferencia | null {
  const r = (checklist?.registro as Record<string, unknown> | undefined)?.[chave];
  if (!r || typeof r !== "object") return null;
  const o = r as Record<string, unknown>;
  return { por: texto(o.por), porNome: texto(o.por_nome), em: texto(o.em), base: texto(o.base) };
}
export function textoDoRegistro(r: RegistroConferencia | null): string | null {
  if (!r) return null;
  const quem = r.porNome ?? "equipe da Viva";
  return `Conferido por ${quem} em ${dataHoraBR(r.em)}${r.base ? ` · com base em: ${r.base}` : " · sem base registrada"}`;
}

/** Base sugerida por item (o admin edita). */
export const BASE_PADRAO: Record<string, string> = {
  identidade: "Documento com foto enviado pela pessoa",
  identidade_manual: "Documento com foto enviado pela pessoa",
  documento: "Consulta pública da Receita Federal",
  area: "Categorias e cidades do pedido",
  categoria: "Portfólio, empresa/veículo ou descrição do pedido",
};
export const BASE_MAX = 200;

/** Aprovar só vale com o cadastro completo E o checklist completo: o alerta e o botão contam a mesma história. */
export function motivoSemAprovar(estadoTipo: string, completo: boolean): string | null {
  if (estadoTipo === "incompleto") return "O cadastro está incompleto (veja o alerta acima): peça para a pessoa completar o pedido antes de aprovar.";
  if (!completo) return "Aprovar fica disponível com o checklist completo.";
  return null;
}
