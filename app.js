let workshops = [];
let loadError = false;
let saved = [];
try { saved = JSON.parse(localStorage.getItem("skillroomSaved") || "[]"); } catch {}
const state = {category:"All",search:"",saved:new Set(Array.isArray(saved)?saved.map(String):[]),activeModal:null,lastFocused:null};
let activeCourse=null;
const grid=document.querySelector("#workshops");
const resultsNote=document.querySelector("#resultsNote");
const emptyState=document.querySelector("#emptyState");
const backdrop=document.querySelector("#modalBackdrop");
const focusableSelector='button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
const workshopCacheKey="skillroomPublicWorkshopsV1";
function renderWorkshops() {
  if(loadError) return;
  const query=state.search.trim().toLowerCase();
  const filtered=workshops.filter(course=>(state.category==="All"||course.category===state.category)&&
    (!query||[course.title,course.location,course.host].join(" ").toLowerCase().includes(query)));
  grid.innerHTML=filtered.map(course=>CourseUI.card(course,{saved:state.saved.has(String(course.id))})).join("");
  grid.hidden=!filtered.length; emptyState.hidden=!!filtered.length;
  resultsNote.textContent=filtered.length+" "+(filtered.length===1?"workshop":"workshops")+" shown"+(state.category==="All"?"":" in "+state.category);
}
async function loadWorkshops() {
  loadError=false;
  resultsNote.textContent="Loading workshops…";
  grid.setAttribute("aria-busy","true");
  emptyState.hidden=true;
  try {
    let data;
    for(let attempt=0;attempt<2;attempt++) {
      try {
        const response=await fetch("/api/courses",{cache:"no-store",headers:{Accept:"application/json"}});
        if(!response.ok) throw new Error("Workshop request failed");
        data=await response.json();
        if(!Array.isArray(data)) throw new Error("Invalid workshop response");
        break;
      } catch(error) {
        if(attempt) throw error;
        await new Promise(resolve=>setTimeout(resolve,300));
      }
    }
    workshops=data;
    try { localStorage.setItem(workshopCacheKey,JSON.stringify(data)); } catch {}
    emptyState.querySelector("h3").textContent="More practical skills are on the way";
    emptyState.querySelector("p").textContent="There are no live workshops matching this filter yet. Try another category or clear your search.";
    document.querySelector("#clearFiltersButton").textContent="View all workshops";
    renderWorkshops();
  } catch {
    let cached=[];
    try { cached=JSON.parse(localStorage.getItem(workshopCacheKey)||"[]"); } catch {}
    if(Array.isArray(cached)&&cached.length) {
      workshops=cached; loadError=false; renderWorkshops();
      resultsNote.textContent=cached.length+" workshops shown · saved copy";
    } else {
      loadError=true; grid.hidden=true; emptyState.hidden=false;
      resultsNote.textContent="Workshops are temporarily unavailable.";
      emptyState.querySelector("h3").textContent="We couldn't load the workshops";
      emptyState.querySelector("p").textContent="Please check your connection and try again.";
      document.querySelector("#clearFiltersButton").textContent="Try again";
    }
  } finally {grid.removeAttribute("aria-busy");}
}
function setCategory(category) {
  state.category=category;
  document.querySelectorAll("[data-category]").forEach(button=>{
    const active=button.dataset.category===category;
    button.classList.toggle("is-active",active);
    button.setAttribute("aria-pressed",String(active));
  });
  renderWorkshops();
}
function openModal(id,trigger=document.activeElement) {
  closeModal(false);
  state.activeModal=document.getElementById(id); state.lastFocused=trigger;
  backdrop.hidden=false; state.activeModal.hidden=false; document.body.style.overflow="hidden";
  state.activeModal.querySelector(focusableSelector)?.focus();
}
function closeModal(restore=true) {
  if(!state.activeModal) return;
  state.activeModal.hidden=true; backdrop.hidden=true; document.body.style.overflow="";
  state.activeModal=null; if(restore) state.lastFocused?.focus();
}
function openWorkshop(id,trigger) {
  const course=workshops.find(item=>String(item.id)===String(id));
  if(!course) return;
  activeCourse=course;
  document.querySelector("#modalWorkshopImage").src=CourseUI.image(course.image);
  document.querySelector("#modalWorkshopImage").alt=course.title+" workshop";
  const category=document.querySelector("#modalWorkshopCategory");
  category.textContent=course.category; category.className="stamp "+(course.category==="Craft"?"craft":"");
  for(const [key,value] of Object.entries({Availability:course.availability||"",Title:course.title,Description:course.fullDescription||course.description||course.shortDescription,Date:CourseUI.date(course),Location:course.location,Host:course.host,Price:CourseUI.money(course.price)+" per person"}))
    document.querySelector("#modalWorkshop"+key).textContent=value;
  const sections=CourseUI.details(course);
  for(const [name,items] of Object.entries({Needs:sections.needs,Includes:sections.includes,Breakdown:sections.breakdown})) {
    const list=document.querySelector("#modalWorkshop"+name); list.innerHTML=items.map(item=>`<li>${CourseUI.escape(item)}</li>`).join("");
  }
  openModal("workshopModal",trigger);
}
function showToast(message) {
  const toast=document.querySelector("#toast"); toast.textContent=message; toast.hidden=false;
  clearTimeout(showToast.timer); showToast.timer=setTimeout(()=>toast.hidden=true,3000);
}
document.addEventListener("click",event=>{
  const category=event.target.closest("[data-category]"); if(category) setCategory(category.dataset.category);
  const save=event.target.closest("[data-save]");
  if(save) {
    const id=save.dataset.save;
    state.saved.has(id)?state.saved.delete(id):state.saved.add(id);
    try {localStorage.setItem("skillroomSaved",JSON.stringify([...state.saved]));} catch {}
    renderWorkshops(); showToast(state.saved.has(id)?"Workshop saved":"Workshop removed from saved"); return;
  }
  const card=event.target.closest(".workshop-card"); if(card) openWorkshop(card.dataset.id,card);
  if(event.target.closest("[data-close-modal]")||event.target===backdrop) closeModal();
  const interest=event.target.closest("[data-interest]");
  if(interest) showToast("Contact hello@skillroom.co.za to register your interest.");
});
grid.addEventListener("keydown",event=>{
  if(event.target.closest("button")) return;
  const card=event.target.closest(".workshop-card");
  if(card&&(event.key==="Enter"||event.key===" ")) {event.preventDefault();openWorkshop(card.dataset.id,card);}
});
document.querySelector("#searchInput").addEventListener("input",event=>{state.search=event.target.value;renderWorkshops();});
document.querySelector("#clearFiltersButton").addEventListener("click",()=>{
  if(loadError) return loadWorkshops();
  document.querySelector("#searchInput").value="";state.search="";setCategory("All");
});
document.querySelector("#signInButton").addEventListener("click",()=>location.href="/admin/login");
for(const id of ["hostButton","footerHostButton"]) document.getElementById(id).addEventListener("click",event=>openModal("hostModal",event.currentTarget));
document.querySelector("#menuButton").addEventListener("click",event=>{
  const open=document.querySelector(".sidebar").classList.toggle("is-open");
  event.currentTarget.setAttribute("aria-expanded",String(open));
});
document.querySelector("#reserveButton").addEventListener("click",()=>{
  if(!activeCourse) return;
  const subject=encodeURIComponent("Workshop booking: "+activeCourse.title);
  const body=encodeURIComponent("Hello Skillroom,\n\nI would like to book "+activeCourse.title+" in "+activeCourse.location+" on "+CourseUI.date(activeCourse)+".\n\nMy name:\nNumber of places:\nContact number:\n");
  window.location.href="mailto:hello@skillroom.co.za?subject="+subject+"&body="+body;
});
document.querySelector("#hostForm").addEventListener("submit",event=>{
  event.preventDefault();
  const fields=event.currentTarget.querySelectorAll("input,textarea");
  const subject=encodeURIComponent("Workshop host enquiry");
  const body=encodeURIComponent("Name: "+fields[0].value+"\nEmail: "+fields[1].value+"\n\nWorkshop idea:\n"+fields[2].value);
  window.location.href="mailto:hello@skillroom.co.za?subject="+subject+"&body="+body;
});
document.addEventListener("keydown",event=>{
  if(event.key==="Escape") closeModal();
  if(event.key==="Tab"&&state.activeModal) {
    const items=[...state.activeModal.querySelectorAll(focusableSelector)].filter(el=>!el.disabled);
    const first=items[0],last=items.at(-1);
    if(event.shiftKey&&document.activeElement===first) {event.preventDefault();last?.focus();}
    if(!event.shiftKey&&document.activeElement===last) {event.preventDefault();first?.focus();}
  }
});
window.addEventListener("online",()=>loadWorkshops());
loadWorkshops();
