import * as T from 'three'

const span=30
const surface=new T.PlaneGeometry(span,span).rotateX(-Math.PI/2)
const tau=Math.PI*2
const polar=(r,a)=>[Math.cos(a)*r,Math.sin(a)*r]
const noise=i=>{
  const n=Math.sin(i*127.1+53.7)*43758.5453
  return n-Math.floor(n)
}

function stroke(ctx,points,color,width){
  ctx.beginPath()
  ctx.moveTo(...points[0])
  for(const point of points.slice(1))ctx.lineTo(...point)
  ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke()
}

function ring(ctx,r,color,width){
  ctx.beginPath();ctx.arc(0,0,r,0,tau)
  ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke()
}

function ritual(ctx){
  const red='#c52b35', dark='#4e0c17', light='#f35850'
  ctx.lineJoin='round';ctx.lineCap='round'
  for(const [r,w] of [[13.5,.11],[12.95,.045],[11.45,.11],[10.84,.065],[9.45,.09],[8.89,.055],[4.4,.075],[3.75,.11],[2.52,.075],[1.88,.07]]){
    ring(ctx,r,dark,w+.10);ring(ctx,r,red,w)
  }
  const glyphs=[
    [[-.27,.27],[0,-.34],[.26,.27]], [[-.28,-.08],[.28,-.08]],
    [[-.22,.3],[-.22,-.31],[.28,-.03],[-.22,.22]],
    [[-.26,-.29],[.27,.26]], [[.23,-.30],[-.22,.27]],
    [[0,.34],[0,-.35],[.29,-.16],[0,.07]],
    [[-.28,.18],[0,-.33],[.26,.13],[0,.35],[-.28,.18]],
    [[-.26,-.28],[.28,-.28],[0,.34],[0,-.28]],
    [[-.26,.29],[-.02,-.26],[.03,.08],[.28,-.24]]
  ]
  for(const [r,count] of [[12.22,52],[10.16,44],[3.11,16]]){
    for(let i=0;i<count;i++){
      const angle=(i+.5)*tau/count
      ctx.save();ctx.translate(...polar(r,angle));ctx.rotate(angle+Math.PI/2)
      const scale=.86+.27*noise(i+count)
      ctx.scale(scale,scale)
      const key=Math.floor(noise(i*3+count)*glyphs.length)
      stroke(ctx,glyphs[key],i%7===0?light:red,.055)
      if(i%3===0)stroke(ctx,[[.34,-.22],[.38,.03]],red,.049)
      if(i%4===1)stroke(ctx,[[-.42,-.32],[-.4,.28]],dark,.05)
      ctx.restore()
    }
  }
  // Crossed diamonds, radial ticks, and a small seal anchor the bands of runes.
  for(let turn=0;turn<2;turn++){
    const corners=Array.from({length:5},(_,i)=>polar(8.89,Math.PI/4*i*2+turn*Math.PI/4))
    stroke(ctx,corners,dark,.15);stroke(ctx,corners,red,.081)
  }
  for(let i=0;i<8;i++){
    const angle=i*tau/8
    stroke(ctx,[polar(4.4,angle),polar(8.89,angle)],red,.045)
    stroke(ctx,[polar(13.08,angle),polar(13.88,angle)],light,.11)
    stroke(ctx,[polar(1.26,angle),polar(.44,angle)],red,.075)
  }
  ring(ctx,.44,light,.11)
  ctx.globalCompositeOperation='destination-out'
  for(let i=0;i<2600;i++){
    ctx.fillStyle=`rgba(0,0,0,${.13+noise(i+400)*.55})`
    ctx.fillRect(noise(i*2)*28-14,noise(i*2+1)*28-14,.035+noise(i+7)*.12,.035+noise(i+9)*.08)
  }
  ctx.globalCompositeOperation='source-over'
}

function wedge(ctx,inner,outer,a,b){
  ctx.beginPath();ctx.arc(0,0,outer,a,b)
  ctx.arc(0,0,inner,b,a,true);ctx.closePath()
}

function grove(ctx){
  const stones=['#776e4b','#91835a','#847750','#a29161','#6f684c','#8b845d']
  ctx.beginPath();ctx.arc(0,0,6.15,0,tau);ctx.fillStyle='#786c4e';ctx.fill()
  for(const [row,inner,outer,count] of [[0,.04,1.7,6],[1,1.7,3.5,12],[2,3.5,5.48,19],
    [3,5.48,6.36,24],[4,6.39,7.17,29],[5,8.97,9.66,38],[6,10.3,11.05,46],[7,11.57,12.38,52]]){
    for(let i=0;i<count;i++){
      const n=i+row*59, a=(i+row*.42)*tau/count, b=a+tau/count
      if(row>=5 && noise(n+19)<.13)continue
      const start=a+.006,end=b-.007,r0=inner+.025,r1=outer-.025-noise(n)*.10
      wedge(ctx,r0,r1,start,end)
      ctx.fillStyle=stones[Math.floor(noise(n+5)*stones.length)];ctx.fill()
      ctx.strokeStyle='#463f2d';ctx.lineWidth=.043;ctx.stroke()
      if(row>=3){
        ctx.beginPath();ctx.arc(0,0,r0+.06,start+.019,end-.019)
        ctx.strokeStyle='rgba(216,194,132,.48)';ctx.lineWidth=.045;ctx.stroke()
      }
      if(noise(n+7)<.50){
        const mid=(start+end)/2
        stroke(ctx,[polar(r1,mid),polar(r1-.22,mid+.018),polar(r0+.11,mid-.014)],'#514a35',.045)
      }
    }
  }
  ring(ctx,6.37,'#a99763',.10)
  ring(ctx,5.44,'#504734',.06)
  // Darken the stone with moss, heavier around the broken outer courses.
  for(let i=0;i<2100;i++){
    const a=noise(i*2+500)*tau,r=(noise(i*2+501)**.6)*12.66
    const [x,y]=polar(r,a), s=.055+noise(i+43)*.22
    ctx.beginPath();ctx.ellipse(x,y,s,s*.64,a,0,tau)
    ctx.fillStyle=r>5.3?'rgba(65,94,31,.36)':'rgba(77,93,35,.21)';ctx.fill()
  }
  for(const [i,a] of [.37,1.68,2.37,3.63,4.95,5.59].entries()){
    const end=8.85-noise(i+33)*3.15
    const root=[polar(13.55,a),polar(12.6,a+.022),polar(11.58,a-.012),polar(10.53,a+.06),polar(end,a+.11)]
    stroke(ctx,root,'#463523',.23)
    stroke(ctx,root,'#6a5333',.095)
    stroke(ctx,[root[1],polar(11.4,a-.11),polar(9.92,a-.19)],'#59432e',.113)
    stroke(ctx,[root[2],polar(10.69,a+.13),polar(9.7,a+.21)],'#59432e',.09)
  }
}

