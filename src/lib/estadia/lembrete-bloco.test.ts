import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DIAS_LEMBRETE_BLOCO, LINHA_PAGAMENTO_DIRETO, blocoRenovado, chaveLembreteBloco, emailLembreteBloco, precisaLembreteDoBloco, type BlocoParaLembrete } from "./lembrete-bloco.ts";
import { comMarca, problemasDoAssunto } from "../notifications/assuntos.ts";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const HOJE = "2026-11-10";
const B: BlocoParaLembrete = { numero: 2, inicio: "2026-11-12", fim: "2027-01-10", meses: 2, valor: 6400, status: "agendado", aceiteProprietario: "2026-10-20T10:00:00Z", aceiteInquilino: "2026-10-21T10:00:00Z" };

test("dispara só para bloco ≥ 2 renovado (duas partes), sem pagamento, começando em até 3 dias", () => {
  assert.equal(DIAS_LEMBRETE_BLOCO, 3);
  assert.equal(precisaLembreteDoBloco(B, HOJE, 0), true);
  assert.equal(precisaLembreteDoBloco({ ...B, inicio: "2026-11-13" }, HOJE, 0), true, "3 dias");
  assert.equal(precisaLembreteDoBloco({ ...B, inicio: HOJE }, HOJE, 0), true, "começa hoje");
  assert.equal(precisaLembreteDoBloco({ ...B, inicio: "2026-11-14" }, HOJE, 0), false, "4 dias: ainda não");
  assert.equal(precisaLembreteDoBloco({ ...B, inicio: "2026-11-09" }, HOJE, 0), false, "já começou: nada (sem aviso de atraso)");
  assert.equal(precisaLembreteDoBloco({ ...B, status: "ativo" }, HOJE, 0), true);
});

test("não dispara: bloco já pago, não renovado (falta um aceite / pendente / não aceito) ou bloco 1", () => {
  assert.equal(precisaLembreteDoBloco(B, HOJE, 1), false, "pago");
  assert.equal(precisaLembreteDoBloco({ ...B, aceiteInquilino: null }, HOJE, 0), false);
  assert.equal(precisaLembreteDoBloco({ ...B, status: "pendente_aceite" }, HOJE, 0), false);
  assert.equal(precisaLembreteDoBloco({ ...B, status: "nao_aceito" }, HOJE, 0), false);
  assert.equal(precisaLembreteDoBloco({ ...B, numero: 1 }, HOJE, 0), false, "bloco 1 fica de fora");
  assert.equal(blocoRenovado({ numero: 3, status: "agendado", aceiteProprietario: "x", aceiteInquilino: "y" }), true);
});

test("não repete: chave única por (contrato, bloco)", () => {
  assert.equal(chaveLembreteBloco("C1", 2), "bloco_inicio_lembrete:C1:2");
  assert.notEqual(chaveLembreteBloco("C1", 2), chaveLembreteBloco("C1", 3));
});

test("conteúdo: assunto, datas, valor com a conta aberta, pagamento direto, um botão; nenhum termo proibido", () => {
  const e = emailLembreteBloco(B, { imovel: "Studio Centro", valorMensal: 3200 });
  assert.equal(e.assunto, "O bloco 2 da sua estadia começa em 12/11");
  assert.deepEqual(problemasDoAssunto(comMarca(e.assunto)), []);
  assert.equal(e.abertura("Ana"), "Olá Ana, o bloco 2 da sua estadia em Studio Centro começa em 12/11/2026.");
  assert.deepEqual(e.linhas, [
    { rotulo: "Imóvel", valor: "Studio Centro" },
    { rotulo: "Datas do bloco", valor: "12/11/2026 a 10/01/2027" },
    { rotulo: "Valor do bloco", valor: e.linhas[2].valor },
  ]);
  assert.match(e.linhas[2].valor, /^Bloco 2 \(2 meses: 12\/11 a 10\/01\) — R\$\s?6\.400(,00)? \(2 × R\$\s?3\.200(,00)?\)$/);
  assert.equal(e.rodape, LINHA_PAGAMENTO_DIRETO);
  assert.equal(e.cta, "Ver a estadia");
  const tudo = [e.assunto, e.abertura("Ana"), ...e.linhas.map((l) => l.valor), e.rodape].join(" ");
  assert.doesNotMatch(tudo, /venc|atras|aluguel|comiss|intermedia|vistoria|temporada|pix|banco|ag[êe]ncia|conta corrente|boleto/i);
});

test("GUARDA: evento só do morador e sem push; cron e as duas portas do aceite; marca antes de enviar", () => {
  const matriz = ler("../../config/matriz-notificacoes.ts");
  assert.match(matriz, /bloco_inicio_lembrete: \{ categoria: "lembretes", papeis: \["morador"\], canais: SEM_PUSH \}/);
  const srv = ler("./lembrete-bloco-servidor.ts");
  assert.ok(srv.indexOf('from("automacoes_envios").insert') < srv.indexOf("await notify("), "marca antes de enviar");
  assert.match(srv, /semPush: true/);
  assert.match(srv, /userId: c\.tenant_id/);
  assert.doesNotMatch(srv, /owner_id/, "nunca ao dono");
  assert.match(ler("../../app/api/cron/automacoes/route.ts"), /lembretesDeBloco\(admin, agora, simular\)/);
  assert.match(ler("../data/actions.ts"), /if \(!aguardando\) after\(\(\) => lembreteDeBlocoNoAceite\(admin, contratoId\)/);
  assert.match(ler("../data/estadia-actions.ts"), /after\(\(\) => lembreteDeBlocoNoAceite\(ctx\.admin, a\.contrato_id\)/);
});
