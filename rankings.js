'use strict';
// Display views only: source evaluations and full-task aggregates remain intact.
(function(root){
 function selectedBoards(boards,catalog,judgeId){
  const grouped=new Map();
  for(const row of boards.filter(b=>b.judge_id===judgeId)){
   const old=grouped.get(row.generation_id),preferred=catalog.default_evaluations[row.generation_id];
   if(!old||row.evaluation_id===preferred||(old.evaluation_id!==preferred&&row.revision>old.revision))grouped.set(row.generation_id,row);
  }
  return grouped;
 }
 function value(scope,metric){
  if(!scope)return null;
  if(scope.average_scores)return scope.average_scores[metric]??null;
  if(scope.available_display)return metric==='total'?scope.available_display.total:scope.available_display.dimensions[metric]??null;
  if(metric==='total')return scope.total??null;
  const d=scope.dimensions[metric];return d&&d.n===d.planned&&d.n>0?d.score:null;
 }
 function averageBoards(boards,catalog,config){
  if(config.judge_ids.length!==2||config.weights.length!==2||config.weights.some(w=>w!==0.5))throw Error('Average view requires two judges at 50% each');
  const maps=config.judge_ids.map(id=>selectedBoards(boards,catalog,id));
  const runs=new Set(maps.flatMap(m=>[...m.keys()]));
  return [...runs].map(rid=>{
   const components=maps.map(m=>m.get(rid)||null),source=components.find(Boolean),scopes={};
   for(const key of Object.keys(source.scopes)){
    const parts=components.map(b=>b?.scopes[key]||null),template=parts.find(Boolean),average_scores={},dimensions={};
    for(const metric of ['total',...Object.keys(template.dimensions)]){
     const values=parts.map(s=>value(s,metric));
     // A missing judge value cannot become zero or a one-judge average.
     average_scores[metric]=values.every(v=>typeof v==='number')?values[0]*0.5+values[1]*0.5:null;
     if(metric!=='total')dimensions[metric]={score:average_scores[metric],mean:average_scores[metric]===null?null:average_scores[metric]/20};
    }
    scopes[key]={complete:parts.every(s=>s?.complete),planned:template.planned,average_scores,dimensions,components:parts};
   }
   return {evaluation_id:config.id+'::'+rid,generation_id:rid,model_id:source.model_id,judge_id:config.id,average:true,components,scopes};
  });
 }
 const api={selectedBoards,value,averageBoards};
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.CNWBRankings=api;
})(typeof globalThis==='object'?globalThis:this);
