# Flow video — pipeline de geração

Gera o vídeo vertical (9:16, 1080×1920, 30fps, H.264) do produto a partir de
screenshots reais do site. Roteiro em `../../ROTEIRO_NARRACAO_VIDEO.md`.

## Passos
1. Subir o app: `PORT=3240 npm run start` (ou dev). Aguardar responder 200.
2. Capturar telas (mobile, bloqueia requests externos):
   `node scripts/flow-video/capture.mjs`  → PNGs em scratchpad/shots
3. Montar o vídeo mudo:
   `pip install imageio imageio-ffmpeg pillow numpy`
   `python3 scripts/flow-video/build_video.py`  → out/vivanomads_flow_mudo.mp4 + out/capa.png

## Ambiente
- Chromium pré-instalado em /opt/pw-browsers (não rodar `playwright install`).
- ffmpeg vem do pacote imageio-ffmpeg (get_ffmpeg_exe()).
- Fontes: LiberationSans (Bold/Regular).

## Sincronizar com a narração (quando houver MP3)
- Medir a duração do MP3 e distribuir entre as cenas proporcionalmente ao nº de
  caracteres da fala de cada cena (parametrizar DUR_SCENE por cena).
- Prefixar 1s da capa como primeiros frames; atrasar o áudio 1s (adelay=1000|1000).
- Mux: `-c:v copy -c:a aac -b:a 160k -shortest`.
