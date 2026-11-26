import * as T from 'three'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import hedgeUrl from './middle-earth-bush.glb?url'

let template
export const hedgesReady=new GLTFLoader().loadAsync(hedgeUrl).then(({scene})=>{
  scene.updateMatrixWorld(true)
  const bounds=new T.Box3().setFromObject(scene,true)
  const center=bounds.getCenter(new T.Vector3())
  const size=bounds.getSize(new T.Vector3())
  scene.position.set(-center.x,-bounds.min.y,-center.z)
  template=new T.Group()
  template.scale.set(1/size.x,1/size.y,1/size.z)
  template.add(scene)
}).catch(error=>console.warn('Could not load the Middle Earth hedge',error))

export function hedge(parent,x,z,width,height,depth,reverse){
  if(!template)return false
  const instance=new T.Group()
  instance.position.set(x,-.035,z)
  instance.scale.set(width,height,depth)
  if(reverse)instance.rotation.y=Math.PI
  instance.add(template.clone(true))
  parent.add(instance)
  return true
}
