/*
  E657 — o envio da candidatura, pela fonte única (morador e dono leem a mesma regra). PURO, node --test.
  `created_at` é o primeiro envio; `reenviada_em` (migração 0315) é o último, quando a candidatura repetida atualizou o lead (E581).
  Vale o último envio; com reenvio a tela mostra o selo "Reenviada" e a data do primeiro envio.
*/
export interface EnvioDaCandidatura {
  enviadaEm: string | null;
  reenviada: boolean;
  primeiroEnvioEm: string | null;
}

export function envioDaCandidatura(criadaEm: string | null, reenviadaEm: string | null | undefined): EnvioDaCandidatura {
  const reenvio = reenviadaEm && (!criadaEm || Date.parse(reenviadaEm) > Date.parse(criadaEm)) ? reenviadaEm : null;
  if (!reenvio) return { enviadaEm: criadaEm, reenviada: false, primeiroEnvioEm: null };
  return { enviadaEm: reenvio, reenviada: true, primeiroEnvioEm: criadaEm };
}
