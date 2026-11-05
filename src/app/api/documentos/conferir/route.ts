import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumirLimite, DIA } from "@/lib/limites";
import { notify } from "@/lib/notifications";
import { adminsPorAviso } from "@/lib/notifications/push-admins";
import { tipoRealPorMagicBytes, DOC_MIME } from "@/lib/upload-limits";
import { lerDocumento, lerMatricula, matriculaDoLaboratorio } from "@/lib/documento/conferidor";
import {
  camposParaGravar,
  onusParaGravar,
  decidirMatricula,
  decisaoComFalhaDeLeitura,
  estadoTelaDaMatricula,
  preenchimentoDaMatricula,
  semMatriculaVaiParaRevisao,
  resumoDoLaudo,
  statusDaMatricula,
  type LaudoCafGravado,
} from "@/lib/documento/conferencia-matricula";
import { integracoesSimuladas } from "@/lib/integracoes";
import {
  decidirConferencia,
  leituraParaGravar,
  rotuloEstado,
  statusDoEstado,
  REVISAO_PRAZO_HORAS,
  type CadastroComparado,
} from "@/lib/documento/conferencia";
import { decisaoComVigente } from "@/lib/documento/vigente";
import { hojeBR } from "@/lib/utils";

const BUCKET = "property-docs";
/** Varredura ampliada: o que decide (duplicado, perfil, laudo) ou o que a linha herda não foi lido → "tente de novo". */
const MSG_CONFERIR_SEM_LEITURA = "Não foi possível conferir o documento agora. Tente de novo em instantes.";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * CONFERÊNCIA AUTOMÁTICA do documento do imóvel (prompt 11), chamada pela etapa 1 do cadastro logo depois do
 * envio (/api/upload/documento). O servidor baixa o arquivo do bucket PRIVADO, a IA só LÊ e o código decide
 * (src/lib/documento/conferencia.ts) com o checklist do admin:
 *   aprovado → document_status 'approved' (conferido_por automático) · corrija → 'rejected' com o motivo ·
 *   revisão → 'pending', prazo de 48 h, aviso aos admins.
 * Grava uma NOVA linha de qualificação com o cliente de serviço (o dono não grava status — 0060/0072/0152),
 * herdando as respostas da qualificação anterior do mesmo imóvel. A resposta nunca traz o que a IA leu (CPF,
 * nome, endereço): só o estado, os motivos e o checklist.
 *
 * Prompt 19 — MATRÍCULA: quando o arquivo é uma matrícula, a leitura é a completa (proprietários, ônus, unidade,
 * área, vaga) e a decisão cruza com o laudo CAF da pessoa (src/lib/documento/conferencia-matricula.ts). A
 * conferência fica em property_ownership_checks (0158, só dono e admin). Ao dono voltam só o resultado, a mensagem,
 * as opções do caso e o que preenche o anúncio — nunca CPF, número da matrícula, cartório ou o ônus.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ estado: "aprovado", rotulo: rotuloEstado("aprovado"), motivos: [], demo: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const corpo = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const path = typeof corpo?.path === "string" ? corpo.path : "";
  const imovelId = typeof corpo?.imovelId === "string" && UUID_RE.test(corpo.imovelId) ? corpo.imovelId : null;
  const end = (corpo?.endereco && typeof corpo.endereco === "object" ? corpo.endereco : {}) as Record<string, unknown>;
  const s = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[<>]/g, "").trim().slice(0, max) : "");
  const operacao = s(corpo?.operacao, 20) || "own";

  // Só o arquivo do PRÓPRIO dono (o upload grava em <user.id>/<uuid>.<ext>).
  if (!new RegExp(`^${user.id}/[0-9a-f-]{36}\\.(pdf|png|jpg)$`).test(path)) {
    return NextResponse.json({ error: "Documento inválido." }, { status: 400 });
  }
  if (!(await consumirLimite(`doc-conferir:${user.id}`, 20, DIA))) {
    return NextResponse.json({ error: "Muitas conferências hoje. Tente novamente amanhã." }, { status: 429 });
  }
  if (imovelId) {
    const { data: prop } = await supabase.from("properties").select("id").eq("id", imovelId).eq("owner_id", user.id).maybeSingle();
    if (!prop) return NextResponse.json({ error: "Imóvel não encontrado." }, { status: 404 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });

  const { data: blob, error: erroDl } = await admin.storage.from(BUCKET).download(path);
  if (erroDl || !blob) return NextResponse.json({ error: "Não encontramos o documento enviado." }, { status: 404 });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const mime = tipoRealPorMagicBytes(bytes);
  if (!mime || !DOC_MIME.includes(mime as (typeof DOC_MIME)[number])) {
    return NextResponse.json({ error: "Tipo de arquivo inválido." }, { status: 415 });
  }
  // Impressão digital calculada AQUI (não confia na do cliente): reuso por outra conta = duplicado.
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const { count: duplicado, error: erroDuplicado } = await admin
    .from("qualification_checklists")
    .select("id", { count: "exact", head: true })
    .eq("document_hash_sha256", hash)
    .neq("owner_id", user.id);

  const { data: perfil, error: erroPerfil } = await admin.from("profiles").select("full_name, cpf, cnpj, is_teste").eq("id", user.id).maybeSingle();
  // Sem saber se o documento já foi usado por outra conta (antifraude) ou sem o perfil, não decide nem lê o documento.
  if (erroDuplicado || erroPerfil) return NextResponse.json({ error: MSG_CONFERIR_SEM_LEITURA }, { status: 503 });
  const cadastro: CadastroComparado = {
    nomeConta: (perfil?.full_name as string | null) ?? null,
    endereco: { cep: s(end.cep, 9), rua: s(end.rua, 150), numero: s(end.numero, 20), bairro: s(end.bairro, 100), cidade: s(end.cidade, 100) },
    operacao,
    duplicado: duplicado ?? 0,
    hoje: hojeBR(),
  };

  const agora = new Date();
  const arquivo = { bytes, mime };
  // Matrícula fictícia do laboratório vai direto para a leitura completa; no resto, a leitura do documento diz o tipo.
  const lida = matriculaDoLaboratorio(bytes) ? null : await lerDocumento(arquivo, cadastro);
  // Prompt 22: a leitura FALHOU (arquivo grande, ilegível, serviço fora)? A tentativa vai para a conferência do dono
  // (property_ownership_checks) em revisão, com o motivo — antes caía no ramo genérico e a tabela ficava vazia.
  const falhaLeitura = lida?.falha;
  // Sem leitura nenhuma (falhou ou ninguém leu) também conta: a equipe confere, e a tentativa fica registrada.
  const ehMatricula = !lida || !lida.leitura || lida.leitura.tipo === "matricula";

  // Respostas da qualificação anterior do mesmo imóvel (ou da que está à espera): a linha nova só troca o documento.
  const ultima = async (doImovel: string | null) => {
    let q = admin.from("qualification_checklists").select("*").eq("owner_id", user.id);
    q = doImovel ? q.eq("property_id", doImovel) : q.is("property_id", null);
    const { data, error } = await q.order("created_at", { ascending: false }).limit(1).maybeSingle();
    // Varredura ampliada: sem a qualificação anterior, a linha nova nasceria sem as respostas do dono.
    if (error) throw new Error("Não foi possível ler a qualificação anterior.");
    return data;
  };
  // Imóvel já com rascunho: a dele; sem nenhuma ainda, a que estava à espera (respondida antes do rascunho existir).
  const anterior = await (async () => ((imovelId ? await ultima(imovelId) : null) ?? (await ultima(null))))().catch(() => "falhou" as const);
  if (anterior === "falhou") return NextResponse.json({ error: MSG_CONFERIR_SEM_LEITURA }, { status: 503 });
  // E587: o aprovado vigente do imóvel (lido ANTES de gravar o novo). A resposta leva este fato para a tela não pôr
  // o veredito do envio novo no lugar do aprovado — o novo fica à parte até ser aprovado (E-DOC-VIGENTE).
  const vigenteAprovado = await temAprovadoVigente(admin, user.id, imovelId).catch(() => "falhou" as const);
  if (vigenteAprovado === "falhou") return NextResponse.json({ error: MSG_CONFERIR_SEM_LEITURA }, { status: 503 });
  const herdado: Record<string, unknown> = { ...(anterior ?? {}) };
  for (const k of [
    "id", "created_at", "document_path", "document_hash_sha256", "document_uploaded_at", "document_status",
    "document_review_reason", "document_reviewed_at", "document_reviewed_by", "conferencia", "conferido_por", "revisao_ate",
  ]) delete herdado[k];

  const gravarQualificacao = (campos: Record<string, unknown>) =>
    admin.from("qualification_checklists").insert({
      ...herdado,
      owner_id: user.id,
      property_id: imovelId,
      document_path: path,
      document_hash_sha256: hash,
      document_uploaded_at: agora.toISOString(),
      ...campos,
    });

  if (ehMatricula) {
    const perfilDono = { nome: (perfil?.full_name as string | null) ?? null, cpf: (perfil?.cpf as string | null) ?? null, cnpj: (perfil?.cnpj as string | null) ?? null };
    // Se a leitura do documento já falhou, não chama a IA de novo: grava a tentativa com o motivo.
    const { leitura: mat, conferidor, modelo, falha } = falhaLeitura
      ? { leitura: null, conferidor: lida!.conferidor, modelo: lida!.modelo, falha: falhaLeitura }
      : await lerMatricula(arquivo, { perfil: perfilDono, endereco: cadastro.endereco, hoje: cadastro.hoje });
    // Laudo CAF mais recente da pessoa (12 meses). O simulado só vale no laboratório ou em conta de teste.
    const { data: laudo, error: erroLaudo } = await admin
      .from("tenant_verifications")
      .select("caf_result, traffic_light, valid_until, created_at")
      .eq("tenant_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (erroLaudo) return NextResponse.json({ error: MSG_CONFERIR_SEM_LEITURA }, { status: 503 });
    const caf = resumoDoLaudo((laudo as LaudoCafGravado | null) ?? null, agora, integracoesSimuladas() || perfil?.is_teste === true);
    const d = decisaoComFalhaDeLeitura(
      decidirMatricula(mat, { perfil: perfilDono, caf, enderecoCadastro: cadastro.endereco, duplicado: cadastro.duplicado, hoje: cadastro.hoje }),
      falha,
    );
    // E587: com aprovado vigente, a equipe decide o envio novo (a leitura fica só na trilha e em property_ownership_checks).
    const estado = decisaoComVigente(vigenteAprovado, estadoTelaDaMatricula(d.resultado));
    const emRevisao = vigenteAprovado || d.resultado === "em_revisao";

    const { data: check, error: erroCheck } = await admin
      .from("property_ownership_checks")
      .insert({
        property_id: imovelId,
        user_id: user.id,
        arquivo_path: path,
        matricula_numero: mat?.numero ?? null,
        cartorio: mat?.cartorio ?? null,
        resultado: d.resultado,
        motivo: d.motivo,
        campos_extraidos: mat ? camposParaGravar(mat, d.comparacao) : {},
        onus: mat ? onusParaGravar(mat.onus) : [],
        caf_ok: caf.ok,
        caf_simulado: caf.ok && (laudo?.caf_result as Record<string, unknown> | null)?.simulado === true,
      })
      .select("id")
      .single();
    const { error: erroQual } = await gravarQualificacao({
      document_status: vigenteAprovado ? "pending" : statusDaMatricula(d.resultado),
      document_review_reason: d.resultado === "conferido" ? null : d.mensagem.slice(0, 500),
      document_reviewed_at: emRevisao ? null : agora.toISOString(),
      conferido_por: emRevisao ? null : "automatico",
      revisao_ate: emRevisao ? new Date(agora.getTime() + REVISAO_PRAZO_HORAS * 3_600_000).toISOString() : null,
      // Trilha de auditoria SEM dado pessoal: o detalhe da matrícula fica em property_ownership_checks (0158).
      conferencia: {
        versao: 2,
        tipo: "matricula",
        estado,
        resultado: d.resultado,
        motivo: d.motivo,
        caf_ok: caf.ok,
        // E587: havia aprovado vigente — o veredito acima é só a leitura automática; a decisão é da equipe.
        decisao: vigenteAprovado ? "equipe" : "automatica",
        conferidor,
        modelo,
        // Falha da leitura (prompt 22), sem dado pessoal: status HTTP e tipo do erro.
        falha: falha ? { motivo: falha.motivo, status: falha.status, tipo: falha.tipo } : null,
        em: agora.toISOString(),
      },
    });
    if (erroCheck || erroQual || !check) {
      console.error("[conferir-matricula] falha ao gravar:", erroCheck?.message ?? erroQual?.message ?? "sem linha");
      return NextResponse.json({ error: "Não foi possível salvar a conferência agora. Tente de novo." }, { status: 500 });
    }
    if (emRevisao || d.resultado === "provavel") await avisarAdmins();
    return NextResponse.json({
      estado,
      rotulo: rotuloEstado(estado),
      vigenteAprovado,
      motivos: estado === "aprovado" || vigenteAprovado ? [] : [d.mensagem],
      // E587: com vigente, a leitura do novo não volta para a tela (nem preenche o anúncio) até a equipe aprovar.
      matricula: vigenteAprovado ? undefined : {
        id: check.id,
        resultado: d.resultado,
        motivo: d.motivo,
        mensagem: d.mensagem,
        opcoes: d.opcoes,
        pedirCaf: d.pedirCaf,
        avisos: d.avisos,
        preenchimento: mat ? preenchimentoDaMatricula(mat) : null,
      },
    });
  }

  const { leitura, conferidor, modelo } = lida;
  // Sem matrícula (IPTU, contrato de compra, conta…): aceito, mas a equipe confere — nunca aprovado na hora.
  const r = semMatriculaVaiParaRevisao(decidirConferencia(leitura, cadastro), leitura?.tipo ?? null);
  const motivosTexto = r.motivos.map((m) => m.texto).join(" · ").slice(0, 500) || null;
  // E587: com aprovado vigente, o envio novo vai para a equipe (em análise); o veredito automático fica na trilha.
  const estadoFinal = decisaoComVigente(vigenteAprovado, r.estado);
  const { error: erroIns } = await gravarQualificacao({
    document_status: statusDoEstado(estadoFinal),
    document_review_reason: r.estado === "aprovado" ? null : motivosTexto,
    document_reviewed_at: estadoFinal === "revisao" ? null : agora.toISOString(),
    conferido_por: estadoFinal === "revisao" ? null : "automatico",
    revisao_ate: estadoFinal === "revisao" ? new Date(agora.getTime() + REVISAO_PRAZO_HORAS * 3_600_000).toISOString() : null,
    // Trilha de auditoria: o veredito do que foi lido (sim/não, sem dado pessoal — E293 P2), por quem, e o checklist.
    conferencia: {
      versao: 2,
      estado: r.estado,
      decisao: vigenteAprovado ? "equipe" : "automatica",
      checklist: r.checklist,
      motivos: r.motivos,
      lido: leituraParaGravar(leitura, r.checklist),
      conferidor,
      modelo,
      em: agora.toISOString(),
    },
  });
  if (erroIns) {
    console.error("[conferir-documento] falha ao gravar:", erroIns.message);
    return NextResponse.json({ error: "Não foi possível salvar a conferência agora. Tente de novo." }, { status: 500 });
  }

  // Só os casos em revisão entram na fila: avisa os admins (sem dados do documento).
  if (estadoFinal === "revisao") await avisarAdmins();

  return NextResponse.json({
    estado: estadoFinal,
    rotulo: rotuloEstado(estadoFinal),
    vigenteAprovado,
    motivos: vigenteAprovado ? [] : r.motivos.map((m) => m.texto),
  });
}

/** E587: há documento APROVADO para este imóvel (ou, sem imóvel, para a qualificação à espera)? Erro de leitura lança. */
async function temAprovadoVigente(admin: NonNullable<ReturnType<typeof createAdminClient>>, ownerId: string, imovelId: string | null): Promise<boolean> {
  let q = admin.from("qualification_checklists").select("id", { count: "exact", head: true }).eq("owner_id", ownerId).eq("document_status", "approved");
  q = imovelId ? q.eq("property_id", imovelId) : q.is("property_id", null);
  const { count, error } = await q;
  if (error) throw new Error("Não foi possível ler o documento vigente.");
  return (count ?? 0) > 0;
}

/** Avisa a equipe de que há documento na fila (sem nenhum dado do documento). */
async function avisarAdmins() {
  try {
    const admins = await adminsPorAviso<{ email: string | null; full_name: string | null; notif_email: boolean | null }>(
      "operacional",
      "email, full_name, notif_email",
    );
    for (const a of admins) {
      if (a.email && a.notif_email !== false) {
        await notify({ event: "documento_recebido", email: a.email, name: a.full_name ?? undefined, pushUrl: "/admin/documentos" });
      }
    }
  } catch {
    /* best-effort */
  }
}
