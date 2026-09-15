(() => {
  let csrfToken="", current=null, dirty=false, uploading=false, uploadVersion=0;
  const page=document.querySelector("[data-page]").dataset.page;
  const message=document.querySelector("#pageMessage");
  const form=document.querySelector("#courseForm");
  function showError(text) {message.textContent=text;message.hidden=false;}
  async function api(url,options={}) {
    const response=await fetch(url,{...options,headers:{"Content-Type":"application/json","X-CSRF-Token":csrfToken,...options.headers}});
    if(response.status===204) return null;
    const data=await response.json();
    if(!response.ok) throw new Error(response.status===401 ? "Your session expired. Sign in again in another tab, then reload this page after copying any unsaved text." : data.error||"Something went wrong. Please try again.");
    return data;
  }
  document.querySelector("#logoutButton").addEventListener("click",async ()=>{
    if(dirty&&!confirm("You have unsaved changes. Sign out without saving?")) return;
    try {await api("/admin/logout",{method:"POST"});dirty=false;location.assign("/admin/login");} catch(error){showError(error.message);}
  });
  async function dashboard() {
    let courses=[],category="All";
    const grid=document.querySelector("#adminCourseGrid");
    const search=document.querySelector("#adminSearch");
    const status=document.querySelector("#statusFilter");
    const addCard='<a class="add-course-card" href="/admin/courses/new"><span class="add-course-icon" aria-hidden="true">+</span><strong>Add a new course</strong><span>Share a skill.<br>Create an opportunity.</span><span class="add-course-link">Let’s build it →</span></a>';
    function render() {
      const query=search.value.trim().toLowerCase();
      const filtered=courses.filter(course=>(category==="All"||course.category===category)&&
        (status.value==="all"||(status.value==="published"?course.published:!course.published))&&
        (!query||[course.title,course.host,course.location].join(" ").toLowerCase().includes(query)));
      grid.innerHTML=addCard+filtered.map(course=>CourseUI.card(course,{admin:true})).join("");
      document.querySelector("#courseCount").textContent=filtered.length+" courses · "+courses.filter(c=>c.published).length+" published · "+courses.filter(c=>!c.published).length+" drafts";
    }
    async function load() {
      message.hidden=true;document.querySelector("#retryButton").hidden=true;
      try {courses=await api("/api/admin/courses");render();}
      catch(error){showError(error.message);document.querySelector("#courseCount").textContent="Could not load your courses.";document.querySelector("#retryButton").hidden=false;}
    }
    document.querySelector("#retryButton").addEventListener("click",load);
    document.querySelectorAll("[data-category]").forEach(button=>button.addEventListener("click",()=>{
      category=button.dataset.category;
      document.querySelectorAll("[data-category]").forEach(item=>{const active=item===button;item.classList.toggle("is-active",active);item.setAttribute("aria-pressed",String(active));});
      render();
    }));
    search.addEventListener("input",render);status.addEventListener("change",render);
    await load();
  }
  function values() {
    const data=Object.fromEntries(new FormData(form));
    return {...data,price:Number(data.price),published:form.elements.published.checked,image:data.image.trim()||"/assets/images/robotics.jpg"};
  }
  function updatePreview() {
    const course=values();
    course.status=/almost|^[1-3] spots? left/i.test(course.availability)?"almost":"";
    document.querySelector("#coursePreview").innerHTML=CourseUI.card(course,{preview:true});
    document.querySelector("#previewDescription").textContent=course.shortDescription||"Your introduction will appear here as you write.";
    document.querySelector("#saveButton").textContent=course.published?"Save & publish":"Save draft";
    const badge=document.querySelector("#editorStatus");
    badge.textContent=dirty?"Unsaved changes":current?(current.published?"Published":"Draft"):"New draft";
    badge.classList.toggle("is-published",!dirty&&!!current?.published);
    for(const name of ["shortDescription","fullDescription","location","host","startsAt"]) form.elements[name].required=course.published;
  }
  function lockForm(locked) {form.querySelectorAll("fieldset").forEach(field=>field.disabled=locked);}
  async function editor() {
    const match=location.pathname.match(/^\/admin\/courses\/([^/]+)\/edit$/);
    if(match) {
      current=await api("/api/admin/courses/"+encodeURIComponent(decodeURIComponent(match[1])));
      for(const name of ["title","category","shortDescription","fullDescription","price","startsAt","location","host","availability","image"])
        form.elements[name].value=current[name]??"";
      form.elements.published.checked=!!current.published;
      document.querySelector("#editorTitle").textContent="Make your course shine.";
      document.querySelector("#deleteButton").hidden=false;
    } else form.elements.image.value="/assets/images/robotics.jpg";
    lockForm(false);
    updatePreview();
    form.addEventListener("input",()=>{dirty=true;updatePreview();document.querySelector("#saveMessage").textContent="";});
    form.addEventListener("change",updatePreview);
    form.querySelectorAll("[data-image]").forEach(button=>button.addEventListener("click",()=>{
      if(uploading) return;
      form.elements.image.value=button.dataset.image;form.elements.imageFile.value="";dirty=true;
      document.querySelector("#uploadStatus").textContent="Site image selected.";updatePreview();
    }));
    form.elements.imageFile.addEventListener("change",async event=>{
      const file=event.target.files[0];if(!file) return;
      const status=document.querySelector("#uploadStatus");
      if(!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>4*1024*1024) {
        status.textContent="Please choose a PNG, JPEG or WebP smaller than 4 MB.";event.target.value="";return;
      }
      const version=++uploadVersion;
      uploading=true;event.target.disabled=true;document.querySelector("#saveButton").disabled=true;status.textContent="Uploading your image…";
      try {
        const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error("Could not read that image."));reader.readAsDataURL(file);});
        const picture=new Image();picture.src=data;await picture.decode();
        if(!picture.naturalWidth||picture.naturalWidth>12000||picture.naturalHeight>12000) throw new Error("Choose an image no larger than 12,000 pixels on either side.");
        const result=await api("/api/admin/images",{method:"POST",body:JSON.stringify({data})});
        if(version!==uploadVersion)return;
        form.elements.image.value=result.image;dirty=true;updatePreview();status.textContent="Image uploaded. Save your course to use it.";
      } catch(error) {status.textContent=error.message||"Could not upload this image. Try a different file.";}
      finally {if(version===uploadVersion){uploading=false;event.target.disabled=false;document.querySelector("#saveButton").disabled=false;}}
    });
    form.addEventListener("submit",async event=>{
      event.preventDefault();if(uploading)return;
      const payload=values();
      if(current) payload.revision=current.revision;
      message.hidden=true;
      lockForm(true);document.querySelector("#saveMessage").textContent="Saving your course…";
      try {
        current=await api(current?"/api/admin/courses/"+encodeURIComponent(current.id):"/api/admin/courses",{
          method:current?"PUT":"POST",body:JSON.stringify(payload)
        });
        dirty=false;
        history.replaceState(null,"","/admin/courses/"+encodeURIComponent(current.id)+"/edit");
        document.querySelector("#editorTitle").textContent="Make your course shine.";
        document.querySelector("#deleteButton").hidden=false;
        document.querySelector("#saveMessage").textContent=current.published?"Saved and published. Your course is now on the website.":"Draft saved. Only you can see this course.";
      } catch(error){showError(error.message);document.querySelector("#saveMessage").textContent="Not saved. Your details are still here.";message.scrollIntoView({behavior:"smooth",block:"center"});}
      finally{lockForm(false);updatePreview();}
    });
    document.querySelector("#deleteButton").addEventListener("click",async ()=>{
      if(!current||!confirm('Delete "'+current.title+'"? This removes it from your courses and the public website.'))return;
      lockForm(true);
      try{await api("/api/admin/courses/"+encodeURIComponent(current.id),{method:"DELETE",body:JSON.stringify({revision:current.revision})});dirty=false;location.assign("/admin/dashboard");}
      catch(error){showError(error.message);lockForm(false);}
    });
    window.addEventListener("beforeunload",event=>{if(dirty){event.preventDefault();event.returnValue="";}});
  }
  async function init() {
    if(form)lockForm(true);
    try {
      const response=await fetch("/api/admin/session");
      if(response.status===401){location.replace("/admin/login");return;}
      if(!response.ok)throw new Error("Could not connect. Reload to try again.");
      csrfToken=(await response.json()).csrfToken;
      if(page==="dashboard")await dashboard();else await editor();
    }catch(error){showError(error.message);}
  }
  init();
})();
