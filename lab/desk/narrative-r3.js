/* Real HTML narrative surface; the same geometry participates in Canvas lighting and export. */
(function(){'use strict';var R=RELIEF,root=null,lastKey='',maskCache=new Map();
var measure=document.createElement('canvas').getContext('2d'),observedHeight=0,observedWidth=0;
function copy(g,p){var pad=p.w<320?20:24,w=p.w-pad*2,y=pad;
 var groups=[{tag:'p',text:'PORTFOLIO OVERVIEW',size:10,leading:14,gap:10,tracking:.5},{tag:'h2',text:'See the whole picture.',size:26,leading:32,gap:14,tracking:0},{tag:'p',text:'Records, decisions and evidence in one view. Details change; context stays.',size:14,leading:21,gap:18,tracking:0},{tag:'p',text:'Fictional portfolio · 240 loans',size:10,leading:14,gap:0,tracking:.15}];
 var rows=groups.map(function(row){var lines=[],line='';g.font='400 '+row.size+'px Geist,system-ui';row.text.split(' ').forEach(function(word){var next=line?line+' '+word:word;if(line&&g.measureText(next).width+next.length*row.tracking>w){lines.push(line);line=word;}else line=next;});lines.push(line);var r=Object.assign({},row,{weight:400,x:pad,y:y,lines:lines});y+=lines.length*row.leading+row.gap;return r;});rows.height=y+pad;rows.pad=pad;return rows;
}
function layout(W,H,on,P){P=P||{};if(!on)return{panel:null,area:{x:0,y:0,w:W,h:H}};
 var narrow=W<700,w=narrow?W-32:Math.max(240,Math.min(300,W*.29)),rows=copy(measure,{w:w}),h=rows.height;
 if(Math.abs(observedWidth-w)<1)h=Math.max(h,observedHeight);h=Math.min(h,Math.max(120,H-32));
 var x=(narrow?16:W*.16)+(+P.storyX||0)*W/100,y=(narrow?16:(H-h)*.32)+(+P.storyY||0)*H/100;
 return{panel:{x:x,y:y,w:w,h:h},area:narrow?{x:0,y:30+h,w:W,h:Math.max(90,H-h-42)}:{x:W*.235,y:16,w:W*.765,h:H-32}};
}
function geometry(ctx,F){var p=layout(ctx.W,ctx.H,ctx.P.story,ctx.P).panel;if(!p)return null;return{id:'narrative',kind:'rect',x:p.x+p.w/2,y:p.y+p.h/2,w:p.w,h:p.h,z:(ctx.P.storyHeight==null?320:+ctx.P.storyHeight)*F.ui,rot:0,life:1,box:p};}
function mask(F){var key=F.ctx.theme,cv=maskCache.get(key);if(cv)return cv;cv=document.createElement('canvas');cv.width=cv.height=192;var g=cv.getContext('2d');g.fillStyle=R.color.css(F.tn.shadow,.24);g.fillRect(32,32,128,128);RELIEF_SOFT.blur(cv,14);maskCache.set(key,cv);return cv;}
function ground(g,n,F){if(!n||!(F.L.dens>0))return;var off=R.light.offset(F.L,n.x,n.y,n.z,0);g.save();g.globalAlpha=Math.min(.5,F.L.dens*1.7);g.drawImage(mask(F),n.x+off[0]-.75*n.w,n.y+off[1]-.75*n.h,n.w*1.5,n.h*1.5);g.restore();}
function mount(n,F,rows){if(F.ctx.capture)return;if(!root){root=document.createElement('article');root.id='narrative-panel';root.setAttribute('aria-label','Portfolio overview');root.style.cssText='position:absolute;z-index:2;box-sizing:border-box;font-family:Geist,system-ui;cursor:text;user-select:text;pointer-events:auto;overflow:auto;font-kerning:normal';F.ctx.canvas.parentElement.appendChild(root);if(window.ResizeObserver)new ResizeObserver(function(){observedHeight=root.offsetHeight;observedWidth=root.offsetWidth;}).observe(root);}
 root.hidden=!n;if(!n)return;var p=n.box,key=[p.x,p.y,p.w,p.h,F.ctx.H,F.ctx.theme,F.P.temp].join('/');if(key===lastKey)return;lastKey=key;
 Object.assign(root.style,{left:p.x+'px',top:p.y+'px',width:p.w+'px',height:'auto',minHeight:rows.height+'px',maxHeight:Math.max(120,F.ctx.H-32)+'px',padding:rows.pad+'px',background:R.color.css(F.tn.plate),color:R.color.css(F.T.ink)});root.replaceChildren();
 rows.forEach(function(row){var el=document.createElement(row.tag);el.textContent=row.text;el.style.cssText='position:static;margin:0 0 '+row.gap+'px;white-space:normal;overflow-wrap:break-word;font-family:Geist,system-ui;letter-spacing:'+row.tracking+'px;font-weight:400;font-size:'+row.size+'px;line-height:'+row.leading+'px;';if(row.tag!=='h2')el.style.color=R.color.css(F.T.ink2);root.appendChild(el);});
}
function paint(g,n,F){if(!n){mount(null,F,[]);return;}var p=n.box,rows=copy(g,p);g.save();g.fillStyle=R.color.css(F.tn.plate);g.fillRect(p.x,p.y,p.w,p.h);
 {rows.forEach(function(row){g.font=row.weight+' '+row.size+'px Geist,system-ui';g.fillStyle=R.color.css(row.tag==='h2'?F.T.ink:F.T.ink2);g.textBaseline='top';g.textAlign='left';if('letterSpacing' in g)g.letterSpacing=row.tracking+'px';row.lines.forEach(function(line,i){g.fillText(line,p.x+row.x,p.y+row.y+i*row.leading+(row.leading-row.size)/2);});});}g.restore();mount(n,F,rows);}
window.RELIEF_STORY={layout:layout,geometry:geometry,ground:ground,paint:paint,copy:copy};
})();
