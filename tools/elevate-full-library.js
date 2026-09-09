'use strict';

// Full-library identity pass. Idempotently adds one game-specific authored
// landmark, a matching light/material treatment, and concise presentation copy
// to every one of the 28 catalog entries without changing their core rules.
const fs=require('fs'),path=require('path');
const kit=require('./showcase-assets');
const ROOT=path.resolve(__dirname,'..');
const catalog=require('../games/catalog.json');
const specs={
  'foglight':          {c:[1,.55,.18], sky:[[.04,.12,.18],[.34,.53,.5]], tex:['dirt-path','moss-stone'], audio:'ambient-fantasy', motif:'Amber beacon spire'},
  'signal-relay':      {c:[.08,.8,1],  sky:[[.025,.07,.12],[.11,.27,.38]],tex:['floor-panel','terminal-surface'],audio:'ambient-facility',motif:'Split relay crown'},
  'arsenal-run':       {c:[1,.25,.06], sky:[[.15,.035,.02],[.5,.18,.06]],tex:['arena-floor','hazard'],audio:'ambient-arena',motif:'Reactor trophy'},
  'silent-sector':     {c:[.2,.35,1],  sky:[[.015,.025,.06],[.07,.12,.24]],tex:['dark-wall','emissive-strip'],audio:'stealth-bed',motif:'Security iris'},
  'power-grid':        {c:[.05,1,.75], sky:[[.02,.06,.08],[.09,.3,.28]],tex:['machinery','emissive-strip'],audio:'power-offline',motif:'Power lattice'},
  'relic-frontier':    {c:[1,.5,.12],  sky:[[.12,.2,.28],[.66,.42,.2]],tex:['ground-sand','relic-emissive'],audio:'ambient-fantasy',motif:'Frontier astrolabe'},
  'relic-island':      {c:[.1,.9,.8],  sky:[[.04,.2,.3],[.32,.72,.68]],tex:['ground-sand','moss-stone'],audio:'forest-bed',motif:'Tidal relic'},
  'forest-range':      {c:[.85,.65,.1],sky:[[.08,.24,.2],[.5,.67,.4]],tex:['grass','bark'],audio:'forest-bed',motif:'Range marker'},
  'iron-arena':        {c:[1,.38,.08], sky:[[.12,.08,.07],[.42,.24,.14]],tex:['arena-wall','arena-cover'],audio:'ambient-arena',motif:'Iron champion crest'},
  'dungeon-descent':   {c:[.55,.2,1],  sky:[[.035,.02,.07],[.18,.08,.28]],tex:['dark-ruin-stone','worn-stone'],audio:'temple-wind',motif:'Descending rune obelisk'},
  'npc-puzzle-adventure':{c:[1,.7,.14],sky:[[.12,.25,.32],[.65,.66,.44]],tex:['clean-stone','foliage'],audio:'ambient-fantasy',motif:'Village quest compass'},
  'opus-arena':        {c:[1,.12,.42], sky:[[.13,.025,.09],[.48,.1,.25]],tex:['arena-floor','arena-cover'],audio:'ambient-arena',motif:'Opus combat standard'},
  'power-station':     {c:[.15,.75,1], sky:[[.03,.07,.1],[.16,.3,.37]],tex:['clean-metal','machinery'],audio:'power-online',motif:'Turbine crown'},
  'relic-runner-2':    {c:[1,.6,.08],  sky:[[.18,.12,.06],[.68,.4,.16]],tex:['ground-sand','hazard'],audio:'ambient-fantasy',motif:'Runner gate'},
  'sentinel-maze':     {c:[.25,1,.55], sky:[[.035,.09,.07],[.13,.34,.22]],tex:['moss-stone','dark-ruin-stone'],audio:'stealth-bed',motif:'Sentinel eye'},
  'signal-zero':       {c:[.7,.2,1],   sky:[[.05,.02,.1],[.2,.08,.34]],tex:['dark-wall','terminal-surface'],audio:'ambient-facility',motif:'Zero-point antenna'},
  'survival-arena-2':  {c:[.75,.2,1],  sky:[[.1,.035,.16],[.38,.13,.42]],tex:['arena-floor','dark-ruin-stone'],audio:'temple-wind',motif:'Storm survival shard'},
  'survival-arena-3':  {c:[.05,1,.9],  sky:[[.01,.08,.1],[.06,.34,.35]],tex:['floor-panel','emissive-strip'],audio:'power-online',motif:'Neon defense mast'},
  'textured-adventure':{c:[1,.55,.22], sky:[[.12,.23,.3],[.57,.61,.47]],tex:['clean-stone','dirt-path'],audio:'ambient-fantasy',motif:'Material wayfinder'},
  'valley-run':        {c:[1,.72,.12], sky:[[.12,.32,.42],[.62,.72,.52]],tex:['grass','dirt-path'],audio:'forest-bed',motif:'Valley finish beacon'},
  'painted-wilds':     {c:[1,.3,.48],  sky:[[.22,.12,.28],[.78,.42,.42]],tex:['grass','foliage'],audio:'forest-bed',motif:'Painted totem'},
  'assembly-line':     {c:[1,.62,.08], sky:[[.07,.07,.06],[.34,.27,.14]],tex:['worn-metal','hazard'],audio:'ambient-facility',motif:'Factory index tower'},
  'blacksite':         {c:[.1,.7,1],   sky:[[.008,.015,.035],[.045,.12,.2]],tex:['dark-wall','clean-metal'],audio:'stealth-bed',motif:'Blacksite signal monolith'},
  'moving-temple':     {c:[1,.45,.08], sky:[[.09,.05,.17],[.38,.2,.43]],tex:['worn-stone','relic-emissive'],audio:'temple-wind',motif:'Kinetic shrine crown'},
  'shifting-facility': {c:[.25,.9,1],  sky:[[.025,.06,.1],[.09,.26,.38]],tex:['floor-panel','emissive-strip'],audio:'ambient-facility',motif:'Phase alignment mast'},
  'skyway-trial':      {c:[.2,.8,1],   sky:[[.08,.3,.55],[.54,.76,.88]],tex:['clean-metal','hazard'],audio:'temple-wind',motif:'Skyway flight ring'},
  'survival-arena':    {c:[1,.5,.08],  sky:[[.14,.18,.3],[.55,.44,.26]],tex:['arena-floor','relic-emissive'],audio:'ambient-arena',motif:'Relic survival dais'},
  'temple-switch-puzzle':{c:[.95,.62,.12],sky:[[.09,.07,.16],[.42,.3,.42]],tex:['worn-stone','relic-emissive'],audio:'temple-wind',motif:'Switch constellation'}
};
let serial=0;
function spawn(level){return level.objects.find(o=>o.isDefaultSpawn)||level.objects.find(o=>o.isSpawnPoint)||{position:[0,1,0]};}
function add(level,obj){level.objects.push({...obj,id:`elev-${++serial}`,behaviors:obj.behaviors||[]});}
function prune(p){const body=JSON.stringify({...p,assets:undefined,textures:undefined,audio:undefined});p.assets=(p.assets||[]).filter(a=>body.includes('"'+a.id+'"'));const ab=JSON.stringify(p.assets);p.textures=(p.textures||[]).filter(a=>(body+ab).includes('"'+a.id+'"'));p.audio=(p.audio||[]).filter(a=>body.includes('"'+a.id+'"'));}
for(const [index,g] of catalog.games.entries()){
  const spec=specs[g.id];if(!spec)throw new Error('Missing elevation spec: '+g.id);
  serial=0;const file=path.join(ROOT,'games',g.file),p=JSON.parse(fs.readFileSync(file));
  for(const [li,l] of p.levels.entries()){
    l.objects=l.objects.filter(o=>!String(o.id||'').startsWith('elev-'));
    const s=spawn(l).position||[0,1,0],yaw=l.playerSettings?.initialYaw||0,forward=[Math.sin(yaw),Math.cos(yaw)],side=[forward[1],-forward[0]];
    const distance=li?9:11,x=s[0]+forward[0]*distance+side[0]*4,z=s[2]+forward[1]*distance+side[1]*4,y=Math.max(0,(s[1]||1)-1.3);
    kit.install(p,{meshes:['hero-'+g.id],textures:spec.tex,audio:[spec.audio]});
    add(l,{kind:'cube',name:spec.motif,position:[x,y,z],scale:[li?.8:1.12,li?.8:1.12,li?.8:1.12],color:[1,1,1],rotationY:(index%8)*Math.PI/4,mesh:'asset',assetId:'showcase-hero-'+g.id,textureAssetId:'showcase-palette',solid:false});
    add(l,{kind:'light',name:spec.motif+' key light',position:[x,y+4.2,z],options:{lightType:'point',position:[x,y+4.2,z],color:spec.c,intensity:2.2,range:13,enabled:true}});
    l.environment={...(l.environment||{}),skyTop:spec.sky[0],skyHorizon:spec.sky[1],shadows:{enabled:true,resolution:1024,distance:50,bias:.0025,...(l.environment?.shadows||{})}};
    l.ambientAudio={audioAssetId:'showcase-'+spec.audio,volume:.14+(index%3)*.025};
    const floors=l.objects.filter(o=>o.kind==='cube'&&/floor|ground|platform|walkway|court|plaza|path|road/i.test(o.name||'')).slice(0,4);
    for(const [fi,o] of floors.entries()){o.textureAssetId='showcase-'+spec.tex[fi%spec.tex.length];o.uvScale=[Math.max(1,(o.scale?.[0]||4)/5),Math.max(1,(o.scale?.[2]||4)/5)];}
    // The five ascending Skyway landings were technically reachable but the
    // normal route remained timing-fragile. A modest authored footprint increase
    // preserves every gap and jump while making the intended cadence repeatable.
    if(g.id==='skyway-trial')for(const o of l.objects.filter(o=>/^Platform[1-5]$/.test(o.name||''))){o.scale[0]=5;o.scale[2]=5;}
    const start=l.ui?.startScreen;if(start){start.subtitle=(start.subtitle||g.description).replace(/\s+$/,'');const line=` Visual landmark: ${spec.motif}.`;if(!start.subtitle.includes(line.trim()))start.subtitle+=line;}
  }
  p.meta={...(p.meta||{}),version:'1.3.0',elevationCampaign:'full-library-2026-09-08',signatureMotif:spec.motif};
  prune(p);fs.writeFileSync(file,JSON.stringify(p,null,2)+'\n');
  console.log(`${String(index+1).padStart(2,'0')}/28 ${g.id}: ${spec.motif}`);
}
