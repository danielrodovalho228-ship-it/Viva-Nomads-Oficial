import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { contarInteresse, type InteresseEspaco } from "@/lib/perfil/espaco-trabalho";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

/** Ordem 286312f8: quantos perfis responderam às perguntas de espaço de trabalho (só números; contas de teste à parte). */
export async function interesseEspacoTrabalho(admin: Admin): Promise<InteresseEspaco> {
  const { data } = await admin
    .from("profiles")
    .select("espaco_trabalho_oferta, espaco_trabalho_procura, is_teste")
    .or("espaco_trabalho_oferta.not.is.null,espaco_trabalho_procura.not.is.null")
    .limit(10000);
  return contarInteresse(
    ((data ?? []) as { espaco_trabalho_oferta: string | null; espaco_trabalho_procura: string | null; is_teste: boolean | null }[]).map((p) => ({
      oferta: p.espaco_trabalho_oferta,
      procura: p.espaco_trabalho_procura,
      teste: !!p.is_teste,
    })),
  );
}
