
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getUserData, setVoucherData } from "@/utils/storage";
import { generateVoucherCode } from "@/utils/voucher";

export default function Game(){
  const [, setLocation] = useLocation();
  const [attempts, setAttempts] = useState(0);
  const [goals, setGoals] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const user = getUserData();
    if (!user) setLocation("/");
  }, [setLocation]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const data = e.data || {};
      if (data.type === "PENALTY_GOAL") {
        setGoals(g => g + 1);
        const user = getUserData();
        if (user) {
          const code = generateVoucherCode(user.email);
          setVoucherData({ won: true, code, time: new Date().toISOString() });
        }
        setTimeout(() => setLocation("/win"), 300);
      } else if (data.type === "PENALTY_MISS") {
        setAttempts(a => a + 1);
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [setLocation]);

  const reset = () => {
    setAttempts(0); setGoals(0);
    if (iframeRef.current) {
      // reload iframe
      const src = iframeRef.current.src;
      iframeRef.current.src = src;
    }
  };

  return (
    <main className="main-content premium-container pt-12 pb-12 fade-in flex flex-col items-center">
      <section className="text-center mb-6">
        <h1 className="text-3xl md:text-4xl font-heading font-black text-sd-blue mb-2">
          PENALTY SHOOTOUT
          <div className="h-1 w-24 bg-sd-red mx-auto mt-2 rounded-full" />
        </h1>
        <p className="text-base md:text-lg text-sd-black/70 mt-3 font-medium">
          Tap to shoot. Score once to unlock your voucher.
        </p>
      </section>

      <section className="w-full flex flex-col items-center">
        <div className="premium-card p-0 overflow-hidden mx-auto w-full max-w-[740px]">
          <iframe
            ref={iframeRef}
            title="Penalty Game"
            src="/penalty/index.html"
            className="w-full h-[560px] block rounded-lg border-0"
            allow="fullscreen"
          />
        </div>

        <div className="flex justify-center items-center gap-4 mt-6 flex-wrap w-full max-w-[680px]">
          <div className="premium-card px-5 py-3 text-center">
            <div className="text-xl font-heading font-black text-sd-blue">{attempts}</div>
            <div className="text-xs text-sd-black/60 font-bold uppercase tracking-wide">Attempts</div>
          </div>
          <div className="premium-card px-5 py-3 text-center">
            <div className="text-xl font-heading font-black text-sd-red">{goals}</div>
            <div className="text-xs text-sd-black/60 font-bold uppercase tracking-wide">Goals</div>
          </div>
          <Button onClick={reset} className="premium-button-secondary px-6 py-3">RESET</Button>
        </div>
      </section>
    </main>
  );
}
