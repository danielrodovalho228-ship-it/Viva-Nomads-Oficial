/*
  E750: o aviso "Há alterações para salvar" × "Tudo salvo" do perfil compara o que está na tela com o RETRATO do que está gravado.
  O retrato precisa acompanhar TODA gravação — inclusive a que o bloco "Idiomas" faz ao ser desligado e limpo —, senão o aviso
  fica de pé depois de o perfil já estar salvo. PURO (node --test).
*/
export function retrato(nome: string, bio: string, cidade: string, idiomas: string[]): string {
  return JSON.stringify([nome.trim(), bio.trim(), cidade.trim(), [...idiomas].sort()]);
}

/** O retrato gravado depois de limpar os idiomas (o resto do perfil não muda). Sem retrato, continua sem. */
export function retratoSemIdiomas(salvo: string | null): string | null {
  if (salvo === null) return null;
  try {
    const [nome, bio, cidade] = JSON.parse(salvo) as [string, string, string, string[]];
    return JSON.stringify([nome, bio, cidade, []]);
  } catch {
    return salvo;
  }
}

/** Há alteração na tela em relação ao que está gravado? (Antes de o perfil carregar, não há.) */
export function perfilAlterado(salvo: string | null, atual: string): boolean {
  return salvo !== null && salvo !== atual;
}
