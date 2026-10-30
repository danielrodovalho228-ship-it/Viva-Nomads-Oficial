import type { SupabaseClient } from "@supabase/supabase-js";
import { getProperty } from "@/lib/data/properties";
import { calcularTotalMensal, totalMesDaLinha } from "@/lib/precos";
import { blocoDados } from "@/lib/notifications/modelo-email";
import { escaparHtml } from "@/lib/escapar-html";
import { aberturaCandidatura, linhasCandidatura, proximoPassoCandidatura, type MomentoCandidatura } from "@/lib/notifications/dados-candidatura";

/**
 * E202 (candidatura): o corpo dos três e-mails da candidatura — abertura com o imóvel, o quadro (imóvel · interessado ·
 * entrada/saída · valor mensal · total por mês · total da estadia) e o próximo passo. Lê pelo SERVIDOR (service role):
 * as datas do lead não entram no SELECT por coluna do usuário (0062). Sem dado, devolve null e o e-mail sai como antes.
 */
export async function corpoDoEmailDaCandidatura(admin: SupabaseClient, leadId: string, momento: MomentoCandidatura) {
  const { data: lead } = await admin.from("leads").select("property_id, tenant_id, inicio_desejado, fim_desejado").eq("id", leadId).maybeSingle();
  if (!lead) return null;
  const [{ data: im }, { data: quem }] = await Promise.all([
    admin.from("properties").select("title, address, city, monthly_price, condo_fee, utilities_mode, utilities_estimate").eq("id", lead.property_id).maybeSingle(),
    admin.from("profiles").select("full_name").eq("id", lead.tenant_id).maybeSingle(),
  ]);
  if (!im) return null;
  // O "Total por mês" é o mesmo da tela do Solicitar (calcularTotalMensal, com a limpeza da estadia); anúncio fora do ar
  // cai na conta da linha (aluguel + condomínio + contas).
  const publico = await getProperty(lead.property_id as string).catch(() => undefined);
  const totalMensal = publico ? calcularTotalMensal(publico).total : totalMesDaLinha(im);
  const imovel = { titulo: (im.title as string | null) ?? null, bairro: (im.address as string | null) ?? null, cidade: (im.city as string | null) ?? null };
  // Primeiro nome só (o contato nunca sai; o nome completo é revelado ao dono depois do aceite, na tela).
  const interessado = String((quem?.full_name as string | null) ?? "").includes("@") ? "" : String(quem?.full_name ?? "").trim().split(/\s+/)[0] ?? "";
  const linhas = linhasCandidatura({
    imovel,
    interessado,
    entrada: (lead.inicio_desejado as string | null) ?? null,
    saida: (lead.fim_desejado as string | null) ?? null,
    valorMensal: Number(im.monthly_price ?? 0),
    totalMensal,
  });
  const passo = proximoPassoCandidatura(momento);
  return {
    body: (nome?: string) => aberturaCandidatura(momento, { nome, imovel, interessado }),
    detailsHtml: blocoDados(linhas.map((l) => ({ rotulo: escaparHtml(l.rotulo), valor: escaparHtml(l.valor) }))) + `<p>${escaparHtml(passo)}</p>`,
    detailsText: [...linhas.map((l) => `${l.rotulo}: ${l.valor}`), passo].join("\n"),
  };
}
