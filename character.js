import * as T from 'three'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import {clone} from 'three/addons/utils/SkeletonUtils.js'
import modelUrl from './main-character.glb?url'
import {createWardenSweep,fitWardenFist} from './warden-swing.js'

const X=new T.Vector3(1,0,0), Y=new T.Vector3(0,1,0), Z=new T.Vector3(0,0,1)
const turn=new T.Quaternion(), yawTurn=new T.Quaternion(), rollTurn=new T.Quaternion(), gripTurn=new T.Quaternion()
const bladeDirection=new T.Vector3(), restBladeDirection=new T.Vector3()
const handRotation=new T.Quaternion(), actorRotation=new T.Quaternion(), slashGrip=new T.Quaternion()
const bladeSide=new T.Vector3(), bladeFace=new T.Vector3()
const bladeBasis=new T.Matrix4(), faceGrip=new T.Quaternion()
const wristParentRotation=new T.Quaternion()

function swingCurve(progress){
  const t=T.MathUtils.clamp(progress,0,1)
  if(t<.24){
    return -.36*Math.sin((t/.24)*Math.PI*.5)
  }
  if(t<.52){
    const u=(t-.24)/.28
    return -.36+1.36*(u*u*(3-2*u))
  }
  if(t<.70){
    return 1-.08*((t-.52)/.18)
  }
  const u=(t-.70)/.30
  return .92*(1-u*u*(3-2*u))
}

function dashCurve(progress){
  const t=T.MathUtils.clamp(progress,0,1)
  if(t<.25)return Math.sin((t/.25)*Math.PI*.5)
  if(t<.72)return 1
  return Math.cos(((t-.72)/.28)*Math.PI*.5)
}

