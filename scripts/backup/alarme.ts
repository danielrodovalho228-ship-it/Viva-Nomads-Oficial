// Resiliência 2 — alarme da cópia noturna e do teste de restauração (lógica pura em src/lib/backup/alarme.ts).
//   node scripts/backup/alarme.ts avaliar <copia|drill> <pasta>   → grava alarme_motivos.json (lista de textos sem dado)
//   node scripts/backup/alarme.ts enviar  <copia|drill> <pasta>   → e-mail ao Daniel pelo Resend (remetente único)
// Quem recebe: os admins com profiles.recebe_avisos_ceo (o mesmo mecanismo dos avisos do Moacir, lido pela Action
// em destinos.json); sem ninguém lá, o segredo AVISO_DANIEL_EMAIL. Os endereços são mascarados no log e nunca impressos.
// ALARME_SIMULAR=1 (ensaio do CI): monta o e-mail em alarme.json e NÃO envia nada.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { montarAlarme, motivosDeAlarme, type TipoExecucao } from "../../src/lib/backup/alarme.ts";
import { escolherDestinatarios, type AdminDestino } from "../../src/lib/notifications/destinatarios-admin.ts";
import { REMETENTE, REMETENTE_EMAIL } from "../../src/lib/notifications/remetente.ts";

const [acao, tipoArg, trab] = process.argv.slice(2);
if ((acao !== "avaliar" && acao !== "enviar") || (tipoArg !== "copia" && tipoArg !== "drill") || !trab) {
  console.error("uso: alarme.ts <avaliar|enviar> <copia|drill> <pasta>");
  process.exit(2);
}
const tipo = tipoArg as TipoExecucao;
const ler = (n: string): string | null => {
  const c = join(trab, n);
  return existsSync(c) ? readFileSync(c, "utf8").trim() : null;
};
const numero = (s: string | null | undefined): number | null => (s && /^\d+$/.test(s) ? Number(s) : null);

if (acao === "avaliar") {
  const [bAnt, oAnt] = (ler("anterior.txt") ?? "").split("|");
  const motivos = motivosDeAlarme(
    {
      tipo,
      ok: ler("res_ok") === "1",
      motivo: ler("res_motivo_final"),
      bytesBanco: numero(ler("res_bytes_banco")),
      objetosStorage: numero(ler("res_objetos_storage")),
    },
    { bytesBanco: numero(bAnt), objetosStorage: numero(oAnt) },
  );
  writeFileSync(join(trab, "alarme_motivos.json"), JSON.stringify(motivos), { mode: 0o600 });
  for (const m of motivos) console.log(`⚠ ${m}`);
  process.exit(0);
}

// enviar
const motivos = JSON.parse(ler("alarme_motivos.json") ?? "[]") as string[];
if (!motivos.length) {
  console.log("Sem alarme.");
  process.exit(0);
}
const servidor = process.env.GITHUB_SERVER_URL;
const repo = process.env.GITHUB_REPOSITORY;
const run = process.env.GITHUB_RUN_ID;
const alarme = montarAlarme({ tipo, motivos, quando: new Date(), linkExecucao: servidor && repo && run ? `${servidor}/${repo}/actions/runs/${run}` : null });

if (process.env.ALARME_SIMULAR === "1") {
  writeFileSync(join(trab, "alarme.json"), JSON.stringify({ from: REMETENTE, ...alarme }, null, 2), { mode: 0o600 });
  console.log(`Alarme montado (simulação, nada enviado): ${alarme.assunto}`);
  process.exit(0);
}

type Linha = AdminDestino & { email: string | null };
let admins: Linha[] = [];
try {
  admins = JSON.parse(ler("destinos.json") || "[]") as Linha[];
} catch {
  admins = [];
}
const enderecos = [
  ...new Set(
    escolherDestinatarios(admins, "ceo")
      .map((a) => a.email?.trim())
      .filter((e): e is string => !!e),
  ),
];
if (!enderecos.length && process.env.AVISO_DANIEL_EMAIL?.trim()) enderecos.push(process.env.AVISO_DANIEL_EMAIL.trim());
for (const e of enderecos) if (process.env.GITHUB_ACTIONS) console.log(`::add-mask::${e}`);

const chave = process.env.RESEND_API_KEY?.trim();
if (!enderecos.length || !chave) {
  console.log(`::error::Alarme do backup NÃO enviado: falta ${!chave ? "o segredo RESEND_API_KEY" : "destinatário (recebe_avisos_ceo ou AVISO_DANIEL_EMAIL)"}. O cartão do /admin mostra o aviso.`);
  process.exit(1);
}
const r = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
  body: JSON.stringify({ from: REMETENTE, reply_to: REMETENTE_EMAIL, to: enderecos, subject: alarme.assunto, html: alarme.html, text: alarme.texto }),
}).catch(() => null);
if (!r || !r.ok) {
  console.log(`::error::O Resend recusou o alarme (HTTP ${r?.status ?? "sem resposta"}). O cartão do /admin mostra o aviso.`);
  process.exit(1);
}
console.log(`Alarme enviado por e-mail a ${enderecos.length} destinatário(s).`);
