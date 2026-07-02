#!/usr/bin/env python3
# Flow video Viva Nomads — 1080x1920, 30fps, H.264 yuv420p. PIL + imageio-ffmpeg.
import os, math, numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import imageio.v2 as imageio

SHOTS = "/tmp/claude-0/-home-user-Viva-Nomads-Oficial/28cadf6c-333b-5a9c-9cb9-ca6e2ba22b40/scratchpad/shots"
OUT   = "/tmp/claude-0/-home-user-Viva-Nomads-Oficial/28cadf6c-333b-5a9c-9cb9-ca6e2ba22b40/scratchpad/out"
os.makedirs(OUT, exist_ok=True)
W, H, FPS = 1080, 1920, 30
FB = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
FR = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
def font(sz, bold=True): return ImageFont.truetype(FB if bold else FR, sz)

FOREST=(15,61,46); SAGE=(90,138,107); GOLD=(200,162,75); WHITE=(255,255,255)
VIVA=(30,99,208); NOM=(108,190,58)

def ease(t): return 0.5-0.5*math.cos(math.pi*max(0,min(1,t)))  # ease-in-out

def radial_bg():
    yy,xx=np.mgrid[0:H,0:W].astype(np.float32)
    cx,cy=W/2,H*0.40
    d=np.sqrt((xx-cx)**2+(yy-cy)**2); d/=d.max()
    inner=np.array([20,58,44],np.float32); outer=np.array([7,26,20],np.float32)
    img=(inner*(1-d[...,None])+outer*d[...,None]).astype(np.uint8)
    return Image.fromarray(img,"RGB")

BG = radial_bg()

def wrap(draw,text,fnt,maxw):
    words=text.split(); lines=[]; cur=""
    for w in words:
        t=(cur+" "+w).strip()
        if draw.textlength(t,font=fnt)<=maxw: cur=t
        else: lines.append(cur); cur=w
    if cur: lines.append(cur)
    return lines

def ctext(draw,cx,y,text,fnt,fill,anchor="mm"):
    draw.text((cx,y),text,font=fnt,fill=fill,anchor=anchor)

# ---- phone geometry ----
PW,PH=780,1476; PX=(W-PW)//2; PY=306; BORD=20
IW,IH=PW-2*BORD,PH-2*BORD; IX,IY=PX+BORD,PY+BORD; RAD=46

def rounded_mask(w,h,r):
    m=Image.new("L",(w,h),0); d=ImageDraw.Draw(m)
    d.rounded_rectangle([0,0,w-1,h-1],radius=r,fill=255); return m

INNER_MASK=rounded_mask(IW,IH,RAD-6)

def phone_front():
    """Bezel (ring) + notch + soft shadow, as RGBA to paste ABOVE the screenshot."""
    lay=Image.new("RGBA",(W,H),(0,0,0,0)); d=ImageDraw.Draw(lay)
    # shadow
    sh=Image.new("RGBA",(W,H),(0,0,0,0)); ds=ImageDraw.Draw(sh)
    ds.rounded_rectangle([PX-6,PY-6,PX+PW+6,PY+PH+18],radius=RAD+8,fill=(0,0,0,150))
    sh=sh.filter(ImageFilter.GaussianBlur(22)); lay=Image.alpha_composite(lay,sh); d=ImageDraw.Draw(lay)
    # bezel ring: outer rounded rect (dark) with transparent rounded interior
    ring=Image.new("RGBA",(W,H),(0,0,0,0)); dr=ImageDraw.Draw(ring)
    dr.rounded_rectangle([PX,PY,PX+PW,PY+PH],radius=RAD,fill=(12,20,17,255))
    hole=rounded_mask(IW,IH,RAD-6)
    # cut interior by pasting transparency using hole mask
    trans=Image.new("RGBA",(IW,IH),(0,0,0,0))
    ring.paste(trans,(IX,IY),hole)
    lay=Image.alpha_composite(lay,ring); d=ImageDraw.Draw(lay)
    # notch
    nw,nh=210,34; nx=PX+(PW-nw)//2; ny=PY+16
    d.rounded_rectangle([nx,ny,nx+nw,ny+nh],radius=17,fill=(12,20,17,255))
    return lay

PHONE_FRONT=phone_front()

