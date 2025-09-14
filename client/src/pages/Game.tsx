
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useLocation } from "wouter";
import { getUserData, setVoucherData } from "@/utils/storage";
import { generateVoucherCode } from "@/utils/voucher";

type GameState = "ready" | "shooting" | "goal" | "miss";

export default function Game() {
  const [, setLocation] = useLocation();

  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const ballRef = useRef<THREE.Mesh | null>(null);
  const goalGroupRef = useRef<THREE.Group | null>(null);
  const rafRef = useRef<number>();

  // state + mirror in ref so handlers always see latest without re-init
  const [attempts, setAttempts] = useState(0);
  const [goals, setGoals] = useState(0);
  const [state, _setState] = useState<GameState>("ready");
  const stateRef = useRef<GameState>("ready");
  const setState = (s: GameState) => { stateRef.current = s; _setState(s); };

  useEffect(() => {
    const user = getUserData();
    if (!user) { setLocation("/"); return; }
  }, [setLocation]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    try {
      const scene = new THREE.Scene();
      const texLoader = new THREE.TextureLoader();
      scene.background = texLoader.load("/penalty3d/textures/backdrop.png");

      const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
      camera.position.set(0, 2.4, 7.2);
      camera.lookAt(0, 1.2, -6);

      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.style.display = "block";
      renderer.domElement.style.cursor = "pointer";
      (renderer.domElement.style as any).touchAction = "manipulation";
      mount.appendChild(renderer.domElement);

      // lights
      const hemi = new THREE.HemisphereLight(0xffffff, 0x335522, 0.9);
      const dir = new THREE.DirectionalLight(0xffffff, 0.9);
      dir.position.set(6, 8, 4);
      scene.add(hemi, dir);

      // pitch
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

      // lines
      const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const addLine = (w: number, h: number, z: number, x = 0) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), lineMat);
        m.position.set(x, 0.001, z);
        m.rotation.x = -Math.PI / 2;
        m.renderOrder = 2;
        scene.add(m);
      };
      addLine(16, 0.06, -6);
      addLine(0.06, 11, -2, -8);
      addLine(0.06, 11, -2, 8);
      addLine(16, 0.06, -2);
      addLine(0.06, 30, 0);

      // goal + net
      const goalGroup = new THREE.Group();
      const postMat = new THREE.MeshStandardMaterial({ color: 0xf5f7fb, metalness: 0.1, roughness: 0.35 });
      const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.44, 16), postMat);
      postL.position.set(-3.66, 1.22, -6);
      const postR = postL.clone(); postR.position.x = 3.66;
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 7.32, 16), postMat);
      bar.rotation.z = Math.PI / 2; bar.position.set(0, 2.44, -6);
      goalGroup.add(postL, postR, bar);
      const netTex = texLoader.load("/penalty3d/textures/net_alpha.png", (t)=>{ t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(1.5,1); });
      const netMat = new THREE.MeshBasicMaterial({ map: netTex, transparent: true, opacity: 0.92 });
      const net = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 2.4, 24, 8), netMat);
      net.name = "goalNet"; net.position.set(0, 1.2, -6.03);
      goalGroup.add(net);
      scene.add(goalGroup);

      // ball with improved texture
      const color = texLoader.load("/penalty3d/textures/ball_color.png", t => (t.colorSpace = THREE.SRGBColorSpace));
      const rough = texLoader.load("/penalty3d/textures/ball_roughness.png");
      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 64, 64),
        new THREE.MeshPhysicalMaterial({
          map: color,
          roughnessMap: rough,
          roughness: 0.5,
          metalness: 0.0,
          clearcoat: 0.8,
          clearcoatRoughness: 0.22,
        })
      );
      ball.position.set(0, 0.36, -1.0);
      scene.add(ball);

      // refs
      rendererRef.current = renderer;
      sceneRef.current = scene;
      cameraRef.current = camera;
      ballRef.current = ball;
      goalGroupRef.current = goalGroup;

      // size
      const onResize = () => {
        const r = mount.getBoundingClientRect();
        const width = Math.floor(r.width);
        const height = Math.floor((9 / 16) * width);
        renderer.setSize(width, height, false);
        camera.aspect = width / height; camera.updateProjectionMatrix();
      };
      onResize();
      window.addEventListener("resize", onResize);

      // loop
      let t = 0;
      const loop = () => {
        t += 0.016;
        goalGroup.position.x = Math.sin(t * 0.6) * 1.8;
        renderer.render(scene, camera);
        rafRef.current = requestAnimationFrame(loop);
      };
      loop();

      // TAP handler — only attach once, no state deps
      const canvas = renderer.domElement;
      const onTap = (e: MouseEvent | PointerEvent | TouchEvent) => {
        e.preventDefault();
        if (stateRef.current !== "ready") return;
        const r = canvas.getBoundingClientRect();
        let cx = 0, cy = 0;
        if (e instanceof TouchEvent && e.changedTouches?.[0]) {
          cx = e.changedTouches[0].clientX; cy = e.changedTouches[0].clientY;
        } else if ("clientX" in e) {
          cx = (e as PointerEvent).clientX; cy = (e as PointerEvent).clientY;
        }
        const x = cx - r.left, y = cy - r.top;
        const dirX = THREE.MathUtils.clamp((x / r.width) * 2 - 1, -0.95, 0.95);
        const power = THREE.MathUtils.clamp(0.6 + (1 - y / r.height) * 0.6, 0.6, 1.2);
        shoot(power, dirX);
      };
      canvas.addEventListener("pointerup", onTap as any, { passive: false });
      canvas.addEventListener("click", onTap as any, { passive: false });
      canvas.addEventListener("touchend", onTap as any, { passive: false });
      canvas.addEventListener("touchstart", (e)=>e.preventDefault(), { passive: false });

      return () => {
        window.removeEventListener("resize", onResize);
        canvas.removeEventListener("pointerup", onTap as any);
        canvas.removeEventListener("click", onTap as any);
        canvas.removeEventListener("touchend", onTap as any);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        renderer.dispose();
        mount.removeChild(renderer.domElement);
      };
    } catch (err) {
      console.error(err);
    }
  }, []); // init ONCE

  function pulseNet() {
    const goalGroup = goalGroupRef.current;
    if (!goalGroup) return;
    const net = goalGroup.getObjectByName("goalNet") as THREE.Mesh | null;
    if (!net) return;
    const geo = net.geometry as THREE.PlaneGeometry;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const base = pos.array.slice();
    const t0 = performance.now();
    const dur = 450;
    const tick = () => {
      const k = Math.min(1, (performance.now() - t0) / dur);
      for (let i = 0; i < pos.count; i++) {
        const ix = i * 3, x = base[ix], z = base[ix + 2];
        const d = 1 - Math.min(1, Math.abs(x) / 3.6);
        pos.array[ix + 2] = z - 0.12 * Math.sin(k * Math.PI) * d;
      }
      pos.needsUpdate = true;
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function shoot(power: number, dirX: number) {
    const ball = ballRef.current, goal = goalGroupRef.current, camera = cameraRef.current;
    if (!ball || !goal || !camera || stateRef.current !== "ready") return;

    setState("shooting");
    setAttempts((a) => a + 1);

    const start = ball.position.clone();
    const gx = goal.position.x;
    const goalX = gx + THREE.MathUtils.clamp(dirX * 2.2, -2.6, 2.6);
    const end = new THREE.Vector3(goalX, 1.0 + power * 0.9, -6.05);
    const apex = new THREE.Vector3(
      THREE.MathUtils.lerp(start.x, end.x, 0.5),
      2.25 + power * 1.5,
      THREE.MathUtils.lerp(start.z, end.z, 0.5)
    );

    // small cam kick
    const camStart = camera.position.clone();
    const camT0 = performance.now();
    const camDur = 120;
    const camKick = () => {
      const k = Math.min(1, (performance.now() - camT0) / camDur);
      camera.position.set(camStart.x, camStart.y + 0.05 * Math.sin(k * Math.PI), camStart.z);
      if (k < 1) requestAnimationFrame(camKick);
      else camera.position.copy(camStart);
    };
    requestAnimationFrame(camKick);

    const total = 900;
    const t0 = performance.now();
    const tick = () => {
      const t = (performance.now() - t0) / total;
      const k = Math.min(1, t);

      const p1 = start.clone().multiplyScalar((1 - k) * (1 - k));
      const p2 = apex.clone().multiplyScalar(2 * (1 - k) * k);
      const p3 = end.clone().multiplyScalar(k * k);
      const pos = new THREE.Vector3().add(p1).add(p2).add(p3);
      ball.position.copy(pos);
      ball.rotation.x -= 0.42;

      if (k >= 1) {
        const gxNow = goal.position.x;
        const left = -3.6 + gxNow, right = 3.6 + gxNow, barY = 2.44;
        const inside = pos.z <= -5.95 && pos.x > left + 0.12 && pos.x < right - 0.12 && pos.y > 0.1 && pos.y < barY - 0.1;

        if (inside) {
          setGoals((g) => g + 1);
          setState("goal");
          pulseNet();
          const user = getUserData();
          if (user) {
            const code = generateVoucherCode(user.email);
            setVoucherData({ won: true, code, time: new Date().toISOString() });
          }
          setTimeout(() => setLocation("/win"), 500);
        } else {
          setState("miss");
          setTimeout(() => {
            ball.position.set(0, 0.36, -1.0);
            setState("ready");
          }, 550);
        }
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  return (
    <main className="main-content premium-container pt-12 pb-12 fade-in flex flex-col items-center">
      <section className="text-center mb-4">
        <h1 className="text-3xl md:text-4xl font-heading font-black text-sd-blue mb-2">
          PENALTY SHOOTOUT
          <div className="h-1 w-24 bg-sd-red mx-auto mt-2 rounded-full" />
        </h1>
        <p className="text-sd-black/70 font-medium">
          Tap anywhere on the pitch to shoot. Score once to unlock your voucher.
        </p>
      </section>
      <section className="w-full flex flex-col items-center">
        <div
          ref={mountRef}
          className="premium-card relative w-full max-w-[820px] overflow-hidden"
          style={{ aspectRatio: "16 / 9" }}
        />
        <div className="flex justify-center items-center gap-4 mt-6 flex-wrap w-full max-w-[820px]">
          <div className="premium-card px-6 py-3 text-center">
            <div className="text-2xl font-heading font-black text-sd-blue">{attempts}</div>
            <div className="text-xs text-sd-black/60 font-bold uppercase tracking-wide">Attempts</div>
          </div>
          <div className="premium-card px-6 py-3 text-center">
            <div className="text-2xl font-heading font-black text-sd-red">{goals}</div>
            <div className="text-xs text-sd-black/60 font-bold uppercase tracking-wide">Goals</div>
          </div>
        </div>
      </section>
    </main>
  );
}
