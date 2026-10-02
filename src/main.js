import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CameraController } from './camera-controller.js';
import { CAMPUS_PLACES, CAMPUS_RADIUS } from './campus-layout.js';
import './style.css';

const $ = (selector) => document.querySelector(selector);
const world = $('#world');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#d9edf0');
scene.fog = new THREE.Fog('#d9edf0', 110, 260);

const camera = new THREE.OrthographicCamera(-35, 35, 19.7, -19.7, 0.1, 180);
camera.position.set(25, 39, 25);
camera.lookAt(0, 1, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
world.appendChild(renderer.domElement);

const colors = {
  grass: '#91d39a', grassLight: '#a4dda5', grassDark: '#75c688',
  // Cast-concrete pathway palette: cool grey slabs, pale kerbs, dark joints.
  pathway: '#c6c8c3', kerb: '#e4e4de', joint: '#a4a6a1',
  sidewalk: '#d8dad5', stone: '#f0e6d2', water: '#69d6d1', dark: '#29445e',
  cream: '#fff8e8', coral: '#fa967d', pink: '#ed9bae', yellow: '#f4ce6d', mint: '#72c9ad',
};
const mat = (color, roughness = 0.85, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
const materials = {
  grass: mat(colors.grass), grassPatch: mat(colors.grassLight), grassDark: mat(colors.grassDark),
  pathway: mat(colors.pathway, 0.9), kerb: mat(colors.kerb, 0.9),
  sidewalk: mat(colors.sidewalk, 0.9), stone: mat(colors.stone),
  water: mat(colors.water, 0.36, { metalness: 0.05 }), white: mat('#fff9e8'),
  cream: mat('#f7edda'), coral: mat(colors.coral), pink: mat(colors.pink), yellow: mat(colors.yellow),
  mint: mat(colors.mint), dark: mat(colors.dark), bark: mat('#9c7457'),
};

scene.add(new THREE.HemisphereLight('#f5fff5', '#739a9b', 2.35));
const sun = new THREE.DirectionalLight('#fff1d0', 3.0);
sun.position.set(-23, 36, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -64;
sun.shadow.camera.right = 64;
sun.shadow.camera.top = 64;
sun.shadow.camera.bottom = -64;
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.035;
sun.shadow.radius = 5;
scene.add(sun);

const islandTop = 1.23;
const zonePositions = Object.fromEntries(CAMPUS_PLACES.map(({ id, x, z }) => [id, new THREE.Vector3(x, islandTop, z)]));
const placeTitles = Object.fromEntries(CAMPUS_PLACES.map(({ id, title }) => [id, title]));
const worldObstacles = [];
const campusMaps = [
  { canvas: $('#map-canvas'), places: $('#map-places'), player: $('#map-player'), waypoint: $('#map-waypoint'), route: $('#map-route') },
  { canvas: $('#overview-map-canvas'), places: $('#overview-map-places'), player: $('#overview-map-player'), waypoint: $('#overview-map-waypoint'), route: $('#overview-map-route') },
];

function buildCampusNavigation() {
  const list = $('#place-list');
  for (const place of CAMPUS_PLACES) {
    const card = document.createElement('button');
    card.className = `place-card${place.id === 'library' ? ' selected' : ''}`;
    card.dataset.place = place.id;
    card.innerHTML = `<span class="place-icon ${place.id}-icon">${place.icon}</span><span class="place-copy"><strong>${place.title}</strong><small>${place.subtitle}</small></span><span class="place-arrow">›</span>`;
    list.append(card);

    for (const map of campusMaps) {
      const point = document.createElement('button');
      point.className = `map-point${map.canvas.id === 'overview-map-canvas' ? ' map-point-compact' : ''}${place.id === 'library' ? ' selected' : ''}`;
      point.dataset.mapPlace = place.id;
      point.style.setProperty('--map-x', `${50 + place.x / (CAMPUS_RADIUS * 2) * 100}%`);
      point.style.setProperty('--map-y', `${50 + place.z / (CAMPUS_RADIUS * 2) * 100}%`);
      point.setAttribute('aria-label', `${place.title}, ${place.district}`);
      point.title = `${place.title} · ${place.subtitle}`;
      point.innerHTML = `<i>${place.icon}</i><small>${place.short}</small>`;
      map.places.append(point);
    }
  }
}

buildCampusNavigation();

function updateMapPlayer(position) {
  for (const map of campusMaps) {
    map.player.style.left = `${50 + position.x / (CAMPUS_RADIUS * 2) * 100}%`;
    map.player.style.top = `${50 + position.z / (CAMPUS_RADIUS * 2) * 100}%`;
  }
  updateMapWaypoint(currentTarget, position);
  const place = CAMPUS_PLACES.find((item) => item.id === getPlaceForPosition(position.x, position.z));
  const distance = Math.round(Math.hypot(position.x - place.x, position.z - place.z));
  $('#map-message').textContent = `About ${distance} m from ${place.title}`;
  $('#overview-map-message').textContent = `Near ${place.title} · tap a marker to go`;
}

function updateMapWaypoint(target, position = localAvatar?.position) {
  if (!target || !position) {
    for (const map of campusMaps) { map.waypoint.style.display = 'none'; map.route.style.display = 'none'; }
    return;
  }
  const worldDiameter = CAMPUS_RADIUS * 2;
  const endX = 50 + target.x / worldDiameter * 100;
  const endY = 50 + target.z / worldDiameter * 100;
  const startX = 50 + position.x / worldDiameter * 100;
  const startY = 50 + position.z / worldDiameter * 100;
  for (const map of campusMaps) {
    map.waypoint.style.left = `${endX}%`; map.waypoint.style.top = `${endY}%`; map.waypoint.style.display = 'block';
    map.route.style.left = `${startX}%`; map.route.style.top = `${startY}%`;
    const dx = (target.x - position.x) / worldDiameter * map.canvas.clientWidth;
    const dy = (target.z - position.z) / worldDiameter * map.canvas.clientHeight;
    map.route.style.width = `${Math.hypot(dx, dy)}px`;
    map.route.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
    map.route.style.display = Math.hypot(dx, dy) > 2 ? 'block' : 'none';
  }
}

function addObstacle(x, z, halfWidth, halfDepth) {
  worldObstacles.push({ x, z, halfWidth, halfDepth, radius: null });
}

function addCircularObstacle(x, z, radius) {
  worldObstacles.push({ x, z, radius, halfWidth: 0, halfDepth: 0 });
}

function collidesWithBuilding(x, z) {
  const playerRadius = 0.42;
  return worldObstacles.some(({ x: cx, z: cz, halfWidth, halfDepth, radius }) => {
    if (radius !== null) return Math.hypot(x - cx, z - cz) < radius + playerRadius;
    const nearestX = THREE.MathUtils.clamp(x, cx - halfWidth, cx + halfWidth);
    const nearestZ = THREE.MathUtils.clamp(z, cz - halfDepth, cz + halfDepth);
    return Math.hypot(x - nearestX, z - nearestZ) < playerRadius;
  });
}

function clampCampusPoint(x, z, margin = 0.75) {
  const limit = CAMPUS_RADIUS - margin;
  const distance = Math.hypot(x, z);
  if (distance <= limit || distance === 0) return { x, z };
  const ratio = limit / distance;
  return { x: x * ratio, z: z * ratio };
}

function clampCampusX(x, z, margin = 0.75) {
  const radius = Math.sqrt(Math.max(0, (CAMPUS_RADIUS - margin) ** 2 - z ** 2));
  return THREE.MathUtils.clamp(x, -radius, radius);
}

function clampCampusZ(z, x, margin = 0.75) {
  const radius = Math.sqrt(Math.max(0, (CAMPUS_RADIUS - margin) ** 2 - x ** 2));
  return THREE.MathUtils.clamp(z, -radius, radius);
}

function nearestWalkablePoint(x, z) {
  if (!collidesWithBuilding(x, z)) return { x, z };
  for (let radius = 0.75; radius <= 8; radius += 0.35) {
    for (let i = 0; i < 32; i++) {
      const angle = i / 32 * Math.PI * 2;
      const candidate = clampCampusPoint(x + Math.cos(angle) * radius, z + Math.sin(angle) * radius);
      const candidateX = candidate.x;
      const candidateZ = candidate.z;
      if (!collidesWithBuilding(candidateX, candidateZ)) return { x: candidateX, z: candidateZ };
    }
  }
  return { x: 0, z: 0 };
}

function roundShape(width, depth, radius) {
  const x = -width / 2;
  const z = -depth / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x + radius, z);
  shape.lineTo(x + width - radius, z);
  shape.quadraticCurveTo(x + width, z, x + width, z + radius);
  shape.lineTo(x + width, z + depth - radius);
  shape.quadraticCurveTo(x + width, z + depth, x + width - radius, z + depth);
  shape.lineTo(x + radius, z + depth);
  shape.quadraticCurveTo(x, z + depth, x, z + depth - radius);
  shape.lineTo(x, z + radius);
  shape.quadraticCurveTo(x, z, x + radius, z);
  return shape;
}

function mesh(geometry, material, x, y, z, parent = scene, cast = true, receive = true) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(x, y, z);
  object.castShadow = cast;
  object.receiveShadow = receive;
  parent.add(object);
  return object;
}

function roundBox(width, height, depth, radius, material) {
  return new RoundedBoxGeometry(width, height, depth, 3, radius);
}

function box(width, height, depth, material, x, y, z, parent = scene, radius = 0) {
  const geometry = radius ? roundBox(width, height, depth, Math.min(radius, height / 2 - 0.005), material) : new THREE.BoxGeometry(width, height, depth);
  return mesh(geometry, material, x, y, z, parent);
}

function cylinder(radiusTop, radiusBottom, height, material, x, y, z, parent = scene, segments = 12) {
  return mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), material, x, y, z, parent);
}

function disc(radius, height, material, x, y, z, parent = scene, segments = 48) {
  const object = mesh(new THREE.CylinderGeometry(radius, radius, height, segments), material, x, y, z, parent);
  return object;
}

function torus(radius, tube, material, x, y, z, parent = scene, segments = 64) {
  return mesh(new THREE.TorusGeometry(radius, tube, 8, segments), material, x, y, z, parent);
}

function addCampusGround() {
  const outer = new THREE.ExtrudeGeometry(roundShape(144, 132, 22), {
    depth: 0.82, bevelEnabled: true, bevelSegments: 3, bevelSize: 0.16, bevelThickness: 0.14, curveSegments: 12,
  });
  outer.rotateX(-Math.PI / 2);
  const base = mesh(outer, mat('#778d7c', 0.74), 0, 0.22, 0, scene, true, true);
  base.castShadow = true;
  const grass = new THREE.ShapeGeometry(roundShape(142.6, 130.6, 21.3), 8);
  grass.rotateX(-Math.PI / 2);
  mesh(grass, materials.grass, 0, islandTop, 0, scene, false, true);

  // Quiet, rounded patches make the lawn feel hand-placed without adding noisy textures.
  for (const [x, z, sx, sz, color] of [
    [-25, -14, 3.6, 1.8, materials.grassLight], [25, 14, 4.0, 2.0, materials.grassDark],
    [-25, 16, 2.8, 2.3, materials.grassDark], [25, -16, 3.0, 1.9, materials.grassLight],
    [-27.6, -27.6, 7.0, 3.3, materials.grassLight], [27.6, 27.6, 7.0, 3.3, materials.grassDark],
    [-27.6, 27.6, 7.0, 3.3, materials.grassDark], [27.6, -27.6, 7.0, 3.3, materials.grassLight],
    [0, -22, 5.2, 2.2, materials.grassLight], [0, 22, 5.8, 2.2, materials.grassDark],
  ]) {
    const patch = mesh(new THREE.CircleGeometry(1, 40), color, x, islandTop + 0.018, z, scene, false, false);
    patch.rotation.x = -Math.PI / 2;
    patch.scale.set(sx, sz, 1);
  }
}

// Grass verges flanking every walkway. Real campus paths are always edged with
// a maintained turf strip — mown short, slightly deeper green than the open
// lawn, with a crisp cut line against the kerb. Without these the concrete
// butts straight into the lawn and reads as unfinished.
function addPathwayVerge() {
  const halfW = 4.35 / 2;
  const halfH = 4.55 / 2;
  const inner = 0.42;              // kerb outer face
  const width = 2.6;               // depth of the mown strip
  const vergeY = islandTop + 0.022;
  const mowA = mat('#7ec98b', 0.92);
  const mowB = mat('#8ad195', 0.92);
  // Horizontal walkway: verge bands north and south, broken at the plaza.
  for (const s of [-1, 1]) {
    for (const [x0, x1] of [[-46, -5.6], [5.6, 46]]) {
      const w = x1 - x0;
      box(w, 0.03, width, mowA, (x0 + x1) / 2, vergeY, s * (halfW + inner + width / 2), scene, 0.03);
      // Mower stripe: a lighter pass offset along the run for a cut look.
      box(w * 0.42, 0.016, width * 0.5, mowB, x0 + w * 0.28, vergeY + 0.01, s * (halfW + inner + width * 0.28), scene, 0.03);
    }
  }
  // Vertical walkway: verge bands east and west.
  for (const s of [-1, 1]) {
    for (const [z0, z1] of [[-46, -5.6], [5.6, 46]]) {
      const d = z1 - z0;
      box(width, 0.03, d, mowA, s * (halfH + inner + width / 2), vergeY, (z0 + z1) / 2, scene, 0.03);
      box(width * 0.5, 0.016, d * 0.42, mowB, s * (halfH + inner + width * 0.28), vergeY + 0.01, z0 + d * 0.28, scene, 0.03);
    }
  }
  // Rounded lawn corners at the outer ends so the verges don't end in a hard line.
  const capMat = mat('#86cd91', 0.92);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const cap = mesh(new THREE.CircleGeometry(width * 0.62, 24), capMat, sx * (halfW + inner + width * 0.5), vergeY, sz * (halfH + inner + width * 0.5), scene, false, false);
    cap.rotation.x = -Math.PI / 2;
  }
}