SCENES=[
    dict(shot="home.png",        step="1", title="Seu lar temporário",    sub="Comece pela cidade — estadias de 30+ dias"),
    dict(shot="buscar.png",      step="2", title="Busque no mapa",        sub="Filtre por prazo, garantia e comodidades"),
    dict(shot="imovel.png",      step="3", title="Imóvel verificado",     sub="Mobiliado e pronto pra trabalhar"),
    dict(shot="como-funciona.png",step="4",title="Sem burocracia",        sub="Do interesse ao contrato, tudo online"),
    dict(shot="precos.png",      step="5", title="Preço transparente",    sub="Você sabe o que paga, com tudo incluído"),
    dict(shot="proprietarios.png",step="6",title="Tem um imóvel?",        sub="Anuncie e receba interessados"),
]
CHIP="Estadias de 30+ dias · imóveis verificados"
NSC=len(SCENES)
DUR_INTRO=2.6; DUR_SCENE=4.8; DUR_OUTRO=3.4; FADE=0.3
TITLE_F=font(56); SUB_F=font(30,False); STEP_F=font(26); CHIP_F=font(26,False)

def draw_chrome(base, sc, idx, prog):
    """Draw header (step/title/sub), chip and progress bar onto base (RGB)."""
    d=ImageDraw.Draw(base,"RGBA")
    # step pill
    st=f"PASSO {sc['step']} / {NSC}"
    w=d.textlength(st,font=STEP_F); px=W/2
    d.rounded_rectangle([px-w/2-16,96,px+w/2+16,140],radius=22,fill=(200,162,75,40))
    ctext(d,px,118,st,STEP_F,GOLD)
    ctext(d,W/2,190,sc["title"],TITLE_F,WHITE)
    for i,ln in enumerate(wrap(d,sc["sub"],SUB_F,W-160)):
        ctext(d,W/2,240+i*38,ln,SUB_F,(210,222,215))
    # chip (fixed)
    cw=d.textlength(CHIP,font=CHIP_F); cy=PY+PH+34
    d.rounded_rectangle([W/2-cw/2-22,cy-24,W/2+cw/2+22,cy+24],radius=26,fill=(255,255,255,26),outline=(200,162,75,120),width=2)
    ctext(d,W/2,cy,CHIP,CHIP_F,WHITE)
    # progress bar
    by=1868; bx0=90; bx1=W-90
    d.rounded_rectangle([bx0,by,bx1,by+10],radius=5,fill=(255,255,255,40))
    d.rounded_rectangle([bx0,by,bx0+(bx1-bx0)*prog,by+10],radius=5,fill=GOLD)
    return base

def scene_back(sc):
    return BG.copy()

def prep_shot(sc):
    im=Image.open(os.path.join(SHOTS,sc["shot"])).convert("RGB")
    sw,sh=im.size; nw=IW; nh=int(sh*nw/sw)
    return im.resize((nw,nh))

def blend_black(img,f):
    if f>=1: return img
    return Image.blend(Image.new("RGB",img.size,(0,0,0)),img,max(0,min(1,f)))

def add_scene(writer, sc, idx):
    back=scene_back(sc); shot=prep_shot(sc)
    pan_max=max(0,shot.size[1]-IH); pan_max=min(pan_max,int(DUR_SCENE*330))
    n=int(DUR_SCENE*FPS)
    prog=(idx+1)/NSC
    for k in range(n):
        t=k/max(1,n-1)
        pan=int(ease(t)*pan_max)
        f=back.copy()
        crop=shot.crop((0,pan,IW,pan+IH))
        f.paste(crop,(IX,IY),INNER_MASK)
        f.paste(PHONE_FRONT,(0,0),PHONE_FRONT)
        draw_chrome(f,sc,idx,prog)
        tin=k/FPS; tout=(n-1-k)/FPS
        fac=min(1,tin/FADE if FADE>0 else 1, tout/FADE if FADE>0 else 1)
        f=blend_black(f,fac)
        writer.append_data(np.asarray(f))

