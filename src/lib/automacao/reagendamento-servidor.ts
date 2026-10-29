import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hojeEmBrasilia } from "@/lib/checkin";
import { avisar, evento, mensagem, rota } from "@/lib/parceiros/pedido-servidor";
import { cancelarPorRemarcacao, contratoDoEvento } from "./servidor";
import { decidirRecusaDaNovaData, EVENTOS_DE_HORARIO, reagendamentoPendente } from "./remarcacao";

/*
  E213-B: o parceiro recusa a NOVA data de um pedido automático já aceito (reagendamento depois do aditivo assinado).
  O pedido segue o caminho "sem aceite": nova saída a até 5 dias → volta a "solicitado" (valores do aceite zerados,
  o parceiro pode orçar de novo ou recusar; sem resposta em 24 h, o dono troca de parceiro como já faz); mais longe →
  cancelado com o sufixo ":remarcado:<ts>" e o cron refaz no D-5. Fora do "use server": só a rota do pedido chama.
*/

type Res = { ok: true; valor: null } | { ok: false; erro: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Linha = {
  id: string;
  cliente_id: string;
  parceiro_id: string;
  contrato_id: string | null;
  status: string;
  origem: string;
  aguardando_dono: boolean;
  descricao: string | null;
  servico_id: string | null;
  chave_automacao: string | null;
  gatilho: string | null;
  parceiros: { user_id: string } | null;
};

export async function recusarNovaData(pedidoId: string): Promise<Res> {
  if (!UUID.test(pedidoId)) return { ok: false, erro: "Pedido não encontrado." };
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return { ok: false, erro: "Não foi possível continuar agora. Tente de novo em instantes." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Entre para continuar." };
  const { data } = await admin
    .from("parceiro_pedidos")
    .select("id, cliente_id, parceiro_id, contrato_id, status, origem, aguardando_dono, descricao, servico_id, chave_automacao, gatilho, parceiros(user_id)")
    .eq("id", pedidoId)
    .maybeSingle();
  const p = data as unknown as Linha | null;
  if (!p || p.parceiros?.user_id !== user.id) return { ok: false, erro: "Pedido não encontrado." };
  const { data: evs } = await admin
    .from("parceiro_pedido_eventos")
    .select("tipo")
    .eq("pedido_id", p.id)
    .in("tipo", EVENTOS_DE_HORARIO as unknown as string[])
    .order("criado_em", { ascending: false })
    .limit(1);
  const tipos = ((evs ?? []) as { tipo: string }[]).map((e) => e.tipo);
  if (p.origem !== "automatico" || !p.chave_automacao || !p.contrato_id || !reagendamentoPendente(p.status, tipos)) {
    return { ok: false, erro: "Esta ação não está disponível agora. Atualize a página." };
  }
  const ctx = await contratoDoEvento(admin, p.contrato_id);
  if (!ctx) return { ok: false, erro: "Não foi possível ler a estadia agora. Tente de novo." };
  const agora = new Date();
  const pedido = { ...p, chave_automacao: p.chave_automacao };
  const caminho = decidirRecusaDaNovaData(ctx.saida, hojeEmBrasilia(agora));
  if (caminho === "cancelar_remarcado") {
    if (!(await cancelarPorRemarcacao(admin, pedido, agora, "nova_data_recusada"))) return { ok: false, erro: "O pedido mudou. Atualize a página." };
  } else {
    // Volta a esperar o parceiro, na janela nova (que o reagendamento já gravou): o aceite anterior deixa de valer.
    const { data: ok } = await admin
      .from("parceiro_pedidos")
      .update({
        status: "solicitado",
        horario_confirmado: null,
        valor_combinado: null,
        taxa_percent: null,
        valor_taxa: null,
        valor_parceiro: null,
        enviado_em: agora.toISOString(),
        sem_resposta_avisado_em: null,
        atualizado_em: agora.toISOString(),
      })
      .eq("id", p.id)
      .eq("status", "aceito")
      .select("id");
    if (!ok?.length) return { ok: false, erro: "O pedido mudou. Atualize a página." };
  }
  await evento(admin, p.id, user.id, "recusar_nova_data", { caminho, saida: ctx.saida });
  await mensagem(admin, p, user.id, "O parceiro recusou a nova data.");
  await avisar(admin, p.cliente_id, "parceiro_pedido_recusado", p.id, {
    texto:
      caminho === "cancelar_remarcado"
        ? "o parceiro recusou a nova data da limpeza. O pedido foi cancelado e volta a ser feito perto da nova saída."
        : "o parceiro recusou a nova data da limpeza. O pedido voltou a esperar a resposta dele; sem resposta em 24 horas, você troca de parceiro pelo pedido.",
    url: rota(p.id),
  });
  revalidatePath(rota(p.id));
  revalidatePath("/dashboard/servicos");
  revalidatePath("/dashboard/parceiro");
  revalidatePath(`/dashboard/estadia/${p.contrato_id}`);
  return { ok: true, valor: null };
}