// Poured-concrete campus pathway system. Real school walkways are flat cast
// slabs divided into panels by scored expansion joints, with a slightly
// paler kerb strip where the paving meets the grass.
function addPathways() {
  const pathY = islandTop + 0.08;
  const top = pathY + 0.08;           // walking surface height
  const jointDepth = 0.012;           // joints sit just proud of the slab
  const jointW = 0.13;                // scored groove width
  const jointMat = mat('#a9aca6', 0.95);
  const halfW = 4.35 / 2;
  const halfH = 4.55 / 2;

  // Two continuous main walkways crossing at the central plaza.
  box(96, 0.16, 4.35, materials.pathway, 0, pathY, 0, scene, 0.06);
  box(4.55, 0.16, 96, materials.pathway, 0, pathY, 0, scene, 0.06);

  // Kerb strips soften the transition from grass to concrete.
  for (const s of [-1, 1]) {
    box(96, 0.08, 0.42, materials.kerb, 0, pathY - 0.04, s * (halfW + 0.21), scene, 0.04);
    box(0.42, 0.08, 96, materials.kerb, s * (halfH + 0.21), pathY - 0.04, 0, scene, 0.04);
  }

  // Scored expansion joints: transverse panels every ~3.4m plus a longitudinal
  // centre seam, exactly how a real cast walkway is panelised.
  for (let x = -46; x <= 46; x += 3.4) box(jointW, jointDepth, 4.35, jointMat, x, top - jointDepth, 0, scene);
  for (let z = -46; z <= 46; z += 3.4) box(4.55, jointDepth, jointW, jointMat, 0, top - jointDepth, z, scene);
  box(96, jointDepth, jointW, jointMat, 0, top - jointDepth, 0, scene);
  box(jointW, jointDepth, 96, jointMat, 0, top - jointDepth, 0, scene);

  // Subtle tonal variation between alternating panels so the concrete reads
  // as separate pours rather than one flat plane.
  const patch = mat('#c2c4bf', 0.92);
  for (let x = -44.7; x <= 46; x += 6.8) {
    if (Math.round((x + 44.7) / 3.4) % 2) continue;
    box(3.2, jointDepth, 1.9, patch, x, top - jointDepth * 1.2, -1.1, scene);
    box(3.2, jointDepth, 1.9, patch, x, top - jointDepth * 1.2, 1.1, scene);
  }
  for (let z = -44.7; z <= 46; z += 6.8) {
    if (Math.round((z + 44.7) / 3.4) % 2) continue;
    box(1.9, jointDepth, 3.2, patch, -1.1, top - jointDepth * 1.2, z, scene);
    box(1.9, jointDepth, 3.2, patch, 1.1, top - jointDepth * 1.2, z, scene);
  }

  // Branch walks into every district, each with its own scored seam.
  for (const [x, z, w, d] of [
    [-13.5, -5.8, 10, 1.7], [-17, -8.3, 1.7, 5.6], [13.5, -5.8, 10, 1.7], [17, -8.3, 1.7, 5.6],
    [-14.5, 6.2, 11, 1.7], [-19, 9.2, 1.7, 6.2], [14.5, 6.2, 11, 1.7], [19, 9.2, 1.7, 6.2],
    [-23.5, 0, 18, 1.65], [23.5, 0, 18, 1.65], [0, -8.4, 1.65, 14], [0, 8.4, 1.65, 14],
  ]) {
    box(w, 0.11, d, materials.sidewalk, x, islandTop + 0.065, z, scene, 0.05);
    const along = w >= d;
    box(along ? w : 0.1, 0.01, along ? 0.1 : d, jointMat, x, islandTop + 0.114, z, scene);
  }

  // Central plaza: one wider pour, ringed by a kerb band and scored into a
  // 3x3 grid of large slabs with a tactile-looking centre inlay.
  box(10.4, 0.14, 10.4, materials.kerb, 0, top - 0.03, 0, scene, 0.08);
  box(9.0, 0.15, 9.0, materials.pathway, 0, top - 0.025, 0, scene, 0.06);
  const plazaTop = top + 0.025;
  for (const o of [-3.0, 3.0]) {
    box(9.0, 0.014, jointW, jointMat, 0, plazaTop - 0.007, o, scene);
    box(jointW, 0.014, 9.0, jointMat, o, plazaTop - 0.007, 0, scene);
  }
  const inlayMat = mat('#b7bab4', 0.95);
  box(2.6, 0.016, 2.6, inlayMat, 0, plazaTop - 0.004, 0, scene, 0.05);
  box(2.6, 0.012, jointW, jointMat, 0, plazaTop + 0.004, 0, scene);
  box(jointW, 0.012, 2.6, jointMat, 0, plazaTop + 0.004, 0, scene);
}

