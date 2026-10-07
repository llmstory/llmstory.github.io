'use strict';
const CNWBReader=(()=>{
 const $=s=>document.querySelector(s);
 const element=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
 let tasks=[],runs=[],token=0;
 const cache=new Map();
 async function load(path){const r=await fetch(path);if(!r.ok)throw new Error('读取失败，请稍后重试。');return r.json();}
 const ready=Promise.all([load('data/reading/tasks.json'),load('data/reading/index.json')]).then(([t,c])=>{
  tasks=t;runs=c.runs;
  $('#libraryCount').textContent=`${t.length}道题 · ${c.runs.length}组配置 · ${c.works}份作品`;
  for(const task of tasks){const o=element('option','',`${task.id} · ${task.title}`);o.value=task.id;$('#readerTask').append(o);}
  for(const run of runs){const o=element('option','',`${run.name} · ${run.label}`);o.value=run.id;$('#readerRun').append(o);}
  renderTasks();
  $('#taskSearch').addEventListener('input',renderTasks);$('#taskScope').addEventListener('change',renderTasks);
  for(const id of ['readerTask','readerRun'])$('#'+id).addEventListener('change',()=>refresh());
  $('#previousTask').addEventListener('click',()=>move(-1));$('#nextTask').addEventListener('click',()=>move(1));
  $('#closeReader').addEventListener('click',()=>$('#reader').close());
  $('#reader').addEventListener('close',()=>{token++;});
 }).catch(e=>{$('#taskGrid').replaceChildren(element('p','reading-error',e.message));throw e;});
 // A catch here prevents an unhandled rejection if the reading assets fail before a click.
 ready.catch(()=>{});
 function renderTasks(){
  const query=$('#taskSearch').value.trim().toLowerCase(),scope=$('#taskScope').value;
  const shown=tasks.filter(t=>(scope==='all'||t.scope===scope)&&`${t.id} ${t.title}`.toLowerCase().includes(query));
  const grid=$('#taskGrid');grid.replaceChildren();
  const forms={setting:'长篇设定',outline:'长篇提纲',complete_story:'完整故事',one_act_play:'独幕短剧',dialogue_story:'对话故事',novel_opening:'小说开头'};
  for(const t of shown){const b=element('button','task');b.type='button';b.setAttribute('aria-label',`阅读 ${t.id} ${t.title}`);b.append(element('span','task-id',t.id),element('strong','',t.title),element('small','',forms[t.form]||'创作任务'));b.addEventListener('click',()=>openTask(t.id));grid.append(b);}
  if(!shown.length)grid.append(element('p','empty','没有符合条件的题目。'));
 }
 function defaultRun(){return document.querySelector('#rows .model-name')?.dataset.readingRun||runs[0].id;}
 async function open(taskId,runId,promptOpen){
  try{await ready;$('#readerTask').value=taskId||tasks[0].id;$('#readerRun').value=runId||defaultRun();const dialog=$('#reader');if(!dialog.open)dialog.showModal();await refresh(promptOpen);}catch(e){$('#toast').textContent=e.message;$('#toast').style.display='block';}
 }
 function openTask(taskId){return open(taskId,null,true);}
 function openModel(runId){return open(null,runId,false);}
 function move(delta){const i=tasks.findIndex(t=>t.id===$('#readerTask').value);const t=tasks[i+delta];if(t){$('#readerTask').value=t.id;refresh();}}
 function promptBlock(t,open){
  const details=element('details','reader-prompt');details.open=open;details.append(element('summary','','题目要求与材料'));
  const content=element('div','prompt-content');
  for(const[key,label]of [['task','题干'],['constraints','创作要求'],['style','风格与语气'],['instructions','交付要求'],['source','题给材料']]){
   const value=t.prompt[key];if(!value||Array.isArray(value)&&!value.length)continue;
   content.append(element('h3','',label));
   if(Array.isArray(value)){const list=element('ul');for(const text of value)list.append(element('li','',text));content.append(list);}else content.append(element('p','prompt-text',value));
  }
  if(t.sources?.length){const sourceList=element('ul');content.append(element('h3','','材料出处'));
   for(const source of t.sources){const li=element('li'),link=element('a','source-link',source.title);link.href=source.url;link.target='_blank';link.rel='noopener noreferrer';li.append(link);sourceList.append(li);}content.append(sourceList);
  }
  details.append(content);return details;
 }
 async function refresh(promptOpen){
  const request=++token,taskId=$('#readerTask').value,runId=$('#readerRun').value;
  const t=tasks.find(x=>x.id===taskId),run=runs.find(x=>x.id===runId),body=$('#readerBody');
  if(!t||!run)return;
  const keepOpen=promptOpen??body.querySelector('.reader-prompt')?.open??false;
  $('#readerTitle').textContent=`${t.id} · ${t.title}`;
  const index=tasks.indexOf(t);$('#previousTask').disabled=index===0;$('#nextTask').disabled=index===tasks.length-1;
  body.replaceChildren(promptBlock(t,keepOpen),element('p','reader-caption','正在读取作品…'));
  try{
   if(!cache.has(runId))cache.set(runId,load(`data/reading/${runId}.json`).catch(e=>{cache.delete(runId);throw e;}));
   const data=await cache.get(runId);if(request!==token||!$('#reader').open)return;
   body.replaceChildren(promptBlock(t,keepOpen));
   const w=data.works.find(x=>x.task_id===taskId);
   body.append(element('h3','','模型作品'),element('p','reader-caption',`${run.name} · ${run.family} · ${run.label}`));
   if(w){body.append(element('div','work-text',w.text),element('p','work-hash',`作品 SHA-256：${w.sha256}`));}
   else{const missing=element('div','reader-missing');missing.append(element('strong','','本题作品未交付'),element('p','',`${run.name} 尚无 ${t.id} 的生成文本。可切换其他模型阅读同题作品。`));body.append(missing);}
   $('#reader').scrollTop=0;
  }catch(e){if(request===token&&$('#reader').open)body.replaceChildren(promptBlock(t,keepOpen),element('p','reading-error',e.message));}
 }
 return {openTask,openModel};
})();
