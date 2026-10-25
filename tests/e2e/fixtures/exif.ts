import sharp from "sharp";

/**
 * EXIF e GPS em imagem (estudo de segurança, validação do coordenador, 22/10): foto com metadado pode entregar o
 * aparelho, a data e, pior, a coordenada de onde foi tirada (a casa do dono, do inquilino, do pet). Toda imagem que o
 * site guarda ou serve tem de sair LIMPA. Aqui fica o leitor (sem dependência: JPEG, PNG e WebP) e a foto de teste
 * com EXIF e GPS que as specs enviam pelos fluxos reais.
 */
export type Metadados = { formato: "jpeg" | "png" | "webp" | "outro"; exif: boolean; gps: boolean; xmp: boolean };

const ascii = (b: Buffer, ini: number, n: number) => b.toString("latin1", ini, ini + n);

/** TIFF do EXIF: o IFD0 tem a etiqueta 0x8825 (GPSInfo) apontando para um IFD de GPS com pelo menos uma entrada? */
function tiffTemGps(b: Buffer, base: number): boolean {
  if (base + 8 > b.length) return false;
  const le = ascii(b, base, 2) === "II";
  const u16 = (o: number) => (le ? b.readUInt16LE(o) : b.readUInt16BE(o));
  const u32 = (o: number) => (le ? b.readUInt32LE(o) : b.readUInt32BE(o));
  const ifd0 = base + u32(base + 4);
  if (ifd0 + 2 > b.length) return false;
  const n = u16(ifd0);
  for (let i = 0; i < n; i++) {
    const e = ifd0 + 2 + i * 12;
    if (e + 12 > b.length) return false;
    if (u16(e) !== 0x8825) continue;
    const gps = base + u32(e + 8);
    return gps + 2 <= b.length && u16(gps) > 0;
  }
  return false;
}

const xmpTemGps = (xmp: string) => /GPS(Latitude|Longitude)/i.test(xmp);

export function lerMetadados(b: Buffer): Metadados {
  const m: Metadados = { formato: "outro", exif: false, gps: false, xmp: false };
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8) {
    m.formato = "jpeg";
    for (let o = 2; o + 4 <= b.length; ) {
      if (b[o] !== 0xff) break;
      const marca = b[o + 1];
      if (marca === 0xda || marca === 0xd9) break; // começo da imagem: metadado só vem antes
      const tam = b.readUInt16BE(o + 2);
      if (marca === 0xe1) {
        if (ascii(b, o + 4, 6) === "Exif\0\0") {
          m.exif = true;
          m.gps ||= tiffTemGps(b, o + 10);
        } else if (ascii(b, o + 4, 28).startsWith("http://ns.adobe.com/xap/1.0/")) {
          m.xmp = true;
          m.gps ||= xmpTemGps(ascii(b, o + 4, tam - 2));
        }
      }
      o += 2 + tam;
    }
  } else if (b.length > 8 && b.readUInt32BE(0) === 0x89504e47) {
    m.formato = "png";
    for (let o = 8; o + 8 <= b.length; ) {
      const tam = b.readUInt32BE(o);
      const tipo = ascii(b, o + 4, 4);
      if (tipo === "eXIf") {
        m.exif = true;
        m.gps ||= tiffTemGps(b, o + 8);
      } else if ((tipo === "iTXt" || tipo === "tEXt") && ascii(b, o + 8, 17) === "XML:com.adobe.xmp") {
        m.xmp = true;
        m.gps ||= xmpTemGps(ascii(b, o + 8, tam));
      }
      if (tipo === "IEND") break;
      o += 12 + tam;
    }
  } else if (b.length > 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") {
    m.formato = "webp";
    for (let o = 12; o + 8 <= b.length; ) {
      const tipo = ascii(b, o, 4);
      const tam = b.readUInt32LE(o + 4);
      if (tipo === "EXIF") {
        m.exif = true;
        const base = ascii(b, o + 8, 6) === "Exif\0\0" ? o + 14 : o + 8;
        m.gps ||= tiffTemGps(b, base);
      } else if (tipo === "XMP ") {
        m.xmp = true;
        m.gps ||= xmpTemGps(ascii(b, o + 8, tam));
      }
      o += 8 + tam + (tam % 2);
    }
  }
  return m;
}

/** "EXIF e GPS" / "EXIF" / null (limpa). XMP sem GPS não reprova (é texto de edição, sem coordenada). */
export function problemaDeMetadado(m: Metadados): string | null {
  if (m.gps) return `${m.exif ? "EXIF com " : ""}GPS (coordenada de onde a foto foi tirada)`;
  if (m.exif) return "EXIF (aparelho, data e configurações da câmera)";
  return null;
}

/** Foto de teste em JPEG com EXIF de câmera e GPS (Uberlândia), como sai de um celular. `n` muda a cor. */
export async function jpegComGps(n = 1, largura = 640, altura = 480): Promise<Buffer> {
  const cor = `#${((n * 2654435761) >>> 8).toString(16).padStart(6, "0").slice(0, 6)}`;
  return sharp({ create: { width: largura, height: altura, channels: 3, background: cor } })
    .jpeg({ quality: 85 })
    .withExif({
      IFD0: { Make: "Viva Lab", Model: "Celular de teste", DateTime: "2026:10:22 10:00:00" },
      IFD3: { GPSLatitudeRef: "S", GPSLatitude: "18/1 55/1 8/1", GPSLongitudeRef: "W", GPSLongitude: "48/1 16/1 37/1" },
    })
    .toBuffer();
}
