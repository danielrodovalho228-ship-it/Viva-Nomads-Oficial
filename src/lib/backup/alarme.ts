/*
  Resiliência 2 — quando a cópia noturna ou o teste de restauração viram alarme, e o texto do e-mail ao Daniel (puro).
  Alarmes: (1) a execução falhou; (2) o dump do banco ficou com menos da metade do tamanho da cópia anterior;
  (3) os objetos do storage caíram mais de 20% de uma noite para a outra. O motivo nunca leva dado: só a etapa, números
  e os links da execução e do passo a passo. O aviso no admin é a própria linha ok=false em backups_execucoes.
  Roda: node --test src/lib/backup/backup.test.ts
*/
import { escaparHtml } from "../escapar-html.ts";
import { dataHoraBRT } from "../datas-brasilia.ts";

export type TipoExecucao = "copia" | "drill";

export const REPO_URL = "https://github.com/danielrodovalho228-ship-it/Viva-Nomads-Oficial";
export const LINK_RESTAURACAO = `${REPO_URL}/blob/main/docs/RESTAURACAO.md`;

export const NOME_EXECUCAO: Record<TipoExecucao, string> = {
  copia: "Cópia noturna",
  drill: "Teste de restauração",
};

export interface Execucao {
  tipo: TipoExecucao;
  ok: boolean;
  motivo?: string | null;
  bytesBanco?: number | null;
  objetosStorage?: number | null;
}

export interface Anterior {
  bytesBanco?: number | null;
  objetosStorage?: number | null;
}

export function tamanhoLegivel(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return "—";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${i === 0 ? v : v.toFixed(v >= 10 ? 0 : 1).replace(".", ",")} ${u[i]}`;
}

/**
 * Motivo curto e SEM dado: tira URLs (podem levar credencial), e-mails e sequências longas de dígitos (CPF, telefone),
 * junta espaços e corta em 200 caracteres. É a última barreira: os scripts já só escrevem motivos fixos.
 */
export function motivoSeguro(m: string | null | undefined): string | null {
  if (!m) return null;
  const limpo = m
    .replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, "[link]")
    .replace(/[^\s@]+@[^\s@]+/g, "[e-mail]")
    .replace(/\(?\d[\d.\-() ]{8,}\d/g, "[número]")
    .replace(/\s+/g, " ")
    .trim();
  return limpo ? limpo.slice(0, 200) : null;
}

/** Os motivos de alarme desta execução (vazio = sem alarme). */
export function motivosDeAlarme(atual: Execucao, anterior: Anterior | null): string[] {
  const motivos: string[] = [];
  if (!atual.ok) motivos.push(`Falhou: ${motivoSeguro(atual.motivo) ?? "sem motivo registrado"}.`);
  if (atual.tipo === "copia" && atual.ok && anterior) {
    const a = anterior.bytesBanco;
    const b = atual.bytesBanco;
    if (a && b !== null && b !== undefined && b < a * 0.5) {
      motivos.push(`O dump do banco ficou com menos da metade do tamanho da cópia anterior (${tamanhoLegivel(a)} → ${tamanhoLegivel(b)}).`);
    }
    const oa = anterior.objetosStorage;
    const ob = atual.objetosStorage;
    if (oa && ob !== null && ob !== undefined && ob < oa * 0.8) {
      motivos.push(`Os objetos do storage caíram mais de 20% de uma noite para a outra (${oa} → ${ob}).`);
    }
  }
  return motivos;
}

export interface Alarme {
  assunto: string;
  texto: string;
  html: string;
}

/** O e-mail do alarme. `linkExecucao`: a página da execução no GitHub Actions (sem credencial). */
export function montarAlarme(o: { tipo: TipoExecucao; motivos: string[]; quando: Date; linkExecucao?: string | null }): Alarme {
  const nome = NOME_EXECUCAO[o.tipo];
  const motivos = o.motivos.map((m) => motivoSeguro(m) ?? "").filter(Boolean);
  const quando = dataHoraBRT(o.quando);
  const link = o.linkExecucao && /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/actions\/runs\/\d+$/.test(o.linkExecucao) ? o.linkExecucao : null;
  const oQueFazer =
    o.tipo === "copia"
      ? "Abra a execução no GitHub para ver a etapa que falhou e rode de novo (Actions › Backup noturno › Run workflow). Se repetir, veja o passo a passo."
      : "Abra a execução no GitHub para ver o que não bateu. A cópia pode não voltar inteira: rode o teste de novo e, se repetir, veja o passo a passo.";
  const assunto = `[Viva Nomads] Alarme do backup: ${nome.toLowerCase()} com problema`;
  const texto = [
    `O que aconteceu em ${quando}:`,
    ...motivos.map((m) => `• ${m}`),
    "",
    `O que fazer: ${oQueFazer}`,
    link ? `Execução: ${link}` : null,
    `Passo a passo de restauração: ${LINK_RESTAURACAO}`,
    "O cartão “Backup e recuperação” do /admin mostra o mesmo aviso.",
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
  const html =
    `<p><strong>O que aconteceu</strong> em ${escaparHtml(quando)}:</p><ul>` +
    motivos.map((m) => `<li>${escaparHtml(m)}</li>`).join("") +
    `</ul><p><strong>O que fazer:</strong> ${escaparHtml(oQueFazer)}</p>` +
    (link ? `<p><a href="${escaparHtml(link)}">Abrir a execução no GitHub</a></p>` : "") +
    `<p><a href="${escaparHtml(LINK_RESTAURACAO)}">Passo a passo de restauração</a></p>` +
    `<p>O cartão “Backup e recuperação” do /admin mostra o mesmo aviso.</p>`;
  return { assunto, texto, html };
}
