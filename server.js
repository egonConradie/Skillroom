require("dotenv").config({ quiet: true });
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");

const CATEGORIES = ["Technology", "Craft", "Automotive"];
const MAX_IMAGE = 4 * 1024 * 1024;
function fail(status, message) { return Object.assign(new Error(message), { status }); }
function safeImage(value) {
  if (typeof value !== "string" || value.length > 2048) return false;
  if (/^\/(assets\/images|uploads)\/[a-zA-Z0-9_./-]+$/.test(value) && !value.includes("..")) return true;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; }
}
function validateCourse(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw fail(400, "Submit the course details as an object.");
  const result = {};
  for (const [name, max] of Object.entries({title:120, shortDescription:240, fullDescription:8000, location:180, host:100, availability:60})) {
    if (body[name] !== undefined && typeof body[name] !== "string") throw fail(400, "Please check " + name + ".");
    result[name] = (body[name] || "").trim();
    if (result[name].length > max) throw fail(400, name + " is too long.");
  }
  if (!result.title) throw fail(400, "Give your course a title.");
  if (!CATEGORIES.includes(body.category)) throw fail(400, "Choose a valid category.");
  result.category = body.category;
  if (typeof body.price !== "number" || !Number.isFinite(body.price) || body.price < 0 || body.price > 1000000)
    throw fail(400, "Enter a price between R0 and R1,000,000.");
  result.price = Math.round(body.price * 100) / 100;
  if (typeof body.published !== "boolean") throw fail(400, "Choose draft or published.");
  result.published = body.published;
  result.image = body.image || "/assets/images/robotics.jpg";
  if (typeof result.image === "string" && result.image.startsWith("assets/images/")) result.image = "/" + result.image;
  if (!safeImage(result.image)) throw fail(400, "Use an uploaded image, a site image, or an HTTPS image URL.");
  result.startsAt = body.startsAt || "";
  if (typeof result.startsAt !== "string") throw fail(400, "Enter a valid date and time.");
  if (result.startsAt) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(result.startsAt)) throw fail(400, "Enter a valid date and time.");
    const parsed = new Date(result.startsAt + ":00Z");
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,16) !== result.startsAt)
      throw fail(400, "Enter a valid date and time.");
  }
  if (result.published && (!result.shortDescription || !result.fullDescription || !result.location || !result.host || !result.startsAt))
    throw fail(400, "To publish, add descriptions, a location, a host, and a date and time.");
  result.description = result.fullDescription || result.shortDescription;
  result.initials = result.host.split(/\s+/).filter(Boolean).slice(0,2).map(word=>word[0]).join("").toUpperCase();
  result.status = /almost|^[1-3] spots? left/i.test(result.availability) ? "almost" : "";
  result.date = result.startsAt ? new Intl.DateTimeFormat("en-ZA", { dateStyle:"medium", timeStyle:"short", timeZone:"Africa/Johannesburg" }).format(new Date(result.startsAt + ":00+02:00")) : "Date to be announced";
  return result;
}

