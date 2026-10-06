import "server-only";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/notifications/email";
import { brandedNotification, notificationText } from "@/lib/notifications/templates";
import { textoEmail } from "@/lib/notifications/texto-seguro";
import { SITE_URL } from "@/lib/site";
import { conteudoDocumento, ROTULO_TIPO, temContato, textoDocumento, type DadosDocumento, type TipoDocumento } from "@/lib/fiscal/documento";
import { gerarPdf, sha256 } from "@/lib/fiscal/pdf";

/**
 * Emissão dos documentos da plataforma (SÓ servidor): recibo de aluguel,
 * comprovante de caução e termo de devolução. Idempotente por pagamento/acerto
 * (o banco tem unique por tipo + origem). Grava o RETRATO da emissão, o PDF no
 * bucket privado "documentos" e manda o PDF por e-mail às duas partes.
 * Nunca lança: falha vira log (o registro do pagamento já está salvo).
 */

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;
type Resultado = { ok: true; id: string; numero: string } | { ok: false; motivo: string };

export const BUCKET_DOCUMENTOS = "documentos";

const refContrato = (id: string) => `CT-${id.slice(0, 8).toUpperCase()}`;

interface Partes {
  contratoId: string;
  ownerId: string;
  tenantId: string;
  locador: { nome: string; doc: string | null; email: string | null };
  locatario: { nome: string; doc: string | null; email: string | null };
  imovelEndereco: string;
}

/** Contrato → partes e imóvel, lidos AGORA (viram o retrato do documento). */
async function partesDoContrato(admin: Admin, contratoId: string): Promise<Partes | null> {
  const { data: c } = await admin
    .from("contratos")
    .select("id, tenant_id, properties!inner(owner_id, title, address, exact_address, city)")
    .eq("id", contratoId)
    .maybeSingle();
  if (!c) return null;
  const p = c.properties as unknown as { owner_id: string; title: string | null; address: string | null; exact_address: string | null; city: string | null };
  const { data: perfis } = await admin.from("profiles").select("id, full_name, cpf, cnpj, email").in("id", [p.owner_id, c.tenant_id as string]);
  const perfil = (id: string) => {
    const x = (perfis ?? []).find((r) => r.id === id);
    return { nome: ((x?.full_name as string) || "").trim() || "Não informado", doc: ((x?.cnpj as string) || (x?.cpf as string) || null) ?? null, email: (x?.email as string) ?? null };
  };
  const endereco = [p.exact_address || p.address, p.city].filter(Boolean).join(", ") || p.title || "Imóvel";
  return { contratoId, ownerId: p.owner_id, tenantId: c.tenant_id as string, locador: perfil(p.owner_id), locatario: perfil(c.tenant_id as string), imovelEndereco: endereco };
}

async function emitir(
  admin: Admin,
  tipo: TipoDocumento,
  origem: { pagamentoId?: string; acertoId?: string },
  partes: Partes,
  extra: Pick<DadosDocumento, "periodoInicio" | "periodoFim" | "valor" | "encargos" | "dataPagamento" | "forma" | "caucaoTotal" | "confirmadoEm">
): Promise<Resultado> {
  // Idempotente: já emitido para esta origem → devolve o existente.
  const coluna = origem.pagamentoId ? "pagamento_id" : "acerto_id";
  const { data: existente } = await admin
    .from("documentos_fiscais")
    .select("id, numero")
    .eq("tipo", tipo)
    .eq(coluna, (origem.pagamentoId ?? origem.acertoId) as string)
    .maybeSingle();
  if (existente) return { ok: true, id: existente.id as string, numero: existente.numero as string };

  const { data: numero, error: eNum } = await admin.rpc("proximo_numero_documento", { p_tipo: tipo });
  if (eNum || !numero) return { ok: false, motivo: "numeração indisponível" };
  const codigo = randomBytes(16).toString("hex"); // 128 bits, nunca sequencial
  const agora = new Date();
  const dados: DadosDocumento = {
    tipo,
    numero: numero as string,
    emitidoEm: agora.toISOString(),
    locador: { nome: partes.locador.nome, doc: partes.locador.doc },
    locatario: { nome: partes.locatario.nome, doc: partes.locatario.doc },
    imovelEndereco: partes.imovelEndereco,
    contratoRef: refContrato(partes.contratoId),
    conferirUrl: `${SITE_URL}/conferir/${codigo}`,
    ...extra,
  };
  const conteudo = conteudoDocumento(dados);
  if (temContato(textoDocumento(conteudo))) return { ok: false, motivo: "documento traria contato" };
  const pdf = await gerarPdf(conteudo);
  const ano = Number(agora.toLocaleString("en-US", { timeZone: "America/Sao_Paulo", year: "numeric" }));
  const caminho = `${ano}/${tipo}/${dados.numero}.pdf`;

  const { error: eUp } = await admin.storage.from(BUCKET_DOCUMENTOS).upload(caminho, pdf, { contentType: "application/pdf", upsert: false });
  if (eUp) return { ok: false, motivo: `upload: ${eUp.message}` };

  const { data: doc, error: eIns } = await admin
    .from("documentos_fiscais")
    .insert({
      tipo,
      numero: dados.numero,
      ano,
      contrato_id: partes.contratoId,
      pagamento_id: origem.pagamentoId ?? null,
      acerto_id: origem.acertoId ?? null,
      owner_id: partes.ownerId,
      tenant_id: partes.tenantId,
      locador_nome: partes.locador.nome,
      locador_doc: partes.locador.doc,
      locatario_nome: partes.locatario.nome,
      locatario_doc: partes.locatario.doc,
      imovel_endereco: partes.imovelEndereco,
      contrato_ref: dados.contratoRef,
      periodo_inicio: extra.periodoInicio,
      periodo_fim: extra.periodoFim,
      valor: extra.valor,
      encargos: extra.encargos,
      hash: sha256(pdf),
      codigo_verificacao: codigo,
      pdf_path: caminho,
    })
    .select("id")
    .single();
  if (eIns || !doc) {
    await admin.storage.from(BUCKET_DOCUMENTOS).remove([caminho]).catch(() => null);
    return { ok: false, motivo: `registro: ${eIns?.message ?? "falhou"}` };
  }

  // PDF por e-mail às duas partes (cada uma recebe o mesmo documento).
  const rotulo = ROTULO_TIPO[tipo];
  const anexo = [{ filename: `${dados.numero}.pdf`, content: Buffer.from(pdf).toString("base64") }];
  let enviado = false;
  for (const p of [partes.locador, partes.locatario]) {
    if (!p.email) continue;
    const title = `${rotulo} ${dados.numero}`;
    const intro = `Segue em anexo o ${rotulo.toLowerCase()} do contrato ${dados.contratoRef}. Ele também fica guardado na plataforma, em Contratos (proprietário) ou Minhas locações (inquilino).`;
    const r = await sendEmail({
      to: p.email,
      subject: `${title} — Viva Nomads`,
      html: brandedNotification({ title: textoEmail(title, 80), intro: textoEmail(intro, 400), cta: { label: "Conferir autenticidade", url: dados.conferirUrl } }),
      text: notificationText({ title, intro, cta: { label: "Conferir autenticidade", url: dados.conferirUrl } }),
      attachments: anexo,
    }).catch(() => null);
    if (r) enviado = true;
  }
  if (enviado) await admin.from("documentos_fiscais").update({ enviado_em: new Date().toISOString() }).eq("id", doc.id);
  return { ok: true, id: doc.id as string, numero: dados.numero };
}

