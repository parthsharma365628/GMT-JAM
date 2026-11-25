import * as T from 'three'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js'
import rockUrl from './volcanic-rock.glb?url'

const material=new T.MeshStandardMaterial({color:0x493038,roughness:.94,flatShading:true})
material.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 rockPosition;\n'+shader.vertexShader.replace(
    '#include <begin_vertex>', '#include <begin_vertex>\nrockPosition = position;'
  )
  shader.fragmentShader='varying vec3 rockPosition;\n'+shader.fragmentShader.replace(
    '#include <emissivemap_fragment>', `
    #include <emissivemap_fragment>
    vec3 p = rockPosition;
    float grain = sin(p.x*92.0)*sin(p.y*113.0)*sin(p.z*99.0);
    float ridge = sin(p.y*14.0 + p.x*5.0 + sin(p.z*11.0)*0.9 + sin(p.x*22.0+p.z*9.0)*0.35);
    float branch = sin(p.x*11.0-p.z*13.0+sin(p.y*17.0));
    float heat = (1.0-smoothstep(0.03,0.22,abs(ridge))) * smoothstep(0.34,0.85,branch);
    diffuseColor.rgb *= 0.84 + 0.16*grain + 0.2*sin(p.y*18.0+p.z*9.0);
    totalEmissiveRadiance += vec3(1.0,0.12,0.014) * heat * 1.1;
    `
  )
}

const wallMaterial=material.clone()
wallMaterial.flatShading=false
wallMaterial.onBeforeCompile=material.onBeforeCompile
const wallProfiles=[
  [.77,.87,.81,.98,.9,.94,.76],
  [.73,.94,.89,.83,.98,.88,.78],
  [.83,.91,.98,.86,.92,.8,.74]
]
const wallGeometry=wallProfiles.map(profile=>{
  const outline=new T.Shape()
  outline.moveTo(-.5,0)
  outline.lineTo(.5,0)
  outline.lineTo(.5,.63)
  const crest=[.45,.36,.2,.04,-.12,-.31,-.44]
  profile.forEach((height,i)=>outline.lineTo(crest[i],height))
  outline.lineTo(-.5,.65)
  outline.closePath()
  const bevel=.035
  const slab=new T.ExtrudeGeometry(outline,{depth:.8,bevelThickness:.1,bevelSize:bevel,bevelSegments:3})
  slab.deleteAttribute('normal')
  slab.deleteAttribute('uv')
  const geometry=mergeVertices(slab)
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  const bounds=geometry.boundingBox
  const size=bounds.getSize(new T.Vector3())
  const center=bounds.getCenter(new T.Vector3())
  return geometry.translate(-center.x,-bounds.min.y,-center.z).scale(1/size.x,1/size.y,1/size.z)
})

function makeVariants(source){
  source.computeBoundingBox()
  const center=source.boundingBox.getCenter(new T.Vector3())
  const base=source.clone().translate(-center.x,-center.y,-center.z)
  return [0,1,2,3,4,5].map(i=>{
    const geometry=base.clone().rotateX([.8,-.5,.25][i%3]).rotateY(i*1.93).rotateZ((i%2?.34:-.28))
    geometry.computeBoundingBox()
    const bounds=geometry.boundingBox
    const size=bounds.getSize(new T.Vector3())
    const center=bounds.getCenter(new T.Vector3())
    geometry.translate(-center.x,-bounds.min.y,-center.z).scale(1/size.x,1/size.y,1/size.z)
    return geometry
  })
}

let variants
export const rocksReady=new GLTFLoader().loadAsync(rockUrl).then(({scene})=>{
  let mesh
  scene.traverse(node=>{if(node.isMesh)mesh=node})
  if(!mesh)throw new Error('Volcanic rock contains no mesh')
  variants=makeVariants(mesh.geometry)
}).catch(error=>{
  console.warn('Using procedural volcanic rock geometry',error)
  variants=makeVariants(new T.DodecahedronGeometry(1))
})

export function volcanicRock(parent,x,y,z,width,height,depth,variant,wall=false){
  const shapes=wall?wallGeometry:variants
  const geometry=shapes[variant%shapes.length]
  const mesh=new T.Mesh(geometry,wall?wallMaterial:material)
  mesh.position.set(x,y,z)
  mesh.scale.set(width,height,depth)
  parent.add(mesh)
}
