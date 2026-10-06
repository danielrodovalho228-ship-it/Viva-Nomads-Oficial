import crypto from "node:crypto";
import { after, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardContactInfo } from "@/lib/messages/contact-guard";
import { calcularPrazos, mensagemPrazo } from "@/config/atendimento";
import { avisoEmergencia, classificar } from "@/lib/atendimento/classificar";
import { avisarEquipe, avisarUsuario, registrarMensagemDaPessoa, type ChamadoResumo } from "@/lib/atendimento/servidor";
import { consumirLimite, HORA } from "@/lib/limites";
import { rodarViva, vivaAtiva } from "@/lib/atendimento/viva-servidor";
import { AVISO_VIVA, ehGolpe, ORIENTACAO_GOLPE } from "@/lib/atendimento/viva-regras";

/**
 * ENTRADA POR E-MAIL (ajuda@vivanomads.com.br) — atrás da flag
 * ATENDIMENTO_EMAIL_ATIVO=on (até a caixa existir, fica DESLIGADA: 404).
 *
 * Agnóstico de provedor: Resend Inbound, Cloudflare Email Routing (Worker) ou
 * um encaminhador chamam este endpoint com o cabeçalho
 * `x-atendimento-secret: <ATENDIMENTO_EMAIL_SECRET>` e o corpo
 * `{ from, subject, text }` (também aceita `{ data: { ... } }`, formato de webhook).
 *
 *  • Assunto com [VN-000123] e remetente = dono do chamado → entra na MESMA conversa.
 *  • Senão → chamado novo. Remetente com conta → ligado ao perfil; sem conta →
 *    visitante (o e-mail só a equipe vê).
 */
function igual(a: string, b: string): boolean {
  const x = crypto.createHash("sha256").update(a).digest();
  const y = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(x, y);
}

function enderecoDe(from: string): { email: string; nome: string | null } | null {
  const m = from.match(/^\s*(?:"?([^"<]*)"?\s*)?<?([^<>\s]+@[^<>\s]+)>?\s*$/);
  if (!m) return null;
  return { email: m[2].toLowerCase().slice(0, 254), nome: (m[1] ?? "").trim().slice(0, 60) || null };
}

/** Corta a citação da mensagem anterior ("Em ... escreveu:", linhas com ">"). */
function semCitacao(texto: string): string {
  const linhas = texto.replace(/\r/g, "").split("\n");
  const fim = linhas.findIndex((l) => /^(em .+escreveu:|on .+wrote:|-{2,}\s*mensagem original|>)/i.test(l.trim()));
  return (fim > 0 ? linhas.slice(0, fim) : linhas).join("\n").trim();
}

