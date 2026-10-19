// Confere SPF, DKIM (Resend) e DMARC do domínio que envia os e-mails e publica a tabela (CI: resumo da execução).
// Só leitura de DNS público. Nunca falha o CI: o resultado é informativo (o DNS é do Daniel).
import { appendFileSync } from "node:fs";
import { promises as dns } from "node:dns";
import { avaliarDns, NOMES_DNS, tabelaDns } from "../src/lib/notifications/dns-remetente.ts";

async function txt(nome: string): Promise<string[]> {
  try {
    return (await dns.resolveTxt(nome)).map((partes) => partes.join(""));
  } catch {
    return [];
  }
}

const registros = { raiz: await txt(NOMES_DNS.raiz), envio: await txt(NOMES_DNS.envio), dkim: await txt(NOMES_DNS.dkim), dmarc: await txt(NOMES_DNS.dmarc) };
const tabela = `### DNS do e-mail (${NOMES_DNS.raiz})\n\n${tabelaDns(avaliarDns(registros))}\n`;
console.log(tabela);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, tabela);
