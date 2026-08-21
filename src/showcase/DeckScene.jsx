import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

function qualityProfile() {
  const saveData = Boolean(navigator.connection?.saveData);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cores = navigator.hardwareConcurrency || 8;
  const memory = navigator.deviceMemory || 8;
  const mobile = window.matchMedia("(max-width: 760px)").matches;
  if (saveData || reducedMotion || cores <= 4 || memory <= 4) {
    return { tier: "low", dpr: 1, stars: mobile ? 260 : 520, animate: !reducedMotion };
  }
  return { tier: mobile ? "balanced" : "high", dpr: mobile ? 1.1 : 1.5, stars: mobile ? 520 : 1100, animate: true };
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

export function DeckScene({ mode, onFpsChange }) {
  const hostRef = useRef(null);
  const modeRef = useRef(mode);
  const callbackRef = useRef(onFpsChange);

  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { callbackRef.current = onFpsChange; }, [onFpsChange]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const profile = qualityProfile();
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x030509, profile.tier === "low" ? 0.017 : 0.012);
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 160);
    camera.position.set(0, 4.2, 15.5);

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: profile.tier !== "low", alpha: true, powerPreference: "high-performance" });
    } catch {
      host.dataset.renderer = "poster";
      return undefined;
    }
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, profile.dpr));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.86;
    host.appendChild(renderer.domElement);
    host.dataset.renderer = profile.tier;

    const ambient = new THREE.AmbientLight(0x233347, 1.05);
    const key = new THREE.DirectionalLight(0xf4f2e8, 3.5);
    key.position.set(-7, 9, 8);
    const rim = new THREE.PointLight(0x72d8ff, 4.2, 32);
    rim.position.set(8, -1, -5);
    const threat = new THREE.PointLight(0xff6f54, 0, 24);
    threat.position.set(-6, 0, 6);
    scene.add(ambient, key, rim, threat);

    const random = seededRandom(19082026);
    const starPositions = new Float32Array(profile.stars * 3);
    for (let index = 0; index < profile.stars; index += 1) {
      const radius = 26 + random() * 68;
      const theta = random() * Math.PI * 2;
      const phi = Math.acos(2 * random() - 1);
      starPositions[index * 3] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[index * 3 + 1] = radius * Math.cos(phi);
      starPositions[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }
    const starsGeometry = new THREE.BufferGeometry();
    starsGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starsMaterial = new THREE.PointsMaterial({ color: 0xd9e8f1, size: profile.tier === "low" ? 0.055 : 0.075, transparent: true, opacity: 0.76, sizeAttenuation: true });
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);

    const planetGeometry = new THREE.SphereGeometry(8, profile.tier === "low" ? 32 : 56, profile.tier === "low" ? 20 : 36);
    const planetMaterial = new THREE.MeshStandardMaterial({ color: 0x030508, roughness: 1, metalness: 0.05 });
    const planet = new THREE.Mesh(planetGeometry, planetMaterial);
    planet.position.set(-7, -9.5, -9);
    scene.add(planet);

    const atmosphereMaterial = new THREE.MeshBasicMaterial({ color: 0xa6d8ee, transparent: true, opacity: 0.18, side: THREE.BackSide });
    const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(8.18, 40, 24), atmosphereMaterial);
    atmosphere.position.copy(planet.position);
    scene.add(atmosphere);

    const shipRoot = new THREE.Group();
    shipRoot.position.set(0.5, -0.35, 0);
    scene.add(shipRoot);
    let ship = null;

    const loader = new GLTFLoader();
    loader.load("/assets/showcase/afflatus-command.glb", (gltf) => {
      ship = gltf.scene;
      ship.traverse((child) => {
        if (!child.isMesh) return;
        child.frustumCulled = true;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => {
          if (!material) return;
          if ("envMapIntensity" in material) material.envMapIntensity = 0.35;
          if ("roughness" in material) material.roughness = Math.max(0.24, material.roughness ?? 0.4);
          material.needsUpdate = true;
        });
      });
      const box = new THREE.Box3().setFromObject(ship);
      const size = box.getSize(new THREE.Vector3());
      const centre = box.getCenter(new THREE.Vector3());
      ship.position.sub(centre);
      const scale = 9.8 / Math.max(size.x, size.y, size.z);
      ship.scale.setScalar(scale);
      ship.rotation.set(0.18, -0.8, -0.04);
      shipRoot.add(ship);
    });

    const pointer = new THREE.Vector2();
    const onPointerMove = (event) => {
      pointer.x = (event.clientX / window.innerWidth - 0.5) * 2;
      pointer.y = (event.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    const resize = () => {
      const rect = host.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, qualityProfile().dpr));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    let raf = 0;
    let running = true;
    let last = performance.now();
    let sampleStart = last;
    let sampleFrames = 0;
    const targetFrameMs = 1000 / 60;
    const render = (now) => {
      if (!running) return;
      if (profile.animate && now - last < targetFrameMs - 0.8) {
        raf = requestAnimationFrame(render);
        return;
      }
      const delta = Math.min((now - last) / 1000, 0.05);
      last = now;
      const combat = modeRef.current === "combat";
      threat.intensity += ((combat ? 2.8 : 0) - threat.intensity) * Math.min(1, delta * 4);
      rim.intensity += ((combat ? 2.5 : 4.2) - rim.intensity) * Math.min(1, delta * 4);
      if (profile.animate) {
        stars.rotation.y += delta * 0.008;
        shipRoot.rotation.y += delta * (combat ? 0.09 : 0.035);
        shipRoot.rotation.z = Math.sin(now * 0.00032) * 0.025;
        camera.position.x += ((pointer.x * 0.75) - camera.position.x) * 0.018;
        camera.position.y += ((4.2 - pointer.y * 0.38) - camera.position.y) * 0.018;
      }
      camera.lookAt(0, -0.4, -1.2);
      renderer.render(scene, camera);
      sampleFrames += 1;
      if (now - sampleStart >= 600) {
        const fps = Math.round(sampleFrames * 1000 / (now - sampleStart));
        callbackRef.current?.(Math.min(99, fps));
        sampleFrames = 0;
        sampleStart = now;
      }
      if (profile.animate) raf = requestAnimationFrame(render);
    };

    const start = () => {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(render);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };
    const onVisibility = () => document.hidden ? stop() : start();
    document.addEventListener("visibilitychange", onVisibility);
    render(performance.now());

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onPointerMove);
      resizeObserver.disconnect();
      scene.traverse((child) => {
        child.geometry?.dispose?.();
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => material?.dispose?.());
      });
      renderer.dispose();
      renderer.forceContextLoss?.();
      renderer.domElement.remove();
    };
  }, []);

  return <div className="deck-scene" ref={hostRef} aria-hidden="true" />;
}

