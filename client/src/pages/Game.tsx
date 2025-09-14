import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useLocation } from "wouter";
import { getUserData, setVoucherData } from "@/utils/storage";
import { generateVoucherCode } from "@/utils/voucher";

type GameState = "ready" | "shooting" | "goal" | "miss";

export default function Game() {
  const [, setLocation] = useLocation();

  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const sceneRef = useRef<THREE.Scene>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const ballRef = useRef<THREE.Mesh>();
  const goalGroupRef = useRef<THREE.Group>();
  const rafRef = useRef<number>();

  const [attempts, setAttempts] = useState(0);
  const [goals, setGoals] = useState(0);
  const [state, setState] = useState<GameState>("ready");
  const [webglError, setWebglError] = useState<string | null>(null);

  // swipe tracking
  const startPt = useRef<{ x: number; y: number; time: number } | null>(null);

  useEffect(() => {
    const user = getUserData();
    if (!user) {
      setLocation("/");
      return;
    }
  }, [setLocation]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    try {
      // scene
      const scene = new THREE.Scene();
      scene.background = new THREE.TextureLoader().load(
        "/penalty3d/textures/backdrop.png"
      );

      // camera
      const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
      camera.position.set(0, 2.4, 7.2);
      camera.lookAt(0, 1.2, -6);

      // renderer
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.style.display = "block";
      // Important for mobile swiping: prevent page scroll/zoom during gestures
      (renderer.domElement.style as any).touchAction = "none";
      mount.appendChild(renderer.domElement);

      // lights
      const hemi = new THREE.HemisphereLight(0xffffff, 0x335522, 0.9);
      scene.add(hemi);
      const dir = new THREE.DirectionalLight(0xffffff, 0.8);
      dir.position.set(6, 8, 4);
      scene.add(dir);

      // pitch
      const texLoader = new THREE.TextureLoader();
      const grass = texLoader.load("/penalty3d/textures/grass_tile.png", (t) => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(8, 8);
        t.colorSpace = THREE.SRGBColorSpace;
      });
      const pitch = new THREE.Mesh(
        new THREE.PlaneGeometry(40, 30),
        new THREE.MeshPhysicalMaterial({ map: grass, roughness: 0.92 })
      );
      pitch.rotation.x = -Math.PI / 2;
      scene.add(pitch);

      // field lines
      const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const line = (w: number, h: number, z: number, x = 0) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), lineMat);
        m.position.set(x, 0.001, z);
        m.rotation.x = -Math.PI / 2;
        m.renderOrder = 2;
        scene.add(m);
      };
      line(16, 0.06, -6); // goal line
      line(0.06, 11, -2, -8);
      line(0.06, 11, -2, 8);
      line(16, 0.06, -2); // top of box
      line(0.06, 30, 0); // mid line

      // goal + net
      const goalGroup = new THREE.Group();
      const postMat = new THREE.MeshStandardMaterial({
        color: 0xf5f7fb,
        metalness: 0.1,
        roughness: 0.35,
      });
      const postL = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 2.44, 16),
        postMat
      );
      postL.position.set(-3.66, 1.22, -6);
      const postR = postL.clone();
      postR.position.x = 3.66;
      const bar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 7.32, 16),
        postMat
      );
      bar.rotation.z = Math.PI / 2;
      bar.position.set(0, 2.44, -6);
      goalGroup.add(postL, postR, bar);

      const netTex = texLoader.load("/penalty3d/textures/net_alpha.png", (t) => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(1.5, 1);
      });
      const netMat = new THREE.MeshBasicMaterial({
        map: netTex,
        transparent: true,
        opacity: 0.92,
      });
      const net = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 2.4), netMat);
      net.position.set(0, 1.2, -6.03);
      goalGroup.add(net);

      scene.add(goalGroup);

      // SOCCER BALL — generated texture for clean pentagon/hex pattern
      const soccerTex = makeSoccerTexture(2048, 1024); // runtime CanvasTexture
      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 64, 64),
        new THREE.MeshPhysicalMaterial({
          map: soccerTex,
          roughness: 0.45,
          metalness: 0.0,
          clearcoat: 0.6,
          clearcoatRoughness: 0.25,
          sheen: 0.0,
        })
      );
      resetBall(ball);
      scene.add(ball);

      // store refs
      rendererRef.current = renderer;
      sceneRef.current = scene;
      cameraRef.current = camera;
      ballRef.current = ball;
      goalGroupRef.current = goalGroup;

      // size to wrapper (bigger: 16/9, max-w 820px)
      const onResize = () => {
        const r = mount.getBoundingClientRect();
        const width = Math.floor(r.width);
        const height = Math.floor((9 / 16) * width); // match CSS aspect
        renderer.setSize(width, height, false);
        const s = renderer.domElement.style;
        s.width = "100%";
        s.height = "100%";
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };
      onResize();
      window.addEventListener("resize", onResize);

      // animate
      let t = 0;
      const loop = () => {
        t += 0.016;
        // wider oscillation so it feels livelier
        goalGroup.position.x = Math.sin(t * 0.6) * 1.8;
        renderer.render(scene, camera);
        rafRef.current = requestAnimationFrame(loop);
      };
      loop();

      // input — robust pointer handling for mobile/desktop swipe
      const canvas = renderer.domElement;

      const onPointerDown = (e: PointerEvent) => {
        const r = canvas.getBoundingClientRect();
        startPt.current = {
          x: e.clientX - r.left,
          y: e.clientY - r.top,
          time: performance.now(),
        };
      };
      const onPointerUpAnywhere = (e: PointerEvent) => {
        if (!startPt.current || state !== "ready") return;
        const r = canvas.getBoundingClientRect();
        const end = {
          x: e.clientX - r.left,
          y: e.clientY - r.top,
          time: performance.now(),
        };
        const dx = end.x - startPt.current.x;
        const dy = startPt.current.y - end.y; // upward positive
        const dt = Math.max(16, end.time - startPt.current.time);

        // require a minimal swipe length to avoid taps
        if (Math.hypot(dx, dy) < 12) {
          startPt.current = null;
          return;
        }

        const power =
          Math.min(1.0, Math.hypot(dx, dy) / 280) * (dt < 800 ? 1.0 : 0.75);
        const dirX = THREE.MathUtils.clamp(dx / (r.width * 0.5), -0.9, 0.9);

        shoot(power, dirX);
        startPt.current = null;
      };

      canvas.addEventListener("pointerdown", onPointerDown, { passive: true });
      window.addEventListener("pointerup", onPointerUpAnywhere, {
        passive: true,
      });
      window.addEventListener("pointercancel", onPointerUpAnywhere, {
        passive: true,
      });
      window.addEventListener("pointerleave", onPointerUpAnywhere, {
        passive: true,
      });

      // cleanup
      return () => {
        window.removeEventListener("resize", onResize);
        canvas.removeEventListener("pointerdown", onPointerDown as any);
        window.removeEventListener("pointerup", onPointerUpAnywhere as any);
        window.removeEventListener("pointercancel", onPointerUpAnywhere as any);
        window.removeEventListener("pointerleave", onPointerUpAnywhere as any);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        renderer.dispose();
        mount.removeChild(renderer.domElement);
      };
    } catch (err) {
      console.error(err);
      setWebglError("Your device does not support WebGL required for 3D.");
    }
  }, [state]);

  function resetBall(b?: THREE.Mesh) {
    const m = b || ballRef.current;
    if (!m) return;
    // clearly visible: slightly higher and in front
    m.position.set(0, 0.34, -1.0);
    m.rotation.set(0, 0, 0);
  }

  function shoot(power: number, dirX: number) {
    if (!sceneRef.current || !ballRef.current || !goalGroupRef.current || state !== "ready") {
      return;
    }
    setState("shooting");
    setAttempts((a) => a + 1);

    const ball = ballRef.current;
    const start = ball.position.clone();
    const gx = goalGroupRef.current.position.x;
    const goalX = gx + THREE.MathUtils.clamp(dirX * 2.1, -2.6, 2.6);
    const end = new THREE.Vector3(goalX, 1.0 + power * 0.9, -6.05);
    const apex = new THREE.Vector3(
      THREE.MathUtils.lerp(start.x, end.x, 0.5),
      2.25 + power * 1.5,
      THREE.MathUtils.lerp(start.z, end.z, 0.5)
    );

    const total = 950; // ms
    const t0 = performance.now();

    const tick = () => {
      const t = (performance.now() - t0) / total;
      const k = Math.min(1, t);

      // Quadratic Bezier
      const p1 = start.clone().multiplyScalar((1 - k) * (1 - k));
      const p2 = apex.clone().multiplyScalar(2 * (1 - k) * k);
      const p3 = end.clone().multiplyScalar(k * k);
      const pos = new THREE.Vector3().add(p1).add(p2).add(p3);
      ball.position.copy(pos);
      ball.rotation.x -= 0.38;

      if (k >= 1) {
        const gxNow = goalGroupRef.current!.position.x;
        const left = -3.6 + gxNow,
          right = 3.6 + gxNow,
          barY = 2.44;
        const inside =
          pos.z <= -5.95 &&
          pos.x > left + 0.12 &&
          pos.x < right - 0.12 &&
          pos.y > 0.1 &&
          pos.y < barY - 0.1;

        if (inside) {
          setGoals((g) => g + 1);
          setState("goal");
          onScored();
        } else {
          setState("miss");
          setTimeout(() => {
            resetBall();
            setState("ready");
          }, 550);
        }
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }

  function onScored() {
    const user = getUserData();
    if (user) {
      const code = generateVoucherCode(user.email);
      setVoucherData({ won: true, code, time: new Date().toISOString() });
    }
    setTimeout(() => setLocation("/win"), 500);
  }

  return (
    <main className="main-content premium-container pt-12 pb-12 fade-in flex flex-col items-center">
      <section className="text-center mb-4">
        <h1 className="text-3xl md:text-4xl font-heading font-black text-sd-blue mb-2">
          PENALTY SHOOTOUT
          <div className="h-1 w-24 bg-sd-red mx-auto mt-2 rounded-full" />
        </h1>
        <p className="text-sd-black/70 font-medium">
          Swipe to shoot. Score once to unlock your voucher.
        </p>
      </section>

      {/* Bigger canvas: kept inside the card, 16:9 aspect, no overflow */}
      <section className="w-full flex flex-col items-center">
        <div
          ref={mountRef}
          className="premium-card relative w-full max-w-[820px] overflow-hidden"
          style={{ aspectRatio: "16 / 9" }}
        />
        <div className="flex justify-center items-center gap-4 mt-6 flex-wrap w-full max-w-[820px]">
          <div className="premium-card px-6 py-3 text-center">
            <div className="text-2xl font-heading font-black text-sd-blue">
              {attempts}
            </div>
            <div className="text-xs text-sd-black/60 font-bold uppercase tracking-wide">
              Attempts
            </div>
          </div>
          <div className="premium-card px-6 py-3 text-center">
            <div className="text-2xl font-heading font-black text-sd-red">
              {goals}
            </div>
            <div className="text-xs text-sd-black/60 font-bold uppercase tracking-wide">
              Goals
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

/** -------- Soccer texture generator (CanvasTexture) --------
 * Procedurally paints pentagon/hex panels across latitude bands,
 * then returns a THREE.CanvasTexture for a clean black/white ball.
 */
function makeSoccerTexture(w = 2048, h = 1024): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  // base
  ctx.fillStyle = "#efefef";
  ctx.fillRect(0, 0, w, h);

  // subtle noise
  const noise = ctx.createImageData(w, h);
  for (let i = 0; i < noise.data.length; i += 4) {
    const n = 240 + Math.random() * 15;
    noise.data[i] = n;
    noise.data[i + 1] = n;
    noise.data[i + 2] = n;
    noise.data[i + 3] = 14;
  }
  ctx.putImageData(noise, 0, 0);

  // draw panels
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  const rows = 8;
  for (let r = 1; r < rows; r++) {
    const y = Math.round((r / rows) * h);
    const count = 10;
    for (let i = 0; i < count; i++) {
      const cx = Math.round(((i + 0.5) / count) * w + (Math.random() * 40 - 20));
      const cy = y + (Math.random() * 28 - 14);
      const sides = Math.random() < 0.5 ? 5 : 6;
      const radius = 26 + Math.random() * 12;
      drawPolygon(ctx, cx, cy, radius, sides, "#1b1b1b");
    }
  }
  ctx.restore();

  // slight blur by overlay
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function drawPolygon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  sides: number,
  fill: string
) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  for (let k = 0; k < sides; k++) {
    const a = (k / sides) * Math.PI * 2;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    if (k === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}
