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

  // Texture helper with graceful fallback
  const loadTexture = (path: string) =>
    new Promise<THREE.Texture | null>((resolve) => {
      const loader = new THREE.TextureLoader();
      loader.load(path, (tex) => resolve(tex), undefined, () => resolve(null));
    });

  // Init Three.js
  useEffect(() => {
    if (!canvasRef.current) return;
    let disposed = false;

    (async () => {
      try {
        const canvas = canvasRef.current;

        // Renderer / Scene / Camera
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87ceeb); // sky blue

        const camera = new THREE.PerspectiveCamera(60, canvas.width / canvas.height, 0.1, 1000);
        camera.position.set(0, 3.2, 8.5);
        camera.lookAt(0, 1.2, -6);

        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        renderer.setSize(canvas.width, canvas.height);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Lights
        const hemi = new THREE.HemisphereLight(0xffffff, 0x446655, 0.6);
        scene.add(hemi);

        const dir = new THREE.DirectionalLight(0xffffff, 1.0);
        dir.position.set(5, 10, 5);
        dir.castShadow = true;
        dir.shadow.mapSize.set(1024, 1024);
        dir.shadow.camera.near = 1;
        dir.shadow.camera.far = 30;
        dir.shadow.camera.left = -12;
        dir.shadow.camera.right = 12;
        dir.shadow.camera.top = 12;
        dir.shadow.camera.bottom = -12;
        scene.add(dir);

        // Textures (optional)
        const [grassTex, ballTex, netTex] = await Promise.all([
          loadTexture("/textures/grass.jpg"),
          loadTexture("/textures/ball.png"),
          loadTexture("/textures/net.png"),
        ]);

        if (grassTex) {
          grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
          grassTex.repeat.set(20, 20);
          grassTex.anisotropy = 4;
        }
        if (ballTex) {
          ballTex.anisotropy = 4;
        }
        if (netTex) {
          netTex.wrapS = netTex.wrapT = THREE.ClampToEdgeWrapping;
          netTex.anisotropy = 4;
        }

        // Ground (grass)
        const ground = new THREE.Mesh(
          new THREE.PlaneGeometry(40, 40),
          grassTex
            ? new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1, metalness: 0 })
            : new THREE.MeshStandardMaterial({ color: 0x2aa12a, roughness: 1 })
        );
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        scene.add(ground);

        // Goal frame (cylinders) & net
        const goalGroup = new THREE.Group();

        const goalWidth = 7.32;  // ~ real width
        const goalHeight = 2.44; // ~ real height
        const postRadius = 0.06;

        const postMat = new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          roughness: 0.2,
          metalness: 0.0,
          clearcoat: 0.6,
          clearcoatRoughness: 0.2,
        });

        // Left post
        const postGeo = new THREE.CylinderGeometry(postRadius, postRadius, goalHeight, 24);
        const leftPost = new THREE.Mesh(postGeo, postMat);
        leftPost.position.set(-goalWidth / 2, goalHeight / 2, -8);
        leftPost.castShadow = true;
        leftPost.receiveShadow = true;
        goalGroup.add(leftPost);

        // Right post
        const rightPost = new THREE.Mesh(postGeo, postMat);
        rightPost.position.set(goalWidth / 2, goalHeight / 2, -8);
        rightPost.castShadow = true;
        rightPost.receiveShadow = true;
        goalGroup.add(rightPost);

        // Crossbar
        const crossGeo = new THREE.CylinderGeometry(postRadius, postRadius, goalWidth, 24);
        const crossbar = new THREE.Mesh(crossGeo, postMat);
        crossbar.rotation.z = Math.PI / 2;
        crossbar.position.set(0, goalHeight, -8);
        crossbar.castShadow = true;
        crossbar.receiveShadow = true;
        goalGroup.add(crossbar);

        // Back net
        if (netTex) {
          const netMat = new THREE.MeshBasicMaterial({
            map: netTex,
            alphaMap: netTex,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
          });
          const net = new THREE.Mesh(new THREE.PlaneGeometry(goalWidth + 0.2, goalHeight + 0.2), netMat);
          net.position.set(0, goalHeight / 2, -8.1);
          goalGroup.add(net);
        }

        scene.add(goalGroup);

        // Ball (textured)
        const ball = new THREE.Mesh(
          new THREE.SphereGeometry(0.22, 32, 32),
          ballTex
            ? new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.45, metalness: 0 })
            : new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45 })
        );
        ball.position.set(0, 0.22, 5);
        ball.castShadow = true;
        scene.add(ball);

        // Fake soft shadow under ball
        const ballShadow = new THREE.Mesh(
          new THREE.CircleGeometry(0.28, 32),
          new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0.2, transparent: true })
        );
        ballShadow.rotation.x = -Math.PI / 2;
        ballShadow.position.set(0, 0.001, 5);
        ballShadow.renderOrder = 1;
        scene.add(ballShadow);

        // Store refs
        sceneRef.current = { scene, camera, renderer, ball, goalGroup };

        // Start goal animation
        startGoalAnimation();

        // Render loop
        const animate = () => {
          if (!sceneRef.current || disposed) return;
          ballShadow.position.x = sceneRef.current.ball.position.x;
          ballShadow.position.z = sceneRef.current.ball.position.z;
          sceneRef.current.renderer.render(scene, camera);
          sceneRef.current.animationId = requestAnimationFrame(animate);
        };
        animate();
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

  const startGoalAnimation = () => {
    if (!sceneRef.current) return;
    const { goalGroup } = sceneRef.current;
    let dir = 1;
    const speed = 0.02;
    const maxX = 2;

    const tick = () => {
      if (!sceneRef.current) return;
      goalGroup.position.x += dir * speed;
      if (goalGroup.position.x > maxX || goalGroup.position.x < -maxX) dir *= -1;
      requestAnimationFrame(tick);
    };
    tick();
  };

  const shootBall = (clickX: number, clickY: number) => {
    if (!sceneRef.current || gameState !== "ready") return;

    setGameState("shooting");
    setAttempts((p) => p + 1);

    const { ball } = sceneRef.current;
    const canvas = canvasRef.current!;
    const spreadX = (clickX / canvas.width - 0.5) * 0.5 + (Math.random() - 0.5) * 0.2;
    const spreadY = (0.5 - clickY / canvas.height) * 0.3 + Math.random() * 0.2;

    const startPos = ball.position.clone();
    const targetPos = new THREE.Vector3(spreadX * 8, 1 + spreadY * 2, -8);

    const duration = 1000;
    const start = Date.now();

    const step = () => {
      const t = Math.min((Date.now() - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);

      ball.position.lerpVectors(startPos, targetPos, ease);
      ball.position.y = startPos.y + Math.sin(t * Math.PI) * 2;

      if (t >= 1) {
        const inGoal =
          ball.position.x > -3.6 &&
          ball.position.x < 3.6 &&
          ball.position.y > 0 &&
          ball.position.y < 2.44 &&
          ball.position.z <= -7.9;

        if (inGoal) {
          setGoals((p) => p + 1);
          setGameState("goal");
          handleGoalScored();
        } else {
          setGameState("miss");
          setTimeout(() => {
            resetBall();
            setGameState("ready");
          }, 1000);
        }
        return;
      }

      requestAnimationFrame(step);
    };

    step();
  };

  const resetBall = () => {
    if (!sceneRef.current) return;
    sceneRef.current.ball.position.set(0, 0.22, 5);
  };

  const handleGoalScored = () => {
    const userData = getUserData();
    if (!userData) return;

    const voucherCode = generateVoucherCode(userData.email);
    setVoucherData({
      won: true,
      code: voucherCode,
      time: new Date().toISOString(),
    });

    setShowGoalOverlay(true);

    setTimeout(() => {
      resetBall();
      setGameState("ready");
    }, 1500);
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

        {/* Subtitle */}
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
            <div
              className="bg-white p-8 rounded-lg border-2 border-sd-light-border text-center"
              data-testid="webgl-error-fallback"
            >
              <div className="text-6xl mb-6">⚽</div>
              <h3 className="text-2xl font-heading font-black text-sd-blue mb-4">3D GAME UNAVAILABLE</h3>
              <p className="text-sd-black/70 mb-6 font-medium">{webglError}</p>
              <div className="bg-sd-gray p-6 rounded-lg mb-6">
                <p className="text-sm text-sd-black/70 font-medium">
                  Don't worry! You can still win your voucher by registering.
                </p>
              </div>
              <Button
                onClick={() => {
                  setGoals(1);
                  handleGoalScored();
                }}
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
          <Button onClick={resetGame} data-testid="button-reset-game" className="premium-button-secondary px-6 py-3">
            RESET
          </Button>

          <Button
            onClick={() => setSoundEnabled(!soundEnabled)}
            data-testid="button-toggle-sound"
            className="premium-button-secondary px-6 py-3"
          >
            {soundEnabled ? "🔊" : "🔇"} SOUND
          </Button>
        </div>
      </section>

      {/* Goal Celebration Overlay */}
      {showGoalOverlay && (
        <div className="fixed inset-0 bg-sd-black/90 flex items-center justify-center z-50 fade-in pointer-events-auto">
          <Card className="max-w-sm mx-4 relative overflow-hidden premium-card bounce-in">
            <CardContent className="pt-8 pb-8 text-center">
              {/* Confetti */}
              <div className="absolute inset-0 pointer-events-none">
                {[...Array(30)].map((_, i) => (
                  <div
                    key={i}
                    className="confetti"
                    style={{ left: `${Math.random() * 100}%`, animationDelay: `${Math.random() * 3}s` }}
                  />
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
