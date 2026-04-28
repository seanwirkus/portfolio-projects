/* ─────────────────────────────────────────────────────────────
   Vision Lab — simulator for the FreewayFrenzy hardware reused
   as a real-world driver-assist vision stack.

   Architecture mirrors the actual build:
     ESP32-C3 (sensor fusion)  →  UART  →  ESP32-S3 (render)
   The "packet" emitted to the HUD canvas is the same contract
   that will go over the wire when this is flashed.
   ───────────────────────────────────────────────────────────── */

const hud   = document.getElementById('hud');
const scene = document.getElementById('scene');
const hudCtx   = hud.getContext('2d');
const sceneCtx = scene.getContext('2d');

/* ── Theme: toggled by the day/night button in the UI ─────── */
let DARK_MODE = false;
const THEME = {
  get sky()    { return DARK_MODE ? '#020617'  : '#bae6fd'; },
  get ground() { return DARK_MODE ? '#0a0420'  : '#b7e4c7'; },
  get road()   { return DARK_MODE ? '#0d0628'  : '#5a6475'; },
  get horizon(){ return DARK_MODE ? '#22d3ee'  : '#0891b2'; },
  get sceneBg(){ return DARK_MODE ? '#111827'  : '#b7e4c7'; },
  get sceneRoad(){ return DARK_MODE ? '#1e293b' : '#64748b'; },
};

const fpsEl = document.getElementById('hudFps');
const distVal = document.getElementById('distVal');
const distState = document.getElementById('distState');
const detList = document.getElementById('detList');
const decisionVal = document.getElementById('decisionVal');
const decisionReason = document.getElementById('decisionReason');
const ttcVal = document.getElementById('ttcVal');
const sparkCv = document.getElementById('spark');
const sparkCtx = sparkCv.getContext('2d');
const txRateEl = document.getElementById('txRate');
const lastPacketEl = document.getElementById('lastPacket');

/* ── World coordinate system ─────────────────────────────────
   Real units (feet). Ego car sits at world origin, camera mounted
   at the dash height looking forward (+Y). Lanes match US standard
   so cars actually *fit* — 12 ft lane vs ~6 ft car.              */
const WORLD = {
  forwardM: 50,           // Render the HUD canvas up to 50 feet
  halfWidthM: 14,         // Tightened lateral bounds (was 26)
  laneCount: 1,           // Single lane (removes lane markers automatically)
  laneWidthM: 16,         // Less wide road, focus on ego path (was 12*3=36)
  shoulderM: 3,
  carWidthM: 6.2,
  fovDeg: 100,            // narrowed to reduce edge distortion
  verticalFovDeg: 84,     // drastically taller to show more road directly in front
  cameraHeightM: 2.2,     // Lowered to grille height (~2.2 ft)
  cameraPitchRad: 0.05,   // Adjusted pitch slightly upward since we are lower
  cameraOffsetM: -5.0,    // Shifted forward 5 ft to bring objects visually closer while keeping math identical
  hudDepthScale: 1.0,
  lidarRangeM: 50.0,      // Sensor view matches render distance at 50 feet
  lidarMinM: 0.3,
  sensorOffsetM: 1.1,     // Physical distance from ego sensor to actual front bumper (zero it at 1.1ft)
};
WORLD.roadHalfM = (WORLD.laneCount * WORLD.laneWidthM) / 2;

(function syncSceneFovPill() {
  const el = document.getElementById('scenePill');
  if (el) el.textContent = `CAMERA FOV ${WORLD.fovDeg}°`;
})();

/* Scene editor view extents — larger than the detection world so
   objects render at a realistic, proportional size in the top-down view. */
const SCENE_VIEW = {
  halfWidthM: 20,   // zoomed in laterally (was 52) to match narrower road
  forwardM: 72,     // 72 ft forward
  rearM: 36,        // 36 ft behind the front bumper so the ego car is visible and text clears toolbar
};

/* Per-class palette and real-world dimensions. */
const CAR_PALETTE = [
  { name: 'Metallic Silver', body: '#e2e8f0', roof: '#94a3b8' },
  { name: 'Graphite',        body: '#64748b', roof: '#334155' },
  { name: 'Midnight Blue',   body: '#1e3a8a', roof: '#172554' },
  { name: 'Crimson',         body: '#be123c', roof: '#881337' },
  { name: 'Pearl White',     body: '#f8fafc', roof: '#cbd5e1' },
  { name: 'Jet Black',       body: '#0f172a', roof: '#020617' },
  { name: 'Champagne',       body: '#d6d3d1', roof: '#a8a29e' },
  { name: 'Deep Forest',     body: '#115e59', roof: '#042f2e' },
];
const CLASSES = {
  car:   { name: 'CAR',           color: '#22d3ee', real: { w: 6.2, h: 15 } },
  stop:  { name: 'STOP_SIGN',     color: '#f43f5e', real: { w: 2, h: 2 } },
  light: { name: 'TRAFFIC_LIGHT', color: '#facc15', real: { w: 1, h: 2.4 } },
  ped:   { name: 'PEDESTRIAN',    color: '#a78bfa', real: { w: 1.8, h: 5.6 } },
};

/* Props placed in the world. For cars, yM is the range to the rear bumper,
   because that is the distance a forward LiDAR/camera would report. */
let nextId = 1;
let props = [
  { id: nextId++, type: 'car',  xM: parkedCarX(1),  yM: 58, color: 1, parked: true },
  { id: nextId++, type: 'stop', xM: 12.4,  yM: 72 },
];

const EGO = {
  xM: 0,
  speedMps: 0,
  travelM: 0,
  maxSpeedMps: 45,
  accelMps2: 18,
  brakeMps2: 24,
  dragMps2: 4,
  steerMps: 11,
  steerCmd: 0,
  steerResponse: 7.5,
};
const driveKeys = { left: false, right: false, up: false, down: false };

function drivableLateralLimit() {
  return Math.max(
    1,
    Math.min(
      WORLD.halfWidthM - WORLD.carWidthM / 2 - 0.35,
      WORLD.roadHalfM + WORLD.shoulderM - WORLD.carWidthM / 2 - 0.15
    )
  );
}

function parkedCarX(seedX = 1) {
  const side = seedX < 0 ? -1 : 1;
  const carHalfW = (CLASSES.car.real.w || WORLD.carWidthM) / 2;
  const shoulderEdge = WORLD.roadHalfM + WORLD.shoulderM - carHalfW - 0.25;
  const worldEdge = WORLD.halfWidthM - carHalfW - 0.2;
  return side * Math.max(0, Math.min(shoulderEdge, worldEdge));
}

function keepParkedCarOutsideLane(prop, xM) {
  if (!prop || prop.type !== 'car' || !prop.parked) return xM;
  const sign = Math.sign(xM || prop.xM || 1) || 1;
  const carHalfW = (CLASSES.car.real.w || WORLD.carWidthM) / 2;
  const laneEdgeSafe = WORLD.roadHalfM - carHalfW + 1.2;
  const shoulderEdge = WORLD.roadHalfM + WORLD.shoulderM - carHalfW - 0.2;
  const worldEdge = WORLD.halfWidthM - carHalfW - 0.2;
  const minAbs = Math.max(0, laneEdgeSafe);
  const maxAbs = Math.max(minAbs, Math.min(shoulderEdge, worldEdge));
  const clampedAbs = Math.max(minAbs, Math.min(maxAbs, Math.abs(xM)));
  return sign * clampedAbs;
}

/* Ensure any dragged prop leaves a passable gap for the ego car.
   The ego car is WORLD.carWidthM wide; we need at least
   egoHalf + 0.6 ft of clearance on one side of the prop. */
function clampPropForPassableGap(prop, xM) {
  const dims = REAL_DIMS[prop.type] || CLASSES[prop.type]?.real || { w: 2 };
  const propHalfW = (dims.w || 2) / 2;
  const egoHalfW = WORLD.carWidthM / 2;
  const minGap = egoHalfW + propHalfW + 1.0; // 1 ft breathing room
  const roadEdge = WORLD.halfWidthM;

  // Check if placing at xM leaves enough room on at least one side
  const leftGap = (xM - propHalfW) + roadEdge;    // space to the left road edge
  const rightGap = roadEdge - (xM + propHalfW);     // space to the right road edge
  const egoPassWidth = egoHalfW * 2 + 0.8;          // ego width + small margin

  // If neither side has enough room, push prop toward whichever side has more room
  if (leftGap < egoPassWidth && rightGap < egoPassWidth) {
    const sign = Math.sign(xM) || 1;
    // Push far enough that one side opens up
    xM = sign * (roadEdge - propHalfW - egoPassWidth + 0.2);
    xM = Math.max(-roadEdge + propHalfW + 0.3, Math.min(roadEdge - propHalfW - 0.3, xM));
  }
  return xM;
}

let dragging = null;        // { prop, offX, offY } when mouse-dragging existing
let spawning = null;        // { type } when dragging from toolbar
let mouseScene = { x: 0, y: 0, in: false };

/* ── Canvas sizing ─────────────────────────────────────────── */
function fit(cv) {
  const dpr = window.devicePixelRatio || 1;
  const r = cv.getBoundingClientRect();
  cv.width  = Math.floor(r.width * dpr);
  cv.height = Math.floor(r.height * dpr);
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w: r.width, h: r.height };
}
let HUD_W, HUD_H, SC_W, SC_H, SP_W, SP_H;
function fitAll() {
  ({ w: HUD_W, h: HUD_H } = fit(hud));
  ({ w: SC_W,  h: SC_H  } = fit(scene));
  ({ w: SP_W,  h: SP_H  } = fit(sparkCv));
}
window.addEventListener('resize', fitAll);
fitAll();

/* ── Scene → world coordinate mapping ──────────────────────── */
function sceneToWorld(px, py) {
  const xM = (px / SC_W - 0.5) * 2 * SCENE_VIEW.halfWidthM;
  const totalY = SCENE_VIEW.forwardM + SCENE_VIEW.rearM;
  const yM = (1 - py / SC_H) * totalY - SCENE_VIEW.rearM;
  return { xM, yM };
}
function worldToScene(xM, yM) {
  const px = (xM / (2 * SCENE_VIEW.halfWidthM) + 0.5) * SC_W;
  const totalY = SCENE_VIEW.forwardM + SCENE_VIEW.rearM;
  const py = (1 - (yM + SCENE_VIEW.rearM) / totalY) * SC_H;
  return { px, py };
}

/* ── HUD projection — proper pinhole camera ─────────────────
   World axes: x = lateral (right +), y = forward (+), z = up.
   Camera at (0, 0, cameraHeightM), looking along +y, slight pitch.
   For a point on the ground (z=0) at world (xM, yM, 0):

       focalX_px = (HUD_W / 2) / tan(horizontal_fov/2)
       focalY_px = (HUD_H / 2) / tan(vertical_fov/2)
       screenX   = HUD_W/2 + focalX_px * (x / distance)
       screenY   = horizon + focalY_px * (cameraHeight / distance)

   The math is unitless; WORLD values are feet for this simulator. */
function hudFocalXPx() {
  return (HUD_W / 2) / Math.tan((WORLD.fovDeg * Math.PI / 180) / 2);
}
function hudFocalYPx() {
  return (HUD_H / 2) / Math.tan((WORLD.verticalFovDeg * Math.PI / 180) / 2);
}
function hudHorizonY() {
  // Slight downward pitch nudges the horizon up the screen.
  return HUD_H * 0.5 - hudFocalYPx() * Math.tan(WORLD.cameraPitchRad);
}
function hudProject(xM, yM, zM = 0) {
  // If the object's back edge is passing through the camera pane, still project the visible front segment!
  const distWithOffset = yM + WORLD.cameraOffsetM;
  if (distWithOffset <= -10) return null; // Only cull if it is truly incredibly far behind the camera.
  
  // Cap the focal division to prevent infinite sizes right on the camera plane
  const safeDist = Math.max(0.1, distWithOffset);
  
  const fx = hudFocalXPx();
  const fy = hudFocalYPx();
  const horizon = hudHorizonY();
  const visualY = safeDist * WORLD.hudDepthScale;
  const screenX = HUD_W / 2 + fx * (xM / visualY);
  const screenY = horizon + fy * ((WORLD.cameraHeightM - zM) / visualY);
  return {
    x: screenX,
    y: screenY,
    pxPerM: fy / visualY,
    pxPerMX: fx / visualY,
    depth: yM / WORLD.forwardM,
    yM,
  };
}

/* ── Detection model ────────────────────────────────────────
   For each prop in the camera FOV cone, emit a detection with
   class, world position, range, and a fake confidence that
   decays gracefully with distance + lateral offset.            */
function fovHalfRad() { return (WORLD.fovDeg * Math.PI / 180) / 2; }
function inFov(p) {
  const xRelM = p.xM - EGO.xM;
  const yRelM = p.yM;
  
  // Calculate to the rear bumper to allow it to clip seamlessly out of frame when passing
  const dims = REAL_DIMS[p.type] || { w: 1, l: 1 };
  const lengthM = dims.l || dims.w || 1;
  const rearY = p.yM - (lengthM / 2);
  
  // They are considered 'in FOV' even if they slide fully behind the camera, up to half its length back, so they don't pop off screen early
  // Camera offset is dynamically handled inside the HUD projection, but for detecting visibility we add it back.
  if (p.yM < -lengthM) return false;
  
  // Provide a 25% overlap margin so objects render completely if they even partially touch the FOV line.
  // Ensure the FOV maintains at least the width of the car when objects clip behind the virtual camera offset.
  const projY = Math.max(0.1, yRelM + WORLD.cameraOffsetM);
  let halfWidthAtDepth = Math.tan(fovHalfRad()) * projY;
  halfWidthAtDepth = Math.max(WORLD.carWidthM / 2, halfWidthAtDepth);
  
  return Math.abs(xRelM) <= halfWidthAtDepth * 1.25 && yRelM <= WORLD.forwardM;
}

function hudEdgeGhostProp(p) {
  const xRelM = p.xM - EGO.xM;
  const yRelM = p.yM;
  const dims = REAL_DIMS[p.type] || { w: 1, l: 1 };
  const lengthM = dims.l || dims.w || 1;
  if (p.yM < -lengthM || yRelM > WORLD.forwardM) return null;
  
  const projY = Math.max(0.1, yRelM + WORLD.cameraOffsetM);
  let halfWidthAtDepth = Math.tan(fovHalfRad()) * projY;
  halfWidthAtDepth = Math.max(WORLD.carWidthM / 2, halfWidthAtDepth);

  if (!isFinite(halfWidthAtDepth) || halfWidthAtDepth <= 0.01) return null;
  
  // With 25% overlap margin for solid rendering, the ghosting only starts beyond that
  if (Math.abs(xRelM) <= halfWidthAtDepth * 1.25) return null;
  
  const sideOverflowM = Math.abs(xRelM) - (halfWidthAtDepth * 1.25);
  const sideNorm = Math.min(1, sideOverflowM / Math.max(1.2, WORLD.laneWidthM * 0.7));
  const depthNorm = Math.min(1, yRelM / WORLD.forwardM);
  
  // Exaggerate their exit speed outward
  const edgeSlideM = WORLD.laneWidthM * (0.02 + sideNorm * 0.15);
  
  const depthFade = 1 - depthNorm;
  const sideFade = 1 - sideNorm;
  return {
    ...p,
    xM: xRelM + Math.sign(xRelM) * edgeSlideM,
    yM: yRelM,
    ghostAlpha: 0.06 + depthFade * 0.22 + sideFade * 0.14,
    ghostLineAlpha: 0.12 + depthFade * 0.2 + sideFade * 0.1,
    ghostTextAlpha: 0.2 + depthFade * 0.22 + sideFade * 0.12,
    ghostBrightness: 0.68 + depthFade * 0.36,
    ghostSideNorm: sideNorm,
    ghostDepthNorm: depthNorm,
    ghostDistM: Math.hypot(xRelM, yRelM),
  };
}

function detectAll() {
  const out = [];
  for (const p of props) {
    if (!inFov(p)) continue;
    const xRelM = p.xM - EGO.xM;
    
    const dims = REAL_DIMS[p.type] || { w: 1, l: 1 };
    const lengthM = dims.l || dims.w || 1;
    // The rear license plate / rear bumper coordinate (longitudinally)
    const rearY = p.yM - (lengthM / 2);
    
    // Calculate distance simply based on how far AHEAD the object is on the road.
    // This perfectly matches driver intuition (a car in the next lane 0ft ahead is 0ft away, not a diagonal hypotenuse)
    // Apply sensor offset so 1.1 physical ft reads as 0ft at the bumper.
    const dist = Math.max(0, rearY - WORLD.sensorOffsetM);
    
    const cls = CLASSES[p.type];
    
    // Confidence: high near center + close, decays toward FOV edges + range.
    const angNorm = Math.atan2(Math.abs(xRelM), Math.max(0.1, rearY)) / fovHalfRad();
    const distNorm = Math.min(1, dist / WORLD.forwardM);
    const conf = Math.max(0.42, 0.98 - angNorm * 0.18 - distNorm * 0.35);
    out.push({ id: p.id, prop: p, class: cls.name, color: cls.color, distM: dist, xRelM, yRelM: p.yM, conf });
  }
  out.sort((a, b) => a.distM - b.distM);
  return out;
}

/* ── LiDAR (single-point ToF) ────────────────────────────────
   TFmini-S returns nearest distance along a narrow forward ray.
   We model a narrow beam: pick the nearest prop within a few inches
   lateral of the ray over its range. Add small jitter for feel. */
function lidarReading() {
  let nearest = Infinity;
  let hit = null;
  // Two sensors at each grille corner — matched to physical ego half-width
  const sensorOffset = WORLD.carWidthM / 2;
  const leftSensorX  = EGO.xM - sensorOffset;
  const rightSensorX = EGO.xM + sensorOffset;
  // Beam covers exactly the ego car's physical width — anything laterally outside
  // this is a shoulder object the ego will not hit.
  const beamHalfM = 0.3; // 0.3 ft slop for sensor mounting tolerance
  
  for (const p of props) {
    // We want the distance to the edge facing the sensor (the rear)
    const dims = REAL_DIMS[p.type] || { w: 1, l: 1 };
    const lengthM = dims.l || dims.w || 1;
    let rearY = p.yM - (lengthM / 2);
    const frontY = p.yM + (lengthM / 2);
    
    // If we are currently inside or overlapping the object, clamp the distance to 0 so it registers as an active collision.
    if (rearY < WORLD.lidarMinM && frontY > 0) {
      rearY = 0.0;
    }
    
    if (rearY < 0 || rearY > WORLD.lidarRangeM) continue;
    
    // Check if the prop falls within the beam of EITHER the left or right sensor
    const propLeftE = p.xM - (dims.w / 2);
    const propRightE = p.xM + (dims.w / 2);
    
    const leftSensorHit = (leftSensorX >= propLeftE - beamHalfM) && (leftSensorX <= propRightE + beamHalfM);
    const rightSensorHit = (rightSensorX >= propLeftE - beamHalfM) && (rightSensorX <= propRightE + beamHalfM);
    
    if (!leftSensorHit && !rightSensorHit) continue;
    
    if (rearY < nearest) { nearest = rearY; hit = p; }
  }
  if (!isFinite(nearest)) {
    return {
      distM: null,
      hit: null,
      raw: WORLD.lidarRangeM,
      xRelM: null,
      corridorHit: false,
    };
  }
  
  // Apply sensor physical offset so it zeroes out 1.1ft ahead of the sensor
  const d = nearest - WORLD.sensorOffsetM;
  
  // 1000 Hz sensor — add tiny jitter for realism.
  const jitter = (Math.random() - 0.5) * 0.015;
  const distM = nearest <= WORLD.sensorOffsetM ? 0 : Math.max(0, d + jitter);
  const xRelM = hit ? (hit.xM - EGO.xM) : null;
  const hitDims = hit ? (REAL_DIMS[hit.type] || { w: 1 }) : { w: 1 };
  const corridorHalf = WORLD.carWidthM / 2 + (hitDims.w || 1) / 2 + 0.35;
  const corridorHit = xRelM != null ? Math.abs(xRelM) < corridorHalf : false;
  return { distM, hit, raw: nearest, xRelM, corridorHit };
}

