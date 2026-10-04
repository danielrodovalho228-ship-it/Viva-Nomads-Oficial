import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { consumirLimite, ipHash, HORA } from "@/lib/limites";
import { validarEvento, origemDoCookie, diaBR, ORIGEM_COOKIE } from "@/lib/eventos/eventos";

/**
 * Evento anônimo de uso (0067). O navegador manda por sendBeacon; só o
 * servidor grava (a tabela não tem política para anon/authenticated).
 * Sem dado pessoal: o IP só entra no limite (como hash) e na `sessao`, que é
 * um hash DIÁRIO — não liga visitas de dias diferentes.
 * Sempre 204: o navegador não espera nem trata resposta.
 */
const vazio = () => new Response(null, { status: 204 });

function cookie(request: Request, nome: string): string | null {
  const c = request.headers.get("cookie") ?? "";
  for (const parte of c.split(/;\s*/)) {
    const i = parte.indexOf("=");
    if (i > 0 && parte.slice(0, i) === nome) return parte.slice(i + 1);
  }
  return null;
}

export async function POST(request: Request) {
  // Só o próprio site (sendBeacon manda Origin).
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return vazio();

  const texto = await request.text().catch(() => "");
  if (!texto || texto.length > 2000) return vazio();
  let corpo: unknown = null;
  try {
    corpo = JSON.parse(texto);
  } catch {
    return vazio();
  }
  const ua = request.headers.get("user-agent");
  const evento = validarEvento(corpo, ua);
  if (!evento) return vazio();

  const ip = ipHash(request);
  if (!(await consumirLimite(`evento:${ip}`, 300, HORA))) return vazio();

  const admin = createAdminClient();
  if (!admin) return vazio();

  let usuarioId: string | null = null;
  try {
    const supabase = await createClient();
    if (supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      usuarioId = user?.id ?? null;
    }
  } catch {
    usuarioId = null;
  }

  const segredo = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "viva-nomads";
  const sessao = crypto
    .createHmac("sha256", segredo)
    .update(`sessao:${ip}:${ua ?? ""}:${diaBR()}`)
    .digest("hex")
    .slice(0, 32);
  const origem = origemDoCookie(cookie(request, ORIGEM_COOKIE));

  const { error } = await admin.from("eventos").insert({
    tipo: evento.tipo,
    usuario_id: usuarioId,
    sessao,
    imovel_id: evento.imovel_id,
    cidade_chave: evento.cidade_chave,
    origem_source: origem.source,
    origem_medium: origem.medium,
    origem_campaign: origem.campaign,
    plataforma: evento.plataforma,
  });
  // Imóvel apagado entre o clique e o beacon (FK) → grava sem o imóvel.
  if (error?.code === "23503" && evento.imovel_id) {
    await admin.from("eventos").insert({
      tipo: evento.tipo,
      usuario_id: usuarioId,
      sessao,
      cidade_chave: evento.cidade_chave,
      origem_source: origem.source,
      origem_medium: origem.medium,
      origem_campaign: origem.campaign,
      plataforma: evento.plataforma,
    });
  } else if (error && error.code !== "42P01") {
    console.error("[evento] não gravou:", error.message);
  }
  return vazio();
}
