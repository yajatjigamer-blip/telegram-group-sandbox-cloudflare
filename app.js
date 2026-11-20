import * as THREE from 'three';

// Telegram Mini App setup
const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();
const params = new URLSearchParams(location.search);
const roomId = params.get('room') || (tg?.initDataUnsafe?.start_param || params.get('tgWebAppStartParam') || '').replace(/^room_/, '') || 'demo-room';
const userName = tg?.initDataUnsafe?.user?.first_name || 'Guest';
document.getElementById('room-label').textContent = `Room ${String(roomId).slice(-8)}`;

// -----------------------------------------------------------------------------
// Renderer, scene and lighting
// -----------------------------------------------------------------------------
const isSmallScreen = matchMedia('(max-width: 720px), (pointer: coarse)').matches;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#9fb9c6');
scene.fog = new THREE.Fog('#9fb9c6', 22, 48);

const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.1, 100);
const renderer = new THREE.WebGLRenderer({ antialias: !isSmallScreen, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, isSmallScreen ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.domElement.setAttribute('aria-label', '3D lounge. Use the joystick or WASD to move.');
document.getElementById('game').appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xeaf5ff, 0x665345, 1.55));
const ambient = new THREE.AmbientLight(0xffe9d2, 0.34);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xffe8c9, 2.1);
sun.position.set(-7, 13, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(isSmallScreen ? 1024 : 2048, isSmallScreen ? 1024 : 2048);
sun.shadow.camera.left = -17;
sun.shadow.camera.right = 17;
sun.shadow.camera.top = 17;
sun.shadow.camera.bottom = -17;
sun.shadow.bias = -0.00018;
scene.add(sun);

const clamp = THREE.MathUtils.clamp;
const mat = (color, roughness = 0.75, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const textureCache = new Map();
function canvasTexture(key, draw, repeatX = 1, repeatY = 1) {
  if (textureCache.has(key)) return textureCache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  draw(ctx, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  textureCache.set(key, texture);
  return texture;
}
function woodTexture() {
  return canvasTexture('oak-wood', (ctx, w, h) => {
    ctx.fillStyle = '#815638'; ctx.fillRect(0, 0, w, h);
    const plankH = 84;
    for (let y = 0; y < h; y += plankH) {
      const shade = 25 + Math.floor((y / plankH) % 3) * 7;
      ctx.fillStyle = `rgb(${129 + shade},${83 + shade / 2},${48 + shade / 3})`;
      ctx.fillRect(0, y, w, plankH - 3);
      ctx.strokeStyle = 'rgba(37,20,12,.38)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, y + plankH - 2); ctx.lineTo(w, y + plankH - 2); ctx.stroke();
      for (let i = 0; i < 16; i++) {
        const yy = y + 7 + Math.random() * (plankH - 18);
        ctx.strokeStyle = `rgba(49,25,13,${.06 + Math.random() * .12})`;
        ctx.lineWidth = 1 + Math.random() * 2; ctx.beginPath(); ctx.moveTo(Math.random() * 80, yy);
        ctx.bezierCurveTo(130, yy - 6, 330, yy + 7, 512, yy - 3); ctx.stroke();
      }
      for (let x = (Math.floor(y / plankH) % 2) * 160; x < w; x += 320) {
        ctx.strokeStyle = 'rgba(43,24,14,.28)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + plankH - 3); ctx.stroke();
      }
    }
  }, 5, 4);
}
function plasterTexture() {
  return canvasTexture('warm-plaster', (ctx, w, h) => {
    ctx.fillStyle = '#d9c9b4'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 12500; i++) {
      const alpha = Math.random() * .08;
      ctx.fillStyle = Math.random() > .5 ? `rgba(255,255,255,${alpha})` : `rgba(85,60,40,${alpha})`;
      const s = Math.random() * 2 + .3; ctx.fillRect(Math.random() * w, Math.random() * h, s, s);
    }
  }, 2, 1);
}
function fabricTexture(key, base, accent) {
  return canvasTexture(key, (ctx, w, h) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = accent; ctx.globalAlpha = .25; ctx.lineWidth = 2;
    for (let i = 0; i < w; i += 7) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke(); }
    ctx.globalAlpha = .15;
    for (let i = 0; i < h; i += 7) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(w, i); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }, 2, 2);
}
function rugTexture() {
  return canvasTexture('woven-rug', (ctx, w, h) => {
    ctx.fillStyle = '#40566b'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < w; i += 8) { ctx.strokeStyle = i % 16 ? '#8f7567' : '#d0aa77'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke(); }
    for (let i = 0; i < h; i += 8) { ctx.strokeStyle = 'rgba(20,30,40,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(w, i); ctx.stroke(); }
    ctx.strokeStyle = '#d8b77e'; ctx.lineWidth = 12; ctx.strokeRect(20, 20, w - 40, h - 40);
    ctx.strokeStyle = '#d8b77e'; ctx.lineWidth = 3; ctx.strokeRect(37, 37, w - 74, h - 74);
  }, 2, 1.5);
}
const woodMat = new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: .48 });
const wallMat = new THREE.MeshStandardMaterial({ map: plasterTexture(), roughness: .96 });
const sofaMat = new THREE.MeshStandardMaterial({ map: fabricTexture('deep-teal-fabric', '#2d6870', '#a8d0c9'), roughness: .97 });
const pillowMat = new THREE.MeshStandardMaterial({ map: fabricTexture('gold-fabric', '#c18a4e', '#f4d5a0'), roughness: .95 });
const rugMat = new THREE.MeshStandardMaterial({ map: rugTexture(), roughness: 1 });
const brass = mat('#bd945b', .28, .78);
const darkMetal = mat('#263342', .36, .72);
const glassMat = new THREE.MeshPhysicalMaterial({ color: '#a9d7e5', roughness: .13, metalness: .05, transparent: true, opacity: .43, transmission: .22 });
const cream = mat('#eee1cb', .9);

