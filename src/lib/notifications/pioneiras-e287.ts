/*
  E287 — e-mail manual às duas pioneiras (aprovado pelo Daniel em 07/11/2026). PURO: monta assunto, HTML (modelo único
  layoutEmail) e texto. O envio fica em pioneiras-e287-envio.ts. NADA aqui passa por comMarca: o assunto é manual e sai
  EXATAMENTE como está abaixo, sem o sufixo " · Viva Nomads".
*/
import { layoutEmail } from "./modelo-email.ts";

// O coração verde vai como escape Unicode (U+1F49A): a string é a mesma do assunto aprovado, e o código-fonte não carrega emoji
// literal (o teste de estilo "nenhum emoji na interface" varre o src inteiro; aqui o emoji é só o assunto de um e-mail manual).
export const ASSUNTO_PIONEIRAS = "Você foi uma das primeiras \u{1F49A} — novidades da Viva Nomads";

export interface Pioneira {
  chave: "maria-de-fatima" | "lya-raquel";
  nome: string;
  email: string;
  /** O que a pessoa fazia ao se cadastrar (entra no 1º parágrafo e no pré-cabeçalho). */
  contexto: string;
  /** "do lado de quem anuncia" / "do lado de quem procura moradia". */
  lado: string;
  /** Convite final (com 'topo' entre aspas simples, como aprovado). */
  convite: string;
}

export const PIONEIRAS: readonly Pioneira[] = [
  {
    chave: "maria-de-fatima",
    nome: "Maria de Fátima",
    email: "fatima.alves.campanha@gmail.com",
    contexto: "como proprietária",
    lado: "do lado de quem anuncia",
    convite: "Posso te chamar quando o teste para proprietários abrir? É só responder 'topo'.",
  },
  {
    chave: "lya-raquel",
    nome: "Lya Raquel",
    email: "lyamercaldi@gmail.com",
    contexto: "procurando um lugar para morar",
    lado: "do lado de quem procura moradia",
    convite: "Posso te chamar quando o teste da busca e das estadias abrir? É só responder 'topo'.",
  },
];

const SITE = "https://vivanomads.com.br";

function paragrafos(p: Pioneira): { saudacao: string; corpo: string[]; assinatura: string } {
  return {
    saudacao: `Olá, ${p.nome}!`,
    corpo: [
      `Aqui é da equipe Viva Nomads. Você se cadastrou ${p.contexto} quando a plataforma ainda estava saindo do papel — obrigado por confiar desde o começo.`,
      `Estamos na reta final dos testes e o lançamento oficial é entre janeiro e fevereiro de 2027. Antes de abrir para todo mundo, queremos montar um grupo pequeno de pioneiros para testar o app e opinar de verdade, ${p.lado}. Quem participar entra antes de todo mundo e fala direto com a nossa equipe.`,
      p.convite,
    ],
    assinatura: "Um abraço,\nEquipe Viva Nomads\nvivanomads.com.br",
  };
}

export function textoPioneira(p: Pioneira): string {
  const t = paragrafos(p);
  return [t.saudacao, ...t.corpo, t.assinatura].join("\n\n") + "\n";
}

export function htmlPioneira(p: Pioneira, siteUrl: string = SITE): string {
  const t = paragrafos(p);
  const par = (s: string) => `<p class="vn-p" style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">${s}</p>`;
  const inner =
    `<p class="vn-t" style="margin:0 0 16px;font-size:17px;line-height:1.4;font-weight:700;color:#123b26;">${t.saudacao}</p>` +
    t.corpo.map(par).join("") +
    par(`Um abraço,<br><strong>Equipe Viva Nomads</strong><br><a href="${siteUrl}" style="color:#0A4FD6;">vivanomads.com.br</a>`);
  return layoutEmail(inner, { siteUrl, preheader: t.corpo[0].replace(/^Aqui é da equipe Viva Nomads\. /, "") });
}

export interface EmailPioneira {
  subject: string;
  html: string;
  text: string;
}

export function emailPioneira(p: Pioneira, siteUrl: string = SITE): EmailPioneira {
  return { subject: ASSUNTO_PIONEIRAS, html: htmlPioneira(p, siteUrl), text: textoPioneira(p) };
}