export async function POST(request: Request) {
  if (process.env.ATENDIMENTO_EMAIL_ATIVO !== "on") return NextResponse.json({ error: "Desligado." }, { status: 404 });
  const esperado = process.env.ATENDIMENTO_EMAIL_SECRET;
  const recebido = request.headers.get("x-atendimento-secret") ?? "";
  if (!esperado || !igual(recebido, esperado)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const bruto = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const d = ((bruto?.data as Record<string, unknown>) ?? bruto ?? {}) as Record<string, unknown>;
  const remetente = enderecoDe(String(d.from ?? ""));
  const assunto = String(d.subject ?? "").slice(0, 200);
  const texto = semCitacao(String(d.text ?? d.plain ?? "")).slice(0, 4000);
  if (!remetente || texto.length < 2) return NextResponse.json({ error: "E-mail sem remetente ou texto." }, { status: 400 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Indisponível." }, { status: 503 });
  if (!(await consumirLimite(`chamado-email:${remetente.email}`, 20, HORA))) return NextResponse.json({ ok: true, ignorado: "limite" });

  const corpo = guardContactInfo(texto).text;
  const { data: perfil } = await admin.from("profiles").select("id").ilike("email", remetente.email).maybeSingle();
  const usuarioId = (perfil?.id as string | undefined) ?? null;

  // Resposta a um chamado existente (mesma thread).
  const num = assunto.toUpperCase().match(/VN-\d{6,}/)?.[0];
  if (num) {
    const { data: c } = await admin
      .from("chamados")
      .select("id, numero_publico, assunto, prioridade, status, usuario_id, visitante_email, visitante_nome, responsavel_tipo")
      .eq("numero_publico", num)
      .maybeSingle();
    const dono = c && ((usuarioId && c.usuario_id === usuarioId) || (c.visitante_email && c.visitante_email === remetente.email));
    if (c && dono && c.status !== "encerrado") {
      await admin.from("chamado_mensagens").insert({ chamado_id: c.id, autor: "usuario", autor_id: usuarioId, corpo });
      await admin.from("chamados").update({ status: "em_andamento", atualizado_em: new Date().toISOString() }).eq("id", c.id);
      if (c.status === "resolvido") {
        await admin.from("chamado_eventos").insert({ chamado_id: c.id, ator_tipo: "usuario", acao: "reaberto", de: "resolvido", para: "em_andamento", detalhe: "por e-mail" });
      }
      await registrarMensagemDaPessoa(c as ChamadoResumo & { responsavel_tipo: string; status: string }, usuarioId, "email");
      if (c.responsavel_tipo === "ia" && vivaAtiva()) after(() => rodarViva(c.id as string));
      return NextResponse.json({ ok: true, chamado: c.numero_publico, acao: "resposta" });
    }
  }

  // Chamado novo.
  const { tipo, prioridade, emergencia } = classificar("duvida", `${assunto}\n${texto}`);
  const agora = new Date();
  const prazos = calcularPrazos(prioridade, agora);
  const comViva = vivaAtiva() && !emergencia && prioridade !== "p1";
  const { data: novo, error } = await admin
    .from("chamados")
    .insert({
      usuario_id: usuarioId,
      visitante_email: usuarioId ? null : remetente.email,
      visitante_nome: usuarioId ? null : remetente.nome,
      tipo: tipo === "manutencao" ? "suporte" : tipo,
      categoria: "duvida",
      prioridade,
      canal: "email",
      responsavel_tipo: comViva ? "ia" : "humano",
      assunto: guardContactInfo(assunto.replace(/^(re|fw|fwd|enc):\s*/i, "").trim() || texto.split("\n")[0]).text.slice(0, 140) || "Mensagem por e-mail",
      prazo_primeira_resposta: prazos.primeiraResposta.toISOString(),
      prazo_resolucao: prazos.resolucao.toISOString(),
    })
    .select("id, numero_publico, assunto, prioridade, usuario_id, visitante_email, visitante_nome")
    .single();
  if (error || !novo) return NextResponse.json({ error: "Falha ao registrar." }, { status: 500 });
  const aviso = [emergencia ? avisoEmergencia(emergencia) : null, ehGolpe(texto) ? ORIENTACAO_GOLPE : null, comViva ? AVISO_VIVA : mensagemPrazo(prioridade, agora)].filter(Boolean).join(" ");
  await admin.from("chamado_mensagens").insert([
    { chamado_id: novo.id, autor: "usuario", autor_id: usuarioId, corpo },
    { chamado_id: novo.id, autor: "sistema", corpo: aviso },
  ]);
  await admin.from("chamado_eventos").insert({ chamado_id: novo.id, ator_tipo: "sistema", acao: "aberto", para: prioridade, detalhe: "por e-mail" });
  await avisarUsuario(novo as ChamadoResumo, "chamado_aberto");
  if (prioridade === "p1" || prioridade === "p2") await avisarEquipe(novo as ChamadoResumo, "chegou por e-mail");
  if (comViva) after(() => rodarViva(novo.id as string));
  return NextResponse.json({ ok: true, chamado: novo.numero_publico, acao: "novo" });
}