function add(mesh, x, y, z, parent = scene) { mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh; }
function box(x, y, z, sx, sy, sz, material, parent = scene, options = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material?.isMaterial ? material : mat(material));
  mesh.castShadow = options.castShadow !== false; mesh.receiveShadow = options.receiveShadow !== false;
  mesh.position.set(x, y, z); parent.add(mesh); return mesh;
}
function cylinder(x, y, z, radiusTop, radiusBottom, height, material, parent = scene, segments = 20) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), material?.isMaterial ? material : mat(material));
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.position.set(x, y, z); parent.add(mesh); return mesh;
}
function sphere(x, y, z, radius, material, parent = scene, sx = 18, sy = 12) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, sx, sy), material?.isMaterial ? material : mat(material));
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.position.set(x, y, z); parent.add(mesh); return mesh;
}
function rodBetween(a, b, radius, material, parent = scene) {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
  const dir = new THREE.Vector3().subVectors(end, start);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, dir.length(), 10), material?.isMaterial ? material : mat(material));
  mesh.position.copy(start).add(end).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  mesh.castShadow = true; parent.add(mesh); return mesh;
}
function labelTexture(text) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#172536'; ctx.roundRect(3, 3, 506, 122, 22); ctx.fill();
  ctx.strokeStyle = '#d5b47a'; ctx.lineWidth = 5; ctx.roundRect(8, 8, 496, 112, 18); ctx.stroke();
  ctx.fillStyle = '#f4e7cf'; ctx.font = 'bold 42px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text.toUpperCase(), 256, 65);
  const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function addWallLabel(text, x, y, z, rotY = 0, width = 4) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(text), transparent: true, depthWrite: false }));
  sprite.position.set(x, y, z); sprite.scale.set(width, width * .25, 1); sprite.material.rotation = rotY; scene.add(sprite); return sprite;
}

// -----------------------------------------------------------------------------
// Room shell and interior architecture
// -----------------------------------------------------------------------------
const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 20), woodMat);
floor.rotation.x = -Math.PI / 2; floor.position.y = -.035; floor.receiveShadow = true; scene.add(floor);
box(0, 2.25, -10, 24, 4.5, .32, wallMat);
box(-12, 2.25, 0, .32, 4.5, 20, wallMat);
box(12, 2.25, 0, .32, 4.5, 20, wallMat);
// Ceiling beams frame the open roof, keeping the room airy in the 3D view.
for (const z of [-9.4, -4.7, 0, 4.7, 9.4]) box(0, 4.55, z, 24, .22, .28, woodMat);
for (const x of [-11.6, -6, 0, 6, 11.6]) box(x, 4.55, 0, .22, .22, 20, woodMat);
// Warm timber skirting boards.
box(0, .18, -9.78, 23.6, .34, .12, woodMat);
box(-11.78, .18, 0, .12, .34, 19.6, woodMat);
box(11.78, .18, 0, .12, .34, 19.6, woodMat);

// Panoramic back windows with dark frames and crossbars.
for (const cx of [-6.3, 0, 6.3]) {
  box(cx, 2.75, -9.79, 5.05, 2.25, .08, darkMetal);
  box(cx, 2.75, -9.72, 4.78, 1.98, .035, glassMat);
  box(cx, 2.75, -9.68, .055, 1.96, .05, cream);
  box(cx, 2.75, -9.68, 4.78, .055, .05, cream);
  box(cx - 1.58, 2.75, -9.65, .035, 1.95, .055, cream);
  box(cx + 1.58, 2.75, -9.65, .035, 1.95, .055, cream);
  box(cx, 2.75, -9.65, 4.75, .035, .055, cream);
}
// Curtains on the outer windows.
for (const x of [-9.1, -3.6, 2.7, 9.1]) {
  const curtain = new THREE.Mesh(new THREE.BoxGeometry(.48, 2.5, .16), fabricTexture('curtain-' + x, '#8b6758', '#d9b995'));
  curtain.position.set(x, 2.72, -9.46); scene.add(curtain);
}
// Decorative wall panels and framed art.
for (const x of [-9.9, -5.1, 5.1, 9.9]) {
  box(x, 2.5, -9.77, 1.45, 2.6, .05, woodMat);
  box(x, 2.5, -9.72, 1.27, 2.42, .035, mat('#b7a087', .94));
}
addWallLabel('The Hangout Club', 0, 3.98, -9.66, 0, 5.6);

// Large central woven rug.
const centralRug = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 4.3), rugMat);
centralRug.rotation.x = -Math.PI / 2; centralRug.position.set(-1, .018, 5.1); centralRug.receiveShadow = true; scene.add(centralRug);

// -----------------------------------------------------------------------------
// Lounge furniture: sectional sofa, chairs, coffee table, shelves and plants
// -----------------------------------------------------------------------------
function makeSofa(x, z, rotation = Math.PI / 2) {
  const group = new THREE.Group(); group.position.set(x, 0, z); group.rotation.y = rotation; scene.add(group);
  box(0, .48, 0, 4.05, .72, 1.55, sofaMat, group);
  box(0, 1.04, -.61, 4.05, 1.05, .35, sofaMat, group);
  box(-1.88, .88, 0, .34, .9, 1.55, sofaMat, group);
  box(1.88, .88, 0, .34, .9, 1.55, sofaMat, group);
  for (let i = 0; i < 3; i++) {
    const cushion = box(-1.22 + i * 1.22, .91, -.12, 1.08, .17, 1.1, pillowMat, group);
    cushion.rotation.z = -.025;
  }
  for (const [px, pz, color] of [[-1.3, -.49, '#d7ae78'], [0, -.49, '#b6c7ad'], [1.3, -.49, '#d89e91']]) {
    const pillow = box(px, 1.34, pz, .75, .68, .24, mat(color, .96), group); pillow.rotation.z = -.13;
  }
  for (const px of [-1.55, 1.55]) for (const pz of [-.5, .5]) cylinder(px, .16, pz, .075, .075, .35, darkMetal, group, 12);
  return group;
}
makeSofa(-8.5, 5.9, Math.PI / 2);

function makeArmchair(x, z, color = '#9e6554', rotation = 0) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotation; scene.add(g);
  const fabric = new THREE.MeshStandardMaterial({ map: fabricTexture('chair-' + color, color, '#f2d6b7'), roughness: .95 });
  box(0, .48, 0, 1.65, .55, 1.5, fabric, g);
  box(0, 1.0, -.55, 1.65, .95, .3, fabric, g);
  box(-.7, .82, 0, .25, .75, 1.35, fabric, g); box(.7, .82, 0, .25, .75, 1.35, fabric, g);
  for (const px of [-.62, .62]) for (const pz of [-.53, .53]) cylinder(px, .2, pz, .055, .07, .4, woodMat, g, 12);
}
makeArmchair(-5.2, 7.2, '#9b6656', -.3);
makeArmchair(-10.6, 2.7, '#6b8490', Math.PI / 2);

