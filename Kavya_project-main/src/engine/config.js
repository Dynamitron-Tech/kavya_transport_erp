/**
 * BABYLON ENGINE — Master Configuration
 * ══════════════════════════════════════
 * Single source of truth for the cinematic Babylon.js scene.
 * Golden-hour highway realism — NOT neon/cyber.
 *
 * Visual Target: European-style highway at golden hour,
 * warm directional sun, atmospheric haze, calm powerful movement.
 */

/* ── Device detection ── */
export const IS_MOBILE =
  typeof window !== 'undefined' &&
  (/Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    window.innerWidth < 768)

// [PERF-FIX] Centralized device tiering to drive deterministic quality settings.
export function getDeviceTier(engine) {
  const connection = typeof navigator !== 'undefined' ? navigator.connection : null
  const effectiveType = connection?.effectiveType || ''
  const saveData = !!connection?.saveData
  if (saveData || effectiveType === '2g' || effectiveType === 'slow-2g') {
    return 'low'
  }

  const uaMobile =
    typeof window !== 'undefined' &&
    /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

  const maxTextureSize = engine?.getCaps?.().maxTextureSize || (uaMobile ? 4096 : 8192)

  if (uaMobile || maxTextureSize <= 4096) return 'low'
  if (!uaMobile && maxTextureSize > 8192) return 'high'
  return 'balanced'
}

/* ═══════════════════════════════════════
   CAMERA — 360° Orbit Rig (anchored to truck)
   ═══════════════════════════════════════ */
export const CAMERA = {
  // Orbit parameters
  ORBIT_RADIUS: 14,           // distance from truck center
  ORBIT_HEIGHT: 4.0,          // base height above truck
  LOOK_AT_HEIGHT: 1.8,        // look at truck body center
  FOV: 0.9,
  FOV_MIN: 0.72,
  FOV_MAX: 0.95,
  NEAR: 0.3,
  FAR: 800,
  // Spring follow constants
  FOLLOW_LERP: 0.08,
  LOOK_LERP: 0.06,
  // Micro shake — ENHANCED for turbo sequences
  SHAKE_AMPLITUDE: 0.018,
  SHAKE_ROT_AMPLITUDE: 0.005,
  // Inertia damping — smoother cinematic movement
  INERTIA_DAMPING: 4.5,
  INERTIA_ROT_DAMPING: 3.5,
  // Orbit rotation: full 360° over the scroll
  ORBIT_REVOLUTIONS: 1,       // number of full 360° rotations over scroll 0→1
}

