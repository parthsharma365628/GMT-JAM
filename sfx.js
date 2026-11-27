// Tiny synthesized sound effects for the runner (Web Audio, no files). The context starts on the first key or
// click, as browsers require. M toggles mute (saved in localStorage under gmt-jam.muted).
const MUTE_KEY='gmt-jam.muted'
let ctx=null,master=null,noiseBuf=null,wind=null,muted=localStorage.getItem(MUTE_KEY)==='1'

function boot(){
  if(ctx){if(ctx.state==='suspended')ctx.resume();return}
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return
  ctx=new AC();master=ctx.createGain();master.gain.value=muted?0:.55
  const comp=ctx.createDynamicsCompressor();master.connect(comp);comp.connect(ctx.destination)
  noiseBuf=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate)
  const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1
  // Looping wind bed whose volume and brightness follow the run speed.
  const src=ctx.createBufferSource();src.buffer=noiseBuf;src.loop=true
  const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=300;filter.Q.value=.7
  const gain=ctx.createGain();gain.gain.value=0
  src.connect(filter);filter.connect(gain);gain.connect(master);src.start()
  wind={filter,gain}
}
addEventListener('keydown',boot);addEventListener('pointerdown',boot)

function tone({type='sine',f0=440,f1=f0,dur=.15,gain=.25,delay=0,attack=.005}){
  if(!ctx||muted)return
  const t=ctx.currentTime+delay,o=ctx.createOscillator(),g=ctx.createGain()
  o.type=type;o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur)
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(gain,t+attack);g.gain.exponentialRampToValueAtTime(.0001,t+dur)
  o.connect(g);g.connect(master);o.start(t);o.stop(t+dur+.02)
}
function hiss({f0=1000,f1=f0,dur=.2,gain=.2,q=1,type='bandpass',delay=0}){
  if(!ctx||muted)return
  const t=ctx.currentTime+delay,s=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain()
  s.buffer=noiseBuf;f.type=type;f.Q.value=q
  f.frequency.setValueAtTime(f0,t);f.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur)
  g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur)
  s.connect(f);f.connect(g);g.connect(master);s.start(t,Math.random());s.stop(t+dur+.02)
}

export const sfx={
  get muted(){return muted},
  toggleMute(){
    muted=!muted;localStorage.setItem(MUTE_KEY,muted?'1':'0')
    if(master)master.gain.setTargetAtTime(muted?0:.55,ctx.currentTime,.03)
    return muted
  },
  jump(){tone({type:'sine',f0:240,f1:640,dur:.16,gain:.16});hiss({f0:700,f1:2600,dur:.2,gain:.12,q:.8})},
  land(impact=1){tone({type:'sine',f0:140,f1:42,dur:.2,gain:.32*impact});hiss({f0:900,f1:160,dur:.16,gain:.14*impact,type:'lowpass'})},
  coin(streak=0){
    const f=880*2**(Math.min(streak,14)/12)
    tone({type:'triangle',f0:f,dur:.09,gain:.13});tone({type:'triangle',f0:f*1.5,dur:.16,gain:.11,delay:.055})
  },
  chest(){[0,4,7,12,16].forEach((n,i)=>tone({type:'triangle',f0:523*2**(n/12),dur:.25,gain:.12,delay:i*.06}));hiss({f0:6000,f1:9000,dur:.4,gain:.05,q:2})},
  close(){hiss({f0:3200,f1:500,dur:.32,gain:.22,q:1.4});tone({type:'sine',f0:1400,f1:1900,dur:.12,gain:.07,delay:.05})},
  tier(level){[0,7,12].forEach((n,i)=>tone({type:'square',f0:440*2**((n+level*2)/12),dur:.12,gain:.05,delay:i*.05}))},
  milestone(){[0,4,7,11,14].forEach((n,i)=>tone({type:'triangle',f0:392*2**(n/12),dur:.3,gain:.1,delay:i*.07}))},
  death(){hiss({f0:2400,f1:90,dur:.55,gain:.45,type:'lowpass'});tone({type:'sawtooth',f0:220,f1:38,dur:.5,gain:.2});tone({type:'square',f0:90,f1:30,dur:.3,gain:.12})},
  // level 0..1, call every frame
  wind(level){
    if(!wind)return
    const t=ctx.currentTime
    wind.gain.gain.setTargetAtTime(level*.09,t,.15)
    wind.filter.frequency.setTargetAtTime(250+level*2200,t,.15)
  }
}
