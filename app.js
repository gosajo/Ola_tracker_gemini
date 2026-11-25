const $=id=>document.getElementById(id), KEY='ridelog_v2';
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const blankVehicle=(name,reg='')=>({id:uid(),name,reg,petrolRate:105,electricRate:8.5,petrolMileage:40,batteryCapacity:/punch/i.test(name)?40:4,maxRange:/punch/i.test(name)?450:180,chargeEfficiency:90,rides:[],services:[]});
let db=JSON.parse(localStorage.getItem(KEY)||'null');
if(!db)db={vehicles:[blankVehicle('Ola S1 X')],selected:null,theme:'light'};
if(!db.vehicles?.length)db.vehicles=[blankVehicle('Ola S1 X')];
db.vehicles.forEach(x=>{if(/punch/i.test(x.name)){if(!x.batteryCapacity||x.batteryCapacity===4)x.batteryCapacity=40;if(!x.maxRange||x.maxRange===180)x.maxRange=450}else{if(!x.maxRange)x.maxRange=180}});
if(!db.selected||!db.vehicles.some(v=>v.id===db.selected))db.selected=db.vehicles[0].id;
let v=()=>db.vehicles.find(x=>x.id===db.selected);
const persist=()=>localStorage.setItem(KEY,JSON.stringify(db));
const fmt=n=>'₹'+(Number(n)||0).toFixed(2), val=id=>Number($(id).value||0);
const estimatedEnergy=(from,to)=>{let drop=Math.max(0,Number(from)-Number(to));let capacity=Number(v().batteryCapacity)||4;let efficiency=Math.min(100,Math.max(1,Number(v().chargeEfficiency)||90));return (drop/100*capacity)/(efficiency/100)};
const currentOdo=()=>v().rides.length?Math.max(...v().rides.map(r=>Number(r.odo)||0)):0;
const sorted=()=>[...v().rides].sort((a,b)=>a.date.localeCompare(b.date));
const kmRide=(r,i)=>r.odo-(i>0?sorted()[i-1].odo:0);

function showTab(t){
  document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('hidden',x.id!==t));
  document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x.dataset.tab===t));
  if(t==='stats')renderStats();
  if(t==='service')renderServices();
  if(t==='profile')renderProfile();
  if(t==='rides')renderRides();
  window.scrollTo(0,0);
}
window.showTab=showTab;
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>showTab(b.dataset.tab));

$('themeToggle').onclick=()=>{db.theme=db.theme==='dark'?'light':'dark';applyTheme();persist()};
function applyTheme(){
  document.documentElement.dataset.theme=db.theme||'light';
  $('themeToggle').textContent=db.theme==='dark'?'☀':'☾';
}

$('vehicleSwitch').onclick=()=>{
  let names=db.vehicles.map((x,i)=>`${i+1}. ${x.name} (${x.reg||'no reg'})`).join('\n');
  let pick=prompt('Switch vehicle. Enter number:\n'+names);
  let n=Number(pick)-1;
  if(Number.isInteger(n)&&db.vehicles[n]){
    db.selected=db.vehicles[n].id;
    persist();
    renderAll();
  }
};

function latestRide(){return [...v().rides].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||(Number(b.odo)||0)-(Number(a.odo)||0))[0]}

function getRideCost(r){
  let energy=Number(r.energy)||0;
  if(r.chargeSource==='Home Solar'||r.chargeSource==='Office / Free') return 0;
  let rate=Number(r.electricRate)||Number(v().electricRate)||0;
  return energy*rate;
}

function requestNotificationPermission(){
  if(!('Notification' in window)){alert('Browser does not support notifications.');return}
  Notification.requestPermission().then(p=>{
    if(p==='granted') {
      alert('Smart Push Notifications Enabled! 🔔');
      triggerNotifications();
    } else alert('Permission not granted.');
  });
}
window.requestNotificationPermission = requestNotificationPermission;

function triggerNotifications(){
  let odo=currentOdo(), now=new Date().toISOString().slice(0,10);
  let dueServices=v().services.filter(s=>(s.atOdo&&odo>=s.atOdo)||(s.dueDate&&s.dueDate<=now));
  let last=latestRide();
  let lowBattery = last && Number(last.bTo) <= 20;

  let messages=[];
  if(lowBattery) messages.push(`⚠️ Battery low (${last.bTo}%). Time to charge your vehicle!`);
  dueServices.forEach(s=>messages.push(`🔧 Service due: ${s.name} (${s.atOdo?'At '+s.atOdo+' km':''} ${s.dueDate?'by '+s.dueDate:''})`));

  let listEl = $('smartNotificationsList');
  if(messages.length) {
    listEl.innerHTML = messages.map(m=>`<div style="padding:6px 0;border-bottom:1px solid var(--line)">${esc(m)}</div>`).join('');
    if('Notification' in window && Notification.permission === 'granted'){
      messages.forEach(msg=>{
        try { new Notification('RideLog Alert ⚡', { body: msg, icon: 'icon.svg' }); } catch(e){}
      });
    }
  } else {
    listEl.innerHTML = 'All clear! Battery level and service schedules are up to date. 👍';
  }
}

