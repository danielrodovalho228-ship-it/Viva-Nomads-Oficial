/*
  Instruções de chegada (Prompt 32, item 2) — regras puras.
  O dono preenche uma vez no imóvel; o texto por contrato de contratos_checkin (quando houver) sobrescreve o campo
  "como entrar" (decisão do Muse, 21/10). O morador vê 7 dias antes da entrada, só com o contrato assinado pelas duas
  partes e o 1º pagamento registrado. Antes disso: "Liberadas em [data]".
*/
import { INSTRUCAO_SAIDA_MAX } from "./instrucao-saida.ts";
import { diaBRT } from "../datas-brasilia.ts";
import { ddmmaaaa, diasAte } from "./estadia.ts";

/** Decisão do Daniel (18/10): liberadas 7 dias antes da entrada. */
export const LIBERACAO_DIAS = 7;
/** Lembrete ao dono quando faltam 10 dias e as instruções ainda estão vazias. */
export const LEMBRETE_DONO_DIAS = 10;

export const CAMPOS_INSTRUCOES = [
  { chave: "como_entrar", rotulo: "Como entrar", ajuda: "Portaria, código, chave e horário.", max: 1000 },
  { chave: "wifi_rede", rotulo: "Wi-Fi: rede", ajuda: "", max: 100 },
  { chave: "wifi_senha", rotulo: "Wi-Fi: senha", ajuda: "", max: 100 },
  { chave: "regras_condominio", rotulo: "Regras do condomínio", ajuda: "", max: 1500 },
  // E661 (apoio): a estrutura do CONDOMÍNIO, separada do Wi-Fi do apartamento. A Pista A agrupa em "Estrutura do condomínio".
  { chave: "condominio_wifi_rede", rotulo: "Wi-Fi do condomínio: rede", ajuda: "Áreas comuns, quando houver.", max: 100 },
  { chave: "condominio_wifi_senha", rotulo: "Wi-Fi do condomínio: senha", ajuda: "", max: 100 },
  { chave: "condominio_recepcao", rotulo: "Recepção do condomínio", ajuda: "Horário e como funciona a portaria ou recepção.", max: 500 },
  { chave: "condominio_fechadura", rotulo: "Fechadura do condomínio", ajuda: "Portão, eclusa ou porta comum: código, biometria ou chave.", max: 500 },
  { chave: "lixo", rotulo: "Lixo", ajuda: "Onde e quando descartar.", max: 500 },
  { chave: "vaga", rotulo: "Vaga", ajuda: "", max: 500 },
  { chave: "contatos_predio", rotulo: "Contatos úteis do prédio", ajuda: "Portaria, zelador, síndico.", max: 500 },
  // E662: a instrução ÚNICA de saída — o mesmo texto para o morador e para o dono (a cópia do contrato é congelada na 1ª assinatura).
  { chave: "instrucao_saida", rotulo: "Como sair (check-out)", ajuda: "Horário, o que deixar, chaves e a regra de devolução do condomínio.", max: INSTRUCAO_SAIDA_MAX },
  { chave: "observacoes", rotulo: "Observações", ajuda: "", max: 1500 },
] as const;

/** Os campos da "Estrutura do condomínio" (E661): quem agrupa a tela lê daqui, sem repetir as chaves. */
export const CAMPOS_CONDOMINIO = ["condominio_wifi_rede", "condominio_wifi_senha", "condominio_recepcao", "condominio_fechadura"] as const;

export type ChaveInstrucao = (typeof CAMPOS_INSTRUCOES)[number]["chave"];
export type Instrucoes = Partial<Record<ChaveInstrucao, string | null>>;

/** Preenchidas = ao menos "como entrar" ou outro campo com texto. */
export function instrucoesPreenchidas(i: Instrucoes | null | undefined): boolean {
  return !!i && CAMPOS_INSTRUCOES.some((c) => (i[c.chave] ?? "").trim().length > 0);
}

/** Limpa e corta cada campo no limite; devolve só os campos conhecidos. */
export function normalizarInstrucoes(entrada: Record<string, unknown>): Instrucoes {
  const out: Instrucoes = {};
  for (const c of CAMPOS_INSTRUCOES) {
    const v = typeof entrada[c.chave] === "string" ? (entrada[c.chave] as string).trim().slice(0, c.max) : "";
    out[c.chave] = v || null;
  }
  return out;
}

/** O texto por contrato (contratos_checkin.instrucoes) sobrescreve "como entrar" quando presente. */
export function instrucoesEfetivas(doImovel: Instrucoes | null, doContrato: string | null | undefined, saidaDoContrato?: string | null): Instrucoes | null {
  const sobrescrita = (doContrato ?? "").trim();
  const saida = (saidaDoContrato ?? "").trim();
  if (!doImovel && !sobrescrita && !saida) return null;
  // E662: a cópia da instrução de saída congelada no contrato vence a do imóvel.
  return { ...(doImovel ?? {}), ...(sobrescrita ? { como_entrar: sobrescrita } : {}), ...(saida ? { instrucao_saida: saida } : {}) };
}

/**
 * O que o EDITOR do dono mostra (achado do QA, 21/10): exatamente o que está publicado para este contrato. Com o texto
 * do contrato (combinação de check-in), "Como entrar" abre com ele — antes, o editor lia só o imóvel e abria vazio
 * enquanto o morador via o texto do contrato.
 */
export function instrucoesParaEditar(doImovel: Instrucoes | null, doContrato: string | null | undefined): Instrucoes {
  return instrucoesEfetivas(doImovel, doContrato) ?? {};
}

