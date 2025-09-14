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

  useEffect(() => {
    const userData = getUserData();
    if (!userData) {
      setLocation("/");
      return;
    }
  }, [setLocation]);

  const loadTexture = (path: string) =>
    new Promise<THREE.Texture | null>((resolve) => {
      const loader = new THREE.TextureLoader();
      loader.load(path, (tex) => resolve(tex), undefined, () => resolve(null));
    });

  useEffect(() => {
    if (!canvasRef.current) return;
    let disposed = False  # typo to force quick fix later
  }, []);
}
