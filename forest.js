import * as T from 'three'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js'
import treeUrl from './middle-earth-tree.glb?url'

const noise=seed=>{
  const value=Math.sin(seed*132.7+41.3)*43758.5453
  return value-Math.floor(value)
}

const foliageMaterial=new T.MeshStandardMaterial({vertexColors:true,roughness:1,flatShading:true})
const barkMaterial=new T.MeshStandardMaterial({color:0x493521,roughness:1})
const bankMaterial=new T.MeshStandardMaterial({color:0x424c29,roughness:1,flatShading:true})
const bankGeometry=new T.IcosahedronGeometry(1,1)
const fallbackTrunk=new T.CylinderGeometry(.017,.036,1,7).translate(0,.5,0)

function pineCrown(seed){
  const pieces=[]
  const colors=[0x263c2b,0x324c30,0x3c5533,0x4c6638]
  for(let tier=0;tier<7;tier++){
    const height=.40+tier*.087
    const reach=.15*(1-tier/8)
    for(let arm=0;arm<5;arm++){
      const key=seed+tier*17+arm*3
      const angle=arm*Math.PI*.4+tier*1.1+noise(key)*.7
      const radius=reach*(.44+noise(key+1)*.42)
      const piece=new T.IcosahedronGeometry(1,1)
      piece.scale(reach*(.73+noise(key+2)*.24),.037+noise(key+3)*.018,reach*.63)
      piece.rotateY(-angle)
      piece.translate(Math.cos(angle)*radius,height+noise(key+4)*.035,Math.sin(angle)*radius)
      const base=new T.Color(colors[(tier+arm+seed)%colors.length])
      const position=piece.attributes.position
      const rgb=[]
      for(let i=0;i<position.count;i++){
        const shade=.86+.24*noise(key+position.getX(i)*243+position.getZ(i)*177)
        rgb.push(base.r*shade,base.g*shade,base.b*shade)
      }
      piece.setAttribute('color',new T.Float32BufferAttribute(rgb,3))
      pieces.push(piece)
    }
  }
  const crown=mergeGeometries(pieces)
  for(const piece of pieces)piece.dispose()
  return crown
}
const crowns=[pineCrown(10),pineCrown(23),pineCrown(37)]

let trunkGeometry=fallbackTrunk, trunkMaterial=barkMaterial
export const forestReady=new GLTFLoader().loadAsync(treeUrl).then(({scene})=>{
  scene.updateMatrixWorld(true)
  let mesh
  scene.traverse(node=>{if(node.isMesh)mesh=node})
  if(!mesh)throw new Error('The forest tree model contains no mesh')
  const geometry=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld)
  geometry.computeBoundingBox()
  const bounds=geometry.boundingBox
  const height=bounds.max.y-bounds.min.y
  const center=bounds.getCenter(new T.Vector3())
  geometry.translate(-center.x,-bounds.min.y,-center.z).scale(1/height,1/height,1/height)
  trunkGeometry=geometry
  trunkMaterial=mesh.material
}).catch(error=>console.warn('Using a simple trunk for the forest trees',error))

export function forestTree(parent,x,z,seed,{background=false,grounded=false,scale=1}={}){
  const tree=new T.Group()
  const height=((background?13:11)+noise(seed)*5)*scale
  const width=height*(.86+noise(seed+1)*.25)
  tree.position.set(x,grounded?0:-4.16,z)
  tree.rotation.y=noise(seed+2)*Math.PI*2
  tree.scale.set(width,height,width)
  tree.add(new T.Mesh(trunkGeometry,trunkMaterial))
  tree.add(new T.Mesh(crowns[Math.floor(noise(seed+3)*crowns.length)],foliageMaterial))
  parent.add(tree)
  if(grounded)return
  const bank=new T.Mesh(bankGeometry,bankMaterial)
  bank.position.set(x,-4.49,z)
  bank.rotation.y=tree.rotation.y
  bank.scale.set(1.75+noise(seed+4)*.9,.72,1.35+noise(seed+5)*.8)
  parent.add(bank)
}

let sky
export function forestSky(){
  if(sky)return sky
  const canvas=document.createElement('canvas')
  canvas.width=2;canvas.height=256
  const ctx=canvas.getContext('2d')
  const gradient=ctx.createLinearGradient(0,0,0,256)
  for(const [at,color] of [[0,'#536e60'],[.34,'#83977e'],[.48,'#8c9c7d'],[.72,'#a8aa87'],[1,'#526b58']])gradient.addColorStop(at,color)
  ctx.fillStyle=gradient
  ctx.fillRect(0,0,2,256)
  sky=new T.CanvasTexture(canvas)
  sky.colorSpace=T.SRGBColorSpace
  return sky
}

const waterTime={value:0}
const waterMaterial=new T.MeshStandardMaterial({color:0x426e69,roughness:.48,metalness:.04})
waterMaterial.onBeforeCompile=shader=>{
  shader.uniforms.waterTime=waterTime
  shader.vertexShader='varying vec2 waterPoint;\n'+shader.vertexShader.replace(
    '#include <begin_vertex>','#include <begin_vertex>\nwaterPoint = (modelMatrix * vec4(position,1.0)).xz;'
  )
  shader.fragmentShader='varying vec2 waterPoint;\nuniform float waterTime;\n'+shader.fragmentShader.replace(
    '#include <color_fragment>',`
    #include <color_fragment>
    vec2 p=waterPoint;
    float swell=sin(p.y*1.5+p.x*.32-waterTime*.72+sin(p.x*.58+waterTime*.24)*.83);
    float ripple=sin(p.y*3.8-p.x*.57-waterTime*1.22+sin(p.x*1.02-p.y*.25)*.69);
    float crest=smoothstep(.78,.99,swell*.65+ripple*.35);
    float surface=.77+.10*swell+.065*ripple+crest*.45;
    diffuseColor.rgb*=surface;
    diffuseColor.rgb+=vec3(.034,.052,.049)*crest;
    `
  )
}

const waterGeometry=new T.PlaneGeometry(1,1).rotateX(-Math.PI/2)
export function forestWater(parent,x,z,width,depth){
  const water=new T.Mesh(waterGeometry,waterMaterial)
  water.position.set(x,-4.35,z)
  water.scale.set(width,1,depth)
  parent.add(water)
}

export function updateForestWater(time){waterTime.value=time}