// Coffee table with inset glass and brass feet.
box(-7.5, .58, 4.25, 2.8, .16, 1.45, woodMat);
box(-7.5, .68, 4.25, 2.55, .035, 1.2, new THREE.MeshPhysicalMaterial({ color: '#c4d9d5', roughness: .12, metalness: .15, transparent: true, opacity: .55 }));
for (const x of [-8.65, -6.35]) for (const z of [3.75, 4.75]) cylinder(x, .28, z, .055, .075, .55, brass, scene, 12);
// Decorative books and a small vase.
box(-8.1, .79, 4.22, .55, .08, .42, mat('#b15f49'));
box(-8.08, .86, 4.22, .55, .07, .42, mat('#e4c48f'));
cylinder(-6.85, .93, 4.23, .15, .19, .42, mat('#6a99a0'), scene);
sphere(-6.85, 1.18, 4.23, .08, mat('#e2bc82'));

// Sideboard and shelving along the left wall.
box(-11.25, 1.1, -5.6, .9, 2.2, 4.8, woodMat);
for (const z of [-7.3, -5.7, -4.1]) box(-10.74, .5 + (z + 7.3) * .5, z, .18, .08, 4.4, brass);
for (let i = 0; i < 7; i++) {
  const book = box(-10.65 + (i % 2) * .13, .78 + Math.floor(i / 4) * .55, -7.4 + i * .34, .16, .68, .25, [mat('#a65a4c'), mat('#d1ad74'), mat('#547b79'), mat('#354b64')][i % 4]);
  book.rotation.x = (i % 2 ? -.08 : .08);
}

function makePlant(x, z, scale = 1) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(scale); scene.add(g);
  cylinder(0, .35, 0, .48, .58, .7, mat('#a96f50'), g, 24);
  cylinder(0, .72, 0, .46, .46, .08, mat('#40382f'), g, 24);
  rodBetween([0, .72, 0], [0, 2.0, 0], .045, mat('#4c7553'), g);
  for (let i = 0; i < 9; i++) {
    const a = i * Math.PI * 2 / 9, h = 1.25 + (i % 3) * .16;
    const leaf = sphere(Math.cos(a) * .42, h, Math.sin(a) * .42, .28, mat(i % 2 ? '#4c9368' : '#6da879'), g, 14, 10);
    leaf.scale.set(.55, 1.5, .72); leaf.rotation.z = Math.cos(a) * -.65; leaf.rotation.x = Math.sin(a) * .55;
  }
}
makePlant(-10.6, 8.2, 1.1); makePlant(10.6, -8.1, .95); makePlant(10.8, .1, .8);

// Floor lamps with softly glowing shades.
const animatedLights = [];
function makeFloorLamp(x, z) {
  cylinder(x, 1.1, z, .12, .16, 2.2, darkMetal, scene, 16);
  cylinder(x, 2.22, z, .36, .22, .48, mat('#e5d3b5', .6), scene, 24);
  const bulb = sphere(x, 1.98, z, .12, new THREE.MeshStandardMaterial({ color: '#fff2ce', emissive: '#ffd18b', emissiveIntensity: 1.15 }), scene);
  const light = new THREE.PointLight('#ffd9a3', 1.25, 5, 2); light.position.set(x, 1.9, z); scene.add(light); animatedLights.push({ bulb, light, offset: x });
}
makeFloorLamp(-4.9, 6.9); makeFloorLamp(-10.5, 5.2);

// Ceiling fan with rotating blades.
const fan = new THREE.Group(); fan.position.set(0, 4.28, 1.5); scene.add(fan);
cylinder(0, 0, 0, .16, .2, .32, brass, fan);
for (let i = 0; i < 4; i++) {
  const blade = box(0, -.015, -1.0, .28, .07, 1.95, woodMat, fan);
  blade.rotation.y = i * Math.PI / 2;
  const cap = sphere(0, 0, 0, .19, brass, fan); cap.scale.set(1, .5, 1);
}
rodBetween([0, 4.52, 1.5], [0, 4.28, 1.5], .055, darkMetal);

// Pendant lamps and warm pools of light.
for (const [x, z] of [[-6, -2.8], [0, -2.8], [6, -2.8], [-5, 3], [3, 3]]) {
  rodBetween([x, 4.38, z], [x, 3.55, z], .025, darkMetal);
  const shade = cylinder(x, 3.48, z, .32, .15, .38, mat('#d1ae7a', .45, .2), scene, 20);
  const bulb = sphere(x, 3.28, z, .095, new THREE.MeshStandardMaterial({ color: '#fff0c7', emissive: '#ffd28c', emissiveIntensity: 1.7 }), scene);
  const light = new THREE.PointLight('#ffdda7', .65, 7, 2); light.position.set(x, 3.25, z); scene.add(light); animatedLights.push({ bulb, light, offset: x + z });
}

