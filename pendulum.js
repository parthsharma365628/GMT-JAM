import * as T from 'three'

const pivotY=6.3,arm=5.6
const swingAngle=(time,seed)=>.9*Math.sin(time*2.4+seed)
const flame=new T.SphereGeometry(1,7,5)
const points=flame.attributes.position
for(let i=0;i<points.count;i++){
  const y=points.getY(i), taper=1-y*.64
  points.setXYZ(i,points.getX(i)*taper+y*y*.15,y,points.getZ(i)*taper)
}
const leafShape=new T.Shape()
leafShape.moveTo(0,-1)
leafShape.quadraticCurveTo(.92,-.2,0,1)
leafShape.quadraticCurveTo(-.92,-.2,0,-1)
const leaf=new T.ShapeGeometry(leafShape,4)
const crystal=new T.OctahedronGeometry(1)
const material=new T.MeshBasicMaterial({side:T.DoubleSide})
const styles={
  fire:{count:37,geometry:flame,colors:[0xff2d06,0xff6711,0xffa133,0xffdb6c],life:.7},
  leaf:{count:23,geometry:leaf,colors:[0x619b36,0xaad763,0xd7b036,0xbb7733],life:1},
  ice:{count:29,geometry:crystal,colors:[0x42a9ff,0x72ddff,0xafdcff,0xe0faff],life:.85}
}

export function pendulum(parent,pivot,z,seed,{width,height,depth},element){
  const style=styles[element]
  const fire=element==='fire', leaves=element==='leaf'
  const particles=new T.InstancedMesh(style.geometry,material,style.count)
  particles.instanceMatrix.setUsage(T.DynamicDrawUsage)
  particles.frustumCulled=false
  parent.add(particles)
  const sample=new T.Object3D(),color=new T.Color()
  const seeds=Array.from({length:style.count},(_,i)=>{
    particles.setColorAt(i,color.setHex(style.colors[i%style.colors.length]))
    return {offset:i/style.count,x:(Math.random()-.5)*width*.87,
      z:(Math.random()-.5)*depth*.9,life:style.life*(.72+Math.random()*.52),
      size:.65+Math.random()*.65,drift:Math.random()-.5}
  })
  let angle=0

  return {
    update(time,showParticles){
      pivot.rotation.z=angle=swingAngle(time,seed)
      particles.visible=showParticles
      if(!showParticles)return
      for(const [i,s] of seeds.entries()){
        const phase=(time/s.life+s.offset)%1
        const age=phase*s.life
        // Follow the bob's position at emission so particles peel away from its swing.
        const emitted=swingAngle(time-age,seed)
        const radius=arm+(fire?-.43:.31)*height
        const x=Math.sin(emitted)*radius+s.x*Math.cos(emitted)
        const y=pivotY-Math.cos(emitted)*radius+s.x*Math.sin(emitted)
        const flutter=Math.sin(phase*7+i)*age
        sample.position.set(x+s.drift*age+flutter*(leaves?.56:.24),
          y+(fire?1.65:-1.65)*age,z+s.z+flutter*.34)
        const size=s.size*(fire?.22:leaves?.15:.105)*Math.sin(Math.PI*phase)**.62
        sample.scale.set(size,size*(fire?2.45:1.65),size)
        if(fire)sample.rotation.set(.2,0,s.drift+flutter*.6)
        else sample.rotation.set(i+phase*5,phase*8,i+flutter*3)
        sample.updateMatrix()
        particles.setMatrixAt(i,sample.matrix)
      }
      particles.instanceMatrix.needsUpdate=true
    },
    hits(lat,y,rel){
      const dx=lat-arm*Math.sin(angle),dy=y-(pivotY-arm*Math.cos(angle))
      const x=dx*Math.cos(angle)+dy*Math.sin(angle)
      const localY=dy*Math.cos(angle)-dx*Math.sin(angle)
      return (x/(width*.5+.32))**2+(localY/(height*.5+.48))**2+(rel/(depth*.5+.35))**2<1
    },
    dispose(){particles.dispose()}
  }
}
