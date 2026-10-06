// Original desk mobile with a shared orbit and inexpensive overlap-only shadows.
(function () {
  'use strict';
  var R=window.RELIEF, K=window.RINK, Wd=window.WIDGETS, TAU=Math.PI*2;
  var D=Wd.D, EX=window.RELIEF_EXPLORE;
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
        if(EX.letter){var ar=Math.max(1.12,Math.min(1.65,w/h));var sizes={hero:.255,counts:.225,gate:.195,rule:.175,bars:.235,npl:.205};w=Math.max(76,S*sizes[it.id]);h=w/ar;}
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
          var aa = a + (j - 2) * 0.62, dd = 0.11 * S + (j % 2) * 0.045 * S, r = [.035,.045,.055,.031,.040][j] * S;
          var nd = { id: 'ag' + j, shape: 'disc', w: 2 * r, h: 2 * r, z: 1, data: ag, state: states[j], info: [ag.id + ' · ' + ag.name, ag.job, 'state: ' + states[j]] };
          nd.print = Wd.W.agent(nd);
          chain.push({ id: 'ag' + j, parent: 'agents', rest: [Math.cos(aa) * dd, Math.sin(aa) * dd], amp: 5 });
          nodes.push(nd);
          links.push({ a: 'agents', b: 'ag' + j, kind: 'thread', bend: (j - 2) * 0.12 });
        });
      }
    });
    nodes.forEach(function(n){if(n.shape==='sheet'){n.print=EXPLORE_WIDGETS.print(n.id,EX.mode);n.info=EXPLORE_WIDGETS.info(n.id);}});
    var M = { cx: cx, cy: cy, chain: chain, nodes: nodes, links: links };
    nodes[0].fixed = true;
    return ORG.fitModel(ORG.relax(M, 0.012 * S), F, null, 1.15);
  }

  var S={G:null,key:'',last:[],textures:new Map(),shadows:null,model:null,modelKey:'',links:[],depths:null,depthSeed:null,distances:null};
  var DRAG={yaw:0,pitch:0,node:-1,x:0,y:0,held:false,released:0};
  function smooth(x){x=Math.max(0,Math.min(1,x));return x*x*x*(10+x*(-15+6*x));}
  function impulse(a){
    if(a<=0||a>=2.8)return 0;
    return 1.25*Math.exp(-1.65*a)*Math.sin(9*a)*smooth(a/.12)*smooth((2.8-a)/.55);
  }
  function refresh(ctx,id,t){
    var order=['counts','bars','gate','npl','hero','rule'],i=order.indexOf(id);
    if(ctx.reduced||!+ctx.P.refresh||i<0)return null;
    var u=((t-4-i*8)%96+96)%96;
    if(u>3.6)return null;
    var weight=impulse(u-.24)*(+ctx.P.refreshWeight||0);
    return {id:id,u:u,weight:weight,old:1-smooth(u/.20)};
  }
  function world(ctx,t) {
    var area=RELIEF_STORY.layout(ctx.W,ctx.H,ctx.P.story,ctx.P).area;ctx=Object.assign({},ctx,{W:area.w,H:area.h});
    var P=ctx.P,W=ctx.W,H=ctx.H,ui=R.ui(W,H),key=[W,H,P.spread].join('|');
    if(S.modelKey!==key){S.model=model({W:W,H:H,ui:ui,m:.06*Math.min(W,H)},P);S.modelKey=key;
      var adj={};S.model.nodes.forEach(function(n){adj[n.id]=[];});S.model.links.forEach(function(l){adj[l.a].push(l.b);adj[l.b].push(l.a);});
      S.distances={};S.model.nodes.forEach(function(n){var d={},q=[n.id];d[n.id]=0;while(q.length){var a=q.shift();adj[a].forEach(function(b){if(d[b]==null){d[b]=d[a]+1;q.push(b);}});}S.distances[n.id]=d;});
    }
    var M=S.model, pose=ORG.fk(M.chain,0,Object.assign({},P,{wind:0}),ctx.seed,[M.cx,M.cy]);
    var yaw=TAU*(+P.orbitAngle||0)/360+DRAG.yaw+(ctx.reduced||!+P.orbit?0:TAU*t/Math.max(24,+P.orbitPeriod||384)),c=Math.cos(yaw),sn=Math.sin(yaw);
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
      if(EX.mode==='helix'&&n.id!=='hub'){var j=['hero','counts','gate','rule','bars','npl'].indexOf(n.id);if(j>=0){var a=j*TAU/6;dx=Math.cos(a)*radius*.65;dz=Math.sin(a)*radius*.65;dy=(j-2.5)*radius*.22;}}
      if(EX.mode==='archive'&&n.shape==='sheet'){dx*=.8;dz*=1.3;dy*=.85;}
      var arrival=n.shape==='sheet'?EXPLORE_WIDGETS.lifeState(n.id,ctx,t):null;
      if(arrival&&arrival.generation){dx=arrival.site.x*Math.min(W*.40,H*.54);dy=arrival.site.y*Math.min(H*.40,W*.36);dz=arrival.site.z*depthRadius;}
      var x=dx*c+dz*sn,z0=-dx*sn+dz*c,z=z0*Math.cos(DRAG.pitch)+dy*Math.sin(DRAG.pitch),py=dy*Math.cos(DRAG.pitch)-z0*Math.sin(DRAG.pitch),scale=EX.letter?1+.045*depth*(z-dz)/radius:1/(1-.30*depth*z/radius);
      return Object.assign({},n,{x:M.cx+x*scale*(EX.letter?1:.83),y:M.cy+(py+(z-dz)*.20*depth)*scale*(EX.letter?1:.83),w:n.w*scale*(EX.letter?1:.85),h:n.h*scale*(EX.letter?1:.85),
        arrival:arrival,height:(160+68*z/radius)*ui,rot:n.shape==='sheet'?(n.rot0||0)*(+P.tilt)*Math.PI/180:0,
        baseW:n.w,fixed:true,depth:z/radius,volume:[dx/radius,dy/radius,dz/radius]});
    });
    // A constant full-orbit fit prevents side-on views from leaving the viewport.
    var fit=1;
    M.nodes.forEach(function(n,i){var group=n.id.indexOf('st')===0?'stages':n.id.indexOf('ag')===0?'agents':n.id,v=[(pose[n.id].x-M.cx)/radius,0,(S.depths[group]||0)*depthRadius/radius],reach=Math.hypot(v[0],v[2])*radius;
      var extent=(Math.abs(Math.cos(nodes[i].rot))*n.w+Math.abs(Math.sin(nodes[i].rot))*n.h)*.54;
      if(reach>0)fit=Math.min(fit,(W/2-18*ui-extent)/reach);
    });
    var active=null;
    // Independent arrival envelopes supersede the previous periodic content flip.
    nodes.forEach(function(n,i){
      n.x=W/2+(n.x-M.cx)*fit;n.y=H*.52+(n.y-M.cy)*fit;
      n.refresh=active&&active.id===n.id?active:null;
      if(active){
        var distance=S.distances[active.id][n.id],gain=distance===0?1:Math.pow(.58,distance)*(n.id==='hub'?.65:1);
        var response=impulse(active.u-.24-distance*.10)*gain*(+P.refreshWeight||0);
        n.x+=4*ui*response;n.y+=17*ui*response;
        if(n.shape==='sheet')n.rot+=(i%2?1:-1)*.045*response;
        n.response=response;
      }
      if(i===DRAG.node){var age=Math.max(0,t-DRAG.released),decay=DRAG.held?1:ctx.reduced||R.graph.paused?0:(1+5*age)*Math.exp(-5*age);
        n.x+=DRAG.x*decay;n.y+=DRAG.y*decay;n.rot+=DRAG.x*.0015*decay;}
    });
    if(EX.mode==='archive'&&!EX.renew&&!ctx.reduced&&+P.refresh)nodes.forEach(function(n){if(n.shape!=='sheet')return;var j=['hero','counts','gate','rule','bars','npl'].indexOf(n.id),u=((t-7-j*6)%48+48)%48;n.life=1;if(u<.65){n.life=1-smooth(u/.65);n.y+=18*ui*(1-n.life);}else if(u<.95){n.life=0;}else if(u<1.75){n.life=smooth((u-.95)/.8);n.y-=18*ui*(1-n.life);}if(u>=.95&&u<2.4)n.refresh={u:u-.95,old:0};});
    EXPLORE_WIDGETS.renew(nodes,ctx,t);
    nodes.forEach(function(n){if(n.shape==='sheet')n.rot=(Math.PI/90)*Math.tanh(n.rot/.10);});
    EXPLORE_WIDGETS.buoyancy(nodes,ctx,t);
    EXPLORE_WIDGETS.route(nodes,ctx,yaw,t);
    nodes.forEach(function(n){n.x+=area.x;n.y+=area.y;});
    return nodes;
  }
  function pick(x,y) {
    for(var i=S.last.length-1;i>=0;i--){var n=S.last[i];if(n.node.life!=null&&n.node.life<.15)continue;var dx=x-n.sx,dy=y-n.sy,c=Math.cos(-n.srot),s=Math.sin(-n.srot);
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
      G.describe=function(i){var live=S.last.find(function(n){return n.i===i;});return live?live.node.info:nodes[i].info;};
      if(!ctx.capture){R.graph.bind(G,ctx.canvas,pick,function(){S.shadows=null;});bindSphere(ctx,G);}
      S.key=key;
    }
    nodes.forEach(function(n,i){S.G.nodes[i].x=n.x;S.G.nodes[i].y=n.y;});
    S.G.sync(ctx,{drift:0,repel:0});return S.G;
  }
  function bindSphere(ctx,G){
    var cv=ctx.canvas,points=new Map(),down=null,pinch=null,cancelling=false,off=[],baseDispose=cv._graphDispose;
    function on(type,fn){cv.addEventListener(type,fn,true);off.push(function(){cv.removeEventListener(type,fn,true);});}
    function local(e){var r=cv.getBoundingClientRect();return [(e.clientX-r.left)*ctx.W/r.width,(e.clientY-r.top)*ctx.H/r.height];}
    function redraw(){if(ctx.reduced||R.graph.paused){G.instant();draw(ctx);}}
    on('pointerdown',function(e){if(e.button>0)return;var p=local(e);points.set(e.pointerId,p);
      if(points.size===1)down={id:e.pointerId,p:p,node:pick(p[0],p[1]),yaw:DRAG.yaw,pitch:DRAG.pitch,moved:false};
      else {down=null;DRAG.held=false;DRAG.x=DRAG.y=0;
        var ps=Array.from(points.values());pinch={distance:Math.hypot(ps[0][0]-ps[1][0],ps[0][1]-ps[1][1]),zoom:G.view.zoom};
        e.stopImmediatePropagation();try{cv.setPointerCapture(e.pointerId);}catch(ignore){}
      }
    });
    on('pointermove',function(e){if(!points.has(e.pointerId))return;
      var next=local(e);points.set(e.pointerId,next);
      if(pinch&&points.size>=2){var ps=Array.from(points.values());e.stopImmediatePropagation();e.preventDefault();G.viewT=null;
        G.view.zoom=Math.max(.5,Math.min(4,pinch.zoom*Math.hypot(ps[0][0]-ps[1][0],ps[0][1]-ps[1][1])/Math.max(1,pinch.distance)));redraw();return;}
      if(points.size!==1||!down)return;
      var p=next,dx=p[0]-down.p[0],dy=p[1]-down.p[1];points.set(e.pointerId,p);
      if(Math.hypot(dx,dy)<3&&!down.moved)return;
      down.moved=true;e.stopImmediatePropagation();e.preventDefault();
      DRAG.yaw=down.yaw+dx*.006;DRAG.pitch=Math.max(-.45,Math.min(.45,down.pitch+dy*.004));
      DRAG.node=down.node;DRAG.held=true;DRAG.x=Math.max(-9,Math.min(9,dx*.06));DRAG.y=Math.max(-9,Math.min(9,dy*.06));
      G.drag=-1;G.dragW=null;G.viewT=null;cv.style.cursor='grabbing';redraw();
    });
    function up(e){if(cancelling)return;var moved=!!pinch||(down&&down.id===e.pointerId&&down.moved);points.delete(e.pointerId);down=null;if(points.size<2)pinch=null;
      DRAG.held=false;DRAG.released=R.motion.time(ctx);cv.style.cursor='grab';
      if(moved&&e.type==='pointerup'){e.stopImmediatePropagation();cancelling=true;cv.dispatchEvent(new PointerEvent('pointercancel',{pointerId:e.pointerId,bubbles:false}));cancelling=false;}
      redraw();
    }
    on('pointerup',up);on('pointercancel',up);
    cv._graphDispose=function(){off.forEach(function(f){f();});points.clear();down=null;DRAG.held=false;DRAG.node=-1;baseDispose();};
  }
  var DISCS=new Map();
  function discTexture(n,F){
    var caption=(n.baseW||n.w)>=64;
    var key=[n.id,caption,F.ctx.theme,F.P.accent,F.P.temp].join('|');if(DISCS.has(key))return DISCS.get(key);
    var cv=document.createElement('canvas');cv.width=cv.height=256;var g=cv.getContext('2d');g.translate(128,128);g.scale(2.56,2.56);
    var I=K.inks(F);g.fillStyle=R.color.css(F.tn.plate);g.beginPath();g.arc(0,0,50,0,TAU);g.fill();
    function text(s,y,px,color,weight){K.font(g,F,{px:px,min:1,weight:weight||400});var width=g.measureText(s).width;
      K.text(g,F,s,0,y,{px:Math.min(px,px*78/Math.max(1,width)),min:1,weight:weight||400,align:'center',color:color||I.ink});}
    if(n.id==='hub'){text('Loan book',-5,11.5,I.ink2);text('240',23,26,I.ink,500);}
    else if(n.id==='stages'||n.id==='agents'){if(caption)text(n.id,-8,15,I.ink3);text(n.id==='stages'?'3':'5',caption?23:10,28,I.ink,500);}
    else if(n.id.indexOf('st')===0){
      if(caption)text(n.data.label==='non-performing'?'NPL':n.data.label,-11,12,I.ink3);text(K.eur(n.data.value),caption?13:7,20,I.ink,500);
      if(n.data.label==='non-performing')K.dot(g,0,29,3,I.acc);
    }else{
      if(n.state==='wait'){g.strokeStyle=I.ink;g.lineWidth=2;g.beginPath();g.arc(0,-12,11,0,TAU);g.stroke();}
      else if(n.state==='done')K.dot(g,0,-12,7,I.ink);
      else if(n.state==='work')for(var i=0;i<5;i++)K.dot(g,Math.cos(TAU*i/5)*12,-12+Math.sin(TAU*i/5)*12,3,I.ink2);
      else for(var j=0;j<3;j++)K.dot(g,(j-1)*10,-12,3,I.ink2);
      text(n.data.id,27,21,I.ink2,500);
    }
    DISCS.set(key,cv);if(DISCS.size>40)DISCS.delete(DISCS.keys().next().value);return cv;
  }
  function texture(n,F) {
    var compact=n.baseW<150, bucket=compact?Math.max(48,Math.round(n.baseW/4)*4):0;
    var key=[n.contentId||n.id,n.sample,(n.w/n.h).toFixed(6),bucket,F.ctx.theme,F.P.accent,+F.P.temp].join('|'),cached=S.textures.get(key);
    if(cached)return cached;
    var w=480,h=Math.round(w*n.h/n.w),cv=document.createElement('canvas');cv.width=w;cv.height=h;
    var g=cv.getContext('2d');g.fillStyle=R.color.css(F.tn.plate);g.fillRect(0,0,w,h);
    g.translate(w/2,h/2);g.scale(2,2);
    if(compact){
      var scale=240/bucket,lines=EXPLORE_WIDGETS.short(n.contentId||n.id).slice(),max=208;
      if((n.contentId||n.id)!=='counts')lines[1]=n.info[1];
      g.textAlign='left';g.textBaseline='middle';
      lines.slice(0,2).forEach(function(line,i){
        var text=String(line),px=(i?Math.max(12,Math.min(19,bucket*.135)):Math.max(9,Math.min(11,bucket*.078)))*scale;
        g.font='400 '+px+'px Geist,system-ui';
        if(g.measureText(text).width>max){px*=max/g.measureText(text).width;g.font='400 '+px+'px Geist,system-ui';}
        g.fillStyle=R.color.css(i?F.T.ink:F.T.ink2);g.fillText(text,-104,(i?9:-11)*scale);
      });
    }else n.print(g,Object.assign({},F,{ui:1}),K.inks(F),240,h/2,n);
    S.textures.set(key,cv);if(S.textures.size>24)S.textures.delete(S.textures.keys().next().value);return cv;
  }
  function outline(g,n) {
    g.beginPath();if(n.kind==='circle')g.arc(0,0,n.w/2,0,TAU);else g.rect(-n.w/2,-n.h/2,n.w,n.h);
  }
  function paper(g,n,F) {
    g.save();g.translate(n.x,n.y);g.rotate(n.rot);
    if(n.kind==='circle'){g.imageSmoothingQuality='high';g.drawImage(discTexture(n,F),-n.w/2,-n.h/2,n.w,n.h);}
    else {
      g.imageSmoothingQuality='high';
      var cv=texture(n,F),r=n.refresh;
      // Single sheets only; all visible shadows belong to actual receiving cards.
      var fog=EX.mode==='orbit'?smooth((-n.depth-.12)/.65)*.70:0;
      if(fog>0){var blurred=EXPLORE_WIDGETS.blur(cv);g.drawImage(cv,-n.w/2,-n.h/2,n.w,n.h);g.globalAlpha=fog*(n.life==null?1:n.life);g.drawImage(blurred,-n.w/2,-n.h/2,n.w,n.h);g.globalAlpha=n.life==null?1:n.life;if(!r){g.restore();return;}}
      if(!r)g.drawImage(cv,-n.w/2,-n.h/2,n.w,n.h);
      else {
        g.fillStyle=R.color.css(F.tn.plate);g.fillRect(-n.w/2,-n.h/2,n.w,n.h);
        if(r.old>0){g.globalAlpha=r.old*(n.life==null?1:n.life);g.drawImage(cv,-n.w/2,-n.h/2,n.w,n.h);g.globalAlpha=n.life==null?1:n.life;}
        function region(x,y,w,h,amount){
          if(amount<=0)return;g.save();g.globalAlpha=amount*(n.life==null?1:n.life);g.beginPath();g.rect(x,y,w,h);g.clip();
          g.drawImage(cv,-n.w/2,-n.h/2,n.w,n.h);g.restore();
        }
        if((n.contentId||n.id)==='bars'&&n.w>=120){
          var top=-n.h/2,chartTop=top+n.h*.30,chartHeight=n.h*.56;
          region(-n.w/2,top,n.w,n.h*.30,smooth((r.u-.24)/.32));
          for(var col=0;col<12;col++){var fill=smooth((r.u-.28-col*.028)/.45);
            region(-n.w/2+col*n.w/12,chartTop+chartHeight*(1-fill),n.w/12,chartHeight*fill,fill);}
          region(-n.w/2,top+n.h*.86,n.w,n.h*.14,smooth((r.u-.65)/.35));
        }else{
          // Fixed cached rows fade/write in sequence; no geometry deformation or relayout.
          var bands=6;
          for(var i=0;i<bands;i++){
            var amount=smooth((r.u-.24-i*.065)/.40);
            region(-n.w/2,-n.h/2+i*n.h/bands,n.w*amount,n.h/bands+.1,amount);
          }
        }
      }
    }
    g.restore();
  }
  // Cached low-resolution silhouettes: only overlapping papers receive a faint shadow.
  function shadowSprite(n,F,gap) {
    var softness=Math.min(16,Math.max(4,Math.round((4+gap/8/F.ui)/2)*2));
    var key=n.kind+'|'+softness+'|'+F.ctx.theme;
    if(!S.shadows)S.shadows=new Map();if(S.shadows.has(key))return S.shadows.get(key);
    var cv=document.createElement('canvas');cv.width=cv.height=192;var g=cv.getContext('2d');
    g.fillStyle=R.color.css(F.tn.shadow,.36);
    if(n.kind==='circle'){g.beginPath();g.arc(96,96,64,0,TAU);g.fill();}else g.fillRect(32,32,128,128);
    RELIEF_SOFT.blur(cv,softness);S.shadows.set(key,cv);return cv;
  }
  function receiverShadow(g,n,plates,F) {
    if(!(+F.P.dens>0)||(n.life!=null&&n.life<.01))return;
    var candidates=plates.filter(function(o){return o.z>n.z+.1&&(o.life==null||o.life>.01);}).map(function(o){var gap=o.z-n.z,off=R.light.offset(F.L,o.x,o.y,o.z,n.z);return {o:o,gap:gap,x:o.x+off[0],y:o.y+off[1]};}).filter(function(c){return Math.abs(c.x-n.x)<(c.o.w+n.w)*.65&&Math.abs(c.y-n.y)<(c.o.h+n.h)*.65;}).sort(function(a,b){return a.gap-b.gap;}).slice(0,3);
    candidates.forEach(function(c){var o=c.o;
      g.save();g.translate(n.x,n.y);g.rotate(n.rot);outline(g,n);g.clip();g.rotate(-n.rot);g.translate(-n.x,-n.y);
      g.globalAlpha=Math.min(.80,+F.P.dens*3.5)/(1+c.gap/(140*F.ui))*(o.life==null?1:o.life)*(n.life==null?1:n.life);
      g.translate(c.x,c.y);g.rotate(o.rot);g.imageSmoothingQuality='low';g.drawImage(shadowSprite(o,F,c.gap),-.75*o.w,-.75*o.h,1.5*o.w,1.5*o.h);g.restore();
    });
  }
  function connectors(g,plates,F,receiver) {
    var by={};plates.forEach(function(n){by[n.id]=n;});
    g.lineWidth=Math.max(.6,F.lineW*.75);g.strokeStyle=R.color.css(F.T.ink2,.40);
    S.links.forEach(function(l){var a=by[l.a],b=by[l.b];
      if(receiver){var pad=Math.hypot(b.x-a.x,b.y-a.y)*.2+8,ex=Math.hypot(receiver.w,receiver.h)/2;
        if(Math.max(a.x,b.x)+pad<receiver.x-ex||Math.min(a.x,b.x)-pad>receiver.x+ex||Math.max(a.y,b.y)+pad<receiver.y-ex||Math.min(a.y,b.y)-pad>receiver.y+ex)return;}
      g.save();g.globalAlpha*=Math.min(a.life==null?1:a.life,b.life==null?1:b.life);var dx=b.x-a.x,dy=b.y-a.y,bend=(l.bend||0)*.3+(b.i===DRAG.node?DRAG.x*.002*(DRAG.held?1:Math.exp(-5*Math.max(0,F.tsec-DRAG.released))):0);
      g.beginPath();g.moveTo(a.x,a.y);g.bezierCurveTo(a.x+dx/3-dy*bend,a.y+dy/3+dx*bend,a.x+dx*2/3-dy*bend,a.y+dy*2/3+dx*bend,b.x,b.y);g.stroke();g.restore();
    });
  }
  function draw(ctx) {
    var nodes=world(ctx,R.motion.time(ctx)),G=graph(ctx,nodes),zoom=G.view.zoom,g=ctx.g,ui=R.ui(ctx.W,ctx.H),P=ctx.P;
    var T=Object.assign({},R.tokens(ctx.theme,P.accent));
    // Quiet monochrome presentation; do not mutate shared tokens used by older variants.
    T.accent=T.ink2.slice();
    function neutral(v){var m=(v[0]+v[1]+v[2])/3;return [m,m,m];}
    T.shadowTint=neutral(T.shadowTint);T.lightTint=neutral(T.lightTint);
    if(ctx.theme!=='night'){T.ground=R.color.mix(neutral(T.ground),T.lightTint,.38);T.plate=R.color.mix(neutral(T.plate),T.lightTint,.48);}
    T.groundY=R.color.lum(T.ground);
    var tn=R.material.tints(T,+P.temp||0),L=R.light.state(P,ctx.W,ctx.H,ui);
    // Zero local contact is deliberate: there is no nearby desk under these papers.
    L.contact=0;
    var F={ctx:ctx,P:P,W:ctx.W,H:ctx.H,ui:ui,T:T,tn:tn,L:L,lineW:R.lineW(ui),tsec:R.motion.time(ctx)};
    var plates=nodes.map(function(n,i){var st=G.state(i),p=G.toScreen(st.x,st.y);
      return Object.assign({},n,{i:i,kind:n.shape==='disc'?'circle':'rect',x:p[0],y:p[1],w:n.w*zoom,h:n.h*zoom,z:(n.height+st.lift*5*ui)*Math.sqrt(zoom),r:1.5*ui});
    });
    var story=RELIEF_STORY.geometry(ctx,F);F.story=story;
    F.hub=plates.find(function(n){return n.id==='hub';});
    S.last=plates.map(function(p){return {i:p.i,id:p.id,shape:p.shape,sx:p.x,sy:p.y,sw:p.w,sh:p.h,srot:p.rot,node:nodes[p.i]};}).sort(function(a,b){return a.node.height-b.node.height;});
    ORG.state.G=G;ORG.state.last=S.last;
    g.save();g.fillStyle=R.color.css(tn.ground);g.fillRect(0,0,ctx.W,ctx.H);
    EXPLORE_WIDGETS.backdrop(g,plates,F);
    RELIEF_STORY.ground(g,story,F);
    connectors(g,plates,F);
    EXPLORE_WIDGETS.buds(g,plates,F);EXPLORE_WIDGETS.parentCards(g,plates,F);
    plates.slice().sort(function(a,b){return a.z-b.z;}).forEach(function(n){g.save();if(n.life!=null)g.globalAlpha=n.life;paper(g,n,F);g.restore();receiverShadow(g,n,story?plates.concat([story]):plates,F);
      if(n.kind==='rect'){g.save();g.translate(n.x,n.y);g.rotate(n.rot);outline(g,n);g.clip();g.rotate(-n.rot);g.translate(-n.x,-n.y);
        g.globalAlpha=.10;connectors(g,plates,F,n);g.restore();}
    });
    R.material.surface(g,ctx.W,ctx.H,ctx.seed,P,T);
    RELIEF_STORY.paint(g,story,F);
    var m=.06*Math.min(ctx.W,ctx.H),I=K.inks(F);
    if(!story)K.text(g,F,'Loan book',m,m+20*ui,{size:5,weight:600,color:I.ink,min:10});
    if(!story)K.text(g,F,'desk · '+EX.name.toLowerCase(),m,m+40*ui,{size:1,mono:true,color:I.ink3,min:7});
    K.text(g,F,'Fictional data · as of 30 Sep 2026',ctx.W-m,ctx.H-m/2,{size:1,mono:true,color:I.ink3,align:'right',min:7});
    g.restore();F.plates=plates;R.last=F;
    window.__ORG={nodes:nodes.length,links:S.links.length,zoom:zoom};
  }
  window.LETTER={world:world,state:S,refresh:refresh,impulse:impulse,drag:DRAG,discs:DISCS};
  RELIEF_APP.run({id:'desk',title:'Desk · '+EX.name,blurb:'The original mobile, suspended around a common axis.',
    hint:'One shared orbit. Tap a sheet for details; pinch or scroll to inspect.',
    rows:{scene:[['story', 'Narrative panel', 0,1,1,1],['storyX', 'Panel X, %', -40,40,1,0],['storyY', 'Panel Y, %', -40,40,1,0],['storyHeight', 'Panel height', 0,800,10,320],['orbit', 'Orbit', 0,1,1,1],['orbitPeriod', 'Orbit period, s', 48,960,1,384],['orbitAngle', 'Angle, degrees', 0,360,1,0],
      ['depthView', 'Depth', 0,1,0.01,0.65],['refresh', 'Content refresh', 0,1,1,1]]},
    draw:draw,structural:function(){S.shadows=null;S.textures.clear();DISCS.clear();},
    capture:function(ctx){var save={G:S.G,key:S.key,last:S.last,shadows:S.shadows,model:S.model,modelKey:S.modelKey,links:S.links},last=R.last,org={G:ORG.state.G,last:ORG.state.last};
      S.G=null;try{draw(ctx);}finally{Object.assign(S,save);Object.assign(ORG.state,org);R.last=last;}}
  },{variant:EX.variant,name:EX.name,defaults:{story:1,storyX:0,storyY:0,storyHeight:320,orbit:1,orbitPeriod:384,orbitAngle:0,depthView:EX.letter?.65:1,refresh:1,refreshWeight:1,float:0,parallax:0,wind:0,assemble:0,tilt:6}});
})();