// -----------------------------------------------------------------------------
// Game tables with custom illustrated board surfaces and chairs
// -----------------------------------------------------------------------------
const games = ['🎲 Ludo', '♟ Chess', '🐍 Snakes & Ladders', '🏠 Monopoly', '⭕ Tic-Tac-Toe', '🔴 Connect 4', '⚫ Checkers', '🃏 UNO', '🚢 Battleship', '🪵 Carrom'];
const tableMeshes = [];
function boardTexture(gameIndex) {
  return canvasTexture('board-' + gameIndex, (ctx, w, h) => {
    const creamBg = '#f0dfbd'; ctx.fillStyle = '#342b28'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = creamBg; ctx.fillRect(12, 12, w - 24, h - 24);
    const inset = 25;
    ctx.save(); ctx.translate(inset, inset); const bw = w - inset * 2, bh = h - inset * 2;
    const line = (color = '#60452f', width = 5) => { ctx.strokeStyle = color; ctx.lineWidth = width; };
    if (gameIndex === 0) { // Ludo
      const s = bw / 3, cell = Math.min(bw, bh) / 3;
      const colors = ['#dc594d', '#48a8a0', '#e1b44f', '#557dc0'];
      [[0,0],[2,0],[0,2],[2,2]].forEach(([gx,gy],k)=>{ctx.fillStyle=colors[k];ctx.fillRect(gx*s,gy*cell,s,cell);ctx.fillStyle='#fff4da';ctx.fillRect(gx*s+s*.18,gy*cell+cell*.18,s*.64,cell*.64);for(let j=0;j<4;j++){ctx.beginPath();ctx.arc(gx*s+s*(.34+(j%2)*.32),gy*cell+cell*(.34+Math.floor(j/2)*.32),s*.055,0,Math.PI*2);ctx.fillStyle=colors[k];ctx.fill();}});
      ctx.fillStyle='#f9e9c9';ctx.beginPath();ctx.moveTo(s,cell);ctx.lineTo(2*s,cell);ctx.lineTo(1.5*s,1.5*cell);ctx.closePath();ctx.fill();
      ctx.beginPath();ctx.moveTo(s,2*cell);ctx.lineTo(2*s,2*cell);ctx.lineTo(1.5*s,1.5*cell);ctx.closePath();ctx.fill();
    } else if (gameIndex === 1 || gameIndex === 6) { // Chess / Checkers
      const n = 8, size = Math.min(bw, bh) / n, ox = (bw - size*n)/2, oy = (bh - size*n)/2;
      for(let y=0;y<n;y++)for(let x=0;x<n;x++){ctx.fillStyle=(x+y)%2?'#6b4937':'#e5c99e';ctx.fillRect(ox+x*size,oy+y*size,size,size);}
      if(gameIndex===1){ctx.fillStyle='#f9ecd5';ctx.font=`bold ${size*.55}px serif`;ctx.textAlign='center';ctx.textBaseline='middle';for(let x=0;x<8;x++){ctx.fillText('♟',ox+(x+.5)*size,oy+size*.5);ctx.fillText('♟',ox+(x+.5)*size,oy+7.5*size);}}
      else{for(let y=0;y<3;y++)for(let x=0;x<8;x++)if((x+y)%2){ctx.beginPath();ctx.arc(ox+(x+.5)*size,oy+(y+.5)*size,size*.32,0,Math.PI*2);ctx.fillStyle='#463630';ctx.fill();} }
    } else if (gameIndex === 2) { // Snakes and ladders
      const n=10,s=Math.min(bw,bh)/n,ox=(bw-n*s)/2,oy=(bh-n*s)/2;
      for(let r=0;r<n;r++)for(let c=0;c<n;c++){const num=r*n+(r%2?n- c:c)+1;ctx.fillStyle=(r+c)%2?'#f1dcae':'#d7e1bd';ctx.fillRect(ox+c*s,oy+r*s,s,s);ctx.strokeStyle='#aa8f65';ctx.lineWidth=1;ctx.strokeRect(ox+c*s,oy+r*s,s,s);ctx.fillStyle='#70543c';ctx.font='11px system-ui';ctx.fillText(num,ox+c*s+3,oy+r*s+12);}
      for(let i=0;i<4;i++){ctx.strokeStyle=['#d46c5b','#559b91','#7186c7','#d2a44e'][i];ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(ox+40+i*37,oy+bh-35-i*10);ctx.bezierCurveTo(ox+90+i*20,oy+bh-140,ox+260-i*15,oy+110,ox+360-i*25,oy+35+i*16);ctx.stroke();}
    } else if (gameIndex === 3) { // Monopoly
      ctx.fillStyle='#e7d5b6';ctx.fillRect(0,0,bw,bh);ctx.strokeStyle='#60452f';ctx.lineWidth=3;ctx.strokeRect(2,2,bw-4,bh-4);
      const cols=['#bf6554','#5b98a3','#cfaa55','#719b72','#9877a6'];
      for(let i=0;i<9;i++){let p=i*bw/9;ctx.fillStyle=cols[i%cols.length];ctx.fillRect(p,0,bw/9-2,34);ctx.fillRect(p,bh-34,bw/9-2,34);ctx.fillStyle='#60452f';ctx.fillRect(0,p/ bw * bh,34,bh/9-2);ctx.fillRect(bw-34,p/ bw * bh,34,bh/9-2);}
      ctx.fillStyle='#654b38';ctx.font='bold 32px Georgia';ctx.textAlign='center';ctx.fillText('PROPERTY',bw/2,bh/2-4);ctx.font='20px system-ui';ctx.fillText('TRADE  ·  BUILD  ·  WIN',bw/2,bh/2+30);
    } else if (gameIndex === 4) { // Tic tac toe
      line('#634a39', 12);for(let i=1;i<3;i++){ctx.beginPath();ctx.moveTo(i*bw/3,20);ctx.lineTo(i*bw/3,bh-20);ctx.moveTo(20,i*bh/3);ctx.lineTo(bw-20,i*bh/3);ctx.stroke();}
      ctx.strokeStyle='#538b9a';ctx.lineWidth=10;ctx.beginPath();ctx.arc(bw*.17,bh*.17,26,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#bc6655';ctx.beginPath();ctx.moveTo(bw*.55,bh*.53);ctx.lineTo(bw*.82,bh*.8);ctx.moveTo(bw*.82,bh*.53);ctx.lineTo(bw*.55,bh*.8);ctx.stroke();
    } else if (gameIndex === 5) { // Connect 4
      ctx.fillStyle='#3579b6';ctx.fillRect(18,18,bw-36,bh-36);const cols=7,rows=6,rad=Math.min((bw-60)/cols,(bh-50)/rows)*.36;
      for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){ctx.beginPath();ctx.arc(35+c*(bw-70)/(cols-1),35+r*(bh-70)/(rows-1),rad,0,Math.PI*2);ctx.fillStyle='#f1dfc3';ctx.fill();}
      for(const [r,c,col] of [[5,0,'#e95e4e'],[5,1,'#e9c34e'],[4,1,'#e95e4e'],[5,2,'#e9c34e'],[4,2,'#e95e4e'],[3,2,'#e9c34e']]){ctx.beginPath();ctx.arc(35+c*(bw-70)/(cols-1),35+r*(bh-70)/(rows-1),rad,0,Math.PI*2);ctx.fillStyle=col;ctx.fill();}
    } else if (gameIndex === 7) { // UNO
      ctx.fillStyle='#e7d7b8';ctx.fillRect(0,0,bw,bh);const colors=['#e85c4d','#3d83c4','#e6c34d','#4a9b70'];
      for(let i=0;i<5;i++){ctx.save();ctx.translate(bw*.5+(i-2)*43,bh*.5+(i%2)*4);ctx.rotate((i-2)*.13);ctx.fillStyle=colors[i%4];ctx.strokeStyle='#fff1d5';ctx.lineWidth=5;ctx.beginPath();ctx.roundRect(-40,-60,80,120,12);ctx.fill();ctx.stroke();ctx.fillStyle='#fff6e9';ctx.font='bold 31px system-ui';ctx.textAlign='center';ctx.fillText(['1','7','↻','+2','0'][i],0,10);ctx.restore();}
    } else if (gameIndex === 8) { // Battleship
      const n=10,s=Math.min(bw,bh)/n,ox=(bw-n*s)/2,oy=(bh-n*s)/2;ctx.fillStyle='#d5e6e4';ctx.fillRect(ox,oy,s*n,s*n);
      for(let i=0;i<=n;i++){ctx.strokeStyle='#6d8c96';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(ox+i*s,oy);ctx.lineTo(ox+i*s,oy+n*s);ctx.moveTo(ox,oy+i*s);ctx.lineTo(ox+n*s,oy+i*s);ctx.stroke();}
      ctx.fillStyle='#c66a55';ctx.fillRect(ox+2*s,oy+3*s,4*s,s);ctx.fillStyle='#627e8e';ctx.fillRect(ox+6*s,oy+7*s,3*s,s);
    } else { // Carrom
      ctx.fillStyle='#d4a96d';ctx.fillRect(0,0,bw,bh);ctx.strokeStyle='#815532';ctx.lineWidth=9;ctx.strokeRect(12,12,bw-24,bh-24);ctx.lineWidth=4;ctx.strokeRect(32,32,bw-64,bh-64);
      for(const [x,y] of [[35,35],[bw-35,35],[35,bh-35],[bw-35,bh-35]]){ctx.beginPath();ctx.arc(x,y,13,0,Math.PI*2);ctx.fillStyle='#322822';ctx.fill();}
      ctx.beginPath();ctx.arc(bw/2,bh/2,45,0,Math.PI*2);ctx.strokeStyle='#8b5e3f';ctx.lineWidth=4;ctx.stroke();
      for(let i=0;i<9;i++){const a=i*Math.PI*2/9;ctx.beginPath();ctx.arc(bw/2+Math.cos(a)*28,bh/2+Math.sin(a)*28,10,0,Math.PI*2);ctx.fillStyle=i%2?'#2d2927':'#f7e5c5';ctx.fill();}
      ctx.beginPath();ctx.arc(bw/2,bh/2,9,0,Math.PI*2);ctx.fillStyle='#ca5549';ctx.fill();
    }
    ctx.restore();
  });
}
function makeChair(x, z, rotation = 0) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotation; scene.add(g);
  box(0, .62, 0, .82, .18, .72, woodMat, g);
  box(0, 1.02, .29, .82, .82, .13, woodMat, g);
  box(0, .73, 0, .7, .07, .6, pillowMat, g);
  for (const px of [-.3, .3]) for (const pz of [-.24, .24]) cylinder(px, .29, pz, .045, .055, .58, darkMetal, g, 10);
}
const tablePositions = [[-8,-5],[-4,-5],[0,-5],[4,-5],[-8,-.5],[-4,-.5],[0,-.5],[4,-.5],[-3.4,4],[1.1,4]];
tablePositions.forEach(([x, z], i) => {
  const group = new THREE.Group(); group.position.set(x, 0, z); scene.add(group);
  box(0, .72, 0, 2.55, .22, 1.82, woodMat, group);
  box(0, .845, 0, 2.43, .055, 1.7, brass, group);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(2.25, 1.5), new THREE.MeshStandardMaterial({ map: boardTexture(i), roughness: .78 }));
  board.rotation.x = -Math.PI / 2; board.position.y = .879; board.userData.game = i; board.castShadow = false; group.add(board); tableMeshes.push(board);
  // Brass corner studs and carved feet.
  for (const px of [-1.12, 1.12]) for (const pz of [-.75, .75]) {
    sphere(px, .89, pz, .055, brass, group, 10, 8);
    cylinder(px * .78, .34, pz * .78, .065, .09, .68, woodMat, group, 12);
  }
  // Name plaque on the player-facing edge.
  const plaque = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(games[i].replace(/^\S+\s/, '')), transparent: true, depthWrite: false }));
  plaque.position.set(0, 1.36, .99); plaque.scale.set(1.55, .38, 1); group.add(plaque);
  // Two small upholstered chairs at each side of the table.
  makeChair(x, z + 1.42, 0); makeChair(x, z - 1.42, Math.PI);
});

