import * as T from 'three'

const Y=new T.Vector3(0,1,0)
const {lerp,smoothstep}=T.MathUtils

export function fitWardenFist(hand,grip,getBone){
  const index=getBone('f_index.01.R'), pinky=getBone('f_pinky.01.R')
  const across=new T.Vector3(1,0,0)
  if(index&&pinky){
    const inHand=bone=>hand.worldToLocal(bone.getWorldPosition(new T.Vector3()))
    const first=inHand(index), last=inHand(pinky)
    across.subVectors(first,last)
    across.y=0
    const palmWidth=across.length()
    if(palmWidth<.0001)across.set(1,0,0)
    else across.divideScalar(palmWidth)
    const palmNormal=new T.Vector3().crossVectors(across,Y).normalize()
    const middle=getBone('f_middle.01.R')
    if(middle){
      // Rigify finger curl rotates the finger's +Y toward its local +Z.
      const bendSide=hand.worldToLocal(middle.localToWorld(new T.Vector3(0,0,1))).sub(inHand(middle))
      if(palmNormal.dot(bendSide)<0)palmNormal.negate()
    }
    grip.position.copy(first).lerp(last,.5).addScaledVector(Y,palmWidth*.17).addScaledVector(palmNormal,palmWidth*.24)
  }
  grip.quaternion.setFromUnitVectors(Y,across)
  for(const name of ['f_index','f_middle','f_ring','f_pinky','thumb']){
    const angles=name==='thumb'?[.34,.72,.55]:[1.12,1.47,.91]
    angles.forEach((angle,i)=>getBone(name+'.0'+(i+1)+'.R')?.rotateX(angle))
  }
  return across
}

export function createWardenSweep(actor,upper,lower,hand,across,right){
  const shoulder=new T.Vector3(), elbow=new T.Vector3(), wrist=new T.Vector3()
  const reach=new T.Vector3(), pole=new T.Vector3(), wristGoal=new T.Vector3(), elbowGoal=new T.Vector3()
  const from=new T.Vector3(), to=new T.Vector3()
  const blade=new T.Vector3(), palm=new T.Vector3(), normal=new T.Vector3()
  const rootRotation=new T.Quaternion(), target=new T.Quaternion(), boneRotation=new T.Quaternion()
  const parentRotation=new T.Quaternion()
  const basis=new T.Matrix4()
  const localFrame=new T.Quaternion().setFromRotationMatrix(basis.makeBasis(across,Y,normal.crossVectors(across,Y))).invert()

  function aimBone(bone,joint,child,targetPosition,weight){
    from.subVectors(child,joint).normalize()
    to.subVectors(targetPosition,joint).normalize()
    bone.getWorldQuaternion(boneRotation)
    bone.parent.getWorldQuaternion(parentRotation).invert()
    target.setFromUnitVectors(from,to).multiply(boneRotation).premultiply(parentRotation)
    bone.quaternion.slerp(target,weight)
  }

  return progress=>{
    const weight=smoothstep(progress,.02,.16)*(1-smoothstep(progress,.72,1))
    if(weight<=0)return
    const draw=smoothstep(progress,0,.31)
    const sweep=smoothstep(progress,.31,.59)
    const angle=lerp(lerp(.85,2.04,draw),-.92,sweep)
    const lift=lerp(.25,-.30,sweep)
    actor.getWorldQuaternion(rootRotation)
    reach.set(right*Math.sin(angle),lift,-Math.cos(angle)).normalize().applyQuaternion(rootRotation)
    upper.getWorldPosition(shoulder)
    lower.getWorldPosition(elbow)
    hand.getWorldPosition(wrist)
    const upperLength=shoulder.distanceTo(elbow), lowerLength=elbow.distanceTo(wrist)
    const span=(upperLength+lowerLength)*lerp(.78,.97,Math.sin(sweep*Math.PI))
    wristGoal.copy(shoulder).addScaledVector(reach,span)
    pole.set(right*.20,-1,.15).applyQuaternion(rootRotation)
    pole.addScaledVector(reach,-pole.dot(reach)).normalize()
    const along=(upperLength**2-lowerLength**2+span**2)/(2*span)
    const bend=Math.sqrt(Math.max(0,upperLength**2-along**2))
    elbowGoal.copy(shoulder).addScaledVector(reach,along).addScaledVector(pole,bend)
    aimBone(upper,shoulder,elbow,elbowGoal,weight)
    lower.getWorldPosition(elbow)
    hand.getWorldPosition(wrist)
    aimBone(lower,elbow,wrist,wristGoal,weight)

    // Turn the entire fist so the blade stays on the same grip throughout the sweep.
    const bladeAngle=angle-.20
    blade.set(right*Math.sin(bladeAngle),lift*.9,-Math.cos(bladeAngle)).normalize()
    palm.set(-right*Math.cos(bladeAngle),-.42,-Math.sin(bladeAngle))
    palm.addScaledVector(blade,-palm.dot(blade)).normalize()
    normal.crossVectors(blade,palm)
    target.setFromRotationMatrix(basis.makeBasis(blade,palm,normal)).multiply(localFrame)
      .premultiply(rootRotation)
    hand.parent.getWorldQuaternion(parentRotation).invert()
    hand.quaternion.slerp(target.premultiply(parentRotation),weight)
  }
}
