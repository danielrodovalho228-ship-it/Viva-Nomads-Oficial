/*
  E541 (resto — qa-cliques-proprietario-2026-11-02 D-S4-01): o aviso "Nova mensagem recebida" (sino e
  /dashboard/notificacoes), o push e o botão do e-mail abriam /dashboard/mensagens SEM a conversa — caía na primeira da
  lista, não na que recebeu a mensagem. Agora o destino leva a conversa (?conversa=<id>), o mesmo endereço que o
  "Responder pela plataforma" (#2402) e o "Mensagem" da estadia já usam. Os avisos já gravados com o endereço sem a
  conversa ganham o destino certo na leitura, pelo ref_id (a conversa, gravada desde o E533). PURO.
  Roda: node --test src/lib/notifications/url-conversa.test.ts
*/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** /dashboard/mensagens?conversa=<id> (sem id válido: a lista de mensagens). */
export function urlDaConversa(conversaId: string | null | undefined): string {
  return conversaId && UUID.test(conversaId) ? `/dashboard/mensagens?conversa=${conversaId}` : "/dashboard/mensagens";
}

/** Destino do aviso na leitura: mensagem nova gravada só com "/dashboard/mensagens" abre a conversa do ref_id. */
export function urlDoAvisoComConversa(a: { evento: string; url: string | null; ref_id?: string | null }): string | null {
  if (a.evento === "new_message" && (a.url === "/dashboard/mensagens" || !a.url)) {
    const u = urlDaConversa(a.ref_id);
    return u === "/dashboard/mensagens" ? a.url : u;
  }
  return a.url;
}
