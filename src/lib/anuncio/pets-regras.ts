/**
 * Regras de pets do proprietário (ordem 022afabb, item 2) e compatibilidade
 * com a ficha do pet do inquilino (item 4). Puro: sem banco, sem tela.
 * A validação roda no servidor; a tela só repete para avisar cedo.
 */
import { lerReais } from "../reais.ts";

export const ESPECIES_PET = ["cao", "gato", "outro"] as const;
export type EspeciePet = (typeof ESPECIES_PET)[number];
export const PORTES_PET = ["P", "M", "G"] as const;
export type PortePet = (typeof PORTES_PET)[number];

export const ROTULO_ESPECIE: Record<EspeciePet, string> = { cao: "cão", gato: "gato", outro: "outro animal" };
export const ROTULO_PORTE: Record<PortePet, string> = {
  P: "pequeno (até 10 kg)",
  M: "médio (até 25 kg)",
  G: "grande (acima de 25 kg)",
};
const ORDEM_PORTE: Record<PortePet, number> = { P: 1, M: 2, G: 3 };

export const MAX_PETS = 3;
export const MAX_TEXTO_CONDOMINIO = 200;
export const MAX_VALOR_PET = 100000;
/** E263-A: observação curta do dono sobre pets. */
export const MAX_OBSERVACAO_PET = 140;
/** E263-A: porte em palavra curta, para a linha pública ("porte até médio"). */
export const PORTE_CURTO: Record<PortePet, string> = { P: "pequeno", M: "médio", G: "grande" };
/** E263-A: quantidade máxima — 1, 2 ou "3 ou mais" (o perfil do morador guarda até 3 pets). */
export function rotuloQtdPets(n: number): string {
  return n >= MAX_PETS ? `${MAX_PETS} ou mais` : String(n);
}

/** Valor pet: Caução pet (devolvida no fim) ou Taxa pet (não reembolsável). */
export const TIPOS_VALOR_PET = ["reembolsavel", "nao_reembolsavel"] as const;
export type TipoValorPet = (typeof TIPOS_VALOR_PET)[number];
export const ROTULO_TIPO_VALOR_PET: Record<TipoValorPet, string> = {
  reembolsavel: "Reembolsável (Caução pet)",
  nao_reembolsavel: "Não reembolsável (Taxa pet)",
};

function brl(v: number): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Texto do valor pet para anúncio e resumo; null quando não há valor. */
export function textoValorPet(r: Pick<RegrasPets, "valorPet" | "valorPetTipo"> | null | undefined): string | null {
  if (!r || !r.valorPet || r.valorPet <= 0) return null;
  return r.valorPetTipo === "nao_reembolsavel"
    ? `Taxa pet R$ ${brl(r.valorPet)} — não reembolsável`
    : `Caução pet R$ ${brl(r.valorPet)} — devolvida no fim`;
}

/**
 * Linha do resumo da candidatura: o valor pet do imóvel, separado, só quando a candidatura leva pet
 * (ficha do inquilino) e o imóvel aceita pet. Sem valor, sem regras ou sem pet: null.
 */
export function linhaValorPetCandidatura(
  petsAllowed: boolean | undefined,
  regras: Pick<RegrasPets, "valorPet" | "valorPetTipo"> | null | undefined,
  qtdPetsNaCandidatura: number
): string | null {
  if (!petsAllowed || qtdPetsNaCandidatura < 1) return null;
  const texto = textoValorPet(regras);
  return texto ? `Valor pet: ${texto}` : null;
}

export interface RegrasPets {
  especies: EspeciePet[];
  /** E263-A: opcional — sem porte informado, não há limite de porte. */
  porteMax?: PortePet;
  /** E263-A: opcional; 3 = "3 ou mais". */
  qtdMax?: number;
  /** Legado: sempre 0 ao gravar; o valor antigo migra para valorPet (Caução pet). */
  reforcoCaucao: number;
  /** Regra do condomínio sobre pets, texto curto. */
  regrasCondominio: string;
  /** Valor pet opcional, em R$ (0/ausente = não cobra). */
  valorPet?: number;
  valorPetTipo?: TipoValorPet;
  /** E263-A: taxa mensal de pet (R$/mês), opcional — pré-preenche a taxa pet da proposta quando o morador tem pet. */
  taxaMensal?: number;
  /** E263-A: observação curta do dono (até 140 caracteres). */
  observacao?: string;
}

export interface FichaPetResumo {
  especie: EspeciePet;
  porte: PortePet;
}

const limparTexto = (v: unknown) =>
  typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim() : "";

function lerValor(v: unknown): number {
  const lido = v == null || v === "" ? { ok: true as const, valor: 0 } : lerReais(v as string | number);
  return lido.ok ? (lido.valor ?? 0) : NaN;
}

/**
 * E263-A: o que o servidor recusa nas condições de pets, em português (null = ok). Tudo é opcional; só o formato e os
 * limites contam (observação até 140 caracteres, valores em reais válidos).
 */
