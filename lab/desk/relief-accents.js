/* Seeded compound silhouettes. One path drives paper, clipping, picking and shadows. */
(function(){'use strict';var R=RELIEF,TAU=Math.PI*2,hit=document.createElement('canvas').getContext('2d');
function decorate(nodes,ctx){var amount=Math.max(0,+ctx.P.accentForms||0),ids=['ag2','st1','ag4','stages','ag1','st2'],count=Math.min(ids.length,Math.round(amount/100*ids.length));
 nodes.forEach(function(n){var i=ids.indexOf(n.id);if(i>=0&&i<count){n.accent=i%2?'trefoil':'clover';n.accentAngle=(R.stream(ctx.seed,'accent/'+n.id)()-.5)*.35;}else if(n.id==='st0'&&amount>0)n.accent='sphere';});
}
function path(g,kind,x,y,w,h,angle){g.beginPath();var r=Math.min(w,h);g.save();g.translate(x,y);g.rotate(angle||0);
 if(kind==='clover'){for(var i=0;i<4;i++){var a=Math.PI/4+i*TAU/4,cx=Math.cos(a)*r*.235,cy=Math.sin(a)*r*.235;g.moveTo(cx+r*.32,cy);g.arc(cx,cy,r*.32,0,TAU);}}
 else if(kind==='trefoil'){for(var i=0;i<3;i++){var a=-Math.PI/2+i*TAU/3,cx=Math.cos(a)*r*.19,cy=Math.sin(a)*r*.19;g.moveTo(cx+r*.31,cy);g.arc(cx,cy,r*.31,0,TAU);}}
 else g.arc(0,0,r/2,0,TAU);g.restore();
}
function flow(t){var a=TAU*t/18;return [Math.sin(a)*.16,Math.cos(a)*.13,Math.sin(2*a+1)*.15,Math.cos(2*a+1)*.12];}
function paint(g,n,F){var gain=Math.max(0,+F.P.reliefStrength||0)/55;path(g,n.accent,0,0,n.w,n.h,n.accentAngle);g.save();g.clip();
 g.fillStyle=R.color.css(R.color.mix(F.tn.ground,F.tn.plate,.28));g.fillRect(-n.w/2,-n.h/2,n.w,n.h);
 if(n.accent==='sphere'){
  var rad=n.w/2,q=flow(F.ctx.reduced?0:F.tsec),shade=g.createRadialGradient(-rad*.28,-rad*.35,rad*.08,0,0,rad);
  shade.addColorStop(0,R.color.css(F.T.lightTint,.20));shade.addColorStop(.48,R.color.css(F.tn.shadow,.008*gain));shade.addColorStop(1,R.color.css(F.tn.shadow,.075*gain));g.fillStyle=shade;g.fillRect(-rad,-rad,n.w,n.h);
  for(var i=0;i<2;i++){var x=q[i*2]*n.w,y=q[i*2+1]*n.h,gr=g.createRadialGradient(0,0,0,0,0,rad*.88);gr.addColorStop(0,R.color.css(F.tn.shadow,.08*gain));gr.addColorStop(.5,R.color.css(F.tn.shadow,.035*gain));gr.addColorStop(1,R.color.css(F.tn.shadow,0));g.save();g.translate(x,y);g.rotate((i?-.4:.7)+(F.ctx.reduced?0:F.tsec*TAU/18)*(i?2:1));g.scale(1,.43);g.fillStyle=gr;g.fillRect(-n.w,-n.h,n.w*2,n.h*2);g.restore();}
 }g.restore();
}
function contains(n,x,y){path(hit,n.accent,0,0,n.w,n.h,n.accentAngle);return hit.isPointInPath(x,y);}
window.RELIEF_ACCENT={decorate:decorate,path:path,paint:paint,contains:contains,flow:flow};
})();
