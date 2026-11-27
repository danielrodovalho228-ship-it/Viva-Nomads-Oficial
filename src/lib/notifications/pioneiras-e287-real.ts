/*
  E287 — ENVIO REAL às duas pioneiras (Opção A, aprovada pelo Daniel em 07/11/2026). Caminho MÍNIMO de servidor:
  uma regra com dependências injetadas (testável) + uma rota só de admin que a chama (src/app/api/admin/pioneiras-e287).

  Garantias:
    • só as DUAS pessoas aprovadas (ids fixos no código; o destino nunca vem do pedido);
    • a conta é conferida na hora (id + e-mail + papel + não é conta de teste) e a marca de boas-vindas já tem de existir
      (ela NÃO é lida para alterar nem regravada: só conferida);
    • ordem obrigatória: a Lya só depois do envio aceito da Maria de Fátima;
    • um envio por pessoa (reserva em automacoes_envios com chave própria, antes de enviar; se o envio falha, a reserva
      é liberada para tentar de novo);
    • assunto EXATO (interno: true impede o comMarca), remetente e resposta oficiais, sem usuarioId (nada vai para a caixa de teste).
*/
import type { EmailResult } from "./email.ts";
import { REMETENTE, REMETENTE_EMAIL } from "./remetente.ts";
import { PIONEIRAS, emailPioneira, type Pioneira } from "./pioneiras-e287.ts";

export const ID_PIONEIRA: Record<Pioneira["chave"], string> = {
  "maria-de-fatima": "693e53ed-a4cd-49c4-be05-c76a7da2be38",
  "lya-raquel": "47ca91e1-456f-4de2-8d7d-1251e6d74c96",
};
const PAPEL: Record<Pioneira["chave"], string> = { "maria-de-fatima": "owner", "lya-raquel": "tenant" };
const ANTERIOR: Partial<Record<Pioneira["chave"], Pioneira["chave"]>> = { "lya-raquel": "maria-de-fatima" };

export const EVENTO_REAL = "pioneiras_e287";
export const chaveMarca = (chave: Pioneira["chave"]) => `boas_vindas:${ID_PIONEIRA[chave]}`;
export const chaveEnvio = (chave: Pioneira["chave"]) => `pioneiras_e287_envio:${chave}`;

export interface ParamsEnvioReal {
  to: string;
  subject: string;
  html: string;
  text?: string;
  interno: true;
  from: string;
  replyTo: string;
  evento: string;
  usuarioId?: undefined;
}
export interface DepsEnvioReal {
  perfil(id: string): Promise<{ email: string | null; role: string | null; is_teste: boolean | null } | null | "falha">;
  existeChave(chave: string): Promise<boolean | "falha">;
  reservar(chave: string, tipo: string, usuarioId: string): Promise<"ok" | "ja" | "falha">;
  liberar(chave: string): Promise<void>;
  enviar(p: ParamsEnvioReal): Promise<EmailResult>;
  agora(): Date;
}

export type ResultadoEnvioReal = { ok: true; para: string; resendId: string; em: string } | { ok: false; erro: string };

export async function enviarPioneiraReal(d: DepsEnvioReal, chave: Pioneira["chave"]): Promise<ResultadoEnvioReal> {
  const p = PIONEIRAS.find((x) => x.chave === chave);
  if (!p) return { ok: false, erro: "Pessoa inválida." };
  const id = ID_PIONEIRA[chave];

  const perfil = await d.perfil(id);
  if (perfil === "falha") return { ok: false, erro: "Não foi possível ler a conta agora. Nada foi enviado." };
  if (!perfil || (perfil.email ?? "").toLowerCase() !== p.email || perfil.role !== PAPEL[chave] || perfil.is_teste === true) {
    return { ok: false, erro: "A conta não confere (e-mail, papel ou conta de teste). Nada foi enviado." };
  }
  const marca = await d.existeChave(chaveMarca(chave));
  if (marca === "falha") return { ok: false, erro: "Não foi possível ler a marca de boas-vindas. Nada foi enviado." };
  if (!marca) return { ok: false, erro: "A marca de boas-vindas desta conta não existe. Nada foi enviado." };

  const antes = ANTERIOR[chave];
  if (antes) {
    const feito = await d.existeChave(chaveEnvio(antes));
    if (feito === "falha") return { ok: false, erro: "Não foi possível conferir o envio anterior. Nada foi enviado." };
    if (!feito) return { ok: false, erro: "Envie primeiro à Maria de Fátima e confira o aceite do serviço." };
  }

  const reserva = await d.reservar(chaveEnvio(chave), "pioneiras_e287", id);
  if (reserva === "ja") return { ok: false, erro: "Este e-mail já foi enviado. Nada foi reenviado." };
  if (reserva === "falha") return { ok: false, erro: "Não foi possível registrar o envio. Nada foi enviado." };

  const e = emailPioneira(p);
  const r = await d.enviar({
    to: p.email,
    subject: e.subject,
    html: e.html,
    text: e.text,
    interno: true,
    from: REMETENTE,
    replyTo: REMETENTE_EMAIL,
    evento: EVENTO_REAL,
  });
  if (!r.id || r.demo || r.error) {
    await d.liberar(chaveEnvio(chave));
    return { ok: false, erro: r.error ? `O serviço de e-mail recusou: ${r.error}` : "O serviço de e-mail não está configurado neste ambiente. Nada foi enviado." };
  }
  return { ok: true, para: p.email, resendId: r.id, em: d.agora().toISOString() };
}
