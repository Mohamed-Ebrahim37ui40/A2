// main.js — bootstrap and event wiring.
function persistInputValues(){
  const ids=["pivotArea","spanWidth","avgJumboWeight","totalJumbos","harvestedJumbos","needWeight","needArea","needPlantRate","needHarvestRateTon","needHarvestWeight","harvestTargetMode","targetHarvestJumbos","targetHarvestTrucks","truckCapacity","designName"];
  const data={};ids.forEach(id=>{const el=document.getElementById(id);if(el)data[id]=el.value});
  try{localStorage.setItem("pivotcalc-inputs",JSON.stringify(data))}catch(e){}
}
function restoreInputValues(){
  try{const data=JSON.parse(localStorage.getItem("pivotcalc-inputs")||"{}");Object.entries(data).forEach(([id,v])=>{const el=document.getElementById(id);if(el&&v!==undefined)el.value=v})}catch(e){}
}
function validateAndRender(){
  const area=n(document.getElementById("pivotArea").value),span=n(document.getElementById("spanWidth").value);
  if(area<=0){document.getElementById("pivotArea").setCustomValidity(t("minArea"));document.getElementById("radiusOut").textContent="—";return false}
  document.getElementById("pivotArea").setCustomValidity("");
  if(span<=0){document.getElementById("spanWidth").setCustomValidity(t("minSpan"));return false}
  document.getElementById("spanWidth").setCustomValidity("");renderAll();persistInputValues();return true;
}
function setupInstallButton(){
  let deferred=null;
  const btn=document.getElementById("installBtn");
  const overlay=document.getElementById("installOverlay");
  const status=document.getElementById("installStatus");
  const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone=()=>window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone===true;
  const openHelp=()=>{
    if(!overlay)return;
    if(status){
      if(isStandalone()) status.textContent=currentLang==="ar"?"✓ التطبيق يعمل الآن كتطبيق مستقل.":"✓ PivotCalc is already running as a standalone app.";
      else if(deferred) status.textContent=currentLang==="ar"?"التثبيت الجاهز متاح الآن — اضغط الزر مرة أخرى للمتابعة.":"The install prompt is ready — use the button again to continue.";
      else if(isIOS) status.textContent=currentLang==="ar"?"على iPhone/iPad استخدم Safari ثم مشاركة ← إضافة إلى الشاشة الرئيسية.":"On iPhone/iPad use Safari, then Share → Add to Home Screen.";
      else status.textContent=currentLang==="ar"?"لم يظهر طلب التثبيت التلقائي في هذا المتصفح. استخدم «تثبيت التطبيق» من قائمة Chrome أو Edge.":"The browser did not expose the automatic install prompt. Use “Install app” from the Chrome or Edge menu.";
    }
    openModal("installOverlay");
  };
  if(btn){
    btn.addEventListener("click",async()=>{
      if(deferred){
        const prompt=deferred;
        deferred=null;
        try{await prompt.prompt();}catch(e){}
        return;
      }
      openHelp();
    });
  }
  window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferred=e;if(btn)btn.classList.add("install-ready");if(status)status.textContent=currentLang==="ar"?"التثبيت متاح الآن.":"Installation is available now.";});
  window.addEventListener("appinstalled",()=>{deferred=null;if(btn){btn.classList.remove("install-ready");btn.textContent="✓ "+(currentLang==="ar"?"تم التثبيت":"Installed")}if(status)status.textContent=currentLang==="ar"?"✓ تم تثبيت PivotCalc كتطبيق.":"✓ PivotCalc was installed as an app.";});
}
function initTabs(){document.querySelectorAll(".tab").forEach(btn=>btn.addEventListener("click",()=>{document.querySelectorAll(".tab").forEach(x=>{x.classList.remove("active");x.setAttribute("aria-selected","false")});document.querySelectorAll(".tab-panel").forEach(x=>x.classList.remove("active"));btn.classList.add("active");btn.setAttribute("aria-selected","true");document.getElementById(btn.dataset.tab).classList.add("active")}))}
function openSaveBox(){document.getElementById("savedDesignsList")?.scrollIntoView({behavior:"smooth",block:"center"});document.getElementById("designName")?.focus()}
function init(){
  restoreInputValues();loadManualTracks();renderBrandOptions();
  const sel=document.getElementById("brandSelect");if([...sel.options].some(o=>o.value===previousBrand))sel.value=previousBrand;else sel.value="zimmatic";
  if(!Array.isArray(window.pivotcalcManualTracks)){autoFillMain()}else{ensureVisibleRows();renderAll()}
  applyTheme();applyLanguage();initTabs();setupInstallButton();

  document.getElementById("langBtn").addEventListener("click",()=>{currentLang=currentLang==="ar"?"en":"ar";localStorage.setItem("pivotcalc-lang",currentLang);applyLanguage();persistInputValues()});
  document.getElementById("themeBtn").addEventListener("click",()=>{currentTheme=currentTheme==="dark"?"light":"dark";localStorage.setItem("pivotcalc-theme",currentTheme);applyTheme()});
  document.getElementById("ideaBtn").addEventListener("click",()=>{document.getElementById("infoTitle").textContent=t("ideaTitle");document.getElementById("infoBody").innerHTML=`<p>${t("customExplain")}</p>${I18N[currentLang].infoBody}`;openModal("infoOverlay")});
  document.getElementById("aboutBtn").addEventListener("click",showInfo);document.getElementById("verseBtn").addEventListener("click",()=>openModal("verseOverlay"));
  document.querySelectorAll("[data-close]").forEach(btn=>btn.addEventListener("click",()=>closeModal(btn.dataset.close)));
  document.querySelectorAll(".modal-overlay").forEach(overlay=>overlay.addEventListener("click",e=>{if(e.target===overlay)closeModal(overlay.id)}));
  document.addEventListener("keydown",e=>{if(e.key==="Escape")document.querySelectorAll(".modal-overlay.active").forEach(x=>closeModal(x.id))});

  document.getElementById("pivotArea").addEventListener("input",()=>{
    if(window.pivotcalcManualTracksSource==="auto") autoFillMain();
    else { validateAndRender(); renderCustomGrid(); }
  });
  document.getElementById("spanWidth").addEventListener("input",()=>{validateAndRender();renderCustomGrid()});
  ["avgJumboWeight","totalJumbos","harvestedJumbos","needWeight","needArea","needPlantRate","needHarvestRateTon","needHarvestWeight","harvestTargetMode","targetHarvestJumbos","targetHarvestTrucks","truckCapacity"].forEach(id=>document.getElementById(id).addEventListener("input",()=>{renderPlanting();renderHarvest();renderNeeds();persistInputValues()}));
  document.getElementById("harvestTargetMode").addEventListener("change",()=>{renderNeeds();persistInputValues()});

  document.getElementById("brandSelect").addEventListener("change",()=>{
    const v=document.getElementById("brandSelect").value;
    if(v==="custom"){document.getElementById("brandSelect").value=previousBrand;openCustom();return}
    previousBrand=v;localStorage.setItem("pivotcalc-brand",v);
    const saved=v.startsWith("saved:")?loadSavedBrands().find(x=>x.id===v.slice(6)):null;
    autoFillMain();
  });

  document.getElementById("autoFillBtn").addEventListener("click",()=>{if(validateAndRender())autoFillMain()});
  document.getElementById("clearAreaBtn").addEventListener("click",clearMain);
  document.getElementById("saveDesignBtn").addEventListener("click",openSaveBox);
  document.getElementById("saveDesignBtn2").addEventListener("click",()=>{if(validateAndRender())saveCurrentDesign()});
  document.getElementById("newDesignBtn")?.addEventListener("click",startNewDesign);
  document.getElementById("designName").addEventListener("input",persistInputValues);

  document.getElementById("customMode").addEventListener("change",()=>{customMode=document.getElementById("customMode").value;renderCustomGrid()});
  document.getElementById("customAutoBtn").addEventListener("click",customAutoFill);document.getElementById("customClearBtn").addEventListener("click",customClear);document.getElementById("saveCustomBtn").addEventListener("click",saveCustom);document.getElementById("deleteCustomBtn").addEventListener("click",deleteCustom);
  document.getElementById("closeCustomBtn").addEventListener("click",()=>closeModal("customOverlay"));document.getElementById("cancelCustomBtn").addEventListener("click",()=>closeModal("customOverlay"));

  const editId=localStorage.getItem("pivotcalc-editing-design");if(editId){const d=loadSavedDesigns().find(x=>x.id===editId);if(d){editingDesignId=d.id;document.getElementById("designName").value=d.name;document.getElementById("editingDesignLabel").textContent=`${t("editingNow")} ${d.name}`}}
  renderAll();renderSavedDesigns();persistInputValues();
}
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
document.addEventListener("DOMContentLoaded",init);
