/*
  Montagem de CADA e-mail de cliente — PURA (rota rápida "e-mails profissionais"). Produção (notify, recibo, códigos,
  exclusão de conta) e o teste de auditoria chamam as mesmas funções: o que o teste confere é o que sai.
  Cada uma devolve assunto (com a marca), HTML no modelo único, texto puro, a imagem do tema e o rótulo do botão.
*/
import { ASSUNTOS, comMarca } from "./assuntos.ts";
import { corpoCodigo, corpoNotificacao, imagemEmail, textoNotificacao } from "./corpo-email.ts";
import { TEMPLATES, type NotificationEvent } from "./eventos-email.ts";
import { imagemDoEvento } from "./imagens-email.ts";
import { blocoDados, rodapeTexto } from "./modelo-email.ts";
import { textoEmail } from "./texto-seguro.ts";
import { escaparHtml } from "../escapar-html.ts";
import { VALIDADE_CODIGO_ASSINATURA_MS } from "../contrato-codigo.ts";
import { VALIDADE_CODIGO_EMAIL_MS } from "../seguranca/codigos-recuperacao.ts";
import { VALIDADE_CODIGO_MIN as VALIDADE_VINCULO_MIN } from "../vinculo/codigo.ts";

export interface EmailMontado {
  evento: string;
  /** Com "· Viva Nomads" (o envio não muda). */
  assunto: string;
  /** Título no corpo (h1) e no push: o assunto sem a marca. */
  titulo: string;
  html: string;
  text: string;
  /** Arquivo da imagem de cabeçalho (ex.: "documentos.jpg"). */
  imagem: string;
  botao: string | null;
}

/** Aceita só caminho interno ("/rota"), nunca "//" nem URL externa (mesma regra do ?next=). */
export function urlInterna(u: string | undefined, fallback = "/dashboard"): string {
  return u && u[0] === "/" && u[1] !== "/" && u[1] !== "\\" ? u : fallback;
}

/** E-mail de um evento do notify. `nomeHtml`/`nomeTexto` já vêm tratados (primeiro nome, escapado). */
export function montarNotificacao(p: {
  siteUrl: string;
  event: NotificationEvent;
  nomeHtml?: string;
  nomeTexto?: string;
  subject?: string;
  body?: (nome?: string) => string;
  ctaLabel?: string;
  pushUrl?: string;
  detailsHtml?: string;
  detailsText?: string;
  outro?: string;
}): EmailMontado {
  const base = TEMPLATES[p.event];
  const titulo = p.subject ?? base.subject;
  const body = p.body ?? base.body;
  const img = imagemDoEvento(p.event);
  // Detalhes que já trazem um link (ex.: "Responder pela plataforma") ficam com ele; os demais ganham UM botão para a
  // tela EXATA do evento (a mesma do push) — nunca a home. Com o app instalado, o link abre o app.
  const cta = p.detailsHtml && /<a\s/i.test(p.detailsHtml) ? undefined : { label: p.ctaLabel ?? base.cta, url: `${p.siteUrl}${urlInterna(p.pushUrl, base.path)}` };
  return {
    evento: p.event,
    assunto: comMarca(titulo),
    titulo,
    html: corpoNotificacao(p.siteUrl, {
      // O assunto pode trazer texto do usuário (título do imóvel): no HTML vai escapado.
      title: escaparHtml(titulo),
      intro: body(p.nomeHtml),
      detailsHtml: p.detailsHtml,
      cta,
      outro: p.outro,
      image: imagemEmail(p.siteUrl, img.arquivo, img.alt),
    }),
    text: textoNotificacao(p.siteUrl, { title: titulo, intro: body(p.nomeTexto), detailsText: p.detailsText, cta }),
    imagem: `${img.arquivo}.jpg`,
    botao: cta?.label ?? null,
  };
}

/*
  E206: os e-mails de código falam igual ao "código de acesso": a validade com o número real (da mesma constante que o
  servidor usa para vencer o código), "só funciona uma vez", a linha antifraude e o rodapé padrão completo no texto puro.
*/
export const validadeDoCodigo = (min: number) => `Ele vale por ${min} minutos e só funciona uma vez.`;
export const ANTIFRAUDE_CODIGO = "Nunca passe este código a ninguém — a Viva Nomads não pede código por WhatsApp ou SMS.";
const minutos = (ms: number) => Math.round(ms / 60_000);

function textoCodigo(siteUrl: string, o: { linha: string; codigo: string; min: number; seNaoFoi: string }): string {
  return [`${o.linha}: ${o.codigo}`, validadeDoCodigo(o.min), `${o.seNaoFoi} ${ANTIFRAUDE_CODIGO}`, "", rodapeTexto(siteUrl)].join("\n");
}

