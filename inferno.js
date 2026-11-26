import * as T from 'three'
import shrineUrl from './hell-shrine-backdrop.png?url'

let sky,shrineImage
export const infernoReady=new T.ImageLoader().loadAsync(shrineUrl).then(image=>{
  shrineImage=image
}).catch(error=>console.warn('Using the procedural Hell sky',error))

export function infernalSky(){
  if(sky)return sky
  const canvas=document.createElement('canvas')
  canvas.width=1280;canvas.height=768
  const ctx=canvas.getContext('2d')
  const pixels=ctx.createImageData(canvas.width,canvas.height)
  const {lerp,smoothstep}=T.MathUtils
  const hash=(x,y)=>{
    const n=Math.sin(x*127.1+y*311.7)*43758.5453
    return n-Math.floor(n)
  }
  const noise=(x,y)=>{
    const ix=Math.floor(x),iy=Math.floor(y)
    const a=smoothstep(x-ix,0,1),b=smoothstep(y-iy,0,1)
    return lerp(lerp(hash(ix,iy),hash(ix+1,iy),a),lerp(hash(ix,iy+1),hash(ix+1,iy+1),a),b)
  }
  for(let y=0;y<canvas.height;y++){
    const v=y/(canvas.height-1)
    const horizon=Math.exp(-((v-.31)**2)/.009)
    const fireHaze=Math.exp(-((v-.19)**2)/.036)
    for(let x=0;x<canvas.width;x++){
      const u=x/(canvas.width-1)
      const warp=noise(u*5+17,v*4)*1.35
      const clouds=noise(u*7+warp,v*5)*.48+noise(u*15,v*12+warp)*.28+
        noise(u*36,v*29)*.16+noise(u*85+warp,v*68)*.08
      const edge=smoothstep(clouds,.42,.55)-smoothstep(clouds,.55,.66)
      const ember=(smoothstep(clouds,.37,.77)+edge*.25)*fireHaze
      const smoke=smoothstep(clouds,.26,.7)*horizon
      const i=(y*canvas.width+x)*4
      pixels.data[i]=12+119*ember+12*smoke
      pixels.data[i+1]=7+15*ember+64*smoke
      pixels.data[i+2]=17+24*ember+76*smoke
      pixels.data[i+3]=255
    }
  }
  ctx.putImageData(pixels,0,0)
  if(shrineImage){
    const layer=document.createElement('canvas')
    layer.width=canvas.width;layer.height=canvas.height
    const ink=layer.getContext('2d')
    const height=canvas.height*.67
    const width=height*shrineImage.width/shrineImage.height
    const x=(canvas.width-width)/2,y=-canvas.height*.025
    ink.filter='contrast(1.12) saturate(1.1)'
    ink.drawImage(shrineImage,x,y,width,height)
    ink.filter='none'
    ink.globalCompositeOperation='destination-in'
    const edges=ink.createLinearGradient(x,0,x+width,0)
    for(const [at,alpha] of [[0,0],[.13,1],[.87,1],[1,0]])edges.addColorStop(at,`rgba(0,0,0,${alpha})`)
    ink.fillStyle=edges;ink.fillRect(0,0,layer.width,layer.height)
    const fade=ink.createLinearGradient(0,0,0,layer.height)
    for(const [at,alpha] of [[0,1],[.33,1],[.57,0],[1,0]])fade.addColorStop(at,`rgba(0,0,0,${alpha})`)
    ink.fillStyle=fade;ink.fillRect(0,0,layer.width,layer.height)
    ctx.drawImage(layer,0,0)
  }
  sky=new T.CanvasTexture(canvas)
  sky.colorSpace=T.SRGBColorSpace
  return sky
}