function makeSignTexture(title, fontPx = 54) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 160;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#164e4a';
  ctx.beginPath(); ctx.roundRect(6, 6, 500, 148, 30); ctx.fill();
  ctx.lineWidth = 7; ctx.strokeStyle = '#f2e7c9'; ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.font = `800 ${fontPx}px Inter, Arial, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(title, 256, 84, 440);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// Ground-level signboard: deep-teal board, white type, single side post
// so the full text area stays unobstructed and readable.
function addSignboard(title, x, z, rotY = 0) {
  const group = new THREE.Group();
  group.position.set(x, islandTop, z);
  group.rotation.y = rotY;
  cylinder(0.11, 0.13, 2.3, mat('#7a5c42'), 1.45, 1.15, 0, group, 8);
  box(3.1, 1.0, 0.12, mat('#164e4a'), 0, 1.7, 0, group, 0.06);
  const texture = makeSignTexture(title);
  const faceMat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.85 });
  mesh(new THREE.PlaneGeometry(2.95, 0.92), faceMat, 0, 1.7, 0.065, group, false, false);
  const back = mesh(new THREE.PlaneGeometry(2.95, 0.92), faceMat, 0, 1.7, -0.065, group, false, false);
  back.rotation.y = Math.PI;
  scene.add(group);
  return group;
}

// Slim single-pole directional sign for junctions: placed before the
// intersection, facing approaching walkers. Arrow reads from the front.
function addDirectionSign(text, x, z, rotY = 0) {
  const group = new THREE.Group();
  group.position.set(x, islandTop, z);
  group.rotation.y = rotY;
  cylinder(0.08, 0.1, 2.4, mat('#5b6b72'), 0, 1.2, 0, group, 8);
  box(2.5, 0.72, 0.1, mat('#164e4a'), 0, 2.15, 0, group, 0.05);
  const texture = makeSignTexture(text, 58);
  const faceMat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.85 });
  // Reuse the wide texture on a smaller board via a cropped plane ratio.
  mesh(new THREE.PlaneGeometry(2.36, 0.62), faceMat, 0, 2.15, 0.055, group, false, false);
  const back = mesh(new THREE.PlaneGeometry(2.36, 0.62), faceMat, 0, 2.15, -0.055, group, false, false);
  back.rotation.y = Math.PI;
  scene.add(group);
  return group;
}

// Real door prefab: frame + double leaves with glass uppers, mid rails,
// handles and a step — faces +z locally, origin at the door base center.
function addRealDoor(parent, x, yBase, z, w = 1.2, h = 2.2, rotY = 0, canopy = false) {
  const group = new THREE.Group();
  group.position.set(x, yBase, z);
  group.rotation.y = rotY;
  parent.add(group);
  const frameMat = mat('#f8f2e1');
  const leafMat = mat('#7c4f33');
  const glassMat = mat('#bfe3e0', 0.18, { metalness: 0.15 });
  const darkMat = mat('#2e3d46');
  const brassMat = mat('#d9a94a', 0.35, { metalness: 0.6 });
  // Frame + dark recess behind the leaves.
  box(w + 0.3, h + 0.15, 0.14, frameMat, 0, h / 2, 0, group);
  box(w, h, 0.1, darkMat, 0, h / 2 - 0.02, 0.01, group);
  // Transom glass above the leaves.
  box(w, 0.28, 0.08, glassMat, 0, h - 0.2, 0.04, group);
  const leafW = w / 2 - 0.04;
  for (const side of [-1, 1]) {
    const lx = side * (w / 4);
    // Wooden lower panel + glass upper + mid rail per leaf.
    box(leafW, h * 0.44, 0.08, leafMat, lx, h * 0.24, 0.05, group, 0.02);
    box(leafW - 0.08, h * 0.3, 0.06, glassMat, lx, h * 0.66, 0.05, group);
    box(leafW, 0.09, 0.09, leafMat, lx, h * 0.47, 0.05, group, 0.02);
    box(0.06, h * 0.82, 0.09, frameMat, lx - side * leafW / 2, h * 0.43, 0.05, group);
    // Vertical pull handle near the meeting stile.
    const hx = lx + (side < 0 ? 0.12 : -0.12);
    cylinder(0.035, 0.035, 0.42, brassMat, hx, h * 0.45, 0.12, group, 8);
  }
  // Center meeting seam + step in front.
  box(0.05, h * 0.8, 0.1, darkMat, 0, h * 0.42, 0.05, group);
  box(w + 0.7, 0.12, 0.8, materials.stone, 0, 0.06, 0.45, group, 0.05);
  if (canopy) box(w + 0.6, 0.1, 0.7, mat('#f4a083'), 0, h + 0.35, 0.3, group, 0.04);
  return group;
}

function addTree(x, z, scale = 1, canopyColor = '#54aa76') {
  const group = new THREE.Group(); group.position.set(x, islandTop + 0.03, z); group.scale.setScalar(scale); scene.add(group);
  cylinder(0.19, 0.31, 1.6, materials.bark, 0, 0.8, 0, group, 7);
  const canopy = mat(canopyColor, 0.9, { flatShading: true });
  const lower = mesh(new THREE.IcosahedronGeometry(1.08, 1), canopy, 0, 2.04, 0, group);
  lower.scale.set(1.12, 0.96, 1.07);
  const top = mesh(new THREE.IcosahedronGeometry(0.76, 1), mat(canopyColor === '#54aa76' ? '#78c787' : '#77bd83', 0.9, { flatShading: true }), -0.23, 2.76, 0.12, group);
  top.scale.set(1.02, 0.96, 0.94);
  return group;
}

function addBush(x, z, scale = 1, color = '#72c688') {
  const group = new THREE.Group(); group.position.set(x, islandTop + 0.02, z); group.scale.setScalar(scale); scene.add(group);
  const green = mat(color, 0.9, { flatShading: true });
  for (const [bx, by, bz, s] of [[0, 0.42, 0, 0.57], [-0.32, 0.3, 0.05, 0.42], [0.33, 0.32, -0.03, 0.43]]) {
    const shrub = mesh(new THREE.DodecahedronGeometry(s, 0), green, bx, by, bz, group);
    shrub.scale.y = 0.9;
  }
  return group;
}

function addFlower(x, z, petal = '#f5cf72') {
  const group = new THREE.Group(); group.position.set(x, islandTop + 0.04, z); scene.add(group);
  cylinder(0.025, 0.04, 0.46, mat('#5f9e72'), 0, 0.23, 0, group, 5);
  mesh(new THREE.SphereGeometry(0.12, 8, 6), mat(petal), 0, 0.49, 0, group, false, false);
  for (let a = 0; a < 5; a++) {
    const angle = a / 5 * Math.PI * 2;
    const p = mesh(new THREE.SphereGeometry(0.105, 8, 6), mat(petal), Math.cos(angle) * 0.16, 0.46, Math.sin(angle) * 0.16, group, false, false);
    p.scale.set(1, 0.72, 0.8);
  }
  return group;
}

function addCentralLandmarks() {
  // Welcome and student-service buildings frame the central crossing without closing its paths.
  const adminX = 7.7; const adminZ = -5.5;
  box(6.2, 0.26, 4.6, materials.stone, adminX, islandTop + 0.14, adminZ, scene, 0.12);
  box(5.3, 3.1, 3.8, mat('#eee4ce'), adminX, islandTop + 1.82, adminZ, scene, 0.18);
  box(5.8, 0.42, 4.3, mat('#79aa91'), adminX, islandTop + 3.52, adminZ, scene, 0.12);
  box(2.2, 1.35, 0.14, mat('#89c6c3', 0.4), adminX - 1.4, islandTop + 2.0, adminZ + 1.95, scene, 0.05);
  addRealDoor(scene, adminX + 1.35, islandTop + 0.27, adminZ + 1.98, 1.0, 2.1, 0, true);
  addObstacle(adminX, adminZ, 2.9, 2.2);
  addSignboard('STUDENT SERVICES', adminX, -3.0, 0);

  // Clock tower removed — open garden bed keeps the plaza breathing.
  addPlanter(-7.5, -5.8, 1.1);
}

function addSportsZone() {
  const [cx, , cz] = zonePositions.sports.toArray();
  // Big pickleball court: green surround + blue playing surface,
  // near-regulation proportions so it reads large next to avatars.
  // Outer 18.5 x 11, playing surface 16 x 9.
  // Sharp 90° corners (radius 0) = real-court rectangle.
  // Visual center shifted 4 west + 1.5 south so the court clears
  // the library (hindi dumikit) and the north fence clears the footpath.
  const ccx = cx - 4; const ccz = cz - 1.5;
  box(18.5, 0.18, 11, mat('#4d9e6b'), ccx, islandTop + 0.09, ccz, scene);
  box(16, 0.12, 9, mat('#3f6fb5'), ccx, islandTop + 0.23, ccz, scene);
  const line = mat('#fff3d9', 0.72);
  const ly = islandTop + 0.3;
  const halfL = 8.0;   // baseline distance from center
  const halfW = 4.5;   // sideline distance from center
  const kitchen = 2.1; // non-volley zone half-width
  const t = 0.12;      // line thickness
  // Baselines run full width; sidelines overlap them by exactly one
  // thickness so all four corners close into perfect squares.
  for (const sx of [-halfL, halfL]) box(t, 0.025, halfW * 2, line, ccx + sx, ly, ccz, scene);
  for (const sz of [-halfW, halfW]) box(halfL * 2 + t, 0.025, t, line, ccx, ly, ccz + sz, scene);
  // Non-volley (kitchen) lines.
  for (const sx of [-kitchen, kitchen]) box(t, 0.025, halfW * 2, line, ccx + sx, ly, ccz, scene);
  // Center service lines (kitchen to baseline, each half).
  for (const [x0, x1] of [[kitchen, halfL], [-halfL, -kitchen]]) box(x1 - x0, 0.025, t, line, ccx + (x0 + x1) / 2, ly, ccz, scene);
  // Center net across the middle (posts just outside the sidelines).
  for (const sz of [-halfW - 0.35, halfW + 0.35]) cylinder(0.09, 0.11, 1.0, mat('#46585e'), ccx, islandTop + 0.5, ccz + sz, scene, 8);
  const netMesh = mesh(new THREE.PlaneGeometry(halfW * 2 + 0.7, 0.75), mat('#f4f0e2', 0.6, { transparent: true, opacity: 0.55, side: THREE.DoubleSide }), ccx, islandTop + 0.64, ccz, scene, false, false);
  netMesh.rotation.y = Math.PI / 2;
  box(0.1, 0.09, halfW * 2 + 0.7, mat('#2c3e44'), ccx, islandTop + 1.03, ccz, scene);
  // Low perimeter fence on the exact court footprint (double-sided so it
  // never vanishes when you orbit to the other side).
  const fenceMat = mat('#dfe9e4', 0.5, { transparent: true, opacity: 0.35, side: THREE.DoubleSide });
  const postMat = mat('#46585e');
  const fenceH = 1.9;
  const fx = 18.5 / 2 + 0.35; const fz = 11 / 2 + 0.35;
  // North / south fences.
  for (const sz of [-fz, fz]) {
    mesh(new THREE.PlaneGeometry(fx * 2, fenceH), fenceMat, ccx, islandTop + fenceH / 2 + 0.15, ccz + sz, scene, false, false);
    for (let px = -fx; px <= fx + 0.01; px += 3.1) cylinder(0.07, 0.08, fenceH, postMat, ccx + px, islandTop + fenceH / 2 + 0.15, ccz + sz, scene, 6);
    box(fx * 2 + 0.15, 0.08, 0.1, postMat, ccx, islandTop + fenceH + 0.15, ccz + sz, scene);
  }
  // East / west fences.
  for (const sx of [-fx, fx]) {
    const wall = mesh(new THREE.PlaneGeometry(fz * 2, fenceH), fenceMat, ccx + sx, islandTop + fenceH / 2 + 0.15, ccz, scene, false, false);
    wall.rotation.y = Math.PI / 2;
    for (let pz = -fz; pz <= fz + 0.01; pz += 2.9) cylinder(0.07, 0.08, fenceH, postMat, ccx + sx, islandTop + fenceH / 2 + 0.15, ccz + pz, scene, 6);
    box(0.1, 0.08, fz * 2 + 0.15, postMat, ccx + sx, islandTop + fenceH + 0.15, ccz, scene);
  }
  // Taller corner floodlights to match the bigger court.
  for (const [dx, dz] of [[-fx - 0.6, -fz - 0.6], [fx + 0.6, -fz - 0.6], [-fx - 0.6, fz + 0.6], [fx + 0.6, fz + 0.6]]) {
    cylinder(0.09, 0.12, 4.6, mat('#8d795f'), ccx + dx, islandTop + 2.3, ccz + dz, scene, 8);
    box(0.7, 0.4, 0.3, mat('#fff0bb', 0.5, { emissive: '#f4d988', emissiveIntensity: 0.25 }), ccx + dx, islandTop + 4.7, ccz + dz, scene);
  }
  // Fence colliders on 3 sides; east side stays open as the entrance.
  addObstacle(ccx, ccz - fz, fx, 0.3);
  addObstacle(ccx, ccz + fz, fx, 0.3);
  addObstacle(ccx - fx, ccz, 0.3, fz);
  // Identity sign north of the court, facing the walk-up side. The U-seat
  // beside it was cleared for the wider north apron.
  addSignboard('PICKLEBALL COURT', -15, -4.3, 0);
}

function addCafeZone() {
  const [cx, , cz] = zonePositions.cafe.toArray();
  const patio = disc(5.7, 0.12, mat('#e1cfaa'), cx, islandTop + 0.07, cz, scene, 48); patio.scale.z = 0.72;
  box(6.6, 3.7, 5.2, mat('#f4e4c9'), cx, islandTop + 2.1, cz - 0.15, scene, 0.22);
  // Low, clean roof and broad windows give the commons a contemporary campus feel.
  box(7.2, 0.38, 5.85, mat('#78b99c'), cx, islandTop + 3.95, cz - 0.15, scene, 0.12);
  // Wide windows, a striped awning, and a welcoming door face the pathway.
  box(2.1, 1.4, 0.13, mat('#8fc9c6', 0.45), cx - 1.45, islandTop + 2.26, cz + 2.5, scene, 0.08);
  box(0.12, 1.42, 0.15, mat('#fff7e5'), cx - 1.45, islandTop + 2.26, cz + 2.58, scene);
  addRealDoor(scene, cx + 1.25, islandTop + 0.12, cz + 2.5, 1.2, 2.3, 0, true);
  box(4.45, 0.38, 1.0, mat('#f4a083'), cx - 0.32, islandTop + 3.32, cz + 2.78, scene, 0.09);
  for (let i = 0; i < 5; i++) box(0.45, 0.4, 1.02, i % 2 ? mat('#fff1d2') : mat('#ea8376'), cx - 2.0 + i * 0.84, islandTop + 3.34, cz + 2.79, scene, 0.04);
  // Little patio tables.
  for (const [x, z] of [[cx - 4.1, cz + 1.7], [cx + 4.0, cz + 1.7], [cx + 4.3, cz - 1.1]]) {
    disc(0.72, 0.14, mat('#fff0d6'), x, islandTop + 0.91, z, scene, 24);
    cylinder(0.09, 0.11, 0.83, mat('#9b785c'), x, islandTop + 0.48, z, scene, 8);
    cylinder(0.07, 0.07, 2.15, mat('#f6cc70'), x, islandTop + 1.27, z, scene, 8);
    const umbrella = mesh(new THREE.ConeGeometry(1.08, 0.65, 8), mat('#75bea0'), x, islandTop + 2.56, z); umbrella.rotation.y = Math.PI / 8;
  }
  addSignboard('STUDENT COMMONS', 12.4, -7.6, 0);
}

function addParkZone() {
  const [cx, , cz] = zonePositions.park.toArray();
  const garden = disc(6.7, 0.08, mat('#a7d9a1'), cx, islandTop + 0.05, cz, scene, 48); garden.scale.z = 0.72;
  const bank = disc(2.45, 0.13, mat('#c8d8a4'), cx + 0.2, islandTop + 0.13, cz + 0.2, scene, 40); bank.scale.set(1.55, 0.72, 1);
  const pond = disc(2.1, 0.13, materials.water, cx + 0.2, islandTop + 0.22, cz + 0.2, scene, 40); pond.scale.set(1.55, 0.72, 1);
  for (const [dx, dz, size, tint] of [
    [-4.4, -3.7, 0.96, '#54aa76'], [-1.3, -4.7, 0.86, '#5db37c'], [3.7, -3.9, 0.9, '#61b780'],
    [-5.2, 0.2, 0.77, '#72bd82'], [4.7, 0.8, 0.82, '#57a877'], [-3.8, 4.0, 0.82, '#5aab7c'], [3.8, 4.3, 0.92, '#68b983'],
  ]) addTree(cx + dx, cz + dz, size, tint);
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2;
    addFlower(cx + Math.cos(a) * (3.15 + (i % 2) * 0.35), cz + Math.sin(a) * (2.45 + (i % 2) * 0.25), ['#f2ca72', '#f4f0de', '#e99cac'][i % 3]);
  }
  // Two quiet park benches by the water.
  for (const [x, z, rotation] of [[cx + 0.1, cz - 3.0, 0], [cx + 3.5, cz + 0.2, Math.PI / 2]]) {
    const seat = box(1.9, 0.12, 0.55, mat('#c58a69'), x, islandTop + 0.48, z, scene, 0.08); seat.rotation.y = rotation;
    const back = box(1.9, 0.58, 0.16, mat('#d3a078'), x, islandTop + 0.8, z - 0.23, scene, 0.06); back.rotation.y = rotation;
  }
  addSignboard('BOTANICAL GARDEN', -16.4, 10.8, Math.PI / 2);
}

function addStageZone() {
  const [cx, , cz] = zonePositions.stage.toArray();
  const lawn = disc(6.3, 0.08, mat('#a5d895'), cx, islandTop + 0.05, cz, scene, 48); lawn.scale.z = 0.72;
  disc(3.2, 0.25, mat('#dfc49a'), cx, islandTop + 0.18, cz - 1.05, scene, 48);
  disc(2.8, 0.18, mat('#bd9471'), cx, islandTop + 0.37, cz - 1.05, scene, 48);
  for (let i = 0; i < 3; i++) {
    const color = [mat('#ee947d'), mat('#f0cd72'), mat('#82c6a3')][i];
    const panel = box(2.35, 2.5, 0.28, color, cx - 2.35 + i * 2.35, islandTop + 2.6, cz - 3.4, scene, 0.12);
    panel.rotation.y = i === 1 ? 0 : (i === 0 ? -0.14 : 0.14);
    const stripe = box(2.0, 0.16, 0.32, mat('#fff2d8'), cx - 2.35 + i * 2.35, islandTop + 3.0, cz - 3.23, scene, 0.05);
    stripe.rotation.y = panel.rotation.y;
  }
  box(0.18, 4.2, 0.18, mat('#9b7a62'), cx - 4.0, islandTop + 2.2, cz - 3.5, scene, 0.07);
  box(0.18, 4.2, 0.18, mat('#9b7a62'), cx + 4.0, islandTop + 2.2, cz - 3.5, scene, 0.07);
  box(8.4, 0.22, 0.2, mat('#9b7a62'), cx, islandTop + 4.22, cz - 3.5, scene, 0.08);
  addSignboard('ARTS PAVILION', 14.2, 12.4, -Math.PI / 2);
}

function addLibraryZone() {
  const [cx, , cz] = zonePositions.library.toArray();
  // Relocated north-east; rotated so the entrance faces the west pathway.
  const group = new THREE.Group();
  group.position.set(cx, islandTop, cz);
  group.rotation.y = -Math.PI / 2;
  scene.add(group);
  box(7.2, 0.3, 5.55, materials.stone, 0, 0.18, 0, group, 0.12);
  box(6.35, 3.7, 4.65, mat('#f0ead9'), 0, 2.2, 0, group, 0.14);
  box(6.75, 0.34, 5.0, mat('#5b8791'), 0, 4.16, 0, group, 0.1);
  const glass = mat('#8ac9c9', 0.34, { transparent: true, opacity: 0.86, metalness: 0.08 });
  box(5.35, 1.72, 0.12, glass, 0, 2.78, 2.34, group, 0.04);
  for (const dx of [-1.85, 0, 1.85]) box(0.11, 1.78, 0.16, mat('#f8f2e1'), dx, 2.78, 2.42, group, 0.03);
  box(4.4, 0.16, 1.35, mat('#d4c29d'), 0, 0.32, 3.2, group, 0.06);
  // A small book mark sits above the library entrance.
  box(0.24, 0.62, 0.12, mat('#ef9a78'), -0.17, 3.35, 2.47, group, 0.04);
  box(0.24, 0.62, 0.12, mat('#ef9a78'), 0.17, 3.35, 2.47, group, 0.04);
  addRealDoor(group, 0, 0.33, 2.34, 1.3, 2.3);
  addObstacle(cx, cz, 2.55, 3.35);
  // Paved stub linking the west steps to the pathway edge.
  box(6.5, 0.11, 1.7, materials.sidewalk, 5.75, islandTop + 0.065, cz, scene, 0.06);
  addSignboard('CAMPUS LIBRARY', 7, cz + 2.7, -Math.PI / 2);
}

function addCCSOZone() {
  const [cx, , cz] = zonePositions.ccso.toArray();
  // Three-story CCSO academic block on the old library plot.
  // Local space: length along x, open-air corridors face +z (east pathway
  // after the PI/2 rotation). Cream walls, bright-blue roof fascia.
  const group = new THREE.Group();
  group.position.set(cx, islandTop, cz);
  group.rotation.y = Math.PI / 2;
  scene.add(group);
  const wallMat = mat('#f3e6bd');
  const columnMat = mat('#e9d8a6');
  const fasciaMat = mat('#2f86c9');
  const slabMat = mat('#d9cfb8');
  const stairMat = mat('#b9b3a6');
  const doorMat = mat('#5a3a26');
  const frameDark = mat('#2f3a40');
  const railMat = mat('#232d33');
  const glassMat = mat('#9fd4d0', 0.3, { metalness: 0.1 });
  const floorH = 2.7; const wallH = 2.45;
  const bays = [-4.875, -1.625, 1.625, 4.875];

  // Porch slab under the whole footprint.
  box(13.6, 0.3, 5.6, materials.stone, 0, 0.18, 0.3, group, 0.1);

  for (let f = 0; f < 3; f++) {
    const base = 0.33 + f * floorH;
    const wy = base + wallH / 2;
    // Classroom walls: front (behind corridor), back, ends.
    box(13, wallH, 0.25, wallMat, 0, wy, 0.9, group);
    box(13, wallH, 0.25, wallMat, 0, wy, -2.1, group);
    for (const sx of [-1, 1]) box(0.3, wallH, 3.25, wallMat, sx * 6.35, wy, -0.6, group);
    // Repeating classroom units: door + window per bay.
    for (const bx of bays) {
      const dx = bx - 0.65;
      box(1.14, 2.17, 0.1, columnMat, dx, base + 1.085, 1.03, group);
      box(1.0, 2.05, 0.12, doorMat, dx, base + 1.025, 1.05, group);
      box(1.0, 0.26, 0.12, glassMat, dx, base + 2.3, 1.05, group);
      const wx = bx + 0.85;
      box(1.44, 1.34, 0.1, frameDark, wx, base + 1.57, 1.03, group);
      box(1.3, 1.2, 0.12, glassMat, wx, base + 1.57, 1.05, group);
      box(0.06, 1.2, 0.13, frameDark, wx, base + 1.57, 1.05, group);
      box(1.3, 0.06, 0.13, frameDark, wx, base + 1.57, 1.05, group);
      if (f === 0) box(1.4, 0.12, 0.6, slabMat, dx, 0.39, 1.4, group, 0.05);
    }
    // Small back windows for depth.
    for (const wx of [-4, 0, 4]) {
      box(1.3, 1.1, 0.1, frameDark, wx, base + 1.5, -2.08, group);
      box(1.14, 0.94, 0.12, glassMat, wx, base + 1.5, -2.06, group);
    }
    // Corridor / balcony slab above this floor (also the roof slab on f=2).
    const slabY = base + wallH + 0.125;
    box(13.6, 0.25, 5.6, slabMat, 0, slabY, 0.3, group);
    // Open-air corridor railings on the two upper decks (f=0 slab is the
    // 2nd-floor corridor, f=1 slab the 3rd-floor corridor; roof stays clean).
    if (f < 2) {
      const deck = slabY + 0.125;
      const railZ = 2.95;
      box(13.2, 0.09, 0.09, railMat, 0, deck + 1.02, railZ, group);
      box(13.2, 0.07, 0.07, railMat, 0, deck + 0.55, railZ, group);
      for (let px = -6.6; px <= 6.61; px += 0.6) box(0.06, 1.0, 0.06, railMat, px, deck + 0.5, railZ, group);
      for (const sx of [-1, 1]) {
        box(0.09, 0.09, 2.0, railMat, sx * 6.55, deck + 1.02, 1.95, group);
        for (let pz = 1.1; pz <= 2.9; pz += 0.6) box(0.06, 1.0, 0.06, railMat, sx * 6.55, deck + 0.5, pz, group);
      }
    }
  }

  // Square structural columns: grounded, full height, carry the balconies.
  for (const px of [-6.5, -3.25, 0, 3.25, 6.5]) box(0.35, 7.85, 0.35, columnMat, px, 0.33 + 3.925, 2.5, group);

  // Blue parapet fascia around the flat roof + inset concrete roof surface.
  box(13.2, 0.1, 5.2, stairMat, 0, 8.48, 0.3, group);
  box(13.6, 0.7, 0.15, fasciaMat, 0, 8.78, 3.02, group);
  box(13.6, 0.7, 0.15, fasciaMat, 0, 8.78, -2.42, group);
  for (const sx of [-1, 1]) box(0.15, 0.7, 5.6, fasciaMat, sx * 6.72, 8.78, 0.3, group);

  // External concrete staircase on the east end: two flights + landings.
  const stairX = 7.4;
  for (let i = 0; i < 16; i++) {
    box(1.6, 0.17, 0.3, stairMat, stairX, 0.33 + 0.169 * (i + 0.5), 2.3 - (i + 0.5) * 0.2875, group);
    box(1.6, 0.17, 0.3, stairMat, stairX, 3.03 + 0.169 * (i + 0.5), -2.3 + (i + 0.5) * 0.2875, group);
  }
  box(1.6, 0.2, 1.0, stairMat, stairX, 2.93, -2.8, group);
  box(1.6, 0.2, 1.0, stairMat, stairX, 5.63, 2.8, group);
  // Stair side wall + sloped metal handrails + landing rails.
  box(0.25, 3.0, 6.6, wallMat, 8.32, 1.8, 0, group);
  box(0.25, 3.0, 6.6, wallMat, 8.32, 4.5, 0, group);
  for (const [ry, midY] of [[0.53, 2.68], [-0.53, 5.38]]) {
    for (const rx of [6.65, 8.15]) {
      const rail = box(0.08, 0.08, 5.2, railMat, rx, midY, 0, group);
      rail.rotation.x = ry;
    }
  }
  box(1.7, 0.08, 0.08, railMat, stairX, 6.75, -2.8, group);
  box(0.08, 0.08, 1.0, railMat, stairX + 0.85, 6.75, -2.8, group);
  box(0.08, 0.08, 1.0, railMat, stairX - 0.85, 6.75, -2.8, group);

  // Solid colliders: main block + stair mass (stairs are visual; SKESHOE
  // has no vertical traversal, matching all other multi-floor buildings).
  addObstacle(cx, cz, 2.5, 6.6);
  addObstacle(cx, cz - 7.4, 3.4, 1.1);
  // Paved stub linking the east steps to the pathway edge.
  box(2.0, 0.11, 1.7, materials.sidewalk, -3.6, islandTop + 0.065, -14, scene, 0.06);
  addSignboard('CCSO BUILDING', -2.8, -11.5, Math.PI / 2);

  // Front-yard landscaping: mature trees, bed, and lamp — clear of façade.
  addTree(-13.5, -22.5, 1.0, '#54aa76');
  addTree(-5, -25.5, 0.85, '#5db37c');
  addPlanter(-11, -25.5, 1.0);
  cylinder(0.09, 0.14, 2.8, mat('#8d795f'), -3.0, islandTop + 1.47, -19, scene, 8);
  cylinder(0.42, 0.3, 0.5, mat('#f4d988', 0.6, { emissive: '#f4d988', emissiveIntensity: 0.12 }), -3.0, islandTop + 2.97, -19, scene, 10);
}

function addResidenceZone() {
  const { x: cx, z: cz } = zonePositions.residence;
  const courtyard = disc(6.2, 0.1, mat('#a7d89d'), cx, islandTop + 0.05, cz, scene, 40);
  courtyard.scale.z = 1.45;
  for (const [z, tint] of [[-7.6, '#e6d3b6'], [7.6, '#d5e4ce']]) {
    box(6.8, 0.24, 5.2, materials.stone, cx, islandTop + 0.13, cz + z, scene, 0.12);
    box(5.9, 4.8, 4.5, mat(tint), cx, islandTop + 2.62, cz + z, scene, 0.18);
    box(6.3, 0.46, 4.9, mat(z < 0 ? '#759c96' : '#d28d78'), cx, islandTop + 5.18, cz + z, scene, 0.13);
    for (let floor = 0; floor < 2; floor++) {
      for (let side = -1; side <= 1; side++) {
        box(0.84, 0.68, 0.1, mat('#92c8c4', 0.45), cx + side * 1.72, islandTop + 2.2 + floor * 1.45, cz + z + (z < 0 ? 2.29 : -2.29), scene, 0.05);
      }
    }
    addRealDoor(scene, cx, islandTop + 0.25, cz + z + (z < 0 ? 2.3 : -2.3), 1.1, 2.0, z < 0 ? 0 : Math.PI);
    addObstacle(cx, cz + z, 3.15, 2.55);
  }
  for (const [dx, dz] of [[-4.6, -1.3], [-5.0, 5.5]]) {
    addTree(cx + dx, cz + dz, 0.7, '#5bab7a');
  }
  // East spine links the pathway to the courtyard; a crossing feeds the
  // courtyard center and short stubs serve each door. District fronts north.
  box(1.7, 0.11, 16.5, materials.sidewalk, cx + 5.0, islandTop + 0.065, cz + 8.25, scene, 0.06);
  box(6.0, 0.11, 1.7, materials.sidewalk, cx + 2.5, islandTop + 0.065, cz, scene, 0.06);
  box(1.7, 0.11, 4.5, materials.sidewalk, cx, islandTop + 0.065, cz - 3.05, scene, 0.06);
  box(1.7, 0.11, 4.5, materials.sidewalk, cx, islandTop + 0.065, cz + 3.05, scene, 0.06);
  // Courtyard benches face each other across the gathering space.
  addBench(cx - 2.6, cz + 4.0, Math.PI / 2);
  addBench(cx + 2.6, cz + 4.0, -Math.PI / 2);
  addSignboard('RESIDENCE HALL', cx + 2.4, cz + 13.0, 0);
}

function addTransitZone() {
  const { x: cx, z: cz } = zonePositions.transit;
  // Paved bus bay north of the lane so buses board clear of traffic.
  box(9.0, 0.14, 3.4, mat('#d9cfb8'), cx, islandTop + 0.08, cz + 4.2, scene, 0.1);
  const bayEdge = mat('#f4efe2', 0.7);
  box(9.0, 0.025, 0.12, bayEdge, cx, islandTop + 0.16, cz + 2.55, scene);
  box(0.12, 0.025, 3.4, bayEdge, cx - 4.5, islandTop + 0.16, cz + 4.2, scene);
  box(0.12, 0.025, 3.4, bayEdge, cx + 4.5, islandTop + 0.16, cz + 4.2, scene);
  // North footpath linking the shelter to campus, clear of the main pathway.
  box(14.0, 0.11, 1.7, materials.sidewalk, cx - 7.0, islandTop + 0.065, cz + 6.8, scene, 0.06);
  // Waiting pad under the shelter.
  box(5.0, 0.11, 3.2, materials.sidewalk, cx - 7.0, islandTop + 0.06, cz + 4.6, scene, 0.06);
  // Threshold bands marking the crossing to the shelter side. A darker wash
  // of the same concrete reads as a painted band, not a road marking.
  const threshold = mat('#a9aca6', 0.9);
  for (let i = 0; i < 5; i++) box(0.55, 0.02, 4.4, threshold, cx - 7.5 + i * 1.0, islandTop + 0.17, cz, scene);
  // Parked campus bus aligned with the pathway inside its bay, doors to the shelter.
  const busX = cx + 0.3;
  box(4.6, 1.65, 2.0, mat('#78b99c'), busX, islandTop + 1.0, cz + 4.2, scene, 0.3);
  box(3.35, 0.7, 0.12, mat('#9fd4d0', 0.4), busX, islandTop + 1.38, cz + 3.17, scene, 0.08);
  for (const dx of [-1.4, 1.4]) {
    const wheel = cylinder(0.42, 0.42, 0.17, mat('#536b73'), busX + dx, islandTop + 0.47, cz + 4.2, scene, 16);
    wheel.rotation.z = Math.PI / 2;
  }
  addObstacle(busX, cz + 4.2, 2.4, 1.15);
  // Single open shelter west of the bay, bench facing the buses.
  addShelter(cx - 7.0, cz + 4.6, 0);
  addSignboard('CAMPUS TRANSIT', cx - 10.0, cz + 4.6, -Math.PI / 2);
}

function addStreetDetails() {
  const trees = [
    [-33, -14, 0.82], [-26, 17, 0.78], [26, 17, 0.8], [20, -24, 0.88],
    [-22, 20, 0.82], [22, -20, 0.76], [22, 20, 0.82], [-22, -20, 0.72],
    [-8, -24, 0.63], [8, 24, 0.65], [8, -24, 0.63], [-8, 24, 0.65],
    [-42, -17, 0.88], [-17, -42, 0.9], [17, -42, 0.86], [42, -17, 0.9],
    [42, 17, 0.88], [17, 42, 0.86], [-17, 42, 0.9], [-42, 17, 0.86],
  ];
  for (const [x, z, s] of trees) addTree(x, z, s, '#58ad7d');
  for (const [x, z] of [[-5.7, -6.3], [5.5, -6.3], [-5.8, 6.3], [5.8, 6.2], [-24, -5], [24, 5]]) addBush(x, z, 0.84, '#70c389');
  // Shrub border beds flanking the main walkways, set on the grass verge.
  for (const [x, z] of [[-30, -3.4], [30, 3.4], [-3.4, -30], [3.4, 30], [-16, -3.4], [16, -3.4], [-3.4, 16], [3.4, -16]]) addBush(x, z, 0.78, '#68bf82');
  // Rounded, warm street lamps.
  for (const [x, z] of [[-8.6, -5.2], [8.6, 5.2], [3.9, -7.9], [-3.9, 7.9], [-25.5, 3.5], [25.5, -3.5], [3.9, -20], [-3.9, 20]]) {
    cylinder(0.09, 0.14, 2.8, mat('#8d795f'), x, islandTop + 1.47, z, scene, 8);
    cylinder(0.42, 0.3, 0.5, mat('#f4d988', 0.6, { emissive: '#f4d988', emissiveIntensity: 0.12 }), x, islandTop + 2.97, z, scene, 10);
    cylinder(0.25, 0.3, 0.14, mat('#fff0bb'), x, islandTop + 2.7, z, scene, 10);
  }
  // Freestanding welcome sign beside the entrance walk, clear of the pathway.
  addSignboard('WELCOME TO SKESHOE', 4.3, 20.0, Math.PI);
  // Junction direction signs: set before intersections, facing the approach side.
  addDirectionSign('STUDENT COMMONS →', 9.0, -7.6, 0);
  
  addDirectionSign('ARTS PAVILION →', 3.4, 6.0, -Math.PI / 2);
  addDirectionSign('← BOTANICAL GARDEN', -3.4, 6.0, Math.PI / 2);
}

// ---------- Outdoor student seating (reusable low-poly prefabs) ----------
const benchWoodMat = mat('#b98262');
const benchWoodDark = mat('#9a6b4e');
const benchMetalMat = mat('#46585e');
const shadeClothMat = mat('#e8dfc8');
const pergolaWoodMat = mat('#8a6f52');
const planterStoneMat = mat('#d5c8ab');
const planterSoilMat = mat('#8a6b4e');

// Registered sit spots: { x, z, rotY } in world space.
const seats = [];
let seatedState = null;
let seatPrompt = null;
const SIT_DISTANCE = 2.4;

function registerSeat(x, z, rotY) {
  seats.push({ x, z, rotY });
}

// Park bench facing +z locally. Seat spot sits just off the front edge.
function addBench(x, z, rotY = 0, len = 2.2) {
  const group = new THREE.Group();
  group.position.set(x, islandTop, z);
  group.rotation.y = rotY;
  box(len, 0.1, 0.55, benchWoodMat, 0, 0.55, 0, group, 0.04);
  const back = box(len, 0.55, 0.09, benchWoodDark, 0, 0.95, -0.28, group, 0.04);
  back.rotation.x = -0.12;
  for (const px of [-len / 2 + 0.2, len / 2 - 0.2]) {
    box(0.12, 0.55, 0.5, benchMetalMat, px, 0.275, 0, group, 0.03);
  }
  scene.add(group);
  addCircularObstacle(x, z, 0.95);
  registerSeat(x + Math.sin(rotY) * 0.35, z + Math.cos(rotY) * 0.35, rotY);
  return group;
}

function addStool(x, z, rotY) {
  const group = new THREE.Group();
  group.position.set(x, islandTop, z);
  group.rotation.y = rotY;
  cylinder(0.32, 0.32, 0.1, benchWoodMat, 0, 0.5, 0, group, 12);
  cylinder(0.06, 0.09, 0.5, benchMetalMat, 0, 0.25, 0, group, 8);
  disc(0.2, 0.05, benchMetalMat, 0, 0.03, 0, group, 10);
  scene.add(group);
  registerSeat(x, z, rotY);
  return group;
}

// Outdoor table with four stools facing it.
function addTableSet(x, z, rotY = 0) {
  const group = new THREE.Group();
  group.position.set(x, islandTop, z);
  group.rotation.y = rotY;
  scene.add(group);
  box(1.3, 0.08, 1.3, benchWoodMat, x, islandTop + 0.72, z, scene, 0.03);
  box(0.14, 0.72, 0.14, benchMetalMat, x, islandTop + 0.36, z, scene, 0.03);
  disc(0.34, 0.06, benchMetalMat, x, islandTop + 0.03, z, scene, 12);
  addCircularObstacle(x, z, 1.0);
  for (let i = 0; i < 4; i++) {
    const a = rotY + i * Math.PI / 2 + Math.PI / 4;
    const sx = x + Math.sin(a) * 1.35;
    const sz = z + Math.cos(a) * 1.35;
    addStool(sx, sz, Math.atan2(x - sx, z - sz));
  }
  return group;
}

// Open-sided pergola: posts + slatted top, benches placed separately.
function addPergola(x, z, rotY = 0, w = 5, d = 4) {
  const group = new THREE.Group();
  group.position.set(x, islandTop, z);
  group.rotation.y = rotY;
  scene.add(group);
  for (const [px, pz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) {
    cylinder(0.12, 0.14, 3.0, pergolaWoodMat, px, 1.5, pz, group, 8);
  }
  for (let i = 0; i < 5; i++) {
    const beam = box(0.18, 0.14, d + 0.8, pergolaWoodMat, 0, 3.05, 0, group, 0.03);
    beam.position.x = -w / 2 + 0.4 + i * (w - 0.8) / 4;
  }
  for (const pz of [-d / 2, d / 2]) box(w + 0.4, 0.16, 0.18, pergolaWoodMat, 0, 2.9, pz, group, 0.03);
  return group;
}

// Covered waiting shelter with a bench inside facing +z locally.
function addShelter(x, z, rotY = 0) {
  const group = new THREE.Group();
  group.position.set(x, islandTop, z);
  group.rotation.y = rotY;
  scene.add(group);
  const w = 4.2; const d = 2.6;
  for (const [px, pz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) {
    cylinder(0.1, 0.12, 2.6, benchMetalMat, px, 1.3, pz, group, 8);
  }
  const roof = box(w + 0.5, 0.15, d + 0.5, shadeClothMat, 0, 2.68, 0, group, 0.05);
  roof.receiveShadow = true;
  const fx = Math.sin(rotY); const fz = Math.cos(rotY);
  addBench(x - fx * 0.7, z - fz * 0.7, rotY);
  return group;
}

function addPlanter(x, z, r = 1.1) {
  disc(r, 0.3, planterStoneMat, x, islandTop + 0.15, z, scene, 24);
  disc(r - 0.28, 0.34, planterSoilMat, x, islandTop + 0.17, z, scene, 24);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    addFlower(x + Math.cos(a) * (r - 0.55), z + Math.sin(a) * (r - 0.55), ['#f2ca72', '#f4f0de', '#e99cac'][i % 3]);
  }
  addCircularObstacle(x, z, r + 0.2);
}

// Park trash can: dark-green body, rim, and lid knob. Small collider included.
function addTrashCan(x, z) {
  cylinder(0.26, 0.22, 0.75, mat('#2f5d50'), x, islandTop + 0.375, z, scene, 12);
  const rim = torus(0.26, 0.045, mat('#203f37'), x, islandTop + 0.75, z, scene, 16);
  rim.rotation.x = Math.PI / 2;
  cylinder(0.27, 0.27, 0.07, mat('#203f37'), x, islandTop + 0.79, z, scene, 12);
  mesh(new THREE.SphereGeometry(0.06, 8, 6), mat('#c9c2ae'), x, islandTop + 0.86, z, scene, false, false);
  addCircularObstacle(x, z, 0.32);
}

function addSeatingAreas() {
  // Admin forecourt. Benches sit ~1.6m back from the kerb line so nothing
  // overhangs the walkway, and are paired facing each other across the walk.
  addBench(5.0, -5.0, Math.PI / 2);
  addBench(10.9, -5.0, -Math.PI / 2);
  addBench(-5.0, -5.0, Math.PI / 2);
  addBench(-10.9, -5.0, -Math.PI / 2);
  // Extra seat on the lawn side of the services walk.
  addBench(5.0, -7.0, -Math.PI / 2);
  // Cafe garden table.
  addTableSet(13.2, -12.8, 0.3);
  // South lawn facing-pair clusters, set clear of the arts branch walk.
  addBench(7.4, 11.4, 0);
  addBench(7.4, 13.6, Math.PI);
  addBench(-7.4, 11.4, 0);
  addBench(-7.4, 13.6, Math.PI);
  // Pergola lounge east of the commons.
  addPergola(24.5, -6.5, 0);
  addBench(24.5, -5.6, 0);
  addBench(24.5, -7.4, Math.PI);
  // Transit waiting shelter (bench faces the platform).
  addShelter(24.0, 4.0, 0);
  // Botanical garden: arc facing the pond + shaded table.
  addBench(-22.0, 16.2, Math.PI - 0.35);
  addBench(-19.8, 16.9, Math.PI);
  addBench(-17.6, 16.2, Math.PI + 0.35);
  addTableSet(-15.0, 11.0, 0.4);
  // Sports sideline bench — on the north verge, facing the play.
  addBench(-21, -4.2, Math.PI);
  // Central greens: planter with U-shaped seating, clear of the branch walks.
  addPlanter(6.0, 6.0, 1.1);
  addBench(6.0, 8.9, Math.PI);
  addBench(3.9, 6.0, Math.PI / 2);
  addBench(8.1, 6.0, -Math.PI / 2);
  // Planting strip only — the U-seating here crowded the CCSO back.
  addPlanter(-6.0, -6.0, 1.1);
  // Garden pergola study nook.
  addPergola(6.2, -12.5, 0, 4, 3.5);
  addBench(6.2, -11.8, Math.PI);
  addBench(6.2, -13.2, 0);
  // Entrance waiting benches, flanking the walk in from the south gate.
  addBench(-6.2, 22.4, Math.PI / 2);
  addBench(6.2, 22.4, -Math.PI / 2);
  // Trash cans beside seating clusters, entrances, and shelters.
  for (const [x, z] of [
    // Kept off every walkway surface (main paths reach |x|,|z| = 2.2).
    [-2.6, -8.6], [5.9, -7.3], [-2.6, -6.2], [12.4, -3.6], [-12.1, -3.6],
    [12.0, -13.6], [8.0, 11.7], [-8.0, 11.9], [27.3, -6.5], [26.5, 4.6],
    [-13.6, 10.2], [-27.4, -4.2], [9.1, 8.9], [7.0, 21.0],
    [28.0, -19.5], [35.6, -24.8], [23.9, 5.7],
  ]) addTrashCan(x, z);
}

// Campus traffic removed — the pathways are now pedestrian-only. The parked
// campus shuttle at the transit bay stays as a static landmark prop.
function makeNameTag(name, isLocal = false) {
  const display = (name || 'Neighbor').slice(0, 18);
  const canvas = document.createElement('canvas');
  // Higher resolution + dark pill = readable at any distance / background.
  canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.shadowColor = 'rgba(30, 50, 55, .28)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
  ctx.fillStyle = isLocal ? '#2f6b4a' : 'rgba(30, 46, 54, .94)';
  ctx.beginPath(); ctx.roundRect(6, 14, 500, 100, 50); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.lineWidth = 5; ctx.strokeStyle = isLocal ? '#bdf0cd' : 'rgba(255,255,255,.95)'; ctx.stroke();
  if (isLocal) {
    ctx.fillStyle = '#bdf0cd';
    ctx.beginPath(); ctx.arc(52, 64, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2f6b4a'; ctx.font = '800 22px Inter, Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('★', 52, 65);
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 46px Inter, Arial, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  // Slight tracking + max-width keeps long names inside the pill.
  ctx.fillText(display, isLocal ? 278 : 256, 66, isLocal ? 400 : 440);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true }));
  sprite.scale.set(3.8, 0.95, 1); sprite.position.y = 3.72; sprite.renderOrder = 8;
  return sprite;
}

function makeSpeechBubble(text) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 170;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(255,250,237,.98)'; ctx.beginPath(); ctx.roundRect(12, 10, 488, 132, 38); ctx.fill();
  ctx.beginPath(); ctx.moveTo(226, 136); ctx.lineTo(266, 136); ctx.lineTo(247, 164); ctx.fill();
  ctx.fillStyle = '#385467'; ctx.font = '700 40px Inter, Arial, sans-serif'; ctx.textAlign = 'center';
  const short = text.length > 23 ? `${text.slice(0, 22)}…` : text;
  ctx.fillText(short, 256, 91);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
}

const avatarPalette = ['#ed8c76', '#86b9d9', '#daa578', '#ad9bd5', '#7ec5a1', '#e6a5b0', '#edc86f', '#78abb1'];
const hairPalette = ['#634b4a', '#543f38', '#352e31', '#9a6548', '#716055'];
let localAvatar;
const returningPlayer = Boolean(localStorage.getItem('wc_name'));
let localName = localStorage.getItem('wc_name') || 'Sunny';
const savedColor = localStorage.getItem('wc_color');
let localColor = avatarPalette.includes(savedColor) ? savedColor : avatarPalette[Math.floor(Math.random() * avatarPalette.length)];
let isPlaying = false;
let currentTarget = null;
let activeZone = 'library';
let currentPrompt = null;
let actionEmoteIndex = 0;
const remotePlayers = new Map();
const remotes = new Map();
let connection;
let reconnectTimer;
let lastMoveSent = 0;
let lastMove = new THREE.Vector3(Infinity, Infinity, Infinity);
let bubbleTimer;
let toastTimer;
let lastNeighborRender = 0;

function createAvatar(name, shirtColor, isLocal = false) {
  const group = new THREE.Group();
  // Real-life proportion: character reads small next to buildings,
  // especially when fully zoomed out. 0.6 ≈ 1.7m human vs ~5m halls.
  group.scale.setScalar(0.6);
  const shadow = mesh(new THREE.CircleGeometry(0.68, 24), mat('#38515c', 1, { transparent: true, opacity: 0.18, depthWrite: false }), 0, 0.03, 0, group, false, false);
  shadow.rotation.x = -Math.PI / 2; shadow.scale.set(1.0, 0.58, 1);
  const skin = mat('#efc5a4');
  // SKESHOE uniform: crisp white polo, black slacks, black shoes. The chosen
  // colour becomes a lanyard accent so players stay visually distinct.
  const top = mat('#fbfbf8', 0.78);
  const collar = mat('#eceee8', 0.8);
  const trouser = mat('#23252b', 0.86);
  const shoe = mat('#16181c', 0.72);
  const belt = mat('#15161a', 0.6);
  const accent = mat(shirtColor);
  const hairMat = mat(hairPalette[Math.floor(Math.random() * hairPalette.length)]);
  const head = mesh(new THREE.SphereGeometry(0.56, 16, 12), skin, 0, 2.22, 0, group);
  head.scale.set(0.91, 1.05, 0.9);
  const hair = mesh(new THREE.SphereGeometry(0.55, 12, 9), hairMat, 0, 2.51, -0.03, group);
  hair.scale.set(1.03, 0.64, 1.0);
  const torso = mesh(roundBox(0.83, 0.94, 0.58, 0.18), top, 0, 1.43, 0, group);
  // Polo details: folded collar, button placket, waistband, lanyard accent.
  mesh(roundBox(0.34, 0.09, 0.2, 0.04), collar, 0, 1.86, 0.24, group);
  mesh(roundBox(0.1, 0.52, 0.06, 0.02), collar, 0, 1.6, 0.3, group);
  for (let i = 0; i < 3; i++) mesh(new THREE.SphereGeometry(0.028, 6, 5), mat('#fdfdfb'), 0, 1.76 - i * 0.17, 0.33, group, false, false);
  mesh(roundBox(0.84, 0.1, 0.6, 0.04), belt, 0, 0.98, 0, group);
  box(0.12, 0.34, 0.04, accent, 0.19, 1.42, 0.3, group);
  box(0.19, 0.25, 0.03, accent, 0.2, 1.17, 0.31, group, 0.02);
  box(0.24, 0.06, 0.035, accent, 0, 1.82, 0.3, group);
  const neck = mesh(new THREE.CylinderGeometry(0.17, 0.18, 0.25, 9), skin, 0, 1.99, 0.04, group);
  const eyeWhite = mat('#fff7ed'); const eye = mat('#34465a');
  for (const side of [-1, 1]) {
    mesh(new THREE.SphereGeometry(0.083, 8, 6), eyeWhite, side * 0.19, 2.24, 0.49, group, false, false);
    mesh(new THREE.SphereGeometry(0.044, 8, 6), eye, side * 0.19, 2.24, 0.555, group, false, false);
  }
  const legs = [];
  for (const side of [-1, 1]) {
    const leg = mesh(new THREE.CapsuleGeometry(0.18, 0.46, 4, 8), trouser, side * 0.2, 0.58, 0, group);
    const foot = mesh(roundBox(0.37, 0.2, 0.56, 0.08), shoe, side * 0.2, 0.18, 0.13, group);
    legs.push(leg);
  }
  const arms = [];
  for (const side of [-1, 1]) {
    const arm = mesh(new THREE.CapsuleGeometry(0.145, 0.48, 4, 8), top, side * 0.5, 1.42, 0.02, group);
    arm.rotation.z = -side * 0.15; arms.push(arm);
    const hand = mesh(new THREE.SphereGeometry(0.16, 8, 6), skin, side * 0.51, 1.12, 0.06, group);
  }
  const tag = makeNameTag(name, isLocal); group.add(tag);
  group.userData = { torso, top, accent, arms, legs, tag, name, shirtColor, phase: Math.random() * 8, bubble: null, bubbleEnd: 0, isLocal, waving: 0 };
  return group;
}

function updateNameTag(avatar, name) {
  const tag = avatar.userData.tag;
  avatar.remove(tag);
  if (tag?.material?.map) tag.material.map.dispose();
  tag?.material?.dispose();
  avatar.userData.tag = makeNameTag(name, avatar.userData.isLocal);
  avatar.userData.tag.position.y = 3.72;
  avatar.add(avatar.userData.tag);
  avatar.userData.name = name;
}

function bubble(avatar, text, seconds = 2.2) {
  if (avatar.userData.bubble) avatar.remove(avatar.userData.bubble);
  const sprite = makeSpeechBubble(text);
  sprite.position.set(0, 4.25, 0);
  sprite.scale.set(3.1, 1.03, 1);
  avatar.add(sprite);
  avatar.userData.bubble = sprite;
  avatar.userData.bubbleEnd = performance.now() + seconds * 1000;
}

function addAvatarToScene(avatar, x = 0, z = 0) {
  avatar.position.set(x, islandTop, z);
  scene.add(avatar);
}

function initializeWorld() {
  addCampusGround();
  addPathways();
  addPathwayVerge();
  addCentralLandmarks();
  addSportsZone();
  addCafeZone();
  addParkZone();
  addStageZone();
  addLibraryZone();
  addCCSOZone();
  addResidenceZone();
  addTransitZone();
  addStreetDetails();
  addSeatingAreas();
  const hitArea = new THREE.Mesh(new THREE.CircleGeometry(CAMPUS_RADIUS - 0.55, 96), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  hitArea.rotation.x = -Math.PI / 2; hitArea.position.set(0, islandTop + 0.1, 0); hitArea.userData.walkSurface = true; scene.add(hitArea);
}

initializeWorld();
localAvatar = createAvatar(localName, localColor, true);
addAvatarToScene(localAvatar, -3.8, 1.5);
const cameraController = new CameraController(camera, localAvatar, collidesWithBuilding);
const waypointMarker = new THREE.Group();
const waypointRing = torus(0.72, 0.105, mat('#fbf2cf', 0.42, { emissive: '#f5d681', emissiveIntensity: 0.32 }), 0, 0.07, 0, waypointMarker, 32);
waypointRing.rotation.x = Math.PI / 2;
mesh(new THREE.SphereGeometry(0.16, 12, 8), mat('#f4cb70', 0.35, { emissive: '#eebf5a', emissiveIntensity: 0.2 }), 0, 0.68, 0, waypointMarker, false, false);
waypointMarker.visible = false;
scene.add(waypointMarker);
function setWaypoint(target) {
  if (currentTarget === target) return;
  currentTarget = target;
  waypointMarker.visible = Boolean(target);
  if (target) waypointMarker.position.set(target.x, islandTop + 0.12, target.z);
  updateMapWaypoint(target);
}
cameraController.onModeChange = (label) => {
  const button = document.querySelector('[data-action="camera"]');
  button.querySelector('small').textContent = label === 'Third person' ? 'Follow' : label === 'Isometric' ? 'Isometric' : 'Free';
  button.setAttribute('aria-label', `Camera view: ${label}. Click to change camera view.`);
  showToast(`${label} camera`);
};

function resize() {
  const aspect = window.innerWidth / Math.max(window.innerHeight, 1);
  const viewHeight = window.innerWidth < 700 ? 33 : 39.5;
  camera.left = -viewHeight * aspect / 2; camera.right = viewHeight * aspect / 2;
  camera.top = viewHeight / 2; camera.bottom = -viewHeight / 2;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
}
window.addEventListener('resize', resize);
resize();

function showToast(message) {
  const toast = $('#toast'); toast.textContent = message; toast.classList.add('visible');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('visible'), 2600);
}

function setPlayerName(name, persist = true) {
  localName = (name || 'Sunny').trim().slice(0, 18) || 'Sunny';
  if (persist) localStorage.setItem('wc_name', localName);
  $('#profile-label').textContent = localName;
  $('#profile-initial').textContent = localName.slice(0, 1).toUpperCase();
  const popName = $('#popover-name'); if (popName) popName.textContent = localName;
  const popInitial = $('#popover-initial'); if (popInitial) popInitial.textContent = localName.slice(0, 1).toUpperCase();
  const nameField = $('#profile-name-input'); if (nameField && document.activeElement !== nameField) nameField.value = localName;
  const joinField = $('#name-input'); if (joinField) joinField.value = localName;
  if (localAvatar) updateNameTag(localAvatar, localName);
  if (connection?.readyState === WebSocket.OPEN) send({ type: 'join', name: localName, color: localColor });
}

function startGame(name) {
  if (name) setPlayerName(name);
  isPlaying = true;
  updateOnlineCount();
  $('#welcome-modal').classList.add('hidden');
  connectRealtime();
  setTimeout(() => showToast(`Welcome to campus, ${localName} ✨`), 450);
}

function send(payload) {
  if (connection?.readyState === WebSocket.OPEN) connection.send(JSON.stringify(payload));
}

function connectRealtime() {
  if (!isPlaying || connection?.readyState === WebSocket.OPEN || connection?.readyState === WebSocket.CONNECTING) return;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  connection = new WebSocket(`${protocol}//${window.location.host}/community`);
  connection.addEventListener('open', () => {
    send({ type: 'join', name: localName, color: localColor });
    $('#presence-pill')?.classList?.remove('offline');
    updateOnlineCount();
  });
  connection.addEventListener('message', (event) => {
    let message; try { message = JSON.parse(event.data); } catch { return; }
    if (message.type === 'welcome') {
      remoteId = message.id;
      if (message.spawn && Number.isFinite(message.spawn.x) && Number.isFinite(message.spawn.z)) {
        localAvatar.position.set(message.spawn.x, islandTop, message.spawn.z);
        lastMove.copy(localAvatar.position);
        updateMapPlayer(localAvatar.position);
      }
      for (const remote of message.players || []) addRemote(remote);
      updateOnlineCount();
      send({ type: 'join', name: localName, color: localColor });
    } else if (message.type === 'joined' || message.type === 'updated') {
      if (message.player?.id !== message.id) addRemote(message.player);
      updateOnlineCount();
    } else if (message.type === 'moved') {
      if (message.player?.id === remoteId) {
        const distance = Math.hypot(localAvatar.position.x - message.player.x, localAvatar.position.z - message.player.z);
        if (message.correction || distance > 1.2) {
          setWaypoint(null);
          localAvatar.position.x = message.player.x;
          localAvatar.position.z = message.player.z;
        }
      } else {
        const remote = remotes.get(message.player?.id);
        if (remote) {
          remote.target.set(message.player.x, islandTop, message.player.z);
          remote.targetYaw = message.player.look || 0;
          remote.moving = message.player.moving === true;
          remote.jumping = message.player.jumping === true;
        }
      }
    } else if (message.type === 'left') {
      removeRemote(message.id); updateOnlineCount();
    } else if (message.type === 'chat') {
      addChat(message.name, message.text, message.id === remoteId ? 'self' : 'neighbor');
      if (message.id === remoteId) bubble(localAvatar, message.text, 2.6);
      else if (message.id && remotes.has(message.id)) bubble(remotes.get(message.id).avatar, message.text, 3.1);
    } else if (message.type === 'emote') {
      const remote = remotes.get(message.id);
      if (remote) { bubble(remote.avatar, message.emote); remote.avatar.userData.waving = 1.2; }
    } else if (message.type === 'interact') {
      const remote = remotes.get(message.id);
      if (remote && placeTitles[message.place]) bubble(remote.avatar, `At ${placeTitles[message.place]}`, 2.4);
    }
  });
  connection.addEventListener('close', () => {
    $('#presence-pill')?.classList?.add('offline');
    for (const id of [...remotes.keys()]) removeRemote(id);
    remoteId = null;
    updateOnlineCount();
    if (isPlaying) { clearTimeout(reconnectTimer); reconnectTimer = setTimeout(connectRealtime, 2600); }
  });
  connection.addEventListener('error', () => connection.close());
}

