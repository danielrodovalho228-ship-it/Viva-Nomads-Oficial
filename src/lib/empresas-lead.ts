/** Lead do formulário /empresas: validação e gravação (ordem cdef67f8 item 3). Sem imports para rodar no teste unitário. */

/**
 * E876 (RELATORIO-021, A-113): o prazo de retorno do formulário "Fale com a gente" de /empresas. O envio vai para
 * POST /api/empresas → grava em leads_empresas (só admin lê), avisa o Daniel (push) e manda e-mail interno para
 * EMPRESAS_LEAD_EMAIL (ou o suporte). Quem responde é a equipe, no e-mail informado — no MESMO prazo que a página já
 * promete à empresa (7 dias, E770). Uma fonte só para o texto da página e o recibo do envio.
 */
export const DIAS_RETORNO_EMPRESAS = 7;
export const TEXTO_RETORNO_EMPRESAS = `A equipe da Viva responde no e-mail informado em até ${DIAS_RETORNO_EMPRESAS} dias.`;

export interface LeadEmpresa {
  nome: string;
  empresa: string;
  email: string;
  volume_ano: string | null;
  mensagem: string | null;
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Devolve o lead limpo, ou null se faltar nome, empresa ou e-mail válido. Corta tamanhos como o banco exige. */
export function validarLead(body: unknown): LeadEmpresa | null {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const txt = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const nome = txt(b.nome, 200);
  const empresa = txt(b.empresa, 200);
  const email = txt(b.email, 320).toLowerCase();
  if (!nome || !empresa || !EMAIL.test(email)) return null;
  return {
    nome,
    empresa,
    email,
    volume_ano: txt(b.volumeAno, 100) || null,
    mensagem: txt(b.mensagem, 2000) || null,
  };
}

interface ClienteInsercao {
  from(tabela: string): { insert(linha: LeadEmpresa): PromiseLike<{ error: { message: string } | null }> };
}

/** Grava o lead em leads_empresas. Devolve false (sem lançar) se não há cliente ou o banco falhar. */
export async function gravarLead(admin: ClienteInsercao | null, lead: LeadEmpresa): Promise<boolean> {
  if (!admin) return false;
  const { error } = await admin.from("leads_empresas").insert(lead);
  if (error) {
    console.error("[empresas] não gravou o lead:", error.message);
    return false;
  }
  return true;
}