/** Código de 6 dígitos para assinar o contrato. */
export function emailCodigoAssinatura(siteUrl: string, o: { imovel: string; codigo: string }): EmailMontado {
  const img = imagemDoEvento("contract_signature_code");
  return {
    evento: "contract_signature_code",
    assunto: comMarca(ASSUNTOS.codigoAssinatura),
    titulo: ASSUNTOS.codigoAssinatura,
    html: corpoCodigo(siteUrl, {
      title: ASSUNTOS.codigoAssinatura,
      intro: `Use o código abaixo para assinar o contrato de <strong>${textoEmail(o.imovel, 80)}</strong>. ${validadeDoCodigo(minutos(VALIDADE_CODIGO_ASSINATURA_MS))}`,
      code: o.codigo,
      outro: `Se não foi você, ignore este e-mail e troque a senha. ${ANTIFRAUDE_CODIGO}`,
      image: imagemEmail(siteUrl, img.arquivo, img.alt),
    }),
    text: textoCodigo(siteUrl, { linha: `Seu código para assinar o contrato de "${o.imovel.replace(/[<>&]/g, "")}"`, codigo: o.codigo, min: minutos(VALIDADE_CODIGO_ASSINATURA_MS), seNaoFoi: "Se não foi você, ignore este e-mail e troque a senha." }),
    imagem: `${img.arquivo}.jpg`,
    botao: null,
  };
}

/** Código de 6 dígitos para refazer a verificação em duas etapas. */
export function emailCodigo2fa(siteUrl: string, o: { codigo: string }): EmailMontado {
  const img = imagemDoEvento("recuperacao_2fa");
  return {
    evento: "recuperacao_2fa",
    assunto: comMarca(ASSUNTOS.codigo2fa),
    titulo: ASSUNTOS.codigo2fa,
    html: corpoCodigo(siteUrl, {
      title: ASSUNTOS.codigo2fa,
      intro: `Use o código abaixo para refazer a verificação em duas etapas da sua conta. ${validadeDoCodigo(minutos(VALIDADE_CODIGO_EMAIL_MS))}`,
      code: o.codigo,
      outro: `Se não foi você, ignore este e-mail e troque a senha. ${ANTIFRAUDE_CODIGO}`,
      image: imagemEmail(siteUrl, img.arquivo, img.alt),
    }),
    text: textoCodigo(siteUrl, { linha: "Seu código para refazer a verificação em duas etapas", codigo: o.codigo, min: minutos(VALIDADE_CODIGO_EMAIL_MS), seNaoFoi: "Se não foi você, ignore este e-mail e troque a senha." }),
    imagem: `${img.arquivo}.jpg`,
    botao: null,
  };
}

/** Código de 6 dígitos para confirmar o vínculo profissional (e-mail corporativo). Só o código; nada além do domínio vai para o perfil. */
export function emailCodigoVinculo(siteUrl: string, o: { codigo: string }): EmailMontado {
  const img = imagemDoEvento("recuperacao_2fa");
  return {
    evento: "vinculo_codigo",
    assunto: comMarca(ASSUNTOS.codigoVinculo),
    titulo: ASSUNTOS.codigoVinculo,
    html: corpoCodigo(siteUrl, {
      title: ASSUNTOS.codigoVinculo,
      intro: `Use o código abaixo para confirmar o seu e-mail profissional no Viva Nomads. ${validadeDoCodigo(VALIDADE_VINCULO_MIN)}`,
      code: o.codigo,
      outro: `Se não foi você, ignore este e-mail. ${ANTIFRAUDE_CODIGO}`,
      image: imagemEmail(siteUrl, img.arquivo, img.alt),
    }),
    text: textoCodigo(siteUrl, { linha: "Seu código para confirmar o e-mail profissional", codigo: o.codigo, min: VALIDADE_VINCULO_MIN, seNaoFoi: "Se não foi você, ignore este e-mail." }),
    imagem: `${img.arquivo}.jpg`,
    botao: null,
  };
}

/** Confirmação de exclusão de conta: o link (com token) só no botão; o texto puro nunca leva o link. */
export function emailExclusaoConta(siteUrl: string, o: { url: string }): EmailMontado {
  const img = imagemDoEvento("exclusao_conta");
  const titulo = ASSUNTOS.exclusaoConta;
  const intro =
    "Recebemos um pedido para excluir sua conta no Viva Nomads. Se foi você, confirme no botão abaixo. O link vale por 30 minutos e só pode ser usado uma vez. Se não foi você, ignore este e-mail — nada será apagado.";
  return {
    evento: "exclusao_conta",
    assunto: comMarca(titulo),
    titulo,
    html: corpoNotificacao(siteUrl, { title: titulo, intro, cta: { label: "Confirmar exclusão da conta", url: o.url }, image: imagemEmail(siteUrl, img.arquivo, img.alt) }),
    text: textoNotificacao(siteUrl, { title: titulo, intro: `${intro} Use o botão "Confirmar exclusão da conta" na versão completa deste e-mail.` }),
    imagem: `${img.arquivo}.jpg`,
    botao: "Confirmar exclusão da conta",
  };
}

