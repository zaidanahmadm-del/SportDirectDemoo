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
    goal: THREE.Group;
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

  // Init Three.js
  useEffect(() => {
    if (!canvasRef.current) return;

    try {
      const canvas = canvasRef.current;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });

      renderer.setSize(canvas.width, canvas.height);
      renderer.setClearColor(0x87ceeb); // sky blue

      // Lights
      scene.add(new THREE.AmbientLight(0x404040, 0.6));
      const dir = new THREE.DirectionalLight(0xffffff, 0.8);
      dir.position.set(0, 10, 5);
      scene.add(dir);

      // Ground
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(20, 20),
        new THREE.MeshLambertMaterial({ color: 0x00aa00 })
      );
      ground.rotation.x = -Math.PI / 2;
      scene.add(ground);

      // Goal
      const goal = new THREE.Group();
      const postMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
      const postGeo = new THREE.BoxGeometry(0.1, 2.4, 0.1);
      const leftPost = new THREE.Mesh(postGeo, postMat);
      leftPost.position.set(-3.6, 1.2, -8);
      goal.add(leftPost);
      const rightPost = new THREE.Mesh(postGeo, postMat);
      rightPost.position.set(3.6, 1.2, -8);
      goal.add(rightPost);
      const crossbar = new THREE.Mesh(new THREE.BoxGeometry(7.3, 0.1, 0.1), postMat);
      crossbar.position.set(0, 2.4, -8);
      goal.add(crossbar);
      scene.add(goal);

      // Ball
      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 16, 16),
        new THREE.MeshLambertMaterial({ color: 0xffffff })
      );
      ball.position.set(0, 0.15, 5);
      scene.add(ball);

      // Camera
      camera.position.set(0, 2, 8);
      camera.lookAt(0, 1, -5);

      sceneRef.current = { scene, camera, renderer, ball, goal };

      // Move goal left-right
      startGoalAnimation();

      // Render loop
      const animate = () => {
        if (!sceneRef.current) return;
        sceneRef.current.renderer.render(scene, camera);
        sceneRef.current.animationId = requestAnimationFrame(animate);
      };
      animate();
    } catch (err) {
      console.error("WebGL init failed:", err);
      setWebglError(
        "Your device does not support WebGL, which is required for the 3D game. Please try a different browser or device."
      );
      return;
    }

    return () => {
      if (sceneRef.current?.animationId) cancelAnimationFrame(sceneRef.current.animationId);
      if (sceneRef.current?.renderer) sceneRef.current.renderer.dispose();
    };
  }, []);

  const startGoalAnimation = () => {
    if (!sceneRef.current) return;
    const { goal } = sceneRef.current;
    let direction = 1;
    const speed = 0.02;
    const maxX = 2;

    const tick = () => {
      if (!sceneRef.current) return;
      goal.position.x += direction * speed;
      if (goal.position.x > maxX || goal.position.x < -maxX) direction *= -1;
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
          ball.position.y < 2.4 &&
          ball.position.z <= -7.8;

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
    sceneRef.current.ball.position.set(0, 0.15, 5);
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

    // Show celebration overlay (no instant redirect)
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

        {/* Subtitle (clear + action-oriented) */}
        <p className="text-base md:text-lg text-sd-black/70 mt-3 mb-8 font-medium">
          Tap the goal to shoot. <span className="text-sd-red font-bold">Score once to unlock your voucher.</span>
        </p>

        {/* Game Stats */}
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

        {/* Game Controls */}
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
