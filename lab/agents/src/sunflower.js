/* The retained phyllotaxis data grammar, without the agent organism. */
(function(){'use strict';var R=RELIEF,AV=AVIEWS;
R.def={id:'agents',title:'Data · Sunflower',blurb:'One point is one loan. Compact families preserve the original phyllotaxis layout.',groups:{'Data':[['viewData','View',['A2','A3','A5'],'A5',['Purchase review','Mapped fields','Next action']]]},draw:function(ctx){
 var W=ctx.W,H=ctx.H,ui=R.ui(W,H),m=Math.max(24,Math.min(W,H)*.07),t=R.motion.time(ctx),view=ctx.P.viewData||'A5',loans=ctx.data.loans;
 var sheet={id:'data',kind:'rect',x:W/2,y:H*.51,w:W-2*m,h:Math.min(H*.62,(W-2*m)*.70),z:18*ui,env:0,r:0};
 R.frame(ctx,{plates:[sheet],floor:function(g,F){R.ink.text(g,F,'Sunflower · '+loans.length+' loan records',m,m+12,{s:2,w:400});R.ink.fictional(g,F);},print:function(g,s,F){
  var pad=Math.max(18,s.w*.04),rect=[s.x-s.w/2+pad,s.y-s.h/2+pad+36,s.w-2*pad,s.h-2*pad-65],v=AV.VIEWS[view](loans,rect,F);g.save();
  R.ink.text(g,F,{A2:'Purchase review',A3:'Fields mapped',A5:'Next recovery action'}[view],rect[0],s.y-s.h/2+pad+10,{s:2,w:400});
  v.pos.forEach(function(p,id){AV.shapeDraw(g,p[0],p[1],v.r,p[2],R.color.css(F.T.ink2,p[2]==='faint'?.25:.82),F);});if(v.marks)v.marks(g,F,1);
  R.ink.text(g,F,'One point = one loan · fictional portfolio',rect[0],s.y+s.h/2-pad,{s:0,tone:'ink3'});g.restore();window.SUNFLOWER={points:v.pos.size,groups:v.labels||[],view:view};
 }});
}};})();
