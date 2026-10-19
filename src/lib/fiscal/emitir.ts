import "server-only";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/notifications/email";
import { brandedNotification, notificationText } from "@/lib/notifications/templates";
import { textoEmail } from "@/lib/notifications/texto-seguro";
import { SITE_URL } from "@/lib/site";
import { conteudoDocumento, NUMERO_PROVISORIO, ROTULO_TIPO, temContato, textoDocumento, type DadosDocumento, type TipoDocumento } from "@/lib/fiscal/documento";
import { envioConfirmado, motivoFalhaEnvio, resultadoEnvio, type EnvioDestinatario } from "@/lib/fiscal/envio";
import { gerarPdf, sha256 } from "@/lib/fiscal/pdf";
import { rotuloPagamentoBloco } from "@/lib/pagamento-bloco";

/**
 * Emissão dos documentos da plataforma (SÓ servidor): recibo de aluguel,
 * comprovante de caução e termo de devolução. Idempotente por pagamento/acerto
 * (o banco tem unique por tipo + origem). Grava o RETRATO da emissão, o PDF no
 * bucket privado "documentos" e manda o PDF por e-mail às duas partes.
 * Nunca lança: falha vira log (o registro do pagamento já está salvo).
 */

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;
type Resultado = { ok: true; id: string; numero: string; envio?: EnvioDestinatario[] } | { ok: false; motivo: string };

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
  extra: Pick<DadosDocumento, "periodoInicio" | "periodoFim" | "valor" | "encargos" | "dataPagamento" | "forma" | "caucaoTotal" | "confirmadoEm" | "rotuloPagamento">
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

  const codigo = randomBytes(16).toString("hex"); // 128 bits, nunca sequencial
  const agora = new Date();
  const dados: DadosDocumento = {
    tipo,
    numero: NUMERO_PROVISORIO,
    emitidoEm: agora.toISOString(),
    locador: { nome: partes.locador.nome, doc: partes.locador.doc },
    locatario: { nome: partes.locatario.nome, doc: partes.locatario.doc },
    imovelEndereco: partes.imovelEndereco,
    contratoRef: refContrato(partes.contratoId),
    conferirUrl: `${SITE_URL}/conferir/${codigo}`,
    ...extra,
  };
  // A trava de contato roda com o número PROVISÓRIO, antes de reservar o definitivo: a tentativa que falha não queima
  // número (a lacuna 000001–000003 de 19/10 veio daí). temContato ignora o número e a URL de conferência, então o
  // resultado é o mesmo com o número definitivo.
  if (temContato(textoDocumento(conteudoDocumento(dados)))) return { ok: false, motivo: "documento traria contato" };
  const { data: numero, error: eNum } = await admin.rpc("proximo_numero_documento", { p_tipo: tipo });
  if (eNum || !numero) return { ok: false, motivo: "numeração indisponível" };
  dados.numero = numero as string;
  const conteudo = conteudoDocumento(dados);
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

  const envio = await enviarDocumento(admin, { id: doc.id as string, tipo, numero: dados.numero, contratoRef: dados.contratoRef, conferirUrl: dados.conferirUrl }, partes, pdf);
  return { ok: true, id: doc.id as string, numero: dados.numero, envio };
}

/** Evento do e-mail na caixa de e-mails de teste, por tipo de documento. */
const EVENTO_CAIXA: Record<TipoDocumento, string> = {
  recibo_aluguel: "recibo_emitido",
  comprovante_caucao: "comprovante_caucao_emitido",
  termo_devolucao_caucao: "termo_devolucao",
};

interface DocParaEnvio {
  id: string;
  tipo: TipoDocumento;
  numero: string;
  contratoRef: string;
  conferirUrl: string;
}

/**
 * PDF por e-mail às duas partes (cada uma recebe o mesmo documento) e o resultado POR DESTINATÁRIO em
 * documentos_fiscais.envio ({ papel, status, resend_id, erro, em } — nunca o endereço). enviado_em só é gravado
 * quando TODOS os destinatários têm envio confirmado pelo Resend (id devolvido); simulado ou recusado não conta.
 * `apenas` limita o reenvio a quem ainda não recebeu.
 */