let remoteId = null;
function addRemote(data) {
  if (!data || !data.id || data.id === remoteId) return;
  let remote = remotes.get(data.id);
  if (!remote) {
    const avatar = createAvatar(data.name || 'Neighbor', data.color || '#86b9d9');
    addAvatarToScene(avatar, Number(data.x) || 0, Number(data.z) || 0);
    remote = { avatar, target: new THREE.Vector3(Number(data.x) || 0, islandTop, Number(data.z) || 0), targetYaw: Number(data.look) || 0 };
    remote.moving = data.moving === true;
    remote.jumping = data.jumping === true;
    remotes.set(data.id, remote);
  }
  if (data.name && remote.avatar.userData.name !== data.name) updateNameTag(remote.avatar, data.name);
  if (data.color) { remote.avatar.userData.accent.color.set(data.color); remote.avatar.userData.shirtColor = data.color; }
  if (Number.isFinite(data.x) && Number.isFinite(data.z)) remote.target.set(data.x, islandTop, data.z);
  if (Number.isFinite(data.look)) remote.targetYaw = data.look;
  remote.moving = data.moving === true;
  remote.jumping = data.jumping === true;
  renderNeighbors();
}

function removeRemote(id) {
  const remote = remotes.get(id); if (!remote) return;
  scene.remove(remote.avatar); disposeAvatar(remote.avatar); remotes.delete(id); renderNeighbors();
}

