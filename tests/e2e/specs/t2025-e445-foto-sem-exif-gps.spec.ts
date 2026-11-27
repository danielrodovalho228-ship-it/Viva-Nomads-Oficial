import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import ts from "typescript";

/*
  T2025 — E445 (Pista 3, lote 2, item B5). Regra: a foto anexada na conversa chega ao outro lado SEM EXIF/GPS — o
  navegador a regrava (canvas → WebP) ANTES do envio, em src/components/mensagens/anexo-conversa.tsx (semLocalizacao);
  o servidor guarda os bytes como recebeu (t2022). O PDF segue como está.
  O teste roda a função REAL (o trecho do arquivo, só sem os tipos) no Chromium: monta uma JPEG com bloco EXIF e
  localização (GPS 18°55' S), passa pela função e lê os bytes que sairiam no envio.
  Não abre nenhuma página do site, não usa conta nem grava nada: seguro para qualquer alvo.
  A ponta "baixar no outro lado" (login das duas partes) fica para o laboratório — ver o PR.
*/

const FONTE = readFileSync("src/components/mensagens/anexo-conversa.tsx", "utf8");
const inicio = FONTE.indexOf("const LADO_MAX");
const fim = FONTE.indexOf("/** O clipe");
const TRECHO = ts.transpileModule(FONTE.slice(inicio, fim).replace("export async function", "async function"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("T2025 — foto da conversa sem EXIF nem GPS @E445 @ao-vivo-seguro", () => {
  test("a foto com localização sai regravada em WebP, sem EXIF e sem GPS; o PDF segue igual", async ({ page }) => {
    expect(inicio, "semLocalizacao encontrada no componente").toBeGreaterThan(0);
    expect(fim).toBeGreaterThan(inicio);
    await page.setContent("<!doctype html><title>t2025</title>");

    const r = await page.evaluate(async (codigo) => {
      const semLocalizacao = new Function(`${codigo}; return semLocalizacao;`)() as (f: File) => Promise<File>;
      const tem = (b: Uint8Array, s: string) => {
        const alvo = new TextEncoder().encode(s);
        for (let i = 0; i + alvo.length <= b.length; i++) if (alvo.every((x, j) => b[i + j] === x)) return true;
        return false;
      };

      // JPEG de 64×48 vinda do canvas.
      const c = document.createElement("canvas");
      c.width = 64;
      c.height = 48;
      const g = c.getContext("2d")!;
      g.fillStyle = "#3a7";
      g.fillRect(0, 0, 64, 48);
      const jpeg = new Uint8Array(await (await new Promise<Blob>((ok) => c.toBlob((b) => ok(b!), "image/jpeg", 0.9))).arrayBuffer());

      // Bloco APP1 EXIF (TIFF little-endian): IFD0 → GPSInfo (0x8825) → GPSLatitudeRef "S" + GPSLatitude 18/1 55/1 0/1.
      const tiff = new DataView(new ArrayBuffer(80));
      let o = 0;
      const u16 = (v: number) => (tiff.setUint16(o, v, true), (o += 2));
      const u32 = (v: number) => (tiff.setUint32(o, v, true), (o += 4));
      u16(0x4949); u16(42); u32(8);
      u16(1); u16(0x8825); u16(4); u32(1); u32(26); u32(0);
      u16(2); u16(0x0001); u16(2); u32(2); u16(0x0053); u16(0); u16(0x0002); u16(5); u32(3); u32(56); u32(0);
      for (const [n, d] of [[18, 1], [55, 1], [0, 1]]) { u32(n); u32(d); }
      const exif = new Uint8Array([...new TextEncoder().encode("Exif\0\0"), ...new Uint8Array(tiff.buffer)]);
      const app1 = new Uint8Array([0xff, 0xe1, (exif.length + 2) >> 8, (exif.length + 2) & 0xff, ...exif]);
      const comGps = new Uint8Array([...jpeg.slice(0, 2), ...app1, ...jpeg.slice(2)]);
      const entrada = new File([comGps], "IMG_0001.jpg", { type: "image/jpeg" });

      const saida = await semLocalizacao(entrada);
      const b = new Uint8Array(await saida.arrayBuffer());
      const bmp = await createImageBitmap(saida);
      const pdf = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "laudo.pdf", { type: "application/pdf" });
      return {
        entradaTemExif: tem(comGps, "Exif\0\0"),
        entradaLegivel: (await createImageBitmap(entrada)).width,
        tipo: saida.type,
        nome: saida.name,
        riffWebp: String.fromCharCode(...b.slice(0, 4)) + String.fromCharCode(...b.slice(8, 12)),
        temExif: tem(b, "Exif") || tem(b, "EXIF"),
        temTiff: tem(b, "II*\0") || tem(b, "MM\0*"),
        tamanho: [bmp.width, bmp.height],
        pdfIgual: (await semLocalizacao(pdf)) === pdf,
      };
    }, TRECHO);

    // A foto de entrada tem mesmo o EXIF com GPS (e é uma JPEG válida).
    expect(r.entradaTemExif).toBe(true);
    expect(r.entradaLegivel).toBe(64);
    // O que sai para o envio: WebP regravado, nome neutro, sem EXIF/TIFF (logo, sem GPS), mesma imagem.
    expect(r.tipo).toBe("image/webp");
    expect(r.nome).toBe("foto.webp");
    expect(r.riffWebp).toBe("RIFFWEBP");
    expect(r.temExif, "bloco EXIF na foto enviada").toBe(false);
    expect(r.temTiff, "cabeçalho TIFF (onde mora o GPS) na foto enviada").toBe(false);
    expect(r.tamanho).toEqual([64, 48]);
    expect(r.pdfIgual).toBe(true);
  });
});
