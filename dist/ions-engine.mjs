// Names and formulas transcribed from the supplied polyatomic-ion table.
const rows=[
['Ammonium','NH4','+','other'],['Hydroxide','OH','-','other'],['Cyanide','CN','-','other'],['Acetate','C2H3O2','-','other','CH3COO'],
['Nitrite','NO2','-','nitrogen'],['Nitrate','NO3','-','nitrogen'],['Sulfite','SO3','2-','sulfur'],['Sulfate','SO4','2-','sulfur'],
['Hydrogen sulfite','HSO3','-','sulfur'],['Hydrogen sulfate','HSO4','-','sulfur'],['Carbonate','CO3','2-','carbon'],['Hydrogen carbonate','HCO3','-','carbon','', 'bicarbonate'],
['Phosphate','PO4','3-','phosphorus'],['Hydrogen phosphite','HPO3','2-','phosphorus'],['Dihydrogen phosphite','H2PO3','-','phosphorus'],['Hydrogen phosphate','HPO4','2-','phosphorus'],['Dihydrogen phosphate','H2PO4','-','phosphorus'],
['Hypochlorite','ClO','-','chlorine'],['Chlorite','ClO2','-','chlorine'],['Chlorate','ClO3','-','chlorine'],['Perchlorate','ClO4','-','chlorine'],
['Hypobromite','BrO','-','bromine'],['Bromite','BrO2','-','bromine'],['Bromate','BrO3','-','bromine'],['Perbromate','BrO4','-','bromine'],
['Hypoiodite','IO','-','iodine'],['Iodite','IO2','-','iodine'],['Iodate','IO3','-','iodine'],['Periodate','IO4','-','iodine'],
['Chromate','CrO4','2-','chromium'],['Dichromate','Cr2O7','2-','chromium'],['Permanganate','MnO4','-','other']];
export const ions=rows.map(([name,body,charge,family,alternate,alias],id)=>({id,name,body,charge,family,alternate,alias}));
export const key='element-learn:polyatomic-ions:v1';
const clone=x=>JSON.parse(JSON.stringify(x));
const normName=s=>s.trim().toLowerCase().replace(/\s+ion$/,'').replace(/\s+/g,' ');
export function gradeName(ion,value){return [ion.name,ion.alias].filter(Boolean).some(x=>normName(x)===normName(value));}
export function gradeFormula(ion,value){
  const x=value.trim().replace(/₀/g,'0').replace(/₁/g,'1').replace(/₂/g,'2').replace(/₃/g,'3').replace(/₄/g,'4').replace(/₅/g,'5').replace(/₆/g,'6').replace(/₇/g,'7').replace(/₈/g,'8').replace(/₉/g,'9').replace(/⁺/g,'+').replace(/⁻/g,'-').replace(/²/g,'^2').replace(/³/g,'^3').replace(/−/g,'-').replace(/\s+/g,'');
  return [ion.body,ion.alternate].filter(Boolean).some(body=>x===body+'^'+ion.charge || (ion.charge.length===1 && x===body+ion.charge));
}
export function formulaHTML(ion){return ion.body.replace(/(\d+)/g,'<sub>$1</sub>')+'<sup>'+ion.charge.replace('-', '−')+'</sup>';}
function shuffle(a,seed){a=[...a];for(let i=a.length-1;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=seed%(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
export class IonEngine {
 constructor(saved=null){
  const fresh={version:1,view:'learn',group:0,pass:0,position:0,order:[],current:null,feedback:null,serial:0,answers:0,correct:0,misses:Object.fromEntries(ions.map(x=>[x.id,0])),draft:'',reviewIds:null,paused:null};
  if(saved && (saved.version!==1 || !Number.isInteger(saved.group) || saved.group<0 || saved.group>3 || !Number.isInteger(saved.pass) || saved.pass<0 || saved.pass>4 || !Array.isArray(saved.order) || !saved.misses || typeof saved.misses!=='object' || !Number.isInteger(saved.answers) || !['learn','reference'].includes(saved.view))) throw Error('Saved ion progress could not be read.');
  this.s=saved?clone(saved):fresh;
  this.s.reviewIds??=null;this.s.paused??=null;
 }
 snapshot(){return clone(this.s);}
 groupCount(){return Math.ceil((this.s.reviewIds?.length??ions.length)/8);}
 group(){return (this.s.reviewIds??ions.map(x=>x.id)).slice(this.s.group*8,this.s.group*8+8).map(id=>ions[id]);}
 next(){const s=this.s;if(s.current||s.pass===4)return s.current;const group=this.group();if(!s.order.length){s.order=shuffle(group.map(x=>x.id),++s.serial*7919+s.answers);s.position=0;}
  const id=s.order[s.position],ion=ions[id],candidates=ions.filter(x=>x.id!==id).sort((a,b)=>Number(b.family===ion.family)-Number(a.family===ion.family)||a.id-b.id);
  s.current={id,questionId:`ion-${++s.serial}`,options:shuffle([id,...candidates.slice(0,3).map(x=>x.id)],s.serial*421)};return s.current;
 }
 answer(value,questionId){const s=this.s,q=s.current;if(!q||s.feedback||q.questionId!==questionId)return false;const ion=ions[q.id];let correct;
  if(s.pass<2){if(!q.options.includes(Number(value)))throw Error('Choose an answer.');correct=Number(value)===q.id;}else{if(!String(value).trim())throw Error('Enter an answer first.');correct=s.pass===2?gradeName(ion,String(value)):gradeFormula(ion,String(value));}
  s.answers++;if(correct)s.correct++;else s.misses[q.id]++;s.feedback={questionId,correct};return true;
 }
 advance(){const s=this.s;if(!s.feedback)return false;s.current=null;s.feedback=null;s.draft='';s.position++;if(s.position>=s.order.length){s.pass++;s.order=[];s.position=0;}this.next();return true;}
 nextGroup(){if(this.s.pass!==4)return false;if(this.s.reviewIds&&this.s.group===this.groupCount()-1)return this.endReview();this.s.group=(this.s.group+1)%this.groupCount();this.s.pass=0;this.s.order=[];this.s.current=null;this.next();return true;}
 startReview(){const s=this.s,ids=ions.filter(x=>s.misses[x.id]>0).sort((a,b)=>s.misses[b.id]-s.misses[a.id]||a.id-b.id).map(x=>x.id);if(!ids.length||s.reviewIds)return false;const paused=this.snapshot();this.s={...s,view:'learn',group:0,pass:0,position:0,order:[],current:null,feedback:null,draft:'',reviewIds:ids,paused};this.next();return true;}
 endReview(){const s=this.s;if(!s.reviewIds||!s.paused)return false;this.s={...s.paused,answers:s.answers,correct:s.correct,misses:s.misses,serial:s.serial};return true;}
}