function disposeAvatar(avatar) {
  avatar.traverse((object) => {
    if (object.geometry) object.geometry.dispose();
    if (object.material) {
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (material.map) material.map.dispose(); material.dispose();
      }
    }
  });
}

function updateOnlineCount() {
  const connected = connection?.readyState === WebSocket.OPEN;
  const count = (isPlaying ? 1 : 0) + remotes.size;
  const badge = $('#online-count'); if (badge) badge.textContent = String(count);
  const pill = $('#presence-pill');
  if (pill) {
    pill.classList.toggle('offline', !connected);
    pill.setAttribute('aria-label', `${count} ${count === 1 ? 'student' : 'students'} online`);
    pill.title = `${count} online — view students nearby`;
  }
  $('#neighbor-count').textContent = String(remotes.size);
  renderNeighbors();
}

function getPlaceForPosition(x, z) {
  let closest = 'library'; let distance = Infinity;
  for (const [place, position] of Object.entries(zonePositions)) {
    const d = Math.hypot(position.x - x, position.z - z);
    if (d < distance) { closest = place; distance = d; }
  }
  return closest;
}

function renderNeighbors() {
  const list = $('#neighbor-list');
  const entries = [...remotes.entries()];
  $('#neighbor-count').textContent = String(entries.length);
  if (!entries.length) {
    list.innerHTML = '<div class="neighbor-empty"><span class="empty-orbit">✿</span><strong>Campus is quiet for now</strong><small>Students will appear here as they join.</small></div>';
    return;
  }
  list.innerHTML = entries.slice(0, 5).map(([id, remote], index) => {
    const name = escapeHTML(remote.avatar.userData.name || 'Neighbor');
    const place = placeTitles[getPlaceForPosition(remote.avatar.position.x, remote.avatar.position.z)];
    const color = remote.avatar.userData.shirtColor || avatarPalette[index % avatarPalette.length];
    return `<button class="neighbor-row" data-neighbor="${id}"><span class="neighbor-avatar" style="--avatar-color:${color}">${name.slice(0, 1).toUpperCase()}</span><span class="neighbor-copy"><strong>${name}</strong><small><i></i> Exploring ${place}</small></span><span class="neighbor-more">···</span></button>`;
  }).join('');
  list.querySelectorAll('[data-neighbor]').forEach((button) => button.addEventListener('click', () => {
    const remote = remotes.get(button.dataset.neighbor);
    if (remote) { bubble(localAvatar, '👋'); send({ type: 'emote', emote: '👋' }); showToast(`You waved to ${remote.avatar.userData.name} 👋`); }
  }));
}