// -----------------------------------------------------------------------------
// Boxing ring, ropes, corner pads and overhead sign
// -----------------------------------------------------------------------------
const ringX = 8.3, ringZ = 5.4;
box(ringX, .36, ringZ, 4.25, .55, 4.25, darkMetal);
box(ringX, .66, ringZ, 3.9, .12, 3.9, mat('#eee4d1'));
const ringCanvas = document.createElement('canvas'); ringCanvas.width = 512; ringCanvas.height = 512;
const ringCtx = ringCanvas.getContext('2d'); ringCtx.fillStyle = '#e7dfd0'; ringCtx.fillRect(0,0,512,512); ringCtx.strokeStyle='#c1b39b'; ringCtx.lineWidth=10; ringCtx.strokeRect(28,28,456,456); ringCtx.strokeStyle='#ca6d5c'; ringCtx.lineWidth=6; ringCtx.beginPath(); ringCtx.arc(256,256,105,0,Math.PI*2); ringCtx.stroke(); ringCtx.font='bold 38px system-ui'; ringCtx.fillStyle='#8d4c45'; ringCtx.textAlign='center'; ringCtx.fillText('FIGHT CLUB',256,265);
const ringTex = new THREE.CanvasTexture(ringCanvas); ringTex.colorSpace = THREE.SRGBColorSpace;
const ringSurface = new THREE.Mesh(new THREE.PlaneGeometry(3.82,3.82), new THREE.MeshStandardMaterial({ map:ringTex, roughness:.9 })); ringSurface.rotation.x=-Math.PI/2; ringSurface.position.set(ringX,.73,ringZ); scene.add(ringSurface);
const postMat = mat('#f2e6d5', .28, .18), ropeMats = [mat('#d14f50',.35),mat('#eee4d6',.35),mat('#4b83b4',.35)];
for (const [px,pz] of [[ringX-1.88,ringZ-1.88],[ringX+1.88,ringZ-1.88],[ringX-1.88,ringZ+1.88],[ringX+1.88,ringZ+1.88]]) {
  cylinder(px,1.62,pz,.105,.14,1.95,postMat,scene,18);
  const pad = sphere(px,2.15,pz,.19,mat('#c8a270'),scene); pad.scale.set(.8,1.5,.8);
}
for (let tier=0;tier<3;tier++) {
  const y=1.05+tier*.43, rope=ropeMats[tier];
  rodBetween([ringX-1.88,y,ringZ-1.88],[ringX+1.88,y,ringZ-1.88],.042,rope);
  rodBetween([ringX-1.88,y,ringZ+1.88],[ringX+1.88,y,ringZ+1.88],.042,rope);
  rodBetween([ringX-1.88,y,ringZ-1.88],[ringX-1.88,y,ringZ+1.88],.042,rope);
  rodBetween([ringX+1.88,y,ringZ-1.88],[ringX+1.88,y,ringZ+1.88],.042,rope);
}
addWallLabel('BOXING ARENA', 8.25, 3.45, 2.95, 0, 3.6);

