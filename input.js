const keys={
  KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',
  KeyW:'up',ArrowUp:'up',KeyS:'down',ArrowDown:'down',
  Space:'jump',KeyJ:'attack',KeyI:'special',KeyK:'dodge',ShiftLeft:'dodge',ShiftRight:'dodge',
  KeyE:'claim',Escape:'pause',
  Digit1:'slot1',Digit2:'slot2',Digit3:'slot3',KeyQ:'cycleWeapon',
  KeyR:'potion',KeyF:'potion'
}
export const held=new Set(), pressed=new Set()
function press(action){if(action){held.add(action);pressed.add(action)}}
window.addEventListener('keydown',e=>{
  const a=keys[e.code]; if(!a || (e.target.tagName==='BUTTON' && a==='jump'))return
  e.preventDefault();if(!e.repeat)press(a)
})
window.addEventListener('keyup',e=>held.delete(keys[e.code]))
window.addEventListener('blur',()=>{held.clear();pressed.clear()})
window.addEventListener('pointerdown',e=>{if(e.target.tagName==='CANVAS')pressed.add(e.button===2?'special':'attack')})
window.addEventListener('contextmenu',e=>e.preventDefault())
export const axis=(a,b)=>{
  let v=0
  for(const k of held){if(k===a)v=1;else if(k===b)v=-1}
  return v
}