/* ═══════════════════════════════════════
   CAMERA ORBIT KEYFRAMES — cinematic orbit per scroll
   ═══════════════════════════════════════
   angle: radians offset added to the base orbit angle
   radius: multiplier on ORBIT_RADIUS
   height: camera height above truck
   fovMul: FOV multiplier
*/
export const CAMERA_KEYFRAMES = [
  // ═══ SECTION 0: CINEMATIC INTRO — distant truck rushes toward camera ═══
  { t: 0.00, alpha: Math.PI * 0.95, beta: 1.08, radius: 45, targetY: 3.5, fov: 0.60 },
  // Truck approaching — dramatic zoom in
  { t: 0.04, alpha: Math.PI * 0.92, beta: 1.15, radius: 28, targetY: 2.8, fov: 0.75 },
  // HERO REVEAL — snap to low angle behind, ground-level power shot
  { t: 0.08, alpha: Math.PI,        beta: 1.42, radius: 12, targetY: 0.4, fov: 0.92 },
  // ═══ SECTION 1: THREE-QUARTER BEAUTY — truck identity showcase ═══
  { t: 0.14, alpha: Math.PI * 0.65, beta: 1.18, radius: 11, targetY: 1.5, fov: 0.85 },
  // ═══ SECTION 2: BRANDING CLOSE-UP — camera sweeps to container side ═══
  { t: 0.22, alpha: Math.PI * 0.50, beta: 1.22, radius: 7,  targetY: 2.2, fov: 0.78 },
  // SECTION 2b: Branding hold — linger on KAVYA TRANSPORTS text
  { t: 0.28, alpha: Math.PI * 0.48, beta: 1.20, radius: 8,  targetY: 2.0, fov: 0.80 },
  // ═══ SECTION 3: FRONT HERO — low dramatic looking up at truck ═══
  { t: 0.35, alpha: Math.PI * 0.20, beta: 1.38, radius: 9,  targetY: 0.6, fov: 0.82 },
  // ═══ SECTION 4: HIGH AERIAL — gods-eye cinematic sweep ═══
  { t: 0.42, alpha: Math.PI * 0.35, beta: 0.55, radius: 22, targetY: 3.0, fov: 0.72 },
  // Aerial descent — swooping down dramatically
  { t: 0.48, alpha: Math.PI * 0.55, beta: 0.85, radius: 14, targetY: 2.0, fov: 0.80 },
  // ═══ SECTION 5: TURBO BURST — tight rear chase during peak speed ═══
  { t: 0.53, alpha: Math.PI * 0.98, beta: 1.30, radius: 8,  targetY: 1.2, fov: 0.65 },
  // Speed rush — FOV compresses, camera shakes more
  { t: 0.58, alpha: Math.PI * 1.02, beta: 1.28, radius: 7,  targetY: 1.0, fov: 0.58 },
  // ═══ SECTION 6: SIDE TRACKING — full truck profile at speed ═══
  { t: 0.65, alpha: Math.PI * 1.50, beta: 1.15, radius: 14, targetY: 1.8, fov: 0.90 },
  // ═══ SECTION 7: OPPOSITE BRANDING — other side container view ═══
  { t: 0.72, alpha: Math.PI * 1.52, beta: 1.20, radius: 8,  targetY: 2.0, fov: 0.78 },
  // ═══ SECTION 8: WIDE CINEMATIC — golden hour beauty shot ═══
  { t: 0.80, alpha: Math.PI * 1.25, beta: 0.92, radius: 20, targetY: 2.5, fov: 0.98 },
  // ═══ SECTION 9: SUNSET LOW — dramatic silhouette angle ═══
  { t: 0.88, alpha: Math.PI * 0.85, beta: 1.40, radius: 10, targetY: 0.5, fov: 0.85 },
  // ═══ FINALE: MAJESTIC PULL-AWAY — truck recedes into night ═══
  { t: 0.95, alpha: Math.PI * 0.80, beta: 1.15, radius: 16, targetY: 2.0, fov: 0.88 },
  // End hold — wide establishing shot
  { t: 1.00, alpha: Math.PI * 0.78, beta: 0.95, radius: 30, targetY: 4.0, fov: 0.70 },
]

/* ═══════════════════════════════════════
   LIGHTING
   ═══════════════════════════════════════ */
export const LIGHTING = {
  SUN: {
    DIRECTION: [-0.3, -0.85, 0.4],   // raised sun angle — less harsh shadows
    INTENSITY: 2.0,                    // FIX3: reduced to prevent truck front blow-out
    COLOR: [0.88, 0.93, 1.0],         // cool daylight highlight
    POSITION: [15, 50, -20],           // higher sun position
  },
  FILL: {
    DIRECTION: [0, 1, 0],
    INTENSITY: 0.6,                    // FIX1: raised ambient fill to soften shadow contrast
    SKY_COLOR: [0.48, 0.62, 0.86],    // Sky bounce in brand blue range
    GROUND_COLOR: [0.38, 0.30, 0.22], // Warm earth bounce for ground
  },
  SHADOW: {
    MAP_SIZE: IS_MOBILE ? 1024 : 2048,
    DARKNESS: 0.55,                    // FIX1: raised transparency = lighter, softer shadows
    BLUR_KERNEL: 32,
    BIAS: -0.001,                      // FIX1: negative bias reduces shadow acne on ground
    FRUSTUM_SIZE: 60,
  },
}

