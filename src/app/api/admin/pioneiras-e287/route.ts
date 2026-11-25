import { NextResponse } from "next/server";
import { respostaNaoAdmin } from "@/lib/admin/api-nao-admin";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ehAdmin } from "@/lib/data/admin-guard";
import { sendEmail } from "@/lib/notifications/email";
import { ID_PIONEIRA, enviarPioneiraReal, type DepsEnvioReal } from "@/lib/notifications/pioneiras-e287-real";

export const dynamic = "force-dynamic";

/**
 * E287 (Opção A) — dispara UM dos dois e-mails às pioneiras, pelo serviço oficial (sendEmail → Resend). SÓ admin, SÓ POST,
 * corpo { pessoa: "maria-de-fatima" | "lya-raquel" }. O destino é fixo no código; a ordem (Maria de Fátima, depois a Lya),
 * a conferência da conta e a trava de "um envio por pessoa" estão em enviarPioneiraReal. Sem tela, sem lista, sem outro destino.
 */
export async function POST(request: Request) {
  const sessao = await createClient();
  if (!sessao) return respostaNaoAdmin();
  const {
    data: { user },
  } = await sessao.auth.getUser();
  if (!user || !(await ehAdmin(sessao, user.id))) return respostaNaoAdmin();

  const corpo = (await request.json().catch(() => null)) as { pessoa?: unknown } | null;
  const pessoa = corpo?.pessoa;
  if (typeof pessoa !== "string" || !Object.hasOwn(ID_PIONEIRA, pessoa)) return NextResponse.json({ erro: "Pessoa inválida." }, { status: 400 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ erro: "Serviço indisponível." }, { status: 503 });

  const deps: DepsEnvioReal = {
    perfil: async (id) => {
      const { data, error } = await admin.from("profiles").select("email, role, is_teste").eq("id", id).maybeSingle();
      return error ? "falha" : ((data as { email: string | null; role: string | null; is_teste: boolean | null } | null) ?? null);
    },
    existeChave: async (chave) => {
      const { data, error } = await admin.from("automacoes_envios").select("chave").eq("chave", chave).maybeSingle();
      return error ? "falha" : !!data;
    },
    reservar: async (chave, tipo, usuarioId) => {
      const { error } = await admin.from("automacoes_envios").insert({ chave, tipo, usuario_id: usuarioId });
      return error ? (error.code === "23505" ? "ja" : "falha") : "ok";
    },
    liberar: async (chave) => {
      await admin.from("automacoes_envios").delete().eq("chave", chave).like("chave", "pioneiras_e287_envio:%");
    },
    enviar: (p) => sendEmail(p),
    agora: () => new Date(),
  };
  const r = await enviarPioneiraReal(deps, pessoa as keyof typeof ID_PIONEIRA);
  return NextResponse.json(r, { status: r.ok ? 200 : 409, headers: { "Cache-Control": "no-store" } });
}