const time={value:0}
const lavaMaterial=new T.MeshBasicMaterial({color:0xffffff})
lavaMaterial.onBeforeCompile=shader=>{
  shader.uniforms.infernoTime=time
  shader.vertexShader='varying vec2 lavaPoint;\n'+shader.vertexShader.replace(
    '#include <begin_vertex>','#include <begin_vertex>\nlavaPoint=(modelMatrix*vec4(position,1.0)).xz;'
  )
  shader.fragmentShader=`
    varying vec2 lavaPoint;
    uniform float infernoTime;
    float hashLava(vec2 p){return fract(sin(dot(p,vec2(41.7,289.3)))*43758.5453);}
    float smokeNoise(vec2 p){
      vec2 i=floor(p),f=fract(p);
      f=f*f*(3.0-2.0*f);
      return mix(mix(hashLava(i),hashLava(i+vec2(1,0)),f.x),
                 mix(hashLava(i+vec2(0,1)),hashLava(i+vec2(1,1)),f.x),f.y);
    }
  `+shader.fragmentShader.replace('#include <color_fragment>',`
    #include <color_fragment>
    vec2 p=lavaPoint*.23+vec2(infernoTime*.055,infernoTime*.018);
    float field=smokeNoise(p*.60)*.74+smokeNoise(p*2.7)*.26;
    float melt=1.0-smoothstep(.026,.14,abs(field-.55));
    float seams=pow(melt,3.0);
    float reflection=smoothstep(.65,.88,smokeNoise(p*.37))*smoothstep(.16,.55,field);
    diffuseColor.rgb=mix(vec3(.016,.009,.024),vec3(.33,.027,.015),melt);
    diffuseColor.rgb+=vec3(.45,.074,.012)*seams+vec3(.018,.07,.082)*reflection;
  `)
}
const lavaGeometry=new T.PlaneGeometry(1,1).rotateX(-Math.PI/2)
export function infernalLava(parent,x,z,width,depth){
  const lava=new T.Mesh(lavaGeometry,lavaMaterial)
  lava.position.set(x,-4.75,z)
  lava.scale.set(width,1,depth)
  parent.add(lava)
}
export function updateInfernalLava(clock){time.value=clock}

const cube=new T.BoxGeometry()
const obsidian=new T.MeshStandardMaterial({color:0x191822,roughness:.93,flatShading:true})
const brick=new T.MeshStandardMaterial({color:0x622e33,roughness:.79,flatShading:true})
const iron=new T.MeshStandardMaterial({color:0x303745,roughness:.66,flatShading:true})
const embers=new T.MeshBasicMaterial({color:0xff6c3d})
const coldFlame=new T.MeshBasicMaterial({color:0x55c0d5})
const innerSeal=new T.MeshBasicMaterial({color:0x227f9a,side:T.DoubleSide})
const sealGeometry=new T.RingGeometry(.85,1,8)
const spireGeometry=new T.ConeGeometry(.52,1,4)
const foundation=new T.CylinderGeometry(.86,1,1,7)
const gableProfile=new T.Shape()
gableProfile.moveTo(-.5,0)
gableProfile.lineTo(-.5,.16)
gableProfile.lineTo(-.32,.12)
gableProfile.lineTo(0,.92)
gableProfile.lineTo(.32,.12)
gableProfile.lineTo(.5,.16)
gableProfile.lineTo(.5,0)
gableProfile.closePath()
const gableGeometry=new T.ExtrudeGeometry(gableProfile,{depth:1,bevelEnabled:false}).translate(0,0,-.5)

export function infernalShrine(parent,x,z,heading,size=1){
  const shrine=new T.Group()
  shrine.position.set(x,-4.7,z)
  shrine.rotation.y=heading
  shrine.scale.setScalar(size)
  parent.add(shrine)
  const part=(geo,mat,x,y,z,w,h,d)=>{
    const mesh=new T.Mesh(geo,mat)
    mesh.position.set(x,y,z);mesh.scale.set(w,h,d);shrine.add(mesh)
    return mesh
  }
  const block=(mat,x,y,z,w,h,d)=>part(cube,mat,x,y,z,w,h,d)
  part(foundation,obsidian,0,.4,0,6.2,2.0,4.7)
  block(iron,0,1.6,0,10,.45,6.2)
  block(brick,0,1.96,.25,8.5,.34,5.2)
  block(obsidian,0,4.5,-1.65,8.1,5.0,.7)
  for(const side of [-1,1]){
    const x=side*3.05
    block(brick,x,4.55,1.45,1.13,5.25,1.15)
    block(embers,x,4.73,2.055,.14,3.84,.024)
    block(iron,x,6.5,1.45,1.64,.32,1.6)
    block(obsidian,side*4.75,3.08,.85,.86,2.7,1.0)
    block(coldFlame,side*4.75,3.8,1.37,.27,.6,.036)
    part(spireGeometry,iron,side*4.75,4.8,.85,1.06,.84,1.06).rotation.y=Math.PI/4
  }
  block(embers,0,6.62,2.14,7.3,.11,.09)
  block(brick,0,6.98,.4,9.4,.52,3.85)
  part(gableGeometry,iron,0,7.17,.25,10.5,1.82,4.7)
  block(obsidian,0,8.55,-.72,5.0,.7,2.54)
  part(gableGeometry,obsidian,0,8.82,-.75,6.2,1.18,3.05)
  part(sealGeometry,innerSeal,0,4.55,-1.16,1.25,1.25,1)
  block(coldFlame,0,4.55,-1.14,.10,1.55,.036).rotation.z=Math.PI/4
  block(coldFlame,0,4.55,-1.14,.10,1.55,.036).rotation.z=-Math.PI/4
  for(let i=0;i<3;i++)block(obsidian,0,1.35-i*.29,3.05+i*.57,5.45+i*.53,.48,1.2)
}
