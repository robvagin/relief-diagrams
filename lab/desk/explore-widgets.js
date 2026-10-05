// Cached flat ink, gently defocused distance and deterministic peripheral routing.
(function(){
'use strict';
var R=RELIEF,K=RINK,TAU=Math.PI*2,blurred=new WeakMap();
var labels={hero:['Portfolio overview','€200.4M','240 loans'],counts:['Review calendar','October 2026','8 scheduled reviews'],gate:['Decision queue','12 ready','4 in review'],rule:['Document library','24 records','Contracts and policies'],bars:['Monthly volume','€200.4M','12 months'],npl:['Coverage','92.4%','Verified records']};
function info(id){return labels[id];}
function print(id,mode){return function(g,F,I,w,h){
 var l=-w/2+16,r=w/2-16,t=-h/2+20,b=h/2-18,iw=r-l,ih=b-t;
 function text(s,x,y,px,al,color){K.text(g,F,s,x,y,{px:Math.max(12,px),min:1,align:al||'left',color:color||I.ink});}
 function line(x,y,xx,yy){g.strokeStyle=I.line;g.lineWidth=.8;g.beginPath();g.moveTo(x,y);g.lineTo(xx,yy);g.stroke();}
 text(labels[id][0],l,t,10,'left',I.ink2);
 if(id==='hero'){
  text('€200.4M',l,t+42,35);text('240 loans  ·  +7.9%',l,t+63,11,'left',I.ink2);
  var vals=[.3,.42,.36,.53,.47,.65,.61,.76,.72,.88,.84,.95],yy=b-8,hh=Math.max(18,ih-92);
  vals.forEach(function(v,i){g.fillStyle=i===11?I.acc:I.ink3;g.fillRect(l+i*iw/12,yy-v*hh,iw/12-5,v*hh);});
 }else if(id==='counts'){
  text('October 2026',l,t+25,17);var top=t+48,cw=iw/7,ch=Math.max(14,(ih-52)/6);
  'MTWTFSS'.split('').forEach(function(d,i){text(d,l+(i+.5)*cw,top,9,'center',I.ink3);});
  for(var day=1;day<=31;day++){var slot=day+2,x=l+(slot%7+.5)*cw,y=top+(1+Math.floor(slot/7))*ch;
   if([6,9,13,16,20,23,27,30].indexOf(day)>=0){K.dot(g,x,y-3,Math.min(cw,ch)*.39,I.line);K.dot(g,x,y+4,1.3,I.acc);}
   text(String(day),x,y,9,'center');}
 }else if(id==='npl'){
  var cy=t+ih*.53,rad=Math.min(iw*.34,ih*.31);g.lineWidth=7;g.strokeStyle=I.line;g.beginPath();g.arc(0,cy,rad,0,TAU);g.stroke();g.strokeStyle=I.ink2;g.beginPath();g.arc(0,cy,rad,-Math.PI/2,-Math.PI/2+TAU*.924);g.stroke();
  text('92.4%',0,cy+6,22,'center');text('verified',0,b,10,'center',I.ink2);
 }else if(id==='gate'){
  text('12 ready',l,t+34,25);var rows=[['Approved',.75],['In review',.25],['Blocked',.125]];
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
 var quiet=F.ctx.reduced||!+F.P.refresh,phase=quiet?0:((F.tsec+(['rule','counts','gate','hero','npl','bars'].indexOf(n.id))*7)%36)/36;
 var pulse=quiet?0:Math.pow(Math.sin(Math.PI*phase),8),I=K.inks(F);
 for(var j=3;j>=1;j--){var off=j*3*F.ui;g.fillStyle=R.color.css(F.tn.plate);g.fillRect(-n.w/2+off,-n.h/2+off,n.w,n.h);g.strokeStyle=I.line;g.lineWidth=.5;g.beginPath();g.moveTo(-n.w/2+off,n.h/2+off);g.lineTo(n.w/2+off,n.h/2+off);g.stroke();}

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
  g.globalAlpha=Math.min(.045,F.L.dens*.13)*(n.life==null?1:n.life);
  g.drawImage(sprite,n.x+offset[0]-w/2,n.y+offset[1]-h/2,w,h);
 });g.restore();
}
function route(nodes,ctx,yaw){
 var small=nodes.filter(function(n){return n.shape==='disc'&&n.id!=='hub'&&n.id!=='st0';});
 small.forEach(function(n){n.w=Math.max(28,n.w);n.h=n.w;});
 var cards=nodes.filter(function(n){return small.indexOf(n)<0;}),W=ctx.W,H=ctx.H,cx=W/2,cy=H*.52;
 var rx=W*.43,ry=H*.40,maxRadius=Math.max.apply(null,small.map(function(n){return n.w/2;}));
 // Reserve a continuous outer lane. The bodies keep their size and only their centre is compressed.
 cards.forEach(function(n){var ex=(Math.abs(Math.cos(n.rot))*n.w+Math.abs(Math.sin(n.rot))*n.h)/2,
 ey=(Math.abs(Math.sin(n.rot))*n.w+Math.abs(Math.cos(n.rot))*n.h)/2;
 var body=Math.hypot(ex/rx,ey/ry),limit=Math.max(.08,1-body-(maxRadius+12)/Math.min(rx,ry));
 var dx=(n.x-cx)/rx,dy=(n.y-cy)/ry,d=Math.hypot(dx,dy),k=d>0?limit*Math.tanh(d/limit)/d:1;
 n.x=cx+dx*rx*k;n.y=cy+dy*ry*k;
 });
 small.forEach(function(n,i){var a=-Math.PI*.70+i*TAU/small.length+.13*Math.sin(yaw+i*.6);
  // Lane bulges gently toward the closest moving body, without switching routes.
  var pressure=0;cards.forEach(function(o){var dx=(o.x-cx)/rx,dy=(o.y-cy)/ry;
   pressure+=Math.exp(-8*Math.pow(-dx*Math.sin(a)+dy*Math.cos(a),2))*Math.max(0,dx*Math.cos(a)+dy*Math.sin(a));});
  var f=.98+.02*Math.tanh(pressure);n.x=cx+Math.cos(a)*rx*f;n.y=cy+Math.sin(a)*ry*f;
 });
}
window.EXPLORE_WIDGETS={backdrop:backdrop,print:print,info:info,short:function(id){return {hero:['Portfolio','€200.4M'],counts:['Calendar','Oct 2026'],gate:['Queue','12 ready'],rule:['Library','24 records'],bars:['Volume','€200.4M'],npl:['Coverage','92.4%']}[id];},blur:blur,stack:stack,route:route};
})();
