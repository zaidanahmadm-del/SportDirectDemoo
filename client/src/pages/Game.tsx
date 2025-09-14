
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import * as THREE from "three";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getUserData, setVoucherData } from "@/utils/storage";
import { generateVoucherCode } from "@/utils/voucher";

type State = "ready" | "shooting" | "goal" | "miss";

export default function Game() {
  const [, setLocation] = useLocation();

  const [attempts, setAttempts] = useState(0);
  const [goals, setGoals] = useState(0);
  const [state, setState] = useState<State>("ready");
  const [webglError, setWebglError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    ball: THREE.Mesh;
    goalGroup: THREE.Group;
    net: THREE.Mesh | null;
    goalZ: number;
    goalWidth: number;
    goalHeight: number;
    raf?: number;
  }>();

  // Gate behind registration
  useEffect(() => {
    const user = getUserData();
    if (!user) setLocation("/");
  }, [setLocation]);

  // Texture loader helper
  const tex = (p: string) =>
    new Promise<THREE.Texture | null>((resolve) =>
      new THREE.TextureLoader().load(p, t => resolve(t), undefined, () => resolve(null))
    );

  // Pitch markings helpers
  const addRect = (scene: THREE.Scene, w: number, d: number, goalZ: number, y = 0.003) => {
    const m = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const t = 0.06; // line thickness
    const zBack = goalZ, zFront = goalZ + d;
    const top = new THREE.Mesh(new THREE.PlaneGeometry(w, t), m);
    top.rotation.x = -Math.PI / 2; top.position.set(0, y, zBack); scene.add(top);
    const bottom = top.clone(); bottom.position.set(0, y, zFront); scene.add(bottom);
    const sideG = new THREE.PlaneGeometry(d, t);
    const left = new THREE.Mesh(sideG, m);
    left.rotation.x = -Math.PI / 2; left.rotation.z = Math.PI / 2;
    left.position.set(-w/2, y, (zBack+zFront)/2); scene.add(left);
    const right = left.clone(); right.position.x =  w/2; scene.add(right);
  };

  useEffect(() => {
    if (!canvasRef.current) return;
    let disposed = false;

    (async () => {
      try {
        const canvas = canvasRef.current!;
        const scene = new THREE.Scene();

        const camera = new THREE.PerspectiveCamera(52, canvas.width / canvas.height, 0.1, 1000);
        camera.position.set(0, 2.6, 6.2);

        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        renderer.setSize(canvas.width, canvas.height);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Lights
        scene.add(new THREE.HemisphereLight(0xffffff, 0x355a35, 0.75));
        const sun = new THREE.DirectionalLight(0xffffff, 1.0);
        sun.position.set(8, 12, 6);
        sun.castShadow = true;
        sun.shadow.mapSize.set(1024, 1024);
        sun.shadow.camera.near = 1; sun.shadow.camera.far = 50;
        sun.shadow.camera.left = -15; sun.shadow.camera.right = 15;
        sun.shadow.camera.top = 15; sun.shadow.camera.bottom = -15;
        scene.add(sun);

        // Textures
        const [grass, ballSkin, netTex, skyTex, crowdTex] = await Promise.all([
          tex("/textures/grass.jpg"),
          tex("/textures/ball.png"),
          tex("/textures/net.png"),
          tex("/textures/sky.jpg"),
          tex("/textures/crowd.jpg"),
        ]);

        // Sky dome
        if (skyTex) {
          const sky = new THREE.Mesh(
            new THREE.SphereGeometry(200, 32, 32),
            new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide })
          );
          scene.add(sky);
        } else {
          scene.background = new THREE.Color(0x88bdd8);
        }

        if (grass) {
          grass.wrapS = grass.wrapT = THREE.RepeatWrapping;
          grass.repeat.set(28, 28);
          grass.anisotropy = 4;
        }
        if (ballSkin) ballSkin.anisotropy = 4;
        if (netTex) { netTex.anisotropy = 4; netTex.wrapS = netTex.wrapT = THREE.ClampToEdgeWrapping; }

        // Pitch
        const ground = new THREE.Mesh(
          new THREE.PlaneGeometry(60, 60),
          grass ? new THREE.MeshStandardMaterial({ map: grass, roughness: 1, metalness: 0 }) :
                  new THREE.MeshStandardMaterial({ color: 0x2aa12a })
        );
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        scene.add(ground);

        // Goal & markings
        const goalZ = -8;
        const goalWidth = 7.32, goalHeight = 2.44, goalDepth = 1.5;
        addRect(scene, 16, 6, goalZ);  // goal box
        addRect(scene, 28, 10, goalZ); // penalty box
        const spot = new THREE.Mesh(new THREE.CircleGeometry(0.12, 32), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        spot.rotation.x = -Math.PI / 2; spot.position.set(0, 0.003, goalZ + 11); scene.add(spot);

        const goalGroup = new THREE.Group();
        const postMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.28, metalness: 0 });
        const postR = 0.075;
        const post = (w: number, h: number, d: number) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), postMat);
        const left = post(postR*2, goalHeight, postR*2); left.position.set(-goalWidth/2, goalHeight/2, goalZ);
        const right = post(postR*2, goalHeight, postR*2); right.position.set( goalWidth/2, goalHeight/2, goalZ);
        const bar = post(goalWidth, postR*2, postR*2); bar.position.set(0, goalHeight, goalZ);
        const back = post(goalWidth, postR*2, postR*2); back.position.set(0, goalHeight, goalZ - goalDepth);
        const ld = post(postR*2, postR*2, goalDepth); ld.position.set(-goalWidth/2, goalHeight, goalZ - goalDepth/2);
        const rd = post(postR*2, postR*2, goalDepth); rd.position.set( goalWidth/2, goalHeight, goalZ - goalDepth/2);
        [left,right,bar,back,ld,rd].forEach(m=>{m.castShadow=true; goalGroup.add(m);});

        // Net
        let net: THREE.Mesh | null = null;
        if (netTex) {
          const netMat = new THREE.MeshBasicMaterial({ map: netTex, alphaMap: netTex, transparent: true, depthWrite: false, side: THREE.DoubleSide });
          net = new THREE.Mesh(new THREE.PlaneGeometry(goalWidth, goalHeight, 24, 16), netMat);
          net.position.set(0, goalHeight/2, goalZ - goalDepth - 0.02);
          goalGroup.add(net);
        }
        scene.add(goalGroup);

        // Crowd (subtle curved backdrop behind goal)
        if (crowdTex) {
          const crowdMat = new THREE.MeshBasicMaterial({ map: crowdTex });
          const radius = 30, steps = 18;
          for (let i=0;i<=steps;i++) {
            const a = -Math.PI*0.3 + (i/steps)*Math.PI*0.6;
            const x = Math.sin(a)*radius;
            const z = Math.cos(a)*radius + goalZ - 6;
            const p = new THREE.Mesh(new THREE.PlaneGeometry(12,6), crowdMat);
            p.position.set(x,3.5,z); p.lookAt(0,3.2,goalZ); scene.add(p);
          }
        }

        // Ball
        const ball = new THREE.Mesh(
          new THREE.SphereGeometry(0.28, 32, 32),
          ballSkin ? new THREE.MeshStandardMaterial({ map: ballSkin, roughness: 0.45 }) :
                     new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45 })
        );
        ball.position.set(0, 0.28, goalZ + 6);
        ball.castShadow = true;
        scene.add(ball);

        // Soft shadow under ball
        const ballShadow = new THREE.Mesh(
          new THREE.CircleGeometry(0.35, 32),
          new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0.22, transparent: true })
        );
        ballShadow.rotation.x = -Math.PI / 2;
        ballShadow.position.set(ball.position.x, 0.001, ball.position.z);
        scene.add(ballShadow);

        // Animate
        const animate = () => {
          if (disposed) return;
          ballShadow.position.set(ball.position.x, 0.001, ball.position.z);
          renderer.render(scene, camera);
          sceneRef.current!.raf = requestAnimationFrame(animate);
        };
        animate();

        sceneRef.current = { scene, camera, renderer, ball, goalGroup, net, goalZ, goalWidth, goalHeight };
      } catch (e) {
        console.error(e);
        if (!disposed) setWebglError("WebGL is not available on this device.");
      }
    })();

    return () => {
      disposed = true;
      if (sceneRef.current?.raf) cancelAnimationFrame(sceneRef.current.raf);
      sceneRef.current?.renderer?.dispose();
    };
  }, []);

  const resetBall = () => {
    const s = sceneRef.current; if (!s) return;
    s.ball.position.set(0, 0.28, s.goalZ + 6);
  };

  // Simple ripple on the net
  const rippleNet = (hitX: number, hitY: number) => {
    const s = sceneRef.current; if (!s || !s.net) return;
    const g = s.net.geometry as THREE.PlaneGeometry;
    const pos = g.attributes.position as THREE.BufferAttribute;
    const base = pos.array.slice();
    const o = new THREE.Vector3(hitX, hitY, 0);
    const start = performance.now(), D = 480;
    const tick = () => {
      const t = (performance.now() - start) / D;
      if (t >= 1) { pos.set(base as any); pos.needsUpdate = true; return; }
      for (let i=0;i<pos.count;i++){
        const x = pos.getX(i), y = pos.getY(i);
        const d = Math.hypot(x-o.x, y-o.y);
        const amp = Math.max(0, 0.4 - d*0.12);
        pos.setZ(i, -Math.sin(t*Math.PI*2) * amp);
      }
      pos.needsUpdate = true;
      requestAnimationFrame(tick);
    };
    tick();
  };

  const onShoot = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const s = sceneRef.current; if (!s || state!=="ready") return;
    setState("shooting"); setAttempts(a=>a+1);

    const { camera, ball, goalGroup, goalZ, goalWidth, goalHeight } = s;
    const canvas = e.currentTarget;

    // Convert click to a point on the goal plane (z = goalZ)
    const ndc = new THREE.Vector2((e.nativeEvent.offsetX / canvas.width) * 2 - 1, -(e.nativeEvent.offsetY / canvas.height) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, camera);
    const plane = new THREE.Plane(new THREE.Vector3(0,0,1), goalZ);
    const hit = new THREE.Vector3(); ray.ray.intersectPlane(plane, hit);

    // Clamp target inside the posts
    const localX = THREE.MathUtils.clamp(hit.x - goalGroup.position.x, -goalWidth/2 + 0.15, goalWidth/2 - 0.15);
    const y = THREE.MathUtils.clamp(hit.y, 0.2, goalHeight - 0.2);
    const target = new THREE.Vector3(localX + goalGroup.position.x, y, goalZ);

    const startPos = ball.position.clone();
    const start = performance.now(), DUR = 900;
    const step = () => {
      const t = Math.min(1, (performance.now() - start) / DUR);
      const ease = 1 - Math.pow(1-t, 3);
      ball.position.lerpVectors(startPos, target, ease);
      ball.position.y = startPos.y + Math.sin(t*Math.PI)*2.0;
      const mat = ball.material as THREE.MeshStandardMaterial;
      if (mat.map) (mat.map as any).rotation = (mat.map as any).rotation + 0.25;

      if (t>=1){
        const lx = ball.position.x - goalGroup.position.x;
        const inPosts = lx>-goalWidth/2 && lx<goalWidth/2 && ball.position.y>0 && ball.position.y<goalHeight;
        const crossed = ball.position.z <= goalZ + 0.02;
        const goal = inPosts && crossed;
        if (goal){
          setGoals(g=>g+1); setState("goal");
          rippleNet(lx, ball.position.y);
          const user = getUserData();
          if (user){
            const code = generateVoucherCode(user.email);
            setVoucherData({ won: true, code, time: new Date().toISOString() });
          }
          setTimeout(()=>setLocation("/win"), 500);
        } else {
          setState("miss");
          setTimeout(()=>{ resetBall(); setState("ready"); }, 700);
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
          <div className="h-1 w-24 bg-sd-red mx-auto mt-2 rounded-full"/>
        </h1>
        <p className="text-base md:text-lg text-sd-black/70 mt-3 mb-8 font-medium">
          Tap where you want to shoot. <span className="text-sd-red font-bold">Score once to unlock your voucher.</span>
        </p>
      </section>

      <section className="w-full flex flex-col items-center">
        <div className="premium-card p-6 relative mx-auto w-full max-w-[680px]">
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
              className="block mx-auto bg-green-100 rounded-lg cursor-pointer shadow-sm w-full max-w-full h-auto"
              onClick={onShoot}
            />
          )}
        </div>

        {/* Stats + controls */}
        <div className="flex justify-center items-center gap-4 mt-6 flex-wrap w-full max-w-[680px]">
          <div className="premium-card px-5 py-3 text-center">
            <div className="text-xl font-heading font-black text-sd-blue">{attempts}</div>
            <div className="text-xs text-sd-black/60 font-bold uppercase tracking-wide">Attempts</div>
          </div>
          <div className="premium-card px-5 py-3 text-center">
            <div className="text-xl font-heading font-black text-sd-red">{goals}</div>
            <div className="text-xs text-sd-black/60 font-bold uppercase tracking-wide">Goals</div>
          </div>
          <Button onClick={() => { setAttempts(0); setGoals(0); resetBall(); setState("ready"); }} className="premium-button-secondary px-6 py-3">RESET</Button>
          <Button onClick={() => setSoundEnabled(!soundEnabled)} className="premium-button-secondary px-6 py-3">{soundEnabled ? "🔊" : "🔇"} SOUND</Button>
        </div>
      </section>

      {/* Goal overlay */}
      {state==="goal" && (
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
