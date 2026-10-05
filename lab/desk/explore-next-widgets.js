// Cached flat ink, gently defocused distance and deterministic peripheral routing.
(function(){
'use strict';
var R=RELIEF,K=RINK,TAU=Math.PI*2,blurred=new WeakMap();
var labels={hero:['Portfolio overview','€200.4M','240 loans'],counts:['Review calendar','October 2026','8 scheduled reviews'],gate:['Decision queue','12 ready','4 in review'],rule:['Document library','24 records','Contracts and policies'],bars:['Monthly volume','€200.4M','12 months'],npl:['Coverage','92.4%','Verified records']};
function info(id,sample){var v=sample||0,out=labels[id].slice();if(id==='hero'){out[0]=['Portfolio overview','Consumer loans','Business loans'][v];out[1]=['€200.4M','€84.7M','€115.7M'][v];out[2]=['240 loans','156 loans','84 loans'][v];}if(id==='npl')out[1]=['92.4%','96.8%','89.6%'][v];if(id==='gate')out[1]=[12,8,17][v]+' ready';return out;}
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
  text('October 2026',l,t+25,17);
  var gridTop=t+46,cw=iw/7,ch=(b-gridTop)/6;
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
  text(content[1],l,t+52,32);text('Verified records',l,t+76,12,'left',I.ink2);
  text('Source checked',l,b-20,11,'left',I.ink2);text('Updated 09:42',l,b,10,'left',I.ink3);
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
function stack(g,n,F){
 var hub=F.hub||{x:F.W/2,y:F.H*.52},dx=hub.x-n.x,dy=hub.y-n.y,len=Math.hypot(dx,dy)||1;
 var c=Math.cos(n.rot),s=Math.sin(n.rot),step=6*F.ui;
 var ux=(dx*c+dy*s)/len,uy=(-dx*s+dy*c)/len;
 for(var j=2;j>=1;j--){var shrink=1-j*.018,x=ux*j*step,y=uy*j*step,w=n.w*shrink,h=n.h*shrink;g.fillStyle=R.color.css(F.tn.plate);g.fillRect(x-w/2,y-h/2,w,h);g.fillStyle=R.color.css(F.tn.shadow,j===2?.025:.012);g.fillRect(x-w/2,y-h/2,w,h);}
 layer(g,0,0,n.w,n.h,F);
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
var budCopy={
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
  var rand=R.stream(F.ctx.seed,'buds/'+n.id+'/'+n.generation),axis=Math.atan2(n.y-hub.y,n.x-hub.x),copy=budCopy[n.contentId||n.id];
  for(var i=0;i<3;i++){
   var delay=.7+i*.8+rand()*1.4,duration=4+rand()*2.1,size=.90+rand()*.16,a=axis+(i-1)*.72;
   var age=n.birthAge-delay,appear=smooth(age/.55),finish=smooth((age-duration)/.55),lineFade=1-finish;
   if(age<0||lineFade<=0)continue;
   var w=(i===1?94:112)*U*size,h=(i===1?44:52)*U*size;
   var edge=1/Math.max(Math.abs(Math.cos(a))/(n.w/2),Math.abs(Math.sin(a))/(n.h/2));
   var distance=edge+Math.abs(Math.cos(a))*w/2+Math.abs(Math.sin(a))*h/2+16*U;
   var x=n.x+Math.cos(a)*distance*(.82+.18*appear),y=n.y+Math.sin(a)*distance*(.82+.18*appear);
   x=Math.max(w/2+8,Math.min(F.W-w/2-8,x));y=Math.max(h/2+8,Math.min(F.H-h/2-8,y));
   g.save();g.globalAlpha=appear*lineFade*.35;g.strokeStyle=I.ink3;g.lineWidth=.65*U;g.beginPath();g.moveTo(n.x,n.y);g.quadraticCurveTo((n.x+x)/2-4*U,(n.y+y)/2+6*U,x,y);g.stroke();
   var alpha=appear*(1-finish);
   if(alpha>0){g.globalAlpha=alpha;layer(g,x,y,w,h,F);
    g.textAlign='left';g.textBaseline='middle';g.fillStyle=I.ink2;g.font='400 '+(10*U*size)+'px Geist,system-ui';
    g.fillText(age>duration-.65?'Completed':copy[i][0],x-w/2+10*U,y-h*.19);
    g.fillStyle=I.ink;g.font='500 '+(12*U*size)+'px Geist,system-ui';g.fillText(copy[i][1],x-w/2+10*U,y+h*.19);
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
