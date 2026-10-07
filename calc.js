// calc.js — all calculation logic. No external libraries.
const BIRO_FEDDAN_M2 = 4200;
const MIN_VISIBLE_WHEELS = 9;
const DEFAULT_SPAN_WIDTH = 1.8;

const BRANDS = {
  valley: {nameAr:"ڤالي", nameEn:"Valley", length:52},
  zimmatic: {nameAr:"زيماتيك", nameEn:"Zimmatic", length:54},
  western: {nameAr:"ويستيرن", nameEn:"Western", length:55}
};

function n(value){
  if(value === null || value === undefined || value === "") return 0;
  const s = String(value)
    .replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-1632))
    .replace(/[۰-۹]/g,d=>String(d.charCodeAt(0)-1776))
    .replace(/٫/g,".")
    .replace(/٬/g,"");
  const v = Number.parseFloat(s);
  return Number.isFinite(v) ? v : 0;
}

function roundInt(v){ return Math.round(v); }

function radiusFromArea(area){
  return Math.sqrt(Math.max(0, area) * BIRO_FEDDAN_M2 / Math.PI);
}

function totalTracksExact(area, spanWidth){
  const R = radiusFromArea(area);
  return spanWidth > 0 ? R / spanWidth : 0;
}

function cumulativeBiroArea(area, radius, distance){
  if(area <= 0 || radius <= 0 || distance <= 0) return 0;
  const d = Math.min(Math.max(distance,0), radius);
  const ratio = Math.min(1, Math.max(-1, d / radius));
  const thetaDeg = Math.asin(ratio) * 180 / Math.PI;
  const g = (radius - distance >= 0)
    ? Math.cos(thetaDeg * Math.PI / 180) * radius
    : 0;
  // This is the same structure as the Excel "الجور" sheet:
  // (2*angle*area/360) + (G*D/4200)
  return (2 * thetaDeg * area / 360) + (g * distance / BIRO_FEDDAN_M2);
}

function wheelCountFor(totalTracks, tracksPerWheel){
  if(totalTracks <= 0 || tracksPerWheel <= 0) return 0;
  return Math.ceil(totalTracks / tracksPerWheel);
}

function buildStandardCounts(totalTracksRounded, tracksPerWheel){
  const active = wheelCountFor(totalTracksRounded, tracksPerWheel);
  const counts = [];
  let remaining = totalTracksRounded;
  for(let i=0;i<active;i++){
    const take = (i === active-1) ? remaining : Math.min(tracksPerWheel, remaining);
    counts.push(Math.max(0, roundInt(take)));
    remaining -= take;
  }
  return counts;
}

function buildSavedPatternCounts(saved, totalTracksRounded, spanWidth){
  if(!saved || totalTracksRounded<=0) return [];
  const source=Array.isArray(saved.pattern)&&saved.pattern.length?saved.pattern:(Array.isArray(saved.userTracks)?saved.userTracks:[]);
  const counts=[];
  let remaining=totalTracksRounded;
  for(const raw of source){
    if(remaining<=0) break;
    const v=Math.max(0,roundInt(n(raw)));
    if(v<=0) break;
    const take=Math.min(v,remaining);
    counts.push(take);
    remaining-=take;
  }
  if(remaining>0){
    const per=Math.max(1,roundInt(saved.fallbackTracksPerWheel || saved.tracksPerWheel || (saved.towerLength ? saved.towerLength/spanWidth : 1)));
    while(remaining>0){
      const take=Math.min(per,remaining);
      counts.push(take);
      remaining-=take;
    }
  }
  return counts;
}

function buildVisibleRows(activeCount){
  return Math.max(MIN_VISIBLE_WHEELS, activeCount);
}

function getBrandConfig(brandId, spanWidth){
  if(brandId && brandId.startsWith('saved:')){
    const saved = loadSavedBrand(brandId.slice(6));
    if(saved){
      const per = saved.tracksPerWheel || (saved.towerLength ? roundInt(saved.towerLength / spanWidth) : null);
      return {saved, towerLength:saved.towerLength || null, tracksPerWheel:per && per > 0 ? per : null};
    }
  }
  if(brandId === 'custom') return {saved:null, towerLength:null, tracksPerWheel:null};
  const brand = BRANDS[brandId] || BRANDS.zimmatic;
  return {saved:null, towerLength:brand.length, tracksPerWheel:Math.max(1, roundInt(brand.length / spanWidth))};
}

