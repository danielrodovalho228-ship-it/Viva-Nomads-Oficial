/*
  Aviso ao dono da decisão da equipe sobre os documentos do imóvel (rota rápida dos e-mails, item 3b) — PURO.
  Um e-mail por imóvel: título e bairro do anúncio, uma linha por documento (tipo · Aprovado/Precisa de ajuste ·
  motivo) e UM botão para aquele imóvel. Quem decide QUANDO avisar é o banco (decisoes_documento_para_avisar, 0185).
*/
import { assuntoDecisaoDocumento } from "../notifications/assuntos.ts";
import { blocoDados } from "../notifications/modelo-email.ts";
import { textoEmail, textoPlano } from "../notifications/texto-seguro.ts";

export type OrigemDocumento = "qualificacao" | "matricula";

/** Rótulos dos tipos que o envio pode guardar no futuro (hoje a fila não guarda o tipo). */
const ROTULO_TIPO: Record<string, string> = {
  iptu: "IPTU do imóvel",
  identidade: "Documento de identidade",
  procuracao: "Procuração",
  matricula: "Matrícula do imóvel",
  escritura: "Escritura do imóvel",
  contrato_compra: "Contrato de compra e venda",
  autorizacao: "Autorização do proprietário",
};

/** Nome do documento no e-mail: o tipo guardado, se houver; senão, o da fila de onde veio. */
export function rotuloDocumento(origem: OrigemDocumento, tipo?: string | null): string {
  const t = (tipo ?? "").trim().toLowerCase();
  if (t && ROTULO_TIPO[t]) return ROTULO_TIPO[t];
  return origem === "matricula" ? "Matrícula do imóvel" : "Comprovante de propriedade do imóvel";
}

export interface DecisaoParaAvisar {
  origem: OrigemDocumento;
  documentoPath: string | null;
  aprovado: boolean;
  motivo: string | null;
  tipo?: string | null;
}

export interface LinhaAviso {
  documento: string;
  aprovado: boolean;
  motivo: string | null;
}

/**
 * Uma linha por documento: a matrícula e a qualificação ligada (mesmo arquivo) contam uma vez só — vale a matrícula;
 * linhas repetidas do mesmo arquivo (herança da 0072) também. Recusas primeiro.
 */
export function linhasDoAviso(decisoes: DecisaoParaAvisar[]): LinhaAviso[] {
  const porArquivo = new Map<string, DecisaoParaAvisar>();
  const semArquivo: DecisaoParaAvisar[] = [];
  for (const d of decisoes) {
    if (!d.documentoPath) {
      semArquivo.push(d);
      continue;
    }
    const atual = porArquivo.get(d.documentoPath);
    if (!atual || (atual.origem === "qualificacao" && d.origem === "matricula")) porArquivo.set(d.documentoPath, d);
  }
  return [...porArquivo.values(), ...semArquivo]
    .map((d) => ({ documento: rotuloDocumento(d.origem, d.tipo), aprovado: d.aprovado, motivo: d.aprovado ? null : (d.motivo ?? "").trim() || null }))
    .sort((a, b) => Number(a.aprovado) - Number(b.aprovado));
}

export interface EmailDecisao {
  evento: "documento_aprovado" | "documento_recusado";
  /** Sem a marca (o envio põe "· Viva Nomads"). */
  assunto: string;
  intro: (nome?: string) => string;
  detailsHtml: string;
  detailsText: string;
  cta: { label: string; path: string };
}

/** Botão: recusa no grupo → Reenviar documento; tudo aprovado → Publicar (pronto) ou Ver o que falta. */
export function botaoDecisao(linhas: LinhaAviso[], prontoParaPublicar: boolean): string {
  if (linhas.some((l) => !l.aprovado)) return "Reenviar documento";
  return prontoParaPublicar ? "Publicar meu anúncio" : "Ver o que falta";
}

export function emailDecisaoDocumento(o: {
  propertyId: string | null;
  titulo: string | null;
  bairro: string | null;
  linhas: LinhaAviso[];
  prontoParaPublicar: boolean;
}): EmailDecisao {
  const recusa = o.linhas.some((l) => !l.aprovado);
  const um = o.linhas.length === 1;
  const imovel = [o.titulo?.trim() || "Seu imóvel", o.bairro?.trim()].filter(Boolean).join(" · ");
  const linhaHtml = (l: LinhaAviso) =>
    `${textoEmail(l.documento, 80)} · <span style="color:${l.aprovado ? "#1c6b3a" : "#b45309"};">${l.aprovado ? "Aprovado" : "Precisa de ajuste"}</span>` +
    (l.motivo ? `<br><span style="font-weight:400;">Motivo: ${textoEmail(l.motivo, 500)}</span>` : "");
  const dados = blocoDados([
    { rotulo: "Imóvel", valor: textoEmail(imovel, 120) },
    ...(um
      ? [
          { rotulo: "Documento", valor: textoEmail(o.linhas[0].documento, 80) },
          { rotulo: "Decisão", valor: o.linhas[0].aprovado ? "Aprovado" : "Precisa de ajuste" },
          ...(o.linhas[0].motivo ? [{ rotulo: "Motivo", valor: textoEmail(o.linhas[0].motivo, 500) }] : []),
        ]
      : o.linhas.map((l, i) => ({ rotulo: `Documento ${i + 1}`, valor: linhaHtml(l) }))),
  ]);
  const texto = [
    `Imóvel: ${textoPlano(imovel, 120)}`,
    ...o.linhas.map((l) => `${l.documento}: ${l.aprovado ? "Aprovado" : "Precisa de ajuste"}${l.motivo ? ` (motivo: ${textoPlano(l.motivo, 500)})` : ""}`),
  ].join("\n");
  const ola = (n?: string) => `Olá${n ? " " + n : ""}, `;
  const intro = (n?: string) =>
    um
      ? `${ola(n)}a equipe Viva Nomads conferiu um documento do seu imóvel. ${recusa ? "Ele precisa de um ajuste: veja o motivo e reenvie." : "Ele foi aprovado."}`
      : `${ola(n)}a equipe Viva Nomads terminou de conferir os documentos do seu imóvel. ${recusa ? "Algum precisa de ajuste: veja o motivo de cada um e reenvie." : "Todos foram aprovados."}`;
  return {
    evento: recusa ? "documento_recusado" : "documento_aprovado",
    assunto: assuntoDecisaoDocumento({ titulo: o.titulo, linhas: o.linhas }),
    intro,
    detailsHtml: dados,
    detailsText: texto,
    cta: { label: botaoDecisao(o.linhas, o.prontoParaPublicar), path: o.propertyId ? `/dashboard/imoveis/${encodeURIComponent(o.propertyId)}/editar` : "/dashboard/imoveis" },
  };
}
