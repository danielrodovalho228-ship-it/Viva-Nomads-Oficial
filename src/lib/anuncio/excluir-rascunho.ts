/*
  E515 (QA de cliques do proprietário, 02/11) — a confirmação de "Excluir rascunho" era genérica ("Excluir este
  rascunho?") e não dizia QUAL rascunho ia ser apagado; com dois rascunhos na lista, não dava para ter certeza. Agora a
  confirmação (e o rótulo do botão para leitor de tela) nomeia o rascunho: título e, quando houver, o bairro. PURO.
  Roda: node --test src/lib/anuncio/excluir-rascunho.test.ts
*/

/** "Casa no Santa Mônica" · "Santa Mônica" → `“Casa no Santa Mônica” (Santa Mônica)`; sem título → "sem título". */
export function nomeDoRascunho(titulo: string | null | undefined, bairro?: string | null): string {
  const t = (titulo ?? "").trim();
  const b = (bairro ?? "").trim();
  const nome = t ? `“${t}”` : "sem título";
  return b && !t.toLowerCase().includes(b.toLowerCase()) ? `${nome} (${b})` : nome;
}

/** O aviso da confirmação: diz qual rascunho será apagado. */
export function avisoExcluirRascunho(titulo: string | null | undefined, bairro?: string | null): string {
  return `Excluir o rascunho ${nomeDoRascunho(titulo, bairro)}? Esta ação não pode ser desfeita.`;
}

/** Rótulo acessível do botão (lixeira) de cada rascunho. */
export function rotuloExcluirRascunho(titulo: string | null | undefined, bairro?: string | null): string {
  return `Excluir o rascunho ${nomeDoRascunho(titulo, bairro)}`;
}
