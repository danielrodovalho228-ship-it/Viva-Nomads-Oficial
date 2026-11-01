"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exigirAdminAal2 } from "@/lib/data/admin-guard";
import { logModeracao } from "@/lib/data/moderacao-log";
import { ACOES_DADOS_TESTE } from "@/lib/jornada-teste";
import { enviarResumosSemanais, type TotaisResumo } from "@/lib/notifications/resumo-semanal-servidor";

/*
  E375-B — Admin → Dados de teste → "Gerar resumo semanal agora". Roda o resumo SÓ para as contas is_teste, a qualquer
  dia e com a chave RESUMO_SEMANAL_ATIVO desligada; o e-mail vai para a caixa de teste (gravada pelo envio). Para a
  prova do QA não esperar a semana, o teto e o silêncio não se aplicam aqui (só contas de teste). Admin com 2FA.
*/
export type ResultadoResumoQa = { ok: true; totais: TotaisResumo } | { ok: false; error: string };

export async function gerarResumoSemanalDeTeste(): Promise<ResultadoResumoQa> {
  const sessao = await createClient();
  const admin = createAdminClient();
  if (!sessao || !admin) return { ok: false, error: "Serviço indisponível no momento." };
  const {
    data: { user },
  } = await sessao.auth.getUser();
  if (!user || !(await exigirAdminAal2(sessao, user.id))) return { ok: false, error: "Só admin com a verificação em duas etapas." };
  const totais = await enviarResumosSemanais(new Date(), { soTeste: true, ignorarTeto: true });
  await logModeracao(admin, user.id, ACOES_DADOS_TESTE.resumoSemanalGerado, "profile", user.id, `${totais.enviados} de ${totais.pessoas} conta(s) de teste receberam o resumo`);
  revalidatePath("/admin/dados-de-teste");
  return { ok: true, totais };
}