export function animateCharacter(player,{template=null,targetHeight=1.95,materialFor=null,crossGrip=true,wardenFist=false,weaponScale=crossGrip?.94:.75}={}){
  const placeholder=player.children.filter(child=>child!==player.userData.weapon)
  const visual=new T.Group()
  player.add(visual)
  let rig,phase=0

  function install(scene){
    let mesh
    scene.traverse(node=>{if(node.isSkinnedMesh)mesh=node})
    if(!mesh)throw new Error('Player model has no skinned mesh')
    scene.updateMatrixWorld(true)
    const bones=mesh.skeleton
    const getBone=name=>bones.getBoneByName(T.PropertyBinding.sanitizeNodeName('DEF-'+name))
    const joint=(name,required=true)=>{
      const bone=getBone(name)
      if(!bone){
        if(required)throw new Error('Missing player bone '+name)
        return null
      }
      const inverse=bone.parent.getWorldQuaternion(new T.Quaternion()).invert()
      return {
        bone,
        rest:bone.quaternion.clone(),
        inverse,
        x:X.clone().applyQuaternion(inverse),
        y:Y.clone().applyQuaternion(inverse),
        z:Z.clone().applyQuaternion(inverse)
      }
    }
    const legs=['L','R'].map(side=>['thigh','shin','foot'].map(name=>joint(name+'.'+side)))
    const arms=['L','R'].map(side=>['upper_arm','forearm'].map(name=>joint(name+'.'+side)))
    const shoulders=['L','R'].map(side=>joint('shoulder.'+side,false))
    const wristR=joint('hand.R',false)
    const pelvis=joint('spine',false)
    const waist=joint('spine.001')
    const chest=joint('spine.003')
    const head=joint('spine.006',false)

    const foot=getBone('foot.L').getWorldPosition(new T.Vector3())
    const toe=getBone('toe.L').getWorldPosition(new T.Vector3())
    const forward=toe.z>foot.z?1:-1
    const location=bone=>bone.getWorldPosition(new T.Vector3())
    const runningArms=arms.map(([upper,lower],i)=>{
      const hand=getBone(i===0?'hand.L':'hand.R')
      const upperDirection=location(lower.bone).sub(location(upper.bone)).normalize()
      const forearmDirection=location(hand).sub(location(lower.bone)).normalize()
      const outward=Math.sign(location(upper.bone).x)
      const upperTarget=new T.Vector3(outward*.26,-1,0).normalize()
      const shoulderTurn=new T.Quaternion().setFromUnitVectors(upperDirection,upperTarget)
      const upperRest=upper.inverse.clone().multiply(shoulderTurn).multiply(upper.inverse.clone().invert()).multiply(upper.rest)
      const elbowDirection=forearmDirection.applyQuaternion(shoulderTurn)
      const elbowTarget=Y.clone().negate().applyAxisAngle(X,-1.05*forward)
      const elbowTurn=new T.Quaternion().setFromUnitVectors(elbowDirection,elbowTarget)
      const elbowParentInverse=lower.inverse.clone().multiply(shoulderTurn.clone().invert())
      const lowerRest=elbowParentInverse.clone().multiply(elbowTurn).multiply(elbowParentInverse.invert()).multiply(lower.rest)
      return {upperRest,lowerRest,outward}
    })

    const model=scene.children.find(child=>child.getObjectById(mesh.id))
    const bounds=new T.Box3().setFromObject(mesh,true)
    const height=bounds.max.y-bounds.min.y
    visual.rotation.y=forward===1?Math.PI:0
    visual.scale.setScalar(targetHeight/height)
    model.position.y-=bounds.min.y
    if(materialFor)mesh.material=materialFor(mesh.material)
    visual.add(model)

    const hand=getBone('hand.R')
    const weapon=player.userData.weapon
    const grip=new T.Group()
    hand.add(grip)
    grip.position.set(0,.075,0)
    const gripRest=new T.Quaternion()
    if(crossGrip){
      const index=getBone('f_index.01.R'), pinky=getBone('f_pinky.01.R')
      const across=index&&pinky?hand.worldToLocal(location(index)).sub(hand.worldToLocal(location(pinky))):X.clone()
      across.y=0
      if(across.lengthSq()<.000001)across.copy(X)
      // The current swords extend along local +Y. Seat the hilt across the palm.
      gripRest.setFromUnitVectors(Y,across.normalize())
      grip.quaternion.copy(gripRest)
    }
    grip.add(weapon)
    weapon.position.set(0,0,0)
    weapon.scale.setScalar(weaponScale)
    weapon.rotation.set(0,0,0)
    player.userData.rigged=true
    let wardenSweep
    if(wardenFist){
      const across=fitWardenFist(hand,grip,getBone)
      const right=runningArms[1].outward*(forward===1?-1:1)
      wardenSweep=createWardenSweep(player,arms[1][0].bone,arms[1][1].bone,hand,across,right)
    }

    for(const piece of placeholder)piece.removeFromParent()
    const staff=Boolean(weapon.getObjectByName('spell-origin'))
    rig={legs,arms,shoulders,wristR,runningArms,pelvis,waist,chest,head,forward,grip,gripRest,weapon,wardenSweep,staff}
  }
  if(template){
    try{install(clone(template))}
    catch(error){
      console.warn('Using fallback for the enemy model',error)
      return null
    }
  }else{
    new GLTFLoader().loadAsync(modelUrl).then(({scene})=>install(scene))
      .catch(error=>console.error('Could not load the player model',error))
  }

  return function update(dt,motion,progress=0,inCombat=false){
    if(!rig)return
    const {legs,arms,shoulders,wristR,runningArms,pelvis,waist,chest,head,forward,grip,gripRest,weapon,wardenSweep,staff}=rig
    const wardenWalk=motion==='warden_walk'
    const wardenSlam=motion==='warden_slam'
    const wardenAttack=wardenSlam||motion==='warden_swing'
    const sprinting=motion==='run'
    const running=sprinting||motion==='walk'||wardenWalk
    const airborne=motion==='jump'||motion==='fall'
    const comboStrike=motion.startsWith('attack_')
    const striking=comboStrike||motion==='dash_strike'||motion.startsWith('special')
    const dashing=motion==='dodge'||motion==='dash'
    const defeated=motion==='defeat'

    phase+=dt*(wardenWalk?5.8:sprinting?T.MathUtils.lerp(10,17,progress):running?10.5:3.2)
    const stride=running?Math.sin(phase)*(wardenWalk?.53:sprinting?T.MathUtils.lerp(.62,.9,progress):.62):0
    const smooth=T.MathUtils.smoothstep
    const casting=motion==='cast'
    const castDraw=casting?smooth(progress,0,.39)*(1-smooth(progress,.42,.57)):0
    const castRelease=casting?smooth(progress,.42,.57)*(1-smooth(progress,.66,1)):0
    const draw=comboStrike?smooth(progress,0,.19)*(1-smooth(progress,.19,.33)):0
    const cut=comboStrike?smooth(progress,.18,.42)*(1-smooth(progress,.6,1)):0
    const swing=comboStrike?cut-.48*draw:striking?swingCurve(progress):0
    const charge=wardenAttack?smooth(progress,0,.30)*(1-smooth(progress,.34,.48)):0
    const impact=wardenAttack?smooth(progress,.34,.48)*(1-smooth(progress,.57,.98)):0
    const outwardSlash=motion==='attack_1'||motion==='attack_2'
    const slashStart=.18, slashEnd=.6
    const sweep=outwardSlash?smooth(progress,slashStart,slashEnd):0
    const slashWeight=outwardSlash?smooth(progress,slashStart-.06,slashStart+.06)*(1-smooth(progress,slashEnd,.93)):0
    const lunge=dashing?dashCurve(progress):0
    const defeatTuck=defeated?Math.sin(Math.PI*progress):0

    const blend=1-Math.exp(-dt*(wardenAttack||comboStrike||casting?48:striking||dashing?34:22))
    const pose=(j,pitch=0,roll=0,yaw=0,rest=j?.rest)=>{
      if(!j)return
      const target=turn.setFromAxisAngle(j.x,pitch*forward).multiply(rest)
      if(yaw)target.premultiply(yawTurn.setFromAxisAngle(j.y,yaw*forward))
      if(roll)target.premultiply(rollTurn.setFromAxisAngle(j.z,roll))
      j.bone.quaternion.slerp(target,blend)
    }

    // --- LEGS ---
    for(let i=0;i<2;i++){
      const side=i===0?1:-1
      const leg=stride*side
      if(wardenWalk){
        pose(legs[i][0],-leg,-side*.045)
        pose(legs[i][1],.10+Math.max(0,-leg)*.95)
        pose(legs[i][2],-.10-Math.max(0,-leg)*.42)
      }else if(wardenAttack){
        pose(legs[i][0],i===0?-.2-.38*impact:.2+.14*impact,-side*.14)
        pose(legs[i][1],.20+.19*charge+.60*impact)
        pose(legs[i][2],-.12-.22*impact)
      }else if(dashing){
        const isLead=i===0
        pose(legs[i][0],(isLead?-.95:.62)*lunge,-side*.08*lunge)
        pose(legs[i][1],(isLead?1.15:.48)*lunge)
        pose(legs[i][2],(isLead?-.22:.35)*lunge)
      }else if(motion==='special_slam'){
        const air=Math.sin(Math.PI*progress)
        pose(legs[i][0],-.55*air,-side*.16)
        pose(legs[i][1],.85*air+.25)
        pose(legs[i][2],-.25*air)
      }else if(motion==='special_thrust'){
        const isLead=i===0
        const step=Math.max(0,swing)
        pose(legs[i][0],(isLead?-.78*step:.68*step),-side*.1)
        pose(legs[i][1],(isLead?.95*step:.42*step))
        pose(legs[i][2],(isLead?-.2*step:.3*step))
      }else if(striking){
        const isLead=i===0
        const step=Math.max(0,swing)
        pose(legs[i][0],(isLead?-.34-.18*step:.26+.14*step),-side*.12)
        pose(legs[i][1],(isLead?.42+.22*step:.32+.15*step))
        pose(legs[i][2],-.15)
      }else if(!running && !airborne && !defeated && inCombat){
        const isLead=i===0
        pose(legs[i][0],isLead?-.24:.18,-side*.11)
        pose(legs[i][1],isLead?.32:.24)
        pose(legs[i][2],-.08)
      }else{
        pose(legs[i][0],-leg-(airborne?(i===0?.85:.42):.65*defeatTuck))
        pose(legs[i][1],Math.max(0,-leg)*1.2+(airborne?.8:1.25*defeatTuck))
        pose(legs[i][2],-Math.max(0,-leg)*.35)
      }
    }

    // --- ARMS & WRIST ---
    let wristPitch=0, wristRoll=0, wristYaw=0
    for(let i=0;i<2;i++){
      const side=i===0?1:-1
      const isRight=i===1
      if(staff && (casting||isRight)){
        const {upperRest,lowerRest,outward}=runningArms[i]
        pose(shoulders[i],-.12*castDraw-.2*castRelease,0,.14*outward*castRelease)
        if(isRight){
          pose(arms[i][0],-.30-.98*castDraw-1.12*castRelease,outward*(.14+.22*castDraw),outward*.2,upperRest)
          pose(arms[i][1],.12-.25*castDraw+.56*castRelease,0,0,lowerRest)
        }else{
          pose(arms[i][0],-.30-.72*castDraw+.21*castRelease,.12,-outward*.35*castDraw,upperRest)
          pose(arms[i][1],.15-.28*castDraw+.19*castRelease,0,0,lowerRest)
        }
      }else if(wardenWalk){
        pose(shoulders[i],0,side*.04,0)
        pose(arms[i][0],stride*side*.45-.07,side*.095,0,runningArms[i].upperRest)
        pose(arms[i][1],.46,0,0,runningArms[i].lowerRest)
        if(isRight){wristPitch=.28;wristRoll=-.15}
      }else if(wardenAttack){
        const {upperRest,lowerRest}=runningArms[i]
        if(wardenSlam){
          pose(shoulders[i],-.35*charge+.14*impact,0,0)
          pose(arms[i][0],-.16-2.35*charge-1.18*impact,side*(.10+.28*charge),-side*.23*charge,upperRest)
          pose(arms[i][1],.23-.36*charge+.57*impact,0,0,lowerRest)
          if(isRight){wristPitch=.35+.65*impact;wristRoll=-.1}
        }else if(isRight){
          pose(shoulders[i],-.12*charge-.28*impact,0,.34*charge-.45*impact)
          pose(arms[i][0],-.20,0,-.14,upperRest)
          pose(arms[i][1],.15,0,0,lowerRest)
          wristPitch=.28;wristRoll=-.12
        }else{
          pose(shoulders[i],.18*impact,0,-.16*charge)
          pose(arms[i][0],-.22-.38*charge+.56*impact,.12,0,upperRest)
          pose(arms[i][1],.15+.40*impact,0,0,lowerRest)
        }
      }else if(running){
        pose(shoulders[i],0,0,0)
        pose(arms[i][0],stride*side*.8,0,0,runningArms[i].upperRest)
        arms[i][1].bone.quaternion.slerp(runningArms[i].lowerRest,blend)
      }else if(dashing){
        pose(shoulders[i],isRight?.18*lunge:-.12*lunge,0,0)
        pose(arms[i][0],isRight?.55*lunge:-.48*lunge,-side*(.48+.18*lunge),isRight?-.25*lunge:.2*lunge)
        pose(arms[i][1],isRight?-.85*lunge:-.45*lunge)
        if(isRight){wristPitch=.45*lunge;wristRoll=-.2*lunge}
      }else if(striking){
        if(motion==='special_spin'){
          // Horizontal 360 spin cleave
          if(isRight){
            pose(shoulders[1],-.12,0,-.35)
            pose(arms[1][0],-1.15,-1.05,0)
            pose(arms[1][1],-.15)
            wristPitch=.75;wristRoll=-.45
          }else{
            pose(shoulders[0],.1,0,.25)
            pose(arms[0][0],.45,.72,0)
            pose(arms[0][1],-.7)
          }
        }else if(motion==='special_slam'){
          // Two-handed leaping ground slam
          pose(shoulders[i],-.32*swing,0,0)
          pose(arms[i][0],-2.35*swing,-side*.22,-side*.28*swing)
          pose(arms[i][1],-.24)
          if(isRight){wristPitch=.95*swing;wristRoll=0}
        }else if(motion==='special_thrust'){
          // Extreme piercing rapier lunge
          if(isRight){
            pose(shoulders[1],-.3*swing,0,-.35*swing)
            pose(arms[1][0],-1.58*swing,-.28+.2*swing,-.26*swing)
            pose(arms[1][1],-.1)
            wristPitch=1.1*swing;wristRoll=0
          }else{
            pose(shoulders[0],.22*swing,0,.3*swing)
            pose(arms[0][0],.92*swing,.72+.2*swing,0)
            pose(arms[0][1],-.6)
          }
        }else if(motion==='attack_1'){
          if(isRight){
            const outward=runningArms[i].outward
            pose(shoulders[1],-.18*swing,0,-.32*swing)
            pose(arms[1][0],-1.45*swing,-.38-.38*draw+outward*.54*slashWeight,outward*(.16+1.08*sweep)*slashWeight)
            pose(arms[1][1],-.35+.22*swing)
            wristPitch=.62*swing;wristRoll=.25*swing
          }else{
            pose(shoulders[0],.12*swing,0,.22*swing)
            pose(arms[0][0],.52*swing,.58+.18*swing,0)
            pose(arms[0][1],-.78)
          }
        }else if(motion==='attack_2'){
          if(isRight){
            const outward=runningArms[i].outward
            pose(shoulders[1],-.08*swing,0,.36*swing)
            pose(arms[1][0],-.85*swing,-.42+.57*draw+outward*.65*slashWeight,outward*(.24+1.16*sweep)*slashWeight)
            pose(arms[1][1],-.28+.18*swing)
            wristPitch=.35*swing;wristRoll=-.58*swing;wristYaw=.4*swing
          }else{
            pose(shoulders[0],-.1*swing,0,-.2*swing)
            pose(arms[0][0],-.35*swing,.48-.25*swing,0)
            pose(arms[0][1],-.55)
          }
        }else if(motion==='attack_3'){
          if(isRight){
            pose(shoulders[1],-.28*swing,0,-.22*swing)
            pose(arms[1][0],-2.15*draw-1.20*cut,-.32+.28*cut,-.24*cut)
            pose(arms[1][1],-.32-.36*draw+.68*cut)
            wristPitch=.85*swing;wristRoll=.12*swing
          }else{
            pose(shoulders[0],.16*swing,0,.25*swing)
            pose(arms[0][0],.68*swing,.62+.2*swing,0)
            pose(arms[0][1],-.92)
          }
        }else{
          if(isRight){
            pose(shoulders[1],-.24*swing,0,-.28*swing)
            pose(arms[1][0],-1.48*swing,-.34+.22*swing,-.22*swing)
            pose(arms[1][1],-.18+.14*swing)
            wristPitch=.95*swing;wristRoll=0
          }else{
            pose(shoulders[0],.18*swing,0,.28*swing)
            pose(arms[0][0],.78*swing,.65+.22*swing,0)
            pose(arms[0][1],-.85)
          }
        }
      }else{
        const guard=inCombat && !airborne && !defeated
        const breath=Math.sin(phase)
        pose(shoulders[i],0,0,0)
        if(guard){
          if(template){
            const {upperRest,lowerRest}=runningArms[i]
            pose(arms[i][0],isRight?-.12+.03*breath:-.25-.03*breath,0,isRight?-.14:.22,upperRest)
            arms[i][1].bone.quaternion.slerp(lowerRest,blend)
          }else{
            pose(arms[i][0],isRight?-.22+.03*breath:-.34-.03*breath,-side*(.46+.02*breath),isRight?-.14:.22)
            pose(arms[i][1],isRight?-.62:-.78)
          }
          if(isRight){wristPitch=.24;wristRoll=-.12}
        }else{
          pose(arms[i][0],(airborne?.5:0)+.02*breath,-side*.52)
          pose(arms[i][1],-.3-(airborne?.18:0))
        }
      }
    }
    pose(wristR,wristPitch,wristRoll,wristYaw)

    // --- TORSO, PELVIS & HEAD ---
    let pelvisYaw=0, waistPitch=0, chestPitch=0, chestRoll=0, chestYaw=0
    if(casting){
      waistPitch=.06-.11*castDraw+.30*castRelease
      chestPitch=.07-.18*castDraw+.25*castRelease
      chestYaw=.21*castDraw-.28*castRelease
      pelvisYaw=chestYaw*.38
    }else if(wardenWalk){
      waistPitch=.13
      chestPitch=-.08
      chestRoll=-stride*.12
      chestYaw=-stride*.36
      pelvisYaw=stride*.22
    }else if(wardenAttack){
      waistPitch=.08-.15*charge+.36*impact
      chestPitch=.06-(wardenSlam?.30:.17)*charge+(wardenSlam?.54:.22)*impact
      chestYaw=wardenSlam?0:.52*charge-.73*impact
      pelvisYaw=chestYaw*.42
      chestRoll=wardenSlam?0:-.1*charge+.15*impact
    }else if(sprinting){
      waistPitch=T.MathUtils.lerp(.12,.28,progress)
    }else if(running){
      chestPitch=.08
      chestYaw=-stride*.14
      pelvisYaw=stride*.1
    }else if(airborne){
      chestPitch=.22
    }else if(defeated){
      chestPitch=.6*defeatTuck
    }else if(dashing){
      waistPitch=.34*lunge
      chestPitch=.44*lunge
      chestYaw=-.18*lunge
      pelvisYaw=.14*lunge
    }else if(striking){
      if(motion==='special_spin'){
        chestPitch=.24;chestRoll=-.16;chestYaw=-.25
      }else if(motion==='special_slam'){
        waistPitch=.22*swing;chestPitch=.56*swing
      }else if(motion==='special_thrust'){
        pelvisYaw=-.38*swing;chestYaw=-.55*swing;chestPitch=.48*swing
      }else if(motion==='attack_1'){
        pelvisYaw=-.26*swing;chestYaw=-.42*swing;chestPitch=.18*swing;chestRoll=.14*swing
      }else if(motion==='attack_2'){
        pelvisYaw=.28*swing;chestYaw=.46*swing;chestPitch=.14*swing;chestRoll=-.22*swing
      }else if(motion==='attack_3'){
        pelvisYaw=-.22*swing;chestYaw=-.34*swing;chestPitch=.46*swing;chestRoll=.12*swing
      }else{
        pelvisYaw=-.32*swing;chestYaw=-.48*swing;chestPitch=.42*swing;chestRoll=.1*swing
      }
    }else if(inCombat){
      const breath=Math.sin(phase)
      waistPitch=.06+.015*breath
      chestPitch=.08+.02*breath
      chestYaw=-.16
      pelvisYaw=-.12
    }

    pose(pelvis,0,0,pelvisYaw)
    pose(waist,waistPitch,0,pelvisYaw*.5)
    pose(chest,chestPitch,chestRoll,chestYaw)
    pose(head,-chestPitch*.55,-chestRoll*.5,-(chestYaw+pelvisYaw)*.7)

    // Full 360 spin on special_spin
    const baseYaw=forward===1?Math.PI:0
    if(motion==='special_spin'){
      const u=T.MathUtils.clamp(progress,0,1)
      visual.rotation.y=baseYaw+(u*u*(3-2*u))*Math.PI*2
    }else{
      visual.rotation.y=baseYaw
    }

    let bob=running?.035*Math.cos(phase*2):.012*Math.sin(phase)
    if(wardenWalk)bob=.035-.15*Math.pow(Math.abs(Math.cos(phase)),6)
    else if(wardenAttack)bob=-.04+.08*charge-(wardenSlam?.29:.15)*impact
    else if(dashing)bob-=.24*lunge
    else if(defeated)bob-=.22*defeatTuck
    else if(motion==='special_slam')bob+=.62*Math.sin(Math.PI*progress)-.14*Math.max(0,swing)
    else if(motion==='attack_3' && swing>0)bob-=.09*swing
    else if(inCombat && !running && !airborne)bob-=.04
    visual.position.y=T.MathUtils.damp(visual.position.y,bob,22,dt)
    if(motion==='warden_swing')wardenSweep?.(progress)
    if(staff){
      // Aim by turning the wrist; the staff stays fixed inside the fist.
      const hand=grip.parent
      const right=runningArms[1].outward*(forward===1?-1:1)
      bladeDirection.set(right*(.12+.24*castDraw),1-.92*castRelease,-.14+.34*castDraw-.81*castRelease)
        .normalize().applyQuaternion(player.getWorldQuaternion(actorRotation))
      hand.getWorldQuaternion(handRotation)
      restBladeDirection.copy(Y).applyQuaternion(grip.quaternion).applyQuaternion(handRotation)
      hand.parent.getWorldQuaternion(wristParentRotation).invert()
      slashGrip.setFromUnitVectors(restBladeDirection,bladeDirection).multiply(handRotation).premultiply(wristParentRotation)
      hand.quaternion.slerp(slashGrip,casting&&progress===.57?1:blend)
    }
    if(crossGrip && !wardenFist){
      const turnThrough=wardenAttack?(wardenSlam?.30:.48)*(impact-.55*charge):
        comboStrike?(motion==='attack_2'?-.38:.38)*(cut-.55*draw):0
      const gripTarget=gripTurn.setFromAxisAngle(Y,turnThrough).multiply(gripRest)
      const fittedBlade=weapon.children[0]?.userData.swordModel
      const overhead=fittedBlade&&(motion==='attack_3'||wardenSlam)
      const lift=wardenSlam?.31:.23, hit=wardenSlam?.48:.41
      const overheadWeight=overhead?smooth(progress,.07,lift)*(1-smooth(progress,hit+.13,.95)):0
      const carryBlade=fittedBlade && inCombat && (motion==='idle'||running)
      const guideWeight=carryBlade?.78:Math.max(slashWeight,overheadWeight)
      if(guideWeight>0){
        const right=runningArms[1].outward*(forward===1?-1:1)
        // Guide the visible blade through an arc in front of the fighter.
        if(carryBlade){
          bladeDirection.set(right*.83,-.35,-.54)
        }else if(overhead){
          const pitch=T.MathUtils.lerp(1.36,-.85,smooth(progress,lift,hit+.09))
          bladeDirection.set(right*.36,Math.sin(pitch),-Math.cos(pitch))
        }else{
          const angle=T.MathUtils.lerp(fittedBlade?.21:.04,1.57,sweep)
          const rise=motion==='attack_2'?T.MathUtils.lerp(-.3,.48,sweep):T.MathUtils.lerp(.28,-.18,sweep)
          bladeDirection.set(right*Math.sin(angle),rise,-Math.cos(angle))
        }
        bladeDirection.normalize()
        bladeDirection.applyQuaternion(player.getWorldQuaternion(actorRotation))
          .applyQuaternion(grip.parent.getWorldQuaternion(handRotation).invert())
        restBladeDirection.copy(Y).applyQuaternion(gripTarget)
        slashGrip.setFromUnitVectors(restBladeDirection,bladeDirection).multiply(gripTarget)
        if(fittedBlade){
          bladeFace.copy(Y).applyQuaternion(handRotation)
          bladeSide.crossVectors(bladeDirection,bladeFace)
          if(bladeSide.lengthSq()>.05){
            bladeSide.normalize()
            bladeFace.crossVectors(bladeSide,bladeDirection)
            bladeBasis.makeBasis(bladeSide,bladeDirection,bladeFace)
            slashGrip.slerp(faceGrip.setFromRotationMatrix(bladeBasis),.9)
          }
        }
        gripTarget.slerp(slashGrip,guideWeight)
      }
      grip.quaternion.slerp(gripTarget,blend)
    }
  }
}
