/*
  E1084 (ORDEM-DUET-399): FONTE ÚNICA do nome do avaliador em todas as superfícies — o nome da CONTA
  (profiles.full_name), sem as marcas de teste do começo ("[TESTE QA] …"); sem nome na conta (ou um e-mail no lugar
  dele), o nome público do parceiro; sem nenhum, "Avaliador". PURO (node --test).
*/
const semMarcas = (n: string | null | undefined) => String(n ?? "").trim().replace(/^(\[[^\]]*\]\s*)+/, "").trim();

export function nomeDoAvaliador(nomeDaConta: string | null | undefined, nomeDoParceiro: string | null | undefined): string {
  const conta = semMarcas(nomeDaConta);
  if (conta && !conta.includes("@")) return conta;
  const parceiro = semMarcas(nomeDoParceiro);
  return parceiro && !parceiro.includes("@") ? parceiro : "Avaliador";
}

/** O primeiro nome (e-mails do laudo, cartões curtos), pela mesma fonte. */
export function primeiroNomeDoAvaliador(nomeDaConta: string | null | undefined, nomeDoParceiro: string | null | undefined): string {
  return nomeDoAvaliador(nomeDaConta, nomeDoParceiro).split(/\s+/)[0];
}
