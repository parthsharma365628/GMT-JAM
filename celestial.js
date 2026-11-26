import * as T from 'three'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import cloudUrl from './heaven-cloud.glb?url'
import pillarUrl from './heaven-pillar.glb?url'

const loader=new GLTFLoader()
const cloudMaterial=new T.MeshStandardMaterial({color:0xf4f4ff,roughness:1})
const distantCloudMaterial=new T.MeshStandardMaterial({color:0xe5eafa,roughness:1})
const pillarMaterial=new T.MeshStandardMaterial({color:0xf2e9d9,roughness:.76})
pillarMaterial.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 pillarPoint;\n'+shader.vertexShader.replace(
    '#include <begin_vertex>','#include <begin_vertex>\npillarPoint=position;'
  )
  shader.fragmentShader='varying vec3 pillarPoint;\n'+shader.fragmentShader.replace('#include <color_fragment>',`
    #include <color_fragment>
    vec3 p=pillarPoint;
    float angle=atan(p.z,p.x);
    float shaft=smoothstep(.12,.19,p.y)*(1.0-smoothstep(.82,.89,p.y));
    float contour=angle*3.0+sin(p.y*13.0+angle)*.23+sin(p.y*36.0)*.04;
    float line=pow(.5+.5*cos(contour),34.0);
    float goldVein=smoothstep(.3,.72,line)*shaft;
    float collar=1.0-smoothstep(.009,.015,min(abs(p.y-.102),abs(p.y-.895)));
    float gold=max(goldVein,collar);
    float stone=.94+.05*sin(angle*17.0+p.y*46.0+sin(p.y*22.0));
    diffuseColor.rgb=mix(diffuseColor.rgb*stone,vec3(.75,.39,.054),gold);
  `).replace('#include <roughnessmap_fragment>',`
    #include <roughnessmap_fragment>
    roughnessFactor=mix(roughnessFactor,.36,gold);
  `).replace('#include <metalnessmap_fragment>',`
    #include <metalnessmap_fragment>
    metalnessFactor=mix(metalnessFactor,.24,gold);
  `)
}
let cloudGeometry=new T.SphereGeometry(.5,20,14).translate(0,.5,0)
let pillarGeometry=new T.CylinderGeometry(.36,.5,1,12).translate(0,.5,0)

async function loadGeometry(url,rotate){
  const {scene}=await loader.loadAsync(url)
  scene.updateMatrixWorld(true)
  let mesh
  scene.traverse(node=>{if(node.isMesh)mesh=node})
  if(!mesh)throw new Error('The model contains no mesh')
  const geometry=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld)
  if(rotate)geometry.rotateY(rotate)
  geometry.computeBoundingBox()
  const bounds=geometry.boundingBox
  const center=bounds.getCenter(new T.Vector3()), size=bounds.getSize(new T.Vector3())
  geometry.translate(-center.x,-bounds.min.y,-center.z).scale(1/size.x,1/size.y,1/size.z)
  return {geometry,material:mesh.material}
}

export const celestialReady=Promise.all([
  loadGeometry(cloudUrl,Math.PI/2).then(({geometry})=>{cloudGeometry=geometry})
    .catch(error=>console.warn('Using a simple cloud mesh',error)),
  loadGeometry(pillarUrl,0).then(({geometry,material})=>{
    pillarGeometry=geometry
    pillarMaterial.normalMap=material.normalMap
    pillarMaterial.normalScale.set(.56,.56)
    pillarMaterial.needsUpdate=true
  }).catch(error=>console.warn('Using a simple Heaven pillar',error))
])

export function celestialPillar(parent,x,y,z,width,height,heading=0){
  const mesh=new T.Mesh(pillarGeometry,pillarMaterial)
  mesh.position.set(x,y,z)
  mesh.rotation.y=heading
  mesh.scale.set(width,height,width)
  parent.add(mesh)
}

export function celestialCloud(parent,x,y,z,width,height,depth,reverse=false,distant=false){
  const mesh=new T.Mesh(cloudGeometry,distant?distantCloudMaterial:cloudMaterial)
  mesh.position.set(x,y,z)
  mesh.rotation.y=reverse?Math.PI:0
  mesh.scale.set(width,height,depth)
  parent.add(mesh)
}

let sky
export function celestialSky(){
  if(sky)return sky
  const canvas=document.createElement('canvas')
  canvas.width=640;canvas.height=360
  const ctx=canvas.getContext('2d')
  const gradient=ctx.createLinearGradient(0,0,0,360)
  for(const [at,color] of [[0,'#7096ce'],[.37,'#a9c4e7'],[.61,'#d9e4f3'],[.82,'#f5e7d8'],[1,'#d4dcef']]){
    gradient.addColorStop(at,color)
  }
  ctx.fillStyle=gradient;ctx.fillRect(0,0,640,360)
  const halo=ctx.createRadialGradient(489,85,5,489,85,177)
  halo.addColorStop(0,'rgba(255,250,225,.94)')
  halo.addColorStop(.11,'rgba(255,242,210,.55)')
  halo.addColorStop(1,'rgba(255,235,219,0)')
  ctx.fillStyle=halo;ctx.fillRect(0,0,640,360)
  sky=new T.CanvasTexture(canvas)
  sky.colorSpace=T.SRGBColorSpace
  return sky
}

const cloudTime={value:0}
const deckMaterial=new T.MeshBasicMaterial({color:0xffffff})
deckMaterial.onBeforeCompile=shader=>{
  shader.uniforms.cloudTime=cloudTime
  shader.vertexShader='varying vec2 deckPoint;\n'+shader.vertexShader.replace(
    '#include <begin_vertex>','#include <begin_vertex>\ndeckPoint=(modelMatrix*vec4(position,1.0)).xz;'
  )
  shader.fragmentShader=`
    varying vec2 deckPoint;
    uniform float cloudTime;
    float hash2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float cloudNoise(vec2 p){
      vec2 cell=floor(p), f=fract(p);
      f=f*f*(3.0-2.0*f);
      return mix(mix(hash2(cell),hash2(cell+vec2(1,0)),f.x),
                 mix(hash2(cell+vec2(0,1)),hash2(cell+vec2(1,1)),f.x),f.y);
    }
  `+shader.fragmentShader.replace('#include <color_fragment>',`
    #include <color_fragment>
    vec2 p=deckPoint*.091+vec2(cloudTime*.018,cloudTime*.006);
    float layers=cloudNoise(p)*.57+cloudNoise(p*2.2)*.28+cloudNoise(p*4.9)*.15;
    float softCloud=smoothstep(.25,.76,layers);
    diffuseColor.rgb=mix(vec3(.45,.54,.72),vec3(.91,.91,.97),softCloud);
  `)
}
const deckGeometry=new T.PlaneGeometry(1,1).rotateX(-Math.PI/2)
export function celestialCloudDeck(parent,x,z,width,depth){
  const deck=new T.Mesh(deckGeometry,deckMaterial)
  deck.position.set(x,-8.5,z)
  deck.scale.set(width,1,depth)
  parent.add(deck)
}
export function updateCloudDeck(time){cloudTime.value=time}
