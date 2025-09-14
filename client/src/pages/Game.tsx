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
  const [gameState, setGameState] = useState<'ready' | 'shooting' | 'goal' | 'miss'>('ready');
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
    goalLine: THREE.Plane;
    animationId?: number;
    goalMoveTween?: any;
  }>();

  // Check if user is registered
  useEffect(() => {
    const userData = getUserData();
    if (!userData) {
      setLocation("/");
      return;
    }
  }, [setLocation]);

  // Initialize Three.js scene
  useEffect(() => {
    if (!canvasRef.current) return;

    try {
      const canvas = canvasRef.current;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      
      renderer.setSize(canvas.width, canvas.height);
      renderer.setClearColor(0x87CEEB); // Sky blue background
      
      // Lighting
      const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
      scene.add(ambientLight);
      
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(0, 10, 5);
      scene.add(directionalLight);
      
      // Ground
      const groundGeometry = new THREE.PlaneGeometry(20, 20);
      const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x00aa00 });
      const ground = new THREE.Mesh(groundGeometry, groundMaterial);
      ground.rotation.x = -Math.PI / 2;
      scene.add(ground);
      
      // Goal posts
      const goalGroup = new THREE.Group();
      const postMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
      
      // Left post
      const postGeometry = new THREE.BoxGeometry(0.1, 2.4, 0.1);
      const leftPost = new THREE.Mesh(postGeometry, postMaterial);
      leftPost.position.set(-3.6, 1.2, -8);
      goalGroup.add(leftPost);
      
      // Right post
      const rightPost = new THREE.Mesh(postGeometry, postMaterial);
      rightPost.position.set(3.6, 1.2, -8);
      goalGroup.add(rightPost);
      
      // Crossbar
      const crossbarGeometry = new THREE.BoxGeometry(7.3, 0.1, 0.1);
      const crossbar = new THREE.Mesh(crossbarGeometry, postMaterial);
      crossbar.position.set(0, 2.4, -8);
      goalGroup.add(crossbar);
      
      scene.add(goalGroup);
      
      // Ball
      const ballGeometry = new THREE.SphereGeometry(0.15, 16, 16);
      const ballMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
      const ball = new THREE.Mesh(ballGeometry, ballMaterial);
      ball.position.set(0, 0.15, 5);
      scene.add(ball);
      
      // Goal line (invisible plane for collision detection)
      const goalLine = new THREE.Plane(new THREE.Vector3(0, 0, 1), 8);
      
      // Camera position
      camera.position.set(0, 2, 8);
      camera.lookAt(0, 1, -5);
      
      // Store scene objects
      sceneRef.current = {
        scene,
        camera,
        renderer,
        ball,
        goal: goalGroup,
        goalLine,
      };
      
      // Start goal movement animation
      startGoalAnimation();
      
      // Render loop
      const animate = () => {
        if (sceneRef.current) {
          sceneRef.current.renderer.render(scene, camera);
          sceneRef.current.animationId = requestAnimationFrame(animate);
        }
      };
      animate();
      
    } catch (error) {
      // Handle WebGL initialization errors
      console.error('WebGL initialization failed:', error);
      setWebglError('Your device does not support WebGL, which is required for the 3D game. Please try using a different browser or device.');
      return;
    }
    
    return () => {
      if (sceneRef.current?.animationId) {
        cancelAnimationFrame(sceneRef.current.animationId);
      }
      if (sceneRef.current?.renderer) {
        sceneRef.current.renderer.dispose();
      }
    };
  }, []);

  const startGoalAnimation = () => {
    if (!sceneRef.current) return;
    
    const { goal } = sceneRef.current;
    let direction = 1;
    const moveSpeed = 0.02;
    const maxX = 2;
    
    const animateGoal = () => {
      if (!sceneRef.current) return;
      
      goal.position.x += direction * moveSpeed;
      
      if (goal.position.x > maxX || goal.position.x < -maxX) {
        direction *= -1;
      }
      
      requestAnimationFrame(animateGoal);
    };
    
    animateGoal();
  };

  const shootBall = (clickX: number, clickY: number) => {
    if (!sceneRef.current || gameState !== 'ready') return;
    
    setGameState('shooting');
    setAttempts(prev => prev + 1);
    
    const { ball, goalLine } = sceneRef.current;
    const canvas = canvasRef.current!;
    
    // Calculate shooting direction with some spread
    const spreadX = (clickX / canvas.width - 0.5) * 0.5 + (Math.random() - 0.5) * 0.2;
    const spreadY = (0.5 - clickY / canvas.height) * 0.3 + Math.random() * 0.2;
    
    // Animate ball movement
    const startPos = ball.position.clone();
    const targetPos = new THREE.Vector3(spreadX * 8, 1 + spreadY * 2, -8);
    
    const animationDuration = 1000; // 1 second
    const startTime = Date.now();
    
    const animateBall = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / animationDuration, 1);
      
      // Easing function for arc
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      ball.position.lerpVectors(startPos, targetPos, easeProgress);
      ball.position.y = startPos.y + Math.sin(progress * Math.PI) * 2; // Arc trajectory
      
      if (progress >= 1) {
        // Check if goal
        const ballInGoal = 
          ball.position.x > -3.6 && ball.position.x < 3.6 && 
          ball.position.y > 0 && ball.position.y < 2.4 && 
          ball.position.z <= -7.8;
        
        if (ballInGoal) {
          setGoals(prev => prev + 1);
          setGameState('goal');
          handleGoalScored();
        } else {
          setGameState('miss');
          setTimeout(() => {
            resetBall();
            setGameState('ready');
          }, 1500);
        }
        return;
      }
      
      requestAnimationFrame(animateBall);
    };
    
    animateBall();
  };

  const resetBall = () => {
    if (!sceneRef.current) return;
    sceneRef.current.ball.position.set(0, 0.15, 5);
  };

  const handleGoalScored = () => {
    const userData = getUserData();
    if (!userData) return;
    
    // Generate voucher
    const voucherCode = generateVoucherCode(userData.email);
    setVoucherData({
      won: true,
      code: voucherCode,
      time: new Date().toISOString(),
    });
    
    // Show celebration
    setShowGoalOverlay(true);
    
    // Reset ball after delay
    setTimeout(() => {
      resetBall();
      setGameState('ready');
    }, 2000);
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    shootBall(x, y);
  };

  const resetGame = () => {
    setAttempts(0);
    setGoals(0);
    setGameState('ready');
    resetBall();
  };

  const goToWin = () => { setShowGoalOverlay(false); setLocation("/win"); };

  return (
    <main className="main-content premium-container py-12 fade-in flex flex-col items-center">
      {/* Header Section */}
      <section className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-heading font-black text-sd-blue mb-2">
          PENALTY SHOOTOUT
          <div className="h-1 w-24 bg-sd-red mx-auto mt-2 rounded-full"></div>
        </h1>
        
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
            // WebGL Error Fallback
            <div className="bg-white p-8 rounded-lg border-2 border-sd-light-border text-center" data-testid="webgl-error-fallback">
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
                  // Simulate goal for fallback users
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
          
          {/* Game Controls Overlay */}
          
          
          
        </div>
        
        {/* Game Controls */}
        <div className="flex justify-center items-center gap-4 mt-6 flex-wrap w-full max-w-[680px]">
          <Button 
            onClick={resetGame}
            data-testid="button-reset-game"
            className="premium-button-secondary px-6 py-3"
          >
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

      {/* Goal Celebration Overlay */}
      {showGoalOverlay && (
        <div className="fixed inset-0 bg-sd-black/90 flex items-center justify-center z-50 fade-in pointer-events-auto">
          <Card className="max-w-sm mx-4 relative overflow-hidden premium-card bounce-in">
            <CardContent className="pt-8 pb-8 text-center">
              {/* Confetti animation */}
              <div className="absolute inset-0 pointer-events-none">
                {[...Array(30)].map((_, i) => (
                  <div
                    key={i}
                    className="confetti"
                    style={{
                      left: `${Math.random() * 100}%`,
                      animationDelay: `${Math.random() * 3}s`,
                    }}
                  />
                ))}
              </div>
              
              <h2 className="text-5xl font-heading font-black text-sd-red mb-6">GOAL!</h2>
              <p className="text-xl font-bold text-sd-black mb-8">You've unlocked your exclusive voucher!</p>
              <Button 
                onClick={goToWin}
                data-testid="button-view-voucher"
                className="premium-button w-full h-14 text-lg"
               onClick={goToWin}>
                VIEW YOUR VOUCHER
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  );
}