async function enviarDocumento(admin: Admin, doc: DocParaEnvio, partes: Pick<Partes, "locador" | "locatario">, pdf: Uint8Array, apenas?: Set<EnvioDestinatario["papel"]>, anterior: EnvioDestinatario[] = []): Promise<EnvioDestinatario[]> {
  const rotulo = ROTULO_TIPO[doc.tipo];
  const anexo = [{ filename: `${doc.numero}.pdf`, content: Buffer.from(pdf).toString("base64") }];
  const title = `${rotulo} ${doc.numero}`;
  const intro = `Segue em anexo o ${rotulo.toLowerCase()} do contrato ${doc.contratoRef}. Ele também fica guardado na plataforma, em Contratos (proprietário) ou Minhas locações (inquilino).`;
  const envio: EnvioDestinatario[] = anterior.filter((e) => apenas && !apenas.has(e.papel));
  for (const [papel, p] of [["locador", partes.locador], ["locatario", partes.locatario]] as const) {
    if (apenas && !apenas.has(papel)) continue;
    if (!p.email) {
      envio.push({ papel, status: "erro", resend_id: null, erro: "sem e-mail no cadastro", em: new Date().toISOString() });
      continue;
    }
    const r = await sendEmail({
      to: p.email,
      subject: `${title} — Viva Nomads`,
      html: brandedNotification({ title: textoEmail(title, 80), intro: textoEmail(intro, 400), cta: { label: "Conferir autenticidade", url: doc.conferirUrl } }),
      text: notificationText({ title, intro, cta: { label: "Conferir autenticidade", url: doc.conferirUrl } }),
      attachments: anexo,
      evento: EVENTO_CAIXA[doc.tipo],
    }).catch((e: unknown) => ({ demo: false, error: `falha no envio: ${e instanceof Error ? e.name : "erro"}` }));
    envio.push(resultadoEnvio(papel, r));
  }
  envio.sort((a, b) => a.papel.localeCompare(b.papel));
  const { error } = await admin
    .from("documentos_fiscais")
    .update({ envio, enviado_em: envioConfirmado(envio) ? new Date().toISOString() : null })
    .eq("id", doc.id);
  if (error) console.error(`[documentos] ${doc.numero}: registro do envio falhou: ${error.message}`);
  return envio;
}

/**
 * "Reenviar e-mail" (fila "Documentos com falha"): manda de novo o MESMO documento — o PDF guardado no bucket, o
 * mesmo número e o mesmo código de conferência —, sem emitir documento novo. Só a quem ainda não tem envio
 * confirmado (os dois, num documento sem registro de envio, como os emitidos antes deste registro).
 */
export async function reenviarEmailDoDocumento(documentoId: string): Promise<{ ok: true; numero: string; envio: EnvioDestinatario[] } | { ok: false; motivo: string }> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, motivo: "sem servidor" };
  const { data: d } = await admin
    .from("documentos_fiscais")
    .select("id, tipo, numero, contrato_id, contrato_ref, codigo_verificacao, pdf_path, envio, anulado_em, pagamento_id, acerto_id")
    .eq("id", documentoId)
    .maybeSingle();
  if (!d) return { ok: false, motivo: "documento não encontrado" };
  if (d.anulado_em) return { ok: false, motivo: "documento anulado" };
  const partes = await partesDoContrato(admin, d.contrato_id as string);
  if (!partes) return { ok: false, motivo: "contrato não encontrado" };
  const { data: arquivo, error: eDown } = await admin.storage.from(BUCKET_DOCUMENTOS).download(d.pdf_path as string);
  if (eDown || !arquivo) return { ok: false, motivo: `PDF guardado indisponível: ${eDown?.message ?? "vazio"}` };
  const pdf = new Uint8Array(await arquivo.arrayBuffer());
  const anterior = (Array.isArray(d.envio) ? d.envio : []) as EnvioDestinatario[];
  const faltam = new Set<EnvioDestinatario["papel"]>((["locador", "locatario"] as const).filter((papel) => !anterior.some((e) => e.papel === papel && e.status === "enviado")));
  if (!faltam.size) return { ok: true, numero: d.numero as string, envio: anterior };
  const envio = await enviarDocumento(
    admin,
    { id: d.id as string, tipo: d.tipo as TipoDocumento, numero: d.numero as string, contratoRef: d.contrato_ref as string, conferirUrl: `${SITE_URL}/conferir/${d.codigo_verificacao as string}` },
    partes,
    pdf,
    faltam,
    anterior,
  );
  const origem = d.pagamento_id ? { pagamentoId: d.pagamento_id as string } : { acertoId: d.acerto_id as string };
  await registrarResultado(admin, origem, { ok: true, id: d.id as string, numero: d.numero as string, envio });
  return { ok: true, numero: d.numero as string, envio };
}

