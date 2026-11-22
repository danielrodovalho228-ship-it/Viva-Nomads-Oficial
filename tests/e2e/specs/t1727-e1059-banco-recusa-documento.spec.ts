import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { DOCUMENTO_BLOQUEADO, guardContactInfo } from "../../../src/lib/messages/contact-guard";
import { CHAVE_ANON, NO_LABORATORIO, URL_SUPABASE, adm, apagarContas, criarConta, criarImovelPronto, gravarMensagem, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1727 — E1059, a perna de servidor no BANCO (ORDEM-DUET-433; migração 0354). A trava do item é a t2224 (Pista 3);
  esta cobre o resto do comportamento pedido:
   1. cada forma de CPF/RG, inserida direto em `messages` com a sessão da conta e a chave pública, é RECUSADA com a frase
      do Ocupantes (a inserção falha, nada se grava);
   2. a máscara continua a valer para o resto do contato (telefone, e-mail, mensageiro, link) e o texto limpo grava igual;
   3. o banco decide "é documento?" como a tela e a Server Action (contact-guard.ts), texto a texto;
   4. nem a chave de serviço grava documento, e trocar o texto de uma mensagem gravada por um CPF também é recusado.
  Sem navegador. Só contas de teste. Laboratório; não é prova ao vivo no site.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1727.${sufixo}@lab.vivanomads.test`, nome: "Dora Banco", role: "owner" as const };
const inq = { email: `inq.t1727.${sufixo}@lab.vivanomads.test`, nome: "Iara Banco", role: "tenant" as const };
const ids: Record<string, string> = {};
let conversa = "";
let daConta: SupabaseClient;

const DOCUMENTOS = [
  { nome: "a frase da prova de 20/11 (CPF com dígito verificador inválido)", texto: "Meu CPF é 123.456.789-00 para o cadastro." },
  { nome: "CPF com a forma, sem rótulo", texto: "segue 111.222.333-44 pra cadastro" },
  { nome: "CPF com rótulo e sem máscara", texto: "cpf 52998224725 para o contrato" },
  { nome: "CPF com rótulo e espaços", texto: "CPF: 123 456 789 00" },
  { nome: "11 dígitos sem rótulo com dígito verificador válido", texto: "anota aí 52998224725" },
  { nome: "RG com rótulo", texto: "RG 1234567" },
  { nome: "RG com rótulo e UF", texto: "RG MG-12.345.678 da minha esposa" },
  { nome: "RG pelo rótulo identidade", texto: "identidade nº 12345678 ok?" },
  { nome: "RG pela máscara, sem rótulo", texto: "o meu é 12.345.678-9" },
] as const;
const CONTATOS = [
  { nome: "telefone", texto: "me chama no (34) 99999-0001", some: "99999-0001" },
  { nome: "e-mail", texto: "manda pra ana.silva@gmail.com", some: "@gmail.com" },
  { nome: "mensageiro", texto: "https://wa.me/5534999990001 me add", some: "wa.me" },
  { nome: "link externo", texto: "vê em https://exemplo.com/anuncio", some: "exemplo.com" },
  { nome: "11 dígitos sem rótulo e sem dígito verificador válido (telefone)", texto: "me chama 12345678901", some: "12345678901" },
] as const;
const LIMPOS = ["Posso visitar sábado de manhã?", "O valor mensal é R$ 3.200 e a caução R$ 6.400", "o CEP é 38400-000", "entrada em 13/11/2026", "contrato 550e8400-e29b-41d4-a716-446655440000 ok"] as const;

const linha = (texto: string) => ({ conversation_id: conversa, sender_id: ids.inq, receiver_id: ids.dono, property_id: ids.imovel, body: `${texto} ${sufixo}` });
async function gravadasDoInq(): Promise<string[]> {
  const { data, error } = await adm().from("messages").select("body").eq("sender_id", ids.inq).eq("property_id", ids.imovel);
  if (error) throw error;
  return (data ?? []).map((m) => String(m.body));
}

test.describe("T1727 — E1059: o banco recusa CPF/RG em messages e segue mascarando o resto do contato @E1059", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    const { error } = await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inq]);
    if (error) throw error;
    ids.imovel = await criarImovelPronto(ids.dono, `Studio banco sem documento ${sufixo}`, { ativo: true });
    conversa = conversationId(ids.inq, ids.dono, ids.imovel);
    await gravarMensagem(ids.dono, ids.inq, ids.imovel, "Olá! Pode perguntar por aqui.", conversa);
    daConta = createClient(URL_SUPABASE!, CHAVE_ANON!, { auth: { persistSession: false } });
    const { error: eLogin } = await daConta.auth.signInWithPassword({ email: inq.email, password: senha });
    if (eLogin) throw eLogin;
  });
  test.afterAll(async () => {
    await adm().from("messages").delete().eq("property_id", ids.imovel ?? "");
    await apagarContas([ids.dono, ids.inq]);
  });

  test("1. Cada forma de CPF/RG inserida direto, com a sessão da conta, é recusada com a frase do Ocupantes; nada gravado", async () => {
    const antes = (await gravadasDoInq()).length;
    for (const d of DOCUMENTOS) {
      const { error } = await daConta.from("messages").insert(linha(d.texto));
      expect.soft(error?.message ?? "(o banco aceitou)", `${d.nome}: o banco recusa com a frase do Ocupantes`).toContain(DOCUMENTO_BLOQUEADO);
      expect.soft(error?.code ?? "(sem erro)", `${d.nome}: recusa por regra de conteúdo`).toBe("23514");
    }
    const depois = await gravadasDoInq();
    expect(depois.length, `nenhuma linha nova, nem mascarada (gravado: ${JSON.stringify(depois)})`).toBe(antes);
  });

  test("2. A máscara continua para telefone, e-mail, mensageiro e link; o texto limpo grava como foi escrito", async () => {
    for (const c of CONTATOS) {
      const { error } = await daConta.from("messages").insert(linha(c.texto));
      expect.soft(error, `${c.nome}: o banco aceita (mascarado)`).toBeNull();
    }
    for (const t of LIMPOS) {
      const { error } = await daConta.from("messages").insert(linha(t));
      expect.soft(error, `texto limpo aceite: ${t}`).toBeNull();
    }
    const gravadas = await gravadasDoInq();
    for (const c of CONTATOS) {
      expect.soft(gravadas.some((b) => b.includes(c.some)), `${c.nome}: o contato não fica no banco`).toBe(false);
    }
    expect.soft(gravadas.filter((b) => b.includes("protegido]")).length, "as cinco mensagens com contato ficaram mascaradas").toBe(CONTATOS.length);
    for (const t of LIMPOS) {
      expect.soft(gravadas, `texto limpo igual ao escrito: ${t}`).toContain(`${t} ${sufixo}`);
    }
  });

  test("3. O banco decide 'é documento?' como a tela e a Server Action (contact-guard.ts), texto a texto", async () => {
    const textos = [...DOCUMENTOS.map((d) => d.texto), ...CONTATOS.map((c) => c.texto), ...LIMPOS, "meu CPF é 529.982.247-25", "C.P.F. nº 123.456.789-00", "meu cpf é 12345678900", "MG-12.345.678", "R$ 1.250,00 por mês", "cargo 12345 unidades"];
    for (const t of textos) {
      const { data, error } = await adm().rpc("contem_documento", { t });
      expect.soft(error, `o banco responde para: ${t}`).toBeNull();
      expect.soft(data, `banco × contact-guard.ts em: ${t}`).toBe(guardContactInfo(t).documento);
    }
  });

  test("4. Nem a chave de serviço grava documento; trocar o texto de uma mensagem gravada por um CPF também é recusado", async () => {
    const antes = await gravadasDoInq();
    const { error: eInsere } = await adm().from("messages").insert(linha("Meu CPF é 123.456.789-00 para o cadastro."));
    expect(eInsere?.message ?? "(o banco aceitou)", "inserção com a chave de serviço").toContain(DOCUMENTO_BLOQUEADO);
    const limpa = `Posso visitar sábado de manhã? ${sufixo}`;
    const { error: eTroca } = await adm().from("messages").update({ body: `CPF 123.456.789-00 ${sufixo}` }).eq("sender_id", ids.inq).eq("property_id", ids.imovel).eq("body", limpa);
    expect(eTroca?.message ?? "(o banco aceitou)", "troca do texto de uma mensagem gravada").toContain(DOCUMENTO_BLOQUEADO);
    expect(await gravadasDoInq(), "as mensagens gravadas ficam como estavam").toEqual(antes);
  });
});
