// Cached flat ink, gently defocused distance and deterministic peripheral routing.
(function(){
'use strict';
var R=RELIEF,K=RINK,TAU=Math.PI*2,blurred=new WeakMap();
var labels={hero:['Portfolio overview','€200.4M','240 loans'],counts:['Review calendar','October 2026','8 scheduled reviews'],gate:['Decision queue','12 ready','4 in review'],rule:['Document library','24 records','Contracts and policies'],bars:['Monthly volume','€200.4M','12 months'],npl:['Coverage','92.4%','Verified records']};
function info(id,sample){var v=sample||0,out=labels[id].slice();if(id==='hero'){out[0]=['Portfolio overview','Consumer loans','Business loans'][v];out[1]=['€200.4M','€84.7M','€116.2M'][v];out[2]=['240 loans','156 loans','84 loans'][v];}if(id==='npl')out[1]=['92.4%','96.8%','89.6%'][v];if(id==='gate')out[1]=[12,8,17][v]+' ready';return out;}
function print(id,mode){return function(g,F,I,w,h,n){
 var sample=n&&n.sample||0,content=info(id,sample);
 var l=-w/2+16,r=w/2-16,t=-h/2+20,b=h/2-18,iw=r-l,ih=b-t;
 function text(s,x,y,px,al,color){K.text(g,F,s,x,y,{px:Math.max(12,px),min:1,align:al||'left',color:color||I.ink});}
 function line(x,y,xx,yy){g.strokeStyle=I.line;g.lineWidth=.8;g.beginPath();g.moveTo(x,y);g.lineTo(xx,yy);g.stroke();}
 text(content[0],l,t,10,'left',I.ink2);
 if(id==='hero'){
  text(content[1],l,t+42,35);text(content[2]+'  ·  '+['+7.9%','+4.2%','+9.1%'][sample],l,t+63,11,'left',I.ink2);
  var vals=[.3,.42,.36,.53,.47,.65,.61,.76,.72,.88,.84,.95],yy=b-8,hh=Math.max(18,ih-92);
  vals.forEach(function(v,i){g.fillStyle=i===11?I.acc:I.ink3;g.fillRect(l+i*iw/12,yy-v*hh,iw/12-5,v*hh);});
 }else if(id==='counts'){
  text('October 2026',l,t+25,17);var top=t+48,cw=iw/7,ch=Math.max(14,(ih-52)/6);
  'MTWTFSS'.split('').forEach(function(d,i){text(d,l+(i+.5)*cw,top,9,'center',I.ink3);});
  for(var day=1;day<=31;day++){var slot=day+2,x=l+(slot%7+.5)*cw,y=top+(1+Math.floor(slot/7))*ch;
   if([[2,6,7,14,19,22,27,30],[1,5,12,13,21,23,26,29],[2,8,9,15,20,22,28,30]][sample].indexOf(day)>=0){K.dot(g,x,y-3,Math.min(cw,ch)*.39,I.line);var count={2:1,6:2,7:1,14:3,19:1,22:2,27:1,30:2}[day]||1;for(var mark=0;mark<count;mark++)K.dot(g,x+(mark-(count-1)/2)*3,y+5,1,I.acc);}
   text(String(day),x,y,9,'center');}
 }else if(id==='npl'){
  var cy=t+ih*.53,rad=Math.min(iw*.34,ih*.31);g.lineWidth=7;g.strokeStyle=I.line;g.beginPath();g.arc(0,cy,rad,0,TAU);g.stroke();g.strokeStyle=I.ink2;g.beginPath();g.arc(0,cy,rad,-Math.PI/2,-Math.PI/2+TAU*([.924,.968,.896][sample]));g.stroke();
  text(content[1],0,cy+6,22,'center');text('verified',0,b,10,'center',I.ink2);
 }else if(id==='gate'){
  text(content[1],l,t+34,25);var rows=[['Approved',.75],['In review',.25],['Blocked',.125]];
  rows.forEach(function(row,i){var y=t+59+i*Math.max(27,(ih-58)/3);text(row[0],l,y,10,'left',I.ink2);g.fillStyle=I.line;g.fillRect(l,y+7,iw,5);g.fillStyle=i===2?I.acc:I.ink2;g.fillRect(l,y+7,iw*row[1],5);});
 }else if(id==='rule'){
  text('24 records',l,t+33,24);['Loan agreements','Policies','Approvals'].forEach(function(s,i){var y=t+63+i*27;line(l,y+10,r,y+10);text(s,l,y,11);text(['16','5','3'][i],r,y,11,'right',I.ink2);});
 }else{
  var values=[.4,.6,.5,.7,.65,.58,.72,.81,.67,.86,.92,.84],hh=ih-43,yy=b-9;
  values.forEach(function(v,i){g.fillStyle=i===11?I.acc:I.ink3;g.fillRect(l+i*iw/12,yy-v*hh,iw/12-5,v*hh);});text('Oct',l,b+7,9);text('Sep',r,b+7,9,'right');
 }
};}
function blur(cv){if(blurred.has(cv))return blurred.get(cv);var b=document.createElement('canvas');b.width=cv.width;b.height=cv.height;var g=b.getContext('2d');g.filter='blur(2px)';g.drawImage(cv,0,0);blurred.set(cv,b);return b;}
function stack(g,n,F){
 var hub=F.hub||{x:F.W/2,y:F.H*.52},dx=hub.x-n.x,dy=hub.y-n.y,len=Math.hypot(dx,dy)||1;
 var c=Math.cos(n.rot),s=Math.sin(n.rot),step=7*F.ui;
 var ux=(dx*c+dy*s)/len,uy=(-dx*s+dy*c)/len,I=K.inks(F);
 for(var j=3;j>=1;j--){var shrink=1-j*.025,x=ux*j*step,y=uy*j*step,w=n.w*shrink,h=n.h*shrink;
  g.fillStyle=R.color.css(F.tn.plate);g.fillRect(x-w/2,y-h/2,w,h);
  g.strokeStyle=I.line;g.lineWidth=.5;g.strokeRect(x-w/2,y-h/2,w,h);
 }
}
function smooth(x){x=Math.max(0,Math.min(1,x));return x*x*x*(10+x*(-15+6*x));}
var printers={},orders={};
function renew(nodes,ctx,t){
 var ids=['hero','counts','gate','rule','bars','npl'],ui=R.ui(ctx.W,ctx.H);
 nodes.forEach(function(n){if(n.shape!=='sheet')return;
  var i=ids.indexOf(n.id),start=6+i*7,period=54+2*i,elapsed=t-start,k=Math.floor(elapsed/period),u=elapsed-k*period;
  var live=!ctx.reduced&&+ctx.P.refresh&&elapsed>=0,generation=live?k+(u>=.75?1:0):0;
  n.life=1;
  if(live){if(u<.65)n.life=1-smooth(u/.65);else if(u<.95)n.life=0;else if(u<1.8)n.life=smooth((u-.95)/.85);}
  var rand=R.stream(ctx.seed,'renew/'+n.id+'/'+generation),scale=generation?.90+.22*rand():1;
  n.w*=scale;n.h*=scale;
  if(generation){n.x+=(rand()-.5)*12*ui;n.y+=(rand()-.5)*12*ui;n.rot+=(rand()-.5)*.06;}
  var orderKey=ctx.seed+'/'+n.id;if(!orders[orderKey]){var pool=ids.filter(function(id){return id!==n.id;}),shuffle=R.stream(ctx.seed,'content-order/'+n.id);for(var j=pool.length-1;j>0;j--){var at=Math.floor(shuffle()*(j+1)),swap=pool[j];pool[j]=pool[at];pool[at]=swap;}orders[orderKey]=[n.id].concat(pool);}
  n.contentId=orders[orderKey][generation%6];
  if(!printers[n.contentId])printers[n.contentId]=print(n.contentId);
  n.sample=(i+generation)%3;n.print=printers[n.contentId];n.info=info(n.contentId,n.sample);n.generation=generation;n.entryScale=scale;n.birthAge=live&&u>=.95?u-.95:-1;
  if(live&&u<.65)n.y+=14*ui*(1-n.life);
  if(live&&u>=.95&&u<1.8)n.y-=14*ui*(1-n.life);
  if(live&&u>=.95&&u<2.5)n.refresh={u:u-.95,old:0};
 });
}
var hazeCache=new Map();
function backdrop(g,plates,F){
 if(!(F.L.dens>0))return;
 var key=F.ctx.theme,sprite=hazeCache.get(key);
 if(!sprite){sprite=document.createElement('canvas');sprite.width=sprite.height=128;var q=sprite.getContext('2d'),gradient=q.createRadialGradient(64,64,0,64,64,64);
 gradient.addColorStop(0,R.color.css(F.tn.shadow,.65));gradient.addColorStop(.45,R.color.css(F.tn.shadow,.25));gradient.addColorStop(1,R.color.css(F.tn.shadow,0));q.fillStyle=gradient;q.fillRect(0,0,128,128);hazeCache.set(key,sprite);}
 g.save();
 plates.filter(function(n){return n.kind==='rect';}).forEach(function(n){
  var height=180*F.ui,offset=R.light.offset(F.L,n.x,n.y,height,0),sigma=R.light.sigma(F.L,height)*2.4;
  var w=n.w+sigma*4,h=n.h+sigma*4;
  g.globalAlpha=Math.min(.16,F.L.dens*.55)*(n.life==null?1:n.life);
  g.drawImage(sprite,n.x+offset[0]-w/2,n.y+offset[1]-h/2,w,h);
 });g.restore();
}
function buds(g,plates,F){
 if(F.ctx.reduced||!+F.P.refresh)return;
 var I=K.inks(F),hub=F.hub||{x:F.W/2,y:F.H*.52};
 plates.forEach(function(n){if(n.kind!=='rect'||n.w<120||n.birthAge<0||n.birthAge>11)return;
  var rand=R.stream(F.ctx.seed,'buds/'+n.id+'/'+n.generation),axis=Math.atan2(n.y-hub.y,n.x-hub.x);
  for(var i=0;i<3;i++){
   var delay=.7+i*.6+rand()*1.4,duration=3+rand()*2.1,rad=(9+rand()*6)*F.ui,a=axis+(i-1)*.65+(rand()-.5)*.18;
   var age=n.birthAge-delay,appear=smooth(age/.5),finish=smooth((age-duration)/.45),lineFade=1-smooth((age-duration-.35)/.65);
   if(age<0||lineFade<=0)continue;
   var distance=Math.hypot(n.w,n.h)*.43+rad*2.3+(i%2)*10*F.ui;
   var x=n.x+Math.cos(a)*distance,y=n.y+Math.sin(a)*distance;
   x=Math.max(rad+10,Math.min(F.W-rad-10,x));y=Math.max(rad+10,Math.min(F.H-rad-10,y));
   g.save();g.globalAlpha=appear*lineFade*.5;g.strokeStyle=I.ink3;g.lineWidth=.65*F.ui;g.beginPath();g.moveTo(n.x,n.y);g.quadraticCurveTo((n.x+x)/2-4*F.ui,(n.y+y)/2+6*F.ui,x,y);g.stroke();
   var alpha=appear*(1-finish),r=rad*appear*(1+.12*finish);
   if(alpha>0){g.globalAlpha=alpha;g.fillStyle=R.color.css(F.tn.plate);g.beginPath();g.arc(x,y,r,0,TAU);g.fill();
    var progress=Math.min(1,Math.max(0,(age-.5)/(duration-.9)));
    g.strokeStyle=progress>=1?I.acc:I.ink3;g.lineWidth=.8*F.ui;g.beginPath();g.arc(x,y,r*.67,-Math.PI/2,-Math.PI/2+TAU*progress);g.stroke();
    if(progress>=1){g.beginPath();g.moveTo(x-r*.25,y);g.lineTo(x-r*.04,y+r*.20);g.lineTo(x+r*.30,y-r*.23);g.stroke();}
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
   var k=Math.exp(-2.5*q*q)*budget*1.7,px=xx/ex+.001,py=yy/ey+.001,d=Math.hypot(px,py);
   dx+=(c*px-s*py)/d*k;dy+=(s*px+c*py)/d*k;
  });return limit([dx,dy],budget);
 }
 ['stages','agents'].forEach(function(id){
  var parent=by[id],children=nodes.filter(function(n){return id==='stages'?/^st[0-9]/.test(n.id):/^ag[0-9]/.test(n.id);});
  // Keep the local fan readable when its branch turns edge-on; only the family anchor orbits.
  children.forEach(function(n,j){var a=(id==='agents'?102*Math.PI/180+(j-2)*.62:-38*Math.PI/180+(j-1)*1.05)+.16*Math.sin(yaw)+(ctx.reduced?0:(id==='agents'?1:-1)*TAU*t/96);
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
window.EXPLORE_WIDGETS={buds:buds,renew:renew,backdrop:backdrop,print:print,info:info,short:function(id){return {hero:['Portfolio','€200.4M'],counts:['Calendar','Oct 2026'],gate:['Queue','12 ready'],rule:['Library','24 records'],bars:['Volume','€200.4M'],npl:['Coverage','92.4%']}[id];},blur:blur,stack:stack,route:route};
})();