/* ── Decision logic ────────────────────────────────────────── */
function makeDecision(detections, lidar, dt) {
  // Track approach speed via simple history of lidar distance
  const now = lidar.distM;
  if (now != null && _lastLidar != null) {
    const inst = (_lastLidar - now) / dt; // ft/s, positive = approaching
    _approachMs = _approachMs * 0.75 + inst * 0.25;
  }
  if (now != null) _lastLidar = now;

  // Stop sign / red light → STOP only if sign is within the ego car's travel corridor
  const stopSignCorridorM = WORLD.carWidthM / 2 + 1.5; // shoulder signs outside this are ignored
  const stopSign = detections.find(d => d.class === 'STOP_SIGN' && d.distM < 15 && Math.abs(d.xRelM) < stopSignCorridorM);
  const redLight = detections.find(d => d.class === 'TRAFFIC_LIGHT' && d.prop.light === 'red' && d.distM < 18);
  if (stopSign) return { state: 'STOP', reason: `Stop sign ahead · ${stopSign.distM.toFixed(1)} ft`, color: '#f43f5e' };
  if (redLight) return { state: 'STOP', reason: `Red signal ahead · ${redLight.distM.toFixed(1)} ft`, color: '#f43f5e' };

  // Pedestrian in ego corridor only (ego half-width + ped half-width + comfort margin)
  const pedCorridorM = WORLD.carWidthM / 2 + REAL_DIMS.ped.w / 2 + 1.5;
  const ped = detections.find(d =>
    d.class === 'PEDESTRIAN' &&
    Math.abs(d.xRelM) < pedCorridorM &&
    d.distM < 38
  );
  if (ped) return { state: 'YIELD', reason: `Pedestrian · ${ped.distM.toFixed(1)} ft · corridor`, color: '#facc15' };

  // Forward car → check TTC from approach speed. Use camera detection OR raw lidar hit lock.
  const carCorridorM = WORLD.carWidthM / 2 + CLASSES.car.real.w / 2 + 0.35;
  const carAhead = detections.find(d => d.class === 'CAR' && Math.abs(d.xRelM) < carCorridorM) ||
    (lidar?.hit?.type === 'car' && lidar?.corridorHit ? { distM: lidar.distM, prop: lidar.hit } : null);
  if (carAhead && now != null && _approachMs > 0.4) {
    const ttc = now / _approachMs;
    if (ttc < 1.0) return { state: 'BRAKE', reason: `TTC ${ttc.toFixed(1)}s · car closing fast`, color: '#f43f5e' };
    if (ttc < 2.5) return { state: 'CAUTION', reason: `TTC ${ttc.toFixed(1)}s · maintain gap`, color: '#facc15' };
  }
  if (carAhead && now != null && now < 6) {
    return { state: 'BRAKE', reason: `COLLISION IMMINENT · ${now.toFixed(1)} ft`, color: '#f43f5e' };
  }
  if (carAhead && now != null && now < 12) {
    return { state: 'CAUTION', reason: `Car ${now.toFixed(1)} ft ahead`, color: '#facc15' };
  }

  // Yellow signal
  const yellow = detections.find(d => d.class === 'TRAFFIC_LIGHT' && d.prop.light === 'yellow');
  if (yellow) return { state: 'CAUTION', reason: `Yellow signal · ${yellow.distM.toFixed(1)} ft`, color: '#facc15' };

  return { state: 'CLEAR', reason: 'No hazards detected.', color: '#34d399' };
}

/* Translate active scenario+stage into the headline decision label.
   Called from the main loop *after* updateScenario() so the HUD shows
   the highest-priority Apollo state when a scenario is active. */
function decisionFromScenario(fallback) {
  const s = SCENARIO_MGR.active;
  if (!s || s.id === 'LANE_FOLLOW') return fallback;
  const def = SCENARIO_DEFS[s.id] || {};
  const labelMap = {
    STOP_SIGN_UNPROTECTED:   { PRE_STOP: 'APPROACH STOP', STOP: 'HELD · STOP', CREEP: 'CREEPING', INTERSECTION_CRUISE: 'CLEARING INT.' },
    TRAFFIC_LIGHT_PROTECTED: { APPROACH: 'APPROACH SIGNAL', STOP: 'HELD · RED', CRUISE: 'GREEN · GO' },
    EMERGENCY_PULL_OVER:     { APPROACH: 'EMER. APPROACH', SLOW_DOWN: 'EMER. SLOW', STANDBY: 'EMER. STANDBY' },
    YIELD_SIGN:              { SOFT_YIELD: 'YIELD' },
  };
  const state = (labelMap[s.id] && labelMap[s.id][s.stage]) || s.stage;
  return { state, reason: `Apollo scenario · ${s.id.replace(/_/g, ' ').toLowerCase()} / ${s.stage.toLowerCase()}`, color: def.color || fallback.color };
}
let _lastLidar = null;
let _approachMs = 0;

/* ── HUD icon helpers ──────────────────────────────────────── */
// All icons drawn with proj.x as horizontal center, proj.y as the
// ground contact (the "feet" of the object). sz is the scale 0..1
// where 1 is at the ego-camera plane.

// Real-world dimensions per class (feet). Used so icons scale
// metrically through the pinhole projection (proj.pxPerM).
const REAL_DIMS = {
  car:   { w: 6.5, h: 4.5, l: 12.0 }, // Squat, blocky proportions to counter FOV elongation
  stop:  { w: 2, h: 2, postH: 3.8 },
  light: { w: 1, h: 2.4,  postH: 5.0 },
  ped:   { w: 1.8, h: 5.6 },
};

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function mixHex(fg, bg, t) {
  const a = (h) => {
    const s = h.replace('#', '');
    if (s.length === 3) {
      return [0,1,2].map((i) => parseInt(s[i] + s[i], 16));
    }
    return [parseInt(s.slice(0,2), 16), parseInt(s.slice(2,4), 16), parseInt(s.slice(4,6), 16)];
  };
  const A = a(fg), B = a(bg);
  const r = Math.round(lerp(A[0], B[0], t));
  const g = Math.round(lerp(A[1], B[1], t));
  const b = Math.round(lerp(A[2], B[2], t));
  return `rgb(${r},${g},${b})`;
}

function lerpPoint(a, b, t) {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

function drawPoly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}

function drawLine(ctx, a, b) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function drawRearVehicle(ctx, cx, bottomY, w, h, palette, options = {}) {
  const body = options.body || palette.body;
  const roof = options.roof || palette.roof;
  const sensor = !!options.sensor;
  const depth3d = !!options.depth3d;
  const glow = options.glow || body;
  const r = Math.max(4, h * 0.08);
  const x = cx - w / 2;
  const top = bottomY - h;
  const bodyTop = top + h * 0.34;
  const bumperTop = bottomY - h * 0.22;
  const roofPanelW = w * (sensor ? 0.58 : 0.74);
  const cabinW = w * (sensor ? 0.4 : 0.58);
  const glassPanelH = h * (sensor ? 0.22 : 0.28);
  const cabinX = cx - cabinW / 2;

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.ellipse(cx, bottomY + h * 0.05, w * 0.45, Math.max(2, h * 0.06), 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowColor = glow;
  ctx.shadowBlur = options.shadowBlur ?? 10;
  ctx.fillStyle = body;
  roundRect(ctx, x, bodyTop, w, bottomY - bodyTop, r);
  ctx.fill();
  ctx.shadowBlur = 0;

  if (depth3d) {
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    drawPoly(ctx, [
      { x: x + w * 0.12, y: bodyTop + h * 0.02 },
      { x: x + w * 0.88, y: bodyTop + h * 0.02 },
      { x: x + w * 0.76, y: top + h * 0.18 },
      { x: x + w * 0.24, y: top + h * 0.18 },
    ]);
    ctx.fill();
    ctx.fillStyle = 'rgba(2,6,23,0.22)';
    drawPoly(ctx, [
      { x, y: bodyTop + h * 0.04 },
      { x: x + w * 0.12, y: bodyTop + h * 0.02 },
      { x: x + w * 0.18, y: bottomY },
      { x, y: bottomY },
    ]);
    ctx.fill();
    drawPoly(ctx, [
      { x: x + w, y: bodyTop + h * 0.04 },
      { x: x + w * 0.88, y: bodyTop + h * 0.02 },
      { x: x + w * 0.82, y: bottomY },
      { x: x + w, y: bottomY },
    ]);
    ctx.fill();
  }

  ctx.fillStyle = roof;
  roundRect(ctx, cx - roofPanelW / 2, top + h * 0.06, roofPanelW, h * 0.34, r * 0.75);
  ctx.fill();

  ctx.fillStyle = '#9fb1c2';
  roundRect(ctx, cabinX, top + h * 0.12, cabinW, glassPanelH, r * 0.45);
  ctx.fill();
  ctx.fillStyle = '#d7e1ea';
  ctx.fillRect(cabinX + cabinW * 0.1, top + h * 0.15, cabinW * 0.28, glassPanelH * 0.65);
  ctx.fillStyle = 'rgba(15,23,42,0.45)';
  ctx.fillRect(cx - 1, top + h * 0.12, 2, glassPanelH);

  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(x + w * 0.08, bodyTop + h * 0.04, w * 0.84, Math.max(2, h * 0.03));
  ctx.fillStyle = 'rgba(2,6,23,0.18)';
  ctx.fillRect(x, bodyTop + h * 0.34, w, h * 0.07);

  ctx.fillStyle = '#020617';
  roundRect(ctx, x - w * 0.02, bodyTop + h * 0.15, w * 0.14, h * 0.18, 2);
  roundRect(ctx, x + w * 0.88, bodyTop + h * 0.15, w * 0.14, h * 0.18, 2);
  ctx.fill();

  ctx.fillStyle = '#111827';
  roundRect(ctx, x + w * 0.08, bumperTop, w * 0.84, bottomY - bumperTop, r * 0.55);
  ctx.fill();

  ctx.fillStyle = '#ef4444';
  ctx.shadowColor = '#ef4444';
  ctx.shadowBlur = h * 0.08;
  ctx.fillRect(x + w * 0.18, bodyTop + h * 0.36, w * 0.15, h * 0.09);
  ctx.fillRect(x + w * 0.67, bodyTop + h * 0.36, w * 0.15, h * 0.09);
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#facc15';
  ctx.fillRect(x + w * 0.08, bumperTop + h * 0.05, w * 0.05, h * 0.07);
  ctx.fillRect(x + w * 0.87, bumperTop + h * 0.05, w * 0.05, h * 0.07);
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(cx - w * 0.09, bumperTop + h * 0.06, w * 0.18, h * 0.09);

  ctx.strokeStyle = 'rgba(255,255,255,0.42)';
  ctx.lineWidth = Math.max(1, h * 0.018);
  roundRect(ctx, x, bodyTop, w, bottomY - bodyTop, r);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(2,6,23,0.4)';
  drawLine(ctx, { x, y: bumperTop }, { x: x + w, y: bumperTop });
  drawLine(ctx, { x: cx, y: bodyTop + h * 0.08 }, { x: cx, y: bumperTop });

  if (sensor) {
    ctx.fillStyle = '#0f172a';
    roundRect(ctx, cx - w * 0.08, bodyTop + h * 0.18, w * 0.16, h * 0.1, 4);
    ctx.fill();
    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.arc(cx, bodyTop + h * 0.23, Math.max(2, w * 0.018), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function carPerspectivePoints(prop) {
  const halfW = REAL_DIMS.car.w / 2;
  const rearY = Math.max(0.25, prop.yM);
  const frontY = Math.max(rearY + 0.25, prop.yM + REAL_DIMS.car.l);
  const x = prop.xM;
  const topZ = REAL_DIMS.car.h;
  return {
    rearY,
    frontY,
    rgl: hudProject(x - halfW, rearY, 0),
    rgr: hudProject(x + halfW, rearY, 0),
    fgl: hudProject(x - halfW, frontY, 0),
    fgr: hudProject(x + halfW, frontY, 0),
    rtl: hudProject(x - halfW, rearY, topZ),
    rtr: hudProject(x + halfW, rearY, topZ),
    ftl: hudProject(x - halfW, frontY, topZ),
    ftr: hudProject(x + halfW, frontY, topZ),
  };
}

function iconBounds(prop, proj) {
  // Visual bbox in screen px, derived from real feet × pxPerM.
  const cx = proj.x, gy = proj.y; // ground contact point
  const m = proj.pxPerM;
  if (prop.type === 'car') {
    const rear = hudProject(prop.xM, prop.yM, 0);
    const top = hudProject(prop.xM, prop.yM, REAL_DIMS.car.h);
    if (!rear || !top) return { x: cx - 20, y: gy - 30, w: 40, h: 30 };
    const w = REAL_DIMS.car.w * rear.pxPerMX;
    const h = Math.max(14, (rear.y - top.y) * 0.78);
    return { x: rear.x - w / 2, y: rear.y - h, w, h };
  }
  if (prop.type === 'stop') {
    const w = REAL_DIMS.stop.w * m;
    const postH = REAL_DIMS.stop.postH * m;
    return { x: cx - w / 2, y: gy - postH - w, w, h: w };
  }
  if (prop.type === 'light') {
    const w = REAL_DIMS.light.w * m;
    const h = REAL_DIMS.light.h * m;
    const postH = REAL_DIMS.light.postH * m;
    return { x: cx - w / 2, y: gy - postH - h, w, h };
  }
  if (prop.type === 'ped') {
    const w = REAL_DIMS.ped.w * m;
    const h = REAL_DIMS.ped.h * m;
    return { x: cx - w / 2, y: gy - h, w, h };
  }
  return { x: cx - 20, y: gy - 30, w: 40, h: 30 };
}

function drawHudProp(ctx, proj, prop) {
  if (prop.type === 'car') {
    drawHudCar(ctx, proj, prop);
  } else if (prop.type === 'stop') {
    drawHudStop(ctx, proj);
  } else if (prop.type === 'light') {
    drawHudLight(ctx, proj, prop);
  } else if (prop.type === 'ped') {
    drawHudPed(ctx, proj);
  }
}

function drawHudGhost(ctx, prop) {
  const proj = hudProject(prop.xM, prop.yM);
  if (!proj) return;
  ctx.save();
  ctx.globalAlpha = prop.ghostAlpha ?? 0.28;
  const brightness = (prop.ghostBrightness ?? 1).toFixed(2);
  const contrast = (0.82 + (1 - (prop.ghostSideNorm ?? 0)) * 0.12).toFixed(2);
  ctx.filter = `grayscale(1) saturate(0) brightness(${brightness}) contrast(${contrast})`;
  drawHudProp(ctx, proj, prop);
  ctx.restore();

  const box = iconBounds(prop, proj);
  ctx.save();
  ctx.globalAlpha = Math.min(0.48, prop.ghostLineAlpha ?? 0.24);
  ctx.strokeStyle = 'rgba(226,232,240,0.95)';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 6 + (prop.ghostSideNorm ?? 0) * 8]);
  ctx.strokeRect(box.x, box.y, box.w, box.h);
  ctx.setLineDash([]);
  ctx.globalAlpha = Math.min(0.56, prop.ghostTextAlpha ?? 0.32);
  ctx.fillStyle = 'rgba(226,232,240,0.9)';
  ctx.font = '10px ui-monospace, Menlo, monospace';
  ctx.fillText(`${CLASSES[prop.type].name} ${prop.ghostDistM.toFixed(1)}ft`, box.x, box.y - 6);
  ctx.restore();
}

function drawHudCar(ctx, proj, prop) {
  const pts = carPerspectivePoints(prop);
  if (!pts.rgl || !pts.rgr || !pts.fgl || !pts.fgr) return;
  const palette = CAR_PALETTE[(prop.color | 0) % CAR_PALETTE.length];
  
  const x = prop.xM;
  const halfW = REAL_DIMS.car.w / 2;
  const rearY = pts.rearY, frontY = pts.frontY;
  
  // Sleek proportions
  const roofZ = REAL_DIMS.car.h * 0.95;
  const bodyZ = REAL_DIMS.car.h * 0.45;
  const cabRearY = lerp(rearY, frontY, 0.20);
  const cabFrontY = lerp(rearY, frontY, 0.65);
  
  const rTopL = hudProject(x - halfW, rearY, bodyZ);
  const rTopR = hudProject(x + halfW, rearY, bodyZ);
  const fTopL = hudProject(x - halfW, frontY, bodyZ);
  const fTopR = hudProject(x + halfW, frontY, bodyZ);
  
  const roofRL = hudProject(x - halfW * 0.75, cabRearY, roofZ);
  const roofRR = hudProject(x + halfW * 0.75, cabRearY, roofZ);
  const roofFL = hudProject(x - halfW * 0.7, cabFrontY, roofZ);
  const roofFR = hudProject(x + halfW * 0.7, cabFrontY, roofZ);

  if (!rTopL || !roofRL) return;

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // 1. Soft glowing drop shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 10;
  drawPoly(ctx, [pts.rgl, pts.rgr, pts.fgr, pts.fgl]);
  ctx.fill();
  ctx.shadowBlur = 0;

  // 2. Base Body Panels (smooth glossy metallic style)
  const gradM = ctx.createLinearGradient(rTopL.x, rTopL.y, pts.rgl.x, pts.rgl.y);
  gradM.addColorStop(0, mixHex(palette.body, '#ffffff', 0.2));
  gradM.addColorStop(1, mixHex(palette.body, '#000000', 0.6));

  ctx.fillStyle = gradM;
  // Left Side
  drawPoly(ctx, [pts.rgl, rTopL, fTopL, pts.fgl]); ctx.fill();
  // Right Side
  drawPoly(ctx, [pts.rgr, rTopR, fTopR, pts.fgr]); ctx.fill();
  // Front Face
  drawPoly(ctx, [pts.fgl, pts.fgr, fTopR, fTopL]); ctx.fill();

  // Rear Face (direct view)
  const gradRear = ctx.createLinearGradient(rTopL.x, rTopL.y, pts.rgl.x, pts.rgl.y);
  gradRear.addColorStop(0, palette.body);
  gradRear.addColorStop(1, mixHex(palette.body, '#111111', 0.8));
  ctx.fillStyle = gradRear;
  drawPoly(ctx, [pts.rgl, pts.rgr, rTopR, rTopL]); ctx.fill();

  // Top panels (Trunk/Hood)
  ctx.fillStyle = mixHex(palette.body, '#ffffff', 0.25);
  drawPoly(ctx, [rTopL, rTopR, roofRR, roofRL]); ctx.fill(); // Trunk to roof
  drawPoly(ctx, [fTopL, fTopR, roofFR, roofFL]); ctx.fill(); // Hood to roof

  // 3. Cabin/Glass (Opaque glossy dark monolithic windows)
  ctx.fillStyle = '#161920'; // Sleek tinted glass
  
  // Rear Window
  drawPoly(ctx, [rTopL, rTopR, roofRR, roofRL]); ctx.fill();
  // Left Window
  drawPoly(ctx, [rTopL, roofRL, roofFL, fTopL]); ctx.fill();
  // Right Window
  drawPoly(ctx, [rTopR, roofRR, roofFR, fTopR]); ctx.fill();
  // Windshield
  drawPoly(ctx, [fTopL, fTopR, roofFR, roofFL]); ctx.fill();
  
  // Roof Panel
  ctx.fillStyle = palette.body;
  drawPoly(ctx, [roofRL, roofRR, roofFR, roofFL]); ctx.fill();

  // 4. Subtle Wireframe glowing edge for that "FSD HUD" look
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  // Base outline
  drawPoly(ctx, [pts.rgl, pts.rgr, pts.fgr, pts.fgl]); ctx.stroke();
  // Main body box outline
  drawPoly(ctx, [rTopL, rTopR, fTopR, fTopL]); ctx.stroke();
  drawLine(ctx, pts.rgl, rTopL); drawLine(ctx, pts.rgr, rTopR);
  drawLine(ctx, pts.fgl, fTopL); drawLine(ctx, pts.fgr, fTopR);
  // Cabin outline
  drawPoly(ctx, [roofRL, roofRR, roofFR, roofFL]); ctx.stroke();
  drawLine(ctx, rTopL, roofRL); drawLine(ctx, rTopR, roofRR);
  drawLine(ctx, fTopL, roofFL); drawLine(ctx, fTopR, roofFR);

  // 5. Sleek Neon Taillights
  ctx.shadowColor = '#ff2222';
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#ff2222';
  const tL1 = lerpPoint(rTopL, rTopR, 0.05), tL2 = lerpPoint(rTopL, rTopR, 0.25);
  const tR1 = lerpPoint(rTopL, rTopR, 0.75), tR2 = lerpPoint(rTopL, rTopR, 0.95);
  
  // Left Tail
  drawPoly(ctx, [
    hudProject(x - halfW * 0.9, rearY, bodyZ * 0.95),
    hudProject(x - halfW * 0.5, rearY, bodyZ * 0.95),
    hudProject(x - halfW * 0.5, rearY, bodyZ * 0.7),
    hudProject(x - halfW * 0.9, rearY, bodyZ * 0.7)
  ]);
  ctx.fill();
  // Right Tail
  drawPoly(ctx, [
    hudProject(x + halfW * 0.5, rearY, bodyZ * 0.95),
    hudProject(x + halfW * 0.9, rearY, bodyZ * 0.95),
    hudProject(x + halfW * 0.9, rearY, bodyZ * 0.7),
    hudProject(x + halfW * 0.5, rearY, bodyZ * 0.7)
  ]);
  ctx.fill();

  ctx.restore();
}

function drawHudCarRear(ctx, proj, prop) {
  // Now identical to drawHudCar, kept for compatibility if called elsewhere
  drawHudCar(ctx, proj, prop);
}

function drawHudStop(ctx, proj) {
  const m = proj.pxPerM;
  const cx = proj.x, cy = proj.y;
  const r = (REAL_DIMS.stop.w / 2) * m;
  const postH = REAL_DIMS.stop.postH * m;
  
  // Center of the sign sits at the top of the post
  const signCenterY = cy - postH;
  
  ctx.save();
  // Post runs from sign center down to the ground (cy)
  ctx.fillStyle = '#6b7280';
  const postWidth = Math.max(2, r * 0.15);
  ctx.fillRect(cx - (postWidth / 2), signCenterY, postWidth, postH);
  
  // Octagon
  if (r > 4) {
    ctx.shadowColor = '#f43f5e';
    ctx.shadowBlur = Math.min(15, r * 0.5);
  }
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const x = cx + Math.cos(a) * r;
    const y = signCenterY + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  
  // White inner border
  ctx.shadowBlur = 0;
  if (r > 6) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, r * 0.08);
    const innerR = r * 0.85;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const x = cx + Math.cos(a) * innerR;
      const y = signCenterY + Math.sin(a) * innerR;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }
  
  // "STOP" text (only render if large enough to not bleed over the border)
  if (r > 8) {
    const fontSize = Math.floor(r * 0.55);
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('STOP', cx, signCenterY + fontSize * 0.07);
  }
  
  ctx.restore();
}

