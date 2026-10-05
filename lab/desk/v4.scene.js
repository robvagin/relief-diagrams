// US Letter ensemble: a single camera orbit about the composition's vertical axis.
// Sheets are camera-facing; no local spin, fixtures or large perspective size changes.
(function () {
  'use strict';
  var R = window.RELIEF, K = window.RINK, Wd = window.WIDGETS, TAU = Math.PI * 2;
  var placement = [
    ['hero', -0.68, -0.12, 0.66, true],
    ['gate', 0.72, 0.12, -0.64, true],
    ['counts', 0.52, -0.92, 0.70, false],
    ['npl', -0.58, -0.80, -0.72, false],
    ['rule', 0.50, 0.88, 0.70, false],
    ['bars', -0.60, 0.82, -0.72, true]
  ];
  ORG.run({
    id: 'desk', title: 'Letter ensemble',
    blurb: 'US Letter sheets orbiting a shared composition axis with restrained depth.',
    hint: 'One shared orbit. Use Orbit to stop, Angle to inspect. Tap a sheet for readable details.',
    rows: {scene: [
      ['orbit', 'Orbit', 0, 1, 1, 1],
      ['orbitPeriod', 'Orbit period, s', 24, 180, 1, 72],
      ['orbitAngle', 'Angle, degrees', 0, 360, 1, 0],
      ['depthView', 'Depth', 0, 1, 0.01, 0.55]
    ]},
    pose: function (ctx, F, t) {
      var P = ctx.P, u = Math.min(F.W / 6.4, F.H / 5.3);
      var a = TAU * ((+P.orbitAngle || 0) / 360 + (!ctx.reduced && +P.orbit ? t / Math.max(24, +P.orbitPeriod || 72) : 0));
      var c = Math.cos(a), s = Math.sin(a), depth = +P.depthView || 0;
      var cx = F.W / 2, cy = F.H / 2 + 12 * F.ui;
      var nodes = placement.map(function (q) {
        var x = q[1] * c + q[3] * s, z = -q[1] * s + q[3] * c;
        var scale = 1 + 0.055 * depth * z, short = u * scale, long = short * 11 / 8.5;
        var sheet = Wd.SHEETS.filter(function (item) { return item.id === q[0]; })[0];
        return {id: q[0], shape: 'sheet', x: cx + x * F.W * 0.32,
          y: cy + q[2] * F.H * 0.32 - z * depth * F.H * 0.055,
          w: q[4] ? long : short, h: q[4] ? short : long, rot: 0,
          z: 2, height: (16 + 10 * depth * z) * F.ui, fixed: true, env: 0,
          print: sheet.print, info: sheet.info()};
      });
      var links = [['hero','gate'],['hero','counts'],['hero','npl'],['gate','rule'],['gate','bars'],['counts','gate'],['npl','bars']].map(function (p) {
        return {a:p[0],b:p[1],kind:'thread',alpha:0.6};
      });
      return {nodes:nodes,links:links,root:'hero',key:'letter-ensemble',
        floor: function (g, Fr) {
          var I=K.inks(Fr), m=F.m;
          K.text(g,Fr,'Loan book',m,m+20*Fr.ui,{size:5,weight:600,color:I.ink,min:10});
          K.text(g,Fr,'US Letter · shared orbit',m,m+40*Fr.ui,{size:1,mono:true,color:I.ink3,min:7});
          K.text(g,Fr,'Fictional data · as of 30 Sep 2026',F.W-m,F.H-m/2,{size:1,mono:true,color:I.ink3,align:'right',min:7});
        }};
    }
  }, {variant:'v4',name:'Letter ensemble',defaults:{orbit:1,orbitPeriod:72,orbitAngle:0,depthView:0.55,float:0,parallax:0,wind:0,assemble:0}});
})();
