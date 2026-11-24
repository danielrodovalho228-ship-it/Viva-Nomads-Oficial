import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { account, hasAccount } from "../fixtures/accounts";
import { criteriosDaAvaliacao } from "../fixtures/avaliacao-criterios";
import { entrar } from "../fixtures/laboratorio";

/**
 * T1588 — GUARDA DO E719 (#3398, merge na main em 09/11): o cartão do contrato lê o estado REAL da avaliação.
 * Uma avaliação PUBLICADA tira o "Aguardando a outra parte" e o cartão passa a dizer "Publicada"; uma só ENVIADA continua
 * "Aguardando a outra parte" (a regra às cegas fica intacta); e quem já avaliou não recebe o formulário de novo.
 * Cenário: dois contratos encerrados ontem (dentro da janela de 14 dias) entre o inquilino e o proprietário da massa; a
 * avaliação do inquilino num deles é gravada como publicada, no outro como enviada (service role, como nos t28/t304).
 * Só no laboratório; os contratos criados aqui são apagados no fim.
 */
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const temEnv = !!URL && !!ANON && !!SERVICE && hasAccount("inquilino") && hasAccount("proprietario");

const dia = 24 * 3600_000;

test.describe("T1588 — E719: o cartão do contrato acompanha o estado real da avaliação", () => {
  test.skip(!temEnv, "Sem URL/chaves do Supabase ou contas de teste.");

  test("publicada → 'Publicada' (sem 'Aguardando'); enviada → 'Aguardando a outra parte'; sem formulário de novo", async ({ browser }) => {
    test.setTimeout(120_000);
    const adm: SupabaseClient = createClient(URL!, SERVICE!, { auth: { persistSession: false } });
    const inq = account("inquilino");
    const dono = account("proprietario");
    // Os ids vêm do login de cada conta (como no t28): não depende de coluna de e-mail em profiles.
    const idDe = async (e: { email: string; senha: string }) => {
      const sb = createClient(URL!, ANON!, { auth: { persistSession: false } });
      const { data, error } = await sb.auth.signInWithPassword({ email: e.email, password: e.senha });
      if (error) throw new Error(`Login da conta de teste falhou: ${error.message}`);
      return data.user!.id;
    };
    const pi = { id: await idDe(inq) };
    const pd = { id: await idDe(dono) };
    const { data: imovel } = await adm.from("properties").select("id").eq("owner_id", pd.id).eq("status", "active").limit(1).single();
    expect(imovel?.id, "imóvel ativo do proprietário da massa").toBeTruthy();
    const base = {
      property_id: imovel!.id, tenant_id: pi.id, owner_plan: "essential", faixa: "temporada", prazo_total_dias: 60, aluguel_mensal: 3000,
      tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 240, qtd_ocupantes: 1, status: "concluido", garantia: "caucao",
      encerrado_em: new Date(Date.now() - dia).toISOString(),
    };
    const { data: publicadaCt, error: e1 } = await adm.from("contratos").insert(base).select("id").single();
    expect(e1).toBeNull();
    const { data: enviadaCt, error: e2 } = await adm.from("contratos").insert(base).select("id").single();
    expect(e2).toBeNull();
    const ids = [publicadaCt!.id, enviadaCt!.id];
    try {
      const nova = (contrato: string, status: string) => ({
        ...criteriosDaAvaliacao("inquilino"), contrato_id: contrato, alvo_id: pd.id, autor_id: pi.id, papel_autor: "inquilino", nota_geral: 5, status,
      });
      const a = await adm.from("avaliacoes").insert(nova(publicadaCt!.id, "publicada"));
      expect(a.error, "gravar a avaliação publicada").toBeNull();
      const b = await adm.from("avaliacoes").insert(nova(enviadaCt!.id, "enviada"));
      expect(b.error, "gravar a avaliação enviada").toBeNull();

      const page = await entrar(browser, inq.email, inq.senha);
      try {
        await page.goto("/dashboard/locacoes", { waitUntil: "domcontentloaded" });
        const partes = page.getByTestId("avaliacao-partes");
        await expect(partes.first()).toBeVisible({ timeout: 30_000 });

        const publicadas = page.locator('[data-testid="avaliacao-partes"][data-estado="publicada"]');
        const aguardando = page.locator('[data-testid="avaliacao-partes"][data-estado="aguardando"]');
        expect(await publicadas.count(), "pelo menos um cartão com a avaliação publicada").toBeGreaterThanOrEqual(1);
        expect(await aguardando.count(), "pelo menos um cartão com a avaliação só enviada").toBeGreaterThanOrEqual(1);

        // Publicada: diz "Publicada" e NUNCA "Aguardando a outra parte" nem "Fica fechada".
        for (const p of await publicadas.all()) {
          await expect(p).toContainText("Publicada");
          await expect(p).not.toContainText("Aguardando a outra parte");
          await expect(p).not.toContainText("Fica fechada");
        }
        // Enviada: a regra às cegas segue como era.
        for (const p of await aguardando.all()) await expect(p).toContainText("Aguardando a outra parte");
        // Quem já avaliou não recebe o formulário de novo: o cartão não tem os critérios para preencher.
        for (const p of await publicadas.all()) {
          const cartao = p.locator("xpath=ancestor::*[self::section or self::article or self::div][.//*[@data-testid='avaliacao-partes']][1]");
          await expect(cartao.getByTestId("avaliacao-criterios")).toHaveCount(0);
        }
      } finally {
        await page.context().close();
      }
    } finally {
      await adm.from("avaliacoes").delete().in("contrato_id", ids);
      await adm.from("contratos").delete().in("id", ids);
    }
  });
});