// Decorative wall-mounted display and animated screen glow.
box(0, 1.95, -9.57, 2.7, 1.5, .22, darkMetal);
const screenCanvas=document.createElement('canvas');screenCanvas.width=512;screenCanvas.height=256;
const screenCtx=screenCanvas.getContext('2d');screenCtx.fillStyle='#172a43';screenCtx.fillRect(0,0,512,256);screenCtx.fillStyle='#82b7c5';screenCtx.font='bold 46px system-ui';screenCtx.textAlign='center';screenCtx.fillText('HANGOUT',256,112);screenCtx.fillStyle='#e7c98f';screenCtx.font='24px system-ui';screenCtx.fillText('PLAY  ·  CHAT  ·  CONNECT',256,164);
const screenTex=new THREE.CanvasTexture(screenCanvas);screenTex.colorSpace=THREE.SRGBColorSpace;
const screenMesh=new THREE.Mesh(new THREE.PlaneGeometry(2.48,1.25),new THREE.MeshBasicMaterial({map:screenTex}));screenMesh.position.set(0,1.96,-9.43);scene.add(screenMesh);
const screenGlow=new THREE.PointLight('#76b9d0',.35,4,2);screenGlow.position.set(0,2,-8.8);scene.add(screenGlow);

// -----------------------------------------------------------------------------
// Player avatars: animated idle, walking and emotes
// -----------------------------------------------------------------------------
const avatarMaterial = color => new THREE.MeshStandardMaterial({ color, roughness: .68 });
function makeAvatar(shirt = '#477fc4', hairColor = '#47372e') {
  const root = new THREE.Group();
  const bodyMat = avatarMaterial(shirt), skin = avatarMaterial('#e9b992'), hairM = avatarMaterial(hairColor), shoeM = mat('#263345', .65);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.29,.62,5,10),bodyMat); body.position.y=1.03; body.castShadow=true; root.add(body);
  const headGroup = new THREE.Group(); headGroup.position.y=1.58; root.add(headGroup);
  sphere(0,0,0,.31,skin,headGroup,20,14);
  const hair = sphere(0,.12,.015,.323,hairM,headGroup,20,12); hair.scale.set(1.02,.72,1.04);
  // Eyes face the default forward direction (-Z).
  sphere(-.105,.015,-.278,.034,mat('#28292c'),headGroup,10,8);
  sphere(.105,.015,-.278,.034,mat('#28292c'),headGroup,10,8);
  sphere(0,-.085,-.3,.026,mat('#ad7162'),headGroup,10,8);
  const armPivots=[];
  for (const side of [-1,1]) {
    const pivot=new THREE.Group(); pivot.position.set(side*.39,1.28,0); root.add(pivot); armPivots.push(pivot);
    const arm=cylinder(0,-.29,0,.115,.14,.63,skin,pivot,14); arm.rotation.z=side*-.08;
    sphere(0,-.61,-.005,.13,skin,pivot,12,9);
  }
  const legPivots=[];
  for (const side of [-1,1]) {
    const pivot=new THREE.Group();pivot.position.set(side*.17,.57,0);root.add(pivot);legPivots.push(pivot);
    cylinder(0,-.22,0,.14,.16,.48,bodyMat,pivot,12);
    const shoe=box(0,-.47,-.09,.3,.16,.43,shoeM,pivot);shoe.position.z=-.09;
  }
  // Soft circular floor shadow.
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(.52,24),new THREE.MeshBasicMaterial({color:'#172433',transparent:true,opacity:.17,depthWrite:false}));
  shadow.rotation.x=-Math.PI/2;shadow.position.y=.025;root.add(shadow);
  scene.add(root);
  return {root,body,headGroup,armPivots,legPivots,shadow,walkPhase:0,emote:null,emoteUntil:0,target:new THREE.Vector3()};
}
const avatar = makeAvatar('#477fc4');
avatar.root.position.set(0,0,7.6);
const remotePlayers = new Map();
let socketId = null;

function playEmote(player, kind) { player.emote=kind; player.emoteUntil=performance.now()+1500; }
function animateAvatar(player, time, delta, moving) {
  const phase=player.walkPhase;
  player.body.position.y=1.03+(moving?Math.abs(Math.sin(phase))*0.075:Math.sin(time*2.1)*.018);
  player.headGroup.rotation.z=moving?Math.sin(phase)*.035:Math.sin(time*1.3)*.018;
  player.legPivots[0].rotation.x=moving?Math.sin(phase)*.62:Math.sin(time*1.2)*.025;
  player.legPivots[1].rotation.x=moving?-Math.sin(phase)*.62:-Math.sin(time*1.2)*.025;
  player.armPivots[0].rotation.x=moving?-Math.sin(phase)*.48:0;
  player.armPivots[1].rotation.x=moving?Math.sin(phase)*.48:0;
  player.armPivots[0].rotation.z=-.08;player.armPivots[1].rotation.z=.08;
  if(player.emote && performance.now()<player.emoteUntil){
    const t=(player.emoteUntil-performance.now())/1500;
    if(player.emote==='wave'){player.armPivots[1].rotation.z=-2.45+Math.sin(time*14)*.28;player.armPivots[1].rotation.x=-.35;}
    if(player.emote==='hug'){player.armPivots[0].rotation.z=1.35*t;player.armPivots[1].rotation.z=-1.35*t;}
    if(player.emote==='slap'){player.armPivots[1].rotation.z=-2.5*Math.sin((1-t)*Math.PI);player.armPivots[1].rotation.x=-1.2;}
    if(player.emote==='kiss'){player.headGroup.rotation.x=-.28*Math.sin((1-t)*Math.PI);player.armPivots[1].rotation.z=-.8*t;}
  } else player.emote=null;
}