function calculateWheelRows(area, spanWidth, counts, tracksPerWheel){
  const R = radiusFromArea(area);
  const totalRounded = roundInt(totalTracksExact(area, spanWidth));
  const per = Math.max(1, roundInt(tracksPerWheel || DEFAULT_SPAN_WIDTH / spanWidth));
  const standardCounts = buildStandardCounts(totalRounded, per);
  const manual = Array.isArray(counts) ? counts : [];
  const visible = Math.max(MIN_VISIBLE_WHEELS, standardCounts.length, manual.length);
  const rows = [];

  // Same calculation model as the supplied reference:
  // first determine each wheel's standard Biro area, then derive its
  // area-per-track, and finally multiply by the entered track count.
  let startTrack = 0;
  let enteredTotal = 0;
  for(let idx=0; idx<visible; idx++){
    const standardTracks = standardCounts[idx] || 0;
    const requested = manual[idx] === undefined ? 0 : Math.max(0, roundInt(n(manual[idx])));
    const safeTracks = requested;
    const startDistance = Math.min(startTrack * spanWidth, R);
    const standardEndDistance = Math.min((startTrack + standardTracks) * spanWidth, R);
    const startCum = cumulativeBiroArea(area, R, startDistance);
    const standardEndCum = cumulativeBiroArea(area, R, standardEndDistance);
    const standardArea = Math.max(0, standardEndCum - startCum);
    const areaPerTrack = standardTracks > 0
      ? Math.floor((standardArea / standardTracks + 1e-12) * 10000) / 10000
      : 0;

    const enteredEndDistance = Math.min((startTrack + safeTracks) * spanWidth, R);
    const enteredEndCum = cumulativeBiroArea(area, R, enteredEndDistance);
    const actualArea = Math.max(0, enteredEndCum - startCum);
    const wheelArea = safeTracks >= standardTracks && standardTracks > 0
      ? (safeTracks === standardTracks ? standardArea : actualArea)
      : safeTracks * areaPerTrack;

    enteredTotal += wheelArea;
    rows.push({
      wheel: idx+1,
      tracks: safeTracks,
      requestedTracks: requested,
      maxTracks: standardTracks,
      distance: enteredEndDistance,
      startDistance,
      cumulativeArea: enteredTotal,
      standardArea,
      area: wheelArea,
      areaPerTrack
    });

    // The next wheel starts after the number of tracks actually entered.
    startTrack += safeTracks;
    if(startTrack >= totalRounded) break;
  }
  return rows;
}

function appSnapshot(){
  const area = n(document.getElementById('pivotArea')?.value);
  const spanWidth = n(document.getElementById('spanWidth')?.value) || DEFAULT_SPAN_WIDTH;
  const brandId = document.getElementById('brandSelect')?.value || previousBrand || 'zimmatic';
  const radius = radiusFromArea(area);
  const totalTracksRounded = roundInt(totalTracksExact(area,spanWidth));
  const cfg = getBrandConfig(brandId, spanWidth);
  let counts = buildStandardCounts(totalTracksRounded, cfg.tracksPerWheel || 1);
  let custom = cfg.saved || null;
  if(custom && Array.isArray(custom.userTracks) && custom.userTracks.length){
    counts = buildSavedPatternCounts(custom, totalTracksRounded, spanWidth);
  }
  if(Array.isArray(window.pivotcalcManualTracks)) counts = window.pivotcalcManualTracks.slice();
  const rows = calculateWheelRows(area, spanWidth, counts, cfg.tracksPerWheel || 1);
  const activeCount = rows.reduce((last,r,i)=>r.tracks>0?i:last,-1)+1;
  return {
    area, spanWidth, radius, totalTracksExact: totalTracksExact(area,spanWidth), totalTracksRounded,
    towerLength:cfg.towerLength, tracksPerWheel:cfg.tracksPerWheel, counts, activeCount, rows, custom,
    brandId
  };
}

function normalizeCustomCounts(userTracks, totalTracksRounded){
  const raw = Array.isArray(userTracks) ? userTracks : [];
  const clean = [];
  let used = 0;
  for(let i=0;i<raw.length-1;i++){
    const v = Math.max(0, roundInt(n(raw[i])));
    if(v <= 0) break;
    const maxRemaining = Math.max(0, totalTracksRounded-used);
    const take = Math.min(v, maxRemaining);
    clean.push(take);
    used += take;
    if(used >= totalTracksRounded) break;
  }
  const rem = Math.max(0, totalTracksRounded-used);
  if(rem > 0) clean.push(rem);
  return clean;
}

function loadSavedBrands(){
  try{return JSON.parse(localStorage.getItem('pivotcalc-brands') || '[]') || []}
  catch(e){return []}
}
function saveSavedBrands(list){
  try{localStorage.setItem('pivotcalc-brands',JSON.stringify(list))}catch(e){}
}
function loadSavedBrand(id){
  return loadSavedBrands().find(b=>b.id===id) || null;
}

function plantingResults(){
  const weight = n(document.getElementById("avgJumboWeight")?.value);
  const jumbos = n(document.getElementById("totalJumbos")?.value);
  const area = n(document.getElementById("pivotArea")?.value);
  const qty = weight * jumbos;
  const rate = area > 0 ? qty / area : 0;
  return {weight,jumbos,qty,rate};
}
function harvestResults(){
  const jumbos = n(document.getElementById("harvestedJumbos")?.value);
  const area = n(document.getElementById("pivotArea")?.value);
  return {jumbos,rate:area>0?jumbos/area:0};
}
function plantingNeedsResults(){
  const weight=n(document.getElementById("needWeight")?.value);
  const area=n(document.getElementById("needArea")?.value);
  const rate=n(document.getElementById("needPlantRate")?.value);
  const jumbos=weight>0?(rate*area)/weight:0;
  return {weight,area,rate,jumbos,tons:jumbos*weight};
}
function harvestNeedsResults(){
  const rateTon=n(document.getElementById("needHarvestRateTon")?.value);
  const weight=n(document.getElementById("needHarvestWeight")?.value);
  const mode=document.getElementById("harvestTargetMode")?.value||"jumbos";
  const targetJumbos=n(document.getElementById("targetHarvestJumbos")?.value);
  const targetTrucks=n(document.getElementById("targetHarvestTrucks")?.value);
  const cap=n(document.getElementById("truckCapacity")?.value);
  const jumbos=mode==="trucks" ? targetTrucks*cap : targetJumbos;
  const tons=jumbos*weight;
  const area=rateTon>0 ? tons/rateTon : 0;
  const trucks=mode==="trucks" ? targetTrucks : (cap>0 ? jumbos/cap : 0);
  return {rateTon,weight,mode,targetJumbos,targetTrucks,cap,jumbos,tons,area,trucks};
}