function escapeHTML(text) {
  return String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function formatTime(date = new Date()) { return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }

function addChat(name, text, type = 'neighbor') {
  const messages = $('#chat-messages');
  const row = document.createElement('div'); row.className = `chat-message ${type}`;
  const initial = document.createElement('span'); initial.className = 'chat-avatar'; initial.textContent = name.slice(0, 1).toUpperCase();
  const body = document.createElement('div'); body.className = 'chat-copy';
  const meta = document.createElement('div'); meta.className = 'chat-meta';
  const sender = document.createElement('strong'); sender.textContent = name;
  const time = document.createElement('time'); time.textContent = formatTime();
  meta.append(sender, time);
  const content = document.createElement('p'); content.textContent = text;
  body.append(meta, content); row.append(initial, body); messages.append(row);
  while (messages.children.length > 18) messages.firstElementChild.remove();
  messages.scrollTop = messages.scrollHeight;
}

addChat('Campus guide', 'Welcome to campus! Click a place to walk over and say hello.', 'guide');
addChat('Campus guide', 'Your next great idea could start with a wave 👋', 'guide');

function addActionEmote(emote) {
  bubble(localAvatar, emote);
  localAvatar.userData.waving = 1.2;
  send({ type: 'emote', emote });
}

function enterZone(place) {
  if (!zonePositions[place]) return;
  activeZone = place;
  const [x, z] = CAMPUS_PLACES.find((item) => item.id === place)?.arrival || [zonePositions[place].x, zonePositions[place].z];
  setWaypoint(new THREE.Vector3(x, islandTop, z));
  document.querySelectorAll('.place-card').forEach((button) => button.classList.toggle('selected', button.dataset.place === place));
  document.querySelectorAll('.map-point').forEach((button) => button.classList.toggle('selected', button.dataset.mapPlace === place));
  showToast(`Walking over to ${placeTitles[place]}…`);
}

document.querySelectorAll('.place-card').forEach((button) => button.addEventListener('click', () => {
  enterZone(button.dataset.place);
  $('#minimap-popover').hidden = true;
  $('#minimap-expand')?.setAttribute('aria-expanded', 'false');
}));
const minimapExpand = $('#minimap-expand');
const minimapPopover = $('#minimap-popover');
if (minimapExpand && minimapPopover) {
  minimapExpand.addEventListener('click', (event) => {
    event.stopPropagation();
    minimapPopover.hidden = !minimapPopover.hidden;
    minimapExpand.setAttribute('aria-expanded', String(!minimapPopover.hidden));
  });
  $('#minimap-close')?.addEventListener('click', () => {
    minimapPopover.hidden = true;
    minimapExpand.setAttribute('aria-expanded', 'false');
  });
  document.addEventListener('click', (event) => {
    if (!minimapPopover.hidden && !event.target.closest('#minimap-hud')) {
      minimapPopover.hidden = true;
      minimapExpand.setAttribute('aria-expanded', 'false');
    }
  });
}
$('#join-form').addEventListener('submit', (event) => { event.preventDefault(); startGame($('#name-input').value); });
$('#welcome-close').addEventListener('click', () => startGame($('#name-input').value || localName));
$('#name-input').value = localName;
setPlayerName(localName, false);
if (returningPlayer) startGame(localName);

$('#chat-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const input = $('#chat-input'); const text = input.value.trim(); if (!text) return;
  if (connection?.readyState === WebSocket.OPEN) send({ type: 'chat', text });
  else { addChat(localName, text, 'self'); bubble(localAvatar, text, 2.3); }
  input.value = ''; input.blur();
});

