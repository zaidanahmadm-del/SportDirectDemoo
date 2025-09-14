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
  const animRef = useRef<number>();

  const [attempts, setAttempts] = useState(0);
  const [goals, setGoals] = useState(0);
  const [state, setState] = useState<GameState>("ready");
  const [webglError, setWebglError] = useState<string | null>(null);

  // swipe detection
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
      // Scene & camera
      const scene = new THREE.Scene();
      scene.background = new THREE.TextureLoader().load(
        "/penalty3d/textures/backdrop.png"
      );

      const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
      camera.position.set(0, 2.4, 7);
      camera.lookAt(0, 1.2, -6); // aim at the goal area so everything is framed

      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      mount.appendChild(renderer.domElement);

      // Lights
      const hemi = new THREE.HemisphereLight(0xffffff, 0x335522, 0.8);
      scene.add(hemi);
      const dir = new THREE.DirectionalLight(0xffffff, 0.9);
      dir.position.set(5, 8, 4);
      scene.add(dir);

      // Pitch
      const texLoader = new THREE.TextureLoader();
      const grass = texLoader.load(
        "/penalty3d/textures/grass_tile.png",
        (t) => {
          t.wrapS = t.wrapT = THREE.RepeatWrapping;
          t.repeat.set(8, 8);
          t.colorSpace = THREE.SRGBColorSpace;
        }
      );

      const pitch = new THREE.Mesh(
        new THREE.PlaneGeometry(40, 30),
        new THREE.MeshPhysicalMaterial({ map: grass, roughness: 0.9 })
      );
      pitch.rotation.x = -Math.PI / 2;
      scene.add(pitch);

      // Lines
      const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const mkLine = (
        w: number,
        h: number,
        z: number,
        x: number = 0,
        rotX = -Math.PI / 2
      ) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), lineMat);
        m.position.set(x, 0, z);
        m.rotation.x = rotX;
        m.renderOrder = 2;
        scene.add(m);
      };
      mkLine(16, 0.06, -6); // goal line
      mkLine(0.06, 11, -2, -8);
      mkLine(0.06, 11, -2, 8);
      mkLine(16, 0.06, -2); // penalty box top
      mkLine(0.06, 30, 0, 0); // midfield

      // Goal & net
      const goalGroup = new THREE.Group();
      const postMat = new THREE.MeshStandardMaterial({
        color: 0xf5f7fb,
        metalness: 0.1,
        roughness: 0.4,
      });

      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 2.44, 16),
        postMat
      );
      post.position.set(-3.66, 1.22, -6);
      const postR = post.clone();
      postR.position.x = 3.66;
      const bar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 7.32, 16),
        postMat
      );
      bar.rotation.z = Math.PI / 2;
      bar.position.set(0, 2.44, -6);

      goalGroup.add(post, postR, bar);

      const netTex = texLoader.load(
        "/penalty3d/textures/net_alpha.png",
        (t) => {
          t.wrapS = t.wrapT = THREE.RepeatWrapping;
          t.repeat.set(1.5, 1);
        }
      );
      const netMat = new THREE.MeshBasicMaterial({
        map: netTex,
        transparent: true,
        opacity: 0.9,
      });
      const net = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 2.4), netMat);
      net.position.set(0, 1.2, -6.03);
      goalGroup.add(net);

      scene.add(goalGroup);

      // Ball (bigger & a bit higher so it's clearly visible)
      const ballColor = texLoader.load(
        "/penalty3d/textures/ball_color.png",
        (t) => (t.colorSpace = THREE.SRGBColorSpace)
      );
      const ballRough = texLoader.load("/penalty3d/textures/ball_roughness.png");
      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 48, 48),
        new THREE.MeshPhysicalMaterial({
          map: ballColor,
          roughnessMap: ballRough,
          roughness: 0.55,
          metalness: 0.0,
          clearcoat: 0.4,
          clearcoatRoughness: 0.35,
        })
      );
      resetBall(ball); // set visible starting position
      scene.add(ball);

      // Store refs
      rendererRef.current = renderer;
      sceneRef.current = scene;
      cameraRef.current = camera;
      ballRef.current = ball;
      goalGroupRef.current = goalGroup;

      // Resize to wrapper (kept inside card)
      const onResize = () => {
        const parent = mount.getBoundingClientRect();
        const width = Math.floor(parent.width);
        const height = Math.floor(parent.width * (10 / 16)); // match CSS aspect ratio
        renderer.setSize(width, height, false);
        const c = renderer.domElement.style;
        c.width = "100%";
        c.height = "100%";
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };
      onResize();
      window.addEventListener("resize", onResize);

      // Animate (goal oscillates)
      let t = 0;
      const animate = () => {
        t += 0.016;
        goalGroup.position.x = Math.sin(t * 0.6) * 1.4;
        renderer.render(scene, camera);
        animRef.current = requestAnimationFrame(animate);
      };
      animate();

      // Input (swipe)
      const dom = renderer.domElement;
      const onDown = (e: PointerEvent) => {
        const r = dom.getBoundingClientRect();
        startPt.current = {
          x: e.clientX - r.left,
          y: e.clientY - r.top,
          time: performance.now(),
        };
      };
      const onUp = (e: PointerEvent) => {
        if (!startPt.current || state !== "ready") return;
        const r = dom.getBoundingClientRect();
        const end = {
          x: e.clientX - r.left,
          y: e.clientY - r.top,
          time: performance.now(),
        };
        const dx = end.x - startPt.current.x;
        const dy = startPt.current.y - end.y; // upward => positive
        const dt = Math.max(16, end.time - startPt.current.time);
        const power =
          Math.min(1.0, Math.hypot(dx, dy) / 300) * (dt < 800 ? 1.0 : 0.7);
        const dirX = THREE.MathUtils.clamp(dx / (r.width * 0.5), -0.9, 0.9);
        shoot(power, dirX);
        startPt.current = null;
      };
      dom.addEventListener("pointerdown", onDown);
      dom.addEventListener("pointerup", onUp);

      // Cleanup
      return () => {
        dom.removeEventListener("pointerdown", onDown);
        dom.removeEventListener("pointerup", onUp);
        window.removeEventListener("resize", onResize);
        if (animRef.current) cancelAnimationFrame(animRef.current);
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
    // slightly raised and in front of the goal (very visible)
    m.position.set(0, 0.32, -1.2);
    m.rotation.set(0, 0, 0);
  }

  function shoot(power: number, dirX: number) {
    if (!sceneRef.current || !ballRef.current || !goalGroupRef.current || state !== "ready")
      return;

    setState("shooting");
    setAttempts((a) => a + 1);

    const ball = ballRef.current;
    const start = ball.position.clone();
    const goalX =
      goalGroupRef.current.position.x +
      THREE.MathUtils.clamp(dirX * 2.0, -2.5, 2.5);
    const end = new THREE.Vector3(goalX, 1.0 + power * 0.8, -6.05);
    const apex = new THREE.Vector3(
      THREE.MathUtils.lerp(start.x, end.x, 0.5),
      2.2 + power * 1.4,
      THREE.MathUtils.lerp(start.z, end.z, 0.5)
    );

    const total = 1000;
    const t0 = performance.now();

    const animateShot = () => {
      const t = (performance.now() - t0) / total;
      const k = Math.min(1, t);

      // Quadratic bezier interpolation for an arc
      const p1 = start.clone().multiplyScalar((1 - k) * (1 - k));
      const p2 = apex.clone().multiplyScalar(2 * (1 - k) * k);
      const p3 = end.clone().multiplyScalar(k * k);
      const pos = new THREE.Vector3().add(p1).add(p2).add(p3);
      ball.position.copy(pos);
      ball.rotation.x -= 0.35;

      if (k >= 1) {
        const gx = goalGroupRef.current.position.x;
        const left = -3.6 + gx,
          right = 3.6 + gx,
          barY = 2.44;
        const inside =
          pos.z <= -5.95 &&
          pos.x > left + 0.1 &&
          pos.x < right - 0.1 &&
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
          }, 600);
        }
        return;
      }
      animRef.current = requestAnimationFrame(animateShot);
    };

    animRef.current = requestAnimationFrame(animateShot);
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
          <div className="h-1 w-24 bg-sd-red mx-auto mt-2 rounded-full"></div>
        </h1>
        <p className="text-sd-black/70 font-medium">
          Swipe to shoot. Score once to unlock your voucher.
        </p>
      </section>

      {/* Canvas wrapper stays inside the card and keeps aspect ratio */}
      <section className="w-full flex flex-col items-center">
        <div
          ref={mountRef}
          className="premium-card relative w-full max-w-[680px] overflow-hidden"
          style={{ aspectRatio: "16 / 10" }}
        />
        <div className="flex justify-center items-center gap-4 mt-6 flex-wrap w-full max-w-[680px]">
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
