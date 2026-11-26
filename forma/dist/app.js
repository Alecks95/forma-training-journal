import {openDatabase,updateJournal,localDay,shiftDay,startSession,doneSets,kgWeight} from './model.js';
import {icon,btn,esc,smallBtn,field,clockText} from './ui.js';
import {renderView,tabs} from './views.js';
import {buildForms} from './forms.js';
let state,toastTimer,lastRoute='',restWasRunning=false;
const ctx={foodDay:localDay(),exercise:'',routine:''};
const main=document.querySelector('main'),nav=document.querySelector('nav');
const bus='BroadcastChannel' in window?new BroadcastChannel('forma-journal-changes'):null;
const route=()=>{const p=location.hash.slice(1);return [...tabs,'run'].includes(p)?p:'workouts';};
function toast(message){
 const t=document.querySelector('#toast');t.textContent=message;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2800);
}
function draw(){
 if(!state)return;
 const p=route();
 if(p==='run'&&!state.active){location.replace('#workouts');return;}
 main.innerHTML=renderView(p,state,ctx);
 nav.querySelectorAll('a').forEach(a=>{const active=a.hash==='#'+(p==='run'?'workouts':p);a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
 if(p!==lastRoute){main.classList.remove('page-enter');void main.offsetWidth;main.classList.add('page-enter');lastRoute=p;window.scrollTo({top:0,behavior:'instant'});}
 document.title=(p==='run'?'Workout':p[0].toUpperCase()+p.slice(1))+' · Forma';
 tick();
}
async function refresh(){state=await updateJournal();return state;}
async function save(fn,render=true){state=await updateJournal(fn);bus?.postMessage('saved');if(render)draw();return state;}
function go(p){if(route()===p)draw();else location.hash=p;}
function closeAll(){document.querySelectorAll('dialog[open]').forEach(d=>d.close());}
function sheet(title,html){
 const d=document.createElement('dialog');d.setAttribute('aria-label',title);
 d.innerHTML='<div class="sheet"><div class="sheet-head"><h2>'+esc(title)+'</h2>'+smallBtn('close','Close dialog','close')+'</div>'+html+'</div>';
 document.querySelector('#dialogs').append(d);d.addEventListener('close',()=>d.remove(),{once:true});d.addEventListener('click',e=>{if(e.target!==d)return;const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();});
 d.showModal();return d;
}
function form(title,html,label,submit){
 const d=sheet(title,'<form><div class="form-body">'+html+'<div class="form-error" role="alert"></div></div><div class="form-footer">'+btn('close','Cancel','button')+'<button class="primary" type="submit">'+esc(label)+'</button></div></form>');
 const form=d.querySelector('form');form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('[type=submit]');if(button.disabled)return;button.disabled=true;
 try{await submit(new FormData(form),d);d.close();}catch(e){d.querySelector('.form-error').textContent=e.message||'Could not save. Try again.';}finally{button.disabled=false;}};
 return d;
}
const confirm=(title,summary,label,submit)=>form(title,'<p>'+esc(summary)+'</p>',label,submit);
const forms=buildForms({state:()=>state,ctx,save,sheet,form,confirm,toast,go,draw,refresh});
function tick(){
 const bar=document.querySelector('#rest-bar');
 if(!state?.active||!bar){restWasRunning=false;return;}
 const sec=Math.max(0,Math.ceil((state.active.restUntil-Date.now())/1000));
 bar.classList.toggle('hide',!sec);
 const elapsed=document.querySelector('#elapsed');if(elapsed)elapsed.textContent=clockText(Math.max(0,Math.floor((Date.now()-state.active.started)/1000)));
 if(sec)bar.querySelector('#timer-count').textContent=clockText(sec);
 else if(restWasRunning)toast('Rest complete');
 restWasRunning=!!sec;
}
function requireActive(s,id){if(!s.active||s.active.id!==id)throw Error('This session has changed. Reopen the workout.');return s.active;}
async function begin(id) {
 closeAll();await save(s=>{if(s.active)return;const r=s.routines.find(x=>x.id===id);if(!r)throw Error('Choose an existing routine.');s.active=startSession(r,s);});go('run');
 if(navigator.storage?.persist)navigator.storage.persist().catch(()=>{});
}
async function completeSet(b){
 const row=b.closest('.set-line'),i=Number(b.dataset.i),j=Number(b.dataset.j),aId=state.active.id,u=state.unit,done=b.getAttribute('aria-pressed')!=='true';
 const inputs=[...row.querySelectorAll('input')];if(inputs.some(x=>!x.reportValidity()))return;
 const values=Object.fromEntries(inputs.map(x=>[x.dataset.set,Number(x.value)]));values.kg=kgWeight(values.kg,u);
 await save(s=>{const a=requireActive(s,aId),item=a.items[i];Object.assign(item.sets[j],values,{done});a.restUntil=done&&item.rest?Date.now()+item.rest*1000:0;});
}
function finish(){
 const a=state.active,finished=doneSets(a).length,total=a.items.reduce((n,i)=>n+i.sets.length,0);
 if(!finished)return;
 const end=async()=>{await save(s=>{const w=requireActive(s,a.id);s.sessions.push({...w,ended:Math.max(w.started,Date.now()),restUntil:0});s.active=null;},false);go('workouts');toast('Workout saved');};
 if(finished<total)confirm('Finish this workout?','You completed '+finished+' of '+total+' sets. Only completed sets count toward progression.','Finish workout',end);
 else return end();
}
function discard(){
 const id=state.active.id;confirm('Discard this session?','This removes the in-progress session. Your saved routine stays in your library.','Discard session',async()=>{await save(s=>{requireActive(s,id);s.active=null;},false);go('workouts');toast('Session discarded');});
}
function editRest(ix){
 const a=state.active;form('Rest timer',field('Rest after each set (seconds)','rest',a.items[ix].rest,{max:3600,step:1})+'<p>Applies to this exercise in the current session.</p>','Save rest time',async fd=>{await save(s=>{requireActive(s,a.id).items[ix].rest=Number(fd.get('rest'));});toast('Rest time saved');});
}
async function actions(action,b) {
 const id=b.dataset.id,day=b.dataset.day,dialog=b.closest('dialog');
 switch(action){
 case 'inline':return;
 case 'close':dialog?.close();return;
 case 'settings':forms.settings();return;
 case 'routine-new':case 'routine-edit':if(dialog)dialog.close();forms.routine(id);return;
 case 'session-detail':forms.sessionDetails(id);return;
 case 'exercise-new':case 'exercise-edit':forms.exercise(id);return;
 case 'exercise-view':ctx.exercise=id;draw();window.scrollTo({top:0,behavior:'smooth'});return;
 case 'food-new':case 'food-edit':forms.food(id);return;
 case 'goals':forms.goals();return;
 case 'meal-new':forms.meal(id);return;
 case 'meal-delete':confirm('Remove this entry?','This removes the food entry from your diary. The food stays in your library.','Remove entry',async()=>{await save(s=>{s.meals=s.meals.filter(m=>m.id!==id);});toast('Entry removed');});return;
 case 'weight-new':case 'weight-edit':forms.weigh(day);return;
 case 'weight-delete':confirm('Delete this weigh-in?','This removes the entry for '+day+' and recalculates its weekly average.','Delete entry',async()=>{await save(s=>{s.weights=s.weights.filter(w=>w.day!==day);});toast('Weigh-in removed');});return;
 case 'day-prev':case 'day-next':ctx.foodDay=shiftDay(ctx.foodDay,action==='day-prev'?-1:1);draw();return;
 case 'select-routine':ctx.routine=id;draw();return;
 case 'empty-start':await save(s=>{if(!s.active)s.active=startSession({id:'empty',name:'Workout',items:[]},s);});go('run');return;
 case 'session-exercise':forms.sessionExercise();return;
 case 'set-add':case 'set-remove':{
  const sessionId=state.active.id,index=Number(b.dataset.i);
  await save(s=>{const sets=requireActive(s,sessionId).items[index].sets;
   if(action==='set-add'){if(sets.length>=100)throw Error('Maximum 100 sets per exercise.');sets.push({...sets.at(-1),done:false});}
   else if(sets.length>1&&!sets.at(-1).done)sets.pop();
  });return;
 }
 case 'start':return begin(id);
 case 'resume':closeAll();go('run');return;
 case 'exit-run':go('workouts');return;
 case 'set-check':return completeSet(b);
 case 'rest-edit':editRest(Number(b.dataset.i));return;
 case 'rest-add':case 'rest-skip':{const id=state.active.id;await save(s=>{const a=requireActive(s,id);a.restUntil=action==='rest-add'?Math.max(Date.now(),a.restUntil)+15000:0;});return;}
 case 'finish':return finish();
 case 'discard':discard();return;
 }
}
document.addEventListener('click',async e=>{
 const b=e.target.closest('[data-do]');if(!b||b.disabled||b.dataset.do==='inline')return;
 try{await actions(b.dataset.do,b);}catch(e){toast(e.message||'Unable to complete that action.');}
});
document.addEventListener('change',async e=>{
 const el=e.target;
 if(el.id==='food-day'){if(el.value&&el.validity.valid){ctx.foodDay=el.value;draw();}return;}
 if(el.id==='exercise-select'){ctx.exercise=el.value;draw();return;}
 if(el.dataset.set&&state.active){
  if(!el.reportValidity())return;
  const key=el.dataset.set,id=state.active.id,v=key==='kg'?kgWeight(el.value,state.unit):Number(el.value);
  try{await save(s=>{requireActive(s,id).items[Number(el.dataset.i)].sets[Number(el.dataset.j)][key]=v;},false);}
  catch(e){toast(e.message);}
 }
});
window.addEventListener('hashchange',draw);
bus?.addEventListener('message',async()=>{if(document.activeElement?.matches('[data-set]'))return;await refresh();draw();});
document.addEventListener('visibilitychange',async()=>{if(document.visibilityState==='visible'&&state){await refresh();draw();}});
document.querySelector('.settings').innerHTML=icon('settings',19);
nav.innerHTML=tabs.map(k=>'<a href="#'+k+'" class="nav-link">'+icon(k,17)+'<span>'+(k==='workouts'?'Workout':k[0].toUpperCase()+k.slice(1))+'</span></a>').join('');
async function init(){
 try{await openDatabase();await refresh();}
 catch{main.innerHTML='<section class="card"><h2>Local storage unavailable</h2><p>Allow site storage in this browser and reopen Forma to save your journal.</p></section>';return;}
 draw();setInterval(tick,350);
 if('serviceWorker' in navigator&&window.isSecureContext){navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(()=>toast('Offline setup paused. Reopen online to retry.'));}
}
init();

