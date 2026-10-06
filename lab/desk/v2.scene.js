// desk v2 · «Растение»: дашборд-розетка, вид сверху. Из центра «Loan book» выходят стебли (вырезаны
// рельефом), закрученные в одну сторону, как у суккулента; листья-виджеты сидят на концах по
// филлотаксису (угол 137,5°, дальше от центра — старше и крупнее); плоды-диски: стадии книги
// гроздью и бусы агентов вдоль стебля. Ветер гнёт стебель по звеньям: кончик качается сильнее.
(function () {
  var K = window.RINK, Wd = window.WIDGETS, D = Wd.D, TAU = Math.PI * 2, GOLD = 137.508 * Math.PI / 180;

  function model(F, P) {
    var W = F.W, H = F.H, S = Math.min(W, H), cx = W / 2, cy = H / 2, sp = +P.spread, unit = 0.27 * S;
    var RX = (W / 2 - F.m) * sp, RY = (H / 2 - F.m) * sp;
    var chain = [], nodes = [], stems = [];
    var hub = { id: 'hub', shape: 'disc', w: 0.15 * S, h: 0.15 * S, z: 2, info: ['Loan book', '240 loans', '€200.4M'] };
    hub.print = Wd.W.bead('Loan book', '€200M');
    chain.push({ id: 'hub', rest: [0, 0], amp: 0 }); nodes.push(hub);
    // порядок по филлотаксису: k-й стебель под углом k·137,5°, длина растёт с √k
    var order = ['counts', 'npl', 'stages', 'rule', 'agents', 'bars', 'gate', 'hero'];
    var a0 = -0.35, curl = 0.32;
    order.forEach(function (id, k) {
      var ang = a0 + k * GOLD, f = (0.5 + 0.48 * Math.sqrt((k + 1) / order.length)) * (id === 'stages' || id === 'agents' ? 0.62 : 1);
      var sh = Wd.SHEETS.filter(function (s) { return s.id === id; })[0];
      var w = 0, h = 0;
      if (sh) { var area = unit * unit * sh.w * (id === 'hero' ? 0.95 : 0.75 + 0.5 * k / order.length); w = Math.sqrt(area * sh.ar); h = w / sh.ar; }
      var ex = Math.cos(ang) * (RX - w / 2) * f, ey = Math.sin(ang) * (RY - h / 2) * f, L = Math.hypot(ex, ey);
      // стебель из трёх звеньев, каждое повёрнуто на curl: спираль розетки
      var seg = L / 3, dir = Math.atan2(ey, ex) - curl * 1.5, ids = ['hub'], prev = 'hub';
      for (var j = 1; j <= 2; j++) {
        var jid = id + '-j' + j, d = dir + curl * j;
        chain.push({ id: jid, parent: prev, rest: [Math.cos(d) * seg, Math.sin(d) * seg], amp: 1.2 + j * 0.9, lag: j * 0.5 });
        nodes.push({ id: jid, shape: 'disc', w: 6, h: 6, z: 0, ghost: true, hit: false });
        ids.push(jid); prev = jid;
      }
      // кончик: точно в точку листа (поправка на кривизну спирали)
      var pj = { x: 0, y: 0 }, cang = 0;
      chain.forEach(function () {});
      var tipRest = tipVector(chain, ids, ex, ey);
      if (sh) {
        chain.push({ id: id, parent: prev, rest: tipRest, amp: 3.2, lag: 1.5 });
        nodes.push({ id: id, shape: 'sheet', w: w, h: h, z: id === 'hero' ? 3 : id === 'gate' || id === 'bars' ? 2 : 1,
          rot0: (k % 2 ? 1 : -1), print: sh.print, info: sh.info(), env: id === 'hero' ? 'settle' : 1 });
        ids.push(id);
      } else if (id === 'stages') {
        chain.push({ id: 'stages', parent: prev, rest: tipRest, amp: 3, lag: 1.5 });
        nodes.push({ id: 'stages', shape: 'disc', w: 0.05 * S, h: 0.05 * S, z: 1, print: Wd.W.bead('', '3'), info: ['Book by stage', '3 stages'] });
        ids.push('stages');
        var b = D().breakdown, vmax = b.children[0].value, rmax = 0.085 * S, base = Math.atan2(ey, ex);
        b.children.forEach(function (c, j) {
          var r = Math.max(10, rmax * Math.sqrt(c.value / vmax)), aa = base - 1.2 + (j - 1) * 1.15, dd = 0.04 * S + r;
          var nd = { id: 'st' + j, shape: 'disc', w: 2 * r, h: 2 * r, z: j === 2 ? 2 : 1, data: c, info: [c.label, K.eur(c.value), c.count + ' loans', K.pct(c.value / b.value) + ' of book'] };
          nd.print = Wd.W.stage(nd);
          chain.push({ id: 'st' + j, parent: 'stages', rest: [Math.cos(aa) * dd, Math.sin(aa) * dd], amp: 5, lag: 2 });
          nodes.push(nd);
          stems.push({ ids: ['stages', 'st' + j], kind: 'stem' });
        });
      } else if (id === 'agents') {
        // бусы агентов вдоль продолжения стебля
        chain.push({ id: 'agents', parent: prev, rest: tipRest, amp: 3, lag: 1.5 });
        nodes.push({ id: 'agents', shape: 'disc', w: 0.05 * S, h: 0.05 * S, z: 1, print: Wd.W.bead('', '5'), info: ['Five agents', 'one model of record'] });
        ids.push('agents');
        var A = D().agents, states = ['work', 'idle', 'idle', 'wait', 'done'], pr = 'agents', dirA = Math.atan2(ey, ex) + curl;
        A.forEach(function (ag, j) {
          var r = 0.032 * S, d2 = dirA - curl * (2 + 1.5 * (j + 1));
          var nd = { id: 'ag' + j, shape: 'disc', w: 2 * r, h: 2 * r, z: j === 4 ? 2 : 1, data: ag, state: states[j], info: [ag.id + ' · ' + ag.name, ag.job, 'state: ' + states[j]] };
          nd.print = Wd.W.agent(nd);
          chain.push({ id: 'ag' + j, parent: pr, rest: [Math.cos(d2) * r * 2.25, Math.sin(d2) * r * 2.25], amp: 3.5, lag: 2 + j * 0.4 });
          nodes.push(nd); pr = 'ag' + j;
        });
        stems.push({ ids: ['agents', 'ag0', 'ag1', 'ag2', 'ag3', 'ag4'], kind: 'stem', alpha: 0.7 });
      }
      stems.push({ ids: ids, kind: 'stem' });
    });
    var M = { cx: cx, cy: cy, chain: chain, nodes: nodes, stems: stems };
    nodes[0].fixed = true;
    return ORG.fitModel(ORG.relax(M, 0.02 * S), F, null, 1.15);
  }
  // вектор последнего звена: от суставов (при нулевом ветре) к точке листа
  function tipVector(chain, ids, ex, ey) {
    var x = 0, y = 0;
    ids.slice(1).forEach(function (id) { var c = chain.filter(function (q) { return q.id === id; })[0]; x += c.rest[0]; y += c.rest[1]; });
    return [ex - x, ey - y];
  }

  var CACHE = { key: '', m: null };
  ORG.run({
    id: 'desk', title: 'desk', blurb: 'Dashboard as a plant: widget leaves on stems from the Loan book',
    hint: 'Drag a leaf: the stem bends and neighbours follow. Hover lifts, click focuses, wheel zooms, drag the floor to pan.',
    rows: {},
    pose: function (ctx, F, t) {
      var P = ctx.P, key = [F.W, F.H, P.spread].join('|');
      if (CACHE.key !== key) { CACHE.key = key; CACHE.m = model(F, P); }
      var M = CACHE.m, pos = ORG.fk(M.chain, t, P, ctx.seed, [M.cx, M.cy]);
      var tEnd = P.assemble ? 0.08 * (M.nodes.length - 1) + 0.52 : 0;
      var nodes = M.nodes.map(function (n) {
        var p = pos[n.id], o = Object.assign({}, n);
        o.x = p.x; o.y = p.y;
        o.rot = n.shape === 'sheet' ? (n.rot0 || 0) * (+P.tilt) * Math.PI / 180 + p.tilt + p.sw * 0.5 : 0;
        o.env = n.env === 'settle' ? window.RELIEF.motion.settle(t, tEnd + 1.2, +P.settle) : 1;
        return o;
      });
      var links = [];
      M.stems.forEach(function (s) { var ids=s.ids.filter(function(id){return id.indexOf('-j')<0;});links=links.concat(ORG.chainLinks(pos,ids,'thread',{alpha:.28})); });
      // Contextual stage satellites share one smooth life envelope with their link.
      [0,1,2].forEach(function(j){
        var parent=nodes.filter(function(n){return n.id==='st'+j;})[0],c=parent.data;
        var phase=(t+j*5)%28,life=ctx.reduced?1:Math.pow(Math.sin(Math.PI*phase/28),2);
        var w=parent.w*.42,angle=-.6+j*1.2,d=parent.w*.65+w*.35;
        var x=parent.x+Math.cos(angle)*d,y=parent.y+Math.sin(angle)*d,id='stage-detail-'+j;
        var label=j===1?'Share':'Loans',value=j===1?K.pct(c.value/D().breakdown.value):String(c.count);
        nodes.push({id:id,shape:'disc',x:x,y:y,w:w*(.12+.88*life),h:w*(.12+.88*life),z:parent.z+.1,env:0,life:life,hit:life>.15,compactValue:value,info:[c.label,label+': '+value],print:function(g,F,I,ww,hh,n){g.save();Wd.W.bead(label,value)(g,F,I,ww,hh,n);g.restore();}});
        links.push({a:parent.id,b:id,kind:'thread',alpha:.28*life});
      });
      return {
        root: 'hub', nodes: nodes, links: links, key: 'plant',
        floor: function (g, Fr) {
          var I = Fr.I;
          K.text(g, Fr, 'Loan book', F.m, F.m + 20 * Fr.ui, { size: 5, weight: 600, color: I.ink, min: 10 });
          K.text(g, Fr, 'desk · plant', F.m, F.m + 40 * Fr.ui, { size: 1, mono: true, color: I.ink3, min: 7 });
          K.text(g, Fr, 'Fictional data · as of 30 Sep 2026', F.W - F.m, F.H - F.m * 0.5, { size: 1, mono: true, color: I.ink3, align: 'right', min: 7 });
        }
      };
    }
  }, { variant: 'v2', name: 'plant', defaults: { tilt: 1.2, wind: .32, tension: .85, assemble:0, parallax:.12, dens:.15 } });
})();
