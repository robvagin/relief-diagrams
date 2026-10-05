// Floating US Letter graph. One common orbit, five gently deforming papers, no support plane.
(function () {
  'use strict';
  var R=window.RELIEF, K=window.RINK, Wd=window.WIDGETS, TAU=Math.PI*2;
  var placement=[['hero',-.82,-.22,.42,true],['gate',.84,.03,.18,true],
    ['rule',.30,.86,-.38,false],['bars',-.65,.66,-.52,true],['npl',-.20,-.85,-.65,false]];
  var S={G:null,key:'',last:[],textures:new Map(),shadows:null};
  function world(ctx,t) {
    var P=ctx.P, W=ctx.W,H=ctx.H,ui=R.ui(W,H),unit=Math.min(W/5.7,H/5.0), cx=W/2,cy=H/2+12*ui;
    var period=Math.max(48,+P.orbitPeriod||144), phase=TAU*t/period;
    var yaw=TAU*(+P.orbitAngle||0)/360+(ctx.reduced||!+P.orbit?0:phase), c=Math.cos(yaw),s=Math.sin(yaw);
    var drift=ctx.reduced?0:(+P.air||0), flex=+P.flex||0, depth=+P.depthView||0, radius=+P.spread||1;
    var nodes=placement.map(function(q,i){
      var ph=i*1.47, wave=phase*4+ph;
      var xx=q[1]+drift*.025*Math.sin(wave), yy=q[2]+drift*.035*Math.sin(phase*3+ph), zz=q[3]+drift*.035*Math.cos(wave);
      var x=xx*c+zz*s, z=-xx*s+zz*c, scale=1+.045*depth*z;
      var short=unit*scale,long=short*11/8.5, sheet=Wd.SHEETS.filter(function(a){return a.id===q[0];})[0];
      return {id:q[0],shape:'sheet',x:cx+x*W*.28*radius,y:cy+yy*H*.31*radius-z*depth*H*.055,
        w:q[4]?long:short,h:q[4]?short:long,z:2,height:(150+32*depth*z)*ui,
        rot:(i%2?1:-1)*.025+drift*.024*Math.sin(wave),
        bend:flex*(.022+.012*Math.sin(ctx.reduced?ph:phase*4+ph)),
        shear:flex*(.016*Math.sin(ctx.reduced?ph:phase*3+ph)),
        fixed:true,info:sheet.info(),print:sheet.print,depth:z};
    });
    nodes.unshift({id:'hub',shape:'disc',x:cx,y:cy,w:66*ui,h:66*ui,z:2,height:150*ui,rot:0,fixed:true,
      info:['Loan book','240 loans','€200.4M','One model of record'],depth:0});
    return nodes;
  }
  function pick(x,y) {
    for(var i=S.last.length-1;i>=0;i--){var n=S.last[i],dx=x-n.sx,dy=y-n.sy,c=Math.cos(-n.srot),s=Math.sin(-n.srot);
      if(n.shape==='disc'?Math.hypot(dx,dy)<=n.sw/2+4:Math.abs(c*dx-s*dy)<=n.sw/2+5&&Math.abs(s*dx+c*dy)<=n.sh/2+5)return n.i;
    }return -1;
  }
  function graph(ctx,nodes) {
    var key=ctx.W+'|'+ctx.H;
    if(!S.G||key!==S.key){
      var gn=nodes.map(function(n){return {id:n.id,x:n.x,y:n.y,r:0,fixed:true};});
      S.G=R.graph.create(gn,nodes.slice(1).map(function(n,i){return {a:0,b:i+1};}),{});
      var G=S.G;G.fit={s:1,cx:ctx.W/2,cy:ctx.H/2};G.home={zoom:1,x:ctx.W/2,y:ctx.H/2};G.view=Object.assign({},G.home);G._viewed=true;
      G.describe=function(i){return nodes[i].info;};
      if(!ctx.capture)R.graph.bind(G,ctx.canvas,pick,function(){S.shadows=null;});
      S.key=key;
    }
    nodes.forEach(function(n,i){S.G.nodes[i].x=n.x;S.G.nodes[i].y=n.y;});
    S.G.sync(ctx,{drift:0,repel:0});return S.G;
  }
  function texture(n,F) {
    var compact=n.w<120, bucket=compact?Math.round(n.w/8)*8:0;
    var key=[n.id,(n.w/n.h).toFixed(6),bucket,F.ctx.theme,F.P.accent,+F.P.temp].join('|'),cached=S.textures.get(key);
    if(cached)return cached;
    var w=480,h=Math.round(w*n.h/n.w),cv=document.createElement('canvas');cv.width=w;cv.height=h;
    var g=cv.getContext('2d');g.fillStyle=R.color.css(F.tn.plate);g.fillRect(0,0,w,h);
    g.translate(w/2,h/2);g.scale(2,2);
    if(compact){
      var scale=240/bucket,lines=n.info||[],max=216;
      g.textAlign='center';g.textBaseline='middle';g.fillStyle=R.color.css(F.T.ink);
      lines.slice(0,2).forEach(function(line,i){
        var text=String(line);g.font='400 '+(i?12:10)*scale+'px Geist,system-ui';
        while(text.length&&g.measureText(text+'…').width>max)text=text.slice(0,-1);
        if(text!==String(line))text+='…';g.fillText(text,0,(i?9:-9)*scale);
      });
    }else n.print(g,Object.assign({},F,{ui:1}),K.inks(F),240,h/2,n);
    S.textures.set(key,cv);if(S.textures.size>24)S.textures.delete(S.textures.keys().next().value);return cv;
  }
  // An affine strip mesh warps the ink and paper together, with continuous position at strip seams.
  function offset(n,v){return n.w*(n.bend*Math.sin(Math.PI*(v+.5))+n.shear*v);}
  function outline(g,n) {
    g.beginPath();var steps=20;
    for(var side=0;side<2;side++)for(var j=0;j<=steps;j++){
      var v=side?.5-j/steps:-.5+j/steps,x=(side?1:-1)*n.w/2+offset(n,v),y=v*n.h;
      if(!side&&!j)g.moveTo(x,y);else g.lineTo(x,y);
    }g.closePath();
  }
  function paper(g,n,F) {
    var cv=texture(n,F),steps=24;
    g.save();g.translate(n.x,n.y);g.rotate(n.rot);outline(g,n);g.clip();
    for(var i=0;i<steps;i++){
      var v0=-.5+i/steps,v1=-.5+(i+1)/steps,y0=v0*n.h,hh=n.h/steps;
      var x0=offset(n,v0),x1=offset(n,v1);
      g.save();g.transform(1,0,(x1-x0)/hh,1,x0,y0);
      g.drawImage(cv,0,i*cv.height/steps,cv.width,cv.height/steps+.35*cv.height/n.h,-n.w/2,0,n.w,hh+.35);
      g.restore();
    }
    // A very small matte tonal variation follows the bend; no specular highlight.
    R.material.sag(g,{kind:'rect',x:0,y:0,w:n.w,h:n.h,z:n.z},F.L,F.tn,Math.min(.035,Math.abs(n.bend)*.9));
    g.restore();
  }
  function shadeClip(g,n,field) {
    if(!field)return;
    g.save();g.translate(n.x,n.y);g.rotate(n.rot);
    if(n.kind==='circle'){g.beginPath();g.arc(0,0,n.w/2,0,TAU);}else outline(g,n);
    g.clip();g.rotate(-n.rot);g.translate(-n.x,-n.y);R.shade.put(g,field);g.restore();
  }
  function connectors(nodes,F) {
    var list=[],root=nodes[0], segments=28;
    nodes.slice(1).forEach(function(n,i){
      var dx=n.x-root.x,dy=n.y-root.y,dist=Math.hypot(dx,dy)||1;
      var bow=(i%2?1:-1)*dist*.10, last=null;
      for(var j=0;j<=segments;j++){
        var u=j/segments, curve=Math.sin(Math.PI*u);
        var p={x:root.x+dx*u-dy/dist*bow*curve,y:root.y+dy*u+dx/dist*bow*curve,z:root.z+(n.z-root.z)*u-5*F.ui*curve};
        if(last)list.push({line:true,a:last,b:p,z:(last.z+p.z)/2});last=p;
      }
    });return list;
  }
  function draw(ctx) {
    var nodes=world(ctx,R.motion.time(ctx)),G=graph(ctx,nodes),zoom=G.view.zoom,g=ctx.g,ui=R.ui(ctx.W,ctx.H),P=ctx.P;
    var T=R.tokens(ctx.theme,P.accent),tn=R.material.tints(T,+P.temp||0),L=R.light.state(P,ctx.W,ctx.H,ui);
    // Zero local contact is deliberate: there is no nearby desk under these papers.
    L.contact=0;
    var F={ctx:ctx,P:P,W:ctx.W,H:ctx.H,ui:ui,T:T,tn:tn,L:L,lineW:R.lineW(ui),tsec:R.motion.time(ctx)};
    var plates=nodes.map(function(n,i){var st=G.state(i),p=G.toScreen(st.x,st.y);
      return Object.assign({},n,{i:i,kind:n.shape==='disc'?'circle':'rect',x:p[0],y:p[1],w:n.w*zoom,h:n.h*zoom,z:(n.height+st.lift*5*ui)*Math.sqrt(zoom),r:1.5*ui});
    });
    S.last=plates.map(function(p){return {i:p.i,id:p.id,shape:p.shape,sx:p.x,sy:p.y,sw:p.w,sh:p.h,srot:p.rot,node:nodes[p.i]};}).sort(function(a,b){return a.node.height-b.node.height;});
    ORG.state.G=G;ORG.state.last=S.last;
    g.save();g.fillStyle=R.color.css(tn.ground);g.fillRect(0,0,ctx.W,ctx.H);
    var sk=[Math.floor(ctx.t/4),ctx.W,ctx.H,zoom,G.view.x,G.view.y,P.orbitAngle,P.depthView,P.flex,P.air,P.backdrop,P.dens,P.soft].join('|');
    if(!S.shadows||S.shadows.key!==sk){
      R.shade.recycle();var fields={};
      // Backdrop receives only an extremely diffuse, distant trace of the whole ensemble.
      var far=Object.assign({},L,{soft:1.1,dens:.035*(+P.backdrop||0),contact:0});
      var ground=R.shade.layer(far,[0,0,ctx.W,ctx.H],0,plates,tn.shadow);
      plates.forEach(function(n){
        var ex=Math.hypot(n.w,n.h)/2+8*ui;
        fields[n.id]=R.shade.layer(L,[Math.floor(n.x-ex),Math.floor(n.y-ex),Math.ceil(ex*2),Math.ceil(ex*2)],n.z,plates.filter(function(o){return o.z>n.z;}),tn.shadow);
      });S.shadows={key:sk,ground:ground,fields:fields};
    }
    R.shade.put(g,S.shadows.ground);
    var items=plates.concat(connectors(plates,F)).sort(function(a,b){return a.z-b.z;});
    items.forEach(function(n){
      if(n.line){
        g.lineWidth=Math.max(.6,F.lineW*.65);g.lineCap='round';
        g.strokeStyle=R.color.css(T.ink2,.32);g.beginPath();g.moveTo(n.a.x,n.a.y);g.lineTo(n.b.x,n.b.y);g.stroke();
        g.strokeStyle=R.color.css(tn.light,.38);var ox=-L.l[0]*.6*ui,oy=-L.l[1]*.6*ui;
        g.beginPath();g.moveTo(n.a.x+ox,n.a.y+oy);g.lineTo(n.b.x+ox,n.b.y+oy);g.stroke();return;
      }
      if(n.kind==='circle'){
        g.fillStyle=R.color.css(tn.plate);g.beginPath();g.arc(n.x,n.y,n.w/2,0,TAU);g.fill();
        K.text(g,F,'Loan book',n.x,n.y-6*ui*zoom,{px:9*ui*zoom,min:1,align:'center',color:R.color.css(T.ink2)});
        K.text(g,F,'240',n.x,n.y+12*ui*zoom,{px:21*ui*zoom,min:1,align:'center',weight:500,color:R.color.css(T.ink)});
      }else paper(g,n,F);
      shadeClip(g,n,S.shadows.fields[n.id]);
    });
    R.material.surface(g,ctx.W,ctx.H,ctx.seed,P,T);
    var m=.06*Math.min(ctx.W,ctx.H),I=K.inks(F);
    K.text(g,F,'Loan book',m,m+20*ui,{size:5,weight:600,color:I.ink,min:10});
    K.text(g,F,'US Letter · floating graph',m,m+40*ui,{size:1,mono:true,color:I.ink3,min:7});
    K.text(g,F,'Fictional data · as of 30 Sep 2026',ctx.W-m,ctx.H-m/2,{size:1,mono:true,color:I.ink3,align:'right',min:7});
    g.restore();F.plates=plates;R.last=F;
    window.__ORG={nodes:nodes.length,links:5,zoom:zoom};
  }
  window.LETTER={world:world,state:S};
  RELIEF_APP.run({id:'desk',title:'Letter · floating graph',blurb:'Five connected paper sheets around one model of record, suspended in space.',
    hint:'One slow shared orbit. Paper and ink flex together. Tap a sheet for details; pinch or scroll to inspect.',
    rows:{scene:[['orbit', 'Orbit', 0,1,1,1],['orbitPeriod', 'Orbit period, s', 48,240,1,144],['orbitAngle', 'Angle, degrees', 0,360,1,0],
      ['depthView', 'Depth', 0,1,0.01,0.65],['air', 'Float', 0,2,0.01,1],['flex', 'Paper flex', 0,2,0.01,1],['backdrop', 'Backdrop shadow', 0,1,0.01,0.35]]},
    draw:draw,structural:function(){S.shadows=null;S.textures.clear();},
    capture:function(ctx){var save={G:S.G,key:S.key,last:S.last,shadows:S.shadows},last=R.last,org={G:ORG.state.G,last:ORG.state.last};
      S.G=null;S.shadows=null;try{draw(ctx);}finally{Object.assign(S,save);Object.assign(ORG.state,org);R.last=last;S.shadows=null;}}
  },{variant:'v4',name:'Floating graph',defaults:{orbit:1,orbitPeriod:144,orbitAngle:0,depthView:.65,air:1,flex:1,backdrop:.35,float:0,parallax:0,wind:0,assemble:0}});
})();
