/*
  t2024 · E445 (Pista 3, lote 2, item B4) @E445 @ao-vivo-seguro
  Regra: a conversa NÃO tem áudio — nem botão de gravar, nem de enviar áudio. O seletor (ACEITA_ANEXO) não oferece
  áudio, a tela recusa o tipo declarado de áudio e o servidor recusa áudio de verdade pelos primeiros bytes (OGG, MP3,
  WAV, M4A), mesmo disfarçado de foto; nada é gravado.
  A parte "sem botão" lê as telas da conversa (messages-client.tsx e src/components/mensagens/*.tsx): nenhuma gravação
  de microfone (MediaRecorder/getUserMedia), nenhum ícone de microfone e nenhum rótulo de áudio.
  Roda o POST REAL de src/app/api/mensagens/anexo/route.ts (dublês só nas bordas, ver conversa-harness/).
  Roda: node --test src/lib/messages/e445-t2024-sem-audio.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { U, novoMundo } from "./conversa-harness/supabase-falso.ts";
import { ACEITA_ANEXO, tipoNaTela, validarAnexoNaTela } from "./anexo-tela.ts";

const { POST } = await import("../../app/api/mensagens/anexo/route.ts");
const raiz = new URL("../../../", import.meta.url);
const ler = (p: string) => readFileSync(new URL(p, raiz), "utf8");

const AUDIOS: Record<string, { bytes: number[]; mime: string }> = {
  ogg: { bytes: [0x4f, 0x67, 0x67, 0x53, 0, 2, 0, 0], mime: "audio/ogg" },
  mp3: { bytes: [0x49, 0x44, 0x33, 3, 0, 0, 0, 0], mime: "audio/mpeg" },
  wav: { bytes: [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45], mime: "audio/wav" },
  m4a: { bytes: [0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20], mime: "audio/mp4" },
};

test("B4: o seletor de anexo não oferece áudio e a tela recusa o tipo de áudio", () => {
  assert.equal(/audio/i.test(ACEITA_ANEXO), false, ACEITA_ANEXO);
  for (const { mime } of Object.values(AUDIOS)) {
    assert.equal(tipoNaTela(mime), null, mime);
    assert.equal(validarAnexoNaTela({ size: 1000, type: mime }), "Envie uma foto (JPG, PNG ou WebP) ou um PDF.", mime);
  }
});

test("B4: o servidor recusa áudio pelos bytes (declarado como áudio ou disfarçado de foto) e não grava nada", async () => {
  for (const [nome, a] of Object.entries(AUDIOS)) {
    for (const [arquivo, tipo] of [[`voz.${nome}`, a.mime], ["foto.jpg", "image/jpeg"]]) {
      const mundo = novoMundo({ messages: [], mensagens_anexos: [] }, U.morador);
      const form = new FormData();
      form.set("receiverId", U.dono);
      form.set("file", new File([new Uint8Array(a.bytes)], arquivo, { type: tipo }));
      const r = await POST(new Request("http://teste.invalid/api/mensagens/anexo", { method: "POST", body: form }));
      assert.equal(r.status, 415, `${nome} como ${tipo}`);
      assert.equal(mundo.tabelas.messages.length + mundo.tabelas.mensagens_anexos.length + mundo.registro.arquivos.size, 0, `${nome}: nada gravado`);
    }
  }
});

test("B4: as telas da conversa não têm gravação de microfone, ícone de microfone nem rótulo de áudio", () => {
  const telas = [
    "src/app/(dashboard)/dashboard/mensagens/messages-client.tsx",
    "src/app/(dashboard)/dashboard/mensagens/page.tsx",
    ...readdirSync(new URL("src/components/mensagens/", raiz)).filter((f) => f.endsWith(".tsx")).map((f) => `src/components/mensagens/${f}`),
  ];
  assert.ok(telas.includes("src/components/mensagens/anexo-conversa.tsx"), "o compositor de anexo está na conta");
  for (const t of telas) {
    const src = ler(t);
    assert.doesNotMatch(src, /MediaRecorder|getUserMedia|webkitSpeechRecognition/, `${t}: gravação de microfone`);
    assert.doesNotMatch(src, /\b(Mic|MicOff|Mic2|AudioLines|AudioWaveform|Voicemail)\b/, `${t}: ícone de microfone/áudio`);
    assert.doesNotMatch(src, /accept=["'{][^"'}]*audio|capture=["']?(user|environment)?["']?[^>]*audio/i, `${t}: seletor de áudio`);
    assert.doesNotMatch(src, /[Áá]udio|mensagem de voz|gravar (um )?áudio/i, `${t}: rótulo de áudio`);
  }
});
