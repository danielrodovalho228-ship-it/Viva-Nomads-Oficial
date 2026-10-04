# Arquivos de marca — Viva Nomads

Logo oficial (2026): símbolo **"N" azul e verde** + wordmark **"Viva"** azul
`#0A4FD6` e **"Nomads"** verde `#5DBB1E`. Sobre fundo escuro, o wordmark fica
branco + `#8FD63A` e o símbolo ganha uma placa branca de cantos 8 px (o azul
some sobre o verde-escuro).

## Mestres (`novo/`)

| arquivo | uso |
|---|---|
| `vn-logo-original.png` | original do designer (1254×1254, fundo branco) — só referência |
| `vn-mark-1024.png`, `vn-mark-512.png`, `vn-mark-128.png` | símbolo transparente; o componente `Logo` usa 128 até 64 px e 512 acima |
| `ios-icon-1024.png` | ícone do iPhone / App Store (opaco) |
| `play-icon-512.png` | ícone da Play Store |
| `android-adaptive-foreground.png` / `-background.png` | ícone adaptativo do Android |
| `splash-icon.png` | abertura do app |

## Onde cada cópia mora

- Favicon e ícones do Next: `src/app/favicon.ico`, `src/app/icon.png`, `src/app/apple-icon.png`.
- PWA: `public/icon-192.png`, `public/icon-512.png` e as versões `-maskable`.
- E-mails: `public/email-mark.png`.
- Imagem de compartilhamento: `src/app/opengraph-image.tsx` (lê `novo/vn-mark-128.png`).
- App Android: `android/app/src/main/res/` — gerado de `assets/` (cópias dos mestres):

```bash
npx @capacitor/assets generate --android \
  --iconBackgroundColor '#FFFFFF' --iconBackgroundColorDark '#FFFFFF' \
  --splashBackgroundColor '#FFFFFF' --splashBackgroundColorDark '#FFFFFF'
```

`assets/icon-foreground.png` = `android-adaptive-foreground.png`,
`assets/icon-background.png` = `android-adaptive-background.png`,
`assets/icon-only.png` = `ios-icon-1024.png`, e `assets/splash*.png` = o
`splash-icon.png` centralizado num quadrado branco de 2732 px.