/** Pagamento confirmado pelo inquilino → recibo (aluguel) ou comprovante (caução). */
export async function emitirDoPagamento(pagamentoId: string): Promise<Resultado> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, motivo: "sem servidor" };
  try {
    const { data: pg } = await admin
      .from("pagamentos_bloco")
      .select("id, contrato_id, bloco_id, tipo, valor, forma, data_pagamento, confirmado_pelo_inquilino, encargos, contrato_blocos(inicio, fim)")
      .eq("id", pagamentoId)
      .maybeSingle();
    if (!pg || !pg.confirmado_pelo_inquilino) return { ok: false, motivo: "pagamento não confirmado pelo inquilino" };
    const partes = await partesDoContrato(admin, pg.contrato_id as string);
    if (!partes) return { ok: false, motivo: "contrato não encontrado" };
    const bloco = pg.contrato_blocos as unknown as { inicio: string | null; fim: string | null } | null;
    const encargos = Array.isArray(pg.encargos) ? (pg.encargos as { rotulo: string; valor: number }[]).filter((e) => e && e.rotulo && Number(e.valor) >= 0).map((e) => ({ rotulo: String(e.rotulo).slice(0, 60), valor: Number(e.valor) })) : [];
    return await emitir(admin, pg.tipo === "caucao" ? "comprovante_caucao" : "recibo_aluguel", { pagamentoId }, partes, {
      periodoInicio: bloco?.inicio ?? null,
      periodoFim: bloco?.fim ?? null,
      valor: Number(pg.valor),
      encargos: pg.tipo === "caucao" ? [] : encargos,
      dataPagamento: pg.data_pagamento as string,
      forma: pg.forma as string,
      caucaoTotal: null,
      confirmadoEm: null,
    });
  } catch (e) {
    console.error("[documentos] recibo:", e instanceof Error ? e.message : e);
    return { ok: false, motivo: "falha" };
  }
}

/** Devolução da caução confirmada pelo inquilino → termo de devolução. */
export async function emitirTermoDevolucao(acertoId: string): Promise<Resultado> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, motivo: "sem servidor" };
  try {
    const { data: a } = await admin
      .from("caucao_acertos")
      .select("id, contrato_id, caucao_total, valor_devolvido, data_devolucao, meio, status, confirmado_em")
      .eq("id", acertoId)
      .maybeSingle();
    if (!a || !["devolvida_integral", "desconto_confirmado"].includes(a.status as string)) return { ok: false, motivo: "devolução não confirmada" };
    const partes = await partesDoContrato(admin, a.contrato_id as string);
    if (!partes) return { ok: false, motivo: "contrato não encontrado" };
    return await emitir(admin, "termo_devolucao_caucao", { acertoId }, partes, {
      periodoInicio: null,
      periodoFim: null,
      valor: Number(a.valor_devolvido ?? 0),
      encargos: [],
      dataPagamento: (a.data_devolucao as string) ?? null,
      forma: (a.meio as string) ?? null,
      caucaoTotal: Number(a.caucao_total),
      confirmadoEm: (a.confirmado_em as string) ?? null,
    });
  } catch (e) {
    console.error("[documentos] termo:", e instanceof Error ? e.message : e);
    return { ok: false, motivo: "falha" };
  }
}

/** URL assinada (10 min) do PDF — só para quem é parte (a leitura passa pelo RLS da pessoa). */
export async function urlAssinadaDoDocumento(pdfPath: string): Promise<string | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data } = await admin.storage.from(BUCKET_DOCUMENTOS).createSignedUrl(pdfPath, 600, { download: true });
  return data?.signedUrl ?? null;
}
