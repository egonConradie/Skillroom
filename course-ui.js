/* One renderer keeps the editor preview, admin cards and public cards in sync. */
window.CourseUI = (() => {
  const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const money = value => new Intl.NumberFormat("en-ZA",{style:"currency",currency:"ZAR",maximumFractionDigits:2}).format(Number(value)||0);
  function image(value) {
    if (typeof value === "string" && value.startsWith("assets/images/")) value = "/" + value;
    if (/^\/(?:assets\/images|uploads)\/[a-zA-Z0-9_./-]+$/.test(value || "") && !value.includes("..")) return value;
    try { const url=new URL(value); if(url.protocol==="https:" && !url.username && !url.password) return url.href; } catch {}
    return "/assets/images/robotics.jpg";
  }
  function date(course) {
    if(course.date) return course.date;
    if(!course.startsAt) return "Date to be announced";
    const value=new Date(course.startsAt+":00+02:00");
    return Number.isFinite(value.getTime()) ? new Intl.DateTimeFormat("en-ZA",{dateStyle:"medium",timeStyle:"short",timeZone:"Africa/Johannesburg"}).format(value) : "Date to be announced";
  }
  function list(value, fallback) {
    const values = Array.isArray(value) ? value : String(value || "").split(/[\n,|]/).map(item=>item.trim()).filter(Boolean);
    return values.length ? values.slice(0,6) : fallback;
  }
  function details(course) {
    const technology = course.category === "Technology";
    return {
      needs: list(course.whatYouNeed || course.needs, technology ? ["No previous experience", "A curious, hands-on mindset", "Comfortable clothes"] : ["No previous experience", "A curious, creative mindset", "Comfortable clothes"]),
      includes: list(course.whatsIncluded || course.included, technology ? ["All tools and materials", "Guided practical instruction", "Take-home project"] : ["All tools and materials", "Guided practical instruction", "Take-home piece"]),
      breakdown: list(course.courseBreakdown || course.breakdown, technology ? ["Welcome and fundamentals", "Guided build session", "Test, troubleshoot and take home"] : ["Materials and technique demo", "Guided making session", "Finish, share and take home"])
    };
  }
  function card(course, {admin=false,preview=false,saved=false}={}) {
    const id=escape(course.id);
    const title=escape(course.title || "Your course title");
    const craft=course.category==="Craft";
    const host=course.host || "Your host";
    const initials=course.initials || host.split(/\s+/).slice(0,2).map(v=>v[0]||"").join("").toUpperCase();
    const inner=`
      <div class="card-image">
        <img src="${escape(image(course.image))}" alt="${title} workshop" loading="lazy" />
        ${!admin&&!preview ? `<button class="save-button ${saved?"is-saved":""}" data-save="${id}" aria-label="${saved?"Remove":"Save"} ${title}" aria-pressed="${saved}">${saved?"♥":"♡"}</button>` : ""}
        <span class="stamp ${craft?"craft":""}">${escape(course.category==="Technology"?"Tech":course.category||"Tech")}</span>
        ${course.availability ? `<span class="availability ${course.status==="almost"?"almost":""}">${escape(course.availability)}</span>` : ""}
      </div>
      <div class="card-body">
        <h3>${title}</h3>
        <div class="host-line"><span class="host-avatar">${escape(initials)}</span><span><small>Hosted by</small><strong>${escape(host)}</strong></span></div>
        <p class="card-summary">${escape(course.shortDescription || course.description || "A practical, welcoming workshop built around doing.")}</p>
        <div class="card-meta">
          <span><b aria-hidden="true">▣</b>${escape(date(course))}</span>
          <span class="card-bottom"><span><b aria-hidden="true">⌖</b>${escape(course.location||"Your location")}</span><strong class="price">${escape(money(course.price))}</strong></span>
        </div>
        ${!admin&&!preview ? `<div class="card-discover">Explore workshop <span aria-hidden="true">↗</span></div>` : ""}
        ${admin ? `<div class="admin-card-foot"><span class="publish-badge ${course.published?"is-published":""}">${course.published?"Published":"Draft"}</span><span>Edit course ↗</span></div>` : ""}
      </div>`;
    if(admin) return `<a class="workshop-card admin-course-card" href="/admin/courses/${encodeURIComponent(course.id)}/edit" aria-label="Edit ${title}">${inner}</a>`;
    return `<article class="workshop-card" ${preview ? "" : `data-id="${id}" tabindex="0" aria-label="View ${title}"`}>${inner}</article>`;
  }
  document.addEventListener("error", event=>{
    if(event.target instanceof HTMLImageElement && event.target.getAttribute("src")!=="/assets/images/robotics.jpg") event.target.src="/assets/images/robotics.jpg";
  },true);
  return {escape,money,image,date,details,card};
})();
