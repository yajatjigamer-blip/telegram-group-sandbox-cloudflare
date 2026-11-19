import * as THREE from 'three';
const tg = window.Telegram?.WebApp;
tg?.ready(); tg?.expand();
const params = new URLSearchParams(location.search);
const roomId = params.get('room') || (tg?.initDataUnsafe?.start_param || params.get('tgWebAppStartParam') || '').replace(/^room_/, '') || 'demo-room';
const userName = tg?.initDataUnsafe?.user?.first_name || 'Guest';
document.getElementById('room-label').textContent = `Room ${String(roomId).slice(-8)}`;

const scene = new THREE.Scene(); scene.background = new THREE.Color('#a8c8d9'); scene.fog = new THREE.Fog('#a8c8d9', 18, 42);
const camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, .1, 100); camera.position.set(0,7,10);
const renderer = new THREE.WebGLRenderer({antialias:true}); renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.setSize(innerWidth,innerHeight); renderer.shadowMap.enabled=true; document.getElementById('game').appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xffffff,0x627080,2)); const sun=new THREE.DirectionalLight(0xffffff,2.2);sun.position.set(-5,10,7);sun.castShadow=true;scene.add(sun);
const mat=(color,roughness=.8)=>new THREE.MeshStandardMaterial({color,roughness});
function cube(x,y,z,sx,sy,sz,color){const m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mat(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;scene.add(m);return m;}
function cylinder(x,y,z,r,h,color){const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,24),mat(color));m.position.set(x,y,z);m.castShadow=true;scene.add(m);return m;}
const floor=new THREE.Mesh(new THREE.PlaneGeometry(24,20),mat('#d8c7a7'));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
cube(0,2.3,-9.8,24,4.6,.35,'#d4e2e5');cube(-11.8,2.3,0,.35,4.6,20,'#d4e2e5');cube(11.8,2.3,0,.35,4.6,20,'#d4e2e5');cube(-5,2.7,-9.58,4.4,2.3,.08,'#8ec8df');cube(5,2.7,-9.58,4.4,2.3,.08,'#8ec8df');
// Furnished lounge area
cube(-7,.55,5,4,.8,1.5,'#477f9b');cube(-7,1.1,5.6,4,1.1,.45,'#5599ad');cube(-9,1.1,5,.45,1.1,1.5,'#5599ad');cube(-5,1.1,5,.45,1.1,1.5,'#5599ad');
for(let i=0;i<3;i++)cube(-8.2+i*1.2,1.12,5.27,.9,.7,.22,['#f2c078','#d7a7a0','#b6c9a5'][i]);
const rug=new THREE.Mesh(new THREE.BoxGeometry(5,.05,3),mat('#b9a0c8'));rug.position.set(-5,.04,1.5);scene.add(rug);cube(-5,.55,1.5,2.6,.25,1.2,'#805c43');
for(const x of [-6.1,-3.9])for(const z of [1,2])cube(x,.25,z,.12,.5,.12,'#5a4030');cube(9,1.4,-5,1.2,2.8,.5,'#8b6348');
for(let y=.6;y<2.6;y+=.65)cube(9,y,-4.72,1.25,.08,.6,'#bd9569');
for(const [x,z] of [[-10,-7],[10,7]]){cylinder(x,.55,z,.5,1.1,'#b87956');const leaves=new THREE.Mesh(new THREE.SphereGeometry(.85,16,12),mat('#4b9b71'));leaves.position.set(x,1.8,z);scene.add(leaves);}
// Game tables (lobby entry points)
const games=['🎲 Ludo','♟ Chess','🐍 Snakes & Ladders','🏠 Monopoly','⭕ Tic-Tac-Toe','🔴 Connect 4','⚫ Checkers','🃏 UNO','🚢 Battleship','🪵 Carrom'];
const tableMeshes=[];const positions=[[-6,-4],[-2,-4],[2,-4],[6,-4],[-6,-.5],[-2,-.5],[2,-.5],[6,-.5],[-2,4],[3,4]];
positions.forEach(([x,z],i)=>{cube(x,.65,z,2.25,.22,1.65,'#8a6044');for(const dx of [-.9,.9])for(const dz of [-.6,.6])cube(x+dx,.3,z+dz,.12,.7,.12,'#65452f');const top=cube(x,.79,z,1.65,.035,1.12,['#d7a84d','#e0dfd6','#5e9a75','#d9bd80'][i%4]);top.userData.game=i;tableMeshes.push(top);});
// Boxing ring environment
cube(8,.35,3.7,3.8,.35,3.8,'#454b59');for(const [x,z] of [[6.3,2],[9.7,2],[6.3,5.4],[9.7,5.4]])cube(x,1.1,z,.12,1.5,.12,'#eeeeee');
for(const y of [.8,1.25,1.7]){cube(8,y,2,3.4,.06,.06,'#d64e57');cube(8,y,5.4,3.4,.06,.06,'#d64e57');cube(6.3,y,3.7,.06,.06,3.4,'#d64e57');cube(9.7,y,3.7,.06,.06,3.4,'#d64e57');}
function makeAvatar(color='#4778c7'){const g=new THREE.Group();const body=new THREE.Mesh(new THREE.CapsuleGeometry(.35,.75,5,10),mat(color));body.position.y=.85;body.castShadow=true;g.add(body);const head=new THREE.Mesh(new THREE.SphereGeometry(.32,18,14),mat('#f1c6a0'));head.position.y=1.55;g.add(head);const hair=new THREE.Mesh(new THREE.SphereGeometry(.33,18,12,0,Math.PI*2,0,Math.PI/2),mat('#47372e'));hair.position.y=1.67;g.add(hair);scene.add(g);return g;}
const avatar=makeAvatar();avatar.position.set(0,0,7);const remotePlayers=new Map();
let yaw=0,drag=false,lastX=0;const keys={};addEventListener('keydown',e=>keys[e.key.toLowerCase()]=true);addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
renderer.domElement.addEventListener('pointerdown',e=>{drag=true;lastX=e.clientX;});addEventListener('pointerup',()=>drag=false);addEventListener('pointermove',e=>{if(drag){yaw+=(e.clientX-lastX)*.004;lastX=e.clientX;}});
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();renderer.domElement.addEventListener('click',e=>{pointer.x=e.clientX/innerWidth*2-1;pointer.y=-(e.clientY/innerHeight)*2+1;raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(tableMeshes)[0];if(hit)openTable(hit.object.userData.game);});
let socket;try{const wsUrl=new URL('/ws',location.href);wsUrl.protocol=location.protocol==='https:'?'wss:':'ws:';wsUrl.searchParams.set('room',roomId);wsUrl.searchParams.set('name',userName);socket=new WebSocket(wsUrl);socket.addEventListener('open',()=>toast('Connected to group lounge'));socket.addEventListener('message',event=>{let d;try{d=JSON.parse(event.data)}catch{return}if(d.type==='joined'){for(const p of d.players||[])if(p.id&&p.id!=='player')addRemote(p.id,p.name,p.x,p.z);updateOnline();}if(d.type==='player-joined'){addRemote(d.id,d.name);updateOnline();}if(d.type==='player-moved'){const p=remotePlayers.get(d.id);if(p)p.position.set(d.x,0,d.z);}if(d.type==='player-left'){removeRemote(d.id);updateOnline();}if(d.type==='emote')toast(`${d.name} used ${d.kind}!`);});}catch(e){toast('Multiplayer connection unavailable');}
function addRemote(id,name,x=0,z=0){if(!id||id==='player'||remotePlayers.has(id))return;const g=makeAvatar('#b16cce');g.position.set(x||Math.random()*3-1.5,0,z||Math.random()*3-1.5);g.userData.playerName=name;remotePlayers.set(id,g);}
function removeRemote(id){const g=remotePlayers.get(id);if(g){scene.remove(g);remotePlayers.delete(id);}}
function updateOnline(){document.getElementById('online-count').textContent=1+remotePlayers.size;}
function animate(){requestAnimationFrame(animate);const speed=.095;const forward=(keys.w||keys.arrowup)?1:0,back=(keys.s||keys.arrowdown)?1:0,left=(keys.a||keys.arrowleft)?1:0,right=(keys.d||keys.arrowright)?1:0;const dx=(right-left)*speed,dz=(back-forward)*speed;if(dx||dz){avatar.position.x=THREE.MathUtils.clamp(avatar.position.x+dx,-10.5,10.5);avatar.position.z=THREE.MathUtils.clamp(avatar.position.z+dz,-8.5,8.5);if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify({type:'move',x:avatar.position.x,z:avatar.position.z}));}camera.position.x=avatar.position.x+Math.sin(yaw)*10;camera.position.z=avatar.position.z+Math.cos(yaw)*10;camera.position.y=7;camera.lookAt(avatar.position.x,0,avatar.position.z);renderer.render(scene,camera);}animate();
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
const panel=document.getElementById('table-panel'),list=document.getElementById('game-list'),detail=document.getElementById('game-detail');games.forEach((g,i)=>{const b=document.createElement('button');b.textContent=g;b.onclick=()=>selectGame(i);list.appendChild(b);});
function openTable(i){panel.hidden=false;selectGame(i);}function selectGame(i){[...list.children].forEach((b,j)=>b.classList.toggle('selected',i===j));document.getElementById('table-title').textContent=games[i];detail.innerHTML=`<div class="game-detail"><b>${games[i]}</b><br>This is the ${games[i].replace(/^\S+\s/,'')} game table in the lounge. The board-game rules engine and turn-by-turn multiplayer are not included in this first Cloudflare deployment yet.<br><br><button id="join-table">Join table</button></div>`;document.getElementById('join-table').onclick=()=>toast(`Table selected: ${games[i]}`);}
document.getElementById('close-panel').onclick=()=>panel.hidden=true;
function toast(s){const t=document.getElementById('toast');t.textContent=s;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200);}
document.querySelectorAll('[data-emote]').forEach(b=>b.onclick=()=>{if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify({type:'emote',kind:b.dataset.emote}));toast(`${b.dataset.emote} emote sent`);});
