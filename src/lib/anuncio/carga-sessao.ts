/*
  E398 (resíduo): enquanto a sessão não era conferida (`authChecked` começa `false` a cada carga), o cartão do anúncio mostrava os botões de
  visita no estado "carregando" (desativados) e, no anúncio de teste, o "Pedir para morar" desativado, mesmo para quem JÁ estava logado
  (o store persistido já tem o usuário). Regra: com usuário conhecido, espera-se só o que falta de DADO dele (as visitas; o perfil is_teste);
  sem usuário conhecido, espera-se a conferência da sessão. Com pista velha (sessão expirada) o cartão se corrige sozinho quando a
  conferência chega (`semLogin`). PURO (node --test).
*/
export function carregandoDasVisitas(o: { exemplo: boolean; authChecked: boolean; usuarioId: string | null; visitasPara: string | null }): boolean {
  if (o.exemplo) return false;
  if (o.usuarioId) return o.visitasPara !== o.usuarioId;
  return !o.authChecked;
}

export function aguardandoPerfilDeTeste(o: { modoVisitante: boolean; authChecked: boolean; temUsuario: boolean; isTeste: boolean | undefined }): boolean {
  if (!o.modoVisitante) return false;
  if (o.temUsuario) return o.isTeste === undefined;
  return !o.authChecked;
}
