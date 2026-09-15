const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const bcrypt=require('bcryptjs');
const {createApp}=require('../server');

test('Shared cards safely render course content and preserve legacy images',()=>{
  const vm=require('node:vm');
  const context={window:{},document:{addEventListener(){}},URL,Intl};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../course-ui.js'),'utf8'),context);
  const html=context.window.CourseUI.card({id:'test',title:'<img src=x onerror=alert(1)>',host:'<script>alert(1)</script>',image:'javascript:alert(1)',category:'Craft'});
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img src=x'));
  assert.ok(!html.includes('javascript:'));
  assert.ok(html.includes('&lt;img'));
  assert.equal(context.window.CourseUI.image('assets/images/pottery.jpg'),'/assets/images/pottery.jpg');
});

test('Course manager: authentication, permissions, CRUD, uploads and persistence',async t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'skillroom-test-'));
  const config={ADMIN_EMAIL:'test@example.com',ADMIN_PASSWORD_HASH:bcrypt.hashSync('Test-only-passphrase-42',4),SESSION_SECRET:'test-only-session-secret-32-characters'};
  const options={config,coursesFile:path.join(directory,'courses.json'),uploadsDir:path.join(directory,'uploads')};
  const server=createApp(options).listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  let cookie='',token='';
  async function request(url,{method='GET',body,authenticated=true,origin=base,csrf=true}={}) {
    return fetch(base+url,{method,redirect:'manual',headers:{'Content-Type':'application/json',Origin:origin,...(authenticated?{Cookie:cookie}:{}),...(csrf?{'X-CSRF-Token':token}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  }
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));fs.rmSync(directory,{recursive:true,force:true});});
  await t.test('private routes and files are protected',async()=>{
    for(const url of ['/','/gallery.html','/how-we-work.html','/for-business.html','/contact.html']) {
      const page=await request(url);
      assert.equal(page.status,200,url);
      assert.match(page.headers.get('content-security-policy'),/default-src 'self'/);
    }
    assert.equal((await request('/api/admin/courses')).status,401);
    assert.equal((await request('/admin/dashboard')).status,302);
    assert.equal((await request('/admin-dashboard.html')).status,302);
    for(const url of ['/data/courses.json','/server.js','/.env','/.git/config','/package.json']) assert.equal((await request(url)).status,404,url);
    assert.deepEqual(await (await request('/api/courses')).json(),[]);
  });
  await t.test('login rejects bad credentials and creates a server session',async()=>{
    assert.equal((await request('/admin/login',{method:'POST',body:{email:config.ADMIN_EMAIL,password:'wrong'}})).status,401);
    const response=await request('/admin/login',{method:'POST',body:{email:config.ADMIN_EMAIL,password:'Test-only-passphrase-42'}});
    assert.equal(response.status,200);
    cookie=response.headers.get('set-cookie').split(';')[0];
    assert.match(response.headers.get('set-cookie'),/HttpOnly/);
    assert.match(response.headers.get('set-cookie'),/SameSite=Strict/);
    token=(await (await request('/api/admin/session')).json()).csrfToken;
    assert.ok(token);
    assert.equal((await request('/admin/dashboard')).status,200);
  });
  const values={title:'Test pottery',shortDescription:'Make a cup.',fullDescription:'Learn to shape, decorate and finish a cup.',category:'Craft',price:250.5,image:'/assets/images/pottery.jpg',host:'Test Host',location:'Cape Town',startsAt:'2026-10-25T10:00',availability:'8 spots',published:false};
  let course;
  await t.test('invalid requests and cross-site changes are rejected',async()=>{
    assert.equal((await request('/api/admin/courses',{method:'POST',body:values,csrf:false})).status,403);
    assert.equal((await request('/api/admin/courses',{method:'POST',body:values,origin:'https://another.example'})).status,403);
    for(const invalid of [{price:-1},{price:''},{image:'javascript:alert(1)'},{image:'/uploads/../server.js'},{category:'Other'},{startsAt:'2026-02-31T10:00'},{published:true,location:''},{title:''}]) {
      assert.equal((await request('/api/admin/courses',{method:'POST',body:{...values,...invalid}})).status,400,JSON.stringify(invalid));
    }
  });
  await t.test('drafts are saved privately and survive an app restart',async()=>{
    const response=await request('/api/admin/courses',{method:'POST',body:values});assert.equal(response.status,201);course=await response.json();
    assert.deepEqual(await (await request('/api/courses')).json(),[]);
    assert.equal((await (await request('/api/admin/courses')).json()).length,1);
    const second=createApp(options).listen(0,'127.0.0.1');await new Promise(resolve=>second.once('listening',resolve));
    try{assert.deepEqual(await (await fetch('http://127.0.0.1:'+second.address().port+'/api/courses')).json(),[]);assert.equal(JSON.parse(fs.readFileSync(options.coursesFile))[0].title,values.title);}
    finally{await new Promise(resolve=>second.close(resolve));}
  });
  await t.test('publish, edit and unpublish update the public catalogue',async()=>{
    let response=await request('/api/admin/courses/'+course.id,{method:'PUT',body:{...course,published:true}});assert.equal(response.status,200);course=await response.json();
    assert.equal((await (await request('/api/courses')).json())[0].title,values.title);
    response=await request('/api/admin/courses/'+course.id,{method:'PUT',body:{...course,title:'Updated pottery',price:300}});course=await response.json();
    assert.equal((await (await request('/api/courses')).json())[0].price,300);
    assert.equal((await request('/api/admin/courses/'+course.id,{method:'PUT',body:{...course,revision:1}})).status,409);
    response=await request('/api/admin/courses/'+course.id,{method:'PUT',body:{...course,published:false}});course=await response.json();
    assert.deepEqual(await (await request('/api/courses')).json(),[]);
  });
  await t.test('image upload validates type, size, authentication and serves the saved bytes',async()=>{
    const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jG9sAAAAASUVORK5CYII=';
    assert.equal((await request('/api/admin/images',{method:'POST',body:{data:png},authenticated:false})).status,401);
    assert.equal((await request('/api/admin/images',{method:'POST',body:{data:'data:image/svg+xml;base64,PHN2Zz4='}})).status,400);
    assert.equal((await request('/api/admin/images',{method:'POST',body:{data:'data:image/png;base64,SGVsbG8='}})).status,400);
    assert.equal((await request('/api/admin/images',{method:'POST',body:{data:'data:image/png;base64,'+Buffer.alloc(4*1024*1024+1).toString('base64')}})).status,400);
    const response=await request('/api/admin/images',{method:'POST',body:{data:png}});assert.equal(response.status,201);
    const image=(await response.json()).image;const loaded=await request(image);assert.equal(loaded.status,200);assert.match(loaded.headers.get('content-type'),/image\/png/);
    assert.deepEqual(Buffer.from(await loaded.arrayBuffer()),Buffer.from(png.split(',')[1],'base64'));
    course=await (await request('/api/admin/courses/'+course.id,{method:'PUT',body:{...course,image,published:true}})).json();
    assert.equal((await (await request('/api/courses')).json())[0].image,image);
  });
  await t.test('delete removes the course and logout invalidates the session',async()=>{
    assert.equal((await request('/api/admin/courses/'+course.id,{method:'DELETE',body:{revision:0}})).status,409);
    assert.equal((await request('/api/admin/courses/'+course.id,{method:'DELETE',body:{revision:course.revision}})).status,204);
    assert.deepEqual(await (await request('/api/courses')).json(),[]);
    assert.equal((await request('/api/admin/courses/'+course.id)).status,404);
    assert.equal((await request('/admin/logout',{method:'POST'})).status,200);
    assert.equal((await request('/api/admin/courses')).status,401);
  });
});