export function erroRegrasPets(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (limparTexto(r.observacao).length > MAX_OBSERVACAO_PET) return `A observação sobre pets aceita até ${MAX_OBSERVACAO_PET} caracteres.`;
  if (limparTexto(r.regrasCondominio).length > MAX_TEXTO_CONDOMINIO) return `A regra do condomínio aceita até ${MAX_TEXTO_CONDOMINIO} caracteres.`;
  for (const [campo, nome] of [["taxaMensal", "A taxa mensal de pet"], ["valorPet", "O valor pet"]] as const) {
    const v = lerValor(r[campo]);
    if (!Number.isFinite(v) || v < 0 || v > MAX_VALOR_PET) return `${nome} precisa ser um valor em reais válido.`;
  }
  if (r.porteMax != null && r.porteMax !== "" && !PORTES_PET.some((p) => p === r.porteMax)) return "Escolha o porte máximo: pequeno, médio ou grande.";
  if (r.qtdMax != null && r.qtdMax !== "") {
    const q = Number(r.qtdMax);
    if (!Number.isInteger(q) || q < 1 || q > MAX_PETS) return "Escolha a quantidade máxima: 1, 2 ou 3 ou mais.";
  }
  return null;
}

/**
 * Aceita só o formato esperado; qualquer outra coisa vira null. E263-A: porte, quantidade, taxa mensal e observação
 * são opcionais; sem espécie marcada vale "qualquer animal"; sem condição nenhuma, null (o aceite geral).
 */
export function normalizarRegrasPets(raw: unknown): RegrasPets | null {
  if (!raw || typeof raw !== "object") return null;
  if (erroRegrasPets(raw)) return null;
  const r = raw as Record<string, unknown>;
  const marcadas = Array.isArray(r.especies) ? ESPECIES_PET.filter((e) => (r.especies as unknown[]).includes(e)) : [];
  const especies = marcadas.length > 0 ? marcadas : [...ESPECIES_PET];
  const porteMax = PORTES_PET.find((p) => p === r.porteMax);
  const qtd = r.qtdMax == null || r.qtdMax === "" ? undefined : Number(r.qtdMax);
  const reforcoBruto = r.reforcoCaucao == null || r.reforcoCaucao === "" ? 0 : Number(r.reforcoCaucao);
  if (!Number.isFinite(reforcoBruto) || reforcoBruto < 0 || reforcoBruto > MAX_VALOR_PET) return null;
  const texto = limparTexto(r.regrasCondominio);
  const observacao = limparTexto(r.observacao);
  const valorBruto = lerValor(r.valorPet);
  const tipo = TIPOS_VALOR_PET.find((t) => t === r.valorPetTipo);
  if (valorBruto > 0 && r.valorPetTipo != null && !tipo) return null;
  // Campo único: regras antigas só com "reforço de Caução" viram Caução pet.
  const legado = valorBruto === 0 && reforcoBruto > 0;
  const valorPet = Math.round((legado ? reforcoBruto : valorBruto) * 100) / 100;
  const taxaMensal = Math.round(lerValor(r.taxaMensal) * 100) / 100;
  // Nada informado além do "sim" (ou um congelado vazio, {}): sem regras — vale o aceite geral.
  if (marcadas.length === 0 && !porteMax && !qtd && !texto && !observacao && valorPet <= 0 && taxaMensal <= 0) return null;
  return {
    especies,
    ...(porteMax ? { porteMax } : {}),
    ...(qtd ? { qtdMax: qtd } : {}),
    reforcoCaucao: 0,
    regrasCondominio: texto,
    valorPet,
    ...(valorPet > 0 ? { valorPetTipo: legado ? "reembolsavel" : (tipo ?? "reembolsavel") } : {}),
    ...(taxaMensal > 0 ? { taxaMensal } : {}),
    ...(observacao ? { observacao } : {}),
  };
}

const todasEspecies = (r: RegrasPets) => ESPECIES_PET.every((e) => r.especies.includes(e));
const listaEspecies = (r: RegrasPets) => {
  const nomes = r.especies.map((e) => ROTULO_ESPECIE[e]);
  return nomes.length > 1 ? `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}` : nomes[0];
};
const textoQtd = (n: number) => (n >= MAX_PETS ? `${MAX_PETS} ou mais animais` : `Até ${n} ${n === 1 ? "animal" : "animais"}`);
/** "Taxa pet R$ 80,00/mês"; null sem taxa mensal. */
export function textoTaxaMensalPet(r: Pick<RegrasPets, "taxaMensal"> | null | undefined): string | null {
  return r?.taxaMensal && r.taxaMensal > 0 ? `Taxa pet R$ ${brl(r.taxaMensal)}/mês` : null;
}

