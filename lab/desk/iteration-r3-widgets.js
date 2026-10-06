// Cached flat ink, gently defocused distance and deterministic peripheral routing.
(function(){
'use strict';
var R=RELIEF,K=RINK,TAU=Math.PI*2,blurred=new WeakMap();
var labels={hero:['Portfolio overview','€200.4M','240 loans'],counts:['Review calendar','October 2026','8 scheduled reviews'],gate:['Decision queue','12 ready','4 in review'],rule:['Document library','24 records','Contracts and policies'],bars:['Monthly volume','€200.4M','12 months'],npl:['Coverage','92.4%','Verified records']};
function info(id,sample){var v=sample||0,out=labels[id].slice();if(id==='hero'){out[0]=['Portfolio overview','Consumer loans','Business loans'][v];out[1]=['€200.4M','€84.7M','€115.7M'][v];out[2]=['240 loans','156 loans','84 loans'][v];}if(id==='npl')out[1]=['92.4%','96.8%','89.6%'][v];if(id==='gate')out[1]=[12,8,17][v]+' ready';return out;}
function print(id,mode){return function(g,F,I,w,h,n){
 var sample=n&&n.sample||0,content=info(id,sample);
 var l=-w/2+16,r=w/2-16,t=-h/2+20,b=h/2-18,iw=r-l,ih=b-t,sy=Math.min(1,ih/150);
 function text(s,x,y,px,al,color){K.text(g,F,s,x,y,{px:Math.max(10,px*sy),min:1,align:al||'left',color:color||I.ink});}
 function line(x,y,xx,yy){g.strokeStyle=I.line;g.lineWidth=.8;g.beginPath();g.moveTo(x,y);g.lineTo(xx,yy);g.stroke();}
 text(content[0],l,t,10,'left',I.ink2);
 if(id==='hero'){
  text(content[1],l,t+42*sy,35);text(content[2]+'  ·  '+['+7.9%','+4.2%','+9.1%'][sample],l,t+63*sy,11,'left',I.ink2);
  line(l,t+81*sy,r,t+81*sy);text('Consumer',l,t+104*sy,11,'left',I.ink2);text('€84.7M',r,t+104*sy,14,'right');
  text('Business',l,t+128*sy,11,'left',I.ink2);text('€115.7M',r,t+128*sy,14,'right');
 }else if(id==='counts'){
  text('October 2026',l,t+25*sy,17);
  var gridTop=t+46*sy,cw=iw/7,ch=(b-gridTop)/6;
  g.save();g.textAlign='center';g.textBaseline='middle';g.font='400 '+Math.min(11,cw*.48,ch*.53)+'px Geist,system-ui';
  g.fillStyle=I.ink3;
  'MTWTFSS'.split('').forEach(function(d,i){g.fillText(d,l+(i+.5)*cw,gridTop+ch*.5);});
  var events=[[2,6,7,14,19,22,27,30],[1,5,12,13,21,23,26,29],[2,8,9,15,20,22,28,30]][sample];
  for(var day=1;day<=31;day++){
   var slot=day+2,x=l+(slot%7+.5)*cw,y=gridTop+(1.5+Math.floor(slot/7))*ch;
   if(events.indexOf(day)>=0){g.fillStyle=I.line;g.fillRect(x-cw*.39,y-ch*.40,cw*.78,ch*.80);}
   g.fillStyle=I.ink;g.fillText(String(day),x,y);
  }
  g.restore();
 }else if(id==='npl'){
  text(content[1],l,t+52*sy,32);text('Verified records',l,t+76*sy,12,'left',I.ink2);
  text('Source checked',l,b-20,11,'left',I.ink2);text('Updated 09:42',l,b,10,'left',I.ink3);
 }else if(id==='gate'){
  text(content[1],l,t+38*sy,26);[['Approved','12'],['In review','4'],['Blocked','2']].forEach(function(row,i){var y=t+69*sy+i*25*sy;text(row[0],l,y,11,'left',I.ink2);text(row[1],r,y,12,'right');});
 }else if(id==='rule'){
  text('24 records',l,t+33*sy,24);['Loan agreements','Policies','Approvals'].forEach(function(s,i){var y=t+63*sy+i*27*sy;line(l,y+10,r,y+10);text(s,l,y,11);text(['16','5','3'][i],r,y,11,'right',I.ink2);});
 }else if(id==='record'){
  text('LN-0248',l,t+42*sy,27);text('Source matched',l,t+72*sy,12,'left',I.ink2);line(l,t+90*sy,r,t+90*sy);text('Document',l,t+115*sy,11,'left',I.ink2);text('Agreement · v03',l,t+138*sy,13);
 }else if(id==='note'){
  text('12 Oct',l,t+42*sy,30);text('10:30',r,t+42*sy,18,'right');line(l,t+64*sy,r,t+64*sy);text('Review evidence',l,t+91*sy,14);text('Risk team',l,t+117*sy,12,'left',I.ink2);text('Ready for review',l,t+142*sy,11,'left',I.ink2);
 }else{
  var values=[.4,.6,.5,.7,.65,.58,.72,.81,.67,.86,.92,.84],hh=ih-43,yy=b-9;
  values.forEach(function(v,i){g.fillStyle=i===11?I.acc:I.ink3;g.fillRect(l+i*iw/12,yy-v*hh,iw/12-5,v*hh);});text('Oct',l,b+7,9);text('Sep',r,b+7,9,'right');
 }
};}
function blur(cv){if(blurred.has(cv))return blurred.get(cv);var b=document.createElement('canvas');b.width=cv.width;b.height=cv.height;var g=b.getContext('2d');g.drawImage(cv,0,0);RELIEF_SOFT.blur(b,2);blurred.set(cv,b);return b;}
var layerCache=new Map();
function layer(g,x,y,w,h,F){
 var key=F.ctx.theme+'/'+(h/w).toFixed(3),cv=layerCache.get(key);
 if(!cv){cv=document.createElement('canvas');cv.width=280;cv.height=Math.round(240*h/w)+40;var q=cv.getContext('2d');
  q.shadowColor=R.color.css(F.tn.shadow,.15);q.shadowBlur=9;q.shadowOffsetY=3;
  q.fillStyle=R.color.css(F.tn.plate);q.fillRect(20,20,240,cv.height-40);layerCache.set(key,cv);
  if(layerCache.size>32)layerCache.delete(layerCache.keys().next().value);
 }
 var pad=w/12;g.drawImage(cv,x-w/2-pad,y-h/2-pad,w+2*pad,h+2*pad);
}
var stackMasks=new Map();
function stackMask(F){
 var key=F.ctx.theme,cv=stackMasks.get(key);if(cv)return cv;
 cv=document.createElement('canvas');cv.width=cv.height=128;var q=cv.getContext('2d');
 q.fillStyle=R.color.css(F.tn.shadow,.10);q.fillRect(16,16,96,96);RELIEF_SOFT.blur(cv,4);stackMasks.set(key,cv);return cv;
}
function stack(g,n,F){
 var hub=F.hub||{x:F.W/2,y:F.H*.52},dx=hub.x-n.x,dy=hub.y-n.y,len=Math.hypot(dx,dy)||1;
 var c=Math.cos(n.rot),s=Math.sin(n.rot),step=7*F.ui;
 var ux=(dx*c+dy*s)/len,uy=(-dx*s+dy*c)/len,mask=stackMask(F);
 for(var j=2;j>=1;j--){
  var shrink=1-j*.018,x=ux*j*step,y=uy*j*step,w=n.w*shrink,h=n.h*shrink;
  g.fillStyle=R.color.css(F.tn.plate);g.fillRect(x-w/2,y-h/2,w,h);
  // Only the exposed receiving sheet gets shadow from the sheet immediately above it.
  var next=1-(j-1)*.018,nw=n.w*next,nh=n.h*next,nx=ux*(j-1)*step,ny=uy*(j-1)*step;
  g.save();g.beginPath();g.rect(x-w/2,y-h/2,w,h);g.clip();g.imageSmoothingQuality='low';
  g.drawImage(mask,nx-nw*2/3,ny-nh*2/3,nw*4/3,nh*4/3);g.restore();
 }
}
function smooth(x){x=Math.max(0,Math.min(1,x));return x*x*x*(10+x*(-15+6*x));}
// Analytic damped response: seek/export/frame-rate independent, low overshoot.
function settle(age){var a=Math.max(0,age),w=3.4,z=.78,d=w*Math.sqrt(1-z*z);return Math.exp(-z*w*a)*(Math.cos(d*a)+z*w/d*Math.sin(d*a));}
function buoyancy(nodes,ctx,t){
 if(ctx.reduced||!+ctx.P.refresh)return;
 var ui=R.ui(ctx.W,ctx.H),strength=Math.max(0,Math.min(2,+ctx.P.refreshWeight||0));
 nodes.forEach(function(n,i){if(n.shape!=='sheet')return;
  var age=n.birthAge,gate=age<0?1:smooth(age/1.4),phase=(i+1)*1.71;
  var sx=.65*Math.sin(t*.48+phase),sy=1.1*Math.sin(t*.61+phase*.73),sr=.10*Math.sin(t*.43+phase);
  var response=age>=0?settle(age):0;
  n.x+=(sx*gate+.7*response)*ui*strength;n.y+=(sy*gate+6*response)*ui*strength;
  n.height+=1.2*ui*response*strength;
  n.rot+=(sr*gate+(i%2?1:-1)*.24*response)*Math.PI/180*strength;
 });
}

var printers={},plans={};
labels.record=['Source record','LN-0248','Verified'];labels.note=['Next action','Review ready','12 Oct'];
var contentIds=['hero','counts','gate','rule','bars','npl','record','note'];
var renewalIds=['hero','counts','gate','rule','bars','npl'];
var baseAngles=[-152,-92,18,62,136,176];
function site(slot){var a=(-152+slot*30)*Math.PI/180,band=slot%6;return {x:Math.cos(a)*.72,y:(band-2.5)*.32,z:(slot<6?-.68:.68)+Math.sin(a)*.14};}
function planFor(ctx,t){
 var plan=plans[ctx.seed];if(!plan){plan={tracks:{},rand:R.stream(ctx.seed,'arrival-plan'),occupied:{}};
 renewalIds.forEach(function(id,i){var slot=[0,2,6,7,10,11][i],exit=10+i*2+plan.rand()*13;plan.tracks[id]=[{generation:0,birth:-2,exit:exit,contentId:id,slot:slot,site:site(slot),scale:1}];plan.occupied[id]=slot;});plans[ctx.seed]=plan;}
 while(true){var id=null,when=Infinity;
 renewalIds.forEach(function(k){var arr=plan.tracks[k],last=arr[arr.length-1];if(last.nextBirth==null)last.nextBirth=last.exit+.9+3+plan.rand()*4;if(last.nextBirth<when){when=last.nextBirth;id=k;}});
 if(when>t+60)break;
 var track=plan.tracks[id],last=track[track.length-1],used=Object.keys(plan.occupied).filter(function(k){return k!==id;}).map(function(k){return plan.occupied[k];}),best=-1,bestScore=-Infinity,yaw=when*Math.PI*2/384;
 for(var slot=0;slot<12;slot++){var delta=Math.abs(slot-last.slot);delta=Math.min(delta,12-delta);if(delta<2||used.indexOf(slot)>=0)continue;
  var pos=site(slot),min=Infinity;used.forEach(function(u){var o=site(u),dx=(pos.x-o.x)*Math.cos(yaw)+(pos.z-o.z)*Math.sin(yaw),dy=pos.y-o.y;min=Math.min(min,dx*dx+dy*dy*1.3);});var score=min+plan.rand()*.15;if(score>bestScore){bestScore=score;best=slot;}}
 if(best<0)for(var slot=0;slot<12;slot++)if(used.indexOf(slot)<0&&slot!==last.slot){best=slot;break;}
 var taken=Object.keys(plan.tracks).filter(function(k){return k!==id;}).map(function(k){var a=plan.tracks[k];return a[a.length-1].contentId;}),available=contentIds.filter(function(k){return k!==last.contentId&&taken.indexOf(k)<0;}),nextContent=available[Math.floor(plan.rand()*available.length)],g=last.generation+1;
 track.push({generation:g,birth:when,exit:when+19+plan.rand()*22,contentId:nextContent,slot:best,site:site(best),scale:.93+plan.rand()*.14});plan.occupied[id]=best;
 }
 return plan;
}
function lifeState(id,ctx,t){var plan=planFor(ctx,t),track=plan.tracks[id],e=track[0];
 if(ctx.reduced||!+ctx.P.refresh)return Object.assign({},e,{life:1,birthAge:-1});
 for(var j=1;j<track.length&&track[j].birth<=t;j++)e=track[j];var age=t-e.birth;
 return Object.assign({},e,{life:(e.generation?smooth(age/1.2):1)*(1-smooth((t-e.exit)/.9)),birthAge:e.generation?age:-1});
}
function renew(nodes,ctx,t){nodes.forEach(function(n){if(n.shape!=='sheet')return;var e=n.arrival||lifeState(n.id,ctx,t),i=renewalIds.indexOf(n.id);
 n.life=e.life;n.w*=e.scale;n.h*=e.scale;n.contentId=e.contentId;
 if(!printers[n.contentId])printers[n.contentId]=print(n.contentId);
 n.sample=(i+e.generation)%3;n.print=printers[n.contentId];n.info=info(n.contentId,n.sample);n.generation=e.generation;n.birthAge=e.birthAge;n.refresh=null;
});}
var hazeCache=new Map();
function backdrop(g,plates,F){
 if(!(F.L.dens>0))return;
 var key=F.ctx.theme,sprite=hazeCache.get(key);
 if(!sprite){sprite=document.createElement('canvas');sprite.width=sprite.height=128;var q=sprite.getContext('2d'),gradient=q.createRadialGradient(64,64,0,64,64,64);
 gradient.addColorStop(0,R.color.css(F.tn.shadow,.65));gradient.addColorStop(.45,R.color.css(F.tn.shadow,.25));gradient.addColorStop(1,R.color.css(F.tn.shadow,0));q.fillStyle=gradient;q.fillRect(0,0,128,128);hazeCache.set(key,sprite);}
 g.save();
 var height=285*F.ui,offset=R.light.offset(F.L,F.W*.5,F.H*.5,height,0),size=Math.min(F.W,F.H)*1.18;
 g.globalAlpha=Math.min(.20,F.L.dens*.48);
 g.drawImage(sprite,F.W*.5+offset[0]-size/2,F.H*.52+offset[1]-size/2,size,size);
 g.restore();
}
var budCopy={
 record:[['Agreement','Version 03'],['Source','Verified'],['Record','LN-0248']],
 note:[['Review','12 Oct'],['Owner','Risk team'],['Status','Ready']],
 hero:[['Loan review','LN-0248'],['Settlement','12 Oct'],['Exposure','€1.24M']],
 counts:[['Review call','14 Oct · 10:30'],['Documents due','22 Oct'],['Follow-up','Tomorrow']],
 gate:[['Payment','€12,400'],['Decision','Approved'],['Owner','Risk team']],
 rule:[['Agreement','Version 03'],['Signed','06 Oct'],['Next review','30 Oct']],
 bars:[['September','€18.2M'],['New loans','24 records'],['Reconciled','09:42']],
 npl:[['Verified','48 records'],['Source','Registry'],['Checked','Today · 09:42']]
};
function buds(g,plates,F){
 if(F.ctx.reduced||!+F.P.refresh)return;
 var U=Math.max(.75,F.ui),I=K.inks(F),hub=F.hub||{x:F.W/2,y:F.H*.52};
 plates.forEach(function(n){if(n.kind!=='rect'||n.w<120||n.birthAge<0||n.birthAge>13)return;
  var rand=R.stream(F.ctx.seed,'buds/'+n.id+'/'+n.generation),axis=Math.atan2(n.y-hub.y,n.x-hub.x),copy=budCopy[n.contentId||n.id];var turn=rand()*.5-.25;
  for(var i=0;i<3;i++){
   var delay=.7+i*.8+rand()*1.4,duration=4+rand()*2.1,size=.90+rand()*.16,a=axis+(i-1)*.92+turn;
   var age=n.birthAge-delay,appear=smooth(age/.9),finish=smooth((age-duration)/.55),lineFade=1-finish;
   if(age<0||lineFade<=0)continue;
   var w=(i===1?94:112)*U*size,h=(i===1?44:52)*U*size;
   var edge=1/Math.max(Math.abs(Math.cos(a))/(n.w/2),Math.abs(Math.sin(a))/(n.h/2));
   var distance=edge+Math.abs(Math.cos(a))*w/2+Math.abs(Math.sin(a))*h/2+16*U;
   var rest=settle(age),travel=4*U*rest,drift=smooth(age/1.4)*Math.sin(age*.75+i)*.7*U;
   var x=n.x+Math.cos(a)*(distance-travel),y=n.y+Math.sin(a)*(distance-travel)+drift;
   x=Math.max(w/2+8,Math.min(F.W-w/2-8,x));y=Math.max(h/2+8,Math.min(F.H-h/2-8,y));
   g.save();g.globalAlpha=appear*lineFade*.35;g.strokeStyle=I.ink3;g.lineWidth=.65*U;g.beginPath();g.moveTo(n.x,n.y);g.quadraticCurveTo((n.x+x)/2-4*U,(n.y+y)/2+6*U,x,y);g.stroke();
   var alpha=appear*(1-finish);
   if(alpha>0){g.globalAlpha=alpha;var round=i===0&&(n.contentId||n.id)!=='counts';if(round){w=h=Math.max(h,80*U);g.fillStyle=R.color.css(F.tn.plate);g.beginPath();g.arc(x,y,w/2,0,TAU);g.fill();}else layer(g,x,y,w,h,F);
    g.textAlign=round?'center':'left';g.textBaseline='middle';g.fillStyle=I.ink2;g.font='400 '+(10*U*size)+'px Geist,system-ui';
    g.fillText(age>duration-.65?'Completed':copy[(i+(n.generation||0))%3][0],round?x:x-w/2+10*U,y-h*.19,round?w*.8:w-20*U);
    g.fillStyle=I.ink;g.font='500 '+(12*U*size)+'px Geist,system-ui';g.fillText(copy[(i+(n.generation||0))%3][1],round?x:x-w/2+10*U,y+h*.19,round?w*.8:w-20*U);
   }g.restore();
  }
 });
}
function route(nodes,ctx,yaw,t){
 var W=ctx.W,H=ctx.H,unit=Math.min(W,H),by={};nodes.forEach(function(n){by[n.id]=n;});
 var sheets=nodes.filter(function(n){return n.shape==='sheet';});
 function limit(v,max){var d=Math.hypot(v[0],v[1]);return d>max?[v[0]*max/d,v[1]*max/d]:v;}
 function push(n,x,y,budget){
  var dx=0,dy=0;
  sheets.forEach(function(o){
   var c=Math.cos(o.rot),s=Math.sin(o.rot),xx=(x-o.x)*c+(y-o.y)*s,yy=-(x-o.x)*s+(y-o.y)*c;
   var ex=o.w/2+n.w/2+8,ey=o.h/2+n.h/2+8,q=Math.hypot(xx/ex,yy/ey);
   // Smooth local potential, no route switching or global perimeter assignment.
   var k=Math.exp(-2.5*q*q)*budget*1.7*(o.life==null?1:o.life),px=xx/ex+.001,py=yy/ey+.001,d=Math.sqrt(px*px+py*py+.16);
   dx+=(c*px-s*py)/d*k;dy+=(s*px+c*py)/d*k;
  });return limit([dx,dy],budget);
 }
 ['stages','agents'].forEach(function(id){
  var parent=by[id],children=nodes.filter(function(n){return id==='stages'?/^st[0-9]/.test(n.id):/^ag[0-9]/.test(n.id);});
  // Keep the local fan readable when its branch turns edge-on; only the family anchor orbits.
  children.forEach(function(n,j){var a=(window.RELIEF_EXPLORE.mode==='helix'?(j%2?1:-1)*(Math.PI*.42+j*.19)+(id==='agents'?.3:2.8):(id==='agents'?102*Math.PI/180+(j-2)*.62:-38*Math.PI/180+(j-1)*1.05))+.16*Math.sin(yaw)+(ctx.reduced?0:(id==='agents'?1:-1)*TAU*t/96);
   var radius=id==='agents'?unit*(.105+(j%2)*.032):n.w/2+unit*.065;
   n.x=parent.x+Math.cos(a)*radius;n.y=parent.y+Math.sin(a)*radius;
  });
  var group=[parent].concat(children),common=push(parent,parent.x,parent.y,unit*.035),positions=[];
  group.forEach(function(n){
   var x=n.x+common[0],y=n.y+common[1];
   if(n!==parent){var local=push(n,x,y,unit*.035);x+=local[0];y+=local[1];}
   positions.push([x,y]);
  });
  // Move the family together only if it reaches the viewport edge.
  var loX=Infinity,hiX=-Infinity,loY=Infinity,hiY=-Infinity;
  group.forEach(function(n,i){loX=Math.min(loX,positions[i][0]-n.w/2);hiX=Math.max(hiX,positions[i][0]+n.w/2);loY=Math.min(loY,positions[i][1]-n.h/2);hiY=Math.max(hiY,positions[i][1]+n.h/2);});
  var sx=Math.max(0,12-loX)-Math.max(0,hiX-W+12),sy=Math.max(0,12-loY)-Math.max(0,hiY-H+12);
  group.forEach(function(n,i){n.x=positions[i][0]+sx;n.y=positions[i][1]+sy;});
 });
 // Large cards may overlap each other, but cannot leave the preview.
 sheets.forEach(function(n){var ex=(Math.abs(Math.cos(n.rot))*n.w+Math.abs(Math.sin(n.rot))*n.h)/2,ey=(Math.abs(Math.sin(n.rot))*n.w+Math.abs(Math.cos(n.rot))*n.h)/2;
 n.x=Math.max(ex+8,Math.min(W-ex-8,n.x));n.y=Math.max(ey+8,Math.min(H-ey-8,n.y));});
}
var miniEvents={};
function parentCards(g,plates,F){if(F.ctx.reduced||!+F.P.refresh)return;var I=K.inks(F),U=Math.max(.7,F.ui);
 plates.filter(function(n){return n.id==='stages'||n.id==='agents';}).forEach(function(n,j){var key=F.ctx.seed+'/'+n.id,track=miniEvents[key];
  if(!track){track={rand:R.stream(F.ctx.seed,'mini-life/'+n.id),events:[]};miniEvents[key]=track;}
  while(!track.events.length||track.events[track.events.length-1].end<F.tsec+15){var prev=track.events[track.events.length-1],start=prev?prev.end+5+track.rand()*9:8+j*6,end=start+5+track.rand()*4,k=track.events.length;track.events.push({start:start,end:end,angle:(k%2?1:-1)*(.65+track.rand()*1.5),k:k});}
  var e=track.events.find(function(e){return F.tsec>=e.start&&F.tsec<=e.end;});if(!e)return;var a=smooth((F.tsec-e.start)/.9)*smooth((e.end-F.tsec)/.9);if(a<=0)return;
  var copies=j?[['Source checked','Registry · verified'],['Review queued','8 documents'],['Match found','LN-0248'],['Risk check','No exceptions']]:[['Stage review','12 Oct · 10:30'],['Reconciled','€42,600'],['New allocation','18 loan records'],['Follow-up','15 Oct · 09:00']],copy=copies[e.k%copies.length];
  var w=108*U,h=48*U,dist=n.w/2+w*.7+12*U,x=Math.max(w/2+8,Math.min(F.W-w/2-8,n.x+Math.cos(e.angle)*dist)),y=Math.max(h/2+8,Math.min(F.H-h/2-8,n.y+Math.sin(e.angle)*dist));
  g.save();g.globalAlpha=a*.3;g.strokeStyle=I.ink3;g.lineWidth=.7;g.beginPath();g.moveTo(n.x,n.y);g.lineTo(x,y);g.stroke();g.globalAlpha=a;layer(g,x,y,w,h,F);g.textAlign='center';g.textBaseline='middle';g.fillStyle=I.ink2;g.font='400 '+10*U+'px Geist';g.fillText(copy[0],x,y-8*U);g.fillStyle=I.ink;g.font='500 '+12*U+'px Geist';g.fillText(copy[1],x,y+10*U);g.restore();
 });}
window.EXPLORE_WIDGETS={settle:settle,buoyancy:buoyancy,lifeState:lifeState,planFor:planFor,parentCards:parentCards,buds:buds,renew:renew,backdrop:backdrop,print:print,info:info,short:function(id){return {record:['Source record','LN-0248'],note:['Next action','12 Oct'],hero:['Portfolio','€200.4M'],counts:['Calendar','Oct 2026'],gate:['Queue','12 ready'],rule:['Library','24 records'],bars:['Volume','€200.4M'],npl:['Coverage','92.4%']}[id];},blur:blur,stack:stack,route:route};
})();
