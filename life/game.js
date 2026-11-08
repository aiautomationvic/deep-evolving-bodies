(function(){const L=LIFE,$=id=>document.getElementById(id),cv=$('v'),ctx=cv.getContext('2d');
let W=1,H=1,cam={x:1500,y:1500,z:.5},spd=1,paused=false,sel=null,ff=0,ffN=0,drag=null;
function rs(){const d=devicePixelRatio||1;W=cv.width=innerWidth*d;H=cv.height=innerHeight*d;}addEventListener('resize',rs);rs();
function start(n){L.init((Math.random()*1e9)|0,70);L.popCap=220;sel=null;cam={x:1500,y:1500,z:1.1};ff=n;ffN=n;center();}
function center(){let x=0,y=0,k=0;for(const c of L.cs){x+=c.cx;y+=c.cy;k++;}if(k){cam.x=x/k;cam.y=y/k;}}
const hs=(h,s,l,a)=>'hsla('+h+','+s+'%,'+l+'%,'+(a==null?1:a)+')';
function drawC(c){const g=c.g,bd=c.bd,x=c.x,y=c.y,r=c.r,h=g.hue,h2=g.hue2,fl=c.flash>0;
 ctx.lineCap='round';ctx.lineJoin='round';
 for(const ch of bd.chains){const ni=ch.ni;
  for(let i=1;i<ni.length;i++){const a=ni[i-1],b=ni[i];ctx.strokeStyle=hs((h2+ch.type*40)%360,60,ch.type==0?62:55,ch.type==0?.55:.8);ctx.lineWidth=Math.max(.8,(r[a]+r[b])*(ch.type==0?1.6:1));ctx.beginPath();ctx.moveTo(x[a],y[a]);ctx.lineTo(x[b],y[b]);ctx.stroke();}}
 const M=bd.M,Li=bd.L,Ri=bd.R,pts=[];
 for(let i=0;i<M;i++)pts.push([x[Li[i]],y[Li[i]]]);for(let i=M-1;i>=0;i--)pts.push([x[Ri[i]],y[Ri[i]]]);
 ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);
 for(let i=1;i<=pts.length;i++){const p=pts[i%pts.length],q=pts[i-1];ctx.quadraticCurveTo(q[0],q[1],(q[0]+p[0])/2,(q[1]+p[1])/2);}
 ctx.closePath();ctx.fillStyle=fl?'rgba(255,120,120,.8)':hs(h,55,48,.78);ctx.fill();
 ctx.lineWidth=Math.max(1,r[Li[0]]*.8);ctx.strokeStyle=hs(h,70,70,.9);ctx.stroke();
 if(g.glow>.3){ctx.fillStyle=hs(h2,90,70,.5*g.glow);for(let i=0;i<M;i+=2){ctx.beginPath();ctx.arc((x[Li[i]]+x[Ri[i]])/2,(y[Li[i]]+y[Ri[i]])/2,r[Li[i]]*.9,0,6.3);ctx.fill();}}
 const a=Li[0],b=Ri[0],er=Math.max(.8,r[a]*.5*(.5+g.eyes));ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x[a],y[a],er,0,6.3);ctx.arc(x[b],y[b],er,0,6.3);ctx.fill();
 if(c===sel){ctx.strokeStyle='#52d6c0';ctx.lineWidth=1.5/cam.z;ctx.beginPath();ctx.arc(c.cx,c.cy,Math.max(20,Math.sqrt(c.mass)*2+10),0,6.3);ctx.stroke();}}
function draw(){ctx.setTransform(1,0,0,1,0,0);const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#0b3a4a');g.addColorStop(1,'#01040a');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
 const z=cam.z*(devicePixelRatio||1);ctx.setTransform(z,0,0,z,W/2-cam.x*z,H/2-cam.y*z);
 const N=L.L,CS=L.CS,GW=L.GW;ctx.globalCompositeOperation='lighter';
 for(let q=0;q<3;q++){ctx.fillStyle=['#2fb59a','#5a8cff','#c05aff'][q];const A=N[q];for(let i=0;i<A.length;i++){const v=A[i];if(v<.08)continue;ctx.globalAlpha=Math.min(.2,v*.13);ctx.fillRect((i%GW)*CS,((i/GW)|0)*CS,CS+2,CS+2);}}
 ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
 ctx.strokeStyle='#1a2b46';ctx.lineWidth=4/cam.z;ctx.strokeRect(0,0,L.WS,L.WS);
 for(const v of L.vents||[]){ctx.fillStyle='rgba(255,140,60,.25)';ctx.beginPath();ctx.arc(v.x,v.y,40,0,6.3);ctx.fill();}
 for(const c of L.cs)drawC(c);}