function drawHudLight(ctx, proj, prop) {
  const m = proj.pxPerM;
  const cx = proj.x, cy = proj.y;
  const w = REAL_DIMS.light.w * m;
  const h = REAL_DIMS.light.h * m;
  const postH = REAL_DIMS.light.postH * m;
  const sz = Math.max(0.2, m / 60);
  const x0 = cx - w / 2, y0 = cy - postH - h;
  // Gantry post + arm
  ctx.save();
  ctx.fillStyle = '#374151';
  ctx.fillRect(cx - 1.5 * sz, y0 + h, 3 * sz, postH);
  // Housing
  ctx.fillStyle = '#0f172a';
  roundRect(ctx, x0, y0, w, h, 3 * sz);
  ctx.fill();
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = Math.max(1, 1 * sz);
  roundRect(ctx, x0, y0, w, h, 3 * sz);
  ctx.stroke();
  // Bulbs
  const bulbR = w * 0.32;
  const colors = ['#f43f5e', '#facc15', '#34d399'];
  const states = ['red', 'yellow', 'green'];
  for (let i = 0; i < 3; i++) {
    const by = y0 + h * (0.22 + i * 0.28);
    const lit = prop.light === states[i];
    if (lit) {
      ctx.shadowColor = colors[i];
      ctx.shadowBlur = 14;
    } else {
      ctx.shadowBlur = 0;
    }
    ctx.fillStyle = lit ? colors[i] : '#1a0e2e';
    ctx.beginPath();
    ctx.arc(cx, by, bulbR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawHudPed(ctx, proj) {
  const m = proj.pxPerM;
  const cx = proj.x, cy = proj.y;
  const totalH = REAL_DIMS.ped.h * m;
  const headR  = totalH * 0.10;
  const bodyH  = totalH * 0.42;
  const legH   = totalH * 0.42;
  const sz = Math.max(0.2, m / 60);
  ctx.save();
  ctx.shadowColor = '#a78bfa';
  ctx.shadowBlur = 8;
  ctx.fillStyle = '#a78bfa';
  // Head
  ctx.beginPath();
  ctx.arc(cx, cy - bodyH - legH - headR - 2, headR, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  // Torso
  ctx.fillStyle = '#7c3aed';
  roundRect(ctx, cx - 6 * sz, cy - bodyH - legH, 12 * sz, bodyH, 3 * sz);
  ctx.fill();
  // Arms
  ctx.strokeStyle = '#a78bfa';
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1.5, 3 * sz);
  ctx.beginPath();
  ctx.moveTo(cx - 6 * sz, cy - bodyH - legH + 4 * sz);
  ctx.lineTo(cx - 12 * sz, cy - legH);
  ctx.moveTo(cx + 6 * sz, cy - bodyH - legH + 4 * sz);
  ctx.lineTo(cx + 12 * sz, cy - legH);
  ctx.stroke();
  // Legs
  ctx.beginPath();
  ctx.moveTo(cx - 3 * sz, cy - legH);
  ctx.lineTo(cx - 6 * sz, cy);
  ctx.moveTo(cx + 3 * sz, cy - legH);
  ctx.lineTo(cx + 6 * sz, cy);
  ctx.stroke();
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawHudRangeLadder(ctx, yNearM, yFarM) {
  ctx.save();
  ctx.font = '9px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let lastLabelY = Infinity;
  for (let yM = 12; yM <= Math.min(72, yFarM); yM += 12) {
    if (yM <= yNearM) continue;
    const left = hudGroundPoint(-WORLD.roadHalfM * 0.72, yM);
    const right = hudGroundPoint(WORLD.roadHalfM * 0.72, yM);
    const center = hudGroundPoint(0, yM);
    if (Math.abs(lastLabelY - center.y) < 18) continue;
    lastLabelY = center.y;
    ctx.globalAlpha = Math.max(0.16, 0.46 - yM / yFarM * 0.24);
    ctx.strokeStyle = 'rgba(34,211,238,0.5)';
    ctx.lineWidth = 1;
    drawLine(ctx, left, right);
    ctx.fillStyle = 'rgba(203,213,225,0.72)';
    ctx.fillText(`${yM} ft`, center.x, center.y - 10);
  }
  ctx.restore();
}

function drawHudEgoForeground(ctx, W, H) {
  // Premium hand-crafted ego car — drawn as a modern sedan seen from
  // a slightly elevated rear-¾ view, like Tesla's perception HUD.
  
  const cx = W / 2;
  // Anchor the ego car flush with the bottom of the screen to create a solid "blind area"
  const groundY = H + 24; 

  // Use a fixed HUD-space size for the ego car icon.
  // Projecting at the near-plane (yM=0.1) generates ~36 000 px — absurdly large.
  // Instead anchor the visual size as a fraction of the canvas width, matching
  // what Tesla's perception HUD actually shows.
  const carW = Math.round(W * 0.21);
  const carH = carW * 0.45;
  const topY = groundY - carH;

  const rearHalfW = carW / 2;
  const hoodHalfW = rearHalfW * 0.76;
  const roofHalfW = carW * 0.34;
  const roofFrontHalfW = carW * 0.29;
  const carLen    = carH; 

  const bumperH = carH * 0.3;
  const bodyH   = carH * 0.35;
  const glassH  = carH * 0.25;
  const hoodH   = carH * 0.1;

  const bumperTop = groundY - bumperH;
  const bodyTop   = bumperTop - bodyH;
  const glassTop  = bodyTop - glassH;
  const hoodTop   = glassTop - hoodH;

  // Width at each vertical slice
  const wAt = (y) => {
    const t = (groundY - y) / carH;
    return lerp(rearHalfW, hoodHalfW, Math.min(1, t));
  };

  ctx.save();

  // ── Ground shadow ──
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.ellipse(cx, groundY + 4, rearHalfW * 0.85, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── Body (lower panel) ──
  const bodyGrad = ctx.createLinearGradient(cx - rearHalfW, 0, cx + rearHalfW, 0);
  bodyGrad.addColorStop(0, '#065a82');
  bodyGrad.addColorStop(0.15, '#0b7daa');
  bodyGrad.addColorStop(0.5, '#0ea5e9');
  bodyGrad.addColorStop(0.85, '#0b7daa');
  bodyGrad.addColorStop(1, '#065a82');
  ctx.fillStyle = bodyGrad;
  ctx.shadowColor = '#0ea5e9';
  ctx.shadowBlur = 16;
  drawPoly(ctx, [
    { x: cx - rearHalfW, y: groundY },
    { x: cx + rearHalfW, y: groundY },
    { x: cx + wAt(bodyTop), y: bodyTop },
    { x: cx - wAt(bodyTop), y: bodyTop },
  ]);
  ctx.fill();
  ctx.shadowBlur = 0;

  // ── Bumper area (dark inset) ──
  const bInset = rearHalfW * 0.06;
  ctx.fillStyle = '#0c2d48';
  drawPoly(ctx, [
    { x: cx - rearHalfW + bInset, y: groundY - 2 },
    { x: cx + rearHalfW - bInset, y: groundY - 2 },
    { x: cx + rearHalfW - bInset * 1.5, y: bumperTop },
    { x: cx - rearHalfW + bInset * 1.5, y: bumperTop },
  ]);
  ctx.fill();

  // ── Taillights ──
  const tlW = rearHalfW * 0.22;
  const tlH = bumperH * 0.55;
  const tlY = bumperTop + bumperH * 0.15;
  ctx.shadowColor = '#ef4444';
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#ef4444';
  roundRect(ctx, cx - rearHalfW + bInset * 2, tlY, tlW, tlH, 3);
  ctx.fill();
  roundRect(ctx, cx + rearHalfW - bInset * 2 - tlW, tlY, tlW, tlH, 3);
  ctx.fill();
  ctx.shadowBlur = 0;
  // Taillight inner detail
  ctx.fillStyle = '#fca5a5';
  ctx.fillRect(cx - rearHalfW + bInset * 2 + 3, tlY + 2, tlW - 6, 2);
  ctx.fillRect(cx + rearHalfW - bInset * 2 - tlW + 3, tlY + 2, tlW - 6, 2);

  // ── License plate ──
  const plateW = rearHalfW * 0.28;
  const plateH = bumperH * 0.42;
  ctx.fillStyle = '#e2e8f0';
  roundRect(ctx, cx - plateW / 2, bumperTop + bumperH * 0.28, plateW, plateH, 2);
  ctx.fill();
  ctx.fillStyle = '#64748b';
  ctx.font = `bold ${Math.max(6, plateH * 0.6)}px ui-monospace, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('EGO', cx, bumperTop + bumperH * 0.28 + plateH / 2);

  // ── Turn signals (amber) ──
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(cx - rearHalfW + bInset, groundY - 5, 6, 3);
  ctx.fillRect(cx + rearHalfW - bInset - 6, groundY - 5, 6, 3);

  // ── Body panel highlight (chrome strip) ──
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.2;
  drawLine(ctx,
    { x: cx - rearHalfW + 2, y: bumperTop },
    { x: cx + rearHalfW - 2, y: bumperTop }
  );

  // ── Upper body / C-pillar transition ──
  const ubGrad = ctx.createLinearGradient(cx - rearHalfW, 0, cx + rearHalfW, 0);
  ubGrad.addColorStop(0, '#064e77');
  ubGrad.addColorStop(0.2, '#0a8cc4');
  ubGrad.addColorStop(0.5, '#0ea5e9');
  ubGrad.addColorStop(0.8, '#0a8cc4');
  ubGrad.addColorStop(1, '#064e77');
  ctx.fillStyle = ubGrad;
  const ubBotHW = wAt(bodyTop);
  const ubTopHW = lerp(rearHalfW, roofHalfW, 0.58);
  drawPoly(ctx, [
    { x: cx - ubBotHW, y: bodyTop },
    { x: cx + ubBotHW, y: bodyTop },
    { x: cx + ubTopHW, y: glassTop },
    { x: cx - ubTopHW, y: glassTop },
  ]);
  ctx.fill();

  // ── Rear window (glass) ──
  const glassInset = 4;
  const gwBot = ubBotHW - glassInset;
  const gwTop = ubTopHW - glassInset;
  const glassGrad = ctx.createLinearGradient(0, bodyTop, 0, glassTop);
  glassGrad.addColorStop(0, '#1e3a5f');
  glassGrad.addColorStop(0.3, '#2a5a80');
  glassGrad.addColorStop(0.6, '#3b82a8');
  glassGrad.addColorStop(1, '#4a9ec0');
  ctx.fillStyle = glassGrad;
  drawPoly(ctx, [
    { x: cx - gwBot, y: bodyTop - 3 },
    { x: cx + gwBot, y: bodyTop - 3 },
    { x: cx + gwTop, y: glassTop + 3 },
    { x: cx - gwTop, y: glassTop + 3 },
  ]);
  ctx.fill();
  // Glass reflection highlight
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  drawPoly(ctx, [
    { x: cx - gwBot * 0.6, y: bodyTop - 2 },
    { x: cx - gwBot * 0.15, y: bodyTop - 2 },
    { x: cx - gwTop * 0.2, y: glassTop + 5 },
    { x: cx - gwTop * 0.55, y: glassTop + 5 },
  ]);
  ctx.fill();
  // Glass divider (center pillar)
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1.5;
  drawLine(ctx, { x: cx, y: bodyTop - 2 }, { x: cx, y: glassTop + 4 });

  // ── Roof panel ──
  const roofGrad = ctx.createLinearGradient(cx - roofHalfW, 0, cx + roofHalfW, 0);
  roofGrad.addColorStop(0, '#053d5e');
  roofGrad.addColorStop(0.3, '#0879a8');
  roofGrad.addColorStop(0.5, '#0891b2');
  roofGrad.addColorStop(0.7, '#0879a8');
  roofGrad.addColorStop(1, '#053d5e');
  ctx.fillStyle = roofGrad;
  drawPoly(ctx, [
    { x: cx - roofHalfW, y: glassTop },
    { x: cx + roofHalfW, y: glassTop },
    { x: cx + roofHalfW * 0.96, y: glassTop - hoodH * 0.18 },
    { x: cx + roofFrontHalfW, y: hoodTop + hoodH * 0.35 },
    { x: cx - roofFrontHalfW, y: hoodTop + hoodH * 0.35 },
    { x: cx - roofHalfW * 0.96, y: glassTop - hoodH * 0.18 },
  ]);
  ctx.fill();

  // ── Windshield (front glass visible over roof) ──
  const wsInset = 3;
  const wsBotHW = roofFrontHalfW - wsInset;
  const wsTopHW = hoodHalfW * 0.52;
  const wsBot = hoodTop + hoodH * 0.38;
  const wsTop = hoodTop + hoodH * 0.08;
  const wsGrad = ctx.createLinearGradient(0, wsBot, 0, wsTop);
  wsGrad.addColorStop(0, '#2a6080');
  wsGrad.addColorStop(0.5, '#4a9aba');
  wsGrad.addColorStop(1, '#6bc0dc');
  ctx.fillStyle = wsGrad;
  drawPoly(ctx, [
    { x: cx - wsBotHW, y: wsBot },
    { x: cx + wsBotHW, y: wsBot },
    { x: cx + wsTopHW, y: wsTop },
    { x: cx - wsTopHW, y: wsTop },
  ]);
  ctx.fill();
  // Windshield reflection
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  drawPoly(ctx, [
    { x: cx + wsBotHW * 0.1, y: wsBot - 1 },
    { x: cx + wsBotHW * 0.7, y: wsBot - 1 },
    { x: cx + wsTopHW * 0.65, y: wsTop + 2 },
    { x: cx + wsTopHW * 0.15, y: wsTop + 2 },
  ]);
  ctx.fill();

  // ── Hood (front panel tapering forward) ──
  const hoodGrad = ctx.createLinearGradient(0, glassTop, 0, hoodTop);
  hoodGrad.addColorStop(0, '#0891b2');
  hoodGrad.addColorStop(0.5, '#0ea5e9');
  hoodGrad.addColorStop(1, '#38bdf8');
  ctx.fillStyle = hoodGrad;
  drawPoly(ctx, [
    { x: cx - roofFrontHalfW - 6, y: hoodTop + hoodH * 0.35 },
    { x: cx + roofFrontHalfW + 6, y: hoodTop + hoodH * 0.35 },
    { x: cx + hoodHalfW * 0.65, y: hoodTop },
    { x: cx - hoodHalfW * 0.65, y: hoodTop },
  ]);
  ctx.fill();

  // ── Side mirrors ──
  ctx.fillStyle = '#064e77';
  const mirY = glassTop + glassH * 0.3;
  const mirW = 8, mirH = 5;
  roundRect(ctx, cx - ubTopHW - mirW - 1, mirY, mirW, mirH, 2);
  ctx.fill();
  roundRect(ctx, cx + ubTopHW + 1, mirY, mirW, mirH, 2);
  ctx.fill();
  // Mirror glass
  ctx.fillStyle = '#4a9aba';
  ctx.fillRect(cx - ubTopHW - mirW, mirY + 1, mirW - 2, mirH - 2);
  ctx.fillRect(cx + ubTopHW + 2, mirY + 1, mirW - 2, mirH - 2);

  // Rear POV: tires sit under the body — no visible wheel disks (avoids “floating” semicircles).
  // Subtle lower sill / shadow only.
  ctx.fillStyle = 'rgba(2,6,23,0.55)';
  roundRect(
    ctx,
    cx - rearHalfW * 0.88,
    groundY - 4,
    rearHalfW * 1.76,
    5,
    2
  );
  ctx.fill();

  // ── Sensor pod (roof mount) ──
  const podW = 14, podH2 = 6;
  const podY = glassTop - 2;
  ctx.fillStyle = '#0f172a';
  roundRect(ctx, cx - podW / 2, podY - podH2, podW, podH2, 3);
  ctx.fill();
  ctx.fillStyle = '#22d3ee';
  ctx.shadowColor = '#22d3ee';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(cx, podY - podH2 / 2, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // ── Outline / chrome trim ──
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1;
  // Body outline
  drawPoly(ctx, [
    { x: cx - rearHalfW, y: groundY },
    { x: cx + rearHalfW, y: groundY },
    { x: cx + hoodHalfW * 0.65, y: hoodTop },
    { x: cx - hoodHalfW * 0.65, y: hoodTop },
  ]);
  ctx.stroke();
  // Side panel seam
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  drawLine(ctx,
    { x: cx - rearHalfW + bInset * 2 + tlW + 4, y: bumperTop + bumperH * 0.3 },
    { x: cx - ubTopHW + 3, y: glassTop + 3 }
  );
  drawLine(ctx,
    { x: cx + rearHalfW - bInset * 2 - tlW - 4, y: bumperTop + bumperH * 0.3 },
    { x: cx + ubTopHW - 3, y: glassTop + 3 }
  );

  // ── Cyan glow strip under car ──
  ctx.fillStyle = 'rgba(34,211,238,0.5)';
  ctx.shadowColor = '#22d3ee';
  ctx.shadowBlur = 12;
  ctx.fillRect(cx - rearHalfW * 0.55, groundY + 6, rearHalfW * 1.1, 2);
  ctx.shadowBlur = 0;

  ctx.restore();
}

function hudNearestVisibleGroundM() {
  const bottomFromHorizon = Math.max(1, HUD_H - hudHorizonY());
  const visualY = (hudFocalYPx() * WORLD.cameraHeightM) / (bottomFromHorizon * WORLD.hudDepthScale);
  return visualY - WORLD.cameraOffsetM;
}

function hudGroundPoint(xM, yM) {
  return hudProject(xM, Math.max(yM, 0.1), 0);
}

function drawProjectedRoadBand(ctx, yNear, yFar, fillStyle) {
  if (yFar <= yNear) return;
  const leftNear = hudGroundPoint(-WORLD.roadHalfM - EGO.xM, yNear);
  const rightNear = hudGroundPoint(WORLD.roadHalfM - EGO.xM, yNear);
  const rightFar = hudGroundPoint(WORLD.roadHalfM - EGO.xM, yFar);
  const leftFar = hudGroundPoint(-WORLD.roadHalfM - EGO.xM, yFar);
  ctx.fillStyle = fillStyle;
  ctx.beginPath();
  ctx.moveTo(leftNear.x, leftNear.y);
  ctx.lineTo(rightNear.x, rightNear.y);
  ctx.lineTo(rightFar.x, rightFar.y);
  ctx.lineTo(leftFar.x, leftFar.y);
  ctx.closePath();
  ctx.fill();
}

function scenePropSize(prop) {
  const dims = prop.type === 'car'
    ? { w: REAL_DIMS.car.w, l: REAL_DIMS.car.l } // match ego car dimensions exactly
    : CLASSES[prop.type].real;
  const pxW = Math.max(8, (dims.w / (2 * SCENE_VIEW.halfWidthM)) * SC_W);
  let pxH;
  if (prop.type === 'car') {
    const totalY = SCENE_VIEW.forwardM + SCENE_VIEW.rearM;
    pxH = Math.max(8, (dims.l / totalY) * SC_H);
  } else {
    pxH = pxW * (dims.h / dims.w);
  }
  return { pxW, pxH };
}

/* ── HUD rendering ─────────────────────────────────────────── */
function renderHUD(detections, lidar) {
  const ctx = hudCtx;
  const W = HUD_W, H = HUD_H;
  const HORIZON_Y = hudHorizonY();
  
  // Pull the ground mesh all the way back to the car's bumper (yM = 0)
  const ROAD_NEAR_M = 0.1;
  const ROAD_FAR_M = WORLD.forwardM;

  // Sky
  ctx.fillStyle = THEME.sky;
  ctx.fillRect(0, 0, W, HORIZON_Y);

  // Minimal horizon line for light theme
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1;
  for (let i = 1; i <= 5; i++) {
    const y = HORIZON_Y - i * 14;
    if (y < 8) break;
    ctx.globalAlpha = 0.42 - i * 0.07;
    ctx.beginPath();
    ctx.moveTo(W * 0.06, y);
    ctx.lineTo(W * 0.94, y);
    ctx.stroke();
  }
  // Vertical scan ticks (very subtle, evenly spaced)
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = 'rgba(34,211,238,0.6)';
  for (let i = 1; i < 10; i++) {
    const x = (W / 10) * i;
    ctx.beginPath();
    ctx.moveTo(x, HORIZON_Y - 4);
    ctx.lineTo(x, HORIZON_Y - 8);
    ctx.stroke();
  }
  // The horizon line itself — bright cyan with glow
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 10;
  ctx.shadowColor = THEME.horizon;
  ctx.strokeStyle = THEME.horizon;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, HORIZON_Y);
  ctx.lineTo(W, HORIZON_Y);
  ctx.stroke();
  ctx.restore();

  // Compass / heading reticle on the horizon
  ctx.save();
  ctx.fillStyle = THEME.horizon;
  ctx.globalAlpha = 0.85;
  ctx.font = '9px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('▼ N', W / 2, HORIZON_Y - 14);
  ctx.restore();

  // Ground
  ctx.fillStyle = THEME.ground;
  ctx.fillRect(0, HORIZON_Y, W, H - HORIZON_Y);

  // Road plane
  ctx.save();
  drawProjectedRoadBand(ctx, ROAD_NEAR_M, ROAD_FAR_M, THEME.road);

  // Neon road edges in real lane geometry.
  ctx.lineCap = 'round';
  ctx.shadowBlur = 10;
  ctx.shadowColor = '#facc15';
  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = 1.6;
  const leftNear = hudGroundPoint(-WORLD.roadHalfM - EGO.xM, ROAD_NEAR_M);
  const leftFar = hudGroundPoint(-WORLD.roadHalfM - EGO.xM, ROAD_FAR_M);
  const rightNear = hudGroundPoint(WORLD.roadHalfM - EGO.xM, ROAD_NEAR_M);
  const rightFar = hudGroundPoint(WORLD.roadHalfM - EGO.xM, ROAD_FAR_M);
  ctx.beginPath();
  ctx.moveTo(leftNear.x, leftNear.y);
  ctx.lineTo(leftFar.x, leftFar.y);
  ctx.stroke();
  ctx.shadowColor = '#cbd5e1';
  ctx.strokeStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(rightNear.x, rightNear.y);
  ctx.lineTo(rightFar.x, rightFar.y);
  ctx.stroke();
  ctx.restore();

  // Lane dashes: fixed world-space paint segments. Ego is parked, so there is no scrolling phase.
  ctx.save();
  ctx.shadowBlur = 6;
  ctx.shadowColor = 'rgba(255,255,255,0.6)';
  ctx.strokeStyle = '#ffffff';
  ctx.lineCap = 'round';
  for (let l = 1; l < WORLD.laneCount; l++) {
    const xM = -WORLD.roadHalfM + l * WORLD.laneWidthM - EGO.xM;
    const dashLenM = 10;
    const gapM = 20;
    const periodM = dashLenM + gapM;
    const movingOffsetM = EGO.travelM % periodM;
    for (let yM = 8 - movingOffsetM; yM < ROAD_FAR_M; yM += periodM) {
      const y0 = Math.max(ROAD_NEAR_M, yM);
      const y1 = Math.min(ROAD_FAR_M, yM + dashLenM);
      if (y1 <= ROAD_NEAR_M) continue;
      const a = hudGroundPoint(xM, y0);
      const b = hudGroundPoint(xM, y1);
      ctx.globalAlpha = Math.max(0.24, Math.min(0.88, 0.95 - y0 / ROAD_FAR_M * 0.7));
      ctx.lineWidth = Math.max(1.1, Math.min(4.5, a.pxPerM * 0.12));
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }
  ctx.restore();

  // Caution zone: projected 0-13 ft road band.
  ctx.save();
  drawProjectedRoadBand(ctx, ROAD_NEAR_M, Math.min(13, ROAD_FAR_M), 'rgba(234,179,8,0.15)');
  ctx.restore();
  drawHudRangeLadder(ctx, ROAD_NEAR_M, ROAD_FAR_M);
  renderHudPlannedPath(ctx);

  // LiDAR ray (down center)
  ctx.save();
  ctx.strokeStyle = 'rgba(244,63,94,0.65)';
  ctx.shadowColor = '#f43f5e';
  ctx.shadowBlur = 12;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 6]);
  const lidarStart = hudGroundPoint(0, ROAD_NEAR_M);
  const lidarEnd = hudGroundPoint(0, Math.min(WORLD.lidarRangeM, ROAD_FAR_M));
  ctx.beginPath();
  ctx.moveTo(lidarStart.x, lidarStart.y);
  ctx.lineTo(lidarEnd.x, lidarEnd.y);
  ctx.stroke();
  ctx.setLineDash([]);
  // Hit dot
  if (lidar.distM != null) {
    const hit = hudGroundPoint(0, lidar.distM);
    ctx.fillStyle = '#fff';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(hit.x, hit.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f43f5e';
    ctx.fillText(`${lidar.distM.toFixed(2)} ft`, hit.x + 10, hit.y + 4);
  }
  ctx.restore();

  // Detections — proper iconography per class, scaled metrically
  // through the pinhole projection. Sort far→near so closer draws on top.
  const ghostProps = props
    .map(hudEdgeGhostProp)
    .filter(Boolean)
    .sort((a, b) => b.ghostDistM - a.ghostDistM);
  for (const ghost of ghostProps) {
    drawHudGhost(ctx, ghost);
  }

  const sortedDet = [...detections].sort((a, b) => b.distM - a.distM);
  for (const d of sortedDet) {
    const hudProp = { ...d.prop, xM: d.xRelM, yM: d.yRelM };
    const proj = hudProject(hudProp.xM, hudProp.yM);
    if (!proj) continue;

    ctx.save();
    drawHudProp(ctx, proj, hudProp);
    ctx.restore();

    // Detection box overlay (cyan brackets) — measured per icon
    const box = iconBounds(hudProp, proj);
    ctx.save();
    ctx.strokeStyle = d.color;
    ctx.shadowColor = d.color;
    ctx.shadowBlur = 10;
    ctx.lineWidth = 1.4;
    ctx.globalAlpha = 0.9;
    const corner = Math.max(7, Math.min(box.w, box.h) * 0.22);
    const drawBracket = (cx, cy, dx, dy) => {
      ctx.beginPath();
      ctx.moveTo(cx + dx * corner, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy + dy * corner);
      ctx.stroke();
    };
    drawBracket(box.x,         box.y,         +1, +1);
    drawBracket(box.x + box.w, box.y,         -1, +1);
    drawBracket(box.x,         box.y + box.h, +1, -1);
    drawBracket(box.x + box.w, box.y + box.h, -1, -1);

    // Label
    ctx.font = '10px ui-monospace, Menlo, monospace';
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    const label = `${d.class} ${d.distM.toFixed(1)}ft ${(d.conf * 100).toFixed(0)}%`;
    const tw = ctx.measureText(label).width + 10;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(box.x, box.y - 16, tw, 14);
    ctx.fillStyle = d.color;
    ctx.fillText(label, box.x + 5, box.y - 5);
    ctx.restore();
  }

  // Removed ego car foreground overlay
  drawHudEgoForeground(ctx, W, H);

  // Bottom HUD strip — speed/decision style
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillRect(0, H - 28, W, 28);
  ctx.fillStyle = '#0891b2';
  ctx.font = '10px ui-monospace, Menlo, monospace';
  ctx.fillText(`AUTO ${AUTO.mode}  ·  SPEED ${(EGO.speedMps * 0.681818).toFixed(0)} mph  ·  TARGETS ${detections.length}`, 12, H - 10);
  ctx.textAlign = 'right';
  const lt = lidar.distM == null ? 'NO RETURN' : `${lidar.distM.toFixed(2)} ft`;
  ctx.fillStyle = lidar.distM == null ? '#64748b' : '#0891b2';
  ctx.fillText(`LIDAR ${lt}`, W - 12, H - 10);
  ctx.restore();
}

function drawSceneVehicle(ctx, sp, pxW, pxH, palette, isEgo = false) {
  const body = isEgo ? '#22d3ee' : palette.body;
  const roof = isEgo ? '#0891b2' : palette.roof;
  const x0 = sp.px - pxW / 2;
  const y0 = sp.py - pxH / 2;
  const r = Math.max(2.5, Math.min(pxW, pxH) * 0.12);
  const sz = Math.max(0.25, (pxW + pxH) / 90);

  ctx.save();
  // Soft cast shadow (ahead = smaller y = top of rect)
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(sp.px, y0 + pxH * 0.55, pxW * 0.48, pxH * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Wheels — drawn BEFORE body so they sit underneath the chassis
  const wx = Math.max(3, pxW * 0.175);
  const wy = Math.max(4, pxH * 0.14);
  const drawWheel = (cx, cy) => {
    ctx.fillStyle = '#030305';
    ctx.beginPath();
    ctx.ellipse(cx, cy, wx * 1.05, wy * 1.05, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath();
    ctx.ellipse(cx, cy, wx, wy, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = Math.max(0.4, sz * 0.2);
    ctx.beginPath();
    ctx.ellipse(cx, cy, wx * 0.88, wy * 0.88, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(55,65,81,0.95)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, wx * 0.52, wy * 0.48, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(15,23,42,0.6)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, wx * 0.22, wy * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    // Sidewall catchlight
    ctx.fillStyle = 'rgba(100,116,139,0.35)';
    ctx.beginPath();
    ctx.ellipse(cx - wx * 0.25, cy - wy * 0.15, wx * 0.2, wy * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  const oy = pxH * 0.29;
  const wcx = x0 + wx * 1.02;
  const wcxR = x0 + pxW - wx * 1.02;
  drawWheel(wcx, y0 + oy);
  drawWheel(wcxR, y0 + oy);
  drawWheel(wcx, y0 + pxH - oy);
  drawWheel(wcxR, y0 + pxH - oy);

  ctx.shadowColor = isEgo ? '#22d3ee' : body;
  ctx.shadowBlur = isEgo ? 16 : 12;
  const bodyGrad = ctx.createLinearGradient(x0, y0, x0 + pxW, y0);
  if (isEgo) {
    bodyGrad.addColorStop(0, '#0e7490');
    bodyGrad.addColorStop(0.5, body);
    bodyGrad.addColorStop(1, '#0e7490');
  } else {
    bodyGrad.addColorStop(0, mixHex(body, '#020617', 0.35));
    bodyGrad.addColorStop(0.45, body);
    bodyGrad.addColorStop(0.55, mixHex(body, '#ffffff', 0.12));
    bodyGrad.addColorStop(1, mixHex(body, '#020617', 0.28));
  }
  ctx.fillStyle = bodyGrad;
  roundRect(ctx, x0, y0, pxW, pxH, r);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Hood (front / top of box): lighter wedge
  const hoodH = pxH * 0.22;
  ctx.fillStyle = isEgo ? 'rgba(165,243,252,0.2)' : 'rgba(255,255,255,0.12)';
  drawPoly(ctx, [
    { x: x0 + pxW * 0.1,  y: y0 + hoodH * 0.2 },
    { x: x0 + pxW * 0.9,  y: y0 + hoodH * 0.2 },
    { x: x0 + pxW * 0.72, y: y0 + hoodH * 1.1 },
    { x: x0 + pxW * 0.28, y: y0 + hoodH * 1.1 },
  ]);
  ctx.fill();

  // Cabin / roof
  const cabW = pxW * 0.7;
  const cabH = pxH * 0.4;
  const cabX = sp.px - cabW / 2;
  const cabY = y0 + pxH * 0.2;
  const roofGrad = ctx.createLinearGradient(cabX, cabY, cabX + cabW, cabY);
  roofGrad.addColorStop(0, mixHex(roof, '#000000', 0.5));
  roofGrad.addColorStop(0.5, roof);
  roofGrad.addColorStop(1, mixHex(roof, '#000000', 0.5));
  ctx.fillStyle = roofGrad;
  roundRect(ctx, cabX, cabY, cabW, cabH, r * 0.75);
  ctx.fill();

  // Glass — ego keeps a light HUD look; other cars: dark tint (not “open” / clear)
  if (isEgo) {
    ctx.fillStyle = 'rgba(207,250,254,0.5)';
  } else {
    const glGrad = ctx.createLinearGradient(sp.px, y0 + pxH * 0.02, sp.px, y0 + pxH * 0.12);
    glGrad.addColorStop(0, 'rgba(15,23,42,0.96)');
    glGrad.addColorStop(1, 'rgba(30,41,59,0.9)');
    ctx.fillStyle = glGrad;
  }
  roundRect(ctx, sp.px - pxW * 0.32, y0 + pxH * 0.04, pxW * 0.64, Math.max(2, pxH * 0.08), 2);
  ctx.fill();
  if (!isEgo) {
    ctx.strokeStyle = 'rgba(51,65,85,0.5)';
    ctx.lineWidth = Math.max(0.5, sz * 0.25);
    roundRect(ctx, sp.px - pxW * 0.32, y0 + pxH * 0.04, pxW * 0.64, Math.max(2, pxH * 0.08), 2);
    ctx.stroke();
  }
  if (isEgo) {
    ctx.fillStyle = 'rgba(8,47,73,0.7)';
  } else {
    ctx.fillStyle = 'rgba(7,12,20,0.94)';
  }
  roundRect(ctx, sp.px - pxW * 0.3, y0 + pxH * 0.55, pxW * 0.6, Math.max(2, pxH * 0.12), 2);
  ctx.fill();

  // Side character lines
  ctx.strokeStyle = isEgo ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.22)';
  ctx.lineWidth = Math.max(0.6, sz * 0.4);
  ctx.setLineDash([3 * sz, 2 * sz]);
  ctx.beginPath();
  ctx.moveTo(x0 + pxW * 0.1,  y0 + pxH * 0.5);
  ctx.lineTo(x0 + pxW * 0.9,  y0 + pxH * 0.5);
  ctx.stroke();
  ctx.setLineDash([]);

  // (Wheels moved to above the body rendering)

  // DRLs (front edge)
  ctx.fillStyle = isEgo ? 'rgba(165,243,252,0.9)' : 'rgba(241,245,249,0.75)';
  ctx.fillRect(x0 + pxW * 0.12, y0 + 1, pxW * 0.2, Math.max(1, sz * 0.4));
  ctx.fillRect(x0 + pxW * 0.68, y0 + 1, pxW * 0.2, Math.max(1, sz * 0.4));
  // Taillights (rear)
  const tl = isEgo ? 'rgba(248,113,113,0.95)' : 'rgba(251,113,133,0.9)';
  ctx.shadowColor = '#ef4444';
  ctx.shadowBlur = isEgo ? 8 : 5;
  ctx.fillStyle = tl;
  roundRect(ctx, x0 + pxW * 0.1,  y0 + pxH - 3, pxW * 0.22, 2, 0.5);
  ctx.fill();
  roundRect(ctx, x0 + pxW * 0.68, y0 + pxH - 3, pxW * 0.22, 2, 0.5);
  ctx.fill();
  ctx.shadowBlur = 0;
  // License plate
  ctx.fillStyle = 'rgba(226,232,240,0.9)';
  roundRect(ctx, sp.px - pxW * 0.12, y0 + pxH * 0.44, pxW * 0.24, Math.max(2, pxH * 0.08), 1);
  ctx.fill();

  ctx.strokeStyle = isEgo ? 'rgba(224,250,255,0.55)' : 'rgba(255,255,255,0.4)';
  ctx.lineWidth = isEgo ? 1.5 : 1;
  roundRect(ctx, x0, y0, pxW, pxH, r);
  ctx.stroke();
  ctx.restore();
}

/* ── Scene rendering (top-down) ────────────────────────────── */
function renderScene(detections, lidar) {
  const ctx = sceneCtx;
  const W = SC_W, H = SC_H;

  // Background
  ctx.fillStyle = THEME.sceneBg;
  ctx.fillRect(0, 0, W, H);

  // Grid (5 ft squares)
  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,0.05)';
  ctx.lineWidth = 1;
  for (let m = -WORLD.halfWidthM; m <= WORLD.halfWidthM; m += 5) {
    const { px } = worldToScene(m, 0);
    ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, H); ctx.stroke();
  }
  for (let m = -SCENE_VIEW.rearM; m <= WORLD.forwardM; m += 5) {
    const { py } = worldToScene(0, m);
    ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(W, py); ctx.stroke();
  }
  ctx.restore();

  // Draw trees/bushes — only outside the road+shoulder band.
  // Hash on stable integer slot IDs (not the floating-point m offset) so trees
  // never flicker — each slot has a fixed identity regardless of EGO.travelM.
  ctx.save();
  const treeSpacing = 25;
  const roadEdgeM = (WORLD.laneCount * WORLD.laneWidthM) / 2 + WORLD.shoulderM + 1.5;
  const firstSlot = Math.floor((-SCENE_VIEW.rearM + EGO.travelM) / treeSpacing) - 1;
  const lastSlot  = Math.ceil((WORLD.forwardM   + EGO.travelM) / treeSpacing) + 1;
  for (let l = -WORLD.halfWidthM; l <= WORLD.halfWidthM; l += 4) {
    if (Math.abs(l) < roadEdgeM) continue;
    for (let slot = firstSlot; slot <= lastSlot; slot++) {
      // Stable hash keyed on (l, slot) — never changes between frames
      let h = Math.sin(l * 12.9898 + slot * 78.233) * 43758.5453;
      h = h - Math.floor(h);
      if (h > 0.4) {
        // Convert absolute slot back to scene-relative world position
        const mWorld = slot * treeSpacing - EGO.travelM;
        const { px, py } = worldToScene(l, mWorld);
        ctx.fillStyle = h > 0.7 ? '#059669' : '#10b981';
        ctx.beginPath();
        ctx.arc(px, py, 5 + h * 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#047857';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }
  ctx.restore();
  const laneHalf = (WORLD.laneCount * WORLD.laneWidthM) / 2;
  const a = worldToScene(-laneHalf, -SCENE_VIEW.rearM);
  const b = worldToScene( laneHalf, WORLD.forwardM);
  ctx.save();
  
  // Draw asphalt background
  const roadGradient = ctx.createLinearGradient(0, a.py, 0, b.py);
  roadGradient.addColorStop(0, DARK_MODE ? '#1e293b' : '#94a3b8');
  roadGradient.addColorStop(1, DARK_MODE ? '#0f172a' : '#64748b');
  ctx.fillStyle = roadGradient;
  ctx.fillRect(a.px, b.py, b.px - a.px, a.py - b.py);
  
  // Draw shoulders (Emergency lane / gravel)
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(a.px - 10, b.py, 10, a.py - b.py); // Left shoulder
  ctx.fillRect(b.px, b.py, 10, a.py - b.py);      // Right shoulder

  // Guard rails
  ctx.fillStyle = '#cbd5e1';
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2;
  ctx.fillRect(a.px - 14, b.py, 4, a.py - b.py); // Left rail
  ctx.strokeRect(a.px - 14, b.py, 4, a.py - b.py);
  ctx.fillRect(b.px + 10, b.py, 4, a.py - b.py); // Right rail
  ctx.strokeRect(b.px + 10, b.py, 4, a.py - b.py);

  // Lane stripes
  ctx.strokeStyle = '#ffffff'; // bright white lines
  ctx.lineWidth = 2;
  ctx.setLineDash([12, 12]);
  for (let l = 1; l < WORLD.laneCount; l++) {
    const x = -laneHalf + l * WORLD.laneWidthM;
    const t = worldToScene(x, 0);
    const tt = worldToScene(x, WORLD.forwardM);
    // Add movement to stripes in top-down view
    const offset = (EGO.travelM * SC_H / WORLD.forwardM) % 24;
    ctx.lineDashOffset = -offset;
    ctx.beginPath(); ctx.moveTo(t.px, t.py); ctx.lineTo(tt.px, tt.py); ctx.stroke();
  }
  ctx.setLineDash([]);
  // Edges
  ctx.strokeStyle = '#facc15'; // yellow left edge line
  ctx.strokeWidth = 2;
  ctx.beginPath(); ctx.moveTo(a.px, b.py); ctx.lineTo(a.px, a.py); ctx.stroke();
  ctx.strokeStyle = '#ffffff'; // white right edge line
  ctx.beginPath(); ctx.moveTo(b.px, b.py); ctx.lineTo(b.px, a.py); ctx.stroke();
  ctx.restore();

  // Camera FOV cone
  ctx.save();
  const ego = worldToScene(EGO.xM, 0);
  const half = fovHalfRad();
  const farLeft  = worldToScene(EGO.xM - Math.tan(half) * WORLD.forwardM, WORLD.forwardM);
  const farRight = worldToScene(EGO.xM + Math.tan(half) * WORLD.forwardM, WORLD.forwardM);
  const fov = ctx.createLinearGradient(0, ego.py, 0, farLeft.py);
  fov.addColorStop(0, 'rgba(8,145,178,0.1)'); // light mode teal
  fov.addColorStop(1, 'rgba(8,145,178,0)');
  ctx.fillStyle = fov;
  ctx.beginPath();
  ctx.moveTo(ego.px, ego.py);
  ctx.lineTo(farLeft.px, farLeft.py);
  ctx.lineTo(farRight.px, farRight.py);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(8,145,178,0.25)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(ego.px, ego.py); ctx.lineTo(farLeft.px, farLeft.py);
  ctx.moveTo(ego.px, ego.py); ctx.lineTo(farRight.px, farRight.py);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // LiDAR ray
  ctx.save();
  ctx.strokeStyle = 'rgba(244,63,94,0.9)';
  ctx.shadowColor = '#f43f5e';
  ctx.shadowBlur = 8;
  ctx.lineWidth = 1.5;
  const lidEnd = worldToScene(EGO.xM, lidar.distM != null ? lidar.distM : WORLD.lidarRangeM);
  ctx.beginPath();
  ctx.moveTo(ego.px, ego.py);
  ctx.lineTo(lidEnd.px, lidEnd.py);
  ctx.stroke();
  if (lidar.distM != null) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(lidEnd.px, lidEnd.py, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Range rings (every 10 ft)
  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,0.1)';
  ctx.font = '9px ui-monospace, monospace';
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 1;
  for (let m = 10; m <= WORLD.forwardM; m += 10) {
    const p = worldToScene(0, m);
    ctx.beginPath();
    ctx.ellipse(ego.px, ego.py, (b.px - a.px) * 0.42, ego.py - p.py, 0, Math.PI, 2 * Math.PI);
    ctx.stroke();
    ctx.fillText(`${m} ft`, ego.px + 6, p.py + 3);
  }
  ctx.restore();

  // Props
  for (const p of props) {
    const cls = CLASSES[p.type];
    const sp = worldToScene(p.xM, p.yM);
    const { pxW, pxH } = scenePropSize(p);
    const cy = sp.py - pxH / 2; // sp.py is bottom edge, cy is center
    ctx.save();
    ctx.shadowColor = cls.color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = cls.color;
    ctx.globalAlpha = 0.85;

    if (p.type === 'car') {
      const palette = CAR_PALETTE[(p.color | 0) % CAR_PALETTE.length];
      drawSceneVehicle(ctx, { px: sp.px, py: cy }, pxW, pxH, palette);
    } else if (p.type === 'stop') {
      ctx.beginPath();
      const r = Math.max(pxW, pxH) / 1.8;
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2 + Math.PI / 8;
        const px = sp.px + Math.cos(ang) * r;
        const py = cy + Math.sin(ang) * r;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.floor(r * 0.9)}px ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.fillText('S', sp.px, cy + r * 0.32);
    } else if (p.type === 'light') {
      const w = pxW, h = pxH;
      ctx.fillRect(sp.px - w / 2, cy - h / 2, w, h);
      const bulbR = w * 0.28;
      const colors = { red: '#f43f5e', yellow: '#facc15', green: '#34d399' };
      const states = ['red', 'yellow', 'green'];
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = p.light === states[i] ? colors[states[i]] : '#1a0e2e';
        ctx.beginPath();
        ctx.arc(sp.px, cy - h / 2 + h * (i + 1) / 4, bulbR, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (p.type === 'ped') {
      ctx.beginPath();
      ctx.arc(sp.px, cy - pxH / 2, pxW / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(sp.px - pxW / 4, cy - pxH / 2, pxW / 2, pxH);
    }
    ctx.restore();

    // Hover/drag highlight + selection ring for in-FOV
    const detected = inFov(p);
    ctx.save();
    ctx.strokeStyle = detected ? cls.color : 'rgba(148,163,184,0.4)';
    ctx.lineWidth = detected ? 2 : 1;
    ctx.setLineDash(detected ? [] : [3, 3]);
    ctx.strokeRect(sp.px - pxW / 2 - 4, sp.py - pxH - 4, pxW + 8, pxH + 8);
    ctx.restore();

    // ID label
    ctx.fillStyle = 'rgba(229,231,235,0.7)';
    ctx.font = '9px ui-monospace, monospace';
    ctx.textAlign = 'left';
    
    const xRelM = p.xM - EGO.xM;
    const dims = REAL_DIMS[p.type] || { w: 1, l: 1 };
    const lengthM = dims.l || dims.w || 1;
    // Rear license plate / rear bumper center coordinate (pure longitudinal distance)
    const rearY = p.yM - (lengthM / 2);
    // Ignore lateral offset for distance readouts — users intuitively think of "distance" 
    // as how far AHEAD the object is on the road. Apply physical sensor offset (zero at 1.1).
    const dist = Math.max(0, rearY - WORLD.sensorOffsetM);
    
    ctx.fillText(`${cls.name} · ${dist.toFixed(1)}ft`, sp.px + pxW / 2 + 6, cy - 2);
    if (p.type === 'light') {
      ctx.fillText(`(click to toggle: ${p.light})`, sp.px + pxW / 2 + 6, cy + 10);
    }
  }

  // Ego car (front bumper at y=0 — distances are measured from here)
  ctx.save();
  const visualEgoW = REAL_DIMS.car.w; // same value as obstacle cars → identical width
  const egoW = (visualEgoW / (2 * SCENE_VIEW.halfWidthM)) * SC_W;
  const totalY = SCENE_VIEW.forwardM + SCENE_VIEW.rearM;
  const egoH = (REAL_DIMS.car.l / totalY) * SC_H;  // same length as obstacle cars
  // Front bumper at ego.py (y=0). Car body extends behind (below) it.
  // We center it at ego.py + egoH/2 so its top edge aligns with y=0.
  drawSceneVehicle(ctx, { px: ego.px, py: ego.py + egoH * 0.5 }, egoW, egoH, CAR_PALETTE[8], true);
  ctx.fillStyle = '#22d3ee';
  ctx.font = '9px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`EGO · ${(EGO.speedMps * 0.681818).toFixed(0)} mph`, ego.px, ego.py + egoH + 12);
  ctx.restore();

  // Spawning ghost
  if (spawning && mouseScene.in) {
    const cls = CLASSES[spawning.type];
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = cls.color;
    ctx.shadowColor = cls.color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(mouseScene.x, mouseScene.y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#06031a';
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(cls.name, mouseScene.x, mouseScene.y + 4);
    ctx.restore();
  }
}

/* ── Sparkline (distance history) ──────────────────────────── */
const distHistory = [];
function pushDist(d) {
  distHistory.push(d == null ? null : d);
  while (distHistory.length > 120) distHistory.shift();
}
function renderSpark() {
  if (!SP_W || !SP_H) return;
  const ctx = sparkCtx;
  ctx.clearRect(0, 0, SP_W, SP_H);
  ctx.strokeStyle = 'rgba(148,163,184,0.18)';
  ctx.beginPath();
  ctx.moveTo(0, SP_H * 0.5); ctx.lineTo(SP_W, SP_H * 0.5);
  ctx.stroke();

  ctx.beginPath();
  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = 1.5;
  ctx.shadowColor = '#22d3ee';
  ctx.shadowBlur = 6;
  let started = false;
  for (let i = 0; i < distHistory.length; i++) {
    const v = distHistory[i];
    const x = (i / 120) * SP_W;
    if (v == null) { started = false; continue; }
    const y = SP_H - (v / WORLD.lidarRangeM) * SP_H;
    if (!started) { ctx.moveTo(x, y); started = true; }
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

/* ── Telemetry update ──────────────────────────────────────── */
function renderTelemetry(detections, lidar, decision) {
  // Distance
  if (lidar.distM == null) {
    distVal.innerHTML = `—<span class="unit">ft</span>`;
    distState.textContent = 'NO RETURN';
    distState.style.color = '#94a3b8';
  } else {
    distVal.innerHTML = `${lidar.distM.toFixed(2)}<span class="unit">ft</span>`;
    distState.textContent = lidar.distM < 6 ? 'CLOSE' : (lidar.distM < 20 ? 'NEAR' : 'FAR');
    distState.style.color = lidar.distM < 6 ? '#f43f5e' : (lidar.distM < 20 ? '#facc15' : '#34d399');
  }

  // Build per-detection intent map (id → INTENT)
  const intentById = new Map();
  if (Array.isArray(AUTO._predicted)) {
    for (const o of AUTO._predicted) intentById.set(o.p.id, o.intent);
  }

  // Detection list — augmented with intent label
  if (detections.length === 0) {
    detList.innerHTML = `<div class="small" style="opacity:0.5;">No objects in FOV — drag a prop into the lane.</div>`;
  } else {
    detList.innerHTML = detections.map(d => {
      const intent = intentById.get(d.prop.id) || '';
      const intentTag = intent ? `<div class="intent">${intent}</div>` : '';
      return `
      <div class="det" style="border-left-color:${d.color};">
        <div class="swatch" style="background:${d.color};"></div>
        <div>${d.class}${intentTag}</div>
        <div class="dist">${d.distM.toFixed(2)} ft</div>
        <div class="conf">${(d.conf * 100).toFixed(0)}%</div>
      </div>`;
    }).join('');
  }

  // Apollo Scenario + Stage panel
  const apolloEl = document.getElementById('apolloStack');
  if (apolloEl) {
    const scen = SCENARIO_MGR.active;
    const def = SCENARIO_DEFS[scen.id] || { color: '#94a3b8' };
    const tStage = ((performance.now() - scen.stageEnteredAt) / 1000).toFixed(1);
    const ruleChips = TRAFFIC_RULES.decisions
      .map(r => `<span class="rule-chip ${r.severity === 'HARD' ? 'hard' : 'soft'}" title="${r.reason}">${r.id}</span>`)
      .join('') || `<span class="rule-chip ok">NO ACTIVE RULES</span>`;
    const logRows = SCENARIO_MGR.log.slice(0, 3).map(e => {
      const ago = ((performance.now() - e.t) / 1000).toFixed(1);
      return `<div class="scen-log"><span class="scen-log-kind">${e.kind}</span> ${e.from} → ${e.to} <span class="scen-log-ago">${ago}s ago</span></div>`;
    }).join('');
    apolloEl.innerHTML = `
      <div class="scen-row">
        <span class="scen-pill" style="border-color:${def.color}; color:${def.color};">${scen.id.replace(/_/g, ' ')}</span>
        <span class="scen-stage">${scen.stage}</span>
        <span class="scen-time">${tStage}s</span>
      </div>
      <div class="rule-row">${ruleChips}</div>
      <div class="scen-log-list">${logRows || '<div class="scen-log-empty">no transitions yet</div>'}</div>
    `;
  }

  // Decision
  const speedVal = document.getElementById('speedVal');
  if (speedVal) speedVal.innerHTML = `${(EGO.speedMps * 0.681818).toFixed(1)}<span class="unit" style="font-size:0.5em; margin-left:4px;">mph</span>`;
  decisionVal.textContent = decision.state;
  decisionVal.style.color = decision.color;
  decisionVal.style.textShadow = `0 0 12px ${decision.color}88`;
  decisionReason.textContent = decision.reason;
  ttcVal.textContent = (_approachMs > 0.4 && lidar.distM != null) ? `${(lidar.distM / _approachMs).toFixed(1)} s` : '—';
}

/* ── UART packet emit (visual only) ────────────────────────── */
let _packetCount = 0, _lastPktSec = 0, _pktSecCount = 0;
function emitPacket(detections, lidar) {
  _packetCount++;
  _pktSecCount++;
  const now = performance.now() / 1000;
  if (now - _lastPktSec > 1) {
    txRateEl.textContent = _pktSecCount;
    _pktSecCount = 0;
    _lastPktSec = now;
  }
  const dft = lidar.distM == null ? 0xFFFF : Math.min(0xFFFF, Math.round(lidar.distM * 100));
  lastPacketEl.textContent = `0xAA ${dft.toString(16).padStart(4,'0')} n=${detections.length}`;
}

/* ── Mouse / touch input on scene ──────────────────────────── */
function pick(px, py) {
  for (let i = props.length - 1; i >= 0; i--) {
    const p = props[i];
    const sp = worldToScene(p.xM, p.yM);
    const { pxW, pxH } = scenePropSize(p);
    if (px >= sp.px - pxW / 2 - 4 && px <= sp.px + pxW / 2 + 4 &&
        py >= sp.py - pxH - 4 && py <= sp.py + 4) {
      return p;
    }
  }
  return null;
}

function getScenePos(ev) {
  const r = scene.getBoundingClientRect();
  const isTouch = ev.touches && ev.touches[0];
  const cx = isTouch ? ev.touches[0].clientX : ev.clientX;
  const cy = isTouch ? ev.touches[0].clientY : ev.clientY;
  return { x: cx - r.left, y: cy - r.top };
}

scene.addEventListener('mousedown', onDown);
scene.addEventListener('mousemove', onMove);
window.addEventListener('mouseup', onUp);
scene.addEventListener('mouseleave', () => { mouseScene.in = false; });
scene.addEventListener('mouseenter', () => { mouseScene.in = true; });
scene.addEventListener('touchstart', onDown, { passive: false });
scene.addEventListener('touchmove',  onMove, { passive: false });
window.addEventListener('touchend', onUp);

scene.addEventListener('click', (ev) => {
  if (dragging || spawning) return;
  const pos = getScenePos(ev);
  const hit = pick(pos.x, pos.y);
  if (!hit) return;
  if (hit.type === 'light') {
    hit.light = hit.light === 'red' ? 'yellow' : (hit.light === 'yellow' ? 'green' : 'red');
  } else if (hit.type === 'car') {
    hit.color = ((hit.color | 0) + 1) % CAR_PALETTE.length;
  }
});

function onDown(ev) {
  ev.preventDefault();
  const pos = getScenePos(ev);
  mouseScene.x = pos.x; mouseScene.y = pos.y; mouseScene.in = true;
  if (spawning) return; // toolbar drag in progress
  const hit = pick(pos.x, pos.y);
  if (hit) {
    const sp = worldToScene(hit.xM, hit.yM);
    dragging = { prop: hit, offX: pos.x - sp.px, offY: pos.y - sp.py };
  }
}
function onMove(ev) {
  const pos = getScenePos(ev);
  mouseScene.x = pos.x; mouseScene.y = pos.y;
  if (dragging) {
    const w = sceneToWorld(pos.x - dragging.offX, pos.y - dragging.offY);
    let xM = Math.max(-WORLD.halfWidthM + 0.2, Math.min(WORLD.halfWidthM - 0.2, w.xM));
    xM = keepParkedCarOutsideLane(dragging.prop, xM);
    xM = clampPropForPassableGap(dragging.prop, xM);
    dragging.prop.xM = xM;
    dragging.prop.yM = Math.max(0.3, Math.min(WORLD.forwardM - 0.3, w.yM));
  }
}
let _carColorCounter = 1;
function onUp(ev) {
  if (spawning && mouseScene.in) {
    const w = sceneToWorld(mouseScene.x, mouseScene.y);
    const newProp = {
      id: nextId++,
      type: spawning.type,
      xM: spawning.type === 'car' ? parkedCarX(w.xM || 1) : w.xM,
      yM: Math.max(3, w.yM),
    };
    if (spawning.type === 'light') newProp.light = 'red';
    if (spawning.type === 'car') {
      newProp.color = (_carColorCounter++) % CAR_PALETTE.length;
      newProp.parked = true;
    }
    props.push(newProp);
  }
  spawning = null;
  dragging = null;
}

/* Toolbar — click to spawn at default forward position; or drag */
document.querySelectorAll('.tool[data-spawn]').forEach(btn => {
  btn.addEventListener('mousedown', (e) => {
    spawning = { type: btn.dataset.spawn };
  });
  btn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    spawning = { type: btn.dataset.spawn };
  }, { passive: false });
  btn.addEventListener('click', (e) => {
    if (!spawning) return;
    // If the user just clicked (no drag), drop into the lane at a reasonable spot
    const newProp = {
      id: nextId++,
      type: spawning.type,
      xM: spawning.type === 'car' ? parkedCarX(_carColorCounter % 2 ? 1 : -1) : 0,
      yM: spawning.type === 'car' ? 28 + (_carColorCounter % 3) * 7 : 30,
    };
    if (spawning.type === 'light') newProp.light = 'red';
    if (spawning.type === 'car') {
      newProp.color = (_carColorCounter++) % CAR_PALETTE.length;
      newProp.parked = true;
    }
    if (!props.find(p => Math.abs(p.xM - newProp.xM) < 0.3 && Math.abs(p.yM - newProp.yM) < 0.5)) {
      props.push(newProp);
    }
    spawning = null;
  });
});
document.getElementById('clearBtn').addEventListener('click', () => { props = []; });

function setDriveControl(control, active) {
  if (!(control in driveKeys)) return;
  driveKeys[control] = active;
  document.querySelectorAll(`.drive-btn[data-drive="${control}"]`).forEach(btn => {
    btn.classList.toggle('is-active', active);
  });
}

const keyToDrive = {
  ArrowLeft: 'left',
  a: 'left',
  A: 'left',
  ArrowRight: 'right',
  d: 'right',
  D: 'right',
  ArrowUp: 'up',
  w: 'up',
  W: 'up',
  ArrowDown: 'down',
  s: 'down',
  S: 'down',
};

window.addEventListener('keydown', (ev) => {
  const control = keyToDrive[ev.key];
  if (!control) return;
  ev.preventDefault();
  setDriveControl(control, true);
});
window.addEventListener('keyup', (ev) => {
  const control = keyToDrive[ev.key];
  if (!control) return;
  ev.preventDefault();
  setDriveControl(control, false);
});
window.addEventListener('blur', () => {
  Object.keys(driveKeys).forEach(key => setDriveControl(key, false));
});
document.querySelectorAll('.drive-btn[data-drive]').forEach(btn => {
  const control = btn.dataset.drive;
  const activate = (ev) => {
    ev.preventDefault();
    setDriveControl(control, true);
  };
  const deactivate = (ev) => {
    ev.preventDefault();
    setDriveControl(control, false);
  };
  btn.addEventListener('pointerdown', activate);
  btn.addEventListener('pointerup', deactivate);
  btn.addEventListener('pointercancel', deactivate);
  btn.addEventListener('pointerleave', deactivate);
});

/* Analog autonomy outputs (ft/s²-style dynamics; names kept for UART parity) */
const AUTONOMY = { enabled: true, throttle: 0, steer: 0 };

function updateEgo(dt) {
  let throttleCmd;
  let steerCmd;
  if (AUTONOMY.enabled) {
    throttleCmd = AUTONOMY.throttle;
    steerCmd = AUTONOMY.steer;
  } else {
    throttleCmd = driveKeys.up ? 1 : (driveKeys.down ? -1 : 0);
    steerCmd = (driveKeys.right ? 1 : 0) - (driveKeys.left ? 1 : 0);
  }

  if (throttleCmd > 0) {
    EGO.speedMps = Math.min(EGO.maxSpeedMps, EGO.speedMps + EGO.accelMps2 * throttleCmd * dt);
  } else if (throttleCmd < 0) {
    EGO.speedMps = Math.max(0, EGO.speedMps + throttleCmd * EGO.brakeMps2 * dt);
  } else {
    EGO.speedMps = Math.max(0, EGO.speedMps - EGO.dragMps2 * dt);
  }

  const steerBlend = Math.min(1, dt * EGO.steerResponse);
  EGO.steerCmd += (steerCmd - EGO.steerCmd) * steerBlend;
  const lateralLimit = drivableLateralLimit();
  EGO.xM = Math.max(-lateralLimit, Math.min(lateralLimit, EGO.xM + EGO.steerCmd * EGO.steerMps * dt));

  if (EGO.speedMps > 0) {
    const travel = EGO.speedMps * dt;
    EGO.travelM += travel;
    for (const p of props) p.yM -= travel;

    if (AUTO.proceduralSpawn) {
      // Remove obstacles that have safely passed behind the ego car
      props = props.filter(p => p.yM > -15);
      
      AUTO._spawnTimer = (AUTO._spawnTimer || 0) + travel;
      if (AUTO._spawnTimer > (AUTO._spawnDist || 30)) {
        AUTO._spawnTimer = 0;
        // Random distance to next spawn (25 to 75 ft)
        AUTO._spawnDist = 25 + Math.random() * 50;
        
        // Prevent overcrowding if there are already obstacles ahead
        const farProps = props.filter(p => p.yM > WORLD.forwardM - 10);
        if (farProps.length < 2) {
          const r = Math.random();
          // 65% parked car, 25% pedestrian, 10% stop sign
          const type = r < 0.65 ? 'car' : (r < 0.90 ? 'ped' : 'stop');
          
          let xM = 0;
          if (type === 'car') {
            xM = parkedCarX(Math.random() < 0.5 ? 1 : -1);
          } else if (type === 'ped') {
            xM = (Math.random() * 12 - 6);
          } else {
            // Stop sign on the right shoulder
            xM = WORLD.roadHalfM + WORLD.shoulderM - 1.0;
          }
          
          const newProp = {
            id: nextId++,
            type,
            xM: clampPropForPassableGap({ type }, xM),
            yM: WORLD.forwardM + 15 + Math.random() * 20
          };
          
          if (type === 'car') {
            newProp.color = Math.floor(Math.random() * CAR_PALETTE.length);
            newProp.parked = true;
          }
          
          props.push(newProp);
        }
      }
    }
  }
}

/* ── Always-on semi-autonomous drive + planned path visualization ─── */
// Hide the manual drive pad; the car steers itself.
(function () {
  const dp = document.querySelector('.drive-pad');
  if (dp) dp.style.display = 'none';
  const head = document.querySelector('#scenePanel .panel-head span:first-child');
  if (head) head.textContent = 'Drop obstacles · the car will route around them';
  const hudHead = document.querySelector('#hudPanel .panel-head span:first-child');
  if (hudHead) hudHead.textContent = 'Proprietary Intelligence · Perception HUD · semi-autonomous';
})();

const AUTO = {
  proceduralSpawn: true,
  targetSpeedMps: 11.0,       // cruise (~7.5 mph) — ft/s internally
  laneCenterX: 0,
  lookAheadM: 8.5,
  pathRangeM: 38,
  pathSteps: 76,
  plannedPath: [],
  routeThreat: null,
  activeThreats: new Set(), // IDs of obstacles currently being routed around
  pathBlocked: false,       // true when no collision-free path exists
  mode: 'AUTO CRUISE',
  decisionOverride: null,
  _stoppedAt: null,
  _creepUntil: 0,
  _creepScheduled: false,
  _lastTargetX: 0,
  _lastTargetY: 8.0
};

function inCorridor(det, halfLaneFrac) {
  return Math.abs(det.xRelM) <= WORLD.laneWidthM * halfLaneFrac;
}

/** Max comfortable speed (ft/s) for a full stop within distFt − margin. */
function comfortSpeedCap(distFt, marginFt) {
  const g = Math.max(0, distFt - marginFt);
  // Use a softer deceleration (0.25x max brake) for comfort so it slows down earlier
  return Math.sqrt(2 * EGO.brakeMps2 * 0.25 * g);
}

function primaryLeadCar(detections) {
  // Corridor: ego half-width + car half-width + small margin
  const carCorridorM = WORLD.carWidthM / 2 + CLASSES.car.real.w / 2 + 0.35;
  const list = detections.filter(d => d.class === 'CAR' && Math.abs(d.xRelM) < carCorridorM);
  list.sort((a, b) => a.distM - b.distM);
  return list[0] || null;
}

function blockingPed(detections) {
  // Corridor: ego half-width + ped half-width + 1.5 ft comfort margin
  const pedCorridorM = WORLD.carWidthM / 2 + REAL_DIMS.ped.w / 2 + 1.5;
  const list = detections.filter(d =>
    d.class === 'PEDESTRIAN' && Math.abs(d.xRelM) < pedCorridorM && d.distM < 36
  );
  list.sort((a, b) => a.distM - b.distM);
  return list[0] || null;
}

/* ── Apollo-class Prediction Module ──────────────────────────
   Constant-velocity model: each obstacle is projected forward
   by its estimated velocity over a short horizon.  In a real
   Apollo stack this would be an LSTM / VectorNet prediction;
   here we approximate with a simple CV model + lane-intent
   heuristic that is still far better than treating everything
   as static. */
const PRED = {
  horizonS: 2.0,          // 2-second prediction horizon
  _prevY: new Map(),       // id → previous yM for velocity estimation
};

function predictObstacles(obs, dt) {
  const predicted = [];
  for (const p of obs) {
    const prevY = PRED._prevY.get(p.id);
    let vy = 0; // ft/s, positive = prop itself moving toward ego (world-frame velocity)
    if (prevY !== undefined && dt > 0.001) {
      const relChange = (prevY - p.yM) / dt; // apparent approach rate (includes ego motion)
      vy = relChange - EGO.speedMps;           // subtract ego contribution → prop's own velocity
    }
    PRED._prevY.set(p.id, p.yM);

    const dims = REAL_DIMS[p.type] || { w: 2, l: 2 };
    const halfW = (dims.w || 2) / 2;
    const halfL = (dims.l || dims.w || 2) / 2;

    const entry = {
      p,
      halfW,
      halfL,
      vy,
      // Collision envelope: half prop width + half ego width + minimal comfort margin.
      // Tight enough that the car can squeeze past shoulder obstacles in a 16ft lane.
      clearance: halfW + WORLD.carWidthM * 0.5 + 0.15,
      longitudinalPad: halfL + 4.5,
      predictedY: p.yM - vy * PRED.horizonS, // where it will be in 2 s
    };
    entry.intent = classifyIntent(entry);
    // Cut-in obstacles deserve a wider keep-out envelope (Apollo: high-priority cost).
    if (entry.intent === INTENT.CUTTING_IN) entry.clearance += 1.0;
    if (entry.intent === INTENT.ONCOMING)   entry.clearance += 0.6;
    predicted.push(entry);
  }
  return predicted;
}

/* ── Apollo-class Intent Classifier ──────────────────────────
   Mirrors apollo/modules/prediction/predictor: each obstacle is
   tagged with a coarse intent label that downstream cost funcs
   and scenario logic can read.  A real Apollo stack uses a
   VectorNet/LSTM pair; here we use a deterministic heuristic
   over the prop's own velocity (after subtracting ego motion)
   and lateral position — which is enough to make the planner
   reason about "static hazard" vs "cut-in" vs "oncoming". */
const INTENT = {
  PARKED:        'PARKED',
  STATIC_HAZARD: 'STATIC',
  FOLLOWING:     'FOLLOWING',     // moving same direction, slower than ego
  ONCOMING:      'ONCOMING',      // moving toward ego
  CUTTING_IN:    'CUT_IN',        // lateral velocity into ego corridor
  YIELDING:      'YIELDING',      // pedestrian / static target near corridor
};

function classifyIntent(o) {
  // o is a `predicted` entry: { p, vy, halfW, halfL, ... }
  const prop = o.p;
  if (prop.parked) return INTENT.PARKED;
  if (prop.type === 'ped') return INTENT.YIELDING;
  if (prop.type === 'stop' || prop.type === 'light') return INTENT.STATIC_HAZARD;

  // vy convention in predictObstacles: positive = world-frame velocity toward ego (yM decreasing).
  // For a CAR moving the SAME direction as ego, world vy is roughly 0 (we travel +Y so other car
  // travelling +Y stays at constant yM). For an oncoming car, world vy is positive (yM shrinks).
  if (Math.abs(o.vy) < 1.5) {
    // Roughly stationary in world frame. If it's right in our corridor, it's a static hazard.
    return Math.abs(prop.xM - EGO.xM) < 4.5 ? INTENT.STATIC_HAZARD : INTENT.PARKED;
  }
  if (o.vy > 1.5) return INTENT.ONCOMING;

  // Lateral approach? compare to last seen xM (per-id memory)
  const lastX = INTENT._prevX.get(prop.id);
  INTENT._prevX.set(prop.id, prop.xM);
  if (lastX !== undefined) {
    const lateralRate = (prop.xM - lastX);
    const towardCorridor = (prop.xM > EGO.xM) ? -lateralRate : lateralRate;
    if (towardCorridor > 0.05 && Math.abs(prop.xM - EGO.xM) < 9) return INTENT.CUTTING_IN;
  }
  return INTENT.FOLLOWING;
}
INTENT._prevX = new Map();

/* ── Apollo-class Traffic Rules Pipeline ─────────────────────
   Mirrors apollo/modules/planning/traffic_rules.  Each rule is
   pure: it inspects the world and emits a "decision contribution"
   { id, severity, stopAtM, slowToMps, watch, reason }.
   The pipeline aggregates them into a single set of constraints
   that the lattice planner + autoDrive consume.
   Rules implemented (subset of Apollo's set):
     · BACKSIDE_VEHICLE   — defer lane-change if a faster vehicle
                            is approaching from behind in adjacent lane
     · CROSSWALK          — yield to peds within crosswalk influence
     · DESTINATION        — soft cruise-down as terminal nears
     · FRONT_VEHICLE      — maintain dynamic headway
     · KEEP_CLEAR         — hold S-range clear of static blockers
     · STOP_SIGN          — gated stop with creep-out logic
     · TRAFFIC_LIGHT      — protected/unprotected handling
     · YIELD_SIGN         — soft yield at low speed                */
const TRAFFIC_RULES = {
  decisions: [],          // populated each frame
  stopAtM: Infinity,      // hardest stop point
  slowToMps: Infinity,    // softest speed cap
  watchIds: new Set(),    // obstacle ids the rules want monitored
  keepClearZones: [],     // [{ s0, s1, reason }]
};

function runTrafficRules(detections, lidar, predicted) {
  const out = {
    decisions: [],
    stopAtM: Infinity,
    slowToMps: Infinity,
    watchIds: new Set(),
    keepClearZones: [],
  };
  const push = (d) => {
    out.decisions.push(d);
    if (d.stopAtM != null && d.stopAtM < out.stopAtM) out.stopAtM = d.stopAtM;
    if (d.slowToMps != null && d.slowToMps < out.slowToMps) out.slowToMps = d.slowToMps;
    if (d.watchId != null) out.watchIds.add(d.watchId);
    if (d.keepClear) out.keepClearZones.push(d.keepClear);
  };

  // STOP_SIGN — only when sign sits in ego corridor
  const stopSignCorridorM = WORLD.carWidthM / 2 + 1.5;
  const stopSign = detections.find(d => d.class === 'STOP_SIGN' && d.distM < 32 && Math.abs(d.xRelM) < stopSignCorridorM);
  if (stopSign) push({
    id: 'STOP_SIGN', severity: 'HARD',
    stopAtM: stopSign.distM - 2.0,
    reason: `Stop sign · ${stopSign.distM.toFixed(1)} ft`,
  });

  // TRAFFIC_LIGHT — red blocks, yellow soft-caps speed
  const redLight = detections.find(d => d.class === 'TRAFFIC_LIGHT' && d.prop.light === 'red' && d.distM < 36);
  if (redLight) push({
    id: 'TRAFFIC_LIGHT', severity: 'HARD',
    stopAtM: redLight.distM - 3.0,
    reason: `Red signal · ${redLight.distM.toFixed(1)} ft`,
  });
  const yellowLight = detections.find(d => d.class === 'TRAFFIC_LIGHT' && d.prop.light === 'yellow' && d.distM < 30);
  if (yellowLight && !redLight) push({
    id: 'TRAFFIC_LIGHT', severity: 'SOFT',
    slowToMps: comfortSpeedCap(yellowLight.distM, 4.0),
    reason: `Yellow signal · ${yellowLight.distM.toFixed(1)} ft`,
  });

  // CROSSWALK / pedestrian yield (bigger corridor — peds may step in)
  const pedCorridorM = WORLD.carWidthM / 2 + REAL_DIMS.ped.w / 2 + 1.8;
  const ped = detections.find(d => d.class === 'PEDESTRIAN' && Math.abs(d.xRelM) < pedCorridorM && d.distM < 38);
  if (ped) {
    push({
      id: 'CROSSWALK', severity: 'HARD',
      stopAtM: ped.distM - 5.0,
      watchId: ped.prop.id,
      reason: `Pedestrian · ${ped.distM.toFixed(1)} ft`,
    });
  }

  // FRONT_VEHICLE — dynamic headway based on relative velocity
  const carCorridorM = WORLD.carWidthM / 2 + CLASSES.car.real.w / 2 + 0.35;
  const lead = detections
    .filter(d => d.class === 'CAR' && Math.abs(d.xRelM) < carCorridorM)
    .sort((a, b) => a.distM - b.distM)[0];
  if (lead) {
    const desiredGap = 3.4 + EGO.speedMps * 1.05;
    push({
      id: 'FRONT_VEHICLE', severity: lead.distM < desiredGap ? 'HARD' : 'SOFT',
      slowToMps: comfortSpeedCap(lead.distM, desiredGap),
      watchId: lead.prop.id,
      reason: `Lead car · gap ${lead.distM.toFixed(1)} ft (target ${desiredGap.toFixed(1)})`,
    });
  }

  // KEEP_CLEAR — any predicted obstacle inside the lane carves out an S-range
  for (const o of predicted) {
    if (Math.abs(o.p.xM - EGO.xM) < 3.5 && o.p.yM > 0 && o.p.yM < 26) {
      out.keepClearZones.push({
        s0: Math.max(0, o.p.yM - o.longitudinalPad),
        s1: o.p.yM + o.longitudinalPad,
        reason: `keep-clear · ${(CLASSES[o.p.type]?.name || o.p.type).toLowerCase()}`,
        obsId: o.p.id,
      });
    }
  }

  // BACKSIDE_VEHICLE — log only (we don't yet have rear sensors). Hook for parity with Apollo.
  // (In a real stack: search props with yM < 0 in adjacent lanes; defer lateral merges.)

  // DESTINATION — pure visual hook, no constraint yet
  // YIELD_SIGN — none modelled yet; leaving as parity stub

  // Cache for HUD
  TRAFFIC_RULES.decisions = out.decisions;
  TRAFFIC_RULES.stopAtM = out.stopAtM;
  TRAFFIC_RULES.slowToMps = out.slowToMps;
  TRAFFIC_RULES.watchIds = out.watchIds;
  TRAFFIC_RULES.keepClearZones = out.keepClearZones;
  return out;
}

/* ── Apollo-class Scenario Manager + Stage State Machine ─────
   Mirrors apollo/modules/planning/scenarios.  At every tick the
   manager scores each scenario's "is-applicable" predicate and
   activates the highest-priority match.  Active scenario runs
   its stage state machine; transitions are timed and emit
   audit-trail events so the HUD can show "PRE_STOP → STOP" etc.
   Implemented (mapped from Apollo):
     · LANE_FOLLOW                 (default cruise)
     · STOP_SIGN_UNPROTECTED       (PRE_STOP → STOP → CREEP → CRUISE)
     · TRAFFIC_LIGHT_PROTECTED     (APPROACH → STOP → CRUISE)
     · EMERGENCY_PULL_OVER         (APPROACH → SLOW_DOWN → STANDBY)
     · YIELD_SIGN                  (single-stage soft yield)         */
const SCENARIO_MGR = {
  active: { id: 'LANE_FOLLOW', stage: 'CRUISE', enteredAt: performance.now(), stageEnteredAt: performance.now() },
  log: [],            // last N transitions for the HUD
  _stoppedAt: null,
  _creepUntil: 0,
  // Once a scenario clears successfully we mark its trigger object as "consumed"
  // so the manager doesn't re-enter the same scenario for an obstacle we just handled.
  // Apollo enforces a similar guard via reference-line stage progression.
  _consumed: new Set(),
};

const SCENARIO_DEFS = {
  LANE_FOLLOW:                 { priority: 0,  color: '#34d399', stages: ['CRUISE'] },
  STOP_SIGN_UNPROTECTED:       { priority: 80, color: '#f43f5e', stages: ['PRE_STOP', 'STOP', 'CREEP', 'INTERSECTION_CRUISE'] },
  TRAFFIC_LIGHT_PROTECTED:     { priority: 70, color: '#facc15', stages: ['APPROACH', 'STOP', 'CRUISE'] },
  EMERGENCY_PULL_OVER:         { priority: 95, color: '#a78bfa', stages: ['APPROACH', 'SLOW_DOWN', 'STANDBY'] },
  YIELD_SIGN:                  { priority: 40, color: '#fb923c', stages: ['SOFT_YIELD'] },
};

function pushScenarioLog(entry) {
  SCENARIO_MGR.log.unshift({ t: performance.now(), ...entry });
  if (SCENARIO_MGR.log.length > 6) SCENARIO_MGR.log.length = 6;
}

function scenarioEnter(id, stage) {
  const cur = SCENARIO_MGR.active;
  const now = performance.now();
  if (cur.id !== id) {
    pushScenarioLog({ from: `${cur.id}/${cur.stage}`, to: `${id}/${stage}`, kind: 'SCENARIO' });
    SCENARIO_MGR.active = { id, stage, enteredAt: now, stageEnteredAt: now };
    SCENARIO_MGR._stoppedAt = null;
    SCENARIO_MGR._creepUntil = 0;
  } else if (cur.stage !== stage) {
    pushScenarioLog({ from: `${cur.id}/${cur.stage}`, to: `${id}/${stage}`, kind: 'STAGE' });
    cur.stage = stage;
    cur.stageEnteredAt = now;
  }
}

function selectScenario(detections, lidar) {
  // EMERGENCY_PULL_OVER not user-triggered yet → reserved for future hook
  // (Apollo triggers from external_command; we leave stub.)

  const stopSignCorridorM = WORLD.carWidthM / 2 + 1.5;
  const stopSign = detections.find(d => d.class === 'STOP_SIGN' && !SCENARIO_MGR._consumed.has(d.id) && d.distM < 22 && Math.abs(d.xRelM) < stopSignCorridorM);
  const redLight = detections.find(d => d.class === 'TRAFFIC_LIGHT' && !SCENARIO_MGR._consumed.has(d.id) && d.prop.light === 'red' && d.distM < 30);
  const yellowLight = detections.find(d => d.class === 'TRAFFIC_LIGHT' && !SCENARIO_MGR._consumed.has(d.id) && d.prop.light === 'yellow' && d.distM < 24);

  if (stopSign) return { id: 'STOP_SIGN_UNPROTECTED', refSign: stopSign };
  if (redLight || yellowLight) return { id: 'TRAFFIC_LIGHT_PROTECTED', refSign: redLight || yellowLight };
  return { id: 'LANE_FOLLOW' };
}

function updateScenario(detections, lidar) {
  const sel = selectScenario(detections, lidar);
  const cur = SCENARIO_MGR.active;
  const now = performance.now();
  const sinceStage = (now - cur.stageEnteredAt) / 1000;

  if (sel.id === 'LANE_FOLLOW') {
    scenarioEnter('LANE_FOLLOW', 'CRUISE');
    return SCENARIO_MGR.active;
  }

  if (sel.id === 'STOP_SIGN_UNPROTECTED') {
    const distFt = sel.refSign.distM;
    if (cur.id !== 'STOP_SIGN_UNPROTECTED') scenarioEnter('STOP_SIGN_UNPROTECTED', 'PRE_STOP');

    if (cur.stage === 'PRE_STOP') {
      // stop-line crossed: distFt < ~3 ft AND speed near zero → STOP
      if (distFt < 6 && EGO.speedMps < 0.6) scenarioEnter('STOP_SIGN_UNPROTECTED', 'STOP');
    } else if (cur.stage === 'STOP') {
      // dwell ≥ 1.0 s satisfies right-of-way → CREEP
      if (EGO.speedMps < 0.3) {
        if (!SCENARIO_MGR._stoppedAt) SCENARIO_MGR._stoppedAt = now;
        if ((now - SCENARIO_MGR._stoppedAt) > 1000) {
          SCENARIO_MGR._creepUntil = now + 2600;
          scenarioEnter('STOP_SIGN_UNPROTECTED', 'CREEP');
        }
      } else {
        SCENARIO_MGR._stoppedAt = null;
      }
    } else if (cur.stage === 'CREEP') {
      // creep-out window expired or crossed sign → INTERSECTION_CRUISE
      if (now > SCENARIO_MGR._creepUntil || distFt < 1.5) {
        scenarioEnter('STOP_SIGN_UNPROTECTED', 'INTERSECTION_CRUISE');
      }
    } else if (cur.stage === 'INTERSECTION_CRUISE') {
      // sign cleared → return to LANE_FOLLOW
      if (distFt > 14 || sinceStage > 4.0) {
        SCENARIO_MGR._consumed.add(sel.refSign.id);
        scenarioEnter('LANE_FOLLOW', 'CRUISE');
      }
    }
    return SCENARIO_MGR.active;
  }

  if (sel.id === 'TRAFFIC_LIGHT_PROTECTED') {
    const distFt = sel.refSign.distM;
    const isRed = sel.refSign.prop.light === 'red';
    if (cur.id !== 'TRAFFIC_LIGHT_PROTECTED') scenarioEnter('TRAFFIC_LIGHT_PROTECTED', 'APPROACH');

    if (cur.stage === 'APPROACH') {
      if (isRed && distFt < 6 && EGO.speedMps < 0.5) scenarioEnter('TRAFFIC_LIGHT_PROTECTED', 'STOP');
      if (!isRed && distFt < 2) scenarioEnter('TRAFFIC_LIGHT_PROTECTED', 'CRUISE');
    } else if (cur.stage === 'STOP') {
      if (!isRed) scenarioEnter('TRAFFIC_LIGHT_PROTECTED', 'CRUISE');
    } else if (cur.stage === 'CRUISE') {
      if (distFt > 14 || sinceStage > 3.0) {
        SCENARIO_MGR._consumed.add(sel.refSign.id);
        scenarioEnter('LANE_FOLLOW', 'CRUISE');
      }
    }
    return SCENARIO_MGR.active;
  }

  return SCENARIO_MGR.active;
}

/* ── Apollo-class Lattice Trajectory Planner (S-L frame) ────
   Generates a fan of candidate lateral offsets, scores each
   with a multi-term cost function, and picks the minimum-cost
   collision-free trajectory.  The S-coordinate is longitudinal
   distance along the reference line; L is the lateral offset.
   Each candidate trajectory is a cosine-interpolated quintic
   polynomial approximation from the current ego L to the
   target L over a blending distance proportional to the
   lateral displacement. */
function planPath(dt) {
  const lateralLimit = drivableLateralLimit();

  // ── Perception: gather obstacles (include recently-passed ones for proper guard logic) ──
  const obs = props.filter(p =>
    (p.type === 'car' || p.type === 'ped') &&
    p.yM > -14.0 && p.yM < AUTO.pathRangeM + 10 &&
    Math.abs(p.xM - EGO.xM) < WORLD.roadHalfM + 6.0
  );

  // Nearest ahead obstacle = primary route threat (for display / speed control)
  AUTO.routeThreat = obs
    .filter(p => p.yM > 1)
    .sort((a, b) => a.yM - b.yM)[0] || null;

  // ── Multi-threat tracking ──
  // Prune obstacles that have fully cleared (rear edge > 8 ft behind ego front)
  AUTO.activeThreats = new Set([...AUTO.activeThreats].filter(id => {
    const ob = obs.find(p => p.id === id);
    if (!ob) return false;
    const dims = REAL_DIMS[ob.type] || { l: 12 };
    const halfL = (dims.l || dims.w || 2) / 2;
    return (ob.yM - halfL) > -8.0; // still not fully cleared
  }));
  // Add any obstacle that's in our corridor range
  for (const o of obs.filter(p => p.yM > -2 && p.yM < AUTO.pathRangeM)) {
    AUTO.activeThreats.add(o.id);
  }

  // ── Prediction ──
  const predicted = predictObstacles(obs, dt || 0.016);
  AUTO._predicted = predicted; // expose for planSpeedProfile in autoDrive

  // ── Candidate lateral targets (L_target in Frenet frame) ──
  const step = 1.0; // tighter granularity
  const candidates = [];
  for (let L = -lateralLimit; L <= lateralLimit; L += step) {
    candidates.push(L);
  }
  // Ensure we can use the absolute edges of the drivable space if needed
  candidates.push(-lateralLimit);
  candidates.push(lateralLimit);
  // Always include exact lane center and current position
  candidates.push(AUTO.laneCenterX);
  candidates.push(EGO.xM);
  // Deduplicate close values
  candidates.sort((a, b) => a - b);

  let bestPath = null;
  let minCost = Infinity;
  let bestTarget = AUTO.laneCenterX;

  // ── Cost weights (tuned for passenger comfort) ──
  const W_LANE    = 1.2;   // lane-center deviation
  const W_SMOOTH  = 2.5;   // penalize large lateral jumps from previous target
  const W_RISK    = 12.0;  // soft proximity risk
  const W_BOUNDARY = 8.0;  // penalty for nearing road boundary

  for (const L_target of candidates) {
    if (Math.abs(L_target) > lateralLimit) continue;

    const path = [];
    let cost = 0;
    let collision = false;

    // Lane deviation cost (quadratic — matches Apollo EM planner)
    cost += W_LANE * (L_target - AUTO.laneCenterX) ** 2 / (lateralLimit ** 2 + 1);

    // Smoothness / hysteresis cost — penalize switching targets
    if (AUTO._lastTargetL !== undefined) {
      cost += W_SMOOTH * Math.abs(L_target - AUTO._lastTargetL) / (lateralLimit + 1);
    }

    // Boundary cost — discourage hugging the edge
    const boundaryDist = lateralLimit - Math.abs(L_target);
    if (boundaryDist < 3.0) {
      cost += W_BOUNDARY * (1 - boundaryDist / 3.0);
    }

    // ── Generate S-L polynomial trajectory ──
    // Smoother swerves (longer blend distance) to prevent running into the car it's passing
    const blendDist = Math.max(16.0, Math.abs(L_target - EGO.xM) * 3.5);

    for (let i = 0; i < AUTO.pathSteps; i++) {
      const s = (i / (AUTO.pathSteps - 1)) * AUTO.pathRangeM;

      // Cosine interpolation (approximates quintic polynomial curvature)
      const t = Math.min(1, s / blendDist);
      const smoothT = 0.5 - 0.5 * Math.cos(Math.PI * t);

      let l = EGO.xM * (1 - smoothT) + L_target * smoothT;
      l = Math.max(-lateralLimit, Math.min(lateralLimit, l));

      path.push({ xM: l, yM: s });

      // ── Obstacle cost evaluation at this S station ──
      for (const o of predicted) {
        // Use predicted position for dynamic obstacles, current for static
        const obsY = (o.p.parked || o.p.type === 'ped') ? o.p.yM : o.predictedY;
        if (Math.abs(s - obsY) > o.longitudinalPad) continue;

        const latDist = Math.abs(l - o.p.xM);

        if (latDist < o.clearance) {
          // If we are already inside the box (e.g. at s=0), don't discard the path entirely.
          // Add a massive penalty proportional to overlap so the planner
          // still picks the trajectory that gets out of the box the fastest.
          const overlap = o.clearance - latDist;
          cost += 10000 + overlap * 5000;
        } else if (latDist < o.clearance + 3.5) {
          // Soft risk — inverse-distance cost (Apollo-style repulsive potential)
          const gap = latDist - o.clearance;
          cost += W_RISK / (gap + 0.15);
        }
      }
    }

    if (cost < minCost) {
      minCost = cost;
      bestPath = path;
      bestTarget = L_target;
    }
  }

  // ── Multi-threat pass-guard ──
  // Don't return toward center while ANY active threat hasn't fully cleared.
  // This prevents premature lane-merge when still alongside or behind an obstacle.
  const prevLat    = AUTO._lastTargetL ?? AUTO.laneCenterX;
  const prevOffset = Math.abs(prevLat - AUTO.laneCenterX);
  const newOffset  = Math.abs(bestTarget - AUTO.laneCenterX);
  if (prevOffset > 1.5 && newOffset < prevOffset - 0.8) {
    const anyUnclear = [...AUTO.activeThreats].some(id => {
      const o = obs.find(p => p.id === id);
      if (!o) return false;
      const dims = REAL_DIMS[o.type] || { l: 12, w: 6 };
      const halfL = (dims.l || dims.w || 2) / 2;
      return (o.yM - halfL) > -5.0; // rear hasn't cleared ego by 5 ft yet
    });
    if (anyUnclear) {
      bestTarget = prevLat;
      const lockedBlend = Math.max(16.0, Math.abs(bestTarget - EGO.xM) * 3.5);
      bestPath = [];
      for (let i = 0; i < AUTO.pathSteps; i++) {
        const s = (i / (AUTO.pathSteps - 1)) * AUTO.pathRangeM;
        const t = Math.min(1, s / lockedBlend);
        const smoothT = 0.5 - 0.5 * Math.cos(Math.PI * t);
        let l = EGO.xM * (1 - smoothT) + bestTarget * smoothT;
        l = Math.max(-lateralLimit, Math.min(lateralLimit, l));
        bestPath.push({ xM: l, yM: s });
      }
    }
  }

  AUTO._lastTargetL = bestTarget;

  // ── Blocked detection: no collision-free path exists → signal stop ──
  // Cost >= 9500 means even the best candidate has a collision overlap.
  AUTO.pathBlocked = (minCost >= 9500);

  // ── Fallback: if every candidate collides, hold current path or go straight ──
  if (!bestPath) {
    if (AUTO.plannedPath && AUTO.plannedPath.length >= AUTO.pathSteps) {
      return AUTO.plannedPath;
    }
    bestPath = [];
    for (let i = 0; i < AUTO.pathSteps; i++) {
      bestPath.push({ xM: EGO.xM, yM: (i / (AUTO.pathSteps - 1)) * AUTO.pathRangeM });
    }
  }

  // Anchor first point to ego bumper for visual continuity
  if (bestPath.length > 0) bestPath[0].xM = EGO.xM;

  return bestPath;
}

/* ── S-T Longitudinal Speed Profile (Apollo-style) ─────────
   Generates a trapezoidal speed profile along the planned path
   so autoDrive can follow it instead of just reacting to the
   nearest obstacle.  Stored in AUTO.speedProfile as an array
   of { s, vMax } tuples the controller samples at look-ahead. */
function planSpeedProfile(predicted, path = AUTO.plannedPath) {
  const profile = [];
  const cruiseV = AUTO.targetSpeedMps;
  const decel = EGO.brakeMps2 * 0.85; // comfort decel

  for (let i = 0; i < AUTO.pathSteps; i++) {
    const s = (i / (AUTO.pathSteps - 1)) * AUTO.pathRangeM;
    let vMax = cruiseV;
    const pathIdx = Math.min((path?.length || 1) - 1, Math.max(0, i));
    const lOnPath = path && path[pathIdx] ? path[pathIdx].xM : EGO.xM;

    for (const o of predicted) {
      // Only constrain speed for obstacles that overlap this path station laterally.
      if (Math.abs(lOnPath - o.p.xM) > o.clearance) continue;
      const gap = o.p.yM - s;
      if (gap < 0 || gap > 30) continue;
      // v ≤ sqrt(2 * a * d)  — kinematic comfort cap
      const cap = Math.sqrt(2 * decel * Math.max(0, gap - 2.0));
      vMax = Math.min(vMax, cap);
    }
    profile.push({ s, vMax });
  }
  AUTO.speedProfile = profile;
}

function autoDrive(detections, lidar, dt) {
  AUTONOMY.throttle = 0;
  AUTO.decisionOverride = null;

  const stopSignCorridorM = WORLD.carWidthM / 2 + 1.5;
  const stopSign = detections.find(d => d.class === 'STOP_SIGN' && d.distM < 26 && Math.abs(d.xRelM) < stopSignCorridorM);
  const redLight = detections.find(d => d.class === 'TRAFFIC_LIGHT' && d.prop.light === 'red' && d.distM < 30);
  const stopAhead = stopSign || redLight;
  const pedBlock = blockingPed(detections);
  const carLead = primaryLeadCar(detections);
  const routableCar = !!(
    carLead &&
    (carLead.prop.parked || (AUTO.routeThreat && AUTO.routeThreat.id === carLead.prop.id))
  );

  let vCmd = AUTO.targetSpeedMps;

  // Path fully blocked → stop (no collision-free route around obstacles)
  if (AUTO.pathBlocked) {
    const nearestThreatY = AUTO.routeThreat ? AUTO.routeThreat.yM : 5;
    vCmd = Math.min(vCmd, comfortSpeedCap(Math.max(0.5, nearestThreatY), 1.5));
  }

  // ── Physics-based maneuver budget ────────────────────────────────────────
  // Works on ANY routeThreat regardless of whether it's inside primaryLeadCar's
  // corridor — this is the fix for shoulder cars that bypass all other speed logic.
  //
  // Principle: the ego must complete its lateral displacement BEFORE it arrives
  // at the obstacle. If it can't steer fast enough at current speed, slow down
  // until the math works out:
  //   steerTime  = lateralNeeded / (steerMps × 0.65)   [65% real-world efficiency]
  //   maxSpeed   = (obstacleY − 1.5) / (steerTime + 1.5s buffer)
  //
  // Once laterally clear, allow a moderate passing speed.
  if (AUTO.routeThreat && !AUTO.pathBlocked) {
    const threat = AUTO.routeThreat;
    const threatDims = REAL_DIMS[threat.type] || { w: 6.5, l: 12 };
    const safePassSep = WORLD.carWidthM / 2 + (threatDims.w || 6.5) / 2 + 0.15;
    const laterallyCleared = Math.abs(EGO.xM - threat.xM) >= safePassSep;

    if (!laterallyCleared && threat.yM > 0) {
      const latNeeded = Math.abs((AUTO._lastTargetL ?? AUTO.laneCenterX) - EGO.xM);
      const steerTimeS = latNeeded / (EGO.steerMps * 0.65);
      // Arrive at obstacle no sooner than steer completes + 1.5 s safety buffer
      const maneuverV = Math.max(1.0, (threat.yM - 1.5) / (steerTimeS + 1.5));
      vCmd = Math.min(vCmd, maneuverV);
    } else if (laterallyCleared && threat.yM > 0 && threat.yM < 30) {
      // Laterally clear — cruise past at moderate passing speed
      vCmd = Math.min(vCmd, Math.max(4.0, AUTO.targetSpeedMps * 0.55));
    }
  }

  // S-T longitudinal speed profile: cap cruise speed based on upcoming obstacle distances
  if (AUTO._predicted) planSpeedProfile(AUTO._predicted);
  if (AUTO.speedProfile && AUTO.speedProfile.length > 0) {
    const lookPt = AUTO.speedProfile.find(sp => sp.s >= AUTO.lookAheadM);
    if (lookPt) vCmd = Math.min(vCmd, lookPt.vMax);
  }

  // Apollo traffic-rules pipeline contributes both a speed cap and a stop point.
  if (TRAFFIC_RULES.slowToMps < Infinity) vCmd = Math.min(vCmd, TRAFFIC_RULES.slowToMps);
  if (TRAFFIC_RULES.stopAtM < Infinity) {
    vCmd = Math.min(vCmd, comfortSpeedCap(Math.max(0.5, TRAFFIC_RULES.stopAtM), 0.5));
  }

  // Apollo scenario-stage controls stop-sign + traffic-light dwell behaviour.
  const scen = SCENARIO_MGR.active;
  if (scen.id === 'STOP_SIGN_UNPROTECTED') {
    if (scen.stage === 'STOP') vCmd = 0;
    else if (scen.stage === 'CREEP') vCmd = Math.min(vCmd, 1.85);
  } else if (scen.id === 'TRAFFIC_LIGHT_PROTECTED' && scen.stage === 'STOP') {
    vCmd = 0;
  } else if (scen.id === 'EMERGENCY_PULL_OVER') {
    vCmd = scen.stage === 'STANDBY' ? 0 : Math.min(vCmd, 2.5);
  }

  const lidarIsRelevant = lidar.distM != null && (!lidar.hit || lidar.corridorHit);
  if (lidarIsRelevant && lidar.distM < 22) {
    vCmd = Math.min(vCmd, comfortSpeedCap(lidar.distM, 1.15));
  }

  if (stopAhead) {
    const margin = stopAhead.class === 'STOP_SIGN' ? 2.0 : 3.0;
    vCmd = Math.min(vCmd, comfortSpeedCap(stopAhead.distM, margin));
  }

  if (pedBlock) {
    vCmd = Math.min(vCmd, comfortSpeedCap(pedBlock.distM, 5.2));
  }

  // Is the planner actively routing around this car with a valid path?
  const plannerIsRouting = routableCar && AUTO._lastTargetL !== undefined &&
    Math.abs(AUTO._lastTargetL - (carLead ? carLead.prop.xM : 0)) > 3.0;

  if (carLead && !routableCar) {
    // Car directly in corridor and no route around — brake to maintain headway
    vCmd = Math.min(vCmd, comfortSpeedCap(carLead.distM, 6.8));
  } else if (carLead && routableCar && !plannerIsRouting) {
    // Routable but planner hasn't diverged yet — maintain headway
    const desiredGap = 3.4 + EGO.speedMps * 1.05;
    const headwayLim = Math.max(1.2, (carLead.distM - desiredGap) * 1.05);
    vCmd = Math.min(vCmd, Math.min(AUTO.targetSpeedMps, headwayLim));
  }
  // (when plannerIsRouting, the maneuver budget above already governs speed)

  // Stop-sign creep: schedule once so the timer is not refreshed every frame (prior bug).
  if (stopSign) {
    const d = stopSign.distM;
    if (d > 14) {
      AUTO._stoppedAt = null;
      AUTO._creepScheduled = false;
      AUTO._creepUntil = 0;
    }
    if (d < 11 && EGO.speedMps < 0.24) {
      AUTO._stoppedAt = AUTO._stoppedAt || performance.now();
      if (!AUTO._creepScheduled && performance.now() - AUTO._stoppedAt > 1000) {
        AUTO._creepScheduled = true;
        AUTO._creepUntil = performance.now() + 2600;
      }
    }
    if (AUTO._creepScheduled && performance.now() < AUTO._creepUntil && d < 11 && d > 3.2 && EGO.speedMps < 5) {
      vCmd = Math.max(vCmd, 1.85);
    }
    if (d > 14.5 && AUTO._creepScheduled) {
      AUTO._creepScheduled = false;
      AUTO._stoppedAt = null;
    }
  } else {
    AUTO._stoppedAt = null;
    AUTO._creepScheduled = false;
    AUTO._creepUntil = 0;
  }

  const dv = vCmd - EGO.speedMps;
  if (dv > 0.035) {
    AUTONOMY.throttle = Math.min(1, dv / 2.6 + 0.08);
  } else if (dv < -0.055) {
    AUTONOMY.throttle = Math.max(-1, dv / 2.05);
  } else {
    AUTONOMY.throttle = 0;
  }

  const mustHaltVisual = !!(
    stopAhead ||
    (pedBlock && pedBlock.distM < 11) ||
    (carLead && !routableCar && carLead.distM < 8.5)
  );

  if (AUTO.routeThreat && !mustHaltVisual && !(pedBlock && pedBlock.distM < 18)) {
    const cls = CLASSES[AUTO.routeThreat.type].name;
    AUTO.decisionOverride = {
      state: 'LATTICE PLANNER',
      reason: `S-L polynomial trajectory · ${cls.toLowerCase()} @ ${Math.max(0, AUTO.routeThreat.yM).toFixed(1)} ft`,
      color: '#22d3ee'
    };
  }

  let mode = 'AUTO CRUISE';
  if (pedBlock && vCmd < AUTO.targetSpeedMps - 0.4) mode = 'YIELD · PED';
  else if (carLead && !routableCar && vCmd < AUTO.targetSpeedMps - 0.45) mode = 'FOLLOW';
  else if (stopAhead && EGO.speedMps < 0.35 && stopAhead.distM < 10) mode = 'HELD · SIGN/LIGHT';
  else if (AUTO._creepScheduled && stopSign && performance.now() < AUTO._creepUntil) mode = 'CREEP · STOP';
  else if (dv < -2.1) mode = 'BRAKE';
  else if (AUTONOMY.throttle > 0.08 && vCmd > EGO.speedMps + 0.2) mode = 'ACCEL';

  AUTO.mode = mode;
  if (AUTO.decisionOverride) AUTO.mode = 'LATTICE PLANNER';

  /* ── Pure-pursuit style lateral tracker ──────────────────
     Sample multiple look-ahead points on the planned path,
     weight nearer ones more heavily so the car both tracks
     the immediate curve AND anticipates the upcoming one.
     Look-ahead distance scales with speed so the car plans
     further ahead when moving fast. */
  let targetX = AUTO.laneCenterX;
  let targetYM = AUTO.lookAheadM;
  if (AUTO.plannedPath.length > 2) {
    // Speed-adaptive look-ahead: 6 ft at rest, up to 18 ft at cruise
    const baseLook = 6.0 + EGO.speedMps * 0.9;
    const nearLook = Math.min(AUTO.pathRangeM, baseLook);
    const farLook  = Math.min(AUTO.pathRangeM, baseLook * 2.0);

    const sampleAt = (dist) => {
      const frac = dist / AUTO.pathRangeM;
      const idx = Math.min(
        AUTO.plannedPath.length - 1,
        Math.max(0, Math.round(frac * (AUTO.plannedPath.length - 1)))
      );
      return AUTO.plannedPath[idx];
    };

    const near = sampleAt(nearLook);
    const far  = sampleAt(farLook);

    // Blend: 70% near target, 30% far target for anticipation
    targetX = near.xM * 0.7 + far.xM * 0.3;
    targetYM = near.yM * 0.7 + far.yM * 0.3;
  }
  AUTO._lastTargetX = targetX;
  AUTO._lastTargetY = targetYM;

  // Proportional + derivative-like steering for crisp response
  const dx = targetX - EGO.xM;
  const steerP = dx * 1.8;
  // Damping: resist rapid steering oscillation
  const steerD = (dx - (AUTO._prevDx || 0)) * 0.6;
  AUTO._prevDx = dx;
  AUTONOMY.steer = Math.max(-1, Math.min(1, steerP + steerD));

  setDriveControl('up', false);
  setDriveControl('down', false);
  setDriveControl('left', false);
  setDriveControl('right', false);
}

/* ── Catmull-Rom smooth polyline helper ──────────────────────
   Renders a smooth spline through screen-space {x,y} points.
   tension=0.5 gives natural road-following curvature. */
function drawCatmullRom(ctx, pts, tension = 0.5) {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  if (pts.length === 2) { ctx.lineTo(pts[1].x, pts[1].y); return; }
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) * tension / 3;
    const cp1y = p1.y + (p2.y - p0.y) * tension / 3;
    const cp2x = p2.x - (p3.x - p1.x) * tension / 3;
    const cp2y = p2.y - (p3.y - p1.y) * tension / 3;
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
  }
}

/* Render the planned route in the driver HUD so the semi-autonomous
   behavior is obvious in the left preview, not only in the editor. */
function renderHudPlannedPath(ctx) {
  if (!AUTO.plannedPath || AUTO.plannedPath.length < 2) return;
  // Subsample to every 4th point — enough for a smooth spline, avoids jitter
  const raw = AUTO.plannedPath
    .filter((_, i) => i % 4 === 0 || i === AUTO.plannedPath.length - 1)
    .map(p => hudGroundPoint(p.xM - EGO.xM, p.yM))
    .filter(Boolean);
  if (raw.length < 2) return;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Outer glow pass
  ctx.shadowColor = '#22d3ee';
  ctx.shadowBlur = 22;
  ctx.strokeStyle = 'rgba(34,211,238,0.18)';
  ctx.lineWidth = 14;
  drawCatmullRom(ctx, raw);
  ctx.stroke();

  // Bright core line
  ctx.shadowBlur = 6;
  ctx.strokeStyle = 'rgba(103,232,249,0.95)';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([14, 9]);
  drawCatmullRom(ctx, raw);
  ctx.stroke();
  ctx.setLineDash([]);

  const target = hudGroundPoint(AUTO._lastTargetX - EGO.xM, AUTO._lastTargetY);
  if (target) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(target.x, target.y, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#67e8f9';
    ctx.font = '10px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('LATTICE TRAJ', target.x, target.y - 10);
  }
  ctx.restore();
}

/* Render the planned path on top of the scene canvas */
/* ── Avoid-zone overlay ──────────────────────────────────────
   Draws danger envelopes around every active threat.
   - Obstacles ahead  → red/orange "danger" fill + pulsing border
   - Obstacles passing/just cleared → amber "caution" fade
   - Fully cleared    → brief green "cleared" flash then gone
   Also draws a swept "keep-out" corridor band behind the car
   showing the width of the lane the planner avoided. */
function renderAvoidZones() {
  if (!AUTO.activeThreats || AUTO.activeThreats.size === 0) return;
  const ctx = sceneCtx;
  const now = performance.now();

  for (const id of AUTO.activeThreats) {
    const p = props.find(o => o.id === id);
    if (!p) continue;

    const dims = REAL_DIMS[p.type] || { w: 6.5, l: 12 };
    const halfW = (dims.w || dims.l || 2) / 2;
    const halfL = (dims.l || dims.w || 2) / 2;
    // Clearance envelope = same formula as planner
    const clearance = halfW + WORLD.carWidthM * 0.5 + 0.15;

    const rearY  = p.yM - halfL;  // negative = behind ego front bumper
    const frontY = p.yM + halfL;

    // Obstacle center and left/right envelope edges in world coords
    const envLeft  = p.xM - clearance;
    const envRight = p.xM + clearance;

    // Extend zone behind ego to show the swept keep-out band the car just drove past
    const zoneRearY  = Math.min(rearY, -SCENE_VIEW.rearM * 0.6);
    const zoneFrontY = frontY;

    // Corner points in scene coords
    const tl = worldToScene(envLeft,  zoneFrontY);
    const tr = worldToScene(envRight, zoneFrontY);
    const bl = worldToScene(envLeft,  zoneRearY);
    const br = worldToScene(envRight, zoneRearY);

    // Determine state
    const isAhead   = rearY > 0;           // obstacle still fully ahead
    const isPassing = rearY <= 0 && rearY > -halfL * 2; // rear inside/just past
    // choose colour
    let zoneColor, borderColor, alpha;
    if (isAhead) {
      // Red danger zone
      zoneColor  = `rgba(239,68,68,`;
      borderColor = '#ef4444';
      alpha = 0.13;
    } else if (isPassing) {
      // Amber — car is alongside or just cleared
      zoneColor  = `rgba(251,146,60,`;
      borderColor = '#fb923c';
      alpha = 0.10;
    } else {
      // Green cleared — fade quickly
      const clearFrac = Math.min(1, (-rearY - halfL * 2) / 6);
      if (clearFrac >= 1) continue; // fully gone
      zoneColor  = `rgba(34,197,94,`;
      borderColor = '#22c55e';
      alpha = (1 - clearFrac) * 0.08;
    }

    ctx.save();

    // Swept corridor fill (rectangle from ahead to behind ego)
    ctx.beginPath();
    ctx.moveTo(tl.px, tl.py);
    ctx.lineTo(tr.px, tr.py);
    ctx.lineTo(br.px, br.py);
    ctx.lineTo(bl.px, bl.py);
    ctx.closePath();
    ctx.fillStyle = `${zoneColor}${alpha})`;
    ctx.fill();

    // Dashed border around the obstacle's *own* bounding box
    const otl = worldToScene(envLeft,  frontY);
    const otr = worldToScene(envRight, frontY);
    const obl = worldToScene(envLeft,  rearY);
    const obr = worldToScene(envRight, rearY);
    const pulse = 0.55 + 0.45 * Math.sin(now * 0.006);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = isAhead ? pulse * 0.85 : 0.45;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(otl.px, otl.py);
    ctx.lineTo(otr.px, otr.py);
    ctx.lineTo(obr.px, obr.py);
    ctx.lineTo(obl.px, obl.py);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    // Obstacle-center crosshair
    if (isAhead || isPassing) {
      const center = worldToScene(p.xM, p.yM);
      ctx.globalAlpha = isAhead ? 0.7 * pulse : 0.35;
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1;
      const cs = 6;
      ctx.beginPath();
      ctx.moveTo(center.px - cs, center.py); ctx.lineTo(center.px + cs, center.py);
      ctx.moveTo(center.px, center.py - cs); ctx.lineTo(center.px, center.py + cs);
      ctx.stroke();

      // Distance annotation inside zone
      const dist = Math.max(0, rearY).toFixed(0);
      ctx.globalAlpha = isAhead ? 0.8 : 0.45;
      ctx.fillStyle = borderColor;
      ctx.font = 'bold 9px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${dist}ft`, center.px, otl.py - 5);
    }

    ctx.restore();
  }
}

function renderPlannedPath() {
  if (!AUTO.plannedPath || AUTO.plannedPath.length < 2) return;
  const ctx = sceneCtx;
  // Subsample for smooth spline — every 3rd point
  const scenePts = AUTO.plannedPath
    .filter((_, i) => i % 3 === 0 || i === AUTO.plannedPath.length - 1)
    .map(p => { const s = worldToScene(p.xM, p.yM); return { x: s.px, y: s.py }; });

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Outer glow
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.16)';
  ctx.lineWidth = 16;
  drawCatmullRom(ctx, scenePts);
  ctx.stroke();

  // Mid stroke
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.55)';
  ctx.lineWidth = 4;
  drawCatmullRom(ctx, scenePts);
  ctx.stroke();

  // Crisp dashed centerline
  ctx.strokeStyle = '#67e8f9';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 8]);
  drawCatmullRom(ctx, scenePts);
  ctx.stroke();
  ctx.setLineDash([]);

  // Look-ahead target marker
  if (AUTO._lastTargetX != null) {
    const s = worldToScene(AUTO._lastTargetX, AUTO._lastTargetY);
    ctx.fillStyle = '#22d3ee';
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(s.px, s.py, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/* ── Main loop ─────────────────────────────────────────────── */
let lastT = performance.now();
let frames = 0, fpsLastT = lastT, fps = 0;

function loop(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  frames++;
  if (now - fpsLastT > 500) {
    fps = Math.round((frames * 1000) / (now - fpsLastT));
    fpsEl.textContent = `${fps} fps`;
    frames = 0;
    fpsLastT = now;
  }

  const detections = detectAll();
  const lidar = lidarReading();
  const decision = makeDecision(detections, lidar, dt || 0.016);
  window.__lastDecision = decision;

  AUTO.plannedPath = planPath(dt || 0.016); // single authoritative plan — used by autoDrive AND renderer
  // Apollo-class decision pipeline: scenario manager + traffic rules feed autoDrive.
  updateScenario(detections, lidar);
  runTrafficRules(detections, lidar, AUTO._predicted || []);
  autoDrive(detections, lidar, dt || 0.016);

  updateEgo(dt || 0.016);
  // No second planPath call — rendered path now matches the decision path exactly

  pushDist(lidar.distM);

  // Decision priority: scenario state > hazard decision > lattice override.
  const scenDecision = decisionFromScenario(null);
  let displayDecision;
  if (scenDecision && !['STOP', 'BRAKE', 'YIELD'].includes(decision.state)) {
    displayDecision = scenDecision;
  } else if (
    AUTO.decisionOverride &&
    !['STOP', 'BRAKE', 'YIELD'].includes(decision.state)
  ) {
    displayDecision = AUTO.decisionOverride;
  } else {
    displayDecision = decision;
  }

  renderHUD(detections, lidar);
  renderScene(detections, lidar);
  renderAvoidZones();
  renderPlannedPath();
  renderSpark();
  renderTelemetry(detections, lidar, displayDecision);
  emitPacket(detections, lidar);

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/* ── Theme sync (parent portfolio) ─────────────────────────── */
window.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'theme-change') {
    document.documentElement.style.colorScheme = e.data.mode;
  }
});