function renderHome(){
  let rides=sorted(),last=latestRide(),odo=currentOdo(),dist=0,units=0,cost=0;
  rides.forEach((r,i)=>{
    let d=kmRide(r,i),energy=Number(r.energy)||0;
    dist+=Math.max(0,Number(d)||0);
    units+=energy;
    cost+=getRideCost(r);
  });
  let avg=units?dist/units:0;
  let lastIndex=last?rides.findIndex(r=>r.id===last.id):-1;
  let lastDist=last&&lastIndex>=0?Math.max(0,kmRide(last,lastIndex)):0;
  let battery=last?Math.max(0,Math.min(100,Math.round(Number(last.bTo)||0))):0;
  let used=last?Math.max(0,Math.min(100-battery,(Number(last.bFrom)||0)-(Number(last.bTo)||0))):0;
  let total=battery+used;
  
  $('batteryText').textContent=last?battery+'%':'—%';
  $('batteryRing').style.setProperty('--charged',battery+'%');
  $('batteryRing').style.setProperty('--total',total+'%');
  $('lastChargeDate').textContent=last?'L.C. · '+last.date:'L.C. —';
  $('homeOdo').textContent=odo?Math.round(odo).toLocaleString()+' km':'— km';
  $('homeDistance').textContent=last?lastDist.toFixed(1)+' km':'— km';
  $('homeEfficiency').textContent=avg?avg.toFixed(2)+' km/kWh':'— km/kWh';
  $('homeCostKm').textContent=dist?fmt(cost/dist):'—';
  $('homeUnits').textContent=last?(Number(last.energy)||0).toFixed(2)+' kWh':'— kWh';
  $('homeCost').textContent=last?fmt(getRideCost(last)):'—';
  $('rideCount').textContent=rides.length+' entries';

  let due=v().services.filter(s=>s.atOdo&&odo>=s.atOdo||s.dueDate&&s.dueDate<=new Date().toISOString().slice(0,10));
  $('nextService').textContent=due.length?due.map(s=>s.name+' · due').join(' | '):(v().services[0]?.name+' · '+(v().services[0]?.atOdo?Math.max(0,Math.round(v().services[0].atOdo-odo))+' km left':'date reminder'))||'No reminders set.';

  triggerNotifications();
}

function previewCalc(){
  let prev=Math.round(currentOdo()),now=Math.round(val('currentOdo')),distance=now-prev,energy=estimatedEnergy(val('batteryFrom'),val('batteryTo')),rate=val('electricRate');
  let src=$('chargeSource').value;
  let cRate=(src==='Home Solar'||src==='Office / Free')?0:rate;
  let bFrom=Math.round(val('batteryFrom')),bTo=Math.round(val('batteryTo'));
  $('energy').value=energy.toFixed(2);
  $('batteryFromValue').textContent=String(bFrom);
  $('batteryToValue').textContent=String(bTo);
  $('currentOdoValue').textContent=now.toLocaleString();
  $('calcDistance').textContent=distance>=0?distance+' km':'Check odometer';
  $('calcEfficiency').textContent=energy>0&&distance>=0?(distance/energy).toFixed(2)+' km/kWh':'—';
  $('calcCost').textContent=fmt(energy*cRate);
  $('calcCostKm').textContent=distance>0?fmt(energy*cRate/distance):'—';
}
['currentOdo','batteryFrom','batteryTo','electricRate','chargeSource'].forEach(id=>$(id).addEventListener('input',previewCalc));

window.stepVal=(id,delta,min,max)=>{
  let el=$(id);
  let next=Math.min(max,Math.max(min,Math.round(Number(el.value)||0)+delta));
  el.value=next;
  previewCalc();
};

window.stepOdo=delta=>{
  let el=$('currentOdo');
  let min=Math.round(Number(el.min)||0);
  let max=Math.round(Number(el.max)||min);
  let next=Math.min(max,Math.max(min,Math.round(Number(el.value)||0)+delta));
  el.value=next;
  previewCalc();
};

function configureOdoSlider(value=currentOdo(),editing=false){
  let slider=$('currentOdo'),base=Math.round(currentOdo()),range=Math.round(Number(v().maxRange)||(/punch/i.test(v().name)?450:180));
  let valNum=Math.round(Number(value)||0);
  slider.min=editing?Math.max(0,valNum-range):base;
  slider.max=Math.max(valNum+range,base+range,range);
  slider.step='1';
  slider.value=valNum;
  $('odoRangeHint').textContent=`Slide from ${Number(slider.min).toLocaleString()} to ${Number(slider.max).toLocaleString()}`;
  previewCalc();
}

const monthNames=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function setChargeDate(iso){
  let parts=String(iso||new Date().toISOString().slice(0,10)).split('-').map(Number),y=parts[0]||new Date().getFullYear(),m=parts[1]||1,d=parts[2]||1;
  $('chargeYear').value=String(y);
  $('chargeMonth').value=String(m);
  populateChargeDays();
  $('chargeDay').value=String(Math.min(d,new Date(y,m,0).getDate()));
  syncChargeDate();
}

