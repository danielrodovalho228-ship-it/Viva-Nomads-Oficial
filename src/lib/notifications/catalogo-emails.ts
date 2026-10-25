/*
  Catálogo de TODOS os e-mails de cliente com dados fictícios (rota rápida "e-mails profissionais", item 6) — PURO.
  Fonte do teste de auditoria, da rota /api/test-email?all=1 e da prévia /dev/emails. Usa as MESMAS funções de
  montagem da produção (montar-email.ts, aviso-decisao.ts, templates-supabase.ts). E-mails internos (equipe, Moacir,
  leads) ficam fora.
*/
import { assuntoChamado, assuntoManutencao, ASSUNTOS } from "./assuntos.ts";
import { TEMPLATES, type NotificationEvent } from "./eventos-email.ts";
import { blocoDados } from "./modelo-email.ts";
import { emailCodigo2fa, emailCodigoVinculo, emailCodigoAssinatura, emailDocumentoFiscal, emailExclusaoConta, emailParceriaAprovada, montarNotificacao, type EmailMontado } from "./montar-email.ts";
import { REMETENTE } from "./remetente.ts";
import { templatesSupabase } from "./templates-supabase.ts";
import { emailDecisaoDocumento, linhasDoAviso } from "../documento/aviso-decisao.ts";

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
  const proposta = blocoDados([{ rotulo: "Proposta", valor: "ORC-2026-0001" }]);
  lista.push(doApp("proposta:recebida", montarNotificacao({ siteUrl, event: "proposta_recebida", ...nome, subject: ASSUNTOS.propostaRecebida, detailsHtml: proposta, pushUrl: `/dashboard/propostas/${PROP}` })));
  lista.push(doApp("proposta:aceita", montarNotificacao({ siteUrl, event: "proposta_respondida", ...nome, subject: ASSUNTOS.propostaAceita, detailsHtml: proposta, pushUrl: `/dashboard/propostas/${PROP}` })));
  lista.push(doApp("contrato:pronto", montarNotificacao({ siteUrl, event: "contract_status", ...nome, subject: ASSUNTOS.contratoPronto })));
  lista.push(doApp("contrato:falta-voce", montarNotificacao({ siteUrl, event: "contract_status", ...nome, subject: ASSUNTOS.contratoFaltaVoce })));
  lista.push(doApp("contrato:assinado", montarNotificacao({ siteUrl, event: "contract_status", ...nome, subject: ASSUNTOS.contratoAssinado })));

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