// -----------------------------------------------------------------------------
// Camera and controls: keyboard, right-mouse orbit, one-finger touch orbit,
// plus a fixed mobile virtual joystick.
// -----------------------------------------------------------------------------
const keys = Object.create(null);
let cameraYaw = 0;
let cameraPitch = .42;
let cameraDistance = isSmallScreen ? 9.2 : 10.5;
const cameraTarget = new THREE.Vector3();
const desiredCamera = new THREE.Vector3();
const joystick = { x: 0, y: 0, active: false, pointerId: null };
const joystickEl = document.getElementById('joystick');
const joystickKnob = document.getElementById('joystick-knob');
const joystickRadius = 34;
function updateJoystick(e) {
  const r=joystickEl.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
  let dx=e.clientX-cx,dy=e.clientY-cy;const len=Math.hypot(dx,dy);
  if(len>joystickRadius){dx=dx/len*joystickRadius;dy=dy/len*joystickRadius;}
  joystick.x=dx/joystickRadius;joystick.y=-dy/joystickRadius;
  joystickKnob.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;
}
function resetJoystick(){joystick.x=0;joystick.y=0;joystick.active=false;joystick.pointerId=null;joystickKnob.style.transform='translate(-50%,-50%)';}
joystickEl.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();joystick.active=true;joystick.pointerId=e.pointerId;joystickEl.setPointerCapture(e.pointerId);updateJoystick(e);});
joystickEl.addEventListener('pointermove',e=>{if(joystick.active&&e.pointerId===joystick.pointerId){e.preventDefault();updateJoystick(e);}});
for(const eventName of ['pointerup','pointercancel','lostpointercapture'])joystickEl.addEventListener(eventName,e=>{if(joystick.pointerId===null||e.pointerId===joystick.pointerId)resetJoystick();});

addEventListener('keydown',e=>{
  const key=e.key.toLowerCase();
  if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)){
    keys[key]=true;
    if(key.startsWith('arrow'))e.preventDefault();
  }
});
addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false;});
addEventListener('blur',()=>{for(const k of Object.keys(keys))keys[k]=false;resetJoystick();});

const canvas=renderer.domElement;
let pointerState=null;
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{
  if(e.pointerType==='mouse'&&e.button!==2)return;
  if(e.pointerType==='touch'&&!e.isPrimary)return;
  pointerState={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false,orbit:e.pointerType==='touch'||e.button===2,type:e.pointerType,button:e.button};
  if(pointerState.orbit){canvas.setPointerCapture?.(e.pointerId);e.preventDefault();}
});
canvas.addEventListener('pointermove',e=>{
  if(!pointerState||e.pointerId!==pointerState.id||!pointerState.orbit)return;
  const dx=e.clientX-pointerState.lastX,dy=e.clientY-pointerState.lastY;
  if(Math.abs(e.clientX-pointerState.x)+Math.abs(e.clientY-pointerState.y)>5)pointerState.moved=true;
  cameraYaw-=dx*.006;
  cameraPitch=clamp(cameraPitch+dy*.003,.18,.92);
  pointerState.lastX=e.clientX;pointerState.lastY=e.clientY;
});
function trySelectTable(e){
  const rect=canvas.getBoundingClientRect();
  const ndc=new THREE.Vector2(((e.clientX-rect.left)/rect.width)*2-1,-((e.clientY-rect.top)/rect.height)*2+1);
  const raycaster=new THREE.Raycaster();raycaster.setFromCamera(ndc,camera);
  const hit=raycaster.intersectObjects(tableMeshes,false)[0];if(hit)openTable(hit.object.userData.game);
}
canvas.addEventListener('pointerup',e=>{
  if(!pointerState||e.pointerId!==pointerState.id)return;
  const state=pointerState;pointerState=null;
  const distance=Math.hypot(e.clientX-state.x,e.clientY-state.y);
  if(!state.moved&&distance<8&&(state.type==='touch'||state.button===0))trySelectTable(e);
});
canvas.addEventListener('pointercancel',()=>{pointerState=null;});
canvas.addEventListener('wheel',e=>{cameraDistance=clamp(cameraDistance+Math.sign(e.deltaY)*.7,6.5,14);},{passive:true});

function movementInput(){
  let x=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0)+joystick.x;
  let y=(keys.w||keys.arrowup?1:0)-(keys.s||keys.arrowdown?1:0)+joystick.y;
  const len=Math.hypot(x,y);if(len>1){x/=len;y/=len;}return {x,y,len:Math.min(1,len)};
}

