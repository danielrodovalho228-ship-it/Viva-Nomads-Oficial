/**
 * Regras de pets do proprietário (ordem 022afabb, item 2) e compatibilidade
 * com a ficha do pet do inquilino (item 4). Puro: sem banco, sem tela.
 * A validação roda no servidor; a tela só repete para avisar cedo.
 */

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
export const MAX_REFORCO_CAUCAO = 100000;
export const MAX_TEXTO_CONDOMINIO = 200;

export interface RegrasPets {
  especies: EspeciePet[];
  porteMax: PortePet;
  qtdMax: number;
  /** Reforço de Caução por causa do pet, em R$ (0 = não exige). */
  reforcoCaucao: number;
  /** Regra do condomínio sobre pets, texto curto. */
  regrasCondominio: string;
}

export interface FichaPetResumo {
  especie: EspeciePet;
  porte: PortePet;
}

/** Aceita só o formato esperado; qualquer outra coisa vira null. */
export function normalizarRegrasPets(raw: unknown): RegrasPets | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const especies = Array.isArray(r.especies)
    ? ESPECIES_PET.filter((e) => (r.especies as unknown[]).includes(e))
    : [];
  if (especies.length === 0) return null;
  const porteMax = PORTES_PET.find((p) => p === r.porteMax);
  if (!porteMax) return null;
  const qtd = Number(r.qtdMax);
  if (!Number.isInteger(qtd) || qtd < 1 || qtd > MAX_PETS) return null;
  const reforcoBruto = r.reforcoCaucao == null || r.reforcoCaucao === "" ? 0 : Number(r.reforcoCaucao);
  if (!Number.isFinite(reforcoBruto) || reforcoBruto < 0 || reforcoBruto > MAX_REFORCO_CAUCAO) return null;
  const texto =
    typeof r.regrasCondominio === "string"
        r.regrasCondominio.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim()
      : "";
  if (texto.length > MAX_TEXTO_CONDOMINIO) return null;
  return {
    especies,
    porteMax,
    qtdMax: qtd,
    reforcoCaucao: Math.round(reforcoBruto * 100) / 100,
    regrasCondominio: texto,
  };
}

/** Linhas curtas para a página do anúncio ("Aceita: cão e gato", ...). */
export function linhasRegrasPets(r: RegrasPets): string[] {
  const nomes = r.especies.map((e) => ROTULO_ESPECIE[e]);
  const lista = nomes.length > 1 ? `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}` : nomes[0];
  const linhas = [
    `Aceita: ${lista}`,
    `Porte máximo: ${ROTULO_PORTE[r.porteMax]}`,
    `Até ${r.qtdMax} ${r.qtdMax === 1 ? "animal" : "animais"}`,
  ];
  if (r.reforcoCaucao > 0)
    linhas.push(`Reforço de Caução por pet: R$ ${r.reforcoCaucao.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  if (r.regrasCondominio) linhas.push(`Condomínio: ${r.regrasCondominio}`);
  return linhas;
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
  if (fichas.length > regras.qtdMax)
    motivos.push(`O imóvel aceita até ${regras.qtdMax} ${regras.qtdMax === 1 ? "animal" : "animais"}; você informou ${fichas.length}.`);
  for (const f of fichas) {
    if (!regras.especies.includes(f.especie))
      motivos.push(`O imóvel não aceita ${ROTULO_ESPECIE[f.especie]}.`);
    else if (ORDEM_PORTE[f.porte] > ORDEM_PORTE[regras.porteMax])
      motivos.push(`O porte máximo é ${ROTULO_PORTE[regras.porteMax]}; seu ${ROTULO_ESPECIE[f.especie]} é ${ROTULO_PORTE[f.porte]}.`);
  }
  return { ok: motivos.length === 0, motivos: [...new Set(motivos)] };
}
