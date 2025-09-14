
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import * as THREE from "three";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getUserData, setVoucherData } from "@/utils/storage";
import { generateVoucherCode } from "@/utils/voucher";

type GS = "ready" | "shooting" | "goal" | "miss";

export default function Game() {
  const [, setLocation] = useLocation();
  const [attempts, setAttempts] = useState(0);
  const [goals, setGoals] = useState(0);
  const [gameState, setGameState] = useState<GS>("ready");
  const [webglError, setWebglError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const markerRef = useRef<HTMLDivElement>(null);

  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    ball: THREE.Mesh;
    net: THREE.Mesh | null;
    goalGroup: THREE.Group;
    goalZ: number;
    goalWidth: number;
    goalHeight: number;
    animationId?: number;
  }>();

  // redirect if not registered
  useEffect(() => {
    const user = getUserData();
    if (!user) setLocation("/");
  }, [setLocation]);

  // helpers
  const loadTexture = (path: string) =>
    new Promise<THREE.Texture | null>((resolve) => {
      new THREE.TextureLoader().load(path, (t) => resolve(t), undefined, () => resolve(null));
    });

  // init three
  useEffect(() => {
    if (!canvasRef.current) return;
    let disposed = false;
    (async () => {
      try {
        const canvas = canvasRef.current;
        const scene = new THREE.Scene();

        const camera = new THREE.PerspectiveCamera(52, canvas.width / canvas.height, 0.1, 1000);
        camera.position.set(0, 2.2, 6.5);

        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        renderer.setSize(canvas.width, canvas.height);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // lighting
        scene.add(new THREE.HemisphereLight(0xffffff, 0x3a5a3a, 0.7));
        const sun = new THREE.DirectionalLight(0xffffff, 1.0);
        sun.position.set(8, 12, 6);
        sun.castShadow = true;
        sun.shadow.mapSize.set(1024, 1024);
        sun.shadow.camera.near = 1; sun.shadow.camera.far = 40;
        sun.shadow.camera.left = -15; sun.shadow.camera.right = 15;
        sun.shadow.camera.top = 15; sun.shadow.camera.bottom = -15;
        scene.add(sun);

        // textures
        const [grassTex, ballTex, netTex, crowdTex, adsTex, skyTex] = await Promise.all([
          loadTexture("/textures/grass.jpg"),
          loadTexture("/textures/ball.png"),
          loadTexture("/textures/net.png"),
          loadTexture("/textures/crowd.jpg"),
          loadTexture("/textures/ads.jpg"),
          loadTexture("/textures/sky.jpg"),
        ]);

        // sky
        if (skyTex) {
          const sky = new THREE.Mesh(
            new THREE.SphereGeometry(200, 32, 32),
            new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide })
          );
          sky.rotation.y = Math.PI;
          scene.add(sky);
        } else {
          scene.background = new THREE.Color(0x8db3c9);
        }

        if (grassTex) {
          grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
          grassTex.repeat.set(28, 28);
          grassTex.anisotropy = 4;
        }
        if (ballTex) ballTex.anisotropy = 4;
        if (netTex) { netTex.anisotropy = 4; netTex.wrapS = netTex.wrapT = THREE.ClampToEdgeWrapping; }

        // pitch
        const ground = new THREE.Mesh(
          new THREE.PlaneGeometry(60, 60),
          grassTex ? new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 }) :
                     new THREE.MeshStandardMaterial({ color: 0x2aa12a, roughness: 1 })
        );
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        scene.add(ground);

        const goalZ = -8;
        const goalWidth = 7.32;
        const goalHeight = 2.44;
        const goalDepth = 1.5;
        const postR = 0.07;

        // ads: move BEHIND the goal so it never obstructs
        if (adsTex) {
          const ad = new THREE.Mesh(new THREE.PlaneGeometry(18, 1.1), new THREE.MeshBasicMaterial({ map: adsTex }));
          ad.position.set(0, 0.55, goalZ - goalDepth - 1.6); // behind net
          scene.add(ad);
        }

        // simple stands (curved) – subtle, not intrusive
        if (crowdTex) {
          const mat = new THREE.MeshBasicMaterial({ map: crowdTex });
          const radius = 28;
          const start = -Math.PI * 0.3, end = Math.PI * 0.3, steps = 16;
          for (let i = 0; i <= steps; i++) {
            const a = start + (i / steps) * (end - start);
            const x = Math.sin(a) * radius;
            const z = Math.cos(a) * radius + goalZ - 6;
            const p = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), mat);
            p.position.set(x, 3.5, z);
            p.lookAt(0, 3.2, goalZ);
            scene.add(p);
          }
        }

        // pitch markings (front of goal line)
        const addRect = (w: number, d: number) => {
          const m = new THREE.MeshBasicMaterial({ color: 0xffffff });
          const t = 0.06;
          const zBack = goalZ, zFront = goalZ + d;
          const top = new THREE.Mesh(new THREE.PlaneGeometry(w, t), m);
          top.rotation.x = -Math.PI / 2; top.position.set(0, 0.003, zBack); scene.add(top);
          const bottom = top.clone(); bottom.position.set(0, 0.003, zFront); scene.add(bottom);
          const sideG = new THREE.PlaneGeometry(d, t);
          const left = new THREE.Mesh(sideG, m);
          left.rotation.x = -Math.PI / 2; left.rotation.z = Math.PI / 2;
          left.position.set(-w / 2, 0.003, (zBack + zFront) / 2); scene.add(left);
          const right = left.clone(); right.position.x = w / 2; scene.add(right);
        };
        addRect(16, 6);  // goal box
        addRect(28, 10); // penalty box
        const spot = new THREE.Mesh(new THREE.CircleGeometry(0.12, 32), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        spot.rotation.x = -Math.PI / 2; spot.position.set(0, 0.003, goalZ + 11); scene.add(spot);

        // goal: rectangular posts to mimic the 2D-look style
        const goalGroup = new THREE.Group();
        const postMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.0 });
        const postBox = (w: number, h: number, d: number) => new THREE.Mesh(new THREE.BoxGeometry(w,h,d), postMat);

        const leftPost = postBox(postR*2, goalHeight, postR*2);
        leftPost.position.set(-goalWidth/2, goalHeight/2, goalZ); leftPost.castShadow = true; goalGroup.add(leftPost);
        const rightPost = postBox(postR*2, goalHeight, postR*2);
        rightPost.position.set(goalWidth/2, goalHeight/2, goalZ); rightPost.castShadow = true; goalGroup.add(rightPost);

        const crossbar = postBox(goalWidth, postR*2, postR*2);
        crossbar.position.set(0, goalHeight, goalZ); crossbar.castShadow = true; goalGroup.add(crossbar);

        const backbar = postBox(goalWidth, postR*2, postR*2);
        backbar.position.set(0, goalHeight, goalZ - goalDepth); goalGroup.add(backbar);

        const leftDepth = postBox(postR*2, postR*2, goalDepth);
        leftDepth.position.set(-goalWidth/2, goalHeight, goalZ - goalDepth/2); goalGroup.add(leftDepth);
        const rightDepth = postBox(postR*2, postR*2, goalDepth);
        rightDepth.position.set(goalWidth/2, goalHeight, goalZ - goalDepth/2); goalGroup.add(rightDepth);

        // net
        let net: THREE.Mesh | null = null;
        if (netTex) {
          const netMat = new THREE.MeshBasicMaterial({ map: netTex, alphaMap: netTex, transparent: true, depthWrite: false, side: THREE.DoubleSide });
          net = new THREE.Mesh(new THREE.PlaneGeometry(goalWidth, goalHeight, 24, 16), netMat);
          net.position.set(0, goalHeight/2, goalZ - goalDepth - 0.02);
          goalGroup.add(net);
        }
        scene.add(goalGroup);

        // ball
        const ball = new THREE.Mesh(
          new THREE.SphereGeometry(0.28, 32, 32),
          ballTex ? new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.45 }) :
                    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45 })
        );
        ball.position.set(0, 0.28, goalZ + 6);
        ball.castShadow = true;
        scene.add(ball);

        const ballShadow = new THREE.Mesh(
          new THREE.CircleGeometry(0.35, 32),
          new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0.22, transparent: true })
        );
        ballShadow.rotation.x = -Math.PI / 2;
        ballShadow.position.set(ball.position.x, 0.001, ball.position.z);
        scene.add(ballShadow);

        // store
        sceneRef.current = { scene, camera, renderer, ball, net, goalGroup, goalZ, goalWidth, goalHeight };

        camera.lookAt(0, 1.2, goalZ);

        // animate
        let dir = 1;
        const loop = () => {
          if (!sceneRef.current || disposed) return;
          sceneRef.current.goalGroup.position.x += dir * 0.018;
          if (sceneRef.current.goalGroup.position.x > 2 || sceneRef.current.goalGroup.position.x < -2) dir *= -1;
          ballShadow.position.set(sceneRef.current.ball.position.x, 0.001, sceneRef.current.ball.position.z);
          sceneRef.current.renderer.render(scene, camera);
          sceneRef.current.animationId = requestAnimationFrame(loop);
        };
        loop();
      } catch (e) {
        console.error("WebGL init failed", e);
        if (!disposed) setWebglError("WebGL not available on this device.");
      }
    })();
    return () => {
      disposed = true;
      if (sceneRef.current?.animationId) cancelAnimationFrame(sceneRef.current.animationId);
      if (sceneRef.current?.renderer) sceneRef.current.renderer.dispose();
    };
  }, []);

  const resetBall = () => {
    if (!sceneRef.current) return;
    const { ball, goalZ } = sceneRef.current;
    ball.position.set(0, 0.28, goalZ + 6);
  };

  const rippleNet = (hitX: number, hitY: number) => {
    const s = sceneRef.current;
    if (!s || !s.net) return;
    const geom = s.net.geometry as THREE.PlaneGeometry;
    const pos = geom.attributes.position as THREE.BufferAttribute;
    const base = pos.array.slice(); // copy
    const start = performance.now();
    const duration = 500;
    const origin = new THREE.Vector3(hitX, hitY, 0);
    const tick = () => {
      const t = (performance.now() - start) / duration;
      if (t >= 1) { geom.attributes.position.set(base as any); geom.attributes.position.needsUpdate = true; return; }
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i); const y = pos.getY(i);
        const d = Math.hypot(x - origin.x, y - origin.y);
        const amp = Math.max(0, 0.4 - d * 0.12);
        const z = -Math.sin(t * Math.PI * 2) * amp;
        pos.setZ(i, z);
      }
      pos.needsUpdate = true;
      requestAnimationFrame(tick);
    };
    tick();
  };

  const handleShoot = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const s = sceneRef.current;
    if (!s || gameState !== "ready") return;
    setGameState("shooting");
    setAttempts((a) => a + 1);

    // show a quick tap marker that fades
    if (markerRef.current) {
      const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
      markerRef.current.style.opacity = "1";
      markerRef.current.style.transform = `translate(${e.clientX - rect.left - 12}px, ${e.clientY - rect.top - 12}px)`;
      requestAnimationFrame(() => { markerRef.current!.style.opacity = "0"; });
    }

    const { camera, ball, goalGroup, goalZ, goalWidth, goalHeight } = s;
    const canvas = e.currentTarget;

    // Raycast to plane z=goalZ from click
    const ndc = new THREE.Vector2(
      ((e.nativeEvent.offsetX) / canvas.width) * 2 - 1,
      -((e.nativeEvent.offsetY) / canvas.height) * 2 + 1
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, camera);
    const plane = new THREE.Plane(new THREE.Vector3(0,0,1), goalZ);
    const hit = new THREE.Vector3();
    ray.ray.intersectPlane(plane, hit);

    // clamp inside goal mouth with tiny inaccuracy
    const localX = THREE.MathUtils.clamp(hit.x - goalGroup.position.x, -goalWidth/2 + 0.15, goalWidth/2 - 0.15);
    const y = THREE.MathUtils.clamp(hit.y, 0.2, goalHeight - 0.2);
    const target = new THREE.Vector3(localX + goalGroup.position.x, y, goalZ);

    const startPos = ball.position.clone();
    const duration = 900;
    const start = performance.now();

    const step = () => {
      const now = performance.now();
      const t = Math.min(1, (now - start) / duration);
      const ease = 1 - Math.pow(1 - t, 3);

      ball.position.lerpVectors(startPos, target, ease);
      ball.position.y = startPos.y + Math.sin(t * Math.PI) * 2.0;
      const mat = ball.material as THREE.MeshStandardMaterial;
      if (mat.map) (mat.map as any).rotation = (mat.map as any).rotation + 0.25;

      if (t >= 1) {
        const lx = ball.position.x - goalGroup.position.x;
        const inPosts = lx > -goalWidth/2 && lx < goalWidth/2 && ball.position.y > 0 && ball.position.y < goalHeight;
        const crossed = ball.position.z <= goalZ + 0.02;
        const isGoal = inPosts && crossed;
        if (isGoal) {
          setGoals((g) => g + 1);
          setGameState("goal");
          rippleNet(lx, ball.position.y);
          const user = getUserData();
          if (user) {
            const code = generateVoucherCode(user.email);
            setVoucherData({ won: true, code, time: new Date().toISOString() });
          }
          setTimeout(() => setLocation("/win"), 500);
        } else {
          setGameState("miss");
          setTimeout(() => { resetBall(); setGameState("ready"); }, 700);
        }
        return;
      }
      requestAnimationFrame(step);
    };
    step();
  };

  return (
    <main className="main-content premium-container pt-12 pb-12 fade-in flex flex-col items-center">
      <section className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-heading font-black text-sd-blue mb-2">
          PENALTY SHOOTOUT
          <div className="h-1 w-24 bg-sd-red mx-auto mt-2 rounded-full" />
        </h1>
        <p className="text-base md:text-lg text-sd-black/70 mt-3 mb-8 font-medium">
          Tap where you want to shoot. <span className="text-sd-red font-bold">Score once to unlock your voucher.</span>
        </p>
      </section>

      <section className="mb-8 w-full flex flex-col items-center">
        <div className="premium-card p-6 relative mx-auto w-full max-w-[680px]">
          {/* tap marker */}
          <div
            ref={markerRef}
            style={{
              position: "absolute",
              width: 24,
              height: 24,
              borderRadius: "50%",
              border: "3px solid rgba(255,0,0,0.9)",
              boxShadow: "0 0 12px rgba(255,0,0,0.6)",
              pointerEvents: "none",
              transition: "opacity 400ms ease",
              opacity: 0,
            }}
          />
          {webglError ? (
            <div className="bg-white p-8 rounded-lg border-2 border-sd-light-border text-center">
              <div className="text-6xl mb-6">⚽</div>
              <h3 className="text-2xl font-heading font-black text-sd-blue mb-4">3D GAME UNAVAILABLE</h3>
              <p className="text-sd-black/70 mb-6 font-medium">{webglError}</p>
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              width={480}
              height={320}
              data-testid="canvas-game"
              className="block mx-auto bg-green-100 rounded-lg cursor-pointer shadow-sm w-full max-w-full h-auto"
              onClick={handleShoot}
            />
          )}
        </div>

        <div className="flex justify-center items-center gap-4 mt-6 flex-wrap w-full max-w-[680px]">
          <Button onClick={() => { setAttempts(0); setGoals(0); resetBall(); setGameState("ready"); }} className="premium-button-secondary px-6 py-3">RESET</Button>
          <Button onClick={() => setSoundEnabled(!soundEnabled)} className="premium-button-secondary px-6 py-3">{soundEnabled ? "🔊" : "🔇"} SOUND</Button>
        </div>
      </section>

      {/* status chips */}
      <div className="flex justify-center space-x-6 mb-2">
        <div className="premium-card px-6 py-3 text-center">
          <div className="text-xl font-heading font-black text-sd-blue">{attempts}</div>
          <div className="text-xs text-sd-black/60 font-bold uppercase tracking-wide">Attempts</div>
        </div>
        <div className="premium-card px-6 py-3 text-center">
          <div className="text-xl font-heading font-black text-sd-red">{goals}</div>
          <div className="text-xs text-sd-black/60 font-bold uppercase tracking-wide">Goals</div>
        </div>
      </div>

      {gameState === "goal" && (
        <div className="fixed inset-0 bg-sd-black/90 flex items-center justify-center z-50 fade-in pointer-events-auto">
          <Card className="max-w-sm mx-4 relative overflow-hidden premium-card bounce-in">
            <CardContent className="pt-8 pb-8 text-center">
              <h2 className="text-5xl font-heading font-black text-sd-red mb-6">GOAL!</h2>
              <p className="text-xl font-bold text-sd-black mb-8">You've unlocked your exclusive voucher!</p>
              <Button className="premium-button w-full h-14 text-lg" onClick={() => setLocation("/win")}>
                VIEW YOUR VOUCHER
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  );
}
