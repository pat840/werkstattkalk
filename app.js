(function(){
var DEF_PROC={laserhand:{label:"Laserhandschweissen",speedMmPerSec:8,setupMin:8,extraPercent:15,euroPerHour:75},mag:{label:"MAG",speedMmPerSec:4,setupMin:12,extraPercent:25,euroPerHour:75},wig:{label:"WIG",speedMmPerSec:2,setupMin:15,extraPercent:30,euroPerHour:85},laser_cut:{label:"Laserschneiden",speedMmPerSec:20,pierceSec:1.5,setupMin:6,extraPercent:10,euroPerHour:95},bend:{label:"Abkanten",secPerBend:25,setupMin:10,extraPercent:10,euroPerHour:70},mill:{label:"Fraesen",runMin:15,setupMin:20,extraPercent:10,euroPerHour:80}};
var TYPES=Object.keys(DEF_PROC);
var DEF_MATS=[{id:"S235JR",name:"S235JR",density:7.85,euroPerKg:1.2},{id:"S355JR",name:"S355JR",density:7.85,euroPerKg:1.35},{id:"S355J2",name:"S355J2",density:7.85,euroPerKg:1.4},{id:"1.4301",name:"1.4301 (V2A)",density:8,euroPerKg:4.8},{id:"1.4404",name:"1.4404 (V4A)",density:8,euroPerKg:6.2},{id:"1.4571",name:"1.4571",density:8,euroPerKg:6.5},{id:"AlMg3",name:"AlMg3",density:2.66,euroPerKg:3.8},{id:"sonst",name:"Sonstiges",density:7.85,euroPerKg:0}];
function loadJSON(k,fb){try{var v=JSON.parse(localStorage.getItem(k)||"null");return v||fb;}catch(e){return fb;}}
function saveJSON(k,v){localStorage.setItem(k,JSON.stringify(v));}
function uid(){return (crypto.randomUUID&&crypto.randomUUID())||String(Date.now())+Math.random();}
function today(){return new Date().toISOString().slice(0,10);}
function esc(s){return String(s||"").split("&").join("&amp;").split("<").join("&lt;").split(">").join("&gt;");}
function fmtEuro(n){if(!isFinite(n))return "-";return n.toFixed(2).replace(".",",")+" EUR";}
function extra(a,p){return a*(1+(Number(p)||0)/100);}
function costMin(min,rate){return (Number(min)||0)/60*(Number(rate)||0);}
function loadParams(){var o=JSON.parse(JSON.stringify(DEF_PROC)),s=loadJSON("wk_params",{});TYPES.forEach(function(k){if(s[k])Object.assign(o[k],s[k]);});return o;}
var state={view:"home",custId:null,job:null,params:loadParams(),mats:loadJSON("wk_mats",null)||JSON.parse(JSON.stringify(DEF_MATS)),set:Object.assign({scrapPct:15,markupPct:0,shopName:"",shopAddr:"",shopLogo:""},loadJSON("wk_set",{})),dlg:null,customers:loadJSON("wk_custs",[]),quotes:loadJSON("wk_quotes",[])};
function saveAll(){saveJSON("wk_custs",state.customers);saveJSON("wk_quotes",state.quotes);saveJSON("wk_set",state.set);}
function $(id){return document.getElementById(id);}
function show(n){state.view=n;["home","cust","part","settings"].forEach(function(id){$(id).classList.toggle("hidden",id!==n);});$("btnBack").hidden=n==="home";if(n==="home"){$("headTitle").textContent="WerkstattKalk";$("headSub").textContent="Kunden und Angebote";}}
function findMat(id){for(var i=0;i<state.mats.length;i++) if(state.mats[i].id===id) return state.mats[i]; return state.mats[0];}
function findCust(id){for(var i=0;i<state.customers.length;i++) if(state.customers[i].id===id) return state.customers[i]; return null;}
function calcProc(proc,P,qty){
 var p=P[proc.type]||{},each=0,setup=Number(p.setupMin)||0,rate=Number(p.euroPerHour)||0;
 if(proc.type==="laserhand"||proc.type==="mag"||proc.type==="wig") each=extra(((Number(proc.lengthMm)||0)/(Number(p.speedMmPerSec)||1))/60,p.extraPercent);
 else if(proc.type==="laser_cut"){var cut=((Number(proc.lengthMm)||0)/(Number(p.speedMmPerSec)||1))/60;each=extra(cut+((Number(proc.pierces)||0)*(Number(p.pierceSec)||0))/60,p.extraPercent);}
 else if(proc.type==="bend") each=extra(((Number(proc.bends)||0)*(Number(p.secPerBend)||0))/60,p.extraPercent);
 else if(proc.type==="mill"){each=extra(Number(proc.runMin!=null?proc.runMin:p.runMin)||0,p.extraPercent);setup=Number(proc.setupMin!=null?proc.setupMin:p.setupMin)||0;}
 return {setup:setup,each:each,costEach:costMin(each,rate),costLot:costMin(setup,rate)+costMin(each,rate)*(Number(qty)||1),label:p.label||proc.type};
}
function wt(job){if(Number(job.weightKg)>0)return Number(job.weightKg);var L=Number(job.lenMm)||0,B=Number(job.widMm)||0,T=Number(job.thicknessMm)||0;if(L&&B&&T)return L*B*T*(findMat(job.material).density||7.85)/1e6;return 0;}
function calcJob(job){
 var qty=Number(job.qty)||1,rows=(job.processes||[]).map(function(pr){return Object.assign({},pr,calcProc(pr,state.params,qty));});
 var labor=0;rows.forEach(function(r){labor+=r.costLot;});
 var kg=wt(job),scrap=1+(Number(state.set.scrapPct)||0)/100,mat=0;
 if(job.useSheetPrice&&Number(job.sheetPrice)>0) mat=(Number(job.sheets)||1)*Number(job.sheetPrice);
 else {var epk=Number(job.euroPerKg)>0?Number(job.euroPerKg):Number(findMat(job.material).euroPerKg)||0;mat=kg*scrap*epk*qty;}
 var buy=0;(job.buys||[]).forEach(function(b){var line=(Number(b.qty)||0)*(Number(b.price)||0);buy+=b.perPart?line*qty:line;});
 var mk=1+(Number(state.set.markupPct)||0)/100,sub=labor+mat+buy;
 return {rows:rows,labor:labor,materialLot:mat,buyLot:buy,sub:sub,total:sub*mk,qty:qty,kg:kg};
}
function nextRev(no){no=String(no||"Angebot").trim();var m=no.match(/^(.*?)(?:\/(\d+))?$/);return m[1]+"/"+(m[2]?Number(m[2])+1:2);}
function seed(){
 if(state.customers.length) return;
 state.customers=[{id:"c1",name:"Bahntechnik Mueller",nr:"01",logo:""},{id:"c2",name:"Fahrzeugbau Huber",nr:"02",logo:""}];
 state.quotes=[{id:"q1",customerId:"c1",quoteNo:"01-0815",quoteDate:today(),name:"Konsolblech Drehgestell",drawingNo:"SF-8841-A",qty:8,material:"S355JR",thicknessMm:8,note:"Erstangebot",lenMm:420,widMm:180,sheets:1,sheetPrice:85,useSheetPrice:true,processes:[{type:"laser_cut",lengthMm:1400,pierces:6},{type:"bend",bends:4},{type:"mag",lengthMm:620}],buys:[{name:"Gewindebuchse M8",qty:2,price:1.2,perPart:true}],files:[]}];
 saveAll();
}
function compress(file,max,cb){
 var r=new FileReader();
 r.onload=function(){var img=new Image();img.onload=function(){var c=document.createElement("canvas"),w=img.width,h=img.height;if(w>max){h=h*max/w;w=max;}c.width=w;c.height=h;c.getContext("2d").drawImage(img,0,0,w,h);cb(c.toDataURL("image/jpeg",0.7));};img.src=r.result;};
 r.readAsDataURL(file);
}
function renderCusts(){
 if(!state.customers.length){$("custList").innerHTML='<p class="muted">Noch kein Kunde.</p>';return;}
 $("custList").innerHTML=state.customers.map(function(c){
  var n=state.quotes.filter(function(q){return q.customerId===c.id;}).length;
  var img=c.logo?'<img class="clogo" src="'+c.logo+'" alt="">':'';
  return '<article class="item" data-id="'+c.id+'"><div class="row" style="justify-content:flex-start;gap:10px">'+img+'<div><strong>'+esc(c.name)+'</strong><div class="muted">Kd-Nr. '+esc(c.nr||"-")+' · '+n+' Angebot(e)</div></div></div></article>';
 }).join("");
}
function renderQuotes(){
 var list=state.quotes.filter(function(q){return q.customerId===state.custId;});
 if(!list.length){$("quoteList").innerHTML='<p class="muted">Noch kein Angebot.</p>';return;}
 $("quoteList").innerHTML=list.map(function(q){var t=calcJob(q);return '<article class="item" data-id="'+q.id+'"><div><strong>'+esc(q.quoteNo||"-")+'</strong><div class="muted">'+esc(q.name)+' · '+esc(q.quoteDate||"")+'</div></div><div class="ok">'+fmtEuro(t.total)+'</div></article>';}).join("");
}
function openCust(id){
 var c=findCust(id); if(!c)return; state.custId=id;
 $("custTitle").textContent=c.name; $("custEye").textContent="Kd-Nr. "+(c.nr||"-");
 $("headTitle").textContent=c.name; $("headSub").textContent="Angebotsordner";
 renderQuotes(); show("cust");
}
function fillMat(val){$("materialSel").innerHTML=state.mats.map(function(m){return '<option value="'+m.id+'">'+esc(m.name)+'</option>';}).join(""); if(val)$("materialSel").value=val;}
function emptyJob(){var c=findCust(state.custId);return {id:uid(),customerId:state.custId,quoteNo:(c&&c.nr?c.nr+"-":""),quoteDate:today(),name:"",drawingNo:"",qty:1,material:"S355JR",thicknessMm:"",note:"",lenMm:"",widMm:"",weightKg:"",sheets:0,sheetPrice:"",euroPerKg:"",useSheetPrice:false,processes:[],buys:[],files:[]};}
function fill(job){
 var f=$("form"); fillMat(job.material);
 ["quoteNo","quoteDate","name","drawingNo","qty","thicknessMm","note","lenMm","widMm","weightKg","sheets","sheetPrice","euroPerKg"].forEach(function(k){if(f[k])f[k].value=job[k]==null?"":job[k];});
 if(!f.quoteDate.value)f.quoteDate.value=today(); $("useSheetPrice").checked=!!job.useSheetPrice;
 renderProcs(); renderBuys(); renderFiles(); renderResult();
}
function read(){
 var f=$("form");
 state.job.quoteNo=f.quoteNo.value.trim(); state.job.quoteDate=f.quoteDate.value; state.job.name=f.name.value.trim();
 state.job.drawingNo=f.drawingNo.value.trim(); state.job.qty=Number(f.qty.value)||1; state.job.material=f.material.value;
 state.job.thicknessMm=f.thicknessMm.value; state.job.note=f.note.value.trim();
 state.job.lenMm=f.lenMm.value; state.job.widMm=f.widMm.value; state.job.weightKg=f.weightKg.value;
 state.job.sheets=f.sheets.value; state.job.sheetPrice=f.sheetPrice.value; state.job.euroPerKg=f.euroPerKg.value;
 state.job.useSheetPrice=$("useSheetPrice").checked;
}
function renderProcs(){var box=$("procs"); if(!state.job.processes.length){box.innerHTML='<p class="muted">Kein Prozess.</p>';return;} box.innerHTML=state.job.processes.map(function(p,i){var r=calcProc(p,state.params,state.job.qty||1);return '<article class="item proc" data-i="'+i+'"><div><strong>'+esc(r.label)+'</strong></div><div class="ok">'+fmtEuro(r.costEach)+'</div></article>';}).join("");}
function renderBuys(){var box=$("buys"); if(!state.job.buys.length){box.innerHTML='<p class="muted">Kein Zukauf.</p>';return;} box.innerHTML=state.job.buys.map(function(b,i){return '<article class="item" data-i="'+i+'"><div><strong>'+esc(b.name)+'</strong><div class="muted">'+(b.qty||0)+' x '+fmtEuro(Number(b.price)||0)+'</div></div><button type="button" class="link delbuy">Loeschen</button></article>';}).join("");}
function renderFiles(){var box=$("thumbs"); box.innerHTML=""; (state.job.files||[]).forEach(function(f,i){var w=document.createElement("div"); if(f.type&&f.type.indexOf("image")===0){var im=document.createElement("img"); im.src=f.data; w.appendChild(im);} else {var d=document.createElement("div"); d.className="filechip"; d.textContent=f.name||"PDF"; w.appendChild(d);} var rm=document.createElement("button"); rm.type="button"; rm.className="link"; rm.textContent="Loeschen"; rm.onclick=function(){state.job.files.splice(i,1);renderFiles();}; w.appendChild(rm); box.appendChild(w);});}
function renderResult(){if(!state.job)return; read(); var t=calcJob(state.job); $("cLabor").textContent=fmtEuro(t.labor); $("cMat").textContent=fmtEuro(t.materialLot); $("cBuy").textContent=fmtEuro(t.buyLot); $("cLot").textContent=fmtEuro(t.total);}
function saveJob(asNew){read(); if(!state.job.name){alert("Bitte Teilname.");return false;} var t=calcJob(state.job); state.job.savedCostLot=t.total; if(asNew){state.job.id=uid(); state.job.quoteNo=nextRev(state.job.quoteNo); state.job.quoteDate=today();} state.quotes=state.quotes.filter(function(q){return q.id!==state.job.id;}); state.quotes.unshift(JSON.parse(JSON.stringify(state.job))); saveAll(); return true;}
function buildPrint(){
 read(); var t=calcJob(state.job), c=findCust(state.job.customerId)||{};
 var shop=state.set.shopName||"Angebot", addr=state.set.shopAddr||"";
 var logo=state.set.shopLogo?'<img class="shop" src="'+state.set.shopLogo+'" alt="">':'';
 var clogo=c.logo?'<img class="shop" src="'+c.logo+'" alt="">':'';
 var rows=t.rows.map(function(r,i){return '<tr><td>'+(i+1)+'</td><td>'+esc(r.label)+'</td><td class="r">'+t.qty+'</td><td class="r">'+fmtEuro(r.costEach)+'</td><td class="r">'+fmtEuro(r.costLot)+'</td></tr>';}).join("");
 rows += '<tr><td></td><td>Material '+esc(state.job.material)+'</td><td class="r"></td><td></td><td class="r">'+fmtEuro(t.materialLot)+'</td></tr>';
 rows += '<tr><td></td><td>Zukaufteile</td><td></td><td></td><td class="r">'+fmtEuro(t.buyLot)+'</td></tr>';
 $("sheet").innerHTML='<div class="head">'+logo+'<div><h1>'+esc(shop)+'</h1><div>'+esc(addr)+'</div></div></div>'+
  '<p><strong>Angebot '+esc(state.job.quoteNo)+'</strong> vom '+esc(state.job.quoteDate)+'</p>'+
  '<p>Kunde: '+clogo+' <strong>'+esc(c.name||"")+'</strong> (Kd-Nr. '+esc(c.nr||"-")+")</p>"+
  '<p>Teil: '+esc(state.job.name)+' · Zeichnung '+esc(state.job.drawingNo||"-")+' · '+t.qty+' Stk.</p>'+
  (state.job.note?'<p>'+esc(state.job.note)+'</p>':'')+
  '<table><thead><tr><th>Pos</th><th>Bezeichnung</th><th class="r">Menge</th><th class="r">je Stk.</th><th class="r">Gesamt</th></tr></thead><tbody>'+rows+'</tbody></table>'+
  '<p style="text-align:right;font-size:18px;margin-top:16px"><strong>Angebotssumme: '+fmtEuro(t.total)+'</strong></p>';
}
function openDlgCust(){state.dlg={kind:"cust"}; $("dlgTitle").textContent="Kunde"; $("dlgBody").innerHTML='<label>Name <input id="cn"></label><label>Kunden-Nr. <input id="ck" placeholder="01"></label><label>Logo <input type="file" id="clogo" accept="image/*"></label><div id="clprev"></div>'; $("dlg").showModal(); var hold={}; $("clogo").onchange=function(e){if(e.target.files[0]) compress(e.target.files[0],240,function(d){hold.logo=d; $("clprev").innerHTML='<img class="clogo" src="'+d+'">';});}; state.dlg.hold=hold;}
function openDlgProc(i){state.dlg={kind:"proc",i:i}; var ex=i!=null?state.job.processes[i]:{}; $("dlgTitle").textContent="Prozess"; $("dlgBody").innerHTML='<label>Art <select id="ptype">'+TYPES.map(function(t){return '<option value="'+t+'">'+state.params[t].label+'</option>';}).join("")+'</select></label><div id="pfields"></div>'; if(ex.type)$("ptype").value=ex.type; fillPF($("ptype").value,ex); $("ptype").onchange=function(){fillPF($("ptype").value,{});}; $("dlg").showModal();}
function fillPF(type,p){p=p||{}; var h=""; if(type==="laserhand"||type==="mag"||type==="wig") h='<label>Naht mm <input id="fl" type="number" value="'+(p.lengthMm||"")+'"></label>'; if(type==="laser_cut") h='<label>Schnitt mm <input id="fl" type="number" value="'+(p.lengthMm||"")+'"></label><label>Einstiche <input id="fp" type="number" value="'+(p.pierces||0)+'"></label>'; if(type==="bend") h='<label>Kantungen <input id="fb" type="number" value="'+(p.bends||"")+'"></label>'; if(type==="mill") h='<label>Lauf min <input id="fr" type="number" value="'+(p.runMin||15)+'"></label>'; $("pfields").innerHTML=h;}
function openDlgBuy(){state.dlg={kind:"buy"}; $("dlgTitle").textContent="Zukauf"; $("dlgBody").innerHTML='<label>Name <input id="bn"></label><div class="grid2"><label>Menge <input id="bq" type="number" value="1"></label><label>EUR <input id="bp" type="number" step="0.01"></label></div><label class="check"><input type="checkbox" id="bpp" checked> je Fertigteil</label>'; $("dlg").showModal();}
$("btnNewCust").onclick=openDlgCust;
$("btnDemo").onclick=function(){state.customers=[];state.quotes=[];seed();renderCusts();};
$("custList").onclick=function(e){var it=e.target.closest(".item"); if(it) openCust(it.dataset.id);};
$("quoteList").onclick=function(e){var it=e.target.closest(".item"); if(!it)return; var q=state.quotes.filter(function(x){return x.id===it.dataset.id;})[0]; if(!q)return; state.job=JSON.parse(JSON.stringify(q)); if(!state.job.files)state.job.files=[]; if(!state.job.buys)state.job.buys=[]; fill(state.job); $("headTitle").textContent=state.job.quoteNo||"Angebot"; show("part");};
$("btnNewQuote").onclick=function(){state.job=emptyJob(); fill(state.job); show("part");};
$("btnBack").onclick=function(){if(state.view==="part") openCust(state.custId); else {show("home"); renderCusts();}};
$("btnSettings").onclick=function(){renderParams(); renderMat(); $("scrapPct").value=state.set.scrapPct; $("markupPct").value=state.set.markupPct; $("shopName").value=state.set.shopName||""; $("shopAddr").value=state.set.shopAddr||""; $("shopPreview").innerHTML=state.set.shopLogo?'<img class="clogo" src="'+state.set.shopLogo+'">':''; show("settings");};
$("shopLogo").onchange=function(e){if(e.target.files[0]) compress(e.target.files[0],320,function(d){state.set.shopLogo=d; $("shopPreview").innerHTML='<img class="clogo" src="'+d+'">';});};
$("btnAdd").onclick=function(){openDlgProc(null);};
$("btnBuy").onclick=openDlgBuy;
$("procs").onclick=function(e){var c=e.target.closest(".proc"); if(c) openDlgProc(Number(c.dataset.i));};
$("buys").onclick=function(e){if(e.target.classList.contains("delbuy")){state.job.buys.splice(Number(e.target.closest(".item").dataset.i),1); renderBuys(); renderResult();}};
$("form").oninput=renderResult;
$("form").onsubmit=function(e){e.preventDefault(); if(saveJob(false)) openCust(state.custId);};
$("btnRev").onclick=function(){if(saveJob(true)){fill(state.job); alert("Gespeichert als "+state.job.quoteNo);}};
$("btnPrint").onclick=function(){buildPrint(); window.print();};
$("fileInput").onchange=function(e){[].forEach.call(e.target.files,function(file){if(file.type.indexOf("image")===0) compress(file,1100,function(d){state.job.files.push({name:file.name,type:"image/jpeg",data:d}); renderFiles();}); else if(file.size>1200000) alert("PDF zu gross"); else {var r=new FileReader(); r.onload=function(){state.job.files.push({name:file.name,type:file.type,data:r.result}); renderFiles();}; r.readAsDataURL(file);}});};
$("pok").onclick=function(){
 if(!state.dlg) return;
 if(state.dlg.kind==="cust"){var name=$("cn").value.trim(); if(!name)return; state.customers.push({id:uid(),name:name,nr:$("ck").value.trim(),logo:(state.dlg.hold&&state.dlg.hold.logo)||""}); saveAll(); renderCusts();}
 if(state.dlg.kind==="proc"){var type=$("ptype").value,proc={type:type}; if(type==="laserhand"||type==="mag"||type==="wig"||type==="laser_cut") proc.lengthMm=Number(($("fl")||{}).value)||0; if(type==="laser_cut") proc.pierces=Number(($("fp")||{}).value)||0; if(type==="bend") proc.bends=Number(($("fb")||{}).value)||0; if(type==="mill") proc.runMin=Number(($("fr")||{}).value)||0; if(state.dlg.i!=null) state.job.processes[state.dlg.i]=proc; else state.job.processes.push(proc); renderProcs(); renderResult();}
 if(state.dlg.kind==="buy"){state.job.buys.push({name:$("bn").value.trim()||"Zukauf",qty:Number($("bq").value)||0,price:Number($("bp").value)||0,perPart:$("bpp").checked}); renderBuys(); renderResult();}
 $("dlg").close();
};
function renderParams(){$("params").innerHTML=TYPES.map(function(k){var p=state.params[k]; var a=k==="bend"?"secPerBend":k==="mill"?"runMin":"speedMmPerSec"; return '<div class="card"><strong>'+p.label+'</strong><div class="grid2"><label>Wert <input data-k="'+k+'" data-f="'+a+'" type="number" step="0.1" value="'+(p[a]||"")+'"></label><label>EUR/h <input data-k="'+k+'" data-f="euroPerHour" type="number" value="'+p.euroPerHour+'"></label></div></div>';}).join("");}
function renderMat(){$("matEditor").innerHTML=state.mats.map(function(m,i){return '<label>'+esc(m.name)+' <input data-mi="'+i+'" type="number" step="0.01" value="'+m.euroPerKg+'"></label>';}).join("");}
$("btnSaveSet").onclick=function(){
 document.querySelectorAll("#params input").forEach(function(inp){if(inp.dataset.k) state.params[inp.dataset.k][inp.dataset.f]=Number(inp.value);});
 document.querySelectorAll("#matEditor input").forEach(function(inp){state.mats[Number(inp.dataset.mi)].euroPerKg=Number(inp.value);});
 state.set.scrapPct=Number($("scrapPct").value)||0; state.set.markupPct=Number($("markupPct").value)||0;
 state.set.shopName=$("shopName").value.trim(); state.set.shopAddr=$("shopAddr").value.trim();
 saveJSON("wk_params",state.params); saveJSON("wk_mats",state.mats); saveAll(); alert("Gespeichert"); show("home"); renderCusts();
};
seed(); renderCusts();
})();