function ui(){const cs=L.cs,f={};let mx=0;for(const c of cs){const k=L.formOf(c.g);f[k]=(f[k]||0)+1;mx=Math.max(mx,c.n);}
 $('hud').innerHTML='<span>Pop <b>'+cs.length+'</b></span><span>Species <b>'+L.species.length+'</b></span><span>Generation <b>'+L.maxGen+'</b></span><span>Max parts <b>'+mx+'</b></span><span>Time <b>'+(L.T/3600).toFixed(1)+'</b></span>';
 $('forms').innerHTML=Object.entries(f).sort((a,b)=>b[1]-a[1]).map(e=>e[0]+' <b>'+e[1]+'</b>').join(' · ');
 $('sp').innerHTML=[...L.species].sort((a,b)=>b.count-a.count).slice(0,14).map(s=>'<span class="chip" data-i="'+s.id+'"><i style="background:hsl('+s.hue+',60%,55%)"></i>'+s.name+' <b>'+s.count+'</b></span>').join('');
 document.querySelectorAll('#sp .chip').forEach(e=>e.onclick=()=>{const c=cs.find(c=>c.sp.id==e.dataset.i);if(c){sel=c;cam.x=c.cx;cam.y=c.cy;}});
 if(sel&&cs.indexOf(sel)<0)sel=null;
 $('sel').innerHTML=sel?'<b>'+sel.sp.name+'</b><br>Form: '+L.formOf(sel.g)+' · Role: '+L.roleOf(sel.g)+'<br>Parts '+sel.n+' · Size '+sel.g.size.toFixed(1)+' · Gen '+sel.gen+'<br>Energy '+((sel.E/sel.Emax*100)|0)+'% · Age '+sel.age+'<br>Appendages: '+(sel.g.ap.map(a=>['fin','limb','tentacle','spine'][a.type]+['(pair)','','(ring)'][a.sym]).join(', ')||'none'):'Click a creature';
 $('feed').innerHTML=L.log.slice(-5).map(e=>'<div style="border-color:'+e.col+'">'+e.msg+'</div>').join('');}
let uiT=0;
function frame(t){requestAnimationFrame(frame);
 if(ff>0){const t0=performance.now();while(ff>0&&performance.now()-t0<14){L.tick();ff--;}$('prog').style.width=(100*(1-ff/ffN))+'%';if(ff<=0){$('prog').style.width=0;center();}}
 else if(!paused){for(let i=0;i<spd;i++)L.tick();}
 try{draw();}catch(e){window.__err=String(e.stack||e);}if(t-uiT>300){uiT=t;ui();}}
document.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>{spd=+b.dataset.s;document.querySelectorAll('[data-s]').forEach(x=>x.classList.toggle('on',x===b));});
document.querySelectorAll('[data-e]').forEach(b=>b.onclick=()=>L.event(b.dataset.e));
$('pause').onclick=()=>{paused=!paused;$('pause').classList.toggle('on',paused);};
$('ff1').onclick=()=>{ff=ffN=10000;};$('ff2').onclick=()=>{ff=ffN=40000;};$('new').onclick=()=>start(0);
$('s1').onclick=()=>{start(0);$('intro').style.display='none';};$('s2').onclick=()=>{start(30000);$('intro').style.display='none';};
addEventListener('keydown',e=>{if(e.key===' '){e.preventDefault();$('pause').click();}});
function toW(px,py){const d=devicePixelRatio||1,z=cam.z*d;return[(px*d-W/2)/z+cam.x,(py*d-H/2)/z+cam.y];}
cv.addEventListener('wheel',e=>{e.preventDefault();const b=toW(e.clientX,e.clientY);cam.z=Math.max(.1,Math.min(4,cam.z*Math.exp(-e.deltaY*.001)));const a=toW(e.clientX,e.clientY);cam.x+=b[0]-a[0];cam.y+=b[1]-a[1];},{passive:false});
cv.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,cx:cam.x,cy:cam.y,m:0};cv.setPointerCapture(e.pointerId);});
cv.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>4)drag.m=1;if(drag.m){cam.x=drag.cx-dx/cam.z;cam.y=drag.cy-dy/cam.z;}});
cv.addEventListener('pointerup',e=>{if(drag&&!drag.m){const p=toW(e.clientX,e.clientY);let b=null,bd=1e9;for(const c of L.cs){const d=Math.hypot(c.cx-p[0],c.cy-p[1]),R=Math.sqrt(c.mass)*2+25;if(d<R&&d<bd){bd=d;b=c;}}sel=b;}drag=null;});
start(0);requestAnimationFrame(frame);})();
