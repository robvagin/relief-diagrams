// Original desk mobile with a shared orbit and inexpensive overlap-only shadows.
(function () {
  'use strict';
  var R=window.RELIEF, K=window.RINK, Wd=window.WIDGETS, TAU=Math.PI*2;
  var D=Wd.D;
  function model(F, P) {
    var W = F.W, H = F.H, S = Math.min(W, H), cx = W / 2, cy = H / 2 + 0.02 * H, sp = +P.spread;
    var RX = (W / 2 - F.m) * sp, RY = (H / 2 - F.m) * sp;
    var unit = 0.3 * S, chain = [], nodes = [], links = [];
    var hub = { id: 'hub', shape: 'disc', w: 0.13 * S, h: 0.13 * S, z: 2, info: ['Loan book', '240 loans', '€200.4M'] };
    hub.print = Wd.W.bead('Loan book', '240');
    chain.push({ id: 'hub', rest: [0, 0], amp: 0 }); nodes.push(hub);
    // элементы люстры по кругу: угол по ритму «крупный · мелкий · средний · мелкий», hero слева сверху (к свету)
    var items = [
      { id: 'hero', ang: -152, f: 0.6, sheet: 'hero', z: 3, amp: 1.6 },
      { id: 'stages', ang: -38, f: 0.62, cluster: 'stages', z: 2, amp: 2.4 },
      { id: 'gate', ang: 18, f: 0.66, sheet: 'gate', z: 2, amp: 2.0 },
      { id: 'rule', ang: 62, f: 0.86, sheet: 'rule', z: 1, amp: 3.0 },
      { id: 'agents', ang: 102, f: 0.62, cluster: 'agents', z: 2, amp: 2.6 },
      { id: 'bars', ang: 136, f: 0.74, sheet: 'bars', z: 1, amp: 2.2 },
      { id: 'npl', ang: 176, f: 0.9, sheet: 'npl', z: 1, amp: 3.2 },
      { id: 'counts', ang: -92, f: 0.88, sheet: 'counts', z: 1, amp: 3.4 }
    ];
    items.forEach(function (it, i) {
      var a = it.ang * Math.PI / 180, dx = Math.cos(a) * RX * it.f, dy = Math.sin(a) * RY * it.f;
      if (it.sheet) {
        var sh = Wd.SHEETS.filter(function (s) { return s.id === it.sheet; })[0];
        var area = unit * unit * sh.w, w = Math.sqrt(area * sh.ar), h = w / sh.ar;
        if (it.id === 'hero') { w *= 1.05; h *= 1.05; }
        chain.push({ id: it.id, parent: 'hub', rest: [dx, dy], amp: it.amp });
        nodes.push({ id: it.id, shape: 'sheet', w: w, h: h, z: it.z, rot0: ((i % 2 ? 1 : -1) * (0.5 + (i % 3) * 0.25)), print: sh.print, info: sh.info(),
          env: it.id === 'hero' ? 'settle' : 1 });
        links.push({ a: 'hub', b: it.id, kind: 'thread', bend: (i % 2 ? 1 : -1) * 0.22 });
      } else if (it.cluster === 'stages') {
        // под-люстра стадий: коромысло с тремя дисками, площадь = объём, тяжёлое ближе к подвесу
        var b = D().breakdown, vmax = b.children[0].value, rmax = 0.085 * S;
        chain.push({ id: 'stages', parent: 'hub', rest: [dx, dy], amp: it.amp });
        nodes.push({ id: 'stages', shape: 'disc', w: 0.06 * S, h: 0.06 * S, z: 2, print: Wd.W.bead('stages', '3'), info: ['Book by stage', '3 stages'] });
        links.push({ a: 'hub', b: 'stages', kind: 'thread', bend: -0.18 });
        b.children.forEach(function (c, j) {
          var r = Math.max(10, rmax * Math.sqrt(c.value / vmax)), aa = a + (j - 1) * 1.05, dd = r + 0.06 * S + (j === 0 ? 0 : 0.05 * S);
          var nd = { id: 'st' + j, shape: 'disc', w: 2 * r, h: 2 * r, z: 1, data: c, info: [c.label, K.eur(c.value), c.count + ' loans', K.pct(c.value / b.value) + ' of book'] };
          nd.print = Wd.W.stage(nd);
          chain.push({ id: 'st' + j, parent: 'stages', rest: [Math.cos(aa) * dd, Math.sin(aa) * dd], amp: 4 + j });
          nodes.push(nd);
          links.push({ a: 'stages', b: 'st' + j, kind: 'thread', bend: (j - 1) * 0.3, ticks: [0.25, 0.5, 0.75] });
        });
      } else if (it.cluster === 'agents') {
        // нитка агентов: пять бусин A1–A5 веером от своей точки подвеса
        var A = D().agents, states = ['work', 'idle', 'idle', 'wait', 'done'];
        chain.push({ id: 'agents', parent: 'hub', rest: [dx, dy], amp: it.amp });
        nodes.push({ id: 'agents', shape: 'disc', w: 0.06 * S, h: 0.06 * S, z: 2, print: Wd.W.bead('agents', '5'), info: ['Five agents', 'one model of record'] });
        links.push({ a: 'hub', b: 'agents', kind: 'thread', bend: 0.2 });
        A.forEach(function (ag, j) {
          var aa = a + (j - 2) * 0.62, dd = 0.11 * S + (j % 2) * 0.045 * S, r = 0.032 * S;
          var nd = { id: 'ag' + j, shape: 'disc', w: 2 * r, h: 2 * r, z: 1, data: ag, state: states[j], info: [ag.id + ' · ' + ag.name, ag.job, 'state: ' + states[j]] };
          nd.print = Wd.W.agent(nd);
          chain.push({ id: 'ag' + j, parent: 'agents', rest: [Math.cos(aa) * dd, Math.sin(aa) * dd], amp: 5 });
          nodes.push(nd);
          links.push({ a: 'agents', b: 'ag' + j, kind: 'thread', bend: (j - 2) * 0.12 });
        });
      }
    });
    var M = { cx: cx, cy: cy, chain: chain, nodes: nodes, links: links };
    nodes[0].fixed = true;
    return ORG.fitModel(ORG.relax(M, 0.012 * S), F, null, 1.15);
  }

  var S={G:null,key:'',last:[],textures:new Map(),shadows:null,model:null,modelKey:'',links:[],depths:null,depthSeed:null};
  function world(ctx,t) {
    var P=ctx.P,W=ctx.W,H=ctx.H,ui=R.ui(W,H),key=[W,H,P.spread].join('|');
    if(S.modelKey!==key){S.model=model({W:W,H:H,ui:ui,m:.06*Math.min(W,H)},P);S.modelKey=key;}
    var M=S.model, pose=ORG.fk(M.chain,0,Object.assign({},P,{wind:0}),ctx.seed,[M.cx,M.cy]);
    var yaw=TAU*(+P.orbitAngle||0)/360+(ctx.reduced||!+P.orbit?0:TAU*t/Math.max(24,+P.orbitPeriod||96)),c=Math.cos(yaw),sn=Math.sin(yaw);
    var radius=Math.min(W,H)*.5, depth=+P.depthView||0;
    S.links=M.links;
    if(S.depthSeed!==ctx.seed){
      S.depthSeed=ctx.seed;S.depths={hub:0};
      ['hero','stages','gate','rule','agents','bars','npl','counts'].forEach(function(id,j){
        var rand=R.stream(ctx.seed,'branch-depth/'+id);
        S.depths[id]=(j%2?-1:1)*(.40+.42*rand());
      });
    }
    var depthRadius=Math.min(W*.32,H*.42);
    var nodes=M.nodes.map(function(n,i){
      var p=pose[n.id],dx=p.x-M.cx,dy=p.y-M.cy;
      var group=n.id.indexOf('st')===0?'stages':n.id.indexOf('ag')===0?'agents':n.id;
      // Each branch has independent seeded depth; children remain attached to their branch.
      var dz=(S.depths[group]||0)*depthRadius;
      if(group!==n.id)dz+=(ORG.hash(ctx.seed+'/'+n.id)()-.5)*depthRadius*.12;
      var x=dx*c+dz*sn,z=-dx*sn+dz*c,scale=1+.045*depth*(z-dz)/radius;
      return Object.assign({},n,{x:M.cx+x,y:p.y+(z-dz)*.20*depth,w:n.w*scale,h:n.h*scale,
        height:(150+32*z/radius)*ui,rot:n.shape==='sheet'?(n.rot0||0)*(+P.tilt)*Math.PI/180:0,
        fixed:true,depth:z/radius,volume:[dx/radius,dy/radius,dz/radius]});
    });
    // A constant full-orbit fit prevents side-on views from leaving the viewport.
    var fit=1;
    M.nodes.forEach(function(n,i){var v=nodes[i].volume,reach=Math.hypot(v[0],v[2])*radius;
      var extent=(Math.abs(Math.cos(nodes[i].rot))*n.w+Math.abs(Math.sin(nodes[i].rot))*n.h)*.54;
      if(reach>0)fit=Math.min(fit,(W/2-8*ui-extent)/reach);
    });
    nodes.forEach(function(n){n.x=W/2+(n.x-M.cx)*fit;n.y=H*.52+(n.y-M.cy)*fit;});
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
      var gn=nodes.map(function(n){return {id:n.id,x:n.x,y:n.y,r:0,fixed:!!n.fixed};});
      var ids={};nodes.forEach(function(n,i){ids[n.id]=i;});
      S.G=R.graph.create(gn,S.links.map(function(l){return {a:ids[l.a],b:ids[l.b]};}),{});
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
  function outline(g,n) {
    g.beginPath();if(n.kind==='circle')g.arc(0,0,n.w/2,0,TAU);else g.rect(-n.w/2,-n.h/2,n.w,n.h);
  }
  function paper(g,n,F) {
    g.save();g.translate(n.x,n.y);g.rotate(n.rot);
    if(n.kind==='circle'){
      g.fillStyle=R.color.css(F.tn.plate);outline(g,n);g.fill();
      if(n.id==='hub'){
        var ink=K.inks(F);
        K.text(g,F,'Loan book',0,-.05*n.w,{px:.115*n.w,min:1,align:'center',color:ink.ink2});
        K.text(g,F,'240',0,.23*n.w,{px:.26*n.w,min:1,align:'center',weight:500,color:ink.ink});
      }else n.print(g,F,K.inks(F),n.w,n.h,n);
    }else g.drawImage(texture(n,F),-n.w/2,-n.h/2,n.w,n.h);
    g.restore();
  }
  // Cached low-resolution silhouettes: only overlapping papers receive a faint shadow.
  function shadowSprite(n,F) {
    var key=n.kind+'|'+(n.w/n.h).toFixed(3)+'|'+F.ctx.theme;
    if(!S.shadows)S.shadows=new Map();if(S.shadows.has(key))return S.shadows.get(key);
    var cv=document.createElement('canvas');cv.width=128;cv.height=128;var g=cv.getContext('2d');
    g.filter='blur(5px)';g.fillStyle=R.color.css(F.tn.shadow,.20);
    if(n.kind==='circle'){g.beginPath();g.arc(64,64,40,0,TAU);g.fill();}else g.fillRect(24,24,80,80);
    S.shadows.set(key,cv);return cv;
  }
  function receiverShadow(g,n,plates,F) {
    if(!(+F.P.dens>0))return;
    plates.forEach(function(o){
      if(o.z<=n.z||Math.abs(o.x-n.x)>(o.w+n.w)*.55||Math.abs(o.y-n.y)>(o.h+n.h)*.55)return;
      g.save();g.translate(n.x,n.y);g.rotate(n.rot);outline(g,n);g.clip();g.rotate(-n.rot);g.translate(-n.x,-n.y);
      g.globalAlpha=Math.min(.7,+F.P.dens*2);g.translate(o.x+3*F.ui,o.y+5*F.ui);g.rotate(o.rot);
      g.drawImage(shadowSprite(o,F),-.8*o.w,-.8*o.h,1.6*o.w,1.6*o.h);g.restore();
    });
  }
  function connectors(g,plates,F) {
    var by={};plates.forEach(function(n){by[n.id]=n;});
    g.lineWidth=Math.max(.6,F.lineW*.75);g.strokeStyle=R.color.css(F.T.ink2,.55);
    S.links.forEach(function(l){var a=by[l.a],b=by[l.b],dx=b.x-a.x,dy=b.y-a.y,bend=(l.bend||0)*.3;
      g.beginPath();g.moveTo(a.x,a.y);g.bezierCurveTo(a.x+dx/3-dy*bend,a.y+dy/3+dx*bend,a.x+dx*2/3-dy*bend,a.y+dy*2/3+dx*bend,b.x,b.y);g.stroke();
    });
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
    connectors(g,plates,F);
    plates.slice().sort(function(a,b){return a.z-b.z;}).forEach(function(n){paper(g,n,F);receiverShadow(g,n,plates,F);});
    R.material.surface(g,ctx.W,ctx.H,ctx.seed,P,T);
    var m=.06*Math.min(ctx.W,ctx.H),I=K.inks(F);
    K.text(g,F,'Loan book',m,m+20*ui,{size:5,weight:600,color:I.ink,min:10});
    K.text(g,F,'desk · orbit',m,m+40*ui,{size:1,mono:true,color:I.ink3,min:7});
    K.text(g,F,'Fictional data · as of 30 Sep 2026',ctx.W-m,ctx.H-m/2,{size:1,mono:true,color:I.ink3,align:'right',min:7});
    g.restore();F.plates=plates;R.last=F;
    window.__ORG={nodes:nodes.length,links:S.links.length,zoom:zoom};
  }
  window.LETTER={world:world,state:S};
  RELIEF_APP.run({id:'desk',title:'Desk · light orbit',blurb:'The original mobile, suspended around a common axis.',
    hint:'One shared orbit. Tap a sheet for details; pinch or scroll to inspect.',
    rows:{scene:[['orbit', 'Orbit', 0,1,1,1],['orbitPeriod', 'Orbit period, s', 24,240,1,96],['orbitAngle', 'Angle, degrees', 0,360,1,0],
      ['depthView', 'Depth', 0,1,0.01,0.65]]},
    draw:draw,structural:function(){S.shadows=null;S.textures.clear();},
    capture:function(ctx){var save={G:S.G,key:S.key,last:S.last,shadows:S.shadows,model:S.model,modelKey:S.modelKey,links:S.links},last=R.last,org={G:ORG.state.G,last:ORG.state.last};
      S.G=null;try{draw(ctx);}finally{Object.assign(S,save);Object.assign(ORG.state,org);R.last=last;}}
  },{variant:'v4',name:'Light orbit',defaults:{orbit:1,orbitPeriod:96,orbitAngle:0,depthView:.65,float:0,parallax:0,wind:0,assemble:0,tilt:6}});
})();
