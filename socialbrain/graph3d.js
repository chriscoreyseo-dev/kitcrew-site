// The 3D brain itself: layout, rendering, interaction.
// No framework, no bundler - plain ES modules against three.js from a CDN.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// Shell radius per depth: root at the centre, platforms close in, individual
// videos out on the rim. This is what gives it the branching-neuron read.
const RADIUS = [0, 42, 92, 158];
const BASE_SIZE = [4.2, 2.6, 1.5, 0.8];

// Fallback hue, and the single colour used in 'unified' mode.
const UNIFIED = '#b98cff';
const WHITE = new THREE.Color(0xffffff);

// Smootherstep: zero velocity AND zero acceleration at both ends, so a camera
// move has no visible kick when it starts or stops.
const EASE = (t) => t * t * t * (t * (t * 6 - 15) + 10);

// Frame-rate independent exponential smoothing. `rate` is roughly "how many
// e-foldings per second" - higher is snappier.
const approach = (current, target, dt, rate) => current + (target - current) * (1 - Math.exp(-dt * rate));

// Final post pass: a gentle vignette pulls the eye to the orb, and a whisper
// of animated grain stops the big dark areas banding. Both deliberately subtle.
const VignetteGrainShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + uTime) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float d = distance(vUv, vec2(0.5));
      c.rgb *= mix(0.66, 1.04, smoothstep(0.86, 0.30, d));
      c.rgb += (hash(vUv * vec2(1917.0, 1201.0)) - 0.5) * 0.016;
      gl_FragColor = c;
    }`,
};

// Deterministic jitter, so the same graph always lays out the same way.
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Evenly spread directions on a sphere - no clumping at the poles.
function fibonacciDirection(i, total) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const y = total === 1 ? 0 : 1 - (i / (total - 1)) * 2;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = golden * i;
  return new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r);
}

export class Brain {
  constructor(container) {
    this.container = container;
    this.nodes = [];
    this.links = [];
    this.byId = new Map();
    this.selectedId = null;
    this.hoverIndex = -1;
    this.metric = 'score';
    // 'category' = each main category gets its own hue (the default).
    // 'unified'  = everything violet, the original monochrome planetary look.
    this.colorMode = 'category';
    // Whether the chosen metric also drives platform and branch node sizes.
    this.sizeCategories = true;
    this.filters = { platforms: new Set(), newOnly: false, query: '' };
    this.spin = true;
    this.settleWork = 0;
    this.clock = new THREE.Clock();
    this.flight = null;
    this.listeners = { select: [], hover: [] };
    // Decorative layers, with their design opacity, so focus can quiet them.
    this.decor = [];
    this.decorFade = 1;

    this._initScene();
    this._initPost();
    this._initPicking();

    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    this._animate();
  }

  on(event, fn) {
    this.listeners[event]?.push(fn);
    return this;
  }

  _emit(event, payload) {
    for (const fn of this.listeners[event] ?? []) fn(payload);
  }

  // ---------------------------------------------------------------- scene

  _initScene() {
    const { clientWidth: w, clientHeight: h } = this.container;

    this.scene = new THREE.Scene();
    // Slightly heavy on purpose: depth cueing is what separates the near rim
    // from the far rim, and without it a dense sphere reads as flat noise.
    this.scene.fog = new THREE.FogExp2(0x080410, 0.0034);

    this.camera = new THREE.PerspectiveCamera(58, w / h, 0.5, 4000);
    this.camera.position.set(0, 70, 330);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.setClearColor(0x080410, 1);
    this.container.appendChild(this.renderer.domElement);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(w, h);
    this.labelRenderer.domElement.className = 'label-layer';
    this.container.appendChild(this.labelRenderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 12;
    this.controls.maxDistance = 900;
    this.controls.addEventListener('start', () => {
      this.flight = null;
    });

    this.scene.add(new THREE.AmbientLight(0xffffff, 1.4));

    this.world = new THREE.Group();
    this.scene.add(this.world);

    this._addBackdrop();
    this._addStarfield();
    this._addShells();
    this._addPlates();
    this._addFilaments();
    this._addArcs();
    this._addSparkles();
    this._addDust();
    this._addCore();
  }

  // Soft volumetric dust drifting inside the orb. It fills the empty space
  // between the shells with atmosphere, which is what makes a close-in camera
  // feel like it is INSIDE a nebula rather than parked next to wireframe.
  _addDust() {
    const rand = rng(881);
    for (const [count, size, opacity] of [
      [70, 26, 0.05],
      [34, 46, 0.038],
      [14, 78, 0.028],
    ]) {
      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);
      const c = new THREE.Color();
      for (let i = 0; i < count; i++) {
        const dir = new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize();
        dir.multiplyScalar(28 + rand() ** 0.8 * 150);
        positions.set([dir.x, dir.y, dir.z], i * 3);
        // Violet body with occasional magenta pockets.
        c.setHex(rand() > 0.78 ? 0xd946ef : 0x8b5cf6).multiplyScalar(0.5 + rand() * 0.5);
        colors.set([c.r, c.g, c.b], i * 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      this.world.add(
        this._decorate(
          new THREE.Points(
            geo,
            new THREE.PointsMaterial({
              map: this._glowTexture(),
              size,
              vertexColors: true,
              transparent: true,
              opacity,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
              sizeAttenuation: true,
              toneMapped: false,
            }),
          ),
          0.85,
        ),
      );
    }
  }

  // Register a decorative object so selecting something can fade it back.
  // Close-in framing puts plates and filaments between the camera and the data;
  // without this the subcategories you just flew to are buried under scenery.
  _decorate(object, factor = 1) {
    this.decor.push({ material: object.material, base: object.material.opacity, factor });
    return object;
  }

  // --- the holographic furniture -------------------------------------------
  // None of this is data. It is what makes the graph read as one dense violet
  // orb rather than a scatter plot: plates, filaments, arcs and sparkles layered
  // on the same shells the data sits on. All of it lives in `world` so it turns
  // with the graph, and none of it is raycast against.

  // Deep violet-to-black void, so the graph reads as a body in space.
  _addBackdrop() {
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0.0, '#180c2e');
    g.addColorStop(0.45, '#0c0618');
    g.addColorStop(1.0, '#04020a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 256);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;

    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(2600, 24, 16),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false }),
    );
    this.scene.add(sky);
  }

  _glowTexture() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0.0, 'rgba(243,230,255,1)');
    g.addColorStop(0.18, 'rgba(192,132,252,0.6)');
    g.addColorStop(0.45, 'rgba(147,51,234,0.2)');
    g.addColorStop(1.0, 'rgba(126,34,206,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // Neutral white falloff for halos and pulses - the violet-tinted texture
  // above would pollute the category hues (rose x violet = mud).
  _whiteGlowTexture() {
    if (this._whiteGlow) return this._whiteGlow;
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0.0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.5)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.12)');
    g.addColorStop(1.0, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    this._whiteGlow = tex;
    return tex;
  }

  // The core. Small and very bright - the middle reads hot because of the
  // spiral and the falloff, not because of raw size.
  _addCore() {
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this._glowTexture(),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        opacity: 0.6,
        toneMapped: false,
      }),
    );
    halo.scale.setScalar(84);
    this.scene.add(halo);
    this.halo = halo;

    // A second, huge, very faint halo reads as atmosphere around the body.
    const atmosphere = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this._glowTexture(),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        opacity: 0.13,
        toneMapped: false,
      }),
    );
    atmosphere.scale.setScalar(RADIUS[3] * 2.2);
    this.scene.add(atmosphere);

    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(4.4, 3),
      new THREE.MeshBasicMaterial({ color: 0xfaf2ff, toneMapped: false }),
    );
    this.scene.add(core);
    this.core = core;

    // A helix through the middle - the vortex at the heart of the orb.
    const pts = [];
    for (let i = 0; i <= 340; i++) {
      const t = i / 340;
      const a = t * Math.PI * 2 * 5;
      const r = 2.5 + t * 16;
      pts.push(new THREE.Vector3(Math.cos(a) * r, (t - 0.5) * 19, Math.sin(a) * r));
    }
    this.spiral = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 340, 0.2, 6, false),
      new THREE.MeshBasicMaterial({
        color: 0xc084fc,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.scene.add(this.spiral);

    this.coreCages = [];
    for (const [radius, tilt, speed] of [
      [9, 0.4, 0.6],
      [13.5, -1.1, -0.38],
      [19.5, 2.2, 0.22],
    ]) {
      const cage = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.15, 6, 110),
        new THREE.MeshBasicMaterial({
          color: 0xb388ff,
          transparent: true,
          opacity: 0.7,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      cage.rotation.x = tilt;
      cage.userData.speed = speed;
      this.scene.add(cage);
      this.coreCages.push(cage);
    }
  }

  // Fine lengthwise circuitry drawn onto every plate. Without this the slabs
  // are flat rectangles; with it they read as panels with structure, which is
  // most of the difference between "glowing blobs" and "detailed".
  _plateTexture() {
    const w = 128;
    const h = 32;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const rand = rng(4242);

    // Mid-grey base, NOT black: the material is additive, so a black base
    // would make the plate body disappear and leave only hairlines.
    ctx.fillStyle = 'rgba(255,255,255,0.42)';
    ctx.fillRect(0, 0, w, h);

    // Darker gaps carved out of the body, so the plate reads as segmented.
    for (let i = 0; i < 9; i++) {
      const x = Math.floor(rand() * w);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(x, 0, 1 + Math.floor(rand() * 2), h);
    }
    // Bright lengthwise traces.
    for (let i = 0; i < 6; i++) {
      const y = Math.floor(rand() * h);
      const x0 = Math.floor(rand() * w * 0.5);
      const len = Math.floor(w * (0.3 + rand() * 0.7));
      ctx.fillStyle = `rgba(255,255,255,${(0.7 + rand() * 0.3).toFixed(2)})`;
      ctx.fillRect(x0, y, len, 1);
    }
    // Pads and cross ticks.
    for (let i = 0; i < 20; i++) {
      const x = Math.floor(rand() * w);
      const y = Math.floor(rand() * h);
      ctx.fillStyle = `rgba(255,255,255,${(0.6 + rand() * 0.4).toFixed(2)})`;
      if (rand() > 0.55) ctx.fillRect(x, y, 1, 1 + Math.floor(rand() * 4));
      else ctx.fillRect(x, y, 1 + Math.floor(rand() * 3), 1);
    }
    // Bright rails top and bottom.
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fillRect(0, 0, w, 1);
    ctx.fillRect(0, h - 1, w, 1);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }

  // Flat tangent slabs scattered over the shells. This is the single biggest
  // contributor to the "circuitry wrapped on a planet" read.
  _addPlates() {
    const COUNT = 680;
    const rand = rng(101);
    const mesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: this._plateTexture(),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
      COUNT,
    );
    mesh.frustumCulled = false;

    const dummy = new THREE.Object3D();
    const c = new THREE.Color();
    for (let i = 0; i < COUNT; i++) {
      const dir = new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize();
      const radius = 46 + rand() ** 0.7 * (RADIUS[3] * 1.06 - 46);
      dummy.position.copy(dir).multiplyScalar(radius);
      dummy.lookAt(0, 0, 0); // lie flat against the sphere surface
      dummy.rotateZ(rand() * Math.PI);
      const long = 2 + rand() ** 2 * 16;
      dummy.scale.set(long, 0.6 + rand() * 4.5, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      c.setHex(rand() > 0.93 ? 0xf3e0ff : 0xa855f7).multiplyScalar(0.18 + rand() ** 1.4 * 1.0);
      mesh.setColorAt(i, c);
    }
    mesh.instanceMatrix.needsUpdate = true;
    this.world.add(this._decorate(mesh));
  }

  // Tiny bright specks - the glitter that stops the shells looking like mesh.
  _addSparkles() {
    const rand = rng('2026'.length + 613);
    this.sparkleLayers = [];
    for (const [count, size, brightness] of [
      [2400, 0.85, 0.55],
      [900, 1.8, 0.8],
      [240, 3.3, 1.0],
    ]) {
      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);
      const c = new THREE.Color();
      for (let i = 0; i < count; i++) {
        const dir = new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize();
        const radius = 34 + rand() ** 0.6 * (RADIUS[3] * 1.1 - 34);
        dir.multiplyScalar(radius);
        positions.set([dir.x, dir.y, dir.z], i * 3);
        c.setHex(rand() > 0.8 ? 0xf5e6ff : 0xa855f7).multiplyScalar(brightness * (0.35 + rand() * 0.65));
        colors.set([c.r, c.g, c.b], i * 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const points = new THREE.Points(
        geo,
        new THREE.PointsMaterial({
          size,
          vertexColors: true,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          sizeAttenuation: true,
          toneMapped: false,
        }),
      );
      // Each layer breathes on its own period, so the field shimmers instead
      // of pulsing as one flat sheet.
      points.userData.twinkle = { base: 0.9, amp: 0.22, rate: 0.5 + this.sparkleLayers.length * 0.37 };
      this.world.add(points);
      this.sparkleLayers.push(points);
    }
  }

  // Sweeping partial great-circle arcs. Faded at both ends so they read as
  // light streaks crossing the orb rather than as wire hoops, plus a few solid
  // rings for the hard concentric orbital circles.
  _addArcs() {
    const rand = rng(31);
    const ARCS = 40;
    const SEG = 84;
    const positions = [];
    const colors = [];
    const c = new THREE.Color();
    const n = new THREE.Vector3();
    const u = new THREE.Vector3();
    const v = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);

    for (let a = 0; a < ARCS; a++) {
      n.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize();
      u.crossVectors(up, n);
      if (u.lengthSq() < 1e-4) u.set(1, 0, 0);
      u.normalize();
      v.crossVectors(n, u).normalize();

      const radius = 50 + rand() * (RADIUS[3] * 1.14 - 50);
      const start = rand() * Math.PI * 2;
      const sweep = (0.4 + rand() * 1.5) * Math.PI;
      const heat = 0.2 + rand() ** 1.5 * 0.75;

      let prev = null;
      for (let i = 0; i <= SEG; i++) {
        const t = i / SEG;
        const ang = start + sweep * t;
        const p = u
          .clone()
          .multiplyScalar(Math.cos(ang) * radius)
          .addScaledVector(v, Math.sin(ang) * radius);
        const fade = Math.sin(t * Math.PI) ** 0.65;
        if (prev) {
          positions.push(prev.x, prev.y, prev.z, p.x, p.y, p.z);
          c.setHex(0xa855f7).multiplyScalar(heat * fade);
          colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
        }
        // Graduation ticks every 7th segment, standing off the arc radially -
        // reads as an instrument dial rather than a plain hoop.
        if (i % 7 === 0 && fade > 0.25) {
          const long = i % 28 === 0;
          const outer = p.clone().multiplyScalar(long ? 1.035 : 1.016);
          positions.push(p.x, p.y, p.z, outer.x, outer.y, outer.z);
          c.setHex(long ? 0xf0dcff : 0xa855f7).multiplyScalar(heat * fade * (long ? 1.5 : 0.9));
          colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
        }
        prev = p;
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    this.world.add(
      this._decorate(new THREE.LineSegments(
        geo,
        new THREE.LineBasicMaterial({
          vertexColors: true,
          transparent: true,
          opacity: 0.62,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        }),
      )),
    );

    this.rings = [];
    for (const [radius, opacity, tilt, spin] of [
      [RADIUS[3] * 0.78, 0.3, 0.55, 0.16],
      [RADIUS[3] * 0.97, 0.22, -1.25, 0.4],
      [RADIUS[2] * 0.92, 0.26, -0.35, -0.7],
    ]) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.33, 6, 190),
        new THREE.MeshBasicMaterial({
          color: 0xb06cf0,
          transparent: true,
          opacity,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      ring.rotation.set(tilt, tilt * 0.6, tilt * 0.3);
      ring.userData.spin = spin * 0.0012;
      this.world.add(this._decorate(ring));
      this.rings.push(ring);
    }
  }

  // Radial streaks plus short tangential shards. Radials give the orb its
  // sense of depth; tangentials break up the shells so they do not look bare.
  _addFilaments() {
    const RADIAL = 620;
    const TANGENT = 900;
    const positions = new Float32Array((RADIAL + TANGENT) * 6);
    const colors = new Float32Array((RADIAL + TANGENT) * 6);
    const rand = rng(19);
    const c = new THREE.Color();
    let o = 0;

    const push = (a, b, headHex, head, tail) => {
      positions.set([a.x, a.y, a.z, b.x, b.y, b.z], o * 6);
      c.setHex(headHex).multiplyScalar(head);
      colors.set([c.r, c.g, c.b], o * 6);
      c.setHex(headHex).multiplyScalar(tail);
      colors.set([c.r, c.g, c.b], o * 6 + 3);
      o++;
    };

    for (let i = 0; i < RADIAL; i++) {
      const dir = new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize();
      const inner = 20 + rand() ** 1.4 * 110;
      const outer = inner + 14 + rand() ** 1.8 * 110;
      const heat = 0.08 + rand() ** 2 * 0.7;
      push(dir.clone().multiplyScalar(inner), dir.clone().multiplyScalar(outer), 0xa855f7, heat, heat * 0.08);
    }

    const tmpA = new THREE.Vector3();
    for (let i = 0; i < TANGENT; i++) {
      const dir = new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize();
      const radius = 44 + rand() ** 0.7 * (RADIUS[3] * 1.05 - 44);
      const a = dir.clone().multiplyScalar(radius);
      // Any vector orthogonal to dir gives a tangent direction on the shell.
      tmpA.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).cross(dir).normalize();
      const b = a.clone().addScaledVector(tmpA, 2 + rand() ** 2 * 22).setLength(radius);
      const heat = 0.06 + rand() ** 2.2 * 0.55;
      push(a, b, rand() > 0.9 ? 0xf0dcff : 0x8b3fd4, heat, heat * 0.35);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.world.add(
      this._decorate(new THREE.LineSegments(
        geo,
        new THREE.LineBasicMaterial({
          vertexColors: true,
          transparent: true,
          opacity: 0.62,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        }),
      )),
    );
  }

  // Two faint lat/long cages so the silhouette reads as a sphere.
  _addShells() {
    for (const [radius, opacity, segs] of [
      [RADIUS[3] * 1.1, 0.05, [40, 26]],
      [RADIUS[2] * 1.05, 0.03, [28, 18]],
    ]) {
      const geo = new THREE.SphereGeometry(radius, segs[0], segs[1]);
      this.world.add(
        this._decorate(new THREE.LineSegments(
          new THREE.WireframeGeometry(geo),
          new THREE.LineBasicMaterial({
            color: 0x9d4edd,
            transparent: true,
            opacity,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
          }),
        )),
      );
      geo.dispose();
    }
  }

  _addStarfield() {
    const count = 900;
    const positions = new Float32Array(count * 3);
    const rand = rng(7);
    for (let i = 0; i < count; i++) {
      const dir = new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1)
        .normalize()
        .multiplyScalar(760 + rand() * 900);
      positions.set([dir.x, dir.y, dir.z], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.scene.add(
      new THREE.Points(
        geo,
        // Soft round stars instead of hard square points.
        new THREE.PointsMaterial({
          color: 0x3a2c5e,
          size: 2.2,
          sizeAttenuation: true,
          map: this._glowTexture(),
          transparent: true,
          opacity: 0.8,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      ),
    );
  }

  _initPost() {
    const { clientWidth: w, clientHeight: h } = this.container;
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    // Threshold matters more than strength here: a high-ish threshold keeps the
    // filigree crisp and only lets the genuinely hot pixels bleed.
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.8, 0.9, 0.24);
    this.composer.addPass(this.bloom);
    this.vignette = new ShaderPass(VignetteGrainShader);
    this.composer.addPass(this.vignette);
    this.composer.addPass(new OutputPass());
  }

  _initPicking() {
    this.raycaster = new THREE.Raycaster();
    this.raycaster.params.Points.threshold = 2;
    this.pointer = new THREE.Vector2(-10, -10);
    this.pointerOnScreen = false;

    const el = this.renderer.domElement;
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      this.pointerOnScreen = true;
      this._pointerPx = { x: e.clientX - r.left, y: e.clientY - r.top };
    });
    el.addEventListener('pointerleave', () => {
      this.pointerOnScreen = false;
      this._setHover(-1);
    });
    el.addEventListener('click', () => {
      if (this.hoverIndex >= 0) this.select(this.nodes[this.hoverIndex].id, { fly: true });
      else this.select(null);
    });
    el.addEventListener('dblclick', () => {
      if (this.hoverIndex >= 0) {
        const node = this.nodes[this.hoverIndex];
        if (node.url) window.open(node.url, '_blank', 'noopener');
      }
    });
  }

  // ----------------------------------------------------------------- data

  setData(graph) {
    this._teardownGraph();

    this.nodes = graph.nodes.map((n) => ({ ...n }));
    this.links = graph.links;
    this.byId = new Map(this.nodes.map((n) => [n.id, n]));
    this.nodes.forEach((n, i) => {
      n.index = i;
      // Animated state. `tint` is brightness (1 lit, ~0.14 dimmed), `emph` is
      // the selected/hovered highlight, `size` is the rendered radius. Every
      // visual change moves a target and the loop eases the current value to
      // it - nothing about a selection is allowed to snap.
      n.tint = 1;
      n.tintTarget = 1;
      n.emph = 0;
      n.emphTarget = 0;
      n.size = 0;
      n.sizeTarget = 0;
    });

    this.platformIds = this.nodes.filter((n) => n.type === 'platform').map((n) => n.id);
    if (!this.filters.platforms.size) {
      this.platformIds.forEach((id) => this.filters.platforms.add(this.byId.get(id).platform));
    }

    this._computeMetricRanges();
    this._seedPositions();
    this._buildMeshes();
    this._buildLabels();

    this.settleWork = 420; // relaxation iterations left to run, animated
    this.refreshVisuals();
  }

  _teardownGraph() {
    if (this.points) {
      this.world.remove(this.points);
      this.points.geometry.dispose();
      this.points.material.dispose();
      this.points = null;
    }
    if (this.lines) {
      this.world.remove(this.lines);
      this.lines.geometry.dispose();
      this.lines.material.dispose();
      this.lines = null;
    }
    for (const key of ['chords', 'branchRings', 'halos', 'pulses']) {
      if (!this[key]) continue;
      this.world.remove(this[key]);
      this[key].geometry.dispose();
      this[key].material.dispose();
      this[key] = null;
    }
    for (const label of this.labels ?? []) label.parent?.remove(label);
    this.labels = [];
  }

  // Maxima per TIER, not one global maximum. A platform's rolled-up views are
  // thousands of times an individual video's, so a single shared scale would
  // squash every item to a speck the moment categories joined the scale.
  _computeMetricRanges() {
    this.ranges = { item: {}, branch: {}, platform: {} };
    for (const key of ['score', 'views', 'likes', 'comments', 'shares']) {
      for (const tier of ['item', 'branch', 'platform']) {
        let max = 0;
        for (const n of this.nodes) {
          if (n.type === tier) max = Math.max(max, n.metrics?.[key] ?? 0);
        }
        this.ranges[tier][key] = max || 1;
      }
    }
  }

  _seedPositions() {
    const platforms = this.nodes.filter((n) => n.type === 'platform');
    const dirs = new Map();

    platforms.forEach((p, i) => {
      dirs.set(p.id, fibonacciDirection(i, platforms.length));
    });

    for (const node of this.nodes) {
      if (node.type === 'root') {
        node.pos = new THREE.Vector3(0, 0, 0);
        continue;
      }
      const rand = rng(hashString(node.id));
      let dir;
      if (node.type === 'platform') {
        dir = dirs.get(node.id).clone();
      } else {
        const parentDir = dirs.get(node.parent) ?? fibonacciDirection(0, 1);
        // Spread further from the parent axis the deeper we go.
        const spread = node.type === 'branch' ? 0.55 : 0.3;
        dir = parentDir
          .clone()
          .add(
            new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).multiplyScalar(spread),
          )
          .normalize();
        dirs.set(node.id, dir);
      }
      // Items get a jittered radius so the rim reads as a volume with depth
      // rather than a single hard shell.
      node.targetR = RADIUS[node.depth] * (node.depth === 3 ? 0.82 + rand() * 0.34 : 1);
      node.pos = dir.clone().multiplyScalar(node.targetR);
      node.vel = new THREE.Vector3();
    }

    // Repulsion is computed inside groups, not globally - siblings under one
    // platform are what actually need separating, and it keeps this O(small).
    this.groups = new Map();
    for (const node of this.nodes) {
      if (node.type === 'root') continue;
      const key = node.type === 'platform' ? 'platforms' : `${node.platform}:${node.depth}`;
      if (!this.groups.has(key)) this.groups.set(key, []);
      this.groups.get(key).push(node);
    }
  }

  // One relaxation pass: push siblings apart, pull each node toward its
  // parent's direction, then snap everything back onto its shell.
  _relax(iterations) {
    const tmp = new THREE.Vector3();
    for (let it = 0; it < iterations; it++) {
      for (const group of this.groups.values()) {
        const strength = group[0].depth === 3 ? 95 : 260;
        for (let i = 0; i < group.length; i++) {
          const a = group[i];
          for (let j = i + 1; j < group.length; j++) {
            const b = group[j];
            tmp.subVectors(a.pos, b.pos);
            const d2 = Math.max(tmp.lengthSq(), 1);
            const f = strength / d2;
            tmp.multiplyScalar(f / Math.sqrt(d2));
            a.vel.add(tmp);
            b.vel.sub(tmp);
          }
        }
      }

      for (const node of this.nodes) {
        if (node.type === 'root') continue;
        const parent = this.byId.get(node.parent);
        if (parent) {
          // Pull toward the parent's direction, not its position - the shell
          // owns the distance, the parent owns the angle.
          tmp
            .copy(parent.pos)
            .normalize()
            .multiplyScalar(node.targetR)
            .sub(node.pos)
            .multiplyScalar(node.depth === 3 ? 0.04 : 0.09);
          node.vel.add(tmp);
        }
        node.vel.multiplyScalar(0.72);
        node.pos.add(node.vel);
        node.pos.setLength(node.targetR);
      }
    }
  }

  // ---------------------------------------------------------------- meshes

  _buildMeshes() {
    // Detail 2, not 1: at focus distance the old faceting read as low-poly
    // pebbles. ~160 verts x ~550 instances is still nothing.
    const geo = new THREE.IcosahedronGeometry(1, 2);
    const mat = new THREE.MeshBasicMaterial({ toneMapped: false });
    this.points = new THREE.InstancedMesh(geo, mat, this.nodes.length);
    this.points.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.points.frustumCulled = false;
    this.world.add(this.points);

    const positions = new Float32Array(this.links.length * 6);
    const colors = new Float32Array(this.links.length * 6);
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    lineGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.lines = new THREE.LineSegments(
      lineGeo,
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    this.lines.frustumCulled = false;
    this.world.add(this.lines);

    this._dummy = new THREE.Object3D();
    this._color = new THREE.Color();

    this._buildChords();
    this._buildBranchRings();
    this._buildHalos();
    this._buildPulses();
  }

  // A soft additive halo behind every data node. This is what turns the flat
  // discs into glowing bodies - the single biggest material upgrade available
  // without touching the data. Per-point size needs a tiny custom shader
  // because PointsMaterial only has one global size.
  _buildHalos() {
    const n = this.nodes.length;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage));

    this.haloMat = new THREE.ShaderMaterial({
      uniforms: { map: { value: this._whiteGlowTexture() }, uScale: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute float aSize;
        varying vec3 vColor;
        uniform float uScale;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (uScale / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D map;
        varying vec3 vColor;
        void main() {
          vec4 tex = texture2D(map, gl_PointCoord);
          gl_FragColor = vec4(vColor * tex.rgb, tex.a);
        }`,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this._setHaloScale();

    this.halos = new THREE.Points(geo, this.haloMat);
    this.halos.frustumCulled = false;
    this.world.add(this.halos);
  }

  _setHaloScale() {
    if (!this.haloMat) return;
    const h = this.container.clientHeight || 1;
    const vFov = (this.camera.fov * Math.PI) / 180;
    this.haloMat.uniforms.uScale.value = h / (2 * Math.tan(vFov / 2));
  }

  // Energy pulses travelling outward along the connections - root to platform,
  // platform to branch, branch to video. The thing that makes it read as a
  // living brain rather than a diagram of one.
  _buildPulses() {
    const rand = rng(77);
    this.pulsePairs = this.links
      .map((l) => [this.byId.get(l.source), this.byId.get(l.target)])
      .filter(([a, b]) => a && b);
    const COUNT = Math.min(520, this.pulsePairs.length);
    this.pulseList = Array.from({ length: COUNT }, () => ({
      li: Math.floor(rand() * this.pulsePairs.length),
      t: rand(),
      s: 0.14 + rand() * 0.4, // full trips per second
    }));

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3).setUsage(THREE.DynamicDrawUsage));
    this.pulses = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        map: this._whiteGlowTexture(),
        size: 2.6,
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
        toneMapped: false,
      }),
    );
    this.pulses.frustumCulled = false;
    this.world.add(this.pulses);
    this._pulseRand = rand;
  }

  // Faint chords joining each platform's branches into a girdle. Adds the
  // woven, structural look you get in real technical diagrams - and unlike
  // random filaments it is actually describing something (siblings).
  _buildChords() {
    const byPlatform = new Map();
    for (const node of this.nodes) {
      if (node.type !== 'branch') continue;
      if (!byPlatform.has(node.platform)) byPlatform.set(node.platform, []);
      byPlatform.get(node.platform).push(node);
    }

    this.chordPairs = [];
    for (const group of byPlatform.values()) {
      if (group.length < 3) continue;
      // Order around the platform's axis so the girdle is a loop, not a tangle.
      const axis = group[0].pos.clone().normalize();
      const ref = new THREE.Vector3(0, 1, 0).cross(axis);
      if (ref.lengthSq() < 1e-4) ref.set(1, 0, 0);
      ref.normalize();
      const ref2 = new THREE.Vector3().crossVectors(axis, ref);
      const ordered = [...group].sort(
        (a, b) => Math.atan2(a.pos.dot(ref2), a.pos.dot(ref)) - Math.atan2(b.pos.dot(ref2), b.pos.dot(ref)),
      );
      for (let i = 0; i < ordered.length; i++) {
        this.chordPairs.push([ordered[i], ordered[(i + 1) % ordered.length]]);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.chordPairs.length * 6), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.chordPairs.length * 6), 3));
    this.chords = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.chords.frustumCulled = false;
    this.world.add(this.chords);
  }

  // A thin ring worn by every branch node, so the three tiers are told apart
  // by shape and not only by size. Decorative - never raycast against.
  _buildBranchRings() {
    this.ringNodes = this.nodes.filter((n) => n.type === 'branch');
    if (!this.ringNodes.length) return;
    this.branchRings = new THREE.InstancedMesh(
      new THREE.TorusGeometry(1, 0.055, 5, 28),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
      this.ringNodes.length,
    );
    this.branchRings.frustumCulled = false;
    this.world.add(this.branchRings);
  }

  _buildLabels() {
    this.labels = [];
    for (const node of this.nodes) {
      if (node.depth > 2) continue;
      const div = document.createElement('div');
      div.className = `node-label depth-${node.depth}`;
      div.textContent = node.label;
      div.addEventListener('click', (e) => {
        e.stopPropagation();
        this.select(node.id, { fly: true });
      });
      const label = new CSS2DObject(div);
      label.userData.node = node;
      this.world.add(label);
      this.labels.push(label);
    }
  }

  // ------------------------------------------------------------- visuals

  // The one place that decides what colour a DATA node is. The decorative
  // layers are deliberately not routed through here - they stay violet so the
  // body still reads as one planet however the categories are coloured.
  nodeColor(node) {
    if (this.colorMode === 'unified') return UNIFIED;
    return node.color ?? UNIFIED;
  }

  nodeSize(node) {
    if (node.type === 'root') return BASE_SIZE[0];

    const tier = node.type; // 'item' | 'branch' | 'platform'
    if (tier !== 'item' && !this.sizeCategories) return BASE_SIZE[node.depth];

    const v = node.metrics?.[this.metric] ?? 0;
    const norm = Math.sqrt(v / (this.ranges[tier]?.[this.metric] ?? 1)); // sqrt keeps mid values readable

    // Each tier scales around its own base so differences WITHIN a tier show.
    //
    // Note the tiers now OVERLAP: a busy YouTube branch can render larger than
    // a quiet platform like MY ACCOUNTS. That is deliberate - it is the honest
    // reading of the numbers, and tier is already unambiguous from shell radius,
    // the branch rings and the labels, so size is free to carry magnitude
    // instead of repeating structure. Untick the box to go back to fixed tiers.
    // Items stay restrained - the orb should read as thousands of fragments.
    const [floor, span] =
      tier === 'item' ? [0.42, 1.85] : tier === 'branch' ? [0.55, 1.5] : [0.6, 1.4];
    return BASE_SIZE[node.depth] * (floor + norm * span);
  }

  isVisible(node) {
    if (node.type === 'root') return true;
    if (!this.filters.platforms.has(node.platform)) return false;
    if (this.filters.newOnly && node.type === 'item' && !node.isNew) return false;
    return true;
  }

  matchesQuery(node) {
    const q = this.filters.query.trim().toLowerCase();
    if (!q) return true;
    return (
      node.label.toLowerCase().includes(q) ||
      (node.author ?? '').toLowerCase().includes(q) ||
      (node.platform ?? '').toLowerCase().includes(q)
    );
  }

  // Ancestors + descendants of the selection stay lit; everything else dims.
  _buildFocusSet() {
    this.focus = null;
    if (!this.selectedId) return;
    const keep = new Set();
    let cur = this.byId.get(this.selectedId);
    while (cur) {
      keep.add(cur.id);
      cur = cur.parent ? this.byId.get(cur.parent) : null;
    }
    const children = new Map();
    for (const n of this.nodes) {
      if (!n.parent) continue;
      if (!children.has(n.parent)) children.set(n.parent, []);
      children.get(n.parent).push(n.id);
    }
    const stack = [this.selectedId];
    while (stack.length) {
      const id = stack.pop();
      for (const child of children.get(id) ?? []) {
        keep.add(child);
        stack.push(child);
      }
    }
    this.focus = keep;
  }

  // Called on every state change. It only moves TARGETS - the animation loop
  // is what actually eases pixels, so a click never produces a hard cut.
  refreshVisuals() {
    this._buildFocusSet();
    this._computeTargets();
    this._updateLabels();
  }

  _computeTargets() {
    for (const node of this.nodes) {
      const visible = this.isVisible(node);
      const dimmed = (this.focus && !this.focus.has(node.id)) || !this.matchesQuery(node) || !visible;
      node.tintTarget = dimmed ? 0.14 : 1;
      node.emphTarget = node.index === this.hoverIndex || node.id === this.selectedId ? 1 : 0;
      node.sizeTarget = visible ? this.nodeSize(node) : 0;
    }
  }

  _nodeTint(node) {
    this._color.set(node.type === 'root' ? '#ffffff' : this.nodeColor(node));
    if (node.isNew) this._color.multiplyScalar(1.18);
    // tint carries the dim, emph pulls it toward white - both are smoothed.
    this._color.multiplyScalar(node.tint);
    if (node.emph > 0.001) this._color.lerp(WHITE, node.emph * 0.65);
    return this._color;
  }

  _updateInstances(dt, t) {
    for (const node of this.nodes) {
      const i = node.index;

      node.tint = approach(node.tint, node.tintTarget, dt, 7);
      node.emph = approach(node.emph, node.emphTarget, dt, 9);
      node.size = approach(node.size, node.sizeTarget, dt, 8);

      let size = node.size;
      if (node.isNew && node.type === 'item') size *= 1 + 0.18 * Math.sin(t * 3 + i);
      size *= 1 + node.emph * 0.9;

      this._dummy.position.copy(node.pos);
      this._dummy.scale.setScalar(size);
      this._dummy.updateMatrix();
      this.points.setMatrixAt(i, this._dummy.matrix);
      this.points.setColorAt(i, this._nodeTint(node));
    }
    this.points.instanceMatrix.needsUpdate = true;
    if (this.points.instanceColor) this.points.instanceColor.needsUpdate = true;
    this.points.computeBoundingSphere();

    if (this.halos) {
      const pos = this.halos.geometry.attributes.position.array;
      const col = this.halos.geometry.attributes.color.array;
      const sizes = this.halos.geometry.attributes.aSize.array;
      for (const node of this.nodes) {
        const i = node.index;
        pos.set([node.pos.x, node.pos.y, node.pos.z], i * 3);
        if (node.type === 'root') {
          sizes[i] = 0; // the core already owns the centre glow
          continue;
        }
        sizes[i] = node.size * (node.type === 'item' ? 4.4 : 3.2);
        const glow = node.tint * (0.2 + node.emph * 0.6 + (node.isNew ? 0.1 : 0));
        this._color.set(this.nodeColor(node)).multiplyScalar(glow);
        col.set([this._color.r, this._color.g, this._color.b], i * 3);
      }
      this.halos.geometry.attributes.position.needsUpdate = true;
      this.halos.geometry.attributes.color.needsUpdate = true;
      this.halos.geometry.attributes.aSize.needsUpdate = true;
    }

    if (this.pulses) {
      const pos = this.pulses.geometry.attributes.position.array;
      const col = this.pulses.geometry.attributes.color.array;
      this.pulseList.forEach((p, i) => {
        p.t += p.s * dt;
        if (p.t >= 1) {
          // Arrived - respawn on a fresh random connection.
          p.t = 0;
          p.li = Math.floor(this._pulseRand() * this.pulsePairs.length);
        }
        const [a, b] = this.pulsePairs[p.li];
        pos.set(
          [
            a.pos.x + (b.pos.x - a.pos.x) * p.t,
            a.pos.y + (b.pos.y - a.pos.y) * p.t,
            a.pos.z + (b.pos.z - a.pos.z) * p.t,
          ],
          i * 3,
        );
        // Bright mid-flight, faded at the ends, and dimming with its wire when
        // the wire's endpoints are dimmed by a selection.
        const bright = Math.sin(p.t * Math.PI) * Math.min(a.tint, b.tint) * 0.9;
        this._color.set(this.nodeColor(b)).multiplyScalar(bright);
        col.set([this._color.r, this._color.g, this._color.b], i * 3);
      });
      this.pulses.geometry.attributes.position.needsUpdate = true;
      this.pulses.geometry.attributes.color.needsUpdate = true;
    }

    if (this.branchRings) {
      this.ringNodes.forEach((node, i) => {
        this._dummy.position.copy(node.pos);
        this._dummy.lookAt(0, 0, 0);
        this._dummy.rotateZ(t * 0.12 + i);
        this._dummy.scale.setScalar(Math.max(node.size, 0.001) * 2.6);
        this._dummy.updateMatrix();
        this.branchRings.setMatrixAt(i, this._dummy.matrix);
        this._color.set(this.nodeColor(node)).multiplyScalar(node.tint * 0.85);
        this.branchRings.setColorAt(i, this._color);
      });
      this.branchRings.instanceMatrix.needsUpdate = true;
      if (this.branchRings.instanceColor) this.branchRings.instanceColor.needsUpdate = true;
    }
  }

  _updateLines() {
    const pos = this.lines.geometry.attributes.position.array;
    const col = this.lines.geometry.attributes.color.array;
    const c = new THREE.Color();

    for (let i = 0; i < this.links.length; i++) {
      const a = this.byId.get(this.links[i].source);
      const b = this.byId.get(this.links[i].target);
      const o = i * 6;
      if (!a || !b) {
        pos.fill(0, o, o + 6);
        col.fill(0, o, o + 6);
        continue;
      }
      pos.set([a.pos.x, a.pos.y, a.pos.z, b.pos.x, b.pos.y, b.pos.z], o);

      // Link brightness rides the endpoints' already-smoothed tint, so edges
      // fade in and out in step with the nodes instead of switching.
      const base = b.depth === 3 ? 0.22 : 0.5;
      const lit = Math.min(a.tint, b.tint) * base;
      c.set(a.type === 'root' ? '#ffffff' : this.nodeColor(a)).multiplyScalar(lit);
      col.set([c.r, c.g, c.b], o);
      c.set(this.nodeColor(b)).multiplyScalar(lit);
      col.set([c.r, c.g, c.b], o + 3);
    }
    this.lines.geometry.attributes.position.needsUpdate = true;
    this.lines.geometry.attributes.color.needsUpdate = true;

    this._updateChords();
  }

  _updateChords() {
    if (!this.chords) return;
    const pos = this.chords.geometry.attributes.position.array;
    const col = this.chords.geometry.attributes.color.array;
    const c = new THREE.Color();

    for (let i = 0; i < this.chordPairs.length; i++) {
      const [a, b] = this.chordPairs[i];
      const o = i * 6;
      pos.set([a.pos.x, a.pos.y, a.pos.z, b.pos.x, b.pos.y, b.pos.z], o);
      const lit = Math.min(a.tint, b.tint) * 0.3;
      c.set(this.nodeColor(a)).multiplyScalar(lit);
      col.set([c.r, c.g, c.b], o);
      c.set(this.nodeColor(b)).multiplyScalar(lit);
      col.set([c.r, c.g, c.b], o + 3);
    }
    this.chords.geometry.attributes.position.needsUpdate = true;
    this.chords.geometry.attributes.color.needsUpdate = true;
  }

  _updateLabels() {
    for (const label of this.labels) {
      const node = label.userData.node;
      label.position.copy(node.pos).multiplyScalar(1.06);
      // Branch labels only appear once something is selected - showing all of
      // them at once buries the orb in text.
      const inFocus = !this.focus || this.focus.has(node.id);
      const allowed = node.depth <= 1 ? inFocus : Boolean(this.focus) && inFocus;
      // object.visible controls whether it is in the layout at all (CSS2DRenderer
      // rewrites display from it every frame); opacity does the fade, so branch
      // labels dissolve in on selection rather than popping.
      label.visible = this.isVisible(node);
      label.element.style.opacity = allowed ? '1' : '0';
      label.element.style.pointerEvents = allowed ? 'auto' : 'none';
      // Labels carry the category hue too - that is what makes the coding
      // readable without hunting for the legend.
      label.element.style.color = node.type === 'root' ? '' : this.nodeColor(node);
      label.element.classList.toggle('selected', node.id === this.selectedId);
    }
  }

  // --------------------------------------------------------- interaction

  _setHover(index) {
    if (index === this.hoverIndex) return;
    this.hoverIndex = index;
    this.renderer.domElement.style.cursor = index >= 0 ? 'pointer' : 'grab';
    this._emit('hover', index >= 0 ? { node: this.nodes[index], at: this._pointerPx } : null);
    this.refreshVisuals();
  }

  _pick() {
    if (!this.points || !this.pointerOnScreen) return;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObject(this.points, false);
    for (const hit of hits) {
      const node = this.nodes[hit.instanceId];
      if (node && this.isVisible(node) && this.matchesQuery(node)) {
        this._setHover(hit.instanceId);
        return;
      }
    }
    this._setHover(-1);
  }

  select(id, { fly = false } = {}) {
    this.selectedId = id;
    if (fly && id) this.flyTo(id);
    this.refreshVisuals();
    this._emit('select', id ? this.byId.get(id) : null);
  }

  // Everything the camera should get in frame for a given selection: the node
  // itself plus one tier down. Selecting YouTube has to show YouTube's
  // categories, not just the YouTube node with its branches off-screen.
  _focusPoints(node) {
    if (node.type === 'root') {
      return this.nodes.filter((n) => n.depth <= 1 && this.isVisible(n)).map((n) => n.pos);
    }
    const points = [node.pos];
    for (const child of this.nodes) {
      if (child.parent === node.id && this.isVisible(child)) points.push(child.pos);
    }
    return points;
  }

  // Distance that fits `points` in frame when viewed from `target + dir * d`.
  //
  // Measures the actual extent PERPENDICULAR to the view axis rather than a
  // bounding sphere - branches sit on a cap around their platform, so a sphere
  // fit leaves a huge empty margin and the cluster ends up a dot in the middle.
  _fitDistance(points, target, dir) {
    const height = this.container.clientHeight || 1;
    const width = this.container.clientWidth || 1;
    // Panels are fixed-width, but never let them claim more than a third of a
    // narrow window or the camera gets shoved absurdly far back.
    const panels = Math.min(660, width * 0.34);
    const visibleWidth = Math.max(280, width - panels);

    const vFov = (this.camera.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * (visibleWidth / height));

    const seed = Math.abs(dir.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(seed, dir).normalize();
    const up = new THREE.Vector3().crossVectors(dir, right).normalize();

    let halfW = 0;
    let halfH = 0;
    let depth = 0;
    const v = new THREE.Vector3();
    for (const p of points) {
      v.subVectors(p, target);
      halfW = Math.max(halfW, Math.abs(v.dot(right)));
      halfH = Math.max(halfH, Math.abs(v.dot(up)));
      depth = Math.max(depth, v.dot(dir)); // points nearest the camera
    }

    const margin = 1.14;
    return (
      Math.max((halfW * margin) / Math.tan(hFov / 2), (halfH * margin) / Math.tan(vFov / 2)) + depth
    );
  }

  flyTo(id) {
    const node = this.byId.get(id);
    if (!node) return;

    // Node positions are LOCAL to `world`, which is rotating. The camera lives
    // in world space, so every point has to go through world.matrixWorld first
    // or we aim at where the cluster was before the spin.
    this.world.updateMatrixWorld();
    const points = this._focusPoints(node).map((p) => p.clone().applyMatrix4(this.world.matrixWorld));

    const target = new THREE.Vector3();
    for (const p of points) target.add(p);
    target.divideScalar(points.length);

    let radius = 0;
    for (const p of points) radius = Math.max(radius, p.distanceTo(target));

    const from = this.camera.position.clone();
    // Approach from outside the orb, along the cluster's own outward axis.
    const nodeWorld = node.pos.clone().applyMatrix4(this.world.matrixWorld);
    const dir = (target.lengthSq() > 1 ? target.clone() : nodeWorld).normalize();

    // A leaf has no spread of its own, so fall back to a fixed close-up.
    const distance =
      radius > 2
        ? THREE.MathUtils.clamp(this._fitDistance(points, target, dir), 34, 620)
        : node.type === 'item'
          ? 34
          : 90;
    const to = target.clone().add(dir.multiplyScalar(distance)).add(new THREE.Vector3(0, distance * 0.18, 0));
    this.flight = {
      from,
      to,
      targetFrom: this.controls.target.clone(),
      targetTo: target,
      start: performance.now(),
      // Long enough to read as a move rather than a jump; smootherstep means
      // the extra length costs no sense of responsiveness.
      duration: 1050,
    };
  }

  resetView() {
    this.flight = {
      from: this.camera.position.clone(),
      to: new THREE.Vector3(0, 70, 330),
      targetFrom: this.controls.target.clone(),
      targetTo: new THREE.Vector3(0, 0, 0),
      start: performance.now(),
      // Long enough to read as a move rather than a jump; smootherstep means
      // the extra length costs no sense of responsiveness.
      duration: 1050,
    };
  }

  setMetric(metric) {
    this.metric = metric;
    this.refreshVisuals();
  }

  setSizeCategories(on) {
    this.sizeCategories = Boolean(on);
    this.refreshVisuals();
  }

  setColorMode(mode) {
    this.colorMode = mode === 'unified' ? 'unified' : 'category';
    this.refreshVisuals();
  }

  setQuery(query) {
    this.filters.query = query;
    this.refreshVisuals();
  }

  togglePlatform(platform, on) {
    if (on) this.filters.platforms.add(platform);
    else this.filters.platforms.delete(platform);
    this.refreshVisuals();
  }

  setNewOnly(on) {
    this.filters.newOnly = on;
    this.refreshVisuals();
  }

  setSpin(on) {
    this.spin = on;
  }

  resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this._setHaloScale();
    this.renderer.setSize(w, h);
    this.labelRenderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloom.setSize(w, h);
  }

  _animate = () => {
    requestAnimationFrame(this._animate);

    // Clamped so a backgrounded tab does not resume with one enormous step.
    const dt = Math.min(this.clock.getDelta(), 0.1);

    // Settle the layout over the first couple of seconds so you watch the
    // brain grow instead of waiting on a frozen tab.
    if (this.settleWork > 0) {
      const step = Math.min(5, this.settleWork);
      this._relax(step);
      this.settleWork -= step;
      this._updateLabels();
    }

    if (this.flight) {
      const p = Math.min(1, (performance.now() - this.flight.start) / this.flight.duration);
      const e = EASE(p);
      this.camera.position.lerpVectors(this.flight.from, this.flight.to, e);
      this.controls.target.lerpVectors(this.flight.targetFrom, this.flight.targetTo, e);
      if (p >= 1) this.flight = null;
    }

    // Ease the auto-rotation out while flying, and keep it off for as long as
    // something is selected: the camera target is a fixed world-space point, so
    // letting the world keep turning would carry the thing you just focused on
    // straight out of frame. Deselect and it eases back in.
    this.spinFactor = approach(this.spinFactor ?? 1, this.flight || this.selectedId ? 0 : 1, dt, 3.5);
    if (this.spin) this.world.rotation.y += 0.0006 * this.spinFactor;

    // Core breathing + counter-rotating cages + drifting arcs.
    const t = this.clock.elapsedTime;
    if (this.core) {
      this.core.scale.setScalar(1 + 0.09 * Math.sin(t * 1.6));
      this.halo.scale.setScalar(84 * (1 + 0.05 * Math.sin(t * 1.6 + 0.6)));
      this.spiral.rotation.y += 0.004;
      for (const cage of this.coreCages) {
        cage.rotation.z += cage.userData.speed * 0.01;
        cage.rotation.y += cage.userData.speed * 0.004;
      }
    }
    for (const ring of this.rings ?? []) ring.rotation.z += ring.userData.spin;

    // Selecting something pulls the scenery back so the data reads. Eased, so
    // it happens as part of the same move rather than as a separate flick.
    this.decorFade = approach(this.decorFade, this.focus ? 0.3 : 1, dt, 4);
    for (const layer of this.sparkleLayers ?? []) {
      const tw = layer.userData.twinkle;
      layer.material.opacity = (tw.base + tw.amp * Math.sin(t * tw.rate)) * this.decorFade;
    }
    for (const d of this.decor) d.material.opacity = d.base * (1 - (1 - this.decorFade) * d.factor);
    if (this.halo) this.halo.material.opacity = 0.6 * (0.35 + 0.65 * this.decorFade);
    if (this.vignette) this.vignette.uniforms.uTime.value = t % 100;

    this._pick();
    if (this.points) {
      this._updateInstances(dt, t);
      // Positions move while settling and colours ease every frame, so the
      // edges have to be rewritten each frame too.
      this._updateLines();
    }

    this.controls.update();
    this.composer.render();
    this.labelRenderer.render(this.scene, this.camera);
  };
}
