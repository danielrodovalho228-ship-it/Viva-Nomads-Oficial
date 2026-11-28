"use server";
/*
  E1248 PR 1 — o comprovante da devolução e a decisão da Central (ESPEC-E1248 v11, secções 2.4, 2.7 e 9-A; ORDEM-DUET
  1355).
   - O ANEXO: só o dono do contrato; PDF ou imagem, com limite; a imagem entra sem metadados; vai para o bucket privado
     da conferência, na pasta de quem enviou (ORDEM-1352). Opcional no registro, pedido na disputa. O anexo recalcula o
     prazo da decisão a contar da hora dele e resolve o pedido e o lembrete do anexo. Vale depois do prazo do anexo,
     enquanto a Central não decide (M35).
   - A DECISÃO: o molde de anularRegistroPelaCentral (E1229) — só a equipe; o chamado tem de ser do contrato do acerto,
     com a nota do sistema; a conta observadora e o chamado de simulação seguem as mesmas guardas; uma decisão por
     acerto; a resposta visível ao morador no chamado e a nota interna. Com o prazo do anexo a correr e sem comprovante,
     a equipe ainda não decide; vencido sem prova, "não confirmada" leva o motivo do meio (M34, M40).
*/
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ehAdmin } from "@/lib/data/admin-guard";
import { recusaObservador } from "@/lib/qa/observador";
import { responderComoAdmin } from "@/lib/data/atendimento-actions";
import { semMetadados } from "@/lib/foto-reconversao";
import { validarFotoConferencia } from "@/lib/conferencia";
import { PDFDocument } from "pdf-lib";
import { calcularPrazos, type Prioridade } from "@/config/atendimento";
import { emitirTermoDevolucaoComRegistro } from "@/lib/fiscal/emitir";
import { resolverAvisosDaReferencia } from "@/lib/notifications/avisos-servidor";
import { brl, motivoSemProva, motivoValido, prazoDoAnexoTerminou, textoDecisaoConfirmada, textoDecisaoNaoConfirmada } from "@/lib/caucao/devolucao-maquina";
import { AVISOS_DO_DONO_NA_DISPUTA, URL_DO_MORADOR, disputaAberta, enviarSemFalhar, lerAcerto, partesDoContrato, statusConfirmado, urlDoDono, valorDoAcerto } from "@/lib/caucao/devolucao-servidor";

type Res = { ok: true } | { ok: false; error: string };
type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A nota do sistema que liga o chamado ao acerto contestado. */
const NOTA_DO_ACERTO = /^\[devolucao\] acerto=([0-9a-f-]{36})$/i;
const BUCKET = "conferencia";
/** O teto do PDF do comprovante: o do bucket da conferência (0117). */
const COMPROVANTE_PDF_MAX_BYTES = 15 * 1024 * 1024;

/** PROPOSTA DE TEXTO */
const MSG_SEM_LEITURA = "Não foi possível ler a devolução. Tente de novo em instantes.";
/** PROPOSTA DE TEXTO */
const MSG_SO_O_DONO = "Só o proprietário do imóvel anexa o comprovante.";
/** PROPOSTA DE TEXTO */
const MSG_JA_DECIDIDA = "A equipe já decidiu esta contestação.";
/** PROPOSTA DE TEXTO */
const MSG_JA_ANEXADO = "O comprovante desta devolução já foi anexado.";
/** PROPOSTA DE TEXTO */
const MSG_ARQUIVO = "Envie o comprovante em PDF (até 15 MB) ou numa imagem JPG, PNG ou WebP (até 8 MB).";
/** PROPOSTA DE TEXTO */
const MSG_PDF_ILEGIVEL = "Não foi possível abrir este PDF. Envie o comprovante completo, ou uma foto dele.";
/** PROPOSTA DE TEXTO */
const MSG_ESPERA_ANEXO = "O prazo do proprietário para anexar o comprovante ainda está a correr. Decida depois do anexo, ou no fim do prazo.";
/** PROPOSTA DE TEXTO */
const MSG_MOTIVO_DA_DECISAO = "Escreva o motivo da decisão (pelo menos 5 letras): ele vai para o morador e para o proprietário.";
/** PROPOSTA DE TEXTO (E1244): a recusa a partir de um chamado de simulação. */
const MSG_SIMULACAO = "Este chamado é de simulação: só decide devoluções de um contrato em que as duas contas são de teste.";

