import "server-only";
import Link from "next/link";
import { ArrowRight, DatabaseBackup } from "lucide-react";
import { dataHoraBRT } from "@/lib/datas-brasilia";
import { estadoBackup } from "@/lib/backup/cartao";
import { lerExecucoesBackup } from "@/components/admin/cartao-backup";
import { Panel } from "@/components/dashboard/primitives";
import { cn } from "@/lib/utils";

/**
 * E766 — a prova VISUAL de que o backup está saudável, na inicial do /admin: "Última cópia OK em X" e "Último teste de
 * restauração OK em Y" (de backups_execucoes, a mesma leitura e o mesmo estado do cartão completo de /admin/sistema).
 * Quando falha, mostra "Atenção" com o porquê (sem dado de usuário). O detalhe fica no cartão de Sistema.
 * E766 (reprova de 11/11): também o admin OBSERVADOR da QA vê este resumo (só leitura); em /admin/sistema#backup ele o vê
 * no lugar do cartão completo, e aí sem o "Ver detalhes" (`semDetalhe`), que apontaria para a própria seção.
 */
export async function ResumoBackup({ agora = new Date(), semDetalhe = false }: { agora?: Date; semDetalhe?: boolean }) {
  const linhas = await lerExecucoesBackup().catch(() => "sem_tabela" as const);
  if (linhas === null) return null;
  const pendente = linhas === "sem_tabela";
  const e = estadoBackup(pendente ? [] : linhas, agora);
  const copiaOk = e.copia.ultimaOk;
  const drillOk = e.drill.ultimaOk;
  return (
    <Panel title="Backup" className="mt-6" data-testid="admin-backup-resumo" data-estado={pendente ? "pendente" : e.vermelho ? "vermelho" : "verde"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm text-muted">
          <DatabaseBackup className="h-4 w-4 text-forest" aria-hidden /> Cópia cifrada toda noite e teste de restauração todo domingo.
        </span>
        <span
          className={cn("rounded-full px-3 py-1 text-xs font-semibold", e.vermelho || pendente ? "border-2 border-red-700 bg-white text-red-800" : "border border-line bg-white text-forest")}
          data-testid="admin-backup-estado"
        >
          {pendente ? "Sem registro" : e.vermelho ? "Atenção" : "Em dia"}
        </span>
      </div>
      {pendente ? (
        <p className="mt-3 text-sm text-muted" data-testid="admin-backup-pendente">
          Registro ainda não disponível (migração 0191 pendente).
        </p>
      ) : (
        <ul className="mt-3 space-y-1 text-sm text-ink">
          <li data-testid="admin-backup-copia">{copiaOk ? `Última cópia OK em ${dataHoraBRT(copiaOk.fim ?? copiaOk.inicio)}` : "Nenhuma cópia OK registrada"}</li>
          <li data-testid="admin-backup-drill">{drillOk ? `Último teste de restauração OK em ${dataHoraBRT(drillOk.fim ?? drillOk.inicio)}` : "Nenhum teste de restauração OK registrado"}</li>
          {e.copia.porque && (
            <li className="font-semibold text-red-800" data-testid="admin-backup-porque-copia">
              {e.copia.porque}
            </li>
          )}
          {e.drill.porque && (
            <li className="font-semibold text-red-800" data-testid="admin-backup-porque-drill">
              {e.drill.porque}
            </li>
          )}
        </ul>
      )}
      {semDetalhe ? null : (
        <Link href="/admin/sistema#backup" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-forest underline" data-testid="admin-backup-detalhe">
          Ver detalhes <ArrowRight className="ml-1 h-4 w-4" aria-hidden />
        </Link>
      )}
    </Panel>
  );
}
