import { test } from "@playwright/test";
import { mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/*
  A rotina da avaliação (/api/cron/vistoria) corre sobre o banco INTEIRO do laboratório. Duas specs que a acionam e
  correm ao mesmo tempo (o lab-critico usa 2 workers) estragam a massa uma da outra: o tique de uma expira a proposta
  que a outra ainda ia usar. Esta fila deixa passar uma spec de cada vez: quem depende da rotina pega a vez no começo do
  beforeAll e devolve-a no fim do afterAll.
  É uma pasta-trava no disco da máquina, que os workers do mesmo job partilham. No noturno cada fatia corre com 1 worker
  e nunca há espera. Uma trava abandonada (worker morto antes do afterAll) deixa de valer ao fim de 4 minutos.
  O gancho beforeAll tem, por omissão, o tempo de um teste (45 s), e a espera pela vez pode passar disso — com três
  specs de rotina e 2 workers passava sempre: o gancho estourava, a spec passava só na repetição e o portão reprovava
  por instável. Por isso quem pega a vez dá ao próprio gancho o tempo da espera mais o de montar a massa.
*/
const TRAVA = join(tmpdir(), "vn-lab-vez-da-rotina-da-vistoria");
const ABANDONADA_MS = 4 * 60_000;
const ESPERA_MS = 6 * 60_000;
/** Folga para o resto do beforeAll (contas, imóveis, pedidos) depois de a vez chegar. */
const MONTAR_A_MASSA_MS = 2 * 60_000;
let minha = false;

/** Espera a vez e fica com ela. Chamar no começo do beforeAll da spec que aciona a rotina (ou depende de ela não correr). */
export async function pegarAVezDaRotinaDaVistoria(quem: string): Promise<void> {
  // Chamado de dentro do beforeAll: este tempo é o do gancho, não o dos testes da spec.
  test.setTimeout(ESPERA_MS + MONTAR_A_MASSA_MS);
  const limite = Date.now() + ESPERA_MS;
  for (;;) {
    try {
      mkdirSync(TRAVA);
      writeFileSync(join(TRAVA, "quem"), `${quem} · processo ${process.pid} · ${new Date().toISOString()}\n`);
      minha = true;
      return;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    }
    let idade = 0;
    try {
      idade = Date.now() - statSync(TRAVA).mtimeMs;
    } catch {
      continue; // a outra spec acabou de devolver a vez
    }
    if (idade > ABANDONADA_MS) {
      rmSync(TRAVA, { recursive: true, force: true });
      continue;
    }
    if (Date.now() > limite) throw new Error(`[${quem}] a vez da rotina da avaliação não chegou em ${ESPERA_MS / 60_000} minutos.`);
    await new Promise((r) => setTimeout(r, 500));
  }
}

/** Devolve a vez (só quem a tem). Chamar no fim do afterAll. */
export function devolverAVezDaRotinaDaVistoria(): void {
  if (!minha) return;
  minha = false;
  rmSync(TRAVA, { recursive: true, force: true });
}