/** O arquivo do comprovante: PDF de verdade, ou uma imagem (o tipo pelos primeiros bytes; a extensão não vale). */
function validarComprovante(bytes: Uint8Array, tamanho: number): { ok: true; tipo: string; ext: string; imagem: boolean } | { ok: false } {
  const pdf = bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  if (pdf) return tamanho > 0 && tamanho <= COMPROVANTE_PDF_MAX_BYTES ? { ok: true, tipo: "application/pdf", ext: "pdf", imagem: false } : { ok: false };
  const foto = validarFotoConferencia({ bytes, tamanho });
  return foto.ok ? { ok: true, tipo: foto.tipo, ext: foto.ext, imagem: true } : { ok: false };
}

async function pdfAbre(bytes: Uint8Array): Promise<boolean> {
  try {
    await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false });
    return true;
  } catch {
    return false;
  }
}

/** O prazo da decisão vive no chamado: recalcula-se a contar de `desde`, com a prioridade dele. */
async function recalcularPrazoDaDecisao(admin: Admin, chamadoId: string | null, desde: Date): Promise<void> {
  if (!chamadoId) return;
  const { data: ch } = await admin.from("chamados").select("id, prioridade").eq("id", chamadoId).maybeSingle();
  if (!ch) return;
  await admin.from("chamados").update({ prazo_resolucao: calcularPrazos(((ch.prioridade as Prioridade) ?? "p2"), desde).resolucao.toISOString() }).eq("id", chamadoId);
}

/** O DONO anexa o comprovante da devolução (FormData: acertoId, arquivo). */
export async function anexarComprovanteDaDevolucao(formData: FormData): Promise<Res> {
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return { ok: false, error: MSG_SEM_LEITURA };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre para anexar o comprovante." };
  const acertoId = String(formData.get("acertoId") ?? "");
  if (!UUID_RE.test(acertoId)) return { ok: false, error: MSG_SEM_LEITURA };
  const { acerto: a, erro } = await lerAcerto(admin, acertoId);
  if (erro || !a) return { ok: false, error: MSG_SEM_LEITURA };
  const partes = await partesDoContrato(admin, a.contrato_id);
  if (!partes || partes.dono !== user.id) return { ok: false, error: MSG_SO_O_DONO };
  // Só enquanto a devolução está aberta: à espera da resposta, ou contestada sem decisão.
  if (a.central_decisao || (a.status !== "aguardando_confirmacao" && a.status !== "desconto_contestado")) return { ok: false, error: MSG_JA_DECIDIDA };
  if (a.comprovante_path) return { ok: false, error: MSG_JA_ANEXADO };
  const file = formData.get("arquivo");
  if (!(file instanceof File)) return { ok: false, error: MSG_ARQUIVO };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const v = validarComprovante(bytes, file.size);
  if (!v.ok) return { ok: false, error: MSG_ARQUIVO };
  // O PDF tem de abrir: a leitura do comprovante põe-lhe a marca de quem vê, e uma prova que não se lê não serve à equipe.
  if (!v.imagem && !(await pdfAbre(bytes))) return { ok: false, error: MSG_PDF_ILEGIVEL };
  // A imagem entra sem metadados (EXIF/GPS), como na conferência; o PDF vai como veio.
  const limpo = v.imagem ? await semMetadados(bytes, v.tipo) : bytes;
  if (!limpo) return { ok: false, error: MSG_ARQUIVO };
  const path = `${user.id}/${crypto.randomUUID()}.${v.ext}`;
  const { error: erroEnvio } = await admin.storage.from(BUCKET).upload(path, limpo, { contentType: v.tipo, upsert: false });
  if (erroEnvio) return { ok: false, error: "Não foi possível salvar o comprovante. Tente de novo." };
  const agora = new Date();
  const { data: mudou, error } = await admin
    .from("caucao_acertos")
    .update({ comprovante_path: path, comprovante_anexado_em: agora.toISOString() })
    .eq("id", a.id)
    .is("comprovante_path", null)
    .is("central_decisao", null)
    .select("id");
  if (error) return { ok: false, error: "Não foi possível salvar o comprovante. Tente de novo." };
  if (!mudou?.length) return { ok: false, error: MSG_JA_ANEXADO };
  // Na disputa, o prazo da decisão começa a contar da hora do anexo (M30); o pedido e o lembrete do anexo saem.
  if (a.status === "desconto_contestado") await recalcularPrazoDaDecisao(admin, a.chamado_id, agora);
  await resolverAvisosDaReferencia(admin, { eventos: ["caucao_comprovante_pedido", "caucao_comprovante_lembrete"], refId: a.contrato_id, usuarioId: user.id }).catch(() => undefined);
  return { ok: true };
}

