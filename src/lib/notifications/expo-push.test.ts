import test from "node:test";
import assert from "node:assert/strict";
import { caminhoInterno, emLotes, isExpoToken, lerTickets, montarMensagens, separarTokens } from "./expo-push.ts";

test("isExpoToken: aceita Expo e recusa FCM/lixo", () => {
  assert.equal(isExpoToken("ExponentPushToken[abc-123]"), true);
  assert.equal(isExpoToken("ExpoPushToken[abc]"), true);
  assert.equal(isExpoToken("fcm:APA91bH..."), false);
  assert.equal(isExpoToken("ExponentPushToken[]"), false);
  assert.equal(isExpoToken(""), false);
});

test("separarTokens: roteia Expo x FCM", () => {
  const r = separarTokens(["ExponentPushToken[a]", "antigo-fcm", "ExponentPushToken[b]"]);
  assert.deepEqual(r.expo, ["ExponentPushToken[a]", "ExponentPushToken[b]"]);
  assert.deepEqual(r.fcm, ["antigo-fcm"]);
});

test("emLotes: 250 tokens viram 100+100+50", () => {
  const l = emLotes(Array.from({ length: 250 }, (_, i) => i));
  assert.deepEqual(l.map((x) => x.length), [100, 100, 50]);
  assert.deepEqual(emLotes([]), []);
});

test("caminhoInterno: só caminho interno", () => {
  assert.equal(caminhoInterno("/admin/agentes"), "/admin/agentes");
  for (const ruim of ["//evil.com", "/\\evil.com", "https://evil.com", "javascript:1", "", null, undefined, "/a b"]) {
    assert.equal(caminhoInterno(ruim), "/dashboard", String(ruim));
  }
});

test("montarMensagens: som, canal avisos e url interna", () => {
  const [m] = montarMensagens(["ExponentPushToken[a]"], { title: "T", body: "B", url: "//evil.com" });
  assert.equal(m.sound, "default");
  assert.equal(m.channelId, "avisos");
  assert.equal(m.data.url, "/dashboard");
});

test("lerTickets: conta ok e apaga só DeviceNotRegistered", () => {
  const r = lerTickets(["a", "b", "c"], {
    data: [{ status: "ok" }, { status: "error", details: { error: "DeviceNotRegistered" } }, { status: "error", details: { error: "MessageRateExceeded" } }],
  });
  assert.equal(r.enviados, 1);
  assert.deepEqual(r.mortos, ["b"]);
  assert.deepEqual(lerTickets(["a"], null), { enviados: 0, mortos: [] });
});