/* ═══════════════════════════════════════
   FOG
   ═══════════════════════════════════════ */
export const FOG = {
  COLOR: [0.831, 0.659, 0.510], // FIX2: warm dusk horizon haze (#D4A882)
  DENSITY: 0.00022,             // Reduced further to prevent washout
  MODE: 2,                      // BABYLON.Scene.FOGMODE_EXP2
}

/* ═══════════════════════════════════════
   TONE MAPPING & POST-PROCESSING
   ═══════════════════════════════════════ */
export const POST = {
  TONE_MAPPING_ENABLED: true,
  EXPOSURE: 0.85,                  // FIX2+5: reduced exposure → richer colors, less blown highlights
  EXPOSURE_MIN: 0.75,
  EXPOSURE_MAX: 0.95,
  CONTRAST: 1.18,                  // Controlled contrast for clean highlights
  VIGNETTE_WEIGHT: 3.6,            // Slightly softer edge darkening
  VIGNETTE_STRETCH: 0.6,
  GLOW_INTENSITY: 0.05,            // FIX5: drastically reduced to prevent bloom halo on truck
  GLOW_BLUR_SIZE: IS_MOBILE ? 16 : 48,
  // Film grain
  GRAIN_INTENSITY: 0.035,
  // Color temperature shift through scroll
  TEMP_START: [1.0, 1.0, 1.0],
  TEMP_MID:   [0.97, 1.0, 1.05],    // Slight cool shift
  TEMP_END:   [0.94, 0.98, 1.08],   // Blue-white finish
}

/* ═══════════════════════════════════════
   ROAD
   ═══════════════════════════════════════ */
export const ROAD = {
  WIDTH: 12,
  LENGTH: 400,                          // ↑ longer road for full coverage around truck
  SEGMENTS_W: 2,
  SEGMENTS_L: 100,
  Y: 0.08,                              // ↑ raised above terrain to guarantee visibility
  ASPHALT_COLOR: [0.14, 0.13, 0.12],  // Dark asphalt — higher contrast
  ROUGHNESS: 0.75,
  ROUGHNESS_SPEED_MIN: 0.60,
  METALLIC: 0,
  LINE_COLOR: [0.95, 0.95, 0.95],
  YELLOW_LINE_COLOR: [1.0, 0.82, 0.0],
  SHOULDER_COLOR: [0.42, 0.36, 0.28],  // Darker brown shoulder for depth separation
  // Lane dash geometry (used for motion illusion)
  DASH_LEN: 3,
  DASH_GAP: 5,
  DASH_PITCH: 8,                        // DASH_LEN + DASH_GAP  (tile unit)
}

/* ═══════════════════════════════════════
   TERRAIN
   ═══════════════════════════════════════ */
export const TERRAIN = {
  SIZE: 600,
  SUBDIVISIONS: IS_MOBILE ? 64 : 128,
  COLOR: [0.55, 0.42, 0.28],   // Warm dry earth brown
  ROUGHNESS: 0.92,
}

/* ═══════════════════════════════════════
   MOUNTAINS
   ═══════════════════════════════════════ */
export const MOUNTAINS = {
  LAYERS: [
    { distance: 200, count: 8, scaleY: [25, 40], color: [0.22, 0.18, 0.12], opacity: 0.40 },
    { distance: 150, count: 10, scaleY: [18, 30], color: [0.28, 0.22, 0.15], opacity: 0.55 },
    { distance: 110, count: 12, scaleY: [12, 22], color: [0.35, 0.28, 0.18], opacity: 0.75 },
  ],
}

/* ═══════════════════════════════════════
   TRUCK
   ═══════════════════════════════════════ */