// One Node process and a small local JSON catalogue; writes replace the file atomically.
function createApp(options = {}) {
  const app = express();
  const coursesFile = options.coursesFile || path.join(__dirname, "data", "courses.json");
  const uploadsDir = options.uploadsDir || path.join(__dirname, "uploads");
  const config = options.config || process.env;
  if (!config.SESSION_SECRET || !config.ADMIN_EMAIL || !config.ADMIN_PASSWORD_HASH)
    throw new Error("Configure ADMIN_EMAIL, ADMIN_PASSWORD_HASH and SESSION_SECRET in .env before starting.");
  fs.mkdirSync(path.dirname(coursesFile), {recursive:true});
  fs.mkdirSync(uploadsDir, {recursive:true});
  if (!fs.existsSync(coursesFile)) fs.writeFileSync(coursesFile, "[]\n", {flag:"wx"});
  function readCourses() {
    const courses = JSON.parse(fs.readFileSync(coursesFile, "utf8"));
    if (!Array.isArray(courses)) throw new Error("Invalid course catalogue.");
    return courses;
  }
  function saveCourses(courses) {
    const temporary = coursesFile + ".tmp-" + crypto.randomUUID();
    try {
      fs.writeFileSync(temporary, JSON.stringify(courses, null, 2) + "\n");
      fs.renameSync(temporary, coursesFile);
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
  }
  const production = config.NODE_ENV === "production";
  if (production && (config.SESSION_SECRET.length < 32 || /replace|fake/i.test(config.SESSION_SECRET)))
    throw new Error("Production requires a long random SESSION_SECRET.");
  app.disable("x-powered-by");
  if (production) app.set("trust proxy", 1);
  app.use((req,res,next)=>{
    res.setHeader("X-Content-Type-Options","nosniff");
    res.setHeader("Referrer-Policy","strict-origin-when-cross-origin");
    res.setHeader("X-Frame-Options","DENY");
    res.setHeader("Permissions-Policy","camera=(), microphone=(), geolocation=()");
    res.setHeader("Content-Security-Policy","default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self' mailto:");
    if(production) res.setHeader("Strict-Transport-Security","max-age=31536000; includeSubDomains");
    next();
  });
  app.use(express.json({limit:"6mb"}));
  app.use(express.urlencoded({extended:false,limit:"16kb"}));
  app.use(session({
    name:"skillroom.sid", secret:config.SESSION_SECRET, resave:false, saveUninitialized:false,
    cookie:{httpOnly:true,sameSite:"strict",secure:production,maxAge:8*60*60*1000}
  }));
  function sameOrigin(req,res,next) {
    if (req.get("origin") !== req.protocol + "://" + req.get("host"))
      return res.status(403).json({error:"Reload the page and try again."});
    next();
  }
  function admin(req,res,next) {
    res.setHeader("Cache-Control","no-store");
    if (req.session.isAdmin) return next();
    if (req.path.startsWith("/api/")) return res.status(401).json({error:"Please sign in again."});
    return res.redirect("/admin/login");
  }
  function csrf(req,res,next) {
    if (!req.session.csrf || req.get("x-csrf-token") !== req.session.csrf)
      return res.status(403).json({error:"Your session changed. Reload the page and try again."});
    next();
  }
  const sendPage = name => (req,res)=>{
    if(!res.hasHeader("Cache-Control"))
      res.setHeader("Cache-Control",name.endsWith(".html")?"no-cache":"public, max-age=0, must-revalidate");
    res.sendFile(path.join(__dirname,name));
  };
  app.get("/api/health", (req,res)=>res.json({status:"ok",courseManager:true}));
  app.get("/admin/login", (req,res)=>{
    res.setHeader("Cache-Control","no-store");
    if(req.session.isAdmin) return res.redirect("/admin/dashboard");
    res.sendFile(path.join(__dirname,"admin-login.html"));
  });
  const attempts = new Map();
  app.post("/admin/login", sameOrigin, async (req,res,next)=>{
    try {
      const now = Date.now();
      for (const [key,entry] of attempts) if (entry.until < now) attempts.delete(key);
      const key = req.ip;
      const entry = attempts.get(key) || {count:0,until:now+15*60*1000};
      if (entry.count >= 10) return res.status(429).json({error:"Too many attempts. Please try again in 15 minutes."});
      entry.count++; attempts.set(key,entry);
      const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
      const password = typeof req.body.password === "string" ? req.body.password : "";
      const valid = password.length <= 256 && await bcrypt.compare(password, config.ADMIN_PASSWORD_HASH);
      if (email !== config.ADMIN_EMAIL.toLowerCase() || !valid)
        return res.status(401).json({error:"The email or password is incorrect."});
      attempts.delete(key);
      req.session.regenerate(error=>{
        if(error) return next(error);
        req.session.isAdmin=true;
        req.session.csrf=crypto.randomBytes(32).toString("hex");
        req.session.save(error=>error ? next(error) : res.json({redirect:"/admin/dashboard"}));
      });
    } catch(error) {next(error);}
  });
  app.get("/admin/dashboard", admin, sendPage("admin-dashboard.html"));
  app.get("/admin/courses/new", admin, sendPage("admin-course-new.html"));
  app.get("/admin/courses/:id/edit", admin, sendPage("admin-course-new.html"));
  // Old direct filenames also require authentication.
  app.get("/admin-dashboard.html",admin,(req,res)=>res.redirect("/admin/dashboard"));
  app.get("/admin-course-new.html",admin,(req,res)=>res.redirect("/admin/courses/new"));
  app.get("/admin-login.html",(req,res)=>res.redirect("/admin/login"));
  app.get("/api/admin/session",admin,(req,res)=>res.json({csrfToken:req.session.csrf}));
  app.post("/admin/logout",admin,sameOrigin,csrf,(req,res,next)=>{
    req.session.destroy(error=>{
      if(error) return next(error);
      res.clearCookie("skillroom.sid",{path:"/"});
      res.json({redirect:"/admin/login"});
    });
  });
  app.get("/api/courses",(req,res)=>{
    res.setHeader("Cache-Control","no-store");
    res.json(readCourses().filter(course=>course.published === true));
  });
  app.get("/api/admin/courses",admin,(req,res)=>res.json(readCourses()));
  app.get("/api/admin/courses/:id",admin,(req,res)=>{
    const course=readCourses().find(course=>String(course.id)===req.params.id);
    if(!course) throw fail(404,"This course could not be found.");
    res.json(course);
  });
  app.post("/api/admin/courses",admin,sameOrigin,csrf,(req,res)=>{
    const values=validateCourse(req.body);
    const courses=readCourses();
    const now=new Date().toISOString();
    const course={...values,id:crypto.randomUUID(),revision:1,createdAt:now,updatedAt:now};
    courses.unshift(course); saveCourses(courses);
    res.status(201).json(course);
  });
  app.put("/api/admin/courses/:id",admin,sameOrigin,csrf,(req,res)=>{
    const courses=readCourses();
    const index=courses.findIndex(course=>String(course.id)===req.params.id);
    if(index<0) throw fail(404,"This course could not be found.");
    if(req.body.revision !== courses[index].revision) throw fail(409,"This course changed in another window. Reopen it before saving.");
    const values=validateCourse(req.body);
    courses[index]={...courses[index],...values,revision:courses[index].revision+1,updatedAt:new Date().toISOString()};
    saveCourses(courses); res.json(courses[index]);
  });
  app.delete("/api/admin/courses/:id",admin,sameOrigin,csrf,(req,res)=>{
    const courses=readCourses();
    const index=courses.findIndex(course=>String(course.id)===req.params.id);
    if(index<0) throw fail(404,"This course could not be found.");
    if(req.body.revision !== courses[index].revision) throw fail(409,"This course changed in another window. Reopen it before deleting.");
    courses.splice(index,1); saveCourses(courses);
    res.status(204).end();
  });
  app.post("/api/admin/images",admin,sameOrigin,csrf,(req,res)=>{
    const data=req.body.data;
    if(typeof data !== "string") throw fail(400,"Choose a PNG, JPEG or WebP image.");
    const match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(data);
    if(!match) throw fail(400,"Choose a PNG, JPEG or WebP image.");
    const bytes=Buffer.from(match[2],"base64");
    if(!bytes.length || bytes.length>MAX_IMAGE) throw fail(400,"Choose an image smaller than 4 MB.");
    const valid=match[1]==="png" ? bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) :
      match[1]==="jpeg" ? bytes[0]===255 && bytes[1]===216 && bytes[2]===255 :
      bytes.toString("ascii",0,4)==="RIFF" && bytes.toString("ascii",8,12)==="WEBP";
    if(!valid) throw fail(400,"The file does not match its image type.");
    const filename=crypto.randomUUID()+"."+ (match[1]==="jpeg"?"jpg":match[1]);
    fs.writeFileSync(path.join(uploadsDir,filename),bytes,{flag:"wx"});
    res.status(201).json({image:"/uploads/"+filename});
  });
  // Only public assets and known pages are exposed, never the project directory.
  app.use("/assets",express.static(path.join(__dirname,"assets"),{dotfiles:"deny"}));
  app.use("/uploads",express.static(uploadsDir,{dotfiles:"deny",index:false}));
  for(const name of ["styles.css","app.js","course-ui.js","admin.css","admin.js","admin-login.js"]) app.get("/"+name,sendPage(name));
  app.get("/",sendPage("index.html"));
  for(const name of ["index.html","gallery.html","about.html","how-we-work.html","for-business.html","contact.html"]) app.get("/"+name,sendPage(name));
  app.use((req,res)=>res.status(404).send("Page not found."));
  app.use((error,req,res,next)=>{
    const status=error.status || 500;
    if(status>=500) console.error("Course manager request failed:", error.message);
    res.status(status).json({error:status===413?"That file is too large. Choose an image smaller than 4 MB.":status>=500?"We could not save or load your courses. Please try again.":error.message});
  });
  return app;
}
if(require.main===module) {
  const app=createApp();
  app.listen(Number(process.env.PORT)||3000,()=>console.log("SkillRoom ready at http://localhost:"+(process.env.PORT||3000)));
}
module.exports={createApp};
