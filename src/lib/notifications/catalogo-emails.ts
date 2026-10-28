/*
  Catálogo de TODOS os e-mails de cliente com dados fictícios (rota rápida "e-mails profissionais", item 6) — PURO.
  Fonte do teste de auditoria, da rota /api/test-email?all=1 e da prévia /dev/emails. Usa as MESMAS funções de
  montagem da produção (montar-email.ts, aviso-decisao.ts, templates-supabase.ts). E-mails internos (equipe, Moacir,
  leads) ficam fora.
*/
import { assuntoChamado, assuntoManutencao, ASSUNTOS } from "./assuntos.ts";
import { TEMPLATES, type NotificationEvent } from "./eventos-email.ts";
import { aberturaAssinatura, aberturaContratoPronto, aberturaProposta, linhasContrato, linhasProposta, proximoPassoAssinatura, proximoPassoProposta, PROXIMO_PASSO_CONTRATO_PRONTO, type Desfecho } from "./dados-negociacao.ts";
import { blocoDados } from "./modelo-email.ts";
import { emailCodigo2fa, emailCodigoVinculo, emailCodigoAssinatura, emailDocumentoFiscal, emailExclusaoConta, emailParceriaAprovada, montarNotificacao, type EmailMontado } from "./montar-email.ts";
import { REMETENTE } from "./remetente.ts";
import { templatesSupabase } from "./templates-supabase.ts";
import { emailDecisaoDocumento, linhasDoAviso } from "../documento/aviso-decisao.ts";
import {
  TEXTO_EXPIRADA_DONO,
  TEXTO_EXPIRADA_MORADOR,
  boasVindas,
  detalhes,
  propostaAceitaDono,
  propostaAceitaMorador,
  propostaRecusada,
  vesperaTexto,
  visitaCancelada,
  type EmailPassos,
} from "./emails-e205b.ts";

export interface EmailDoCatalogo extends EmailMontado {
  chave: string;
  remetente: string;
  /** "app" = enviado pelo Resend; "conta" = modelo do Supabase Auth (assunto/corpo colados no painel). */
  origem: "app" | "conta";
}

/** Eventos do notify que só vão para a equipe. */
export const EVENTOS_SO_EQUIPE: NotificationEvent[] = ["chamado_equipe", "documento_recebido", "parceria_equipe", "alerta_backup_falhou", "alerta_email_falhou"];

const PROP = "1b2c3d4e-0000-4000-8000-000000000001";

function doApp(chave: string, m: EmailMontado): EmailDoCatalogo {
  return { ...m, chave, remetente: REMETENTE, origem: "app" };
}

/** Variáveis do Supabase trocadas por exemplos (só para a prévia e a rota de amostras). */
function exemploSupabase(html: string, site: string): string {
  return html
    .replace(/\{\{ \.SiteURL \}\}/g, site)
    .replace(/\{\{ \.TokenHash \}\}/g, "exemplo")
    .replace(/\{\{ \.Token \}\}/g, "824519")
    .replace(/\{\{ \.NewEmail \}\}/g, "novo@exemplo.com");
}

