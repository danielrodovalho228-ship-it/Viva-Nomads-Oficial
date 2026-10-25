/*
  Resiliência 2 — estado do cartão "Backup e recuperação" do /admin (puro). Lê as últimas linhas de backups_execucoes:
   • cópia: vermelho se a última tentativa falhou ou se a última cópia OK tem mais de 36 h (ou nunca houve);
   • teste de restauração: vermelho se o último falhou ou se o último OK tem mais de 8 dias (ou nunca houve);
   • total usado na pasta do Drive: acima de 10 GB, sugere avaliar o Google One (15 GB grátis).
  Roda: node --test src/lib/backup/backup.test.ts
*/

export const LIMITE_COPIA_H = 36;
export const LIMITE_DRILL_DIAS = 8;
export const AVISO_PASTA_BYTES = 10 * 1024 ** 3;

export interface LinhaBackup {
  tipo: "copia" | "drill";
  inicio: string;
  fim: string | null;
  ok: boolean;
  motivo: string | null;
  bytes_banco: number | null;
  objetos_storage: number | null;
  bytes_storage: number | null;
  duracao_restauracao_s: number | null;
  bytes_pasta: number | null;
}

export interface EstadoParte {
  /** Última tentativa (OK ou não). */
  ultima: LinhaBackup | null;
  /** Última que deu certo. */
  ultimaOk: LinhaBackup | null;
  vermelho: boolean;
  /** Por que está vermelho, em português simples (sem dado). */
  porque: string | null;
}

export interface EstadoBackup {
  copia: EstadoParte;
  drill: EstadoParte;
  vermelho: boolean;
  /** Total usado na pasta do Drive, da cópia mais recente que mediu. */
  bytesPasta: number | null;
  avisoGoogleOne: boolean;
}

const quando = (l: LinhaBackup) => new Date(l.fim ?? l.inicio).getTime();

function parte(
  linhas: LinhaBackup[],
  tipo: "copia" | "drill",
  limiteMs: number,
  agora: Date,
  rotulo: { nunca: string; velho: string; falhou: string; alerta: string },
): EstadoParte {
  const minhas = linhas.filter((l) => l.tipo === tipo).sort((a, b) => new Date(b.inicio).getTime() - new Date(a.inicio).getTime());
  const ultima = minhas[0] ?? null;
  const ultimaOk = minhas.find((l) => l.ok) ?? null;
  let porque: string | null = null;
  if (!ultimaOk) porque = rotulo.nunca;
  else if (agora.getTime() - quando(ultimaOk) > limiteMs) porque = rotulo.velho;
  if (ultima && ultima.ok && ultima.motivo) porque = rotulo.alerta;
  if (ultima && !ultima.ok) porque = rotulo.falhou;
  return { ultima, ultimaOk, vermelho: porque !== null, porque };
}

export function estadoBackup(linhas: readonly LinhaBackup[], agora: Date): EstadoBackup {
  const l = [...linhas];
  const copia = parte(l, "copia", LIMITE_COPIA_H * 3_600_000, agora, {
    nunca: "Nenhuma cópia concluída ainda.",
    velho: `A última cópia tem mais de ${LIMITE_COPIA_H} h.`,
    falhou: "A última cópia falhou.",
    alerta: "A última cópia terminou com alerta.",
  });
  const drill = parte(l, "drill", LIMITE_DRILL_DIAS * 86_400_000, agora, {
    nunca: "Nenhum teste de restauração concluído ainda.",
    velho: `O último teste de restauração tem mais de ${LIMITE_DRILL_DIAS} dias.`,
    falhou: "O último teste de restauração falhou.",
    alerta: "O último teste de restauração terminou com alerta.",
  });
  const comPasta = l
    .filter((x) => x.tipo === "copia" && x.bytes_pasta !== null)
    .sort((a, b) => new Date(b.inicio).getTime() - new Date(a.inicio).getTime())[0];
  const bytesPasta = comPasta?.bytes_pasta ?? null;
  return { copia, drill, vermelho: copia.vermelho || drill.vermelho, bytesPasta, avisoGoogleOne: bytesPasta !== null && bytesPasta > AVISO_PASTA_BYTES };
}

/** "4 min 12 s" / "38 s" / "1 h 02 min". */
export function duracaoLegivel(s: number | null | undefined): string {
  if (s === null || s === undefined || !Number.isFinite(s) || s < 0) return "—";
  const t = Math.round(s);
  if (t < 60) return `${t} s`;
  if (t < 3600) return `${Math.floor(t / 60)} min ${String(t % 60).padStart(2, "0")} s`;
  return `${Math.floor(t / 3600)} h ${String(Math.floor((t % 3600) / 60)).padStart(2, "0")} min`;
}