function populateChargeDays(){
  let y=Number($('chargeYear').value)||new Date().getFullYear(),m=Number($('chargeMonth').value)||1,max=new Date(y,m,0).getDate(),day=$('chargeDay').value||'1';
  $('chargeDay').innerHTML=Array.from({length:max},(_,i)=>`<option value="${i+1}">${String(i+1).padStart(2,'0')}</option>`).join('');
  $('chargeDay').value=String(Math.min(Number(day)||1,max));
}

function syncChargeDate(){
  let y=Number($('chargeYear').value),m=Number($('chargeMonth').value),d=Number($('chargeDay').value);
  if(y&&m&&d)$('chargeDate').value=`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

function initChargeDate(){
  let now=new Date(),year=now.getFullYear(),years=new Set(Array.from({length:21},(_,i)=>year-15+i));
  db.vehicles.flatMap(x=>x.rides||[]).forEach(r=>{let y=Number(String(r.date||'').slice(0,4));if(y>=1900)years.add(y)});
  $('chargeYear').innerHTML=[...years].sort((a,b)=>a-b).map(y=>`<option value="${y}">${y}</option>`).join('');
  $('chargeMonth').innerHTML=monthNames.map((m,i)=>`<option value="${i+1}">${m}</option>`).join('');
  setChargeDate(`${year}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`);
  $('chargeDay').onchange=syncChargeDate;
  $('chargeMonth').onchange=()=>{populateChargeDays();syncChargeDate()};
  $('chargeYear').onchange=()=>{populateChargeDays();syncChargeDate()};
}

$('rideForm').onsubmit=e=>{
  e.preventDefault();
  let oldId=$('rideId').value,odo=Math.round(val('currentOdo')),previous=Math.round(currentOdo());
  if(odo<previous&&!oldId){alert('Current odometer cannot be lower than the last saved odometer.');return}
  let bFrom=Math.round(val('batteryFrom')),bTo=Math.round(val('batteryTo'));
  let r={
    id:oldId||uid(),
    date:$('chargeDate').value,
    bFrom,
    bTo,
    odo,
    energy:estimatedEnergy(bFrom,bTo),
    petrolRate:val('petrolRate'),
    electricRate:val('electricRate'),
    tag:$('rideTag').value,
    chargeSource:$('chargeSource').value,
    startLoc:$('rideStartLoc').value.trim(),
    endLoc:$('rideEndLoc').value.trim(),
    notes:$('rideNotes').value
  };
  if(r.bFrom>100||r.bTo>100||r.bFrom<0||r.bTo<0||r.energy<0){alert('Check battery percentage and energy values.');return}
  let ix=v().rides.findIndex(x=>x.id===r.id);
  if(ix>=0)v().rides[ix]=r;else v().rides.push(r);
  v().petrolRate=r.petrolRate;
  v().electricRate=r.electricRate;
  persist();
  resetRide();
  renderAll();
  showTab('home');
};

function resetRide(){
  $('rideForm').reset();
  $('rideId').value='';
  $('rideFormTitle').textContent='Log ride / charge';
  $('rideSave').textContent='Save Ride';
  $('rideCancel').classList.add('hidden');
  setChargeDate(new Date().toISOString().slice(0,10));
  $('petrolRate').value=v().petrolRate;
  $('electricRate').value=v().electricRate;
  $('rideTag').value='City';
  $('chargeSource').value='Home Grid';
  $('rideStartLoc').value='';
  $('rideEndLoc').value='';
  configureOdoSlider(currentOdo(),false);
  previewCalc();
}
$('rideCancel').onclick=resetRide;

function editRates(){
  let p=prompt('Petrol rate (₹/L)',v().petrolRate);if(p===null)return;
  let e=prompt('Electricity rate (₹/kWh)',v().electricRate);if(e===null)return;
  if(Number(p)<0||Number(e)<0||p===''||e===''){alert('Enter valid non-negative rates.');return}
  v().petrolRate=Number(p);
  v().electricRate=Number(e);
  $('petrolRate').value=p;
  $('electricRate').value=e;
  persist();
  previewCalc();
}
window.editRates=editRates;

function renderRides(){
  let q=$('rideSearch').value.toLowerCase(),chron=sorted(),rs=[...v().rides].sort((a,b)=>b.date.localeCompare(a.date)||b.odo-a.odo).filter(r=>(r.date+' '+r.notes+' '+(r.tag||'')+' '+(r.chargeSource||'')+' '+(r.startLoc||'')+' '+(r.endLoc||'')).toLowerCase().includes(q));
  $('rideHistory').innerHTML=rs.length?rs.map(r=>{
    let ix=chron.findIndex(x=>x.id===r.id),d=ix>=0?Math.max(0,kmRide(r,ix)):0;
    let cost=getRideCost(r);
    let routeInfo=(r.startLoc||r.endLoc)? ` 📍 ${esc(r.startLoc||'Start')} → ${esc(r.endLoc||'End')}` : '';
    return `<div class="entry">
      <div class="history-head">
        <div>
          <b>${r.date} · ${Math.round(d)} km</b>${routeInfo}
          <div style="margin-top:2px">
            <span class="pill tag">${r.tag||'City'}</span>
            <span class="pill tag">${r.chargeSource||'Home Grid'}</span>
          </div>
        </div>
        <button class="history-toggle" aria-label="Show details" onclick="toggleRideDetails('${r.id}',this)">⌄</button>
      </div>
      <div class="history-detail hidden" id="rideDetail_${r.id}">
        <div class="muted">Battery ${Math.round(r.bFrom)}% → ${Math.round(r.bTo)}% · Odo ${Math.round(r.odo).toLocaleString()} km · ${Number(r.energy).toFixed(2)} kWh · ${(r.energy?d/r.energy:0).toFixed(2)} km/kWh · ${fmt(cost)}</div>
        <div class="muted">${esc(r.notes||'')}</div>
        <div class="actions">
          <button class="icon-action" title="Edit" aria-label="Edit" onclick="editRide('${r.id}')">✎</button>
          <button class="icon-action" title="Delete" aria-label="Delete" onclick="deleteRide('${r.id}')">⌫</button>
        </div>
      </div>
    </div>`
  }).join(''):'No matching rides.';
}

window.toggleRideDetails=(id,btn)=>{
  let el=$('rideDetail_'+id);
  el.classList.toggle('hidden');
  btn.setAttribute('aria-expanded',String(!el.classList.contains('hidden')));
};

function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

window.editRide=id=>{
  let r=v().rides.find(x=>x.id===id);if(!r)return;
  $('rideId').value=r.id;
  setChargeDate(r.date);
  $('batteryFrom').value=Math.round(Number(r.bFrom)||0);
  $('batteryTo').value=Math.round(Number(r.bTo)||0);
  configureOdoSlider(r.odo,true);
  $('energy').value=r.energy;
  $('petrolRate').value=r.petrolRate;
  $('electricRate').value=r.electricRate;
  $('rideTag').value=r.tag||'City';
  $('chargeSource').value=r.chargeSource||'Home Grid';
  $('rideStartLoc').value=r.startLoc||'';
  $('rideEndLoc').value=r.endLoc||'';
  $('rideNotes').value=r.notes||'';
  $('rideFormTitle').textContent='Edit Ride Record';
  $('rideSave').textContent='Save Changes';
  $('rideCancel').classList.remove('hidden');
  showTab('rides');
  previewCalc();
};

window.deleteRide=id=>{
  if(confirm('Delete this ride record?')){
    v().rides=v().rides.filter(x=>x.id!==id);
    persist();
    renderAll();
  }
};
$('rideSearch').oninput=renderRides;

function syncServiceSliders(){
  let at=val('serviceAtOdo'),every=val('serviceEveryKm'),base=currentOdo();
  $('serviceAtOdoSlider').min=base;
  $('serviceAtOdoSlider').max=Math.max(base+10000,at);
  $('serviceAtOdoSlider').value=Math.max(base,at);
  $('serviceEveryKmSlider').min=0;
  $('serviceEveryKmSlider').max=Math.max(10000,every);
  $('serviceEveryKmSlider').value=every;
  $('serviceAtOdoValue').textContent=at.toLocaleString()+' km';
  $('serviceEveryKmValue').textContent=every.toLocaleString()+' km';
}
$('serviceAtOdoSlider').addEventListener('input',()=>{$('serviceAtOdo').value=$('serviceAtOdoSlider').value;syncServiceSliders()});
$('serviceEveryKmSlider').addEventListener('input',()=>{$('serviceEveryKm').value=$('serviceEveryKmSlider').value;syncServiceSliders()});
['serviceAtOdo','serviceEveryKm'].forEach(id=>$(id).addEventListener('input',syncServiceSliders));

$('serviceForm').onsubmit=e=>{
  e.preventDefault();
  let s={id:uid(),type:$('serviceType').value,name:$('serviceName').value,atOdo:val('serviceAtOdo'),everyKm:val('serviceEveryKm'),dueDate:$('serviceDueDate').value,everyDays:val('serviceEveryDays'),cost:val('serviceCost')};
  if(!s.atOdo&&!s.dueDate&&!s.everyKm&&!s.everyDays&&!s.cost){alert('Set at least an odometer, date, or cost.');return}
  v().services.push(s);
  persist();
  $('serviceForm').reset();
  syncServiceSliders();
  renderServices();
  renderHome();
};

function renderServices(){
  let odo=currentOdo(),now=new Date().toISOString().slice(0,10);
  let totalMaintCost=v().services.reduce((acc,s)=>acc+(Number(s.cost)||0),0);
  let rides=sorted(),dist=0,powerCost=0;
  rides.forEach((r,i)=>{dist+=Math.max(0,kmRide(r,i));powerCost+=getRideCost(r)});
  let tcoKm=dist? (powerCost+totalMaintCost)/dist : 0;
  
  $('totalServiceCost').textContent=fmt(totalMaintCost);
  $('totalTcoKm').textContent=dist?fmt(tcoKm):'—';

  let catTotals={};
  v().services.forEach(s=>{
    let t=s.type||'Servicing';
    catTotals[t]=(catTotals[t]||0)+(Number(s.cost)||0);
  });
  let catHtml=Object.keys(catTotals).map(k=>`<b>${k}:</b> ${fmt(catTotals[k])}`).join(' · ');
  $('expenseCategoryBreakdown').innerHTML=catHtml? `Category breakdown: ${catHtml}` : 'No categorized expenses yet.';

  $('serviceHistory').innerHTML=v().services.length?v().services.map(s=>{
    let dueKm=s.atOdo&&odo>=s.atOdo,dueDate=s.dueDate&&s.dueDate<=now;
    let isDue=dueKm||dueDate;
    return `<div class="entry">
      <div class="toolbar">
        <div>
          <b>${esc(s.name)}</b>
          <span class="pill tag" style="margin-left:4px">${s.type||'Servicing'}</span>
        </div>
        <span class="pill ${isDue?'due':''}">${isDue?'DUE':'Recorded'}</span>
      </div>
      <div class="muted" style="margin-top:4px">
        ${s.atOdo?'At '+s.atOdo.toLocaleString()+' km':''}
        ${s.everyKm?' · Repeat every '+s.everyKm+' km':''}
        ${s.dueDate?' · Date '+s.dueDate:''}
        ${s.cost?' · Cost '+fmt(s.cost):''}
      </div>
      <div class="actions">
        <button class="btn" onclick="editService('${s.id}')">✎ Edit</button>
        <button class="btn" onclick="markService('${s.id}')">Done ✓</button>
        <button class="btn" onclick="deleteService('${s.id}')">Delete</button>
      </div>
    </div>`
  }).join(''):'No expenses recorded.';
}

window.editService=id=>{
  let s=v().services.find(x=>x.id===id);if(!s)return;
  let name=prompt('Expense / Component name',s.name);if(name===null)return;
  let at=prompt('Remind at odometer (km)',s.atOdo||'');if(at===null)return;
  let interval=prompt('Repeat interval (km)',s.everyKm||'');if(interval===null)return;
  let cost=prompt('Spent cost (₹)',s.cost||'0');if(cost===null)return;
  let date=prompt('Next due date (YYYY-MM-DD)',s.dueDate||'');if(date===null)return;
  s.name=name;s.atOdo=Number(at)||0;s.everyKm=Number(interval)||0;s.cost=Number(cost)||0;s.dueDate=date;
  persist();renderAll();
};

window.markService=id=>{
  let s=v().services.find(x=>x.id===id);if(!s)return;
  if(s.everyKm)s.atOdo=currentOdo()+s.everyKm;
  else if(s.atOdo)s.atOdo=currentOdo();
  if(s.dueDate&&s.everyDays){
    let d=new Date(s.dueDate+'T00:00:00');d.setDate(d.getDate()+s.everyDays);
    s.dueDate=d.toISOString().slice(0,10);
  }else if(s.dueDate)s.dueDate='';
  persist();renderAll();
};

window.deleteService=id=>{
  if(confirm('Delete expense entry?')){
    v().services=v().services.filter(s=>s.id!==id);
    persist();renderAll();
  }
};

function monthKey(d){return String(d||'').slice(0,7)}
function statsVehicles(){let scope=$('statsScope').value;return scope==='all'?db.vehicles:db.vehicles.filter(x=>x.id===scope)}

function populateStatsScopes(){
  let select=$('statsScope'),current=select.value,opts=db.vehicles.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('');
  select.innerHTML=opts+'<option value="all">Combined · All Vehicles</option>';
  select.value=(current==='all'||db.vehicles.some(x=>x.id===current))?current:db.selected;
}

function vehicleRideRows(vehicle){
  let rows=[...(vehicle.rides||[])].sort((a,b)=>String(a.date).localeCompare(String(b.date))||Number(a.odo)-Number(b.odo));
  let previous=0;
  return rows.map(r=>{
    let odo=Number(r.odo)||0,dist=Math.max(0,odo-previous);
    previous=Math.max(previous,odo);
    let energy=Math.max(0,Number(r.energy)||0),electricRate=Math.max(0,Number(r.electricRate??vehicle.electricRate)||0),petrolMileage=Number(vehicle.petrolMileage)||0,petrolRate=Math.max(0,Number(r.petrolRate??vehicle.petrolRate)||0);
    let cost= (r.chargeSource==='Home Solar'||r.chargeSource==='Office / Free') ? 0 : energy*electricRate;
    let petrol=petrolMileage>0?dist/petrolMileage*petrolRate:0;
    return {vehicle,r,date:String(r.date||''),month:monthKey(r.date),year:String(r.date||'').slice(0,4),dist,energy,electricRate,cost,petrol,saved:petrolMileage>0?petrol-cost:null,eff:energy>0?dist/energy:0,tag:r.tag||'City'};
  });
}

function sumRows(rows){
  let out={rides:rows.length,dist:0,energy:0,cost:0,petrol:0,saved:0,petrolRows:0};
  rows.forEach(x=>{
    out.dist+=x.dist;
    out.energy+=x.energy;
    out.cost+=x.cost;
    if(Number(x.vehicle.petrolMileage)>0){
      out.petrol+=x.petrol;
      out.saved+=x.saved;
      out.petrolRows++;
    }
  });
  out.eff=out.energy>0?out.dist/out.energy:0;
  return out;
}

function aggregateFor(vehicles,filter){
  let rows=vehicles.flatMap(vehicleRideRows).filter(x=>!filter||(filter(x)));
  return {...sumRows(rows),rows};
}

function fmtEfficiency(n){return n>0?n.toFixed(2)+' km/kWh':'—'}

function renderLongTermSavings(){
  let pPrice = val('calcPetrolPrice') || 105;
  let pMil = val('calcPetrolMileage') || 40;
  let dist = val('calcProjectedKm') || 10000;
  let tariff = val('calcPowerTariff') || 8.5;

  let petrolCost = (dist / pMil) * pPrice;

  // Vehicle 1: Ola S1 X (~40 km/kWh real efficiency, 4 kWh pack)
  let olaEff = 35; 
  let olaUnits = dist / olaEff;
  let olaCost = olaUnits * tariff;

  // Vehicle 2: Tata Punch EV (~8 km/kWh real efficiency, 40 kWh pack)
  let punchEff = 7.5; 
  let punchUnits = dist / punchEff;
  let punchCost = punchUnits * tariff;

  $('longTermSavingsResults').innerHTML = `
    <div style="overflow-x:auto">
      <table>
        <thead>
          <tr>
            <th>Vehicle / Mode</th>
            <th>Projected Distance</th>
            <th>Power / Fuel Cost</th>
            <th>Savings vs Petrol</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><b>Petrol Vehicle</b> (${pMil} km/L @ ₹${pPrice})</td>
            <td>${dist.toLocaleString()} km</td>
            <td>${fmt(petrolCost)}</td>
            <td>—</td>
          </tr>
          <tr>
            <td><b>Ola S1 X Scooter</b> (~${olaEff} km/kWh)</td>
            <td>${dist.toLocaleString()} km</td>
            <td>${fmt(olaCost)}</td>
            <td><b style="color:var(--accent)">${fmt(petrolCost - olaCost)} saved</b></td>
          </tr>
          <tr>
            <td><b>Tata Punch EV</b> (~${punchEff} km/kWh)</td>
            <td>${dist.toLocaleString()} km</td>
            <td>${fmt(punchCost)}</td>
            <td><b style="color:var(--accent)">${fmt(petrolCost - punchCost)} saved</b></td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

['calcPetrolPrice','calcPetrolMileage','calcProjectedKm','calcPowerTariff'].forEach(id=>$(id).addEventListener('input',renderLongTermSavings));

function renderStats(){
  let m=$('statsMonth').value||new Date().toISOString().slice(0,7),year=$('statsYear').value||m.slice(0,4),vehicles=statsVehicles();
  let month=aggregateFor(vehicles,x=>x.month===m),yr=aggregateFor(vehicles,x=>x.year===year);
  
  $('statMonth').textContent=month.dist.toFixed(1)+' km';
  $('statMonthEnergy').textContent=month.energy.toFixed(2)+' kWh';
  $('statMonthCost').textContent=fmt(month.cost);
  $('statMonthEfficiency').textContent=fmtEfficiency(month.eff);
  $('statMonthRides').textContent=String(month.rides);
  $('statSavings').textContent=fmt(month.saved);
  
  $('statYearDistance').textContent=yr.dist.toFixed(1)+' km';
  $('statYearEnergy').textContent=yr.energy.toFixed(2)+' kWh';
  $('statYearCost').textContent=fmt(yr.cost);
  $('statYearEfficiency').textContent=fmtEfficiency(yr.eff);
  $('statYearPetrol').textContent=fmt(yr.petrol);
  $('statYearSavings').textContent=fmt(yr.saved);

  // Battery health & range tracking
  let rides=sorted();
  let validRides=rides.filter(r=>(Number(r.bFrom)-Number(r.bTo))>=30 && Number(r.odo)>0);
  if(validRides.length>=2){
    let avgEff = yr.eff > 0 ? yr.eff : (month.eff > 0 ? month.eff : 35);
    let packCap = Number(v().batteryCapacity) || 4;
    let estimatedRealRange = avgEff * packCap;
    let expectedMax = Number(v().maxRange) || 180;
    let healthPct = Math.min(100, Math.round((estimatedRealRange / expectedMax) * 100));
    $('batteryHealthStatus').textContent = `${healthPct}% Nominal Health`;
    $('batteryRealizedRange').textContent = `${Math.round(estimatedRealRange)} km / charge`;
  } else {
    $('batteryHealthStatus').textContent = 'Healthy (Log more rides)';
    $('batteryRealizedRange').textContent = `${v().maxRange||180} km (theoretical)`;
  }

  // Long-term savings rendering
  renderLongTermSavings();

  let tags=['City','Highway','Mixed','Eco'];
  let tagHtml=tags.map(t=>{
    let tagRows=aggregateFor(vehicles,x=>x.year===year && x.tag===t);
    return `<div class="metric"><small>${t} Category</small><strong>${tagRows.dist.toFixed(1)} km · ${fmtEfficiency(tagRows.eff)}</strong></div>`;
  }).join('');
  $('categoryBreakdown').innerHTML=`<div class="grid">${tagHtml}</div>`;

  let monthAgg=Array.from({length:12},(_,i)=>{
    let key=year+'-'+String(i+1).padStart(2,'0');
    return {key,...aggregateFor(vehicles,x=>x.month===key)};
  }),maxDist=Math.max(1,...monthAgg.map(x=>x.dist));

  $('monthBars').innerHTML=monthAgg.some(x=>x.rides)?monthAgg.map(x=>`<div style="margin:10px 0">
    <div class="toolbar"><span class="muted">${new Date(x.key+'-01T00:00:00').toLocaleString('en-IN',{month:'short'})}</span><b>${x.dist.toFixed(1)} km</b></div>
    <div class="bar"><i style="width:${Math.max(x.dist?3:0,x.dist/maxDist*100)}%"></i></div>
  </div>`).join(''):'<p class="muted">No data for selected year.</p>';

  let monthHighlights=monthAgg.filter(x=>x.energy>0&&x.dist>0).map(x=>({...x,eff:x.dist/x.energy})).sort((a,b)=>b.eff-a.eff);
  $('efficiencyHighlights').innerHTML=monthHighlights.length?`<div class="grid">
    <div class="metric"><small>Best Efficiency Month</small><strong>${new Date(monthHighlights[0].key+'-01T00:00:00').toLocaleString('en-IN',{month:'short'})} · ${monthHighlights[0].eff.toFixed(2)}</strong></div>
    <div class="metric"><small>Lowest Efficiency Month</small><strong>${new Date(monthHighlights[monthHighlights.length-1].key+'-01T00:00:00').toLocaleString('en-IN',{month:'short'})} · ${monthHighlights[monthHighlights.length-1].eff.toFixed(2)}</strong></div>
  </div>`:'No efficiency highlights yet.';

  let breakdown=vehicles.length>1?vehicles.map(vehicle=>{
    let a=aggregateFor([vehicle],x=>x.year===year);
    return `<tr><td>${esc(vehicle.name)}</td><td>${a.dist.toFixed(1)} km</td><td>${a.energy.toFixed(2)} kWh</td><td>${fmt(a.cost)}</td><td>${fmtEfficiency(a.eff)}</td><td>${fmt(a.saved)}</td></tr>`;
  }).join(''):'';
  $('vehicleBreakdown').innerHTML=vehicles.length>1?`<h3>Vehicle Yearly Breakdown</h3><div style="overflow-x:auto"><table><thead><tr><th>Vehicle</th><th>Distance</th><th>Energy</th><th>EV Cost</th><th>Efficiency</th><th>Savings</th></tr></thead><tbody>${breakdown}</tbody></table></div>`:'';
}

function populateStatsYears(){
  let years=new Set(db.vehicles.flatMap(x=>(x.rides||[]).map(r=>String(r.date||'').slice(0,4))).filter(x=>/^\d{4}$/.test(x)));
  years.add(new Date().getFullYear().toString());
  let current=$('statsYear').value||new Date().getFullYear().toString();
  $('statsYear').innerHTML=[...years].sort().reverse().map(y=>`<option value="${y}">${y}</option>`).join('');
  $('statsYear').value=years.has(current)?current:new Date().getFullYear().toString();
}

populateStatsScopes();
$('statsMonth').value=new Date().toISOString().slice(0,7);
$('statsMonth').onchange=()=>{let y=$('statsMonth').value.slice(0,4);$('statsYear').value=y;renderStats()};
$('statsYear').onchange=renderStats;
$('statsScope').onchange=renderStats;

function buildStatsPdf(period){
  let vehicles=statsVehicles(),m=$('statsMonth').value,year=$('statsYear').value,rows=vehicles.flatMap(vehicleRideRows).filter(x=>period==='month'?x.month===m:x.year===year),s=sumRows(rows),w=window.open('','_blank');
  if(!w){alert('Allow pop-ups to generate PDF report.');return}
  let label=period==='month'?new Date(m+'-01T00:00:00').toLocaleString('en-IN',{month:'long',year:'numeric'}):year;
  let title=period==='month'?'Monthly':'Yearly';
  let entries=rows.sort((a,b)=>a.date.localeCompare(b.date)||a.vehicle.name.localeCompare(b.vehicle.name)).map(x=>`<tr><td>${esc(x.vehicle.name)}</td><td>${esc(x.date)}</td><td>${Number(x.r.odo)||0}</td><td>${x.dist.toFixed(1)} km</td><td>${Number(x.r.bFrom)||0}% → ${Number(x.r.bTo)||0}%</td><td>${x.energy.toFixed(2)} kWh</td><td>${fmt(x.cost)}</td></tr>`).join('');
  w.document.write(`<html><head><title>RideLog_${period}_${label}</title><style>body{font:14px sans-serif;padding:24px;color:#222}h1{color:#2e7d52}table{border-collapse:collapse;width:100%;margin:12px 0 20px}td,th{border:1px solid #ccc;padding:8px;text-align:left;font-size:12px}</style></head><body><h1>RideLog ${title} Report</h1><h2>${esc(label)}</h2><table><tr><th>Distance</th><th>Energy</th><th>EV Cost</th><th>Efficiency</th><th>Estimated Petrol Cost</th><th>Estimated Savings</th></tr><tr><td>${s.dist.toFixed(1)} km</td><td>${s.energy.toFixed(2)} kWh</td><td>${fmt(s.cost)}</td><td>${fmtEfficiency(s.eff)}</td><td>${fmt(s.petrol)}</td><td>${fmt(s.saved)}</td></tr></table><h3>Detailed Entries</h3><table><tr><th>Vehicle</th><th>Date</th><th>Odometer</th><th>Distance</th><th>Battery</th><th>Energy</th><th>EV Cost</th></tr>${entries||'<tr><td colspan="7">No records found.</td></tr>'}</table><script>window.onload=()=>window.print()<\/script></body></html>`);
  w.document.close();
}
$('makePdf').onclick=()=>buildStatsPdf('month');
$('makeYearPdf').onclick=()=>buildStatsPdf('year');

function renderProfile(){
  $('vehicleList').innerHTML=db.vehicles.map(x=>`<div class="entry toolbar"><div><b>${esc(x.name)}</b><div class="muted">${esc(x.reg||'No reg')} · ${x.rides.length} rides</div></div><button class="btn" onclick="selectVehicle('${x.id}')">${x.id===db.selected?'Selected':'Switch'}</button></div>`).join('');
  $('profileName').value=v().name;
  $('profileReg').value=v().reg;
  $('petrolMileage').value=v().petrolMileage;
  $('batteryCapacity').value=v().batteryCapacity||4;
  $('maxRange').value=v().maxRange||(/punch/i.test(v().name)?450:180);
  $('chargeEfficiency').value=v().chargeEfficiency||90;
}

window.selectVehicle=id=>{db.selected=id;persist();renderAll();showTab('home')};
$('vehicleForm').onsubmit=e=>{
  e.preventDefault();
  let x=blankVehicle($('newVehicleName').value,$('newVehicleReg').value.trim().toUpperCase());
  db.vehicles.push(x);
  db.selected=x.id;
  persist();
  $('vehicleForm').reset();
  renderAll();
  showTab('home');
};

$('saveProfile').onclick=()=>{
  v().name=$('profileName').value.trim()||v().name;
  v().reg=$('profileReg').value.trim().toUpperCase();
  v().petrolMileage=Number($('petrolMileage').value)||0;
  v().batteryCapacity=Number($('batteryCapacity').value)||4;
  v().maxRange=Number($('maxRange').value)||(/punch/i.test(v().name)?450:180);
  v().chargeEfficiency=Math.min(100,Math.max(1,Number($('chargeEfficiency').value)||90));
  persist();
  renderAll();
  alert('Profile updated successfully.');
};

$('exportData').onclick=()=>{
  let a=document.createElement('a'),blob=new Blob([JSON.stringify(db,null,2)],{type:'application/json'});
  a.href=URL.createObjectURL(blob);
  a.download='ridelog-backup.json';
  a.click();
  URL.revokeObjectURL(a.href);
};

$('exportCsv').onclick=()=>{
  let rows=[['Vehicle','Date','Odometer (km)','Battery From (%)','Battery To (%)','Energy (kWh)','Trip Tag','Charge Source','Start Location','End Location','Notes']];
  db.vehicles.forEach(veh=>{
    (veh.rides||[]).forEach(r=>{
      rows.push([veh.name, r.date, r.odo, r.bFrom, r.bTo, r.energy, r.tag||'City', r.chargeSource||'Home Grid', r.startLoc||'', r.endLoc||'', `"${(r.notes||'').replace(/"/g,'""')}"`]);
    });
  });
  let csvContent = rows.map(e => e.join(',')).join('\n');
  let blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  let a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ridelog-data.csv';
  a.click();
  URL.revokeObjectURL(a.href);
};

$('importFile').onchange=async e=>{
  try{
    let x=JSON.parse(await e.target.files[0].text());
    if(!Array.isArray(x.vehicles)||!x.vehicles.length)throw 0;
    if(confirm('Overwrite current local logbook with backup file?')){db=x;persist();renderAll()}
  }catch{alert('Invalid backup file.')}
  e.target.value='';
};

function renderAll(){
  db.vehicles.forEach(vehicle=>{
    let cap=Number(vehicle.batteryCapacity)||(/punch/i.test(vehicle.name)?40:4),eff=Math.min(100,Math.max(1,Number(vehicle.chargeEfficiency)||90));
    (vehicle.rides||[]).forEach(r=>{
      let from=Number(r.bFrom)||0,to=Number(r.bTo)||0;
      r.energy=(Math.max(0,from-to)/100*cap)/(eff/100);
      r.odo=Number(r.odo)||0;
      r.electricRate=Number(r.electricRate??vehicle.electricRate)||0;
      r.date=String(r.date||'');
    });
  });
  let x=v();
  $('vehicleSwitch').textContent=x.name+' ▾';
  populateStatsScopes();
  $('petrolRate').value=x.petrolRate;
  $('electricRate').value=x.electricRate;
  resetRide();
  renderHome();
  renderRides();
  renderServices();
  populateStatsYears();
  renderStats();
  renderProfile();
  applyTheme();
  persist();
}

if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
initChargeDate();
syncServiceSliders();
renderAll();