/** As DUAS partes são contas de teste? Parte nula ou desconhecida, ou a leitura falha: false (falha fechada). */
async function duasContasDeTeste(admin: Admin, partes: (string | null)[]): Promise<boolean> {
  if (partes.length !== 2 || partes.some((p) => !p)) return false;
  const { data, error } = await admin.from("profiles").select("id, is_teste").in("id", partes as string[]);
  if (error || !data) return false;
  const teste = new Set(((data as { id: string; is_teste: boolean | null }[]) ?? []).filter((p) => p.is_teste === true).map((p) => p.id));
  return partes.every((p) => teste.has(p as string));
}

/** A Central decide a contestação: "confirmada" (a devolução vale) ou "nao_confirmada" (não vale). */
export async function decidirDevolucaoPelaCentral(input: { chamadoId: string; decisao: "confirmada" | "nao_confirmada"; motivo?: string }): Promise<Res> {
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return { ok: false, error: MSG_SEM_LEITURA };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await ehAdmin(supabase, user.id))) return { ok: false, error: "Sem permissão." };
  if (input.decisao !== "confirmada" && input.decisao !== "nao_confirmada") return { ok: false, error: "Escolha a decisão." };
  if (!UUID_RE.test(input.chamadoId)) return { ok: false, error: "Chamado não encontrado." };
  const { data: ch } = await admin.from("chamados").select("id, numero_publico, contexto_tipo, contexto_id, simulacao").eq("id", input.chamadoId).maybeSingle();
  if (!ch) return { ok: false, error: "Chamado não encontrado." };
  const { data: notas } = await admin.from("chamado_mensagens").select("corpo, autor, interno").eq("chamado_id", ch.id).eq("autor", "sistema").eq("interno", true).order("criado_em", { ascending: true });
  const ids = new Set(((notas ?? []) as { corpo: string }[]).map((n) => NOTA_DO_ACERTO.exec(String(n.corpo ?? "").trim())?.[1]?.toLowerCase()).filter((x): x is string => !!x));
  if (ids.size > 1) return { ok: false, error: "Este chamado tem mais de uma devolução; abra um chamado por devolução." };
  const [acertoId] = [...ids];
  if (!acertoId) return { ok: false, error: "Este chamado não é uma contestação de devolução da caução." };
  const { acerto: a } = await lerAcerto(admin, acertoId);
  // O chamado tem de ser do contrato do acerto: um chamado sem contrato, ou de outro, não decide nada.
  if (!a || ch.contexto_tipo !== "contrato" || ch.contexto_id !== a.contrato_id) return { ok: false, error: MSG_SEM_LEITURA };
  if (a.central_decisao) return { ok: false, error: MSG_JA_DECIDIDA };
  if (!disputaAberta(a)) return { ok: false, error: "Esta devolução não está contestada." };
  const partes = await partesDoContrato(admin, a.contrato_id);
  const morador = partes?.morador ?? null;
  const dono = partes?.dono ?? null;
  const recusaQa = await recusaObservador(user.id, { perfis: [morador, dono], semPerfil: morador && dono ? 0 : 1 });
  if (recusaQa) return { ok: false, error: recusaQa };
  if ((ch as { simulacao?: unknown }).simulacao !== false && !(await duasContasDeTeste(admin, [morador, dono]))) return { ok: false, error: MSG_SIMULACAO };
  const agora = new Date();
  const semProva = !!a.comprovante_pedido_em && !a.comprovante_anexado_em;
  // Com o prazo do anexo a correr e sem comprovante, a equipe espera (é o que o aviso promete ao dono).
  if (semProva && !prazoDoAnexoTerminou(a.comprovante_pedido_em!, agora)) return { ok: false, error: MSG_ESPERA_ANEXO };
  let motivo: string | null = null;
  if (input.decisao === "nao_confirmada") {
    motivo = motivoValido(input.motivo) ?? (semProva ? motivoSemProva(a.meio) : null);
    if (!motivo) return { ok: false, error: MSG_MOTIVO_DA_DECISAO };
  }
  const decisao = { central_decisao: input.decisao, central_decidido_em: agora.toISOString(), central_decidido_por: user.id };
  const mudanca =
    input.decisao === "confirmada"
      ? { ...decisao, status: statusConfirmado(a.tipo), confirmado_em: agora.toISOString(), confirmacao_via: "central" }
      : { ...decisao, central_motivo: motivo };
  const { data: mudou, error } = await admin.from("caucao_acertos").update(mudanca).eq("id", a.id).eq("status", "desconto_contestado").is("central_decisao", null).select("id");
  if (error) return { ok: false, error: "Não foi possível registrar a decisão agora. Tente de novo." };
  // Duas decisões ao mesmo tempo: só a que mudou a linha segue (M10).
  if (!mudou?.length) return { ok: false, error: MSG_JA_DECIDIDA };
  if (input.decisao === "confirmada") after(() => emitirTermoDevolucaoComRegistro(a.id));
  const valor = valorDoAcerto(a);
  const aoMorador = input.decisao === "confirmada" ? textoDecisaoConfirmada({ valor }) : textoDecisaoNaoConfirmada({ valor, motivo: motivo!, paraODono: false });
  const aoDono = input.decisao === "confirmada" ? textoDecisaoConfirmada({ valor }) : textoDecisaoNaoConfirmada({ valor, motivo: motivo!, paraODono: true });
  // A decisão chega ao morador numa resposta VISÍVEL no chamado dele (o molde do E1229, a trilha) e no aviso novo.
  await responderComoAdmin(ch.id, aoMorador, false);
  await admin.from("chamado_mensagens").insert({
    chamado_id: ch.id,
    autor: "admin",
    autor_id: user.id,
    interno: true,
    corpo: `Devolução da caução de ${brl(valor)} ${input.decisao === "confirmada" ? "confirmada" : "não confirmada"} pela Central em ${agora.toISOString().slice(0, 10)}.${motivo ? ` Motivo: ${motivo}` : ""}`,
  });
  await resolverAvisosDaReferencia(admin, { eventos: AVISOS_DO_DONO_NA_DISPUTA, refId: a.contrato_id, usuarioId: dono }).catch(() => undefined);
  await enviarSemFalhar(admin, { evento: "caucao_devolucao_decidida", userId: morador, papel: "morador", contratoId: a.contrato_id, url: URL_DO_MORADOR, texto: aoMorador, cta: "Ver a caução" });
  await enviarSemFalhar(admin, { evento: "caucao_devolucao_decidida", userId: dono, papel: "dono", contratoId: a.contrato_id, url: urlDoDono(a.contrato_id), texto: aoDono, cta: input.decisao === "confirmada" ? "Ver a caução" : "Registrar a devolução" });
  return { ok: true };
}
