/*
  E147 — o bairro gravado como o ESTADO ("o bairro cadastrado é Minas Gerais"). Regra única, pura: bairro não pode ser
  um estado (nome ou sigla), nem "Brasil", nem a própria cidade. Vale em toda entrada (CEP, busca por endereço,
  matrícula, digitação/preenchimento automático do celular) e de novo no servidor.
*/
const ESTADOS: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará", DF: "Distrito Federal",
  ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais",
  PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
};

const chave = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const PROIBIDOS = new Set([...Object.keys(ESTADOS), ...Object.values(ESTADOS), "Brasil", "Brazil"].map(chave));

/** Motivo de o bairro não valer (null = vale). Bairro vazio não é tratado aqui (a obrigatoriedade é de quem chama). */
export function problemaDoBairro(bairro: string | null | undefined, cidade?: string | null): string | null {
  const b = chave(bairro ?? "");
  if (!b) return null;
  if (PROIBIDOS.has(b)) return `“${(bairro ?? "").trim()}” é um estado, não um bairro. Informe o bairro do imóvel.`;
  if (cidade && chave(cidade) === b) return `“${(bairro ?? "").trim()}” é a cidade, não o bairro. Informe o bairro do imóvel.`;
  return null;
}

/** Bairro que pode ser aplicado no formulário: o que não vale vira "" (o campo fica para a pessoa preencher). */
export function bairroAceitavel(bairro: string | null | undefined, cidade?: string | null): string {
  return problemaDoBairro(bairro, cidade) ? "" : (bairro ?? "").trim();
}
