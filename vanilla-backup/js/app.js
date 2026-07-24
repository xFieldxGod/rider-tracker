(function(){
'use strict';
var LS='rider.jobs.v1';
var jobs=load();
var mapPeriod='30', statPeriod='30', myLoc=null, mapHitPts=[];
var settings = loadSettings();

function loadSettings(){
  try{ return JSON.parse(localStorage.getItem('rider.settings.v1')) || {goal: 0, shifts: [], currentShiftStart: null}; }
  catch(e){ return {goal: 0, shifts: [], currentShiftStart: null}; }
}
function saveSettings(){
  try{ localStorage.setItem('rider.settings.v1', JSON.stringify(settings)); }catch(e){}
}
function triggerConfetti() {
  if (window.confetti) {
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, zIndex: 9999, colors: ['#d55815', '#0c7d39', '#e8e4d8'] });
  }
}

function load(){
  try{var a=JSON.parse(localStorage.getItem(LS)); if(Array.isArray(a)){
    a.forEach(function(j){ if(j.locState==='pending') j.locState=(j.lat!=null?'ok':'fail'); });
    return a;
  }}catch(e){}
  return [];
}
function save(){ try{localStorage.setItem(LS,JSON.stringify(jobs));}catch(e){toast('บันทึกไม่สำเร็จ: พื้นที่เก็บข้อมูลเต็ม');} }
/* confirm()/alert() are blocked in sandboxed pages — use our own modal + toast */
var ovlCb=null;
function askConfirm(msg,cb){
  document.getElementById('ovlMsg').textContent=msg; ovlCb=cb;
  document.getElementById('ovl').classList.add('show');
}
var toastT=null;
function toast(msg){
  var t=document.getElementById('toast'); t.textContent=msg; t.style.display='block';
  clearTimeout(toastT); toastT=setTimeout(function(){t.style.display='none'},2600);
}
function $(id){return document.getElementById(id)}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function baht(n){return '฿'+Number(n).toLocaleString('th-TH',{maximumFractionDigits:2})}
function timeStr(ts){var d=new Date(ts);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')}
function dayKey(ts){var d=new Date(ts);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function dayLabel(key){
  var p=key.split('-'), d=new Date(+p[0],+p[1]-1,+p[2]);
  var today=dayKey(Date.now()), yest=dayKey(Date.now()-864e5);
  if(key===today) return 'วันนี้';
  if(key===yest) return 'เมื่อวาน';
  return d.toLocaleDateString('th-TH',{weekday:'short',day:'numeric',month:'short'});
}
function mapsUrl(lat,lng){return 'https://www.google.com/maps?q='+lat.toFixed(6)+','+lng.toFixed(6)}
function haversine(a,b,c,d){
  var R=6371,rad=Math.PI/180,dLat=(c-a)*rad,dLng=(d-b)*rad;
  var h=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(a*rad)*Math.cos(c*rad)*Math.sin(dLng/2)*Math.sin(dLng/2);
  return 2*R*Math.asin(Math.sqrt(h));
}
function periodStart(p){
  if(p==='today'){var d=new Date();d.setHours(0,0,0,0);return d.getTime();}
  if(p==='all') return 0;
  return Date.now()-(+p)*864e5;
}
function doneJobs(){return jobs.filter(function(j){return j.done!=null})}
function activeJobs(){return jobs.filter(function(j){return j.done==null})}
function vibrate(ms){ if(navigator.vibrate) try{navigator.vibrate(ms);}catch(e){} }

/* ================= GPS ================= */
function captureLoc(id){
  if(!navigator.geolocation){ setLoc(id,null,'fail'); return; }
  navigator.geolocation.getCurrentPosition(
    function(pos){ setLoc(id,pos,'ok'); },
    function(){ setLoc(id,null,'fail'); },
    {enableHighAccuracy:true, timeout:15000, maximumAge:60000}
  );
}
function setLoc(id,pos,state){
  var j=jobs.find(function(x){return x.id===id}); if(!j) return;
  if(pos){ j.lat=+pos.coords.latitude.toFixed(6); j.lng=+pos.coords.longitude.toFixed(6); j.acc=Math.round(pos.coords.accuracy); }
  j.locState=state; save(); renderHome();
}

/* ================= actions ================= */
function addJob(){
  var j={id:Date.now()+'-'+Math.floor(Math.random()*1e4), at:Date.now(), lat:null, lng:null, acc:null, done:null, amt:null, locState:'pending'};
  jobs.push(j); save(); vibrate(25); renderHome(); captureLoc(j.id);
}
function finishJob(id){
  var j=jobs.find(function(x){return x.id===id}); if(!j) return;
  var inp=document.querySelector('.amtIn[data-id="'+id+'"]');
  var v=parseFloat((inp.value||'').replace(/,/g,''));
  if(isNaN(v)||v<0){ inp.focus(); inp.style.borderColor='var(--danger)'; return; }
  j.amt=v; j.done=Date.now(); save(); vibrate(25); 
  if (settings.goal > 0 && j.amt > 0) {
    var tk = dayKey(Date.now());
    var sum = doneJobs().filter(function(x){return dayKey(x.done)===tk}).reduce(function(s,x){return s+x.amt},0);
    if (sum >= settings.goal && (sum - v) < settings.goal) {
      setTimeout(triggerConfetti, 300); // Only pop confetti when exactly passing the goal
    }
  }
  renderAll();
}
function splitCents(total,members){
  /* exact split: sum of parts always equals the entered total */
  var cents=Math.round(total*100), n=members.length;
  var per=Math.floor(cents/n), rem=cents-per*n;
  members.forEach(function(j,i){ j.amt=(per+(i<rem?1:0))/100; });
}
function finishBatch(){
  var act=activeJobs(); if(act.length<2) return;
  var inp=document.querySelector('.amtIn[data-id="__batch"]');
  var v=parseFloat((inp.value||'').replace(/,/g,''));
  if(isNaN(v)||v<0){ inp.focus(); inp.style.borderColor='var(--danger)'; return; }
  var bid='b'+Date.now(), now=Date.now();
  splitCents(v,act);
  act.forEach(function(j){ j.done=now; j.batch=bid; });
  save(); vibrate(25); renderAll();
}
function delJob(id,ask){
  if(ask){ askConfirm('ลบงานนี้ออกเลยใช่ไหม?',function(){delJob(id,false)}); return; }
  jobs=jobs.filter(function(x){return x.id!==id}); save(); toast('ลบงานแล้ว'); renderAll();
}

/* ================= HOME render ================= */
function renderHero(){
  var tk=dayKey(Date.now());
  var td=doneJobs().filter(function(j){return dayKey(j.done)===tk});
  var sum=td.reduce(function(s,j){return s+j.amt},0);
  $('heroAmt').textContent=baht(sum);
  var act=activeJobs().length;
  var parts=[];
  if(td.length){ parts.push(td.length+' งาน'); parts.push('เฉลี่ย '+baht(sum/td.length)); }
  if(act) parts.push('ค้างอยู่ '+act+' งาน');
  $('heroSub').textContent = parts.length?parts.join(' · '):'วันนี้ยังไม่มีงาน — กดรับงานได้เลย';

  if (settings.goal > 0) {
    $('goalContainer').style.display = 'block';
    $('goalText').textContent = baht(sum) + ' / ' + baht(settings.goal);
    var pct = Math.min(100, Math.max(0, (sum / settings.goal) * 100));
    $('goalFill').style.width = pct + '%';
  } else {
    $('goalContainer').style.display = 'none';
  }

  var shiftBtn = $('btnShift');
  if (settings.currentShiftStart) {
    var hrs = ((Date.now() - settings.currentShiftStart) / 3600000).toFixed(1);
    shiftBtn.className = 'btnShift on';
    shiftBtn.textContent = '🟢 กำลังออนไลน์ (' + hrs + ' ชม.)';
  } else {
    shiftBtn.className = 'btnShift off';
    shiftBtn.textContent = '🔴 เริ่มกะทำงาน (Offline)';
  }
}
function gpsChip(j){
  if(j.locState==='ok') return '<span class="gps ok">GPS ✓</span>';
  if(j.locState==='pending') return '<span class="gps pending pulse">กำลังหาตำแหน่ง…</span>';
  return '<button class="gps fail" data-act="retry" data-id="'+j.id+'">ไม่ได้ตำแหน่ง · ลองใหม่</button>';
}
function renderHome(){
  renderHero();
  /* keep typed amounts + focus across re-renders (e.g. when GPS resolves) */
  var typed={}, focusId=null, caret=0;
  document.querySelectorAll('.amtIn').forEach(function(inp){
    if(inp.value) typed[inp.dataset.id]=inp.value;
    if(inp===document.activeElement){ focusId=inp.dataset.id; caret=inp.selectionStart; }
  });
  var act=activeJobs();
  $('activeSec').style.display=act.length?'block':'none';
  $('activeTitle').textContent='งานที่กำลังทำ ('+act.length+')';
  var batchCard = act.length>=2 ?
    '<div class="card job batchCard">'+
      '<div class="row1"><span class="num">ชุด '+act.length+' งาน</span>'+
      '<span class="time">รายรับรวมมาเป็นยอดเดียว?</span></div>'+
      '<div class="row2">'+
        '<input class="amtIn" data-id="__batch" inputmode="decimal" placeholder="ยอดรวม (บาท)">'+
        '<button class="btnDone" data-act="finishAll">จบทั้งหมด</button>'+
      '</div>'+
      '<div class="hint">ใส่ยอดรวมทีเดียว แอปเฉลี่ยให้ทุกงานเอง · หรือใส่แยกทีละงานข้างล่างตามเดิมก็ได้</div>'+
    '</div>' : '';
  $('activeList').innerHTML=batchCard+act.map(function(j,i){
    return '<div class="card job animate-slide-up">'+
      '<div class="row1"><span class="num">งานที่ '+(i+1)+'</span>'+
      '<span class="time">รับ '+timeStr(j.at)+' น.</span>'+gpsChip(j)+'</div>'+
      '<div class="row2">'+
        '<input class="amtIn" data-id="'+j.id+'" inputmode="decimal" placeholder="รายรับ (บาท)">'+
        '<button class="btnDone" data-act="finish" data-id="'+j.id+'">จบงาน</button>'+
      '</div>'+
      '<div style="text-align:right"><button class="btnGhost" data-act="del" data-id="'+j.id+'">ยกเลิกงานนี้</button></div>'+
    '</div>';
  }).join('');
  document.querySelectorAll('.amtIn').forEach(function(inp){
    var id=inp.dataset.id;
    if(typed[id]) inp.value=typed[id];
    if(id===focusId){ inp.focus(); try{inp.setSelectionRange(caret,caret);}catch(e){} }
  });

  var tk=dayKey(Date.now());
  var td=doneJobs().filter(function(j){return dayKey(j.done)===tk}).sort(function(a,b){return b.done-a.done});
  $('doneList').innerHTML = td.length ? groupDone(td).map(function(g){
    return '<div class="doneRow"><span class="dot'+(g.loc?'':' no')+'"></span>'+
      '<span class="t">'+timeStr(g.at)+'</span>'+
      (g.jobs.length>1?'<span class="tagBatch">ชุด '+g.jobs.length+'</span>':'')+
      '<span class="a money">'+baht(g.amt)+'</span><span class="sp"></span>'+
      (g.loc?'<a class="maplink" target="_blank" rel="noopener" href="'+mapsUrl(g.loc.lat,g.loc.lng)+'">แผนที่</a>':'')+
    '</div>';
  }).join('') : '<div class="empty">ยังไม่มีงานที่จบวันนี้</div>';
}
/* collapse jobs finished together (same batch id) into one display row */
function groupDone(list){
  var out=[], byBatch={};
  list.forEach(function(j){
    if(j.batch){
      var g=byBatch[j.batch];
      if(!g){ g={batch:j.batch, jobs:[], amt:0, at:j.at, loc:null}; byBatch[j.batch]=g; out.push(g); }
      g.jobs.push(j); g.amt+=j.amt; g.at=Math.min(g.at,j.at);
      if(!g.loc && j.lat!=null) g.loc=j;
    }else{
      out.push({jobs:[j], amt:j.amt, at:j.at, loc:(j.lat!=null?j:null)});
    }
  });
  return out;
}

/* ================= chips ================= */
function renderChips(elId,cur,onPick){
  var opts=[['today','วันนี้'],['7','7 วัน'],['30','30 วัน'],['all','ทั้งหมด']];
  var el=$(elId);
  el.innerHTML=opts.map(function(o){
    return '<button class="chip'+(o[0]===cur?' on':'')+'" data-p="'+o[0]+'">'+o[1]+'</button>';
  }).join('');
  el.onclick=function(e){
    var b=e.target.closest('.chip'); if(!b) return;
    onPick(b.dataset.p);
  };
}

/* ================= MAP ================= */
var ZONE_KM=0.8; /* jobs within ~800 m of a zone center count as the same zone */
function mapPts(){
  var t0=periodStart(mapPeriod);
  return jobs.filter(function(j){return j.lat!=null && j.at>=t0});
}
function clusterZones(pts){
  var zonesArr=[];
  pts.forEach(function(j){
    var best=null,bd=ZONE_KM;
    zonesArr.forEach(function(z){
      var d=haversine(j.lat,j.lng,z.lat,z.lng);
      if(d<bd){bd=d;best=z;}
    });
    if(best){
      best.pts.push(j);
      best.lat=best.pts.reduce(function(s,p){return s+p.lat},0)/best.pts.length;
      best.lng=best.pts.reduce(function(s,p){return s+p.lng},0)/best.pts.length;
    }else{
      zonesArr.push({lat:j.lat,lng:j.lng,pts:[j]});
    }
  });
  zonesArr.forEach(function(z){
    z.n=z.pts.length;
    z.rKm=0.2;
    z.pts.forEach(function(p){ z.rKm=Math.max(z.rKm,haversine(p.lat,p.lng,z.lat,z.lng)+0.12); });
  });
  return zonesArr.sort(function(a,b){return b.n-a.n});
}
function css(name){return getComputedStyle(document.documentElement).getPropertyValue(name).trim()}
/* real street map (Leaflet/OpenStreetMap) when it can load; canvas fallback otherwise */
function drawMap(){ if(window.L) drawMapLeaflet(); else drawMapCanvas(); }
var lMap=null, lLayer=null;
function drawMapLeaflet(){
  var wrap=$('mapWrap'), div=$('leafletMap');
  $('mapCv').style.display='none'; div.style.display='block';
  div.style.height=Math.round((wrap.clientWidth-2)*0.92)+'px';
  $('ptInfo').style.display='none';
  var pts=mapPts();
  if(!lMap){
    lMap=L.map(div);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      {maxZoom:19, attribution:'© OpenStreetMap'}).addTo(lMap);
    L.control.scale({metric:true, imperial:false}).addTo(lMap);
    lLayer=L.layerGroup().addTo(lMap);
    lMap.setView([13.7563,100.5018],11);
  }
  lMap.invalidateSize();
  lLayer.clearLayers();
  var acc=css('--accent');
  var cells=clusterZones(pts);
  cells.forEach(function(c){
    if(c.n<2) return;
    L.circle([c.lat,c.lng],{radius:c.rKm*1000, color:acc, weight:1.5, opacity:.5,
      fillColor:acc, fillOpacity:.12}).addTo(lLayer);
  });
  pts.forEach(function(j){
    L.circleMarker([j.lat,j.lng],{radius:6, color:css('--surface'), weight:2, fillColor:acc, fillOpacity:1})
      .bindPopup('รับงาน '+dayLabel(dayKey(j.at))+' '+timeStr(j.at)+' น.'+
        (j.amt!=null?'<br>รายรับ '+baht(j.amt):'<br>ยังไม่จบ')+
        '<br><a target="_blank" rel="noopener" href="'+mapsUrl(j.lat,j.lng)+'">เปิดใน Google Maps ›</a>')
      .addTo(lLayer);
  });
  if(myLoc){
    L.circleMarker([myLoc.lat,myLoc.lng],{radius:7, color:'#fff', weight:2, fillColor:'#2a78d6', fillOpacity:1})
      .bindPopup('ตำแหน่งของคุณ').addTo(lLayer);
  }
  if(pts.length){
    var b=L.latLngBounds(pts.map(function(j){return [j.lat,j.lng]}));
    if(myLoc) b.extend([myLoc.lat,myLoc.lng]);
    lMap.fitBounds(b,{padding:[30,30], maxZoom:15});
  }else if(myLoc){
    lMap.setView([myLoc.lat,myLoc.lng],14);
  }
  $('scaleLbl').textContent=pts.length+' จุด';
  renderZones(cells);
}
window.__onLeaflet=function(){ if($('view-map').classList.contains('active')) drawMap(); };
function drawMapCanvas(){
  var cv=$('mapCv'), wrap=$('mapWrap');
  $('leafletMap').style.display='none'; cv.style.display='block';
  var pts=mapPts();
  $('ptInfo').style.display='none';
  var W=wrap.clientWidth-2, H=Math.round(W*0.92);
  var dpr=window.devicePixelRatio||1;
  cv.width=W*dpr; cv.height=H*dpr; cv.style.height=H+'px';
  var ctx=cv.getContext('2d'); ctx.scale(dpr,dpr);
  ctx.fillStyle=css('--surface'); ctx.fillRect(0,0,W,H);
  mapHitPts=[];
  if(!pts.length){
    ctx.fillStyle=css('--muted'); ctx.font='14px sans-serif'; ctx.textAlign='center';
    ctx.fillText('ยังไม่มีข้อมูลตำแหน่งในช่วงนี้', W/2, H/2-10);
    ctx.fillText('กด "รับงานใหม่" แล้วอนุญาตให้เข้าถึงตำแหน่ง', W/2, H/2+14);
    $('scaleLbl').textContent=''; renderZones([]); return;
  }
  var lats=pts.map(function(p){return p.lat}), lngs=pts.map(function(p){return p.lng});
  var pool=pts.slice(); if(myLoc){ lats.push(myLoc.lat); lngs.push(myLoc.lng); }
  var minLa=Math.min.apply(0,lats), maxLa=Math.max.apply(0,lats);
  var minLo=Math.min.apply(0,lngs), maxLo=Math.max.apply(0,lngs);
  var midLa=(minLa+maxLa)/2;
  var kx=111320*Math.cos(midLa*Math.PI/180)/1000, ky=110.54; /* km per degree */
  var spanX=Math.max((maxLo-minLo)*kx, 0.8), spanY=Math.max((maxLa-minLa)*ky, 0.8); /* km, min span 800m */
  var pad=34;
  var scale=Math.min((W-pad*2)/spanX,(H-pad*2)/spanY);
  var cx=(minLo+maxLo)/2, cy=(minLa+maxLa)/2;
  function px(lng){return W/2+(lng-cx)*kx*scale}
  function py(lat){return H/2-(lat-cy)*ky*scale}

  /* heat zones */
  var cells=clusterZones(pts);
  var maxN=cells.length?cells[0].n:1;
  var acc=css('--accent');
  cells.forEach(function(c){
    if(c.n<2) return;
    var r=Math.min(Math.max(c.rKm*scale,16),Math.min(W,H)*0.4);
    ctx.beginPath(); ctx.arc(px(c.lng),py(c.lat),r,0,7);
    ctx.fillStyle=acc; ctx.globalAlpha=0.08+0.12*(c.n/maxN); ctx.fill();
    ctx.globalAlpha=0.5; ctx.lineWidth=1.5; ctx.strokeStyle=acc; ctx.stroke();
    ctx.globalAlpha=1;
  });
  /* points */
  pool.forEach(function(j){
    var x=px(j.lng), y=py(j.lat);
    ctx.beginPath(); ctx.arc(x,y,5.5,0,7); ctx.fillStyle=css('--surface'); ctx.fill();
    ctx.beginPath(); ctx.arc(x,y,4,0,7); ctx.fillStyle=acc; ctx.fill();
    mapHitPts.push({x:x,y:y,j:j});
  });
  /* my location */
  if(myLoc){
    var mx=px(myLoc.lng), my=py(myLoc.lat);
    ctx.beginPath(); ctx.arc(mx,my,9,0,7); ctx.fillStyle='rgba(42,120,214,.25)'; ctx.fill();
    ctx.beginPath(); ctx.arc(mx,my,5,0,7); ctx.fillStyle='#2a78d6'; ctx.fill();
    ctx.beginPath(); ctx.arc(mx,my,5,0,7); ctx.lineWidth=2; ctx.strokeStyle=css('--surface'); ctx.stroke();
  }
  /* scale bar drawn on canvas, bottom-left */
  var kmPx=scale; /* px per km */
  var step=kmPx>400?0.25:kmPx>200?0.5:kmPx>80?1:kmPx>40?2:kmPx>16?5:10;
  var barPx=step*kmPx, bx=14, by=H-14;
  ctx.strokeStyle=css('--ink2'); ctx.lineWidth=2; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(bx,by); ctx.lineTo(bx+barPx,by); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(bx,by-4); ctx.lineTo(bx,by+4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(bx+barPx,by-4); ctx.lineTo(bx+barPx,by+4); ctx.stroke();
  ctx.fillStyle=css('--ink2'); ctx.font='11px sans-serif'; ctx.textAlign='left';
  ctx.fillText(step<1?(step*1000)+' ม.':step+' กม.', bx, by-9);
  $('scaleLbl').textContent=pts.length+' จุด';
  renderZones(cells);
}
function renderZones(cells){
  var top=cells.filter(function(c){return c.n>=1}).slice(0,5);
  $('zoneList').innerHTML = top.length ? top.map(function(c,i){
    var dist = myLoc ? ' · ห่างจากคุณ '+haversine(myLoc.lat,myLoc.lng,c.lat,c.lng).toFixed(1)+' กม.' : '';
    return '<div class="zone" data-lat="'+c.lat+'" data-lng="'+c.lng+'"><div class="rank">'+(i+1)+'</div>'+
      '<div class="info"><div class="cnt">'+c.n+' งาน</div>'+
      '<div class="dist">'+c.lat.toFixed(4)+', '+c.lng.toFixed(4)+dist+'</div></div>'+
      '<a class="maplink" target="_blank" rel="noopener" href="'+mapsUrl(c.lat,c.lng)+'">เปิดแผนที่ ›</a></div>';
  }).join('') : '<div class="empty">ยังไม่มีข้อมูล — เริ่มรับงานก่อน แล้วโซนเด็ดจะโผล่ที่นี่</div>';
}
$('zoneList').addEventListener('click',function(e){
  if(e.target.closest('a')) return; /* let the Google Maps link work normally */
  var z=e.target.closest('.zone'); if(!z||!window.L||!lMap) return;
  lMap.setView([+z.dataset.lat,+z.dataset.lng],15);
  window.scrollTo({top:0,behavior:'smooth'});
});
$('mapCv').addEventListener('click',function(e){
  var r=this.getBoundingClientRect(), x=e.clientX-r.left, y=e.clientY-r.top;
  var best=null,bd=22;
  mapHitPts.forEach(function(p){
    var d=Math.hypot(p.x-x,p.y-y); if(d<bd){bd=d;best=p;}
  });
  var el=$('ptInfo');
  if(!best){el.style.display='none';return;}
  var j=best.j;
  el.style.display='block';
  el.innerHTML='รับงาน '+dayLabel(dayKey(j.at))+' '+timeStr(j.at)+' น.'+
    (j.amt!=null?' · <span class="money">'+baht(j.amt)+'</span>':' · ยังไม่จบ')+
    ' &nbsp; <a class="maplink" target="_blank" rel="noopener" href="'+mapsUrl(j.lat,j.lng)+'">เปิดใน Google Maps ›</a>';
});
$('btnMe').onclick=function(){
  var b=this; b.textContent='กำลังหา…';
  navigator.geolocation.getCurrentPosition(function(pos){
    myLoc={lat:pos.coords.latitude,lng:pos.coords.longitude};
    b.textContent='📍 ตำแหน่งฉันแสดงแล้ว'; drawMap();
  },function(){ b.textContent='📍 หาตำแหน่งไม่ได้'; },{enableHighAccuracy:true,timeout:12000});
};

/* ================= STATS ================= */
function nice(v){
  if(v<=0) return 1;
  var p=Math.pow(10,Math.floor(Math.log10(v)));
  var d=v/p;
  return (d<=1?1:d<=2?2:d<=5?5:10)*p;
}
function barChart(elId,data,opts){
  /* data: [{lb, v, tip}] */
  var W=360,H=170,padL=30,padR=8,padT=16,padB=22;
  var color=opts.color, maxV=nice(Math.max.apply(0,data.map(function(d){return d.v}).concat([1])));
  var pw=W-padL-padR, ph=H-padT-padB;
  var bw=Math.min(24,pw/data.length-2);
  var maxIdx=-1,maxVal=-1;
  data.forEach(function(d,i){ if(d.v>maxVal){maxVal=d.v;maxIdx=i;} });
  var s='<svg viewBox="0 0 '+W+' '+H+'" role="img">';
  [0,0.5,1].forEach(function(f){
    var y=padT+ph-ph*f, val=maxV*f;
    s+='<line x1="'+padL+'" y1="'+y+'" x2="'+(W-padR)+'" y2="'+y+'" stroke="'+css('--grid')+'" stroke-width="1"/>';
    s+='<text x="'+(padL-5)+'" y="'+(y+3.5)+'" text-anchor="end" font-size="9.5" fill="'+css('--muted')+'" style="font-variant-numeric:tabular-nums">'+(val>=1000?(val/1000)+'k':Math.round(val*10)/10)+'</text>';
  });
  data.forEach(function(d,i){
    var x=padL+(pw/data.length)*i+(pw/data.length-bw)/2;
    var h=maxV?ph*(d.v/maxV):0, y=padT+ph-h;
    if(d.v>0){
      var rr=Math.min(4,h);
      s+='<path d="M'+x+' '+(padT+ph)+' V'+(y+rr)+' Q'+x+' '+y+' '+(x+rr)+' '+y+' H'+(x+bw-rr)+' Q'+(x+bw)+' '+y+' '+(x+bw)+' '+(y+rr)+' V'+(padT+ph)+' Z" fill="'+color+'" data-tip="'+esc(d.tip)+'"/>';
    }
    /* invisible fat hit target */
    s+='<rect x="'+(padL+(pw/data.length)*i)+'" y="'+padT+'" width="'+(pw/data.length)+'" height="'+ph+'" fill="transparent" data-tip="'+esc(d.tip)+'"/>';
    if(d.lb!=null) s+='<text x="'+(x+bw/2)+'" y="'+(H-7)+'" text-anchor="middle" font-size="9.5" fill="'+css('--muted')+'">'+d.lb+'</text>';
    if(i===maxIdx&&d.v>0) s+='<text x="'+(x+bw/2)+'" y="'+(y-5)+'" text-anchor="middle" font-size="10.5" font-weight="700" fill="'+css('--ink2')+'">'+opts.fmt(d.v)+'</text>';
  });
  s+='<line x1="'+padL+'" y1="'+(padT+ph)+'" x2="'+(W-padR)+'" y2="'+(padT+ph)+'" stroke="'+css('--axis')+'" stroke-width="1"/>';
  s+='</svg>';
  var el=$(elId); el.innerHTML=s;
  el.onclick=function(e){
    var t=e.target.closest('[data-tip]'); var card=el.closest('.chartCard');
    var old=card.querySelector('.tip'); if(old) old.remove();
    if(!t||!t.dataset.tip) return;
    var tip=document.createElement('div'); tip.className='tip'; tip.textContent=t.dataset.tip;
    card.appendChild(tip);
    var cr=card.getBoundingClientRect(), tr=t.getBoundingClientRect();
    tip.style.display='block';
    var left=tr.left-cr.left+tr.width/2;
    tip.style.top=Math.max(6,tr.top-cr.top-34)+'px';
    card.offsetWidth;
    left=Math.min(Math.max(left-tip.offsetWidth/2,6),cr.width-tip.offsetWidth-6);
    tip.style.left=left+'px';
    setTimeout(function(){tip.remove()},2200);
  };
}
function renderStats(){
  var t0=periodStart(statPeriod);
  var dj=doneJobs().filter(function(j){return j.at>=t0});
  var all=jobs.filter(function(j){return j.at>=t0});
  var sum=dj.reduce(function(s,j){return s+j.amt},0);

  var hours=new Array(24).fill(0);
  all.forEach(function(j){hours[new Date(j.at).getHours()]++});
  var bestH=hours.indexOf(Math.max.apply(0,hours));

  $('tiles').innerHTML=
    '<div class="tile card"><div class="lb">รายรับรวม</div><div class="v money">'+baht(sum)+'</div></div>'+
    '<div class="tile card"><div class="lb">จำนวนงาน</div><div class="v">'+dj.length+' งาน</div></div>'+
    '<div class="tile card"><div class="lb">เฉลี่ยต่องาน</div><div class="v">'+(dj.length?baht(sum/dj.length):'—')+'</div></div>'+
    '<div class="tile card"><div class="lb">ชั่วโมงทอง</div><div class="v gold">'+(all.length?bestH+':00 น.':'—')+'</div></div>';

  barChart('chartHour', hours.map(function(v,h){
    return {lb:(h%3===0?h:null), v:v, tip:h+':00–'+(h+1)+':00 น. · '+v+' งาน'};
  }), {color:css('--accent'), fmt:function(v){return v+' งาน'}});

  var dows=new Array(7).fill(0), dn=['อา','จ','อ','พ','พฤ','ศ','ส'];
  all.forEach(function(j){dows[new Date(j.at).getDay()]++});
  barChart('chartDow', dows.map(function(v,i){
    return {lb:dn[i], v:v, tip:'วัน'+['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสฯ','ศุกร์','เสาร์'][i]+' · '+v+' งาน'};
  }), {color:css('--accent'), fmt:function(v){return v+' งาน'}});

  var days=[], byDay={};
  doneJobs().forEach(function(j){var k=dayKey(j.done); byDay[k]=(byDay[k]||0)+j.amt;});
  for(var i=13;i>=0;i--){
    var k=dayKey(Date.now()-i*864e5);
    var d=new Date(Date.now()-i*864e5);
    days.push({lb:(i%2===0?d.getDate():null), v:byDay[k]||0, tip:dayLabel(k)+' · '+baht(byDay[k]||0)});
  }
  barChart('chartDaily', days, {color:css('--money'), fmt:function(v){return baht(v)}});
}

/* ================= HISTORY ================= */
function renderHistory(){
  var dj=doneJobs().sort(function(a,b){return b.done-a.done});
  if(!dj.length){ $('histList').innerHTML='<div class="card"><div class="empty">ยังไม่มีประวัติ — <b>เริ่มงานแรกได้เลย</b></div></div>'; return; }
  var groups={};
  dj.forEach(function(j){var k=dayKey(j.done);(groups[k]=groups[k]||[]).push(j);});
  $('histList').innerHTML=Object.keys(groups).sort().reverse().map(function(k){
    var g=groups[k], sum=g.reduce(function(s,j){return s+j.amt},0);
    return '<div class="card dayGroup"><div class="dayHead">'+dayLabel(k)+
      '<span class="muted" style="font-weight:500;font-size:12.5px">'+g.length+' งาน</span>'+
      '<span class="sum">'+baht(sum)+'</span></div>'+
      groupDone(g).map(function(gr){
        if(gr.jobs.length>1){
          return '<div class="doneRow" data-batch="'+gr.batch+'"><span class="dot'+(gr.loc?'':' no')+'"></span>'+
          '<span class="t">'+timeStr(gr.at)+'</span><span class="tagBatch">ชุด '+gr.jobs.length+'</span>'+
          '<span class="a money" data-amt>'+baht(gr.amt)+'</span><span class="sp"></span>'+
          (gr.loc?'<a class="maplink" target="_blank" rel="noopener" href="'+mapsUrl(gr.loc.lat,gr.loc.lng)+'">แผนที่</a>':'')+
          '<button class="btnGhost" data-act="editb" data-batch="'+gr.batch+'">แก้</button>'+
          '<button class="btnGhost" data-act="delb" data-batch="'+gr.batch+'" style="color:var(--danger)">ลบ</button></div>';
        }
        var j=gr.jobs[0];
        return '<div class="doneRow" data-id="'+j.id+'"><span class="dot'+(j.lat==null?' no':'')+'"></span>'+
        '<span class="t">'+timeStr(j.at)+'</span><span class="a money" data-amt>'+baht(j.amt)+'</span><span class="sp"></span>'+
        (j.lat!=null?'<a class="maplink" target="_blank" rel="noopener" href="'+mapsUrl(j.lat,j.lng)+'">แผนที่</a>':'')+
        '<button class="btnGhost" data-act="edit" data-id="'+j.id+'">แก้</button>'+
        '<button class="btnGhost" data-act="del" data-id="'+j.id+'" style="color:var(--danger)">ลบ</button></div>';
      }).join('')+'</div>';
  }).join('');
}
function editAmt(id){
  var row=document.querySelector('.doneRow[data-id="'+id+'"]'); if(!row) return;
  var j=jobs.find(function(x){return x.id===id});
  var span=row.querySelector('[data-amt]');
  span.innerHTML='<input class="editIn" inputmode="decimal" value="'+j.amt+'">';
  var inp=span.querySelector('input'); inp.focus(); inp.select();
  function commit(){
    var v=parseFloat((inp.value||'').replace(/,/g,''));
    if(!isNaN(v)&&v>=0){ j.amt=v; save(); }
    renderAll();
  }
  inp.onblur=commit;
  inp.onkeydown=function(e){ if(e.key==='Enter') inp.blur(); };
}
function editBatchAmt(bid){
  var row=document.querySelector('.doneRow[data-batch="'+bid+'"]'); if(!row) return;
  var members=jobs.filter(function(x){return x.batch===bid});
  var total=Math.round(members.reduce(function(s,j){return s+j.amt},0)*100)/100;
  var span=row.querySelector('[data-amt]');
  span.innerHTML='<input class="editIn" inputmode="decimal" value="'+total+'">';
  var inp=span.querySelector('input'); inp.focus(); inp.select();
  function commit(){
    var v=parseFloat((inp.value||'').replace(/,/g,''));
    if(!isNaN(v)&&v>=0){ splitCents(v,members); save(); }
    renderAll();
  }
  inp.onblur=commit;
  inp.onkeydown=function(e){ if(e.key==='Enter') inp.blur(); };
}
function delBatch(bid){
  var n=jobs.filter(function(x){return x.batch===bid}).length;
  askConfirm('ลบชุดนี้ทั้ง '+n+' งานเลยใช่ไหม?',function(){
    jobs=jobs.filter(function(x){return x.batch!==bid}); save(); toast('ลบชุดแล้ว'); renderAll();
  });
}

/* ================= export / import ================= */
function download(name,content,type){
  var a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([content],{type:type}));
  a.download=name; a.click();
  setTimeout(function(){URL.revokeObjectURL(a.href)},4000);
}
$('btnCsv').onclick=function(){
  var rows=[['วันที่','เวลารับงาน','รายรับ(บาท)','จบพร้อมกัน','ละติจูด','ลองจิจูด','ลิงก์แผนที่']];
  var bmap={}, bn=0;
  doneJobs().sort(function(a,b){return a.at-b.at}).forEach(function(j){
    var btag=j.batch?(bmap[j.batch]||(bmap[j.batch]='ชุดที่ '+(++bn))):'';
    rows.push([dayKey(j.at),timeStr(j.at),j.amt,btag,j.lat!=null?j.lat:'',j.lng!=null?j.lng:'',j.lat!=null?mapsUrl(j.lat,j.lng):'']);
  });
  download('rider-income.csv','﻿'+rows.map(function(r){return r.join(',')}).join('\r\n'),'text/csv');
};
$('btnBackup').onclick=function(){
  download('rider-backup-'+dayKey(Date.now())+'.json',JSON.stringify(jobs),'application/json');
};
$('btnRestore').onclick=function(){$('fileIn').click()};
$('fileIn').onchange=function(){
  var f=this.files[0]; if(!f) return;
  var rd=new FileReader();
  rd.onload=function(){
    try{
      var arr=JSON.parse(rd.result);
      if(!Array.isArray(arr)) throw 0;
      var ids={}; jobs.forEach(function(j){ids[j.id]=1});
      var added=0;
      arr.forEach(function(j){ if(j&&j.id&&j.at&&!ids[j.id]){jobs.push(j);added++;} });
      jobs.sort(function(a,b){return a.at-b.at});
      save(); renderAll();
      toast('กู้ข้อมูลแล้ว: เพิ่ม '+added+' งาน');
    }catch(e){ toast('ไฟล์ไม่ถูกต้อง — ต้องเป็นไฟล์สำรองจากแอปนี้'); }
  };
  rd.readAsText(f); this.value='';
};
$('btnWipe').onclick=function(){
  askConfirm('ลบข้อมูลทั้งหมด? กู้คืนไม่ได้ถ้าไม่มีไฟล์สำรอง — แนะนำกด "สำรองข้อมูล" ก่อน',function(){
    jobs=[]; save(); toast('ล้างข้อมูลแล้ว'); renderAll();
  });
};
$('ovlNo').onclick=function(){ $('ovl').classList.remove('show'); ovlCb=null; };
$('ovlYes').onclick=function(){ $('ovl').classList.remove('show'); var cb=ovlCb; ovlCb=null; if(cb) cb(); };
$('ovl').onclick=function(e){ if(e.target===this){ this.classList.remove('show'); ovlCb=null; } };

/* ================= tabs & boot ================= */
function showTab(t){
  document.querySelectorAll('.tab').forEach(function(b){b.classList.toggle('on',b.dataset.tab===t)});
  document.querySelectorAll('.view').forEach(function(v){v.classList.toggle('active',v.id==='view-'+t)});
  if(t==='map') drawMap();
  if(t==='stats') renderStats();
  if(t==='history') renderHistory();
}
document.querySelector('.tabs').onclick=function(e){
  var b=e.target.closest('.tab'); if(b) showTab(b.dataset.tab);
};
function renderAll(){
  renderHome();
  if($('view-map').classList.contains('active')) drawMap();
  if($('view-stats').classList.contains('active')) renderStats();
  if($('view-history').classList.contains('active')) renderHistory();
}
$('btnNew').onclick=addJob;
$('btnGoalSet').onclick = function() {
  $('goalInput').value = settings.goal || '';
  $('goalModal').style.display = 'flex';
  $('goalInput').focus();
};
$('btnCancelGoal').onclick = function() { $('goalModal').style.display = 'none'; };
$('btnSaveGoal').onclick = function() {
  var v = parseInt($('goalInput').value, 10);
  settings.goal = isNaN(v) ? 0 : v;
  saveSettings();
  $('goalModal').style.display = 'none';
  renderHero();
};
$('btnShift').onclick = function() {
  if (settings.currentShiftStart) {
    askConfirm('ต้องการออกกะและสรุปเวลาใช่ไหม?', function(){
      var end = Date.now();
      settings.shifts.push({start: settings.currentShiftStart, end: end});
      settings.currentShiftStart = null;
      saveSettings();
      toast('ออกกะเรียบร้อยแล้ว');
      renderHero();
    });
  } else {
    settings.currentShiftStart = Date.now();
    saveSettings();
    toast('เริ่มกะทำงานแล้ว ขอให้ปังๆ!');
    renderHero();
  }
};
// Update shift time every minute if active
setInterval(function(){
  if (settings.currentShiftStart && $('view-home').classList.contains('active')) renderHero();
}, 60000);

document.addEventListener('click',function(e){
  var b=e.target.closest('[data-act]'); if(!b) return;
  var act=b.dataset.act, id=b.dataset.id;
  if(act==='finish') finishJob(id);
  else if(act==='finishAll') finishBatch();
  else if(act==='del') delJob(id,true);
  else if(act==='retry'){ var j=jobs.find(function(x){return x.id===id}); if(j){j.locState='pending'; renderHome(); captureLoc(id);} }
  else if(act==='edit') editAmt(id);
  else if(act==='editb') editBatchAmt(b.dataset.batch);
  else if(act==='delb') delBatch(b.dataset.batch);
});
document.addEventListener('input',function(e){
  if(e.target.classList.contains('amtIn')) e.target.style.borderColor='';
});
function pickMapPeriod(p){mapPeriod=p;renderChips('mapChips',p,pickMapPeriod);drawMap();}
function pickStatPeriod(p){statPeriod=p;renderChips('statChips',p,pickStatPeriod);renderStats();}
renderChips('mapChips',mapPeriod,pickMapPeriod);
renderChips('statChips',statPeriod,pickStatPeriod);
var rsT; window.addEventListener('resize',function(){
  clearTimeout(rsT); rsT=setTimeout(function(){ if($('view-map').classList.contains('active')) drawMap(); },200);
});
/* charts/map bake theme colors in — repaint when the theme flips */
function onThemeChange(){
  if($('view-map').classList.contains('active')) drawMap();
  if($('view-stats').classList.contains('active')) renderStats();
}
try{ matchMedia('(prefers-color-scheme: dark)').addEventListener('change',onThemeChange); }catch(e){}
new MutationObserver(onThemeChange).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
renderHome();
})();