/** Parceria aprovada (Prompt 31a): o link de ativação (com token) só no botão; o texto puro nunca leva o link. */
export function emailParceriaAprovada(siteUrl: string, o: { url: string; nome?: string | null }): EmailMontado {
  const img = imagemDoEvento("parceria_aprovada");
  const titulo = ASSUNTOS.parceriaAprovada;
  const nome = textoEmail(String(o.nome ?? "").split(" ")[0] ?? "", 40);
  const intro = `Olá${nome ? " " + nome : ""}, a sua parceria com a Viva Nomads foi aprovada. Ative a sua página no botão abaixo: entre com a conta deste e-mail e complete o cadastro (foto, descrição, serviços e cidades). O link vale por 7 dias e só pode ser usado uma vez.`;
  return {
    evento: "parceria_aprovada",
    assunto: comMarca(titulo),
    titulo,
    html: corpoNotificacao(siteUrl, { title: titulo, intro, cta: { label: "Ativar minha página", url: o.url }, image: imagemEmail(siteUrl, img.arquivo, img.alt) }),
    text: textoNotificacao(siteUrl, { title: titulo, intro: `${intro.replace(/ no botão abaixo/, "")} Use o botão "Ativar minha página" na versão completa deste e-mail.` }),
    imagem: `${img.arquivo}.jpg`,
    botao: "Ativar minha página",
  };
}

export type TipoDocumentoFiscal = "recibo_aluguel" | "comprovante_caucao" | "termo_devolucao_caucao";

const ASSUNTO_FISCAL: Record<TipoDocumentoFiscal, string> = {
  recibo_aluguel: ASSUNTOS.recibo,
  comprovante_caucao: ASSUNTOS.comprovanteCaucao,
  termo_devolucao_caucao: ASSUNTOS.termoDevolucao,
};

/** Nome do anexo: "recibo-REC-2026-000004.pdf"; os demais seguem o número. */
export function nomeDoPdf(tipo: TipoDocumentoFiscal, numero: string): string {
  return tipo === "recibo_aluguel" ? `recibo-${numero}.pdf` : `${numero}.pdf`;
}

/**
 * Recibo, comprovante de Caução ou termo de devolução: imagem do tema, bloco de dados (documento, número, contrato),
 * botão "Ver na plataforma" e "Conferir autenticidade" como link de texto com rótulo (nunca URL crua).
 */
export function emailDocumentoFiscal(
  siteUrl: string,
  o: { tipo: TipoDocumentoFiscal; rotulo: string; numero: string; contratoRef: string; conferirUrl: string; papel: "locador" | "locatario" },
): EmailMontado {
  const img = imagemDoEvento("recibo_emitido");
  const intro = `Segue em anexo o ${o.rotulo.toLowerCase()} do seu contrato. Ele também fica guardado na plataforma, em Contratos (proprietário) ou Minhas locações (inquilino).`;
  const dados = blocoDados([
    { rotulo: "Documento", valor: textoEmail(o.rotulo, 60) },
    { rotulo: "Número", valor: textoEmail(o.numero, 40) },
    { rotulo: "Contrato", valor: textoEmail(o.contratoRef, 40) },
  ]);
  const conferir = `<p class="vn-p" style="margin:0;font-size:14px;line-height:1.6;color:#374151;">Quer conferir se o documento é verdadeiro? <a href="${o.conferirUrl}" style="color:#0A4FD6;font-weight:600;">Conferir autenticidade</a></p>`;
  const cta = { label: "Ver na plataforma", url: `${siteUrl}${o.papel === "locador" ? "/dashboard/contratos" : "/dashboard/locacoes"}` };
  return {
    evento: o.tipo,
    assunto: comMarca(ASSUNTO_FISCAL[o.tipo]),
    titulo: o.rotulo,
    html: corpoNotificacao(siteUrl, { title: textoEmail(o.rotulo, 80), intro: textoEmail(intro, 400), detailsHtml: dados + conferir, cta, image: imagemEmail(siteUrl, img.arquivo, img.alt) }),
    text: textoNotificacao(siteUrl, {
      title: o.rotulo,
      intro,
      detailsText: `Documento: ${o.rotulo}\nNúmero: ${o.numero}\nContrato: ${o.contratoRef}\nConferir autenticidade: ${o.conferirUrl}`,
      cta,
    }),
    imagem: `${img.arquivo}.jpg`,
    botao: cta.label,
  };
}
