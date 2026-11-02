/*
  E147 → E429 (02/11) — bairro com nome de estado. O E147 recusava como bairro qualquer nome de estado (e a sigla,
  "Brasil" e a própria cidade). Falso positivo no uso real: "Minas Gerais" É um bairro oficial de Uberlândia (Zona Norte;
  CEP 38402-288, ViaCEP e BrasilAPI/Correios) — e há bairros São Paulo, Bahia, Paraná, Santa Catarina, Brasil… em
  várias cidades. Regra de agora, pura:
   - o bairro devolvido pela consulta do CEP é AUTORITATIVO: entra no campo como veio e nunca é tratado como erro;
   - nenhuma validação BLOQUEIA o bairro por ter nome de estado, de país ou da cidade (nem a tela, nem o servidor);
   - sobra só um AVISO, que não trava o avanço, quando o bairro DIGITADO diverge do que o CEP devolveu e tem nome de
     estado/sigla/país/cidade (provável engano de digitação ou de preenchimento automático).
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

const NOMES_DE_LUGAR = new Set([...Object.keys(ESTADOS), ...Object.values(ESTADOS), "Brasil", "Brazil"].map(chave));

/**
 * E429: aviso (NUNCA bloqueio) para o bairro digitado. Só existe quando o CEP devolveu um bairro, o digitado DIVERGE
 * dele e o digitado tem nome de estado, sigla, país ou da própria cidade. Igual ao do CEP (o autoritativo) → null;
 * sem bairro do CEP para comparar → null.
 */
export function avisoDoBairro(bairro: string | null | undefined, opcoes: { bairroDoCep?: string | null; cidade?: string | null } = {}): string | null {
  const b = chave(bairro ?? "");
  const doCep = chave(opcoes.bairroDoCep ?? "");
  if (!b || !doCep || b === doCep) return null;
  const nomeDeLugar = NOMES_DE_LUGAR.has(b) || (!!opcoes.cidade && chave(opcoes.cidade) === b);
  if (!nomeDeLugar) return null;
  return `Confira o bairro: pelo CEP, é “${(opcoes.bairroDoCep ?? "").trim()}”. Se “${(bairro ?? "").trim()}” estiver certo, pode continuar.`;
}