function bindPanelToggle(buttonId, panelId) {
  const button = $(`#${buttonId}`);
  const panel = $(`#${panelId}`);
  button.addEventListener('click', () => {
    const isOpen = panel.hidden;
    panel.hidden = !isOpen;
    button.setAttribute('aria-expanded', String(isOpen));
    button.setAttribute('aria-label', `${isOpen ? 'Hide' : 'Show'} ${buttonId === 'chat-toggle' ? 'campus chat' : 'students nearby'}`);
    button.classList.toggle('active', isOpen);
  });
}

bindPanelToggle('chat-toggle', 'campus-chat');
bindPanelToggle('neighbors-toggle', 'neighbors-panel');
$('#presence-pill')?.addEventListener('click', () => $('#neighbors-toggle').click());

document.querySelectorAll('.dock-action').forEach((button) => button.addEventListener('click', () => {
  const action = button.dataset.action;
  if (action === 'wave') addActionEmote('👋');
  if (action === 'emote') {
    const emotes = ['😊', '💛', '✨', '🎉', '🌱']; const emote = emotes[actionEmoteIndex++ % emotes.length];
    addActionEmote(emote); showToast(`A little ${emote} for the island`);
  }
  if (action === 'map') {
    $('#map-panel').classList.toggle('visible');
  }
  if (action === 'camera') cameraController.cycle();
  if (action === 'help') showToast('WASD walk · Shift sprint · Space jump · Scroll / pinch / + - to zoom · Drag to orbit · F camera · M map · E interact · Esc pause');
}));

$('#event-card').addEventListener('click', () => {
  enterZone('stage');
  const pop = $('#minimap-popover'); if (pop) pop.hidden = true;
  $('#minimap-expand')?.setAttribute('aria-expanded', 'false');
});
$('#map-close').addEventListener('click', () => $('#map-panel').classList.remove('visible'));
document.querySelectorAll('[data-map-place]').forEach((button) => button.addEventListener('click', () => {
  enterZone(button.dataset.mapPlace); $('#map-panel').classList.remove('visible');
}));
$('#map-search').addEventListener('input', (event) => {
  const query = event.target.value.trim().toLocaleLowerCase();
  document.querySelectorAll('.map-point').forEach((point) => {
    const place = CAMPUS_PLACES.find((item) => item.id === point.dataset.mapPlace);
    point.classList.toggle('filtered-out', Boolean(query) && !`${place.title} ${place.district} ${place.subtitle}`.toLocaleLowerCase().includes(query));
  });
});
const mapCanvas = $('#map-canvas');
const miniMap = $('#mini-map');
let mapZoom = 1; let mapPanX = 0; let mapPanY = 0; let mapPointer = null; let mapClickSuppressed = false;
mapCanvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  mapZoom = THREE.MathUtils.clamp(mapZoom - event.deltaY * 0.001, 0.82, 1.85);
  mapCanvas.style.setProperty('--map-zoom', mapZoom);
}, { passive: false });
mapCanvas.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  mapPointer = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
});
mapCanvas.addEventListener('pointermove', (event) => {
  if (!mapPointer || mapPointer.id !== event.pointerId) return;
  const dx = event.clientX - mapPointer.x; const dy = event.clientY - mapPointer.y;
  if (!mapPointer.moved && Math.hypot(dx, dy) > 5) {
    mapPointer.moved = true;
    mapCanvas.classList.add('dragging');
    mapCanvas.setPointerCapture?.(event.pointerId);
  }
  if (mapPointer.moved) {
    mapPanX = THREE.MathUtils.clamp(mapPanX + dx, -miniMap.clientWidth * 0.36, miniMap.clientWidth * 0.36);
    mapPanY = THREE.MathUtils.clamp(mapPanY + dy, -miniMap.clientHeight * 0.36, miniMap.clientHeight * 0.36);
    mapCanvas.style.setProperty('--map-pan-x', `${mapPanX}px`);
    mapCanvas.style.setProperty('--map-pan-y', `${mapPanY}px`);
  }
  mapPointer.x = event.clientX; mapPointer.y = event.clientY;
});
function finishMapPointer(event) {
  if (!mapPointer || mapPointer.id !== event.pointerId) return;
  if (mapPointer.moved) {
    mapClickSuppressed = true;
    window.setTimeout(() => { mapClickSuppressed = false; }, 0);
  }
  mapPointer = null;
  mapCanvas.classList.remove('dragging');
}
mapCanvas.addEventListener('pointerup', finishMapPointer);
mapCanvas.addEventListener('pointercancel', finishMapPointer);
mapCanvas.addEventListener('click', (event) => {
  if (mapClickSuppressed) { event.preventDefault(); event.stopPropagation(); }
}, true);
$('#voice-button').addEventListener('click', () => showToast('Campus lounge is on its way. Say hello in campus chat for now 💛'));
$('#invite-button').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(window.location.href); showToast('Campus link copied — invite a classmate ✨'); }
  catch { showToast('Share this campus link with someone who’d love it ✨'); }
});
$('#profile-open').addEventListener('click', (event) => {
  event.stopPropagation();
  $('#profile-popover').classList.toggle('visible');
  const field = $('#profile-name-input');
  if (field) { field.value = localName; }
});
const profileNameForm = $('#profile-name-form');
if (profileNameForm) {
  profileNameForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = $('#profile-name-input').value;
    setPlayerName(value);
    showToast(`You’re now known as ${localName} ✨`);
  });
  $('#profile-name-input').addEventListener('input', (event) => {
    // Live preview while typing, saved on Save/Enter.
    const preview = event.target.value.trim().slice(0, 18) || localName;
    $('#popover-name').textContent = preview;
    $('#popover-initial').textContent = preview.slice(0, 1).toUpperCase();
  });
}
function chooseAvatarColor(color) {
  localColor = color; localStorage.setItem('wc_color', color);
  // Uniform is fixed; the chosen colour drives the lanyard accent instead.
  localAvatar.userData.accent.color.set(color);
  localAvatar.userData.shirtColor = color;
  const badge = $('#profile-initial'); if (badge) badge.style.background = color;
  const bigBadge = $('#popover-initial'); if (bigBadge) bigBadge.style.background = color;
  send({ type: 'join', name: localName, color });
  document.querySelectorAll('.color-swatch').forEach((button) => button.classList.toggle('chosen', button.dataset.color === color));
}
const colorPicker = $('#avatar-colors');
for (const color of avatarPalette) {
  const button = document.createElement('button'); button.type = 'button'; button.className = 'color-swatch';
  button.dataset.color = color; button.style.setProperty('--swatch', color); button.setAttribute('aria-label', `Lanyard accent ${color}`);
  button.addEventListener('click', () => chooseAvatarColor(color)); colorPicker.append(button);
}
chooseAvatarColor(localColor);
document.addEventListener('click', (event) => {
  if (!event.target.closest('#profile-open') && !event.target.closest('#profile-popover')) $('#profile-popover').classList.remove('visible');
});

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let pinchStart = null;
let pointerDrag = null;
const activePointers = new Map();
function moveToScreenPoint(clientX, clientY) {
  if (!isPlaying) return;
  pointer.set(clientX / window.innerWidth * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const surface = scene.children.find((object) => object.userData.walkSurface);
  const hit = raycaster.intersectObject(surface, false)[0];
  if (!hit) return;
  const pointOnIsland = clampCampusPoint(hit.point.x, hit.point.z, 0.85);
  const walkable = nearestWalkablePoint(pointOnIsland.x, pointOnIsland.z);
  setWaypoint(new THREE.Vector3(walkable.x, islandTop, walkable.z));
  activeZone = getPlaceForPosition(walkable.x, walkable.z);
  document.querySelectorAll('.place-card').forEach((button) => button.classList.toggle('selected', button.dataset.place === activeZone));
  document.querySelectorAll('.map-point').forEach((button) => button.classList.toggle('selected', button.dataset.mapPlace === activeZone));
}

renderer.domElement.addEventListener('pointerdown', (event) => {
  if (event.pointerType === 'touch') activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (activePointers.size >= 2) {
    const [a, b] = [...activePointers.values()];
    pinchStart = Math.hypot(a.x - b.x, a.y - b.y);
    pointerDrag = null;
    return;
  }
  if (event.button === 2 || event.button === 1) pointerDrag = { id: event.pointerId, x: event.clientX, y: event.clientY, mode: 'orbit', moved: false };
  else if (event.button === 0) pointerDrag = { id: event.pointerId, x: event.clientX, y: event.clientY, mode: cameraController.mode === 'free' ? 'pan' : 'tap', moved: false };
  renderer.domElement.setPointerCapture?.(event.pointerId);
});
renderer.domElement.addEventListener('contextmenu', (event) => event.preventDefault());
renderer.domElement.addEventListener('wheel', (event) => {
  event.preventDefault(); cameraController.zoom(event.deltaY);
}, { passive: false });
renderer.domElement.addEventListener('pointermove', (event) => {
  if (activePointers.has(event.pointerId)) activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (activePointers.size >= 2 && pinchStart) {
    const [a, b] = [...activePointers.values()];
    const distance = Math.hypot(a.x - b.x, a.y - b.y);
    cameraController.pinch(distance / pinchStart);
    pinchStart = distance;
    return;
  }
  if (!pointerDrag || pointerDrag.id !== event.pointerId) return;
  const dx = event.clientX - pointerDrag.x; const dy = event.clientY - pointerDrag.y;
  pointerDrag.x = event.clientX; pointerDrag.y = event.clientY;
  if (!pointerDrag.moved && Math.hypot(dx, dy) > 6) {
    pointerDrag.moved = true;
    if (pointerDrag.mode === 'tap') pointerDrag.mode = cameraController.mode === 'free' ? 'pan' : 'orbit';
  }
  if (pointerDrag.moved) {
    if (pointerDrag.mode === 'pan') cameraController.pan(dx, dy, window.innerHeight);
    else if (pointerDrag.mode === 'orbit') cameraController.orbit(dx, dy);
  }
});
function finishPointer(event) {
  const drag = pointerDrag;
  if (drag?.id === event.pointerId && drag.mode === 'tap' && !drag.moved && activePointers.size < 2) moveToScreenPoint(event.clientX, event.clientY);
  activePointers.delete(event.pointerId);
  if (drag?.id === event.pointerId) pointerDrag = null;
  if (activePointers.size < 2) pinchStart = null;
}
renderer.domElement.addEventListener('pointerup', finishPointer);
renderer.domElement.addEventListener('pointercancel', finishPointer);

const keys = new Set();
const localVelocity = new THREE.Vector3();
let jumpVelocity = 0;
let jumpHeight = 0;
let isPaused = false;
function setPaused(paused) {
  isPaused = paused;
  $('#pause-modal').classList.toggle('visible', paused);
  $('#pause-modal').setAttribute('aria-hidden', String(!paused));
  if (paused) { keys.clear(); setWaypoint(null); }
}
$('#resume-button').addEventListener('click', () => setPaused(false));
window.addEventListener('keydown', (event) => {
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable) return;
  const key = event.key.toLowerCase();
  if (event.repeat && [' ', 'f', 'm', 'escape', 'e'].includes(key)) return;
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(key)) { keys.add(key); event.preventDefault(); }
  if (key === 'escape' && isPlaying) { event.preventDefault(); setPaused(!isPaused); }
  if (key === 'f' && isPlaying) cameraController.cycle();
  if (key === 'm' && isPlaying) $('#map-panel').classList.toggle('visible');
  if ((key === '=' || key === '+') && isPlaying) cameraController.zoom(-120);
  if ((key === '-' || key === '_') && isPlaying) cameraController.zoom(120);
  if (key === 'e' && isPlaying && !isPaused) {
    if (seatedState) standUp();
    else if (seatPrompt) sitDown(seatPrompt);
    else if (currentPrompt) interactWithZone();
  }
  if (key === ' ' && isPlaying) { event.preventDefault(); if (jumpHeight === 0 && !isPaused) jumpVelocity = 8.2; }
});
window.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());

