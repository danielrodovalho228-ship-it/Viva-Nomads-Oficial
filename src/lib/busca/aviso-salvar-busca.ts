/**
 * Adendo ao E82-A ("Avisar-me" na busca): a frase que aparece ao salvar uma busca diz se o aviso por e-mail está ligado.
 * O alerta já existe e nasce ligado (buscas_salvas.alerta_ativo, 0137); o envio respeita profiles.notif_email. Um texto
 * só, usado pelo "Salvar busca" da linha da contagem e pelo "Criar alerta desta busca" do estado sem resultado.
 */
export type AvisoSalvarBusca =
  | { tipo: "com_email"; id: string }
  | { tipo: "sem_aviso" }
  | { tipo: "email_desligado" }
  | { tipo: "convidado" }
  | { tipo: "removida" }
  | { tipo: "erro"; texto: string };

export const AVISO_COM_EMAIL = "Busca salva. Vamos te avisar por e-mail quando surgir um imóvel assim.";
export const AVISO_SEM_AVISO = "Busca salva, sem aviso por e-mail. Você pode ligar em Buscas salvas.";
export const AVISO_EMAIL_DESLIGADO = "Busca salva. Seus avisos por e-mail estão desligados.";
export const AVISO_CONVIDADO = "Busca guardada neste aparelho. Entre com seu e-mail para receber alertas.";
export const AVISO_REMOVIDA = "Busca removida.";
export const ROTULO_NAO_AVISAR = "Não me avisar";
export const ROTULO_LIGAR_NOTIFICACOES = "Ligar em Notificações";
export const HREF_NOTIFICACOES = "/dashboard/conta/notificacoes";

/** Depois de salvar logado: com o e-mail ligado, o aviso da busca já está ativo; desligado, a frase diz isso. */
export function avisoAoSalvar(r: { id: string | null; avisoEmail: boolean }): AvisoSalvarBusca {
  if (!r.avisoEmail) return { tipo: "email_desligado" };
  return r.id ? { tipo: "com_email", id: r.id } : { tipo: "sem_aviso" };
}

export function textoDoAviso(a: AvisoSalvarBusca): string {
  switch (a.tipo) {
    case "com_email":
      return AVISO_COM_EMAIL;
    case "sem_aviso":
      return AVISO_SEM_AVISO;
    case "email_desligado":
      return AVISO_EMAIL_DESLIGADO;
    case "convidado":
      return AVISO_CONVIDADO;
    case "removida":
      return AVISO_REMOVIDA;
    case "erro":
      return a.texto;
  }
}
