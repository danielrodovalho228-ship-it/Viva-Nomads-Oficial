"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apagarFotosDoAnuncio } from "@/lib/minimizacao/fotos-anuncio";

/**
 * E308 (causa raiz, 01/11): "remover" uma foto no cadastro apagava o arquivo do bucket NA HORA, pelo navegador — mesmo
 * quando o arquivo ainda era a capa de outro rascunho (ou deste, até o próximo salvamento). Agora passa pelo servidor:
 * só a pasta do próprio dono, e o arquivo só sai do bucket se nenhum imóvel ou rascunho ainda o usa (o resto sai na
 * sincronização do próximo salvamento, que faz a mesma conferência).
 */
export async function removerFotoDoCadastro(path: string): Promise<void> {
  if (typeof path !== "string" || !path || path.includes("..")) return;
  const supabase = await createClient();
  if (!supabase) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !path.startsWith(`${user.id}/`)) return;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return;
  await apagarFotosDoAnuncio(createAdminClient(), [`${base}/storage/v1/object/public/property-photos/${path}`]);
}
