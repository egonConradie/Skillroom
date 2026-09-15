document.querySelector("#adminLoginForm").addEventListener("submit",async event=>{
  event.preventDefault();
  const form=event.currentTarget,button=form.querySelector("button"),message=document.querySelector("#loginMessage");
  button.disabled=true;message.hidden=true;
  try {
    const response=await fetch("/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(Object.fromEntries(new FormData(form)))});
    const data=await response.json();
    if(!response.ok) throw new Error(data.error || "Unable to sign in.");
    location.assign(data.redirect);
  } catch(error) {message.textContent=error.message;message.hidden=false;}
  finally {button.disabled=false;}
});
