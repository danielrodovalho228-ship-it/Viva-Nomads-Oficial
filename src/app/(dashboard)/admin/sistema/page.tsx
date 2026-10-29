import * as flags from "@/lib/flags";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { ChaveSmsPainel } from "@/components/admin/chave-sms";
import { ParceiroGeralForm } from "@/components/admin/parceiro-geral-form";
import { PainelIaCadastro } from "@/components/admin/painel-ia-cadastro";
import { ContadorDeteccao } from "@/components/admin/contador-deteccao";
import { CartaoBackup } from "@/components/admin/cartao-backup";
import { CartaoEntradaEmail } from "@/components/admin/cartao-entrada-email";
import { CartaoMapas } from "@/components/admin/cartao-mapas";
import { CartaoPush } from "@/components/admin/cartao-push";
import { lerParceiroGeral } from "@/lib/parceiros/regras";
import { dataHoraBRT } from "@/lib/datas-brasilia";
import { CHAVES_AMBIENTE, ONDE_MUDA_AMBIENTE } from "@/config/chaves-ambiente";
import { rotuloDoAdmin, tituloDoAdmin } from "@/config/menu-admin";
import { PortaQaPainel } from "@/components/admin/porta-qa";
import { createClient } from "@/lib/supabase/server";
import { ehObservadorQa, MSG_OBSERVADOR } from "@/lib/qa/observador";

export const metadata = { title: tituloDoAdmin("/admin/sistema"), robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type LinhaChave = { chave: string; ligada: boolean; ligada_em: string | null; alterada_em: string | null; alterada_por: string | null; valor: unknown };

/**
 * ADMIN-3 — Admin → Sistema ("Chaves e integrações"). Três blocos:
 *  (a) chaves da PLATAFORMA (chaves_plataforma: SMS_ATIVO e PARCEIRO_GERAL_FALLBACK) — mudam aqui, com confirmação na
 *      página, pelas ações que já existiam; mostra quando e quem mudou;
 *  (b) chaves de AMBIENTE (src/lib/flags.ts) — só leitura, com rótulo e "Muda na Vercel (Daniel)"; nenhum botão e
 *      nunca o valor de um segredo (só ligada/desligada);
 *  (c) saúde: IA, Detecção, Backup, E-mail, Mapas e Push (saíram da inicial do /admin, sem mudar a lógica).
 * O layout de /admin exige admin.
 */
export default async function AdminSistemaPage() {
  const admin = createAdminClient();
  const { data } = admin ? await admin.from("chaves_plataforma").select("chave, ligada, ligada_em, alterada_em, alterada_por, valor").in("chave", ["SMS_ATIVO", "PARCEIRO_GERAL_FALLBACK"]) : { data: null };
  const linhas = (data ?? []) as LinhaChave[];
  const ids = [...new Set(linhas.map((l) => l.alterada_por).filter((x): x is string => !!x))];
  const { data: perfis } = admin && ids.length ? await admin.from("profiles").select("id, full_name").in("id", ids) : { data: null };
  const nome = new Map(((perfis ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name?.trim() || "alguém da equipe"]));
  const linha = (chave: string) => linhas.find((l) => l.chave === chave) ?? null;
  const sms = linha("SMS_ATIVO");
  const geral = linha("PARCEIRO_GERAL_FALLBACK");
  const quem = (l: LinhaChave | null) => (l?.alterada_por ? (nome.get(l.alterada_por) ?? "alguém da equipe") : null);
  const valores = flags as unknown as Record<string, boolean>;
  // QA-LOGIN-B v2: o admin observador da QA vê o estado das chaves, mas sem os botões, e não vê o cartão de backup.
  const supabase = await createClient();
  const observador = await ehObservadorQa(supabase ? (await supabase.auth.getUser()).data.user?.id : null);

  return (
    <div data-testid="admin-sistema">
      <PageTitle title={rotuloDoAdmin("/admin/sistema")} subtitle="Chaves da plataforma, chaves de ambiente e a saúde das integrações." />

      <section id="chaves" className="scroll-mt-24" aria-labelledby="sistema-chaves-titulo">
        <h2 id="sistema-chaves-titulo" className="mb-3 font-title text-lg font-semibold text-ink">
          Chaves da plataforma
        </h2>
        {observador ? (
          <p className="mb-3 text-sm text-muted" data-testid="chaves-observador">
            SMS: {sms?.ligada ? "ligada" : "desligada"}. {MSG_OBSERVADOR}
          </p>
        ) : (
          <ChaveSmsPainel ligada={sms?.ligada === true} ligadaEm={sms?.ligada_em ?? null} quem={quem(sms)} />
        )}
        <Panel title="Cartão do parceiro geral na busca vazia (chave PARCEIRO_GERAL_FALLBACK)" className="mb-6" data-testid="chave-parceiro-geral">
          <p className="mb-3 text-sm text-ink" data-testid="chave-parceiro-geral-estado">
            {geral?.ligada ? `Ligada${geral.ligada_em ? ` desde ${dataHoraBRT(geral.ligada_em)}` : ""}` : "Desligada"}
            {quem(geral) ? ` · mudada por ${quem(geral)}` : ""}
          </p>
          {observador ? null : <ParceiroGeralForm inicial={lerParceiroGeral(geral?.valor, geral?.ligada === true)} />}
        </Panel>
      </section>

      <PortaQaPainel />

      <Panel title="Chaves de ambiente" className="mb-6" data-testid="chaves-ambiente">
        <p className="mb-3 text-sm text-muted">Só leitura. Cada uma liga ou desliga na Vercel; esta tela não muda nenhuma.</p>
        <ul className="divide-y divide-line text-sm">
          {CHAVES_AMBIENTE.map((c) => (
            <li key={c.nome} className="flex flex-wrap items-center justify-between gap-2 py-2" data-testid="chave-ambiente" data-nome={c.nome}>
              <span className="min-w-0">
                <span className="block font-semibold text-ink">{c.rotulo}</span>
                <span className="block break-all text-xs text-muted">
                  {c.variavel} · {ONDE_MUDA_AMBIENTE}
                </span>
              </span>
              <span className="rounded-full border border-line bg-white px-2 py-1 text-xs font-semibold text-ink" data-ligada={valores[c.nome] ? "1" : "0"}>
                {valores[c.nome] ? "Ligada" : "Desligada"}
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <section aria-labelledby="sistema-saude-titulo">
        <h2 id="sistema-saude-titulo" className="mb-3 font-title text-lg font-semibold text-ink">
          Saúde das integrações
        </h2>
        <div id="ia" className="scroll-mt-24">
          <PainelIaCadastro />
        </div>
        <div id="deteccao" className="mt-6 scroll-mt-24">
          <ContadorDeteccao />
        </div>
        <div id="backup" className="mt-6 scroll-mt-24">
          {observador ? null : <CartaoBackup />}
        </div>
        <div id="entrada-email" className="mt-6 scroll-mt-24">
          <CartaoEntradaEmail />
        </div>
        <div id="mapas" className="mt-6 scroll-mt-24">
          <CartaoMapas />
        </div>
        <div id="push" className="mt-6 scroll-mt-24">
          <CartaoPush />
        </div>
      </section>
    </div>
  );
}