/**
 * Para onde vai cada campo salvo: com texto do contrato, "Como entrar" volta para o contrato (só este contrato) e o
 * "como entrar" do imóvel fica como estava; o resto vai para o imóvel (vale para as próximas estadias).
 */
export function separarSalvamento(
  campos: Instrucoes,
  doImovel: Instrucoes | null,
  temTextoDoContrato: boolean,
): { imovel: Instrucoes; comoEntrarDoContrato: string | null } {
  if (!temTextoDoContrato) return { imovel: campos, comoEntrarDoContrato: null };
  return { imovel: { ...campos, como_entrar: doImovel?.como_entrar ?? null }, comoEntrarDoContrato: (campos.como_entrar ?? "").trim() || null };
}

/** Dia (AAAA-MM-DD) em que as instruções ficam visíveis ao morador. */
export function diaDaLiberacao(inicio: string | null): string | null {
  if (!inicio) return null;
  const d = new Date(`${inicio}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - LIBERACAO_DIAS);
  return d.toISOString().slice(0, 10);
}

export interface CondicaoLiberacao {
  inicio: string | null;
  assinadoPelasDuas: boolean;
  primeiroPagamento: boolean;
}

/** Liberadas no D-7 (calendário de Brasília), com o contrato assinado pelas duas partes e o 1º pagamento registrado. */
export function instrucoesLiberadas(c: CondicaoLiberacao, agora: Date = new Date()): boolean {
  const dia = diaDaLiberacao(c.inicio);
  if (!dia || !c.assinadoPelasDuas || !c.primeiroPagamento) return false;
  const hoje = diaBRT(agora);
  return !!hoje && diasAte(dia, hoje) >= 0;
}

/** O que o morador vê antes da liberação. */
export function textoAntesDaLiberacao(c: CondicaoLiberacao): string {
  const dia = diaDaLiberacao(c.inicio);
  if (!dia) return "Liberadas 7 dias antes da entrada.";
  const extra = !c.assinadoPelasDuas
    ? " Antes, o contrato precisa estar assinado pelas duas partes."
    : !c.primeiroPagamento
      ? " Antes, o 1º pagamento precisa estar registrado."
      : "";
  return `Liberadas em ${ddmmaaaa(dia)}.${extra}`;
}

/** A rotina diária avisa o morador no dia da liberação (uma vez). */
export function liberaHoje(c: CondicaoLiberacao, agora: Date = new Date()): boolean {
  const dia = diaDaLiberacao(c.inicio);
  return !!dia && diaBRT(agora) === dia && c.assinadoPelasDuas && c.primeiroPagamento;
}

/** Lembrete ao dono 10 dias antes, se ainda não preenchidas. */
export function lembrarDono(inicio: string | null, preenchidas: boolean, agora: Date = new Date()): boolean {
  if (!inicio || preenchidas) return false;
  const hoje = diaBRT(agora);
  return !!hoje && diasAte(hoje, inicio) === LEMBRETE_DONO_DIAS;
}

/*
  E661 — no guia da estadia, as instruções saem em blocos: "Como entrar" (a chegada), "O imóvel e o que está incluso"
  (o que o dono declara do apartamento — Wi-Fi do APARTAMENTO, vaga, observações) e "Estrutura do condomínio" (regras do
  condomínio, lixo, contatos do prédio; texto "informado pelo proprietário, pode variar"). Só reagrupa campos que já
  existem (sem coluna nova); um Wi-Fi do condomínio hoje vai no campo de regras/contatos do prédio.
*/
export type GrupoInstrucao = "entrada" | "saida" | "imovel" | "condominio";
export const GRUPO_DA_INSTRUCAO: Record<ChaveInstrucao, GrupoInstrucao> = {
  como_entrar: "entrada",
  instrucao_saida: "saida", // E662: a instrução ÚNICA de saída, em bloco próprio, igual para morador, dono e convidado
  wifi_rede: "imovel",
  wifi_senha: "imovel",
  vaga: "imovel",
  observacoes: "imovel",
  regras_condominio: "condominio",
  lixo: "condominio",
  contatos_predio: "condominio",
};
export const TITULO_GRUPO_INSTRUCAO: Record<GrupoInstrucao, string> = {
  entrada: "Como entrar",
  saida: "Como sair (check-out)",
  imovel: "O imóvel e o que está incluso",
  condominio: "Estrutura do condomínio",
};
export const NOTA_ESTRUTURA_CONDOMINIO_GUIA = "Informado pelo proprietário, pode variar.";

export interface CampoDaInstrucao {
  chave: ChaveInstrucao;
  rotulo: string;
  valor: string;
}

/** Os campos COM texto, por grupo, na ordem do catálogo. Grupo sem texto some. */
export function agruparInstrucoes(campos: Instrucoes | null | undefined): { grupo: GrupoInstrucao; titulo: string; campos: CampoDaInstrucao[] }[] {
  const porGrupo: Record<GrupoInstrucao, CampoDaInstrucao[]> = { entrada: [], saida: [], imovel: [], condominio: [] };
  for (const c of CAMPOS_INSTRUCOES) {
    const valor = (campos?.[c.chave] ?? "").trim();
    if (valor) porGrupo[GRUPO_DA_INSTRUCAO[c.chave]].push({ chave: c.chave, rotulo: c.rotulo, valor: campos![c.chave]! });
  }
  return (["entrada", "saida", "imovel", "condominio"] as const).filter((g) => porGrupo[g].length > 0).map((g) => ({ grupo: g, titulo: TITULO_GRUPO_INSTRUCAO[g], campos: porGrupo[g] }));
}
