/* Dated iteration: suspended paper, immediate receiver shadows, no nearby floor. */
(function(){
'use strict';var R=window.RELIEF,cache=new Map();
function sprite(F,kind){var key=F.ctx.theme+'/'+kind,c=cache.get(key);if(c)return c;
 c=document.createElement('canvas');c.width=c.height=128;var q=c.getContext('2d');
 if(kind==='haze'){var gr=q.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,R.color.css(F.tn.shadow,.25));gr.addColorStop(1,R.color.css(F.tn.shadow,0));q.fillStyle=gr;q.fillRect(0,0,128,128);}
 else{q.filter='blur(5px)';q.fillStyle=R.color.css(F.tn.shadow,.16);q.beginPath();if(kind==='circle')q.arc(64,64,40,0,Math.PI*2);else q.rect(24,24,80,80);q.fill();}
 cache.set(key,c);return c;}
R.airTokens=function(theme,accent){var T=Object.assign({},R.tokens(theme,accent));function gray(c){var m=(c[0]+c[1]+c[2])/3;return [m,m,m];}
 T.accent=T.ink2.slice();T.shadowTint=gray(T.shadowTint);T.lightTint=gray(T.lightTint);
 if(theme!=='night'){T.ground=R.color.mix(gray(T.ground),T.lightTint,.38);T.plate=R.color.mix(gray(T.plate),T.lightTint,.48);}T.groundY=R.color.lum(T.ground);return T;};
R.frame=function(ctx,spec){R.seedFrom(ctx);var g=ctx.g,P=ctx.P,W=ctx.W,H=ctx.H,ui=R.ui(W,H),T=R.airTokens(ctx.theme,P.accent),tn=R.material.tints(T,+P.temp||0),L=R.light.state(P,W,H,ui),t=R.motion.time(ctx);
 L.contact=0;var F={ctx:ctx,g:g,P:P,W:W,H:H,ui:ui,u:Math.min(W,H)/48,T:T,tn:tn,L:L,tsec:t,lineW:R.lineW(ui),still:!!ctx.reduced};
 var plates=spec.plates.map(function(p,i){var m=R.motion.float(ctx.seed,p.id==null?i:p.id,t,P,p.w,p.h,p.z||0,ctx.reduced?0:Math.min(.22,p.env==null?1:p.env));return Object.assign({},p,{x:p.x+m.dx,y:p.y+m.dy,rot:(p.rot||0)+m.rot,z:Math.max(0,(p.z||0)+m.dh),h:p.kind==='circle'?p.w:p.h,src:p});});F.plates=plates;
 g.save();g.fillStyle=R.color.css(tn.ground);g.fillRect(0,0,W,H);
 // One distant, diffuse receiver rather than a pile of contact halos.
 if(L.dens>0){var off=R.light.offset(L,W/2,H/2,230*ui,0),size=Math.min(W,H)*1.15;g.save();g.globalAlpha=Math.min(.28,L.dens*.9);g.drawImage(sprite(F,'haze'),W*.52+off[0]-size/2,H*.52+off[1]-size/2,size,size);g.restore();}
 if(spec.floor)spec.floor(g,F);
 plates.slice().sort(function(a,b){return a.z-b.z;}).forEach(function(p){if(p.ghost)return;
  g.save();g.globalAlpha=p.life==null?1:p.life;g.beginPath();R.sdf.path(g,p);g.fillStyle=R.color.css(p.fill||tn.plate);g.fill('evenodd');g.clip('evenodd');
  if(spec.print)spec.print(g,p,F);
  if(L.dens>0)plates.filter(function(o){return !o.ghost&&!o.noShadow&&o.z>p.z+.01&&Math.abs(o.x-p.x)<(o.w+p.w)*.56&&Math.abs(o.y-p.y)<(o.h+p.h)*.56;}).slice(0,3).forEach(function(o){g.save();g.globalAlpha=Math.min(.5,L.dens*1.7)/(1+Math.abs(o.z-p.z)/Math.max(1,30*ui));var off=R.light.offset(L,o.x,o.y,Math.max(ui,o.z-p.z),0);g.translate(o.x+off[0],o.y+off[1]);g.rotate(o.rot||0);g.drawImage(sprite(F,o.kind),-.8*o.w,-.8*o.h,1.6*o.w,1.6*o.h);g.restore();});
  g.restore();
 });R.material.surface(g,W,H,ctx.seed,P,T);g.restore();if(spec.above){g.save();spec.above(g,F);g.restore();}R.last=F;return F;};
// Card-local ink: physical bounds, no oversized global scene typography.
R.cardInk=function(g,s,F,lines){var circle=s.kind==='circle',w=s.w,h=s.h,pad=Math.max(4,Math.min(w,h)*.12),aw=w-pad*2;
 g.save();g.translate(s.x,s.y);g.rotate(s.rot||0);if(Math.cos(s.rot||0)<0)g.rotate(Math.PI);g.textAlign=circle?'center':'left';g.textBaseline='middle';g.letterSpacing='0px';
 var compact=w<62||h<38,shown=compact?[lines[1]||lines[0]]:lines.slice(0,h>90?4:h>56?3:2),row=Math.min(22,h/(shown.length+1));
 shown.forEach(function(line,i){var value=String(line||''),px=Math.min(i===1&&!compact?22:12,row*.78,circle?w*.20:18);px=Math.max(5,px);g.font=(i===1?'500 ':'400 ')+px+'px Geist,system-ui';var max=circle?aw*.85:aw;
  if(g.measureText(value).width>max){px=Math.max(5,px*Math.max(.64,max/g.measureText(value).width));g.font=(i===1?'500 ':'400 ')+px+'px Geist,system-ui';while(value.length&&g.measureText(value+'…').width>max)value=value.slice(0,-1);if(value!==String(line||''))value+='…';}
  g.fillStyle=R.color.css(i===1||compact?F.T.ink:F.T.ink2);g.fillText(value,circle?0:-w/2+pad,(i-(shown.length-1)/2)*row);
 });g.restore();};
})();
