import * as T from 'three'

const size=256
const clamp=x=>Math.max(0,Math.min(1,x))
const lerp=(a,b,t)=>a+(b-a)*t
const wrap=(x,n)=>(x%n+n)%n

function hash(x,y){
  let h=Math.imul(x+29,374761393)+Math.imul(y+37,668265263)
  h=Math.imul(h^(h>>>13),1274126177)
  return ((h^(h>>>16))>>>0)/4294967296
}

function noise(u,v,columns,rows=columns){
  const x=u*columns,y=v*rows,i=Math.floor(x),j=Math.floor(y)
  const a=x-i,b=y-j,s=a*a*(3-2*a),t=b*b*(3-2*b)
  const p=wrap(i,columns),q=wrap(j,rows),r=wrap(i+1,columns),w=wrap(j+1,rows)
  return lerp(lerp(hash(p,q),hash(r,q),s),lerp(hash(p,w),hash(r,w),s),t)
}

function basalt(u,v){
  const cells=9,x=u*cells,y=v*cells,i=Math.floor(x),j=Math.floor(y)
  let first=Infinity,second=Infinity,stone=0
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
    const a=wrap(i+dx,cells),b=wrap(j+dz,cells)
    const px=i+dx+.25+hash(a,b)*.5,py=j+dz+.25+hash(a+15,b)*.5
    const d=(x-px)**2+(y-py)**2
    if(d<first){second=first;first=d;stone=hash(a,b+19)}
    else if(d<second)second=d
  }
  const grain=noise(u,v,75),seam=clamp((second-first+grain*.025)*20)
  const layers=noise(u+.045*noise(u,v,8),v,12,39)
  const shade=15+seam*(13+stone*18+layers*18+grain*12)
  return [shade*1.05,shade*.97,shade*.94,seam*.74+grain*.24]
}

function grass(u,v){
  const patch=noise(u,v,6)*.65+noise(u,v,23)*.35
  const blades=noise(u+.018*noise(u,v,8),v,126,58)
  const soil=clamp((.46-patch)*5)
  return [lerp(37+patch*56,92,soil)+blades*19,
    lerp(64+patch*66,70,soil)+blades*28,
    lerp(24+patch*39,43,soil)+blades*12,blades*.62+patch*.38]
}

function marble(u,v){
  const warp=noise(u,v,4)*.62+noise(u,v,9)*.23+noise(u,v,24)*.032
  const pattern=Math.abs(Math.sin((u+v+warp)*Math.PI*2))
  const strength=.25+noise(u,v,8)*.75
  const vein=((1-clamp(pattern*9))*.55+(1-pattern)**7*.29)*strength
  const cloud=noise(u,v,8)*13+noise(u,v,31)*6
  return [227+cloud-vein*101,222+cloud-vein*107,218+cloud-vein*108,.52+noise(u,v,45)*.17-vein*.16]
}

function carpet(u,v){
  const weave=noise(u,v,120,120)*.66+noise(u,v,44,130)*.34
  return [104+weave*51,14+weave*17,25+weave*24,weave]
}

function surface(sample,metres,roughness,bumpScale){
  const canvas=document.createElement('canvas'),height=document.createElement('canvas')
  canvas.width=canvas.height=height.width=height.height=size
  const colorCtx=canvas.getContext('2d'),heightCtx=height.getContext('2d')
  const colorData=colorCtx.createImageData(size,size),heightData=heightCtx.createImageData(size,size)
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const [r,g,b,h]=sample(x/size,y/size),i=(x+y*size)*4
    colorData.data.set([r,g,b,255],i)
    heightData.data.set([h*255,h*255,h*255,255],i)
  }
  colorCtx.putImageData(colorData,0,0);heightCtx.putImageData(heightData,0,0)
  const texture=image=>{
    const map=new T.CanvasTexture(image)
    map.wrapS=map.wrapT=T.RepeatWrapping
    map.anisotropy=8
    return map
  }
  const map=texture(canvas)
  map.colorSpace=T.SRGBColorSpace
  const material=new T.MeshStandardMaterial({map,bumpMap:texture(height),roughness,bumpScale})
  // Use world coordinates to keep scale and alignment across slabs and bends.
  material.onBeforeCompile=shader=>{
    shader.uniforms.floorTileSize={value:metres}
    shader.vertexShader='uniform float floorTileSize;\n'+shader.vertexShader.replace('#include <uv_vertex>',`
      #include <uv_vertex>
      vec3 point=(modelMatrix*vec4(position,1.0)).xyz;
      vec3 face=mat3(modelMatrix)*normal;
      vec2 surfacePoint=abs(normal.y)>0.5?point.xz:
        vec2(dot(point.xz,normalize(vec2(face.z,-face.x))),point.y);
      vMapUv=surfacePoint/floorTileSize;
      vBumpMapUv=vMapUv;
    `)
  }
  return material
}

const blackstone=surface(basalt,13,.93,.12)
const meadow=surface(grass,11,1,.045)
export const marbleFloor=surface(marble,14,.42,.025)
export const redCarpet=surface(carpet,2.3,.98,.018)
export const realmFloor=cfg=>cfg.celestial?marbleFloor:cfg.forest?meadow:blackstone