export const TRUCK = {
  GLB_PATH: '/assets/truckfglb.glb',
  SCALE: 8.0,
  POSITION: [0, 0.1, 0],     // ANCHOR — truck stays at origin
  ROTATION_Y: 0,              // truckfglb.glb is already correctly oriented
  // Animation intensities — CRANKED UP for cinematic impact
  SWAY_AMPLITUDE: 0.012,
  BOUNCE_AMPLITUDE: 0.035,
  EXHAUST_RATE: 120,
  HEADLIGHT_INTENSITY: 1.8,
  HEADLIGHT_ANGLE: 0.6,
  // Tire rotation
  WHEEL_RADIUS: 0.3,
  // Dust particles — MORE dramatic
  DUST_RATE: 80,
  DUST_THRESHOLD: 0.3,
  // Volumetric headlight cone — BIGGER, brighter
  HL_CONE_LENGTH: 5,
  HL_CONE_OPACITY: 0.04,
  // ── Cabin vs Trailer flex — MORE dramatic ──
  CABIN_FLEX_SPEED: 3.0,
  TRAILER_FLEX_SPEED: 1.2,
  CABIN_FLEX_AMP: 0.007,
  TRAILER_FLEX_AMP: 0.004,
  // ── Suspension load shift — HEAVIER feel ──
  LOAD_SHIFT_PITCH: 0.012,
  LOAD_SHIFT_BRAKE_PITCH: 0.010,
  LOAD_SHIFT_SMOOTH: 3.0,
  // ── Tyre deformation — MORE visible ──
  TYRE_SQUASH: 0.05,
  TYRE_STRETCH: 0.035,
  // ── Headlight dust particles — DENSER ──
  HL_DUST_RATE: 30,
  HL_DUST_SIZE: [0.03, 0.12],
  // ── Heat distortion — STRONGER ──
  HEAT_DISTORTION_MAX: 0.005,
  // ══ CINEMATIC INTRO SEQUENCE ══
  INTRO_ENABLED: true,
  INTRO_DURATION: 2.8,         // seconds for truck zoom-in
  INTRO_START_Z: -120,         // truck starts far behind
  INTRO_START_SCALE: 0.01,     // starts tiny, grows to full
  // ══ TURBO BURST ══
  TURBO_PROGRESS_START: 0.50,  // scroll progress when turbo begins
  TURBO_PROGRESS_END: 0.62,    // scroll progress when turbo ends
  TURBO_SPEED_MULT: 2.5,       // speed multiplier during turbo
  TURBO_EXHAUST_MULT: 4.0,     // exhaust intensity multiplier
  TURBO_SHAKE: 0.025,          // camera shake during turbo
}

/* ═══════════════════════════════════════
   WORLD MOTION — scroll → world speed
   ═══════════════════════════════════════ */
export const WORLD = {
  MAX_SPEED: 35,
  DECELERATION: 3.0,
  ACCELERATION: 3.5,
  // Scroll speed mapping — CINEMATIC PACING with turbo burst
  SPEED_CURVE: [
    { t: 0.00, speed: 0.0 },   // INTRO: standing still, dramatic reveal
    { t: 0.04, speed: 0.05 },  // gentle rumble start
    { t: 0.10, speed: 0.25 },  // building power
    { t: 0.18, speed: 0.50 },  // cruising — branding visible
    { t: 0.30, speed: 0.65 },  // controlled speed
    { t: 0.42, speed: 0.55 },  // aerial section — slightly slower
    { t: 0.50, speed: 0.85 },  // TURBO BUILD-UP
    { t: 0.55, speed: 1.00 },  // TURBO PEAK — maximum speed!
    { t: 0.60, speed: 0.95 },  // sustained turbo
    { t: 0.65, speed: 0.70 },  // turbo wind-down
    { t: 0.75, speed: 0.55 },  // gentle cruise — beauty shots
    { t: 0.85, speed: 0.35 },  // sunset deceleration
    { t: 0.92, speed: 0.12 },  // approaching night
    { t: 1.00, speed: 0.0 },   // final rest
  ],
  // ── ENHANCED: Wind system ──
  WIND_BASE: 0.3,               // base wind at all times
  WIND_SPEED_SCALE: 1.5,        // additional wind from truck speed
  WIND_FREQUENCY: 0.008,        // spatial frequency of wind noise
  // ── ENHANCED: Ground dust trails ──
  GROUND_DUST_THRESHOLD: 0.6,   // speedNorm threshold for dust
  GROUND_DUST_RATE: 60,         // particles per second
  GROUND_DUST_SIZE: [0.3, 1.0], // particle size range
}

