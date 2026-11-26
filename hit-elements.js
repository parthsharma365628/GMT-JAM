import * as T from 'three'

const duration=5
const burnDamage=.5
const weapons={cinder_greatsword:'fire',seraph_rapier:'ice'}
const spark=new T.OctahedronGeometry(1)
const fire=new T.MeshBasicMaterial({color:0xff681a,transparent:true,opacity:.88,depthWrite:false})
const ice=new T.MeshBasicMaterial({color:0xa8eeff,transparent:true,opacity:.88,depthWrite:false})

function aura(root,element){
  const group=new T.Group()
  group.visible=false
  for(let i=0;i<7;i++)group.add(new T.Mesh(spark,element==='fire'?fire:ice))
  root.add(group)
  return group
}

export class HitElements{
  constructor(root){
    this.root=root
    this.targets=new Map()
  }
  hit(target,weaponId){
    const element=weapons[weaponId]
    if(!element)return
    let effects=this.targets.get(target)
    if(!effects){effects=new Map();this.targets.set(target,effects)}
    const current=effects.get(element)
    if(current)current.remaining=duration
    else effects.set(element,{remaining:duration,age:0,nextTick:1,visual:aura(this.root,element)})
  }
  speed(target){return this.targets.get(target)?.has('ice') ? .65 : 1}
  update(dt,burn,isAlive){
    for(const [target,effects] of this.targets){
      for(const [element,effect] of effects){
        if(isAlive(target)){
          const step=Math.min(effect.remaining,dt)
          effect.remaining-=step
          effect.age+=step
          if(element==='fire' && effect.age+1e-6>=effect.nextTick){
            effect.nextTick++
            burn(target,burnDamage)
          }
        }
        if(effect.remaining<=0 || !isAlive(target)){
          effect.visual.removeFromParent();effects.delete(element)
          continue
        }
        const burning=element==='fire'
        effect.visual.visible=true
        effect.visual.position.copy(target.position)
        const radius=target.radius??.85
        effect.visual.children.forEach((piece,i)=>{
          const phase=(effect.age*(burning?1.35:.8)+i/7)%1
          const angle=i*2.4+effect.age*(burning?1.7:-1.1)
          const reach=radius*(.72+phase*.42)
          piece.position.set(Math.cos(angle)*reach,burning?.14+1.55*phase:1.2-phase,Math.sin(angle)*reach)
          const size=(.055+Math.sin(phase*Math.PI)*.1)*(radius+.45)
          piece.scale.set(size,size*(burning?1.85:.66),size)
          piece.rotation.set(phase*3,angle,phase*2)
        })
      }
      if(effects.size===0)this.targets.delete(target)
    }
  }
  dispose(){
    for(const effects of this.targets.values())for(const effect of effects.values())effect.visual.removeFromParent()
    this.targets.clear()
  }
}
