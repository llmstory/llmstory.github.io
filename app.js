'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const colors=['#295f8c','#1d8276','#b17c3d','#965967'];
const short={T1:'叙事结构',T2:'人物关系',T3:'场景',T4:'叙述语言',T5:'体验',T6:'有效新意'};
let data,cat,byModel,byRun,views,averageRows,selected=[],currentRows=[];
const dimensionName=d=>({T3:'场景与世界',T5:'生活体验与洞察'}[d]??data.scoring.dimensions[d]);
const fmt=n=>typeof n==='number'?n.toFixed(2):'—';
function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
function toast(text){$('#toast').textContent=text;$('#toast').style.display='block';setTimeout(()=>$('#toast').style.display='none',3200);}
async function json(path){const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw new Error(`读取失败 (${r.status})：${path}`);return r.json();}
function score(row,metric=$('#metric').value){return CNWBRankings.value(row.scopes[$('#scope').value],metric);}
function name(row){return byModel[row.model_id].name;}
const runLabel=id=>byRun[id].label;
function counts(row,scope=$('#scope').value){const s=row.scopes[scope];if(!row.average)return `${s.n}/${s.planned}`;return s.components.map((p,i)=>`${views.average.judge_labels[i]} ${p?`${p.n}/${p.planned}`:'未评分'}`).join(' · ');}
function dimensionNote(row,d){const s=row.scopes[$('#scope').value];if(!row.average){const v=s.dimensions[d];return `${dimensionName(d)}：${v.n}/${v.planned}项；等级均值 ${fmt(v.mean)}`;}return s.components.map((p,i)=>{const v=p?.dimensions[d];return `${views.average.judge_labels[i]}：${v?`${v.n}/${v.planned}项；${fmt(CNWBRankings.value(p,d))}分`:'未评分'}`;}).join('；');}
function activeBoards(){
 const rows=$('#judge').value===views.average.id?averageRows:[...CNWBRankings.selectedBoards(data.boards,cat,$('#judge').value).values()];
 return rows.filter(row=>cat.default_runs[row.model_id]===row.generation_id||(cat.additional_default_runs||[]).includes(row.generation_id));
}
function render(){
 const metric=$('#metric').value;
 const previousRows=currentRows;
 currentRows=activeBoards().sort((a,b)=>(score(b)??-Infinity)-(score(a)??-Infinity)||name(a).localeCompare(name(b)));
 const selectedModels=selected.map(id=>previousRows.find(b=>b.evaluation_id===id)?.generation_id||data.boards.find(b=>b.evaluation_id===id)?.generation_id);
 selected=selectedModels.map(id=>currentRows.find(b=>b.generation_id===id)?.evaluation_id).filter(Boolean);
 if(!selected.length)selected=currentRows.filter(r=>score(r)!==null).slice(0,3).map(r=>r.evaluation_id);
 const ranks=new Map();let last=null,rank=0;
 currentRows.forEach((r,i)=>{const s=score(r);if(s!==null&&(last===null||Math.abs(s-last)>1e-9))rank=i+1;ranks.set(r.evaluation_id,s===null?'—':rank);last=s;});
 const rows=currentRows.filter(r=>(name(r)+' '+runLabel(r.generation_id)).toLowerCase().includes($('#search').value.trim().toLowerCase()));
 const body=$('#rows');body.replaceChildren();
 for(const r of rows){
  const tr=el('tr',selected.includes(r.evaluation_id)?'selected':'');const rankCell=el('td');rankCell.append(el('span','rank '+(ranks.get(r.evaluation_id)<=3?'top-rank':''),String(ranks.get(r.evaluation_id))));tr.append(rankCell);
  const checkCell=el('td');const check=el('input');check.type='checkbox';check.checked=selected.includes(r.evaluation_id);check.setAttribute('aria-label','对比 '+name(r)+' '+runLabel(r.generation_id));check.addEventListener('change',()=>{if(check.checked){if(selected.length>=4){check.checked=false;toast('最多对比4组，请先取消一组。');return;}selected.push(r.evaluation_id);}else selected=selected.filter(x=>x!==r.evaluation_id);tr.classList.toggle('selected',check.checked);renderComparison();});checkCell.append(check);tr.append(checkCell);
  const modelCell=el('td');const button=el('span','model-name',name(r));modelCell.append(button);const meta=el('div','model-meta');meta.append(el('span','',byModel[r.model_id].family),el('span','tag',runLabel(r.generation_id)));if(byRun[r.generation_id].historical)meta.append(el('span','tag','历史轮次'));modelCell.append(meta);tr.append(modelCell);
  const total=el('td','score-cell');total.append(el('b','',fmt(score(r,'total'))));const track=el('div','mini-track');const bar=el('i');bar.style.width=(score(r,'total')??0)+'%';track.append(bar);total.append(track);tr.append(total);
  for(const d of Object.keys(short)){const val=score(r,d);const max=Math.max(...currentRows.map(x=>score(x,d)??-Infinity));const td=el('td',val!==null&&Math.abs(val-max)<1e-9?'best':'',fmt(val));td.title=dimensionNote(r,d);tr.append(td);}
  tr.append(el('td','',counts(r)));body.append(tr);
 }
 if(!rows.length){const tr=el('tr');const td=el('td','empty','没有符合条件的已评审记录。');td.colSpan=11;tr.append(td);body.append(tr);}
 $$('[data-sort]').forEach(b=>{b.classList.toggle('active',b.dataset.sort===metric);b.closest('th').setAttribute('aria-sort',b.dataset.sort===metric?'descending':'none');});
 const scope=$('#scope').selectedOptions[0].textContent;
 $('#boardNote').textContent=`${$('#judge').selectedOptions[0].textContent} · ${scope} · ${rows.length}组记录 · 按${metric==='total'?'加权总分':short[metric]}降序，同分并列。`+($('#scope').value==='planning4'?' 规划题未测T4，总分留空，请按其他维度排序。':'');
 if($('#judge').value===views.average.id)$('#boardNote').textContent+=' 总分与各维均取两评委当前展示分数的算术平均，各占50%；先用原始精度计算，再保留两位小数。';
 const incomplete=rows.filter(r=>r.average?r.scopes[$('#scope').value].average_scores.total===null&&$('#scope').value!=='planning4':!r.scopes[$('#scope').value].complete&&!r.scopes[$('#scope').value].available_display).length;if(incomplete)$('#boardNote').textContent+=` 有${incomplete}组记录尚未完整；缺失维度和总分留空，不填零或缩小分母。`;
 renderComparison();
}
function renderComparison(){
 const rows=selected.map(id=>currentRows.find(r=>r.evaluation_id===id)).filter(Boolean);
 $('#legend').replaceChildren();rows.forEach((r,i)=>{const label=el('span');const dot=el('i');dot.style.background=colors[i];label.append(dot,document.createTextNode(name(r)+' · '+runLabel(r.generation_id)));$('#legend').append(label);});
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 400 350');
 function shape(tag,attrs,text){const x=document.createElementNS(ns,tag);Object.entries(attrs).forEach(([k,v])=>x.setAttribute(k,v));if(text)x.textContent=text;svg.append(x);return x;}
 const cx=200,cy=170,R=120,axes=Object.keys(short),point=(i,v)=>{const a=(i*60-90)*Math.PI/180;return[cx+Math.cos(a)*R*v/100,cy+Math.sin(a)*R*v/100];};
 for(const n of [20,40,60,80,100]){shape('polygon',{points:axes.map((_,i)=>point(i,n).join(',')).join(' '),fill:'none',stroke:'#dfe5e6','stroke-width':1});shape('text',{x:cx+5,y:cy-R*n/100+3,fill:'#98a3aa','font-size':8},String(n));}
 axes.forEach((d,i)=>{const p=point(i,100),l=point(i,123);shape('line',{x1:cx,y1:cy,x2:p[0],y2:p[1],stroke:'#e1e5e4'});shape('text',{x:l[0],y:l[1]+3,'text-anchor':'middle',fill:'#596f7a','font-size':10},d+' '+short[d]);});
 rows.forEach((r,i)=>{const vals=axes.map(d=>score(r,d));if(vals.some(v=>v===null))return;shape('polygon',{points:vals.map((v,a)=>point(a,v).join(',')).join(' '),fill:colors[i],'fill-opacity':.07,stroke:colors[i],'stroke-width':2});vals.forEach((v,a)=>{const p=point(a,v);shape('circle',{cx:p[0],cy:p[1],r:3,fill:colors[i]});});});
 $('#radar').replaceChildren(svg);$('#radar').setAttribute('aria-label',rows.map(r=>name(r)+': '+axes.map(d=>d+' '+fmt(score(r,d))).join('，')).join('；')||'请在榜单中选择模型');
 $('#bars').replaceChildren();for(const d of axes){const group=el('div','bar-group');group.append(el('div','bar-label',d+' '+dimensionName(d)));rows.forEach((r,i)=>{const bar=el('div','bar-row');bar.title=name(r)+' '+fmt(score(r,d));const track=el('div','bar-track'),fill=el('div','bar-fill');fill.style.background=colors[i];fill.style.width=(score(r,d)??0)+'%';track.append(fill);bar.append(track,el('span','bar-value',fmt(score(r,d))));group.append(bar);});$('#bars').append(group);}
 $('#compareNote').textContent=!rows.length?'请在榜单中勾选需要对比的模型。':$('#scope').value==='planning4'?'规划题缺少T4，雷达多边形不绘制；各已测维度在右侧单独展示。':'对比使用当前评委及评价范围；缺项显示为空，不按零分绘制。完整数值也可在上方表格读取。';
}
function csv(){const quote=s=>'"'+String(s??'').replaceAll('"','""')+'"';const rows=[['模型','生成配置','评委视角','评价范围','总分',...Object.keys(short),'完整题数']];for(const r of currentRows.filter(r=>(name(r)+' '+runLabel(r.generation_id)).toLowerCase().includes($('#search').value.trim().toLowerCase()))){rows.push([name(r),runLabel(r.generation_id),$('#judge').selectedOptions[0].textContent,$('#scope').selectedOptions[0].textContent,score(r,'total'),...Object.keys(short).map(d=>score(r,d)),counts(r)]);}const blob=new Blob(['\ufeff'+rows.map(r=>r.map(quote).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download='CNWB-ranking.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function init(){[data,views]=await Promise.all([json('data/leaderboard.json'),json('ranking-views.json')]);cat=data.catalog;averageRows=CNWBRankings.averageBoards(data.boards,cat,views.average);byModel=Object.fromEntries(cat.models.map(x=>[x.id,x]));byRun=Object.fromEntries(cat.generation_runs.map(x=>[x.id,x]));$('#modelCount').textContent=cat.models.length;$('#judgeCount').replaceChildren(document.createTextNode(String(cat.judges.filter(j=>j.status==='available').length)),el('span','',` / ${cat.judges.length}`));const averageOption=el('option','',views.average.name);averageOption.value=views.average.id;$('#judge').append(averageOption);for(const j of cat.judges){const o=el('option','',j.name+(j.status==='planned'?' · 尚未评审':''));o.value=j.id;o.disabled=j.status!=='available';$('#judge').append(o);}$('#judge').value=views.default_view;
 for(const[d]of Object.entries(data.scoring.dimensions)){const n=dimensionName(d),o=el('option','',d+' '+n);o.value=d;$('#metric').append(o);const card=el('div');card.append(el('b','',d),el('strong','',n),el('small','',`权重 ${data.scoring.weights[d]*100}%`));$('#dimensions').append(card);}
 for(const id of ['judge','scope','metric'])$('#'+id).addEventListener('change',()=>{if(id==='scope'&&$('#scope').value==='planning4'&&$('#metric').value==='total')$('#metric').value='T1';render();});$('#search').addEventListener('input',render);$$('[data-sort]').forEach(b=>b.addEventListener('click',()=>{$('#metric').value=b.dataset.sort;render();}));$('#resetCompare').addEventListener('click',()=>{selected=currentRows.filter(r=>score(r)!==null).slice(0,3).map(r=>r.evaluation_id);render();});$('#download').addEventListener('click',csv);render();
}
init().catch(e=>{$('#rows').replaceChildren();const tr=el('tr'),td=el('td','empty','数据加载失败：'+e.message+'。请稍后刷新页面。');td.colSpan=11;tr.append(td);$('#rows').append(tr);});