function updateLocal(delta) {
  if (!isPlaying || isPaused) { localVelocity.set(0, 0, 0); return; }
  if (seatedState) {
    localVelocity.set(0, 0, 0);
    enforceSitPose();
    updateInteractionHint();
    updateMapPlayer(localAvatar.position);
    return;
  }
  const strafe = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
  const forward = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
  const cameraYaw = cameraController.yaw;
  const direction = new THREE.Vector3(
    Math.cos(cameraYaw) * strafe - Math.sin(cameraYaw) * forward,
    0,
    -Math.sin(cameraYaw) * strafe - Math.cos(cameraYaw) * forward,
  );
  if (direction.lengthSq() > 0) { direction.normalize(); setWaypoint(null); }
  else if (currentTarget) {
    const difference = new THREE.Vector3().subVectors(currentTarget, localAvatar.position); difference.y = 0;
    if (difference.length() > 0.13) {
      direction.copy(difference.normalize());
    } else setWaypoint(null);
  }
  const movingInput = direction.lengthSq() > 0;
  const speed = keys.has('shift') ? 8.2 : 5.25;
  const desiredVelocity = movingInput ? direction.multiplyScalar(speed) : new THREE.Vector3();
  const acceleration = movingInput ? 21 : 25;
  localVelocity.lerp(desiredVelocity, 1 - Math.exp(-acceleration * delta));

  const nextX = clampCampusX(localAvatar.position.x + localVelocity.x * delta, localAvatar.position.z);
  if (!collidesWithBuilding(nextX, localAvatar.position.z)) localAvatar.position.x = nextX;
  else localVelocity.x = 0;
  const nextZ = clampCampusZ(localAvatar.position.z + localVelocity.z * delta, localAvatar.position.x);
  if (!collidesWithBuilding(localAvatar.position.x, nextZ)) localAvatar.position.z = nextZ;
  else localVelocity.z = 0;

  if (movingInput) {
    const targetYaw = Math.atan2(direction.x, direction.z);
    const yawDelta = Math.atan2(Math.sin(targetYaw - localAvatar.rotation.y), Math.cos(targetYaw - localAvatar.rotation.y));
    localAvatar.rotation.y += yawDelta * Math.min(1, delta * 11);
  }
  if (jumpVelocity !== 0 || jumpHeight > 0) {
    jumpVelocity -= 22 * delta;
    jumpHeight += jumpVelocity * delta;
    if (jumpHeight <= 0) { jumpHeight = 0; jumpVelocity = 0; }
  }
  localAvatar.position.y = islandTop + jumpHeight;
  localAvatar.position.x = clampCampusX(localAvatar.position.x, localAvatar.position.z);
  localAvatar.position.z = clampCampusZ(localAvatar.position.z, localAvatar.position.x);
  const walking = localVelocity.lengthSq() > 0.05;
  const t = performance.now() * 0.012;
  localAvatar.userData.torso.position.y = 1.43 + (walking ? Math.abs(Math.sin(t * (keys.has('shift') ? 1.28 : 1))) * 0.065 : Math.sin(t * 0.5) * 0.018);
  localAvatar.userData.legs.forEach((leg, i) => { leg.rotation.x = walking ? Math.sin(t + i * Math.PI) * 0.48 : 0; });
  localAvatar.userData.arms.forEach((arm, i) => {
    arm.rotation.x = walking ? Math.sin(t + i * Math.PI + Math.PI) * 0.38 : 0;
    if (localAvatar.userData.waving > 0 && i === 1) { arm.rotation.x = -1.55; arm.rotation.z = -0.72; }
  });
  if (localAvatar.userData.waving > 0) localAvatar.userData.waving -= delta;

  const now = performance.now();
  const movingChanged = Boolean(localAvatar.userData.moving) !== walking;
  const jumpChanged = Boolean(localAvatar.userData.jumping) !== (jumpHeight > 0.02);
  if (connection?.readyState === WebSocket.OPEN && now - lastMoveSent > 90 && (localAvatar.position.distanceTo(lastMove) > 0.22 || movingChanged || jumpChanged)) {
    send({ type: 'move', x: Number(localAvatar.position.x.toFixed(2)), z: Number(localAvatar.position.z.toFixed(2)), look: Number(localAvatar.rotation.y.toFixed(2)), moving: walking, jumping: jumpHeight > 0.02 });
    lastMove.copy(localAvatar.position); lastMoveSent = now;
    localAvatar.userData.moving = walking;
    localAvatar.userData.jumping = jumpHeight > 0.02;
  }
  updateInteractionHint();
  updateMapPlayer(localAvatar.position);
}

function updateInteractionHint() {
  const hint = $('#interaction-hint');
  if (seatedState) {
    currentPrompt = null; seatPrompt = null;
    hint.querySelector('small').textContent = 'to stand up'; hint.classList.add('visible');
    return;
  }
  let nearest = null; let nearestD = SIT_DISTANCE;
  for (const seat of seats) {
    const d = Math.hypot(localAvatar.position.x - seat.x, localAvatar.position.z - seat.z);
    if (d < nearestD) { nearest = seat; nearestD = d; }
  }
  seatPrompt = nearest;
  const distances = Object.entries(zonePositions).map(([place, point]) => [place, Math.hypot(localAvatar.position.x - point.x, localAvatar.position.z - point.z)]);
  const [place, distance] = distances.sort((a, b) => a[1] - b[1])[0];
  const placeConfig = CAMPUS_PLACES.find((item) => item.id === place);
  if (activeZone !== place) {
    activeZone = place;
    document.querySelectorAll('.place-card').forEach((button) => button.classList.toggle('selected', button.dataset.place === place));
    document.querySelectorAll('.map-point').forEach((button) => button.classList.toggle('selected', button.dataset.mapPlace === place));
  }
  if (seatPrompt) {
    currentPrompt = null;
    hint.querySelector('small').textContent = 'to sit down'; hint.classList.add('visible');
    return;
  }
  if (distance < placeConfig.interactionRadius) {
    currentPrompt = place;
    const labels = { library: 'Visit the library', ccso: 'Attend class at CCSO', cafe: 'Grab a seat at the commons', sports: 'Play a pickleball match', park: 'Take a quiet moment', stage: 'See what’s on', residence: 'Visit the residence hall', transit: 'Check the campus shuttle' };
    hint.querySelector('small').textContent = labels[place]; hint.classList.add('visible');
  } else { currentPrompt = null; hint.classList.remove('visible'); }
}

function interactWithZone() {
  const actions = {
    library: ['Find a sunny seat and settle in 📚', 'Every big idea needs a first page ✨'],
    ccso: ['Welcome to the CCSO Building 🖥️', 'Class is in session — come on in ✨'],
    cafe: ['You found a seat at the commons ☕', 'Fresh coffee, fresh conversation 🌼'],
    sports: ['The next pickleball match is yours 🏓', 'Grab a paddle and rally 🏓'],
    park: ['Take a deep breath between classes 🌿', 'A little green goes a long way 🌱'],
    stage: ['The campus mixer starts soon 🎶', 'Every good gathering starts with you ✨'],
    residence: ['Welcome home to the residence hall 🏡', 'The courtyard is a lovely place to meet 🌿'],
    transit: ['The campus shuttle is ready when you are 🚌', 'Your next adventure starts at the station ✨'],
  };
  const line = actions[currentPrompt]?.[Math.floor(Math.random() * actions[currentPrompt].length)] || 'Come on in!';
  showToast(line); bubble(localAvatar, line, 2.6);
  send({ type: 'interact', place: currentPrompt });
}

function enforceSitPose() {
  localAvatar.userData.legs.forEach((leg) => { leg.rotation.x = -1.5; });
  localAvatar.userData.arms.forEach((arm, i) => { arm.rotation.x = i === 1 ? -0.5 : -0.35; arm.rotation.z = 0; });
  localAvatar.userData.torso.position.y = 1.43;
}

function sitDown(seat) {
  setWaypoint(null); keys.clear();
  seatedState = seat;
  seatPrompt = null;
  jumpHeight = 0; jumpVelocity = 0;
  localVelocity.set(0, 0, 0);
  localAvatar.position.set(seat.x, islandTop, seat.z);
  localAvatar.rotation.y = seat.rotY;
  enforceSitPose();
  updateInteractionHint();
  showToast('Taking a seat — press E to stand up 🌿');
}

function standUp() {
  if (!seatedState) return;
  const fx = Math.sin(seatedState.rotY); const fz = Math.cos(seatedState.rotY);
  const spot = nearestWalkablePoint(seatedState.x + fx * 1.0, seatedState.z + fz * 1.0);
  localAvatar.position.set(spot.x, islandTop, spot.z);
  seatedState = null;
  jumpHeight = 0; jumpVelocity = 0;
  localAvatar.userData.legs.forEach((leg) => { leg.rotation.x = 0; });
  localAvatar.userData.arms.forEach((arm) => { arm.rotation.x = 0; arm.rotation.z = 0; });
  updateInteractionHint();
}

$('#interaction-hint').addEventListener('click', () => {
  if (seatedState) standUp();
  else if (seatPrompt) sitDown(seatPrompt);
  else interactWithZone();
});

function updateRemotes(delta) {
  for (const remote of remotes.values()) {
  remote.avatar.position.lerp(remote.target, Math.min(1, delta * 8));
    const difference = Math.atan2(Math.sin(remote.targetYaw - remote.avatar.rotation.y), Math.cos(remote.targetYaw - remote.avatar.rotation.y));
    remote.avatar.rotation.y += difference * Math.min(1, delta * 7);
    const moving = remote.moving || remote.avatar.position.distanceTo(remote.target) > 0.12;
    remote.avatar.position.y = islandTop + (remote.jumping ? 0.32 : 0);
    const phase = performance.now() * 0.012 + remote.avatar.userData.phase;
    remote.avatar.userData.torso.position.y = 1.43 + (moving ? Math.abs(Math.sin(phase)) * 0.055 : Math.sin(phase * 0.5) * 0.015);
    remote.avatar.userData.legs.forEach((leg, i) => { leg.rotation.x = moving ? Math.sin(phase + i * Math.PI) * 0.42 : 0; });
  }
  if (remotes.size && performance.now() - lastNeighborRender > 900) {
    lastNeighborRender = performance.now(); renderNeighbors();
  }
}

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.04);
  updateLocal(delta); updateRemotes(delta);
  cameraController.update(delta);
  const now = performance.now();
  for (const avatar of [localAvatar, ...[...remotes.values()].map((entry) => entry.avatar)]) {
    if (avatar.userData.bubble && now > avatar.userData.bubbleEnd) { avatar.remove(avatar.userData.bubble); avatar.userData.bubble.material.map.dispose(); avatar.userData.bubble.material.dispose(); avatar.userData.bubble = null; }
  }
  renderer.render(scene, camera);
}
animate();
