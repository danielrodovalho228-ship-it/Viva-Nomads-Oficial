#!/usr/bin/env node
/*
  Resend FALSO do laboratório (complemento do recibo, 19/10). Nada sai para a rede: o site do laboratório, com
  INTEGRACOES_SIMULADAS=on e LAB_RESEND_URL apontando para cá, posta os e-mails neste servidor, que confere o
  pedido como o Resend (POST /emails: from, to, subject, html; anexos com filename e content em base64) e devolve
  { id } — ou o erro no formato do Resend ({ statusCode, message, name }). Assim o teste prova "enviado com
  resend_id" e o caminho da recusa ("Reenviar e-mail").

  Controle (só para os testes):
    GET  /__emails            → os e-mails aceitos (sem o html; anexos com nome, tamanho e se é PDF)
    POST /__falhas            → { status, name, message, vezes, para? } programa as próximas recusas
    POST /__limpar            → zera e-mails e falhas

  Uso: node scripts/lab/resend-falso.mjs [porta]   (padrão 3999; só escuta em 127.0.0.1)
*/
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const porta = Number(process.argv[2] ?? process.env.LAB_RESEND_PORTA ?? 3999);
let emails = [];
let falhas = [];

const json = (res, status, corpo) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(corpo));
};
const erro = (res, statusCode, name, message) => json(res, statusCode, { statusCode, name, message });
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

function validar(b) {
  if (!b || typeof b !== "object") return "Invalid JSON body";
  if (typeof b.from !== "string" || !/^(.+<)?[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}>?$/i.test(b.from.trim())) return "Invalid `from` field.";
  const to = Array.isArray(b.to) ? b.to : [b.to];
  if (!to.length || to.some((t) => typeof t !== "string" || !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(t))) return "Invalid `to` field.";
  if (typeof b.subject !== "string" || !b.subject.trim()) return "Missing `subject` field.";
  if (typeof b.html !== "string" && typeof b.text !== "string") return "Missing `html` or `text` field.";
  if (b.attachments !== undefined) {
    if (!Array.isArray(b.attachments)) return "Invalid `attachments` field.";
    for (const a of b.attachments) {
      if (!a || typeof a.filename !== "string" || !a.filename.trim()) return "Attachment `filename` is required.";
      if (typeof a.content !== "string" || !a.content.length || a.content.length % 4 !== 0 || !BASE64.test(a.content)) return "Attachment `content` must be base64.";
    }
  }
  return null;
}

createServer((req, res) => {
  let corpo = "";
  req.on("data", (c) => (corpo += c));
  req.on("end", () => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    if (req.method === "GET" && url.pathname === "/__emails") return json(res, 200, emails);
    if (req.method === "POST" && url.pathname === "/__limpar") {
      emails = [];
      falhas = [];
      return json(res, 200, { ok: true });
    }
    if (req.method === "POST" && url.pathname === "/__falhas") {
      const f = JSON.parse(corpo || "{}");
      falhas.push({ status: Number(f.status ?? 422), name: f.name ?? "validation_error", message: f.message ?? "Recusa programada", vezes: Number(f.vezes ?? 1), para: f.para ?? null });
      return json(res, 200, { ok: true });
    }
    if (req.method !== "POST" || url.pathname !== "/emails") return erro(res, 404, "not_found", "The requested endpoint does not exist.");
    if (!/^Bearer re_/.test(req.headers.authorization ?? "")) return erro(res, 401, "missing_api_key", "Missing API key in the authorization header.");
    let b;
    try {
      b = JSON.parse(corpo);
    } catch {
      return erro(res, 422, "validation_error", "Invalid JSON body");
    }
    const para = Array.isArray(b?.to) ? b.to[0] : b?.to;
    const f = falhas.find((x) => x.vezes > 0 && (!x.para || x.para === para));
    if (f) {
      f.vezes -= 1;
      return erro(res, f.status, f.name, f.message);
    }
    const invalido = validar(b);
    if (invalido) return erro(res, 422, "validation_error", invalido);
    const id = randomUUID();
    emails.push({
      id,
      para,
      de: b.from,
      assunto: b.subject,
      anexos: (b.attachments ?? []).map((a) => {
        const bytes = Buffer.from(a.content, "base64");
        return { nome: a.filename, bytes: bytes.length, pdf: bytes.subarray(0, 5).toString() === "%PDF-" };
      }),
      em: new Date().toISOString(),
    });
    return json(res, 200, { id });
  });
}).listen(porta, "127.0.0.1", () => console.log(`[resend-falso] ouvindo em http://127.0.0.1:${porta}`));