def card(writer, dur, lines, sub=None, domain=None):
    n=int(dur*FPS)
    base=BG.copy(); d=ImageDraw.Draw(base)
    for f_i in range(n):
        t=f_i/max(1,n-1); ap=ease(min(1,t*1.6))
        img=BG.copy(); dd=ImageDraw.Draw(img,"RGBA")
        # wordmark
        wm_f=font(96); vy=H*0.40
        vw=dd.textlength("Viva",font=wm_f); nw=dd.textlength("Nomads",font=wm_f); tot=vw+nw
        dd.text((W/2-tot/2,vy),"Viva",font=wm_f,fill=VIVA,anchor="lm")
        dd.text((W/2-tot/2+vw,vy),"Nomads",font=wm_f,fill=NOM,anchor="lm")
        if lines:
            ctext(dd,W/2,vy+120,lines,font(40),WHITE)
        if sub:
            ctext(dd,W/2,vy+180,sub,font(30,False),(200,162,75))
        if domain:
            dw=dd.textlength(domain,font=font(34))
            dd.rounded_rectangle([W/2-dw/2-26,vy+240,W/2+dw/2+26,vy+300],radius=30,fill=(200,162,75,255))
            ctext(dd,W/2,vy+270,domain,font(34),(12,20,17))
        writer.append_data(np.asarray(blend_black(img.convert("RGB"),ap)))

def make_thumb():
    im=Image.open(os.path.join(SHOTS,"home.png")).convert("RGB")
    sw,sh=im.size; nw=W; nh=int(sh*nw/sw); im=im.resize((nw,nh)).crop((0,0,W,H))
    im=im.filter(ImageFilter.GaussianBlur(3))  # desfoca o fundo pra virar backdrop
    # scrim escuro forte: base uniforme + reforço no topo e no rodapé
    grad=np.zeros((H,W,4),np.uint8)
    for y in range(H):
        top=1-min(1,y/(H*0.5)); bot=max(0,(y-H*0.45)/(H*0.55))
        a=150+int(70*top)+int(70*bot)
        grad[y,:]=[7,24,18,min(245,a)]
    base=Image.alpha_composite(im.convert("RGBA"),Image.fromarray(grad,"RGBA"))
    d=ImageDraw.Draw(base,"RGBA")
    # wordmark no topo
    wm=font(58); vw=d.textlength("Viva",font=wm); nw2=d.textlength("Nomads",font=wm); tot=vw+nw2
    d.text((W/2-tot/2,H*0.13),"Viva",font=wm,fill=(120,200,255),anchor="lm")
    d.text((W/2-tot/2+vw,H*0.13),"Nomads",font=wm,fill=(150,220,90),anchor="lm")
    # play button (centro-superior)
    py=H*0.40
    d.ellipse([W/2-78,py-78,W/2+78,py+78],fill=(255,255,255,240))
    d.polygon([(W/2-26,py-42),(W/2-26,py+42),(W/2+46,py)],fill=FOREST)
    # headline (terço inferior)
    hy=H*0.60
    lines=wrap(d,"Seu lar temporário em qualquer cidade",font(64),W-150)
    for i,ln in enumerate(lines):
        ctext(d,W/2,hy+i*74,ln,font(64),WHITE)
    ctext(d,W/2,hy+len(lines)*74+16,"Mobiliado · verificado · 30+ dias",font(34,False),(206,220,212))
    # domínio (rodapé)
    dw=d.textlength("vivanomads.com.br",font=font(40))
    dy=H*0.85
    d.rounded_rectangle([W/2-dw/2-30,dy-34,W/2+dw/2+30,dy+34],radius=34,fill=(200,162,75,255))
    ctext(d,W/2,dy,"vivanomads.com.br",font(40),(12,20,17))
    thumb=base.convert("RGB"); thumb.save(os.path.join(OUT,"capa.png")); return thumb

def main():
    thumb=make_thumb()
    path=os.path.join(OUT,"vivanomads_flow_mudo.mp4")
    writer=imageio.get_writer(path,fps=FPS,codec="libx264",quality=8,macro_block_size=1,
                              ffmpeg_params=["-pix_fmt","yuv420p"])
    # thumbnail 1s
    for _ in range(FPS): writer.append_data(np.asarray(thumb))
    card(writer,DUR_INTRO,"seu lar temporário",sub="em qualquer cidade")
    for i,sc in enumerate(SCENES): add_scene(writer,sc,i)
    card(writer,DUR_OUTRO,"viva como local",domain="vivanomads.com.br")
    writer.close()
    print("OK", path)

main()
