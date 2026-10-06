/* Real HTML narrative surface; the same geometry participates in Canvas lighting and export. */
(function(){'use strict';var R=RELIEF,root=null,lastKey='',maskCache=new Map();
function layout(W,H,on,P){P=P||{};if(!on)return{panel:null,area:{x:0,y:0,w:W,h:H}};
 var narrow=W<700,pad=narrow?16:Math.max(24,W*.035),w=narrow?W-pad*2:Math.max(240,Math.min(330,W*.29)),h=narrow?Math.min(220,H*.32):Math.min(360,H*.68),y=(narrow?16:(H-h)*.32)+(+P.storyY||0)*H/100;
 pad=(narrow?pad:W*.16)+(+P.storyX||0)*W/100;
 return{panel:{x:pad,y:y,w:w,h:h},area:narrow?{x:0,y:30+h,w:W,h:Math.max(90,H-h-42)}:{x:W*.235,y:16,w:W*.765,h:H-32}};
}
function geometry(ctx,F){var p=layout(ctx.W,ctx.H,ctx.P.story,ctx.P).panel;if(!p)return null;return{id:'narrative',kind:'rect',x:p.x+p.w/2,y:p.y+p.h/2,w:p.w,h:p.h,z:(ctx.P.storyHeight==null?320:+ctx.P.storyHeight)*F.ui,rot:0,life:1,box:p};}
function copy(g,p){var compact=p.h<300,scale=compact?1:Math.min(1,p.h/340),pad=compact?16:24*scale,w=p.w-pad*2;
 var groups=[{tag:'p',text:'PORTFOLIO OVERVIEW',size:10,weight:400,y:28},{tag:'h2',text:'See the whole\npicture.',size:30,weight:400,y:65},{tag:'p',text:'Explore the records, decisions and evidence behind the numbers. The details change; the context stays in view.',size:15,weight:400,y:154},{tag:'p',text:'Fictional portfolio · 240 loans',size:11,weight:400,y:310}];
 if(p.w<280&&!compact){groups[1].size=26;groups[1].text='See the whole picture.';}
 if(compact){groups[0].size=9;groups[0].y=12;groups[1].size=24;groups[1].y=32;groups[1].text='See the whole picture.';groups[2].size=13;groups[2].y=92;groups[3].size=10;groups[3].y=p.h-25;}
 return groups.map(function(row){var px=row.size*scale,lines=[];g.font=row.weight+' '+px+'px Geist,system-ui';row.text.split('\n').forEach(function(par){var line='';par.split(' ').forEach(function(word){var next=line?line+' '+word:word;if(line&&g.measureText(next).width>w){lines.push(line);line=word;}else line=next;});lines.push(line);});return Object.assign({},row,{x:pad,y:row.y*scale,size:px,leading:px*(row.tag==='h2'?1.08:1.42),lines:lines});});
}
function mask(F){var key=F.ctx.theme,cv=maskCache.get(key);if(cv)return cv;cv=document.createElement('canvas');cv.width=cv.height=192;var g=cv.getContext('2d');g.fillStyle=R.color.css(F.tn.shadow,.24);g.fillRect(32,32,128,128);RELIEF_SOFT.blur(cv,14);maskCache.set(key,cv);return cv;}
function ground(g,n,F){if(!n||!(F.L.dens>0))return;var off=R.light.offset(F.L,n.x,n.y,n.z,0);g.save();g.globalAlpha=Math.min(.5,F.L.dens*1.7);g.drawImage(mask(F),n.x+off[0]-.75*n.w,n.y+off[1]-.75*n.h,n.w*1.5,n.h*1.5);g.restore();}
function mount(n,F,rows){if(F.ctx.capture)return;if(!root){root=document.createElement('article');root.id='narrative-panel';root.setAttribute('aria-label','Portfolio overview');root.style.cssText='position:absolute;z-index:2;box-sizing:border-box;font-family:Geist,system-ui;cursor:text;user-select:text;pointer-events:auto;overflow:hidden';F.ctx.canvas.parentElement.appendChild(root);}
 root.hidden=!n;if(!n)return;var p=n.box,key=[p.x,p.y,p.w,p.h,F.ctx.theme,F.P.temp].join('/');if(key===lastKey)return;lastKey=key;
 Object.assign(root.style,{left:p.x+'px',top:p.y+'px',width:p.w+'px',height:p.h+'px',background:R.color.css(F.tn.plate),color:R.color.css(F.T.ink)});root.replaceChildren();
 rows.forEach(function(row){var el=document.createElement(row.tag);el.textContent=row.lines.join('\n');el.style.cssText='position:absolute;margin:0;white-space:pre;font-family:Geist,system-ui;letter-spacing:0;font-weight:'+row.weight+';font-size:'+row.size+'px;line-height:'+row.leading+'px;left:'+row.x+'px;top:'+row.y+'px;';if(row.tag!=='h2')el.style.color=R.color.css(F.T.ink2);root.appendChild(el);});
}
function paint(g,n,F){if(!n){mount(null,F,[]);return;}var p=n.box,rows=copy(g,p);g.save();g.fillStyle=R.color.css(F.tn.plate);g.fillRect(p.x,p.y,p.w,p.h);
 {rows.forEach(function(row){g.font=row.weight+' '+row.size+'px Geist,system-ui';g.fillStyle=R.color.css(row.tag==='h2'?F.T.ink:F.T.ink2);g.textBaseline='top';g.textAlign='left';row.lines.forEach(function(line,i){g.fillText(line,p.x+row.x,p.y+row.y+i*row.leading+(row.leading-row.size)/2);});});}g.restore();mount(n,F,rows);}
window.RELIEF_STORY={layout:layout,geometry:geometry,ground:ground,paint:paint,copy:copy};
})();
