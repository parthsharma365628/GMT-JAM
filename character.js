import * as T from 'three'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import modelUrl from './main-character.glb?url'

const X=new T.Vector3(1,0,0), Y=new T.Vector3(0,1,0), Z=new T.Vector3(0,0,1)
const turn=new T.Quaternion(), rollTurn=new T.Quaternion()

export function animateCharacter(player){
  const placeholder=player.children.filter(child=>child!==player.userData.weapon)
  const visual=new T.Group()
  player.add(visual)
  let rig,phase=0

  new GLTFLoader().loadAsync(modelUrl).then(({scene})=>{
    let mesh
    scene.traverse(node=>{if(node.isSkinnedMesh)mesh=node})
    if(!mesh)throw new Error('Player model has no skinned mesh')
    scene.updateMatrixWorld(true)
    const bones=mesh.skeleton
    const getBone=name=>bones.getBoneByName(T.PropertyBinding.sanitizeNodeName('DEF-'+name))
    const joint=name=>{
      const bone=getBone(name)
      if(!bone)throw new Error('Missing player bone '+name)
      const inverse=bone.parent.getWorldQuaternion(new T.Quaternion()).invert()
      return {bone,rest:bone.quaternion.clone(),inverse,x:X.clone().applyQuaternion(inverse),z:Z.clone().applyQuaternion(inverse)}
    }
    const legs=['L','R'].map(side=>['thigh','shin','foot'].map(name=>joint(name+'.'+side)))
    const arms=['L','R'].map(side=>['upper_arm','forearm'].map(name=>joint(name+'.'+side)))
    const chest=joint('spine.003')
    const waist=joint('spine.001')
    const foot=getBone('foot.L').getWorldPosition(new T.Vector3())
    const toe=getBone('toe.L').getWorldPosition(new T.Vector3())
    const forward=toe.z>foot.z?1:-1
    const location=bone=>bone.getWorldPosition(new T.Vector3())
    const runningArms=arms.map(([upper,lower],i)=>{
      const hand=getBone(i===0?'hand.L':'hand.R')
      const upperDirection=location(lower.bone).sub(location(upper.bone)).normalize()
      const forearmDirection=location(hand).sub(location(lower.bone)).normalize()
      // Give each elbow a small outward angle. The swing around X keeps that clearance.
      const outward=Math.sign(location(upper.bone).x)
      const upperTarget=new T.Vector3(outward*.26,-1,0).normalize()
      const shoulderTurn=new T.Quaternion().setFromUnitVectors(upperDirection,upperTarget)
      const upperRest=upper.inverse.clone().multiply(shoulderTurn).multiply(upper.inverse.clone().invert()).multiply(upper.rest)
      const elbowDirection=forearmDirection.applyQuaternion(shoulderTurn)
      const elbowTarget=Y.clone().negate().applyAxisAngle(X,-1.05*forward)
      const elbowTurn=new T.Quaternion().setFromUnitVectors(elbowDirection,elbowTarget)
      const elbowParentInverse=lower.inverse.clone().multiply(shoulderTurn.clone().invert())
      const lowerRest=elbowParentInverse.clone().multiply(elbowTurn).multiply(elbowParentInverse.invert()).multiply(lower.rest)
      return {upperRest,lowerRest}
    })

    const model=scene.children.find(child=>child.getObjectById(mesh.id))
    const bounds=new T.Box3().setFromObject(mesh,true)
    const height=bounds.max.y-bounds.min.y
    visual.rotation.y=forward===1?Math.PI:0
    visual.scale.setScalar(1.95/height)
    model.position.y-=bounds.min.y
    visual.add(model)

    const hand=getBone('hand.R')
    const weapon=player.userData.weapon
    hand.add(weapon)
    weapon.position.set(0,.075,0)
    weapon.scale.setScalar(.75)
    weapon.rotation.set(0,0,0)

    for(const piece of placeholder)piece.removeFromParent()
    rig={legs,arms,runningArms,chest,waist,forward}
  }).catch(error=>console.error('Could not load the player model',error))

  return function update(dt,motion,progress=0){
    if(!rig)return
    const {legs,arms,runningArms,chest,waist,forward}=rig
    const sprinting=motion==='run'
    const running=sprinting||motion==='walk'
    const airborne=motion==='jump'||motion==='fall'
    const striking=motion==='attack'
    const dodging=motion==='dodge'||motion==='defeat'
    phase+=dt*(sprinting?T.MathUtils.lerp(10,17,progress):motion==='walk'?9:3)
    const stride=running?Math.sin(phase)*(sprinting?T.MathUtils.lerp(.62,.9,progress):.55):0
    const swing=striking?Math.sin(Math.PI*progress):0
    const tuck=dodging?Math.sin(Math.PI*progress):0
    const blend=1-Math.exp(-dt*22)
    const pose=(joint,pitch,roll=0,rest=joint.rest)=>{
      const target=turn.setFromAxisAngle(joint.x,pitch*forward).multiply(rest)
      if(roll)target.premultiply(rollTurn.setFromAxisAngle(joint.z,roll))
      joint.bone.quaternion.slerp(target,blend)
    }
    for(let i=0;i<2;i++){
      const side=i===0?1:-1
      const leg=stride*side
      pose(legs[i][0],-leg-(airborne?(i===0?.85:.42):.65*tuck))
      pose(legs[i][1],Math.max(0,-leg)*1.2+(airborne?.8:1.25*tuck))
      pose(legs[i][2],-Math.max(0,-leg)*.35)
      if(running){
        pose(arms[i][0],leg*.8,0,runningArms[i].upperRest)
        arms[i][1].bone.quaternion.slerp(runningArms[i].lowerRest,blend)
      }else{
        pose(arms[i][0],(airborne?.5:0)-(i===1?1.9*swing:0),-side*(.52-.32*swing))
        pose(arms[i][1],-.3-(airborne?.18:0))
      }
    }
    pose(waist,sprinting?T.MathUtils.lerp(.12,.28,progress):0)
    pose(chest,sprinting?0:running?.08:airborne?.22:.6*tuck,.18*swing)
    visual.position.y=T.MathUtils.damp(visual.position.y,(running?.035*Math.cos(phase*2):.012*Math.sin(phase))-.22*tuck,18,dt)
  }
}

