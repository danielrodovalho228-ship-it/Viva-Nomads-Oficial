import "server-only";
import { cache } from "react";
import { DatabaseBackup } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { dataHoraBRT } from "@/lib/datas-brasilia";
import { estadoBackup, duracaoLegivel, type EstadoParte, type LinhaBackup } from "@/lib/backup/cartao";
import { tamanhoLegivel, LINK_RESTAURACAO } from "@/lib/backup/alarme";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const COLUNAS = "tipo, inicio, fim, ok, motivo, bytes_banco, objetos_storage, bytes_storage, duracao_restauracao_s, bytes_pasta";

/** Últimas cópias e testes de restauração (0191). null = sem cliente de serviço; "sem_tabela" = migração pendente. */
export async function lerExecucoesBackup(): Promise<LinhaBackup[] | "sem_tabela" | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const [copias, testes] = await Promise.all([
    admin.from("backups_execucoes").select(COLUNAS).eq("tipo", "copia").order("inicio", { ascending: false }).limit(20),
    admin.from("backups_execucoes").select(COLUNAS).eq("tipo", "drill").order("inicio", { ascending: false }).limit(10),
  ]);
  if (copias.error || testes.error) return "sem_tabela";
  return [...((copias.data ?? []) as LinhaBackup[]), ...((testes.data ?? []) as LinhaBackup[])];
}

/** Uma leitura por pedido: o cartão e o alerta do topo (E73) usam a mesma. */
const lerUmaVez = cache(lerExecucoesBackup);

function Estado({ ok, testId }: { ok: boolean; testId: string }) {
  // E73: "Atenção" com peso de alerta (borda grossa vermelha), e não só a letra; o fundo segue branco (regra do admin).
  return (
    <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", ok ? "border border-line bg-white text-forest" : "border-2 border-red-700 bg-white text-red-800")} data-testid={testId}>
      {ok ? "Em dia" : "Atenção"}
    </span>
  );
}

function Bloco({ titulo, parte, testId, children }: { titulo: string; parte: EstadoParte; testId: string; children: React.ReactNode }) {
  const u = parte.ultima;
  return (
    <div
      className={cn("rounded-xl border p-4", parte.vermelho ? "border-line bg-white" : "border-sage-200 bg-white")}
      data-testid={testId}
      data-estado={parte.vermelho ? "vermelho" : "verde"}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-ink">{titulo}</h3>
        <Estado ok={!parte.vermelho} testId={`${testId}-estado`} />
      </div>
      <ul className="mt-2 space-y-1 text-sm text-ink">
        <li>
          Última: {u ? `${dataHoraBRT(u.fim ?? u.inicio)} · ${u.ok ? (u.motivo ? "OK, com alerta" : "OK") : "falhou"}` : "nenhuma registrada"}
        </li>
        {children}
        {u?.motivo && (
          <li className="break-words text-red-900" data-testid={`${testId}-motivo`}>
            Motivo: {u.motivo}
          </li>
        )}
        {parte.porque && (
          <li className="font-semibold text-red-800" data-testid={`${testId}-porque`}>
            {parte.porque}
          </li>
        )}
      </ul>
    </div>
  );
}

/**
 * "Backup e recuperação" (Resiliência 2): a cópia noturna cifrada no Google Drive e o teste de restauração semanal,
 * lidos de backups_execucoes (0191) com o cliente de serviço. Vermelho se a cópia tiver mais de 36 h ou o teste mais
 * de 8 dias (ou se o último falhou). Sem dado de usuário: só datas, tamanhos, contagens e o motivo curto.
 */
export async function CartaoBackup({ agora = new Date() }: { agora?: Date }) {
  const linhas = await lerUmaVez().catch(() => "sem_tabela" as const);
  if (linhas === null) return null;
  const pendente = linhas === "sem_tabela";
  const e = estadoBackup(pendente ? [] : linhas, agora);
  const ultimaCopia = e.copia.ultima;
  const ultimoTeste = e.drill.ultima;
  return (
    <section className={cn("rounded-xl border bg-white p-4", e.vermelho ? "border-2 border-red-700" : "border-sage-200")} data-testid="cartao-backup" data-estado={e.vermelho ? "vermelho" : "verde"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-title text-lg font-semibold text-ink">
          <DatabaseBackup className="h-5 w-5 text-forest" aria-hidden /> Backup e recuperação
        </h2>
        <Estado ok={!e.vermelho} testId="cartao-backup-estado" />
      </div>
      <p className="mt-1 text-sm text-muted">
        Cópia cifrada do banco e dos arquivos no Google Drive toda noite (03:15) e teste de restauração todo domingo.
      </p>
      {pendente ? (
        <p className="mt-3 text-sm text-muted" data-testid="cartao-backup-pendente">
          Registro ainda não disponível (migração 0191 pendente).
        </p>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Bloco titulo="Cópia noturna" parte={e.copia} testId="backup-copia">
            {ultimaCopia && (
              <li>
                Banco: {tamanhoLegivel(ultimaCopia.bytes_banco)} · Arquivos: {ultimaCopia.objetos_storage ?? "—"} ({tamanhoLegivel(ultimaCopia.bytes_storage)})
              </li>
            )}
            {e.copia.ultimaOk && e.copia.ultimaOk !== ultimaCopia && <li>Última que deu certo: {dataHoraBRT(e.copia.ultimaOk.fim ?? e.copia.ultimaOk.inicio)}</li>}
          </Bloco>
          <Bloco titulo="Teste de restauração" parte={e.drill} testId="backup-teste">
            {ultimoTeste && <li>Duração da restauração: {duracaoLegivel(ultimoTeste.duracao_restauracao_s)}</li>}
            {e.drill.ultimaOk && e.drill.ultimaOk !== ultimoTeste && <li>Último que deu certo: {dataHoraBRT(e.drill.ultimaOk.fim ?? e.drill.ultimaOk.inicio)}</li>}
          </Bloco>
        </div>
      )}
      {e.bytesPasta !== null && (
        <p className={cn("mt-3 text-sm", e.avisoGoogleOne ? "font-semibold text-red-800" : "text-ink")} data-testid="cartao-backup-pasta">
          Pasta no Google Drive: {tamanhoLegivel(e.bytesPasta)} de 15 GB grátis.
          {e.avisoGoogleOne && " Passou de 10 GB: avalie o Google One."}
        </p>
      )}
      <div className="mt-4">
        <ButtonLink href={LINK_RESTAURACAO} variant="secondary" size="sm" target="_blank" rel="noopener noreferrer" data-testid="cartao-backup-restauracao">
          Passo a passo de restauração
        </ButtonLink>
      </div>
    </section>
  );
}