/* ═══════════════════════════════════════
   SKY
   ═══════════════════════════════════════ */
export const SKY = {
  TOP_COLOR: [0.10, 0.16, 0.40],     // Deep midnight blue at zenith
  MID_COLOR: [0.35, 0.40, 0.58],     // Hazy atmospheric blue
  HORIZON_COLOR: [0.75, 0.55, 0.30], // Warm amber-orange at horizon (Tamil Nadu sky)
  SUN_GLOW_COLOR: [1.0, 0.90, 0.60], // Warm golden sun glow
  SIZE: 500,
}

/* ═══════════════════════════════════════
   SCROLL SECTIONS (for overlay sync)
   ═══════════════════════════════════════ */
export const SECTIONS = [
  { id: 0, name: 'hero',       start: 0.00, end: 0.08 },
  { id: 1, name: 'about',      start: 0.08, end: 0.18 },
  { id: 2, name: 'services',   start: 0.18, end: 0.29 },
  { id: 3, name: 'fleet',      start: 0.29, end: 0.39 },
  { id: 4, name: 'industries', start: 0.39, end: 0.48 },
  { id: 5, name: 'clients',    start: 0.48, end: 0.57 },
  { id: 6, name: 'network',    start: 0.57, end: 0.67 },
  { id: 7, name: 'why',        start: 0.67, end: 0.77 },
  { id: 8, name: 'locations',  start: 0.77, end: 0.87 },
  { id: 9, name: 'cta',        start: 0.87, end: 1.00 },
]

/* ═══════════════════════════════════════
   PAUSE RANGES (camera breathing)
   ═══════════════════════════════════════ */
export const CAMERA_PAUSE_RANGES = [
  [0.00, 0.08],
  [0.16, 0.24],
  [0.38, 0.42],
  [0.54, 0.58],
  [0.74, 0.78],
  [0.92, 1.00],
]

export function isInPauseRange(t) {
  for (const [start, end] of CAMERA_PAUSE_RANGES) {
    if (t >= start && t <= end) return true
  }
  return false
}

/* ═══════════════════════════════════════
   CINEMATIC EFFECTS (master-class layer)
   ═══════════════════════════════════════ */
export const CINEMATIC = {
  // Volumetric sun rays
  SUN_RAYS_OPACITY: IS_MOBILE ? 0 : 0.08,
  SUN_RAYS_COUNT: 5,
  // Road curvature illusion (S)
  ROAD_CURVATURE: 0.0008,
  // Shadow softening at speed (P)
  SHADOW_BLUR_SPEED_BOOST: 12,
  // Speed dust near tires
  TIRE_DUST_SIZE: [0.15, 0.5],
  // Parallax horizon drift (M)
  SKY_PARALLAX_FACTOR: 0.985,
  // Sun position shift through scroll (U)
  SUN_START_Y: -0.85,
  SUN_END_Y: -0.55,
  // Rim light (L)
  RIM_LIGHT_BASE: 0.05,
  RIM_LIGHT_MAX: 0.35,
}

/* ═══════════════════════════════════════
   ATMOSPHERE — Volumetric fog, particles, sun rays
   ═══════════════════════════════════════ */