export function catalogoEmails(siteUrl: string): EmailDoCatalogo[] {
  const nome = { nomeHtml: "Marcos", nomeTexto: "Marcos" };
  const lista: EmailDoCatalogo[] = [];

  // 1. Todos os eventos do notify, com o texto padrão.
  for (const ev of Object.keys(TEMPLATES) as NotificationEvent[]) {
    if (EVENTOS_SO_EQUIPE.includes(ev)) continue;
    lista.push(doApp(ev, montarNotificacao({ siteUrl, event: ev, ...nome })));
  }

  // 2. Os que saem com assunto próprio.
  for (const ev of ["chamado_aberto", "chamado_respondido", "chamado_resolvido"] as const) {
    lista.push(doApp(`${ev}:numero`, montarNotificacao({ siteUrl, event: ev, ...nome, subject: assuntoChamado(ev, "VN-0001"), pushUrl: "/ajuda" })));
  }
  lista.push(doApp("manutencao:urgente", montarNotificacao({ siteUrl, event: "manutencao_nova", ...nome, subject: assuntoManutencao({ urgente: true, lembrete: false }), pushUrl: "/dashboard/solicitacoes" })));
  lista.push(doApp("manutencao:lembrete", montarNotificacao({ siteUrl, event: "manutencao_nova", ...nome, subject: assuntoManutencao({ urgente: false, lembrete: true }), pushUrl: "/dashboard/solicitacoes" })));
  // E202: proposta e contrato com os dados da negociação (imóvel, período, valores, prazo) e o próximo passo.
  const IM = { titulo: "Apto Santa Mônica", bairro: "Santa Mônica", cidade: "Uberlândia" };
  const quadro = (l: { rotulo: string; valor: string }[], passo: string) => blocoDados(l) + `<p>${passo}</p>`;
  const lp = (prazo: string | null) =>
    linhasProposta({ numero: "ORC-2026-0001", imovel: IM, entrada: "2026-11-01", saida: "2027-02-28", meses: 4, valorMensal: 2700, contaTotal: "4 × R$ 2.700 + preparação R$ 450 = R$ 11.250", responderAte: prazo });
  const prop = (chave: string, ev: "proposta_recebida" | "proposta_respondida", assunto: string, d: Desfecho, papel: "owner" | "tenant") =>
    lista.push(
      doApp(
        chave,
        montarNotificacao({
          siteUrl,
          event: ev,
          ...nome,
          subject: assunto,
          body: (n) => aberturaProposta(d, { nome: n, imovel: IM, novoValorMensal: 2700, motivo: d === "recusada" ? "Datas não servem" : null }),
          detailsHtml: quadro(lp(d === "nova" || d === "contraproposta" ? "2026-10-30T18:00:00Z" : null), proximoPassoProposta(d, papel)),
          pushUrl: `/dashboard/propostas/${PROP}`,
        }),
      ),
    );
  prop("proposta:recebida", "proposta_recebida", ASSUNTOS.propostaRecebida, "nova", "tenant");
  prop("proposta:contraproposta", "proposta_recebida", ASSUNTOS.propostaRecebida, "contraproposta", "owner");
  // E205-B (b)(c): aceite = dois e-mails (dono e morador); recusa = "{Primeiro nome} recusou a proposta", por lado.
  const comPassos = (chave: string, ev: NotificationEvent, e: EmailPassos, antes = "") => {
    const d = detalhes({ titulo: e.titulo, passos: e.passos, rodape: e.rodape });
    lista.push(doApp(chave, montarNotificacao({ siteUrl, event: ev, ...nome, subject: e.assunto, body: e.abertura, ctaLabel: e.cta, pushUrl: e.url, detailsHtml: antes + d.html, detailsText: d.texto })));
  };
  const quadroDe = (d: Desfecho, papel: "owner" | "tenant") => quadro(lp(null), proximoPassoProposta(d, papel));
  comPassos("proposta:aceita", "proposta_aceita", propostaAceitaDono({ nomeMorador: "Ana Souza", leadId: PROP }), quadroDe("aceita", "owner"));
  comPassos("proposta:aceita:morador", "proposta_aceita", propostaAceitaMorador({ dataEntrada: "2026-11-01", propostaId: PROP }), quadroDe("aceita", "tenant"));
  const recusa = (chave: string, quem: "owner" | "tenant", nomeQuem: string) => {
    const e = propostaRecusada({ quemRecusou: quem, nomeDeQuemRecusou: nomeQuem, motivo: "Datas", texto: "Preciso entrar só em dezembro", propostaId: PROP, cidade: "Uberlândia" });
    comPassos(chave, "proposta_recusada", e, quadroDe("recusada", quem === "tenant" ? "owner" : "tenant"));
  };
  recusa("proposta:recusada", "tenant", "Ana Souza");
  recusa("proposta:recusada:morador", "owner", "Carlos Lima");
  // E205-B (a): boas-vindas, uma por perfil.
  comPassos("boas_vindas:morador", "boas_vindas", boasVindas("morador"));
  comPassos("boas_vindas:proprietario", "boas_vindas", boasVindas("proprietario"));
  // E205-B (d): visitas — cancelada (por lado), expirada (por lado) e véspera (presencial morador/dono, vídeo).
  const HORA = "qui., 05/11 às 10:00 (horário de Brasília)";
  const comLinhas = (chave: string, ev: NotificationEvent, t: { abertura: (n?: string) => string; linhas: { rotulo: string; valor: string }[]; cta: string; url: string }) => {
    const externo = /^https:\/\//.test(t.url) ? { label: t.cta, url: t.url } : null;
    const d = detalhes({ linhas: t.linhas, externo });
    lista.push(doApp(chave, montarNotificacao({ siteUrl, event: ev, ...nome, body: t.abertura, ctaLabel: externo ? undefined : t.cta, pushUrl: externo ? "/dashboard/visitas" : t.url, detailsHtml: d.html, detailsText: d.texto })));
  };
  comLinhas("visita:cancelada:morador", "visita_cancelada", visitaCancelada({ quemCancelou: "dono", nomeDeQuemCancelou: "Carlos Lima", motivo: "O imóvel foi alugado", horario: HORA, tipo: "presencial", imovel: IM.titulo, propertyId: PROP, paraMorador: true }));
  comLinhas("visita:cancelada:dono", "visita_cancelada", visitaCancelada({ quemCancelou: "morador", nomeDeQuemCancelou: "Ana Souza", motivo: null, horario: HORA, tipo: "por vídeo", imovel: IM.titulo, propertyId: PROP, paraMorador: false }));
  const expirada = (chave: string, texto: string, cta: string, url: string) =>
    comLinhas(chave, "visita_expirada", { abertura: (n) => `Olá${n ? " " + n : ""}, ${texto.charAt(0).toLowerCase()}${texto.slice(1)}`, linhas: [{ rotulo: "Imóvel", valor: IM.titulo }, { rotulo: "Horários propostos", valor: HORA }], cta, url });
  expirada("visita:expirada:morador", TEXTO_EXPIRADA_MORADOR, "Pedir outros horários", `/imoveis/${PROP}`);
  expirada("visita:expirada:dono", TEXTO_EXPIRADA_DONO, "Ver as visitas", "/dashboard/visitas?de=dono");
  const END = { texto: "Rua Modesta Maria, 120, apto 302 · Santa Mônica · Uberlândia", mapa: "https://www.google.com/maps/search/?api=1&query=Rua%20Modesta%20Maria%2C%20120" };
  comLinhas("visita:vespera:presencial-morador", "visita_vespera", vesperaTexto({ modalidade: "presencial", paraMorador: true, horario: HORA, imovel: IM.titulo, endereco: END }));
  comLinhas("visita:vespera:presencial-dono", "visita_vespera", vesperaTexto({ modalidade: "presencial", paraMorador: false, horario: HORA, imovel: IM.titulo, nomeMorador: "Ana Souza" }));
  comLinhas("visita:vespera:video", "visita_vespera", vesperaTexto({ modalidade: "video", paraMorador: true, horario: HORA, imovel: IM.titulo, linkChamada: "https://meet.google.com/abc-defg-hij" }));
  const lc = linhasContrato({ imovel: IM, inicio: "2026-11-01", fim: "2027-02-28", meses: 4, valorMensal: 2700 });
  lista.push(doApp("contrato:pronto", montarNotificacao({ siteUrl, event: "contract_status", ...nome, subject: ASSUNTOS.contratoPronto, body: (n) => aberturaContratoPronto({ nome: n, imovel: IM }), detailsHtml: quadro(lc, PROXIMO_PASSO_CONTRATO_PRONTO), ctaLabel: "Ler e assinar o contrato" })));
  lista.push(doApp("contrato:falta-voce", montarNotificacao({ siteUrl, event: "contract_status", ...nome, subject: ASSUNTOS.contratoFaltaVoce, body: (n) => aberturaAssinatura({ nome: n, imovel: IM, asDuas: false, quemAssinou: "tenant" }), detailsHtml: quadro(lc, proximoPassoAssinatura(false, "owner")) })));
  lista.push(doApp("contrato:assinado", montarNotificacao({ siteUrl, event: "contract_status", ...nome, subject: ASSUNTOS.contratoAssinado, body: (n) => aberturaAssinatura({ nome: n, imovel: IM, asDuas: true, quemAssinou: "owner" }), detailsHtml: quadro(lc, proximoPassoAssinatura(true, "tenant")) })));

  // 3. Decisão de documento (item 3b): um documento só e o resultado agrupado.
  const decisao = (chave: string, linhas: ReturnType<typeof linhasDoAviso>, pronto: boolean) => {
    const e = emailDecisaoDocumento({ propertyId: PROP, titulo: "Studio mobiliado no Centro", bairro: "Centro", linhas, prontoParaPublicar: pronto });
    lista.push(doApp(chave, montarNotificacao({ siteUrl, event: e.evento, ...nome, subject: e.assunto, body: e.intro, ctaLabel: e.cta.label, pushUrl: e.cta.path, detailsHtml: e.detailsHtml, detailsText: e.detailsText })));
  };
  decisao("documento:aprovado", linhasDoAviso([{ origem: "qualificacao", documentoPath: "a.pdf", aprovado: true, motivo: null }]), true);
  decisao("documento:ajuste", linhasDoAviso([{ origem: "matricula", documentoPath: "m.pdf", aprovado: false, motivo: "A matrícula está ilegível." }]), false);
  decisao(
    "documento:agrupado",
    linhasDoAviso([
      { origem: "matricula", documentoPath: "m.pdf", aprovado: true, motivo: null },
      { origem: "qualificacao", documentoPath: "q.pdf", aprovado: false, motivo: "O nome não confere." },
    ]),
    false,
  );

  // 4. Enviados direto (sem notify).
  lista.push(doApp("codigo:assinatura", emailCodigoAssinatura(siteUrl, { imovel: "Studio mobiliado no Centro", codigo: "824519" })));
  lista.push(doApp("codigo:2fa", emailCodigo2fa(siteUrl, { codigo: "824519" })));
  lista.push(doApp("codigo:vinculo", emailCodigoVinculo(siteUrl, { codigo: "824519" })));
  lista.push(doApp("conta:exclusao", emailExclusaoConta(siteUrl, { url: `${siteUrl}/excluir-conta/confirmar?token=exemplo` })));
  lista.push(doApp("parceria:aprovada", emailParceriaAprovada(siteUrl, { url: `${siteUrl}/parceiros/ativar?t=exemplo`, nome: "Marina Souza" })));
  const fiscal = { numero: "REC-2026-000004", contratoRef: "VN-CT-2026-0007", conferirUrl: `${siteUrl}/conferir/ABCD1234`, papel: "locatario" as const };
  lista.push(doApp("fiscal:recibo", emailDocumentoFiscal(siteUrl, { ...fiscal, tipo: "recibo_aluguel", rotulo: "Recibo de locação" })));
  lista.push(doApp("fiscal:comprovante", emailDocumentoFiscal(siteUrl, { ...fiscal, tipo: "comprovante_caucao", rotulo: "Comprovante de Caução", numero: "CAU-2026-000001" })));
  lista.push(doApp("fiscal:termo", emailDocumentoFiscal(siteUrl, { ...fiscal, tipo: "termo_devolucao_caucao", rotulo: "Termo de devolução da Caução", numero: "TDC-2026-000001" })));

  // 5. Conta (Supabase): assunto e corpo vêm de templates-supabase.ts; o remetente é gravado pela Action.
  for (const t of templatesSupabase()) {
    const botao = /<a href="[^"]*" style="display:inline-block;padding:13px 28px[^"]*">([^<]+)<\/a>/.exec(t.html)?.[1] ?? null;
    lista.push({
      chave: `conta:${t.arquivo.replace(/\.html$/, "")}`,
      evento: `supabase:${t.modelo}`,
      assunto: t.assunto,
      titulo: t.assunto.replace(/ · Viva Nomads$/, ""),
      html: exemploSupabase(t.html, siteUrl),
      text: "",
      imagem: /media\/email\/([a-z-]+\.jpg)/.exec(t.html)?.[1] ?? "",
      botao,
      remetente: REMETENTE,
      origem: "conta",
    });
  }
  return lista;
}

/** Faixa "e-mail de teste" no topo do corpo (a rota de amostras não marca o assunto). */
export function comFaixaDeTeste(html: string): string {
  const faixa = `<div style="background:#fff7e6;color:#7a4b00;font:600 13px/1.4 -apple-system,'Segoe UI',Roboto,Arial,sans-serif;text-align:center;padding:8px 12px;">Exemplo para revisão: dados fictícios</div>`;
  return html.replace(/(<body[^>]*>)/i, `$1${faixa}`);
}
