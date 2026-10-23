/*
  Prompt 51, fase 1 — Sair da Viva. Roda: node --test src/lib/saida/regras.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MOTIVOS_SAIDA,
  TEXTO_EXCLUSAO,
  ajudaDoMotivo,
  motivoDenunciaValido,
  motivoValido,
  motivosQueViramCorrecao,
  pctRevertidas,
  pendenciasParaSair,
  podeFecharCorrecao,
  prioridadeDenuncia,
  saidasPorMotivo,
  type SaidaRegistrada,
} from "./regras.ts";

const AGORA = new Date("2026-10-23T12:00:00Z");
const dias = (n: number) => new Date(AGORA.getTime() - n * 86_400_000).toISOString();
const saida = (motivo: string | null, d: number, extra: Partial<SaidaRegistrada> = {}): SaidaRegistrada => ({ papel: "proprietario", motivo, criadoEm: dias(d), ajudaOferecida: false, revertida: false, ...extra });

test("taxonomia por papel: cada papel tem a sua lista, com 'outro'; motivo de outro papel não vale", () => {
  assert.equal(MOTIVOS_SAIDA.morador.length, 8);
  assert.equal(MOTIVOS_SAIDA.proprietario.length, 7);
  assert.equal(MOTIVOS_SAIDA.parceiro.length, 6);
  for (const p of ["morador", "proprietario", "parceiro"] as const) assert.ok(MOTIVOS_SAIDA[p].some((m) => m.chave === "outro"));
  assert.equal(motivoValido("morador", "fechei_por_fora"), true);
  assert.equal(motivoValido("parceiro", "fechei_por_fora"), false);
  assert.equal(motivoValido("admin", "outro"), false);
});

test("ajuda ligada ao motivo; sem ajuda para o motivo → null (a saída segue igual)", () => {
  assert.equal(ajudaDoMotivo("morador", "atendimento")?.rotulo, "Falar com uma pessoa agora");
  assert.equal(ajudaDoMotivo("proprietario", "poucos_pedidos")?.rotulo, "Ver o que melhora seu anúncio");
  assert.equal(ajudaDoMotivo("proprietario", "dificuldade_de_usar")?.rotulo, "Uma pessoa te ajuda por mensagem");
  assert.equal(ajudaDoMotivo("morador", "so_pesquisando"), null);
  assert.equal(ajudaDoMotivo("morador", null), null);
});

test("pendências reais, cada uma com o lugar onde se resolve", () => {
  const p = pendenciasParaSair({
    contratosEmVigencia: [{ id: "c1", titulo: "Studio Centro" }, { id: "c2", titulo: "Loft" }],
    pedidosParceiroAbertos: [{ id: "p1", titulo: "Limpeza" }],
    caucoesADevolver: [{ contratoId: "c3", titulo: "Casa" }],
    encerramentosAbertos: [{ contratoId: "c2" }],
  });
  assert.deepEqual(p.map((x) => x.tipo), ["contrato", "contrato", "pedido_parceiro", "caucao"]);
  assert.equal(p[0].rotuloAcao, "Pedir o encerramento");
  assert.equal(p[1].rotuloAcao, "Acompanhar o pedido de encerramento");
  assert.equal(p[2].href, "/dashboard/servicos/pedidos/p1");
  assert.deepEqual(pendenciasParaSair({ contratosEmVigencia: [], pedidosParceiroAbertos: [], caucoesADevolver: [], encerramentosAbertos: [] }), []);
});

test("texto da exclusão: não promete 'todos os dados' nem 'imediata'", () => {
  assert.match(TEXTO_EXCLUSAO, /apagamos sua conta e seus dados pessoais/);
  assert.match(TEXTO_EXCLUSAO, /prazo legal, com acesso restrito/);
  assert.doesNotMatch(TEXTO_EXCLUSAO, /todos os dados|imediat/i);
});

test("regra: motivo com MAIS de 3 saídas em 30 dias vira Correção (teste e 'outro' fora; já aberta não duplica)", () => {
  const s = [saida("poucos_pedidos", 1), saida("poucos_pedidos", 5), saida("poucos_pedidos", 10), saida("poucos_pedidos", 29)];
  assert.deepEqual(motivosQueViramCorrecao(s, [], AGORA), [{ papel: "proprietario", motivo: "poucos_pedidos", n: 4 }]);
  // 3 não basta; a 4ª fora da janela não conta; conta de teste não conta.
  assert.deepEqual(motivosQueViramCorrecao(s.slice(0, 3), [], AGORA), []);
  assert.deepEqual(motivosQueViramCorrecao([...s.slice(0, 3), saida("poucos_pedidos", 31)], [], AGORA), []);
  assert.deepEqual(motivosQueViramCorrecao([...s.slice(0, 3), saida("poucos_pedidos", 2, { teste: true })], [], AGORA), []);
  assert.deepEqual(motivosQueViramCorrecao([1, 2, 3, 4].map((d) => saida("outro", d)), [], AGORA), []);
  assert.deepEqual(motivosQueViramCorrecao(s, [{ papel: "proprietario", motivo: "poucos_pedidos" }], AGORA), []);
  // O mesmo motivo em papéis diferentes conta separado.
  assert.deepEqual(motivosQueViramCorrecao([...s.slice(0, 2), saida("poucos_pedidos", 3, { papel: "parceiro" }), saida("poucos_pedidos", 4, { papel: "parceiro" })], [], AGORA), []);
});

test("métrica de ouro e saídas por motivo", () => {
  assert.equal(pctRevertidas([]), null);
  assert.equal(pctRevertidas([saida("atendimento", 1, { ajudaOferecida: true, revertida: true }), saida("atendimento", 1, { ajudaOferecida: true }), saida("x", 1), saida("atendimento", 1, { ajudaOferecida: true, revertida: true, teste: true })]), 50);
  const sem = saidasPorMotivo([saida(null, 1), saida(null, 2), saida("poucos_pedidos", 3), saida("poucos_pedidos", 9)], AGORA);
  assert.deepEqual(sem, [{ papel: "proprietario", motivo: "sem_resposta", n: 2 }, { papel: "proprietario", motivo: "poucos_pedidos", n: 1 }]);
});

test("fechar Correção exige ligação a PR ou ação", () => {
  assert.equal(podeFecharCorrecao("").ok, false);
  assert.equal(podeFecharCorrecao("ok").ok, false);
  assert.equal(podeFecharCorrecao("#1130").ok, true);
  assert.equal(podeFecharCorrecao("https://github.com/x/y/pull/1130").ok, true);
  assert.equal(podeFecharCorrecao("Ligamos para os 4 donos e ajustamos o texto da taxa").ok, true);
});

test("denúncia: motivos fechados; pagamento ou contato fora = P1, o resto P2", () => {
  assert.equal(motivoDenunciaValido("pagamento_fora"), true);
  assert.equal(motivoDenunciaValido("spam"), false);
  assert.equal(prioridadeDenuncia("pagamento_fora"), "p1");
  for (const m of ["fotos_falsas", "imovel_nao_existe", "conteudo_improprio", "outro"] as const) assert.equal(prioridadeDenuncia(m), "p2");
});
