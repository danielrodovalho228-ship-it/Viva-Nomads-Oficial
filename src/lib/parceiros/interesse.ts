/**
 * Interesse de parceria (ordem a437a6d6, item 2): validação pura do formulário "Quero ser parceiro".
 * A Viva não recebe dinheiro do serviço do parceiro; aqui só se guarda um contato para a equipe responder.
 */
import { portfolioSeguro } from "../fotografos/regras.ts";

export const TIPOS_PARCEIRO = [
  { valor: "fotografo", rotulo: "Fotógrafo" },
  { valor: "empresa", rotulo: "Empresa que hospeda equipes" },
  { valor: "gestor", rotulo: "Gestor ou administradora de imóveis" },
  { valor: "servicos", rotulo: "Limpeza e manutenção" },
  { valor: "mobilia", rotulo: "Mobília, enxoval e mudança" },
  { valor: "seguros", rotulo: "Seguros e garantias" },
] as const;

export type TipoParceiro = (typeof TIPOS_PARCEIRO)[number]["valor"];

const UFS = new Set("AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" "));
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export interface InteresseValido {
  tipo: TipoParceiro;
  nome: string;
  cidade: string;
  uf: string;
  whatsapp: string | null;
  email: string | null;
  site: string | null;
}

export type ResultadoInteresse = { ok: true; dados: InteresseValido; descartar: boolean } | { ok: false; erro: string };

function normalizarSite(bruto: string): string | null {
  const t = bruto.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return portfolioSeguro(t.replace(/^http:\/\//i, "https://"));
  if (/^[a-z][a-z0-9+.-]*:/i.test(t)) return null; // javascript:, data: etc.
  return portfolioSeguro(`https://${t}`);
}

/** Valida no servidor: enum, tamanhos, UF, contato (WhatsApp ou e-mail), site https e aceite de contato. */
export function validarInteresse(e: Record<string, unknown>): ResultadoInteresse {
  const tipo = TIPOS_PARCEIRO.find((t) => t.valor === e.tipo)?.valor;
  if (!tipo) return { ok: false, erro: "Escolha o tipo de parceria." };
  const nome = String(e.nome ?? "").trim();
  if (nome.length < 2 || nome.length > 80) return { ok: false, erro: "Informe seu nome ou o da empresa (2 a 80 caracteres)." };
  const cidade = String(e.cidade ?? "").trim();
  if (cidade.length < 2 || cidade.length > 80) return { ok: false, erro: "Informe a cidade." };
  const uf = String(e.uf ?? "").trim().toUpperCase();
  if (!UFS.has(uf)) return { ok: false, erro: "Escolha o estado (UF)." };

  const contato = String(e.contato ?? "").trim();
  let whatsapp: string | null = null;
  let email: string | null = null;
  if (contato.length <= 200 && EMAIL_RE.test(contato)) email = contato.toLowerCase();
  else {
    let d = contato.replace(/\D/g, "");
    if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
    if (contato.length <= 30 && (d.length === 10 || d.length === 11)) whatsapp = d;
  }
  if (!whatsapp && !email) return { ok: false, erro: "Informe um WhatsApp com DDD ou um e-mail válido." };

  const siteBruto = String(e.site ?? "").trim();
  const site = normalizarSite(siteBruto);
  if (siteBruto && !site) return { ok: false, erro: "O site ou portfólio precisa ser um link (https)." };

  if (e.aceite !== true && e.aceite !== "on" && e.aceite !== "true") return { ok: false, erro: "Marque que aceita o contato da Viva." };

  // Campo escondido que gente não vê: se veio preenchido, é robô — finge sucesso e não grava.
  const descartar = String(e.armadilha ?? "").trim() !== "";
  return { ok: true, descartar, dados: { tipo, nome, cidade, uf, whatsapp, email, site } };
}