export const ATMOSPHERE = {
  // Floating dust motes
  DUST_COUNT: IS_MOBILE ? 80 : 200,
  DUST_SIZE: [0.03, 0.12],
  DUST_OPACITY: 0.35,
  DUST_SPREAD: 30,           // volume radius around truck
  DUST_SPEED: 0.3,           // base drift speed
  // Volumetric fog planes
  FOG_LAYERS: IS_MOBILE ? 2 : 4,
  FOG_NEAR_OPACITY: 0.04,
  FOG_FAR_OPACITY: 0.08,
  FOG_LAYER_SPACING: 40,
  // Sun rays
  SUN_RAY_ENABLED: !IS_MOBILE,
  SUN_RAY_SAMPLES: 64,
  SUN_RAY_WEIGHT: 0.18,
  SUN_RAY_DECAY: 0.97,
  SUN_RAY_DENSITY: 0.8,
  // Motion streaks (speed lines)
  STREAK_COUNT: IS_MOBILE ? 0 : 30,
  STREAK_LENGTH: 4,
  STREAK_SPEED_THRESHOLD: 0.5,
  STREAK_OPACITY: 0.12,
}

/* ═══════════════════════════════════════
   ADVANCED POST-PROCESSING
   ═══════════════════════════════════════ */
export const ADVANCED_POST = {
  // Depth of field
  DOF_ENABLED: !IS_MOBILE,
  DOF_FOCAL_LENGTH: 50,
  DOF_FSTOP: 5.6,
  DOF_FOCUS_DISTANCE: 14000,   // in mm, ~14m to truck
  DOF_MAX_BLUR: 0.4,
  // Chromatic aberration — cranked for turbo sequences
  CHROMATIC_ENABLED: !IS_MOBILE,
  CHROMATIC_BASE: 0,
  CHROMATIC_SPEED_MAX: 15,     // max aberration at full speed — DRAMATIC
  // Motion blur
  MOTION_BLUR_ENABLED: !IS_MOBILE,
  MOTION_BLUR_STRENGTH: 0.15,
  // Sharpen
  SHARPEN_ENABLED: true,
  SHARPEN_AMOUNT: 0.15,
  // FXAA
  FXAA_ENABLED: true,
}

/* ═══════════════════════════════════════
   LENS FLARE
   ═══════════════════════════════════════ */
export const LENS_FLARE = {
  ENABLED: !IS_MOBILE,
  SIZE: 0.3,
  ELEMENTS: 6,
}

/* ═══════════════════════════════════════
   UI MOTION SYSTEM
   ═══════════════════════════════════════ */
export const UI_MOTION = {
  // Speed-reactive typography
  LETTER_SPACING_MAX: 8,       // px at full speed
  TEXT_DRIFT_Y: -12,            // px upward drift at speed
  TEXT_OPACITY_SPEED_BOOST: 0.15,
  // Magnetic buttons
  MAGNETIC_RADIUS: 120,         // px attract radius
  MAGNETIC_STRENGTH: 0.25,
  // Glass panels
  GLASS_BLUR: 16,               // px backdrop-filter blur
  GLASS_OPACITY: 0.08,          // background opacity
  // Cursor physics
  CURSOR_REPEL_RADIUS: 80,      // px
  CURSOR_REPEL_STRENGTH: 15,    // px displacement
}

/* ═══════════════════════════════════════
   NIGHT MODE
   ═══════════════════════════════════════ */
export const NIGHT_MODE = {
  TRANSITION_START: 0.82,       // scroll progress when night begins
  TRANSITION_END: 0.92,         // when fully night
  AMBIENT_COLOR: [0.12, 0.14, 0.22],
  FOG_COLOR: [0.18, 0.20, 0.32],
  SKY_TOP: [0.08, 0.10, 0.24],
  SKY_HORIZON: [0.20, 0.22, 0.35],
  HEADLIGHT_BOOST: 3.0,         // multiplier for headlight intensity
  STARS_COUNT: IS_MOBILE ? 50 : 200,
}
