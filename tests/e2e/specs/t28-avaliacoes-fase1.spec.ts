import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { account, hasAccount, type Role } from "../fixtures/accounts";

/**
 * T28 — AVALIAÇÕES, FASE 1 (0089). Direto no PostgREST, como cada pessoa:
 *  - quem NÃO é parte do contrato não avalia;
 *  - a parte avalia UMA vez; fora dos 14 dias depois do fim, não;
 *  - anon não vê nada antes de publicar e nunca vê as notas privadas;
 *  - às cegas: a do inquilino só aparece quando o proprietário também envia;
 *  - comentário com telefone vai para moderação (não publica);
 *  - enviada não muda; o avaliado lê a nota privada depois de publicada;
 *  - a página do imóvel mostra a avaliação publicada ("Inquilino verificado").
 */
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const temEnv = !!URL && !!ANON && !!SERVICE && hasAccount("inquilino") && hasAccount("inquilino2") && hasAccount("proprietario");

const cliente = (chave = ANON!): SupabaseClient => createClient(URL!, chave, { auth: { persistSession: false } });
async function logado(papel: Role): Promise<{ sb: SupabaseClient; id: string }> {
  const sb = cliente();
  const a = account(papel);
  const { data, error } = await sb.auth.signInWithPassword({ email: a.email, password: a.senha });
  if (error) throw new Error(`Login da conta de teste falhou: ${error.message}`);
  return { sb, id: data.user!.id };
}

test.describe("T28 — Avaliações fase 1 (0089)", () => {
  test.skip(!temEnv, "Sem URL/chaves do Supabase ou contas de teste.");

  test("só parte avalia, uma vez, em 14 dias; às cegas; moderação; notas privadas protegidas", async ({ page }) => {
    const adm = cliente(SERVICE!);
    const inq = await logado("inquilino");
    const outro = await logado("inquilino2");
    const dono = await logado("proprietario");
    const { data: imovel } = await adm.from("properties").select("id").eq("owner_id", dono.id).eq("status", "active").limit(1).single();
    const base = { property_id: imovel!.id, tenant_id: inq.id, owner_plan: "essential", faixa: "temporada", prazo_total_dias: 60, aluguel_mensal: 3000, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 240, qtd_ocupantes: 1, status: "concluido", garantia: "caucao" };
    const dia = 24 * 3600_000;
    const { data: ct, error: e1 } = await adm.from("contratos").insert({ ...base, encerrado_em: new Date(Date.now() - dia).toISOString() }).select("id").single();
    expect(e1).toBeNull();
    const { data: velho } = await adm.from("contratos").insert({ ...base, encerrado_em: new Date(Date.now() - 20 * dia).toISOString() }).select("id").single();
    // Só letras: número longo no comentário cai (com razão) no filtro de telefone.
    const marca = `T28 ${Array.from({ length: 8 }, () => "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)]).join("")}`;
    try {
      const nova = (contrato: string, alvo: string, extra: Record<string, unknown> = {}) => ({ contrato_id: contrato, alvo_id: alvo, papel_autor: "inquilino", nota_geral: 5, status: "enviada", ...extra });

      // 1) quem não é parte não avalia
      const naoParte = await outro.sb.from("avaliacoes").insert(nova(ct!.id, dono.id));
      expect(naoParte.error, "não-parte conseguiu avaliar").not.toBeNull();

      // 2) a parte avalia UMA vez (o autor é sempre quem está logado)
      const ok = await inq.sb.from("avaliacoes").insert(nova(ct!.id, dono.id, { comentario_publico: `Imóvel impecável ${marca}`, nota_privada_parte: "o chuveiro pinga", nota_privada_viva: "tudo certo" })).select("status, papel_autor").single();
      expect(ok.error).toBeNull();
      expect(ok.data).toEqual({ status: "enviada", papel_autor: "inquilino" });
      const dup = await inq.sb.from("avaliacoes").insert(nova(ct!.id, dono.id));
      expect(dup.error?.code).toBe("23505");
      // não pode se dar status de publicada
      const pub = await inq.sb.from("avaliacoes").insert(nova(velho!.id, dono.id, { status: "publicada" }));
      expect(pub.error).not.toBeNull();

      // 3) fora dos 14 dias depois do fim
      const tarde = await inq.sb.from("avaliacoes").insert(nova(velho!.id, dono.id));
      expect(tarde.error, "avaliou fora do prazo").not.toBeNull();

      // 4) anon: nada antes de publicar; notas privadas nunca
      const anon = cliente();
      expect((await anon.from("avaliacoes").select("id").eq("contrato_id", ct!.id)).data).toEqual([]);
      const privada = await anon.from("avaliacoes").select("nota_privada_parte").limit(1);
      expect(privada.error?.message ?? "").toMatch(/permission denied/);

      // enviada não muda (nem a nota, nem apagar)
      await inq.sb.from("avaliacoes").update({ nota_geral: 1 }).eq("contrato_id", ct!.id);
      await inq.sb.from("avaliacoes").delete().eq("contrato_id", ct!.id);
      const { data: intacta } = await adm.from("avaliacoes").select("nota_geral, status").eq("contrato_id", ct!.id).eq("autor_id", inq.id).single();
      expect(intacta).toEqual({ nota_geral: 5, status: "enviada" });

      // 5) o proprietário avalia com telefone → moderação; a do inquilino publica (às cegas)
      const comTelefone = await dono.sb
        .from("avaliacoes")
        .insert({ contrato_id: ct!.id, alvo_id: inq.id, papel_autor: "proprietario", nota_geral: 4, comentario_publico: "ótima inquilina, me chama no whats 34 99999-1234", status: "enviada" })
        .select("status")
        .single();
      expect(comTelefone.error).toBeNull();
      expect(comTelefone.data!.status).toBe("em_moderacao");
      const visiveis = (await anon.from("avaliacoes").select("papel_autor, status, comentario_publico").eq("contrato_id", ct!.id)).data!;
      expect(visiveis).toEqual([{ papel_autor: "inquilino", status: "publicada", comentario_publico: `Imóvel impecável ${marca}` }]);

      // 6) o avaliado lê a nota privada depois de publicada; a nota para a Viva não sai
      const recebidas = (await dono.sb.rpc("avaliacoes_recebidas")).data as { nota_privada_parte: string; nota_privada_viva?: string }[];
      const minha = recebidas.find((r) => r.nota_privada_parte === "o chuveiro pinga");
      expect(minha).toBeTruthy();
      expect(minha).not.toHaveProperty("nota_privada_viva");
      expect((await inq.sb.rpc("avaliacoes_recebidas")).data).toEqual([]); // a do dono está em moderação

      // 7) a página do imóvel mostra a avaliação publicada, sem nome digitado
      await page.goto(`/imoveis/${imovel!.id}`, { waitUntil: "networkidle" });
      await expect(page.getByText(`Imóvel impecável ${marca}`)).toBeVisible();
      await expect(page.getByText("Inquilino verificado").first()).toBeVisible();
    } finally {
      await adm.from("contratos").delete().in("id", [ct!.id, velho!.id]);
    }
  });

  test("tabelas antigas não existem mais; anon não escreve em avaliacoes", async () => {
    const anon = cliente();
    for (const t of ["reviews", "property_reviews"]) {
      const r = await anon.from(t).select("id").limit(1);
      expect(r.error, `${t} ainda existe`).not.toBeNull();
    }
    const ins = await anon.from("avaliacoes").insert({ nota_geral: 5 });
    expect(ins.error?.message ?? "").toMatch(/permission denied/);
  });
});
