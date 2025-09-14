import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import * as THREE from "three";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getUserData, setVoucherData } from "@/utils/storage";
import { generateVoucherCode } from "@/utils/voucher";

export default function Game() {
  const [, setLocation] = useLocation();

  const [attempts, setAttempts] = useState(0);
  const [goals, setGoals] = useState(0);
  const [gameState, setGameState] = useState<"ready" | "shooting" | "goal" | "miss">("ready");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showGoalOverlay, setShowGoalOverlay] = useState(false);
  const [webglError, setWebglError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    ball: THREE.Mesh;
    goalGroup: THREE.Group;
    animationId?: number;
  }>();

  // Redirect if not registered
  useEffect(() => {
    const userData = getUserData();
    if (!userData) {
      setLocation("/");
      return;
    }
  }, [setLocation]);

  // Helpers
  const loadTexture = (path: string) =>
    new Promise<THREE.Texture | null>((resolve) => {
      new THREE.TextureLoader().load(path, (t) => resolve(t), undefined, () => resolve(null));
    });

  const addRectLine = (scene: THREE.Scene, w: number, d: number, zBack: number, y = 0.002) => {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const thick = 0.06;

    // top & bottom
    const top = new THREE.Mesh(new THREE.PlaneGeometry(w, thick), mat);
    top.rotation.x = -Math.PI / 2;
    top.position.set(0, y, zBack);
    scene.add(top);

    const bottom = top.clone();
    bottom.position.set(0, y, zBack + d);
    scene.add(bottom);

    // left & right
    const sideGeo = new THREE.PlaneGeometry(d, thick);
    const left = new THREE.Mesh(sideGeo, mat);
    left.rotation.x = -Math.PI / 2;
    left.rotation.z = Math.PI / 2;
    left.position.set(-w / 2, y, zBack + d / 2);
    scene.add(left);

    const right = left.clone();
    right.position.x = w / 2;
    scene.add(right);
  };

  const addCircleLine = (scene: THREE.Scene, r: number, cx: number, cz: number, y = 0.002, segments = 64) => {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const thick = 0.06;
    for (let i = 0; i < segments; i++) {
      const a1 = (i / segments) * Math.PI * 2;
      const a2 = ((i + 1) / segments) * Math.PI * 2;
      const x1 = cx + r * Math.cos(a1);
      const z1 = cz + r * Math.sin(a1);
      const x2 = cx + r * Math.cos(a2);
      const z2 = cz + r * Math.sin(a2);
      const segLen = Math.hypot(x2 - x1, z2 - z1);
      const geo = new THREE.PlaneGeometry(segLen, thick);
      const seg = new THREE.Mesh(geo, mat);
      seg.rotation.x = -Math.PI / 2;
      seg.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
      seg.rotation.z = Math.atan2(z2 - z1, x2 - x1);
      scene.add(seg);
    }
  };

  // Init Three.js
  useEffect(() => {
    if (!canvasRef.current) return;
    let disposed = false;

    (async () => {
      try {
        const canvas = canvasRef.current;

        // Scene / camera / renderer
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87ceeb);

        const camera = new THREE.PerspectiveCamera(55, canvas.width / canvas.height, 0.1, 1000);
        camera.position.set(0, 2.6, 5.2);
        camera.lookAt(0, 1.2, -8);

        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        renderer.setSize(canvas.width, canvas.height);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Lights
        scene.add(new THREE.HemisphereLight(0xffffff, 0x3a5a3a, 0.6));
        const sun = new THREE.DirectionalLight(0xffffff, 1.0);
        sun.position.set(6, 10, 6);
        sun.castShadow = true;
        sun.shadow.mapSize.set(1024, 1024);
        sun.shadow.camera.near = 1;
        sun.shadow.camera.far = 40;
        sun.shadow.camera.left = -15;
        sun.shadow.camera.right = 15;
        sun.shadow.camera.top = 15;
        sun.shadow.camera.bottom = -15;
        scene.add(sun);

        // Textures (optional)
        const [grassTex, ballTex, netTex] = await Promise.all([
          loadTexture("/textures/grass.jpg"),
          loadTexture("/textures/ball.png"),
          loadTexture("/textures/net.png"),
        ]);
        if (grassTex) {
          grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
          grassTex.repeat.set(24, 24);
          grassTex.anisotropy = 4;
        }
        if (ballTex) ballTex.anisotropy = 4;
        if (netTex) {
          netTex.anisotropy = 4;
          netTex.wrapS = netTex.wrapT = THREE.ClampToEdgeWrapping;
        }

        // Pitch (bigger, textured)
        const ground = new THREE.Mesh(
          new THREE.PlaneGeometry(60, 60),
          grassTex
            ? new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1, metalness: 0 })
            : new THREE.MeshStandardMaterial({ color: 0x2aa12a, roughness: 1 })
        );
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        scene.add(ground);

        // Pitch markings near the goal we shoot at
        // Real-ish dims (meters): goal at z=-8, penalty area extends 16.5m, width ~40.3m
        addRectLine(scene, 16, 6, -14);         // goal box (~5.5m depth -> scaled ~6)
        addRectLine(scene, 28, 10, -18);        // penalty box (~16.5m depth -> scaled ~10)
        // Penalty spot (~11m): place a small white dot
        {
          const spot = new THREE.Mesh(
            new THREE.CircleGeometry(0.12, 32),
            new THREE.MeshBasicMaterial({ color: 0xffffff })
          );
          spot.rotation.x = -Math.PI / 2;
          spot.position.set(0, 0.003, -18); // between boxes
          scene.add(spot);
        }
        // Penalty arc (outside area)
        addCircleLine(scene, 3.5, 0, -18 + 3.5, 0.002);

        // Goal frame with depth + nets
        const goalGroup = new THREE.Group();
        const goalWidth = 7.32;
        const goalHeight = 2.44;
        const goalDepth = 1.5;
        const postR = 0.08;

        const postMat = new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          roughness: 0.25,
          metalness: 0.0,
          clearcoat: 0.7,
          clearcoatRoughness: 0.2,
        });

        const postGeo = new THREE.CylinderGeometry(postR, postR, goalHeight, 24);
        const leftPost = new THREE.Mesh(postGeo, postMat);
        leftPost.position.set(-goalWidth / 2, goalHeight / 2, -8);
        leftPost.castShadow = true;
        goalGroup.add(leftPost);

        const rightPost = new THREE.Mesh(postGeo, postMat);
        rightPost.position.set(goalWidth / 2, goalHeight / 2, -8);
        rightPost.castShadow = true;
        goalGroup.add(rightPost);

        const crossGeo = new THREE.CylinderGeometry(postR, postR, goalWidth, 24);
        const crossbar = new THREE.Mesh(crossGeo, postMat);
        crossbar.rotation.z = Math.PI / 2;
        crossbar.position.set(0, goalHeight, -8);
        crossbar.castShadow = true;
        goalGroup.add(crossbar);

        // Backbar (depth)
        const backbar = new THREE.Mesh(crossGeo, postMat);
        backbar.rotation.z = Math.PI / 2;
        backbar.position.set(0, goalHeight, -8 - goalDepth);
        backbar.castShadow = true;
        goalGroup.add(backbar);

        // Side depth bars
        const depthGeo = new THREE.CylinderGeometry(postR, postR, goalDepth, 24);
        const leftDepth = new THREE.Mesh(depthGeo, postMat);
        leftDepth.rotation.x = Math.PI / 2;
        leftDepth.position.set(-goalWidth / 2, goalHeight, -8 - goalDepth / 2);
        leftDepth.castShadow = true;
        goalGroup.add(leftDepth);

        const rightDepth = leftDepth.clone();
        rightDepth.position.x = goalWidth / 2;
        goalGroup.add(rightDepth);

        // Nets: back + sides
        if (netTex) {
          const netMat = new THREE.MeshBasicMaterial({
            map: netTex,
            alphaMap: netTex,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            color: 0xffffff,
          });

          const backNet = new THREE.Mesh(new THREE.PlaneGeometry(goalWidth, goalHeight), netMat);
          backNet.position.set(0, goalHeight / 2, -8 - goalDepth - 0.02);
          goalGroup.add(backNet);

          const sideNetGeo = new THREE.PlaneGeometry(goalDepth, goalHeight);
          const leftNet = new THREE.Mesh(sideNetGeo, netMat);
          leftNet.rotation.y = Math.PI / 2;
          leftNet.position.set(-goalWidth / 2 - 0.02, goalHeight / 2, -8 - goalDepth / 2);
          goalGroup.add(leftNet);

          const rightNet = leftNet.clone();
          rightNet.position.x = goalWidth / 2 + 0.02;
          goalGroup.add(rightNet);
        }

        scene.add(goalGroup);

        // Ball (bigger & closer)
        const ball = new THREE.Mesh(
          new THREE.SphereGeometry(0.28, 32, 32),
          ballTex
            ? new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.45 })
            : new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45 })
        );
        ball.position.set(0, 0.28, -2.2); // clearly visible
        ball.castShadow = true;
        scene.add(ball);

        // Soft contact shadow under ball
        const ballShadow = new THREE.Mesh(
          new THREE.CircleGeometry(0.35, 32),
          new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0.22, transparent: true })
        );
        ballShadow.rotation.x = -Math.PI / 2;
        ballShadow.position.set(ball.position.x, 0.001, ball.position.z);
        ballShadow.renderOrder = 1;
        scene.add(ballShadow);

        // Store refs
        sceneRef.current = { scene, camera, renderer, ball, goalGroup };

        // Goal animation (side-to-side)
        let dir = 1;
        const animateGoal = () => {
          if (!sceneRef.current || disposed) return;
          goalGroup.position.x += dir * 0.02;
          if (goalGroup.position.x > 2 || goalGroup.position.x < -2) dir *= -1;

          ballShadow.position.set(sceneRef.current.ball.position.x, 0.001, sceneRef.current.ball.position.z);

          renderer.render(scene, camera);
          sceneRef.current.animationId = requestAnimationFrame(animateGoal);
        };
        animateGoal();
      } catch (err) {
        console.error("WebGL init failed:", err);
        if (!disposed) {
          setWebglError(
            "Your device does not support WebGL, which is required for the 3D game. Please try a different browser or device."
          );
        }
      }
    })();

    return () => {
      disposed = true;
      if (sceneRef.current?.animationId) cancelAnimationFrame(sceneRef.current.animationId);
      if (sceneRef.current?.renderer) sceneRef.current.renderer.dispose();
    };
  }, []);

  // Shooting
  const shootBall = (clickX: number, clickY: number) => {
    if (!sceneRef.current || gameState !== "ready") return;

    setGameState("shooting");
    setAttempts((p) => p + 1);

    const { ball } = sceneRef.current;
    const canvas = canvasRef.current!;
    const spreadX = (clickX / canvas.width - 0.5) * 0.5 + (Math.random() - 0.5) * 0.2;
    const spreadY = (0.5 - clickY / canvas.height) * 0.3 + Math.random() * 0.15;

    const startPos = ball.position.clone();
    const targetPos = new THREE.Vector3(spreadX * 8, 1 + spreadY * 2, -8); // towards goal

    const duration = 1000;
    const start = Date.now();

    const step = () => {
      const t = Math.min((Date.now() - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);

      ball.position.lerpVectors(startPos, targetPos, ease);
      ball.position.y = startPos.y + Math.sin(t * Math.PI) * 2;

      if (t >= 1) {
        const inGoal =
          ball.position.x > -3.66 &&
          ball.position.x < 3.66 &&
          ball.position.y > 0 &&
          ball.position.y < 2.44 &&
          ball.position.z <= -8.0;

        if (inGoal) {
          setGoals((p) => p + 1);
          setGameState("goal");
          handleGoalScored();
        } else {
          setGameState("miss");
          setTimeout(() => {
            resetBall();
            setGameState("ready");
          }, 900);
        }
        return;
      }

      requestAnimationFrame(step);
    };

    step();
  };

  const resetBall = () => {
    if (!sceneRef.current) return;
    sceneRef.current.ball.position.set(0, 0.28, -2.2);
  };

  const handleGoalScored = () => {
    const userData = getUserData();
    if (!userData) return;

    const voucherCode = generateVoucherCode(userData.email);
    setVoucherData({ won: true, code: voucherCode, time: new Date().toISOString() });
    setShowGoalOverlay(true);

    setTimeout(() => {
      resetBall();
      setGameState("ready");
    }, 1200);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    shootBall(e.clientX - rect.left, e.clientY - rect.top);
  };

  const resetGame = () => {
    setAttempts(0);
    setGoals(0);
    setGameState("ready");
    resetBall();
  };

  const goToWin = () => {
    setShowGoalOverlay(false);
    setLocation("/win");
  };

  return (
    <main className="main-content premium-container pt-12 pb-12 fade-in flex flex-col items-center">
      {/* Header Section */}
      <section className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-heading font-black text-sd-blue mb-2">
          PENALTY SHOOTOUT
          <div className="h-1 w-24 bg-sd-red mx-auto mt-2 rounded-full" />
        </h1>
        <p className="text-base md:text-lg text-sd-black/70 mt-3 mb-8 font-medium">
          Tap the goal to shoot. <span className="text-sd-red font-bold">Score once to unlock your voucher.</span>
        </p>

        {/* Stats */}
        <div className="flex justify-center space-x-6 mb-6">
          <div className="premium-card px-6 py-4 text-center">
            <div className="text-3xl font-heading font-black text-sd-blue" data-testid="text-attempts">
              {attempts}
            </div>
            <div className="text-sm text-sd-black/60 font-bold uppercase tracking-wide">Attempts</div>
          </div>
          <div className="premium-card px-6 py-4 text-center">
            <div className="text-3xl font-heading font-black text-sd-red" data-testid="text-goals">
              {goals}
            </div>
            <div className="text-sm text-sd-black/60 font-bold uppercase tracking-wide">Goals</div>
          </div>
        </div>
      </section>

      {/* 3D Game Canvas */}
      <section className="mb-8 w-full flex flex-col items-center">
        <div className="premium-card p-6 relative overflow-hidden bounce-in mx-auto w-full max-w-[680px]">
          {webglError ? (
            <div className="bg-white p-8 rounded-lg border-2 border-sd-light-border text-center" data-testid="webgl-error-fallback">
              <div className="text-6xl mb-6">⚽</div>
              <h3 className="text-2xl font-heading font-black text-sd-blue mb-4">3D GAME UNAVAILABLE</h3>
              <p className="text-sd-black/70 mb-6 font-medium">{webglError}</p>
              <div className="bg-sd-gray p-6 rounded-lg mb-6">
                <p className="text-sm text-sd-black/70 font-medium">Don't worry! You can still win your voucher by registering.</p>
              </div>
              <Button
                onClick={() => { setGoals(1); handleGoalScored(); }}
                data-testid="button-claim-voucher"
                className="premium-button w-full h-14 text-lg"
              >
                CLAIM YOUR VOUCHER
              </Button>
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              width={480}
              height={320}
              data-testid="canvas-game"
              className="block mx-auto bg-green-100 rounded-lg cursor-pointer shadow-sm w-full max-w-full h-auto"
              onClick={handleCanvasClick}
            />
          )}
        </div>

        {/* Controls */}
        <div className="flex justify-center items-center gap-4 mt-6 flex-wrap w-full max-w-[680px]">
          <Button onClick={resetGame} data-testid="button-reset-game" className="premium-button-secondary px-6 py-3">RESET</Button>
          <Button onClick={() => setSoundEnabled(!soundEnabled)} data-testid="button-toggle-sound" className="premium-button-secondary px-6 py-3">
            {soundEnabled ? "🔊" : "🔇"} SOUND
          </Button>
        </div>
      </section>

      {/* Goal Celebration Overlay */}
      {showGoalOverlay && (
        <div className="fixed inset-0 bg-sd-black/90 flex items-center justify-center z-50 fade-in pointer-events-auto">
          <Card className="max-w-sm mx-4 relative overflow-hidden premium-card bounce-in">
            <CardContent className="pt-8 pb-8 text-center">
              <div className="absolute inset-0 pointer-events-none">
                {[...Array(30)].map((_, i) => (
                  <div key={i} className="confetti" style={{ left: `${Math.random() * 100}%`, animationDelay: `${Math.random() * 3}s` }} />
                ))}
              </div>
              <h2 className="text-5xl font-heading font-black text-sd-red mb-6">GOAL!</h2>
              <p className="text-xl font-bold text-sd-black mb-8">You've unlocked your exclusive voucher!</p>
              <Button data-testid="button-view-voucher" className="premium-button w-full h-14 text-lg" onClick={goToWin}>
                VIEW YOUR VOUCHER
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Back to Registration */}
      <div className="text-center pt-6 border-t border-sd-light-border mt-8">
        <Button
          onClick={() => setLocation("/")}
          variant="link"
          data-testid="link-back-to-registration"
          className="text-sd-red hover:text-sd-red/80 font-bold uppercase tracking-wide underline transition-colors"
        >
          ← BACK TO REGISTRATION
        </Button>
      </div>
    </main>
  );
}