/** Pagamento confirmado pelo inquilino → recibo (aluguel) ou comprovante (caução). */
export async function emitirDoPagamento(pagamentoId: string): Promise<Resultado> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, motivo: "sem servidor" };
  try {
    const { data: pg } = await admin
      .from("pagamentos_bloco")
      .select("id, contrato_id, bloco_id, tipo, valor, forma, data_pagamento, confirmado_pelo_inquilino, encargos, contrato_blocos(numero_bloco, meses, inicio, fim), contratos(aluguel_mensal)")
      .eq("id", pagamentoId)
      .maybeSingle();
    if (!pg || !pg.confirmado_pelo_inquilino) return { ok: false, motivo: "pagamento não confirmado pelo inquilino" };
    const partes = await partesDoContrato(admin, pg.contrato_id as string);
    if (!partes) return { ok: false, motivo: "contrato não encontrado" };
    const bloco = pg.contrato_blocos as unknown as { numero_bloco: number | null; meses: number | null; inicio: string | null; fim: string | null } | null;
    const contrato = pg.contratos as unknown as { aluguel_mensal: number | null } | null;
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
      rotuloPagamento: rotuloPagamentoBloco({
        tipo: pg.tipo as string,
        valor: Number(pg.valor),
        bloco: bloco?.numero_bloco ? { numero: Number(bloco.numero_bloco), meses: Number(bloco.meses ?? 1), inicio: bloco.inicio, fim: bloco.fim } : null,
        valorMensal: contrato?.aluguel_mensal == null ? null : Number(contrato.aluguel_mensal),
      }),
    });
  } catch (e) {
    console.error("[documentos] recibo:", e instanceof Error ? e.message : e);
    return { ok: false, motivo: "falha" };
  }
}

/**
 * Falha visível (jornada de assinatura, 19/10): toda emissão que não deu certo vira uma linha em documentos_falhas,
 * com o motivo, para a fila "Documentos com falha" do admin (botão "Emitir de novo"); a que deu certo depois fecha
 * a linha. Antes a falha sumia num console.error e ninguém via que o recibo não tinha saído.
 */
async function registrarResultado(admin: Admin, origem: { pagamentoId?: string; acertoId?: string }, r: Resultado): Promise<void> {
  const coluna = origem.pagamentoId ? "pagamento_id" : "acerto_id";
  const id = (origem.pagamentoId ?? origem.acertoId) as string;
  try {
    // Emitido, mas o e-mail não saiu para alguém: a linha é da etapa "envio" ("Reenviar e-mail", sem documento novo).
    const falhaEnvio = r.ok && r.envio ? motivoFalhaEnvio(r.envio) : null;
    if (r.ok && !falhaEnvio) {
      await admin.from("documentos_falhas").update({ resolvido_em: new Date().toISOString(), documento_id: r.id }).eq(coluna, id).is("resolvido_em", null);
      return;
    }
    const motivo = (r.ok ? (falhaEnvio as string) : r.motivo).slice(0, 300);
    const etapa = r.ok ? "envio" : "emissao";
    if (r.ok) console.error(`[documentos] ${r.numero}: ${motivo}`);
    const { data: aberta } = await admin.from("documentos_falhas").select("id, tentativas, etapa").eq(coluna, id).is("resolvido_em", null).maybeSingle();
    if (aberta) {
      await admin
        .from("documentos_falhas")
        .update({
          motivo,
          etapa,
          documento_id: r.ok ? r.id : null,
          tentativas: Number(aberta.tentativas ?? 1) + 1,
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", aberta.id);
    } else {
      await admin.from("documentos_falhas").insert({ [coluna]: id, motivo, etapa, documento_id: r.ok ? r.id : null });
    }
  } catch {
    /* o registro da falha nunca quebra o fluxo */
  }
}

/** Emite e registra o resultado na fila (pagamento confirmado → recibo/comprovante). */
export async function emitirDoPagamentoComRegistro(pagamentoId: string): Promise<Resultado> {
  const r = await emitirDoPagamento(pagamentoId);
  const admin = createAdminClient();
  if (admin) await registrarResultado(admin, { pagamentoId }, r);
  return r;
}

/** Emite e registra o resultado na fila (devolução da caução confirmada → termo). */
export async function emitirTermoDevolucaoComRegistro(acertoId: string): Promise<Resultado> {
  const r = await emitirTermoDevolucao(acertoId);
  const admin = createAdminClient();
  if (admin) await registrarResultado(admin, { acertoId }, r);
  return r;
}

/**
 * Retroativo (jornada de assinatura, 19/10): pagamentos já CONFIRMADOS pelo inquilino que ficaram sem documento.
 * O admin dispara pelo botão "Emitir os pendentes" da fila; cada um passa pela mesma emissão idempotente.
 */
export async function pagamentosConfirmadosSemDocumento(admin: Admin, limite = 50): Promise<string[]> {
  const { data: pgs } = await admin
    .from("pagamentos_bloco")
    .select("id")
    .eq("confirmado_pelo_inquilino", true)
    .order("confirmado_em", { ascending: true })
    .limit(500);
  const ids = ((pgs ?? []) as { id: string }[]).map((p) => p.id);
  if (!ids.length) return [];
  const { data: docs } = await admin.from("documentos_fiscais").select("pagamento_id").in("pagamento_id", ids);
  const com = new Set(((docs ?? []) as { pagamento_id: string | null }[]).map((d) => d.pagamento_id));
  return ids.filter((id) => !com.has(id)).slice(0, limite);
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