function sunMosaic(ctx){
  const gold=['#bd7920','#e1ad49','#d2992f','#f2c969','#c98b2a','#f6dc8d']
  const grout='#916022', shadow='#a36c29', shine='#f8df98'
  const rays=16
  ctx.beginPath();ctx.arc(0,0,4.05,0,tau)
  for(let i=0;i<rays;i++){
    const a=i*tau/rays, tip=i%2===0?10.85:8.25
    ctx.moveTo(...polar(3.35,a-.15))
    ctx.lineTo(...polar(5.7,a-.112));ctx.lineTo(...polar(tip,a))
    ctx.lineTo(...polar(5.7,a+.112));ctx.lineTo(...polar(3.35,a+.15));ctx.closePath()
  }
  ctx.fillStyle=grout;ctx.fill()
  ctx.save();ctx.clip()
  // Stagger the tesserae so the rays and sun disk read as one piece of tilework.
  for(let row=-28;row<28;row++)for(let col=-28;col<28;col++){
    const key=(row+28)*56+col+28, x=(col+(row%2)*.5)*.40,y=row*.40
    ctx.fillStyle=gold[Math.floor(noise(key+17)*gold.length)]
    ctx.fillRect(x+.016,y+.016,.368,.368)
    ctx.fillStyle='rgba(255,246,187,.28)';ctx.fillRect(x+.04,y+.033,.31,.033)
  }
  ctx.restore()
  ring(ctx,4.05,shadow,.15);ring(ctx,3.85,shine,.081)

  // A small compass rose sits inside the sun, with a ring of gold and lapis around it.
  const star=Array.from({length:16},(_,i)=>polar(i%2===0?2.82:1.13,i*tau/16))
  ctx.beginPath();ctx.moveTo(...star[0]);for(const point of star.slice(1))ctx.lineTo(...point);ctx.closePath()
  ctx.fillStyle='#fce7a0';ctx.fill();ctx.strokeStyle='#a86924';ctx.lineWidth=.083;ctx.stroke()
  ring(ctx,3.15,shadow,.07);ring(ctx,.62,shadow,.09)
  for(const [inner,outer,count] of [[11.32,11.68,92],[12.06,12.66,108]]){
    for(let i=0;i<count;i++){
      const a=i*tau/count,b=(i+1)*tau/count
      wedge(ctx,inner,outer,a+.002,b-.002)
      ctx.fillStyle=i%9===0?'#466687':gold[Math.floor(noise(i+count)*gold.length)]
      ctx.fill()
    }
  }
  for(const r of [11.25,11.74,11.99,12.72,13.05])ring(ctx,r,r===13.05?shine:shadow,r===13.05?.075:.058)
  for(let i=0;i<8;i++){
    const a=i*tau/8
    const diamond=[polar(13.7,a),polar(13.03,a+.033),polar(12.40,a),polar(13.03,a-.033)]
    ctx.beginPath();ctx.moveTo(...diamond[0]);for(const point of diamond.slice(1))ctx.lineTo(...point);ctx.closePath()
    ctx.fillStyle='#d7a043';ctx.fill();ctx.strokeStyle=shadow;ctx.lineWidth=.065;ctx.stroke()
  }
}

function decal(draw,lit){
  const canvas=document.createElement('canvas')
  canvas.width=canvas.height=1024
  const ctx=canvas.getContext('2d')
  ctx.translate(512,512);ctx.scale(1024/span,1024/span)
  draw(ctx)
  const map=new T.CanvasTexture(canvas)
  map.colorSpace=T.SRGBColorSpace;map.anisotropy=8
  const options={map,transparent:true,depthWrite:false}
  return lit?new T.MeshStandardMaterial({...options,roughness:1}):new T.MeshBasicMaterial(options)
}

const designs={hell:ritual,earth:grove,heaven:sunMosaic}
const materials={}

export function addArenaInlay(parent,cfg){
  const realm=cfg.infernal?'hell':cfg.forest?'earth':cfg.celestial?'heaven':null
  if(!realm)return
  const mat=materials[realm]??=decal(designs[realm],realm!=='hell')
  const inlay=new T.Mesh(surface,mat)
  inlay.position.y=.008
  inlay.renderOrder=-1
  parent.add(inlay)
}