export function RadarCanvas({ combat }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let running = true;

    const draw = (now = 0) => {
      if (!running) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const w = rect.width;
      const h = rect.height;
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(w, h) * 0.42;
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(140, 214, 235, .22)";
      ctx.lineWidth = 1;
      for (let ring = 1; ring <= 4; ring += 1) {
        ctx.beginPath();
        ctx.arc(cx, cy, radius * ring / 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(cx - radius, cy); ctx.lineTo(cx + radius, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - radius); ctx.lineTo(cx, cy + radius); ctx.stroke();
      const sweep = reduced ? -0.45 : now * 0.0009;
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      gradient.addColorStop(0, combat ? "rgba(255,116,78,.16)" : "rgba(126,227,255,.12)");
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, sweep - 0.23, sweep + 0.02);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = combat ? "rgba(255,116,78,.72)" : "rgba(126,227,255,.72)";
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(sweep) * radius, cy + Math.sin(sweep) * radius);
      ctx.stroke();
      const tracks = combat ? [[.52, -.38, "#ff6f54"], [-.28, .58, "#7ee3ff"], [.18, .12, "#ffb84d"]] : [[.34, -.44, "#7ee3ff"], [-.42, .32, "#7ee3ff"]];
      tracks.forEach(([x, y, color]) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx + x * radius, cy + y * radius, 3.2, 0, Math.PI * 2);
        ctx.fill();
      });
      if (!reduced) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { running = false; cancelAnimationFrame(raf); };
  }, [combat]);

  return <canvas className="radar-canvas" ref={canvasRef} aria-label="Tactical radar simulation" />;
}