/** Linhas curtas para a página do anúncio e o contrato ("Aceita: cão e gato", ...); só o que o dono informou. */
export function linhasRegrasPets(r: RegrasPets, opcoes: { semValorPet?: boolean } = {}): string[] {
  const linhas = [`Aceita: ${todasEspecies(r) ? "qualquer animal" : listaEspecies(r)}`];
  if (r.porteMax) linhas.push(`Porte máximo: ${ROTULO_PORTE[r.porteMax]}`);
  if (r.qtdMax) linhas.push(textoQtd(r.qtdMax));
  const taxa = opcoes.semValorPet ? null : textoTaxaMensalPet(r);
  if (taxa) linhas.push(taxa);
  const valorPet = opcoes.semValorPet ? null : textoValorPet(r);
  if (valorPet) linhas.push(valorPet);
  if (r.regrasCondominio) linhas.push(`Condomínio: ${r.regrasCondominio}`);
  if (r.observacao) linhas.push(r.observacao);
  return linhas;
}

/**
 * E263-A: "Aceita pets" e as condições do dono numa linha só, para a página pública
 * ("Aceita pets · cão e gato · porte até médio · até 2 animais · Taxa pet R$ 80,00/mês · …"). Sem pets: "Não aceita pets".
 */
export function linhaPetsPublica(petsAllowed: boolean | undefined, r: RegrasPets | null | undefined): string {
  if (!petsAllowed) return "Não aceita pets";
  if (!r) return "Aceita pets";
  const partes = ["Aceita pets"];
  if (!todasEspecies(r)) partes.push(listaEspecies(r));
  if (r.porteMax) partes.push(`porte até ${PORTE_CURTO[r.porteMax]}`);
  if (r.qtdMax) partes.push(r.qtdMax >= MAX_PETS ? `${MAX_PETS} ou mais animais` : `até ${r.qtdMax} ${r.qtdMax === 1 ? "animal" : "animais"}`);
  const taxa = textoTaxaMensalPet(r);
  if (taxa) partes.push(taxa);
  const valorPet = textoValorPet(r);
  if (valorPet) partes.push(valorPet);
  if (r.regrasCondominio) partes.push(`Condomínio: ${r.regrasCondominio}`);
  if (r.observacao) partes.push(r.observacao);
  return partes.join(" · ");
}

/**
 * E263-A: a linha NEUTRA de compatibilidade que o morador com "Meus pets" vê na página do anúncio — só quando há porte
 * e quantidade dos dois lados (o dono informou os dois; o morador tem pet cadastrado). Nunca bloqueia a candidatura.
 */
export function linhaCompatibilidadePets(
  petsAllowed: boolean | undefined,
  r: RegrasPets | null | undefined,
  fichas: FichaPetResumo[],
): { dentro: boolean; texto: string } | null {
  if (!petsAllowed || !r?.porteMax || !r.qtdMax || fichas.length === 0) return null;
  const { ok, motivos } = compatibilidadePets(petsAllowed, r, fichas);
  return ok
    ? { dentro: true, texto: "Seus pets estão dentro das condições do dono." }
    : { dentro: false, texto: `Confira com o dono: ${motivos.join(" ")}` };
}

/**
 * O(s) pet(s) do inquilino cabem nas regras do imóvel? Sem regras detalhadas
 * (imóvel só marcado "aceita pets"), vale o aceite geral.
 */
export function compatibilidadePets(
  petsAllowed: boolean | undefined,
  regras: RegrasPets | null,
  fichas: FichaPetResumo[]
): { ok: boolean; motivos: string[] } {
  if (fichas.length === 0) return { ok: true, motivos: [] };
  if (petsAllowed === false) return { ok: false, motivos: ["Este imóvel não aceita animais."] };
  if (!regras) return { ok: true, motivos: [] };
  const motivos: string[] = [];
  if (regras.qtdMax && fichas.length > regras.qtdMax)
    motivos.push(`O imóvel aceita até ${regras.qtdMax} ${regras.qtdMax === 1 ? "animal" : "animais"}; você informou ${fichas.length}.`);
  for (const f of fichas) {
    if (!regras.especies.includes(f.especie))
      motivos.push(`O imóvel não aceita ${ROTULO_ESPECIE[f.especie]}.`);
    else if (regras.porteMax && ORDEM_PORTE[f.porte] > ORDEM_PORTE[regras.porteMax])
      motivos.push(`O porte máximo é ${ROTULO_PORTE[regras.porteMax]}; seu ${ROTULO_ESPECIE[f.especie]} é ${ROTULO_PORTE[f.porte]}.`);
  }
  return { ok: motivos.length === 0, motivos: [...new Set(motivos)] };
}

/**
 * Filtro da busca: o imóvel aceita um pet deste porte? Sem regras detalhadas
 * (só "aceita pets") vale o aceite geral, como em compatibilidadePets.
 */
export function aceitaPorte(petsAllowed: boolean | undefined, regras: RegrasPets | null | undefined, porte: PortePet): boolean {
  if (!petsAllowed) return false;
  if (!regras?.porteMax) return true;
  return ORDEM_PORTE[porte] <= ORDEM_PORTE[regras.porteMax];
}

/** Quantos pets a candidatura levava quando as regras foram congeladas no contrato (0 se não consta). */
export function qtdPetsCongelada(raw: unknown): number {
  if (!raw || typeof raw !== "object") return 0;
  const n = Number((raw as Record<string, unknown>).qtdPetsCandidatura);
  return Number.isInteger(n) && n >= 1 && n <= MAX_PETS ? n : 0;
}