// -----------------------------------------------------------------------------
// Multiplayer presence over the Cloudflare Durable Object WebSocket endpoint
// -----------------------------------------------------------------------------
let socket;
try {
  const wsUrl=new URL('/ws',location.href);wsUrl.protocol=location.protocol==='https:'?'wss:':'ws:';wsUrl.searchParams.set('room',roomId);wsUrl.searchParams.set('name',userName);
  socket=new WebSocket(wsUrl);
  socket.addEventListener('open',()=>toast('Connected to your group lounge'));
  socket.addEventListener('message',event=>{
    let d;try{d=JSON.parse(event.data)}catch{return;}
    if(d.type==='joined'){
      socketId=d.id;
      for(const p of d.players||[])if(p.id&&p.id!==socketId)addRemote(p.id,p.name,p.x,p.z);
      updateOnline();
    }
    if(d.type==='player-joined'){addRemote(d.id,d.name);updateOnline();}
    if(d.type==='player-moved'){
      const p=remotePlayers.get(d.id);if(p){p.target.set(d.x,0,d.z);p.moving=true;}
    }
    if(d.type==='player-left'){removeRemote(d.id);updateOnline();}
    if(d.type==='emote'){
      const p=d.id?remotePlayers.get(d.id):[...remotePlayers.values()].find(v=>v.playerName===d.name);if(p)playEmote(p,d.kind);
      toast(`${d.name} used ${d.kind}!`);
    }
  });
  socket.addEventListener('close',()=>toast('Multiplayer connection closed'));
  socket.addEventListener('error',()=>toast('Multiplayer connection unavailable'));
}catch(e){toast('Multiplayer connection unavailable');}
function addRemote(id,name,x=0,z=0){
  if(!id||id===socketId||remotePlayers.has(id))return;
  const p=makeAvatar('#b16cce','#30283d');p.root.position.set(Number(x)||0,0,Number(z)||0);p.target.set(p.root.position.x,0,p.root.position.z);p.playerName=name||'Guest';remotePlayers.set(id,p);
}
function removeRemote(id){const p=remotePlayers.get(id);if(p){scene.remove(p.root);p.root.traverse(o=>{if(o.geometry)o.geometry.dispose();});remotePlayers.delete(id);}}
function updateOnline(){document.getElementById('online-count').textContent=1+remotePlayers.size;}
let lastSentAt=0,lastSentX=999,lastSentZ=999;
function sendMove(now){
  const x=avatar.root.position.x,z=avatar.root.position.z;
  if(socket?.readyState===WebSocket.OPEN&&(now-lastSentAt>110||Math.hypot(x-lastSentX,z-lastSentZ)>.45)){
    socket.send(JSON.stringify({type:'move',x,z}));lastSentAt=now;lastSentX=x;lastSentZ=z;
  }
}

// -----------------------------------------------------------------------------
// Game table lobby UI and emotes
// -----------------------------------------------------------------------------
const panel=document.getElementById('table-panel'),list=document.getElementById('game-list'),detail=document.getElementById('game-detail');
games.forEach((game,i)=>{const b=document.createElement('button');b.textContent=game;b.addEventListener('click',()=>selectGame(i));list.appendChild(b);});
function openTable(i){panel.hidden=false;selectGame(i);}
function selectGame(i){
  [...list.children].forEach((b,j)=>b.classList.toggle('selected',i===j));
  document.getElementById('table-title').textContent=games[i];
  detail.innerHTML=`<div class="game-detail"><b>${games[i]}</b><br>This is the ${games[i].replace(/^\S+\s/,'')} table in the lounge. The board artwork is ready; the playable rules engine and synchronized turns are a separate game-development step.<br><button id="join-table">Join table</button></div>`;
  document.getElementById('join-table').addEventListener('click',()=>toast(`You joined the ${games[i]} table`));
}
document.getElementById('close-panel').addEventListener('click',()=>{panel.hidden=true;});
let toastTimer;
function toast(message){const el=document.getElementById('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2300);}
document.querySelectorAll('[data-emote]').forEach(button=>button.addEventListener('click',()=>{
  const kind=button.dataset.emote;playEmote(avatar,kind);
  if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify({type:'emote',kind}));
  toast(`${kind.charAt(0).toUpperCase()+kind.slice(1)} emote sent`);
}));

// -----------------------------------------------------------------------------
// Render loop: smooth movement, orbit camera, remote interpolation and ambience
// -----------------------------------------------------------------------------
let previousTime=performance.now(),animationClock=0;
function animate(now){
  requestAnimationFrame(animate);
  const delta=Math.min(.05,(now-previousTime)/1000||0);previousTime=now;animationClock+=delta;

  const input=movementInput();
  const moving=input.len>.06&&panel.hidden;
  if(moving){
    const forwardX=-Math.sin(cameraYaw),forwardZ=-Math.cos(cameraYaw);
    const rightX=Math.cos(cameraYaw),rightZ=-Math.sin(cameraYaw);
    const moveX=rightX*input.x+forwardX*input.y;
    const moveZ=rightZ*input.x+forwardZ*input.y;
    const moveLen=Math.hypot(moveX,moveZ)||1;
    const speed=4.45;
    avatar.root.position.x=clamp(avatar.root.position.x+(moveX/moveLen)*speed*delta*input.len,-10.2,10.2);
    avatar.root.position.z=clamp(avatar.root.position.z+(moveZ/moveLen)*speed*delta*input.len,-8.2,8.2);
    avatar.root.rotation.y=Math.atan2(moveX,-moveZ);
    avatar.walkPhase+=delta*10.5*input.len;
    sendMove(now);
  }
  animateAvatar(avatar,animationClock,delta,moving);
  for(const p of remotePlayers.values()){
    const dx=p.target.x-p.root.position.x,dz=p.target.z-p.root.position.z;
    const dist=Math.hypot(dx,dz);const remoteMoving=dist>.035;
    p.root.position.lerp(p.target,1-Math.exp(-delta*12));
    if(remoteMoving){p.root.rotation.y=Math.atan2(dx,-dz);p.walkPhase+=delta*10;}
    animateAvatar(p,animationClock,delta,remoteMoving);
  }

  // Soft follow camera with an orbiting third-person perspective.
  const targetY=1.05;
  cameraTarget.set(avatar.root.position.x,targetY,avatar.root.position.z);
  const horizontal=Math.cos(cameraPitch)*cameraDistance;
  desiredCamera.set(
    avatar.root.position.x+Math.sin(cameraYaw)*horizontal,
    targetY+Math.sin(cameraPitch)*cameraDistance,
    avatar.root.position.z+Math.cos(cameraYaw)*horizontal
  );
  camera.position.lerp(desiredCamera,1-Math.exp(-delta*7));
  camera.lookAt(cameraTarget);

  // Gentle ambient movement: fan rotation, warm lamp flicker and screen glow.
  fan.rotation.y+=delta*.7;
  animatedLights.forEach((entry,i)=>{
    const pulse=1+Math.sin(animationClock*1.8+entry.offset+i)*.035;
    entry.light.intensity=(i<2?1.25:.65)*pulse;entry.bulb.scale.setScalar(pulse);
  });
  screenGlow.intensity=.3+Math.sin(animationClock*1.3)*.035;
  renderer.render(scene,camera);
}
requestAnimationFrame(animate);

// Keep the renderer crisp and the joystick usable after device rotation/resizing.
addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,matchMedia('(pointer: coarse)').matches?1.5:2));
  renderer.setSize(innerWidth,innerHeight);
});
if(isSmallScreen){document.getElementById('control-help').textContent='Joystick to move · Drag the scene with one finger to look around';}
