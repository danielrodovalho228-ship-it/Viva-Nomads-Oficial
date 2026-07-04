/*
  Templates de notificação do Pedido de Moradia (deep link para a página certa).

  ADAPTER WHATSAPP — ESTRUTURA, sem integração real ainda:
  o WhatsApp serve APENAS para AVISAR (canal de SAÍDA). Toda conversa acontece
  DENTRO da plataforma — é o que fica documentado e registrado. Por isso cada
  template termina com "Responda pela plataforma: [link]". Quando a WhatsApp
  Business API for contratada, é só plugar o provider (ver `sendWhatsapp`), pois
  a mensagem já leva o link certo.

  IMPORTANTE ao integrar: respostas recebidas NO WhatsApp NÃO são processadas —
  configurar auto-reply no provedor orientando a responder pelo site.
*/

import { SITE_URL } from "@/lib/site";

export interface NotifDetalhe {
  detailsHtml: string; // anexado ao corpo do e-mail
  detailsText: string; // anexado à mensagem de WhatsApp (adapter)
}

function link(path: string): string {
  return `${SITE_URL}${path}`;
}

function bloco(texto: string, ctaLabel: string, path: string): NotifDetalhe {
  const url = link(path);
  return {
    detailsHtml: `<p style="margin:12px 0 0;color:#334155;">${texto}</p>
      <p style="margin:12px 0 0;"><a href="${url}" style="color:#0f3d2e;font-weight:700;">${ctaLabel} →</a></p>`,
    // Canal de SAÍDA: sempre encerra convidando a responder pela plataforma.
    detailsText: `${texto}\n\nResponda pela plataforma: ${url}`,
  };
}

/** Novo pedido na cidade → proprietário (leva à lista de pedidos). */
export function detalheNovoPedido(cidade: string): NotifDetalhe {
  return bloco(
    `Um inquilino publicou um pedido de moradia em ${cidade}. Responda com um imóvel seu.`,
    "Ver pedidos",
    "/pedidos"
  );
}

/** Nova resposta → inquilino (leva ao painel de pedidos dele). */
export function detalheResposta(): NotifDetalhe {
  return bloco(
    "Um proprietário respondeu ao seu pedido com um imóvel. Veja e aceite para conversar.",
    "Ver respostas",
    "/dashboard/pedidos"
  );
}

/** Aceito para conversa → proprietário (leva às mensagens). */
export function detalheAceito(): NotifDetalhe {
  return bloco(
    "Um inquilino aceitou sua resposta e abriu a conversa.",
    "Abrir mensagens",
    "/dashboard/mensagens"
  );
}

/** Pedido expirando → inquilino (leva ao painel para renovar/atender). */
export function detalheExpirando(): NotifDetalhe {
  return bloco(
    "Seu pedido de moradia expira em até 3 dias. Renove publicando de novo ou marque como atendido.",
    "Ver meus pedidos",
    "/dashboard/pedidos"
  );
}
