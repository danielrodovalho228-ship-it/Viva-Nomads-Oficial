// Aplica no Supabase (Auth) os 6 e-mails de conta e o remetente, pela API de gestão, e lê de volta para conferir.
// Roda pela Action manual "Aplicar e-mails de conta no Supabase". Segredo: SUPABASE_ACCESS_TOKEN (nunca impresso).
// Sem o segredo, para com a instrução de colar os modelos à mão (supabase/templates/LEIA-ME.md).
import { appendFileSync } from "node:fs";
import { camposDiferentes, corpoConfigAuth } from "../src/lib/notifications/supabase-auth-config.ts";

/** Resumo da execução (aba Summary da Action): o /admin lê o resultado da execução; aqui fica o detalhe legível. */
function resumo(linhas: string[]) {
  const arq = process.env.GITHUB_STEP_SUMMARY;
  if (arq) appendFileSync(arq, `${linhas.join("\n")}\n`);
}

const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const ref = process.env.SUPABASE_PROJECT_REF?.trim();
if (!token) {
  console.error("Sem o segredo SUPABASE_ACCESS_TOKEN. Cole os 6 modelos pelo LEIA-ME (supabase/templates/LEIA-ME.md).");
  process.exit(1);
}
if (!ref || !/^[a-z0-9]{20}$/.test(ref)) {
  console.error("Informe o projeto (SUPABASE_PROJECT_REF, 20 letras/números).");
  process.exit(1);
}

const url = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
const corpo = corpoConfigAuth();

const patch = await fetch(url, { method: "PATCH", headers, body: JSON.stringify(corpo) });
if (!patch.ok) {
  console.error(`O Supabase recusou a gravação (HTTP ${patch.status}). Confira o token e o projeto, ou cole pelo LEIA-ME.`);
  process.exit(1);
}
const lido = (await (await fetch(url, { headers })).json()) as Record<string, unknown>;
const diferentes = camposDiferentes(corpo, lido);
if (diferentes.length) {
  console.error(`Gravado, mas a leitura não confere em: ${diferentes.join(", ")}`);
  resumo(["### E-mails de conta: leitura de volta NÃO confere", "", `Campos diferentes: ${diferentes.join(", ")}`]);
  process.exit(1);
}
console.log(`Conferido: ${Object.keys(corpo).length} campos (6 assuntos, 6 corpos, remetente e validade do código) iguais aos do repositório.`);
resumo([
  "### E-mails de conta aplicados e conferidos no Supabase",
  "",
  `- ${Object.keys(corpo).length} campos iguais aos do repositório (6 assuntos, 6 corpos, remetente e validade do código: ${corpo.mailer_otp_exp} s).`,
  `- Commit: ${process.env.GITHUB_SHA ?? "local"}.`,
]);
