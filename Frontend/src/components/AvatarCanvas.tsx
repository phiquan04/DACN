// src/components/AvatarCanvas.tsx
// SVG/Canvas anime-style avatar with lip-sync and idle animations

import React, { useEffect, useRef, useCallback } from "react";

interface AvatarCanvasProps {
  mouthOpen: number;      // 0.0 = closed, 1.0 = fully open
  isSpeaking: boolean;
  isThinking: boolean;
}

interface AvatarState {
  blinkTimer: number;
  blinkDuration: number;
  nextBlink: number;
  eyeOpenL: number;
  eyeOpenR: number;
  headBobY: number;
  headBobPhase: number;
  breathPhase: number;
  tailPhase: number;
  blushAlpha: number;
}

const AvatarCanvas: React.FC<AvatarCanvasProps> = ({
  mouthOpen,
  isSpeaking,
  isThinking,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<AvatarState>({
    blinkTimer: 0,
    blinkDuration: 8,
    nextBlink: 180,
    eyeOpenL: 1,
    eyeOpenR: 1,
    headBobY: 0,
    headBobPhase: 0,
    breathPhase: 0,
    tailPhase: 0,
    blushAlpha: 0,
  });
  const animRef = useRef<number>(0);
  const frameRef = useRef<number>(0);
  const mouthRef = useRef<number>(0);

  // Smooth mouth interpolation
  useEffect(() => {
    mouthRef.current = mouthOpen;
  }, [mouthOpen]);

  const drawAvatar = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      const s = stateRef.current;
      const cx = w / 2;
      const baseY = h * 0.52;
      const bob = s.headBobY;
      const breathScale = 1 + Math.sin(s.breathPhase) * 0.004;

      ctx.clearRect(0, 0, w, h);

      // ── Background: soft gradient ──────────────────────────────────
      const bg = ctx.createRadialGradient(cx, h * 0.4, 20, cx, h * 0.4, h * 0.7);
      bg.addColorStop(0, "#1a1040");
      bg.addColorStop(1, "#0a0820");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Stars
      ctx.save();
      for (let i = 0; i < 40; i++) {
        const sx = ((i * 137.5) % w);
        const sy = ((i * 97.3) % (h * 0.6));
        const pulse = 0.4 + 0.3 * Math.sin(s.breathPhase * 2 + i);
        ctx.globalAlpha = pulse;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(sx, sy, 1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // ── Cat ears ──────────────────────────────────────────────────
      const earW = 28, earH = 34;
      ctx.save();
      ctx.translate(cx, baseY + bob);
      ctx.scale(breathScale, breathScale);

      // Left ear
      ctx.fillStyle = "#e8b4d0";
      ctx.beginPath();
      ctx.moveTo(-55, -85);
      ctx.lineTo(-85, -120);
      ctx.lineTo(-28, -82);
      ctx.closePath();
      ctx.fill();
      // Left ear inner
      ctx.fillStyle = "#f5c8dc";
      ctx.beginPath();
      ctx.moveTo(-56, -87);
      ctx.lineTo(-76, -112);
      ctx.lineTo(-33, -85);
      ctx.closePath();
      ctx.fill();

      // Right ear
      ctx.fillStyle = "#e8b4d0";
      ctx.beginPath();
      ctx.moveTo(55, -85);
      ctx.lineTo(85, -120);
      ctx.lineTo(28, -82);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#f5c8dc";
      ctx.beginPath();
      ctx.moveTo(56, -87);
      ctx.lineTo(76, -112);
      ctx.lineTo(33, -85);
      ctx.closePath();
      ctx.fill();

      // ── Hair: long flowing purple ─────────────────────────────────
      const hairGrad = ctx.createLinearGradient(0, -100, 0, 80);
      hairGrad.addColorStop(0, "#7c3aed");
      hairGrad.addColorStop(0.5, "#a855f7");
      hairGrad.addColorStop(1, "#c084fc");

      // Back hair
      ctx.fillStyle = hairGrad;
      ctx.beginPath();
      ctx.ellipse(0, -60, 78, 88, 0, 0, Math.PI * 2);
      ctx.fill();

      // Side hair strands
      ctx.fillStyle = "#9333ea";
      ctx.beginPath();
      ctx.moveTo(-70, -50);
      ctx.bezierCurveTo(-90, 0, -85, 50, -70, 90);
      ctx.bezierCurveTo(-65, 95, -55, 60, -65, 10);
      ctx.bezierCurveTo(-55, -20, -60, -40, -65, -55);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(70, -50);
      ctx.bezierCurveTo(90, 0, 85, 50, 70, 90);
      ctx.bezierCurveTo(65, 95, 55, 60, 65, 10);
      ctx.bezierCurveTo(55, -20, 60, -40, 65, -55);
      ctx.closePath();
      ctx.fill();

      // ── Face ──────────────────────────────────────────────────────
      const faceGrad = ctx.createRadialGradient(5, -45, 10, 0, -40, 72);
      faceGrad.addColorStop(0, "#fde8d8");
      faceGrad.addColorStop(1, "#f5c9b0");
      ctx.fillStyle = faceGrad;
      ctx.beginPath();
      ctx.ellipse(0, -42, 62, 70, 0, 0, Math.PI * 2);
      ctx.fill();

      // Face outline
      ctx.strokeStyle = "#e8a88a";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // ── Blush ─────────────────────────────────────────────────────
      const blushTarget = (isSpeaking || s.blushAlpha > 0) ? 0.35 : 0;
      s.blushAlpha += (blushTarget - s.blushAlpha) * 0.05;
      if (s.blushAlpha > 0.01) {
        ctx.globalAlpha = s.blushAlpha;
        ctx.fillStyle = "#ff8fab";
        ctx.beginPath();
        ctx.ellipse(-36, -22, 14, 8, -0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(36, -22, 14, 8, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // ── Eyes ──────────────────────────────────────────────────────
      const drawEye = (ex: number, eyeOpen: number) => {
        const eyeH = 14 * eyeOpen;
        if (eyeH < 0.5) return; // fully blinked

        // Eye white
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.ellipse(ex, -52, 13, eyeH, 0, 0, Math.PI * 2);
        ctx.fill();

        // Iris gradient
        const irisGrad = ctx.createRadialGradient(ex - 2, -54, 1, ex, -52, 9);
        irisGrad.addColorStop(0, "#6ee7f7");
        irisGrad.addColorStop(0.6, "#2563eb");
        irisGrad.addColorStop(1, "#1e1b4b");
        ctx.fillStyle = irisGrad;
        ctx.beginPath();
        ctx.ellipse(ex, -52, 9, Math.min(9, eyeH * 0.85), 0, 0, Math.PI * 2);
        ctx.fill();

        // Pupil
        ctx.fillStyle = "#000814";
        ctx.beginPath();
        ctx.ellipse(ex, -52, 5, Math.min(5, eyeH * 0.5), 0, 0, Math.PI * 2);
        ctx.fill();

        // Shine
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.beginPath();
        ctx.ellipse(ex + 3, -55, 2.5, 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(ex - 2, -49, 1.2, 1, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eyelash
        ctx.strokeStyle = "#2d1b69";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(ex, -52 - eyeH + 0.5, 13, 2, 0, Math.PI, 0);
        ctx.stroke();
      };

      drawEye(-30, s.eyeOpenL);
      drawEye(30, s.eyeOpenR);

      // Eyebrows
      ctx.strokeStyle = "#6d28d9";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";

      // Left brow
      ctx.beginPath();
      ctx.moveTo(-45, -71);
      ctx.quadraticCurveTo(-30, isThinking ? -78 : -74, -16, -71);
      ctx.stroke();

      // Right brow
      ctx.beginPath();
      ctx.moveTo(16, -71);
      ctx.quadraticCurveTo(30, isThinking ? -78 : -74, 45, -71);
      ctx.stroke();

      // ── Nose ──────────────────────────────────────────────────────
      ctx.strokeStyle = "#d4956a";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-5, -35);
      ctx.quadraticCurveTo(0, -30, 5, -35);
      ctx.stroke();

      // ── Mouth ─────────────────────────────────────────────────────
      const mouth = mouthRef.current;
      const mouthY = -18;
      const mouthW = 20;

      if (mouth < 0.05) {
        // Smile / closed mouth
        ctx.strokeStyle = "#c0746a";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-mouthW, mouthY);
        ctx.quadraticCurveTo(0, mouthY + 8, mouthW, mouthY);
        ctx.stroke();
      } else {
        // Open mouth
        const openH = mouth * 18;
        ctx.fillStyle = "#7c1d35";
        ctx.beginPath();
        ctx.ellipse(0, mouthY + openH / 2, mouthW, openH / 2 + 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // Teeth
        ctx.fillStyle = "#fff8f8";
        ctx.beginPath();
        ctx.ellipse(0, mouthY + 2, mouthW - 4, 5, 0, 0, Math.PI);
        ctx.fill();

        // Tongue hint at wide open
        if (mouth > 0.5) {
          ctx.fillStyle = "#e87461";
          ctx.beginPath();
          ctx.ellipse(0, mouthY + openH - 2, 8, 5, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        // Mouth outline
        ctx.strokeStyle = "#c0746a";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(0, mouthY + openH / 2, mouthW, openH / 2 + 2, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // ── Neck & Shoulders ──────────────────────────────────────────
      ctx.fillStyle = "#f5c9b0";
      ctx.beginPath();
      ctx.rect(-18, 20, 36, 40);
      ctx.fill();

      // Seifuku collar (sailor uniform)
      const collarGrad = ctx.createLinearGradient(0, 40, 0, 120);
      collarGrad.addColorStop(0, "#3b82f6");
      collarGrad.addColorStop(1, "#1d4ed8");
      ctx.fillStyle = collarGrad;
      ctx.beginPath();
      ctx.moveTo(-80, 55);
      ctx.lineTo(0, 75);
      ctx.lineTo(80, 55);
      ctx.lineTo(80, 120);
      ctx.lineTo(-80, 120);
      ctx.closePath();
      ctx.fill();

      // Collar white stripe
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-75, 57);
      ctx.lineTo(0, 77);
      ctx.lineTo(75, 57);
      ctx.stroke();

      // Red bow
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.moveTo(0, 80);
      ctx.lineTo(-18, 68);
      ctx.lineTo(-10, 78);
      ctx.lineTo(0, 72);
      ctx.lineTo(10, 78);
      ctx.lineTo(18, 68);
      ctx.closePath();
      ctx.fill();

      // Thinking dots
      if (isThinking) {
        const dotPhase = (frameRef.current % 60) / 60;
        for (let i = 0; i < 3; i++) {
          const dotY = -90 - 10 * Math.sin((dotPhase + i * 0.33) * Math.PI * 2);
          const dotAlpha = 0.4 + 0.6 * Math.sin((dotPhase + i * 0.33) * Math.PI * 2);
          ctx.globalAlpha = dotAlpha;
          ctx.fillStyle = "#c084fc";
          ctx.beginPath();
          ctx.arc(40 + i * 14, dotY, 4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      ctx.restore();

      // ── Cat tail ──────────────────────────────────────────────────
      const tailX = cx + 60 + Math.sin(s.tailPhase) * 20;
      const tailY = h * 0.85 + Math.cos(s.tailPhase * 0.7) * 10;
      const tailGrad = ctx.createLinearGradient(tailX - 20, tailY - 40, tailX + 20, tailY);
      tailGrad.addColorStop(0, "#7c3aed");
      tailGrad.addColorStop(1, "#f5f3ff");
      ctx.strokeStyle = tailGrad;
      ctx.lineWidth = 10;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx + 30, h * 0.82);
      ctx.bezierCurveTo(
        cx + 50, h * 0.75,
        tailX + Math.sin(s.tailPhase * 1.3) * 15, tailY - 30,
        tailX, tailY
      );
      ctx.stroke();
    },
    [isSpeaking, isThinking]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const s = stateRef.current;

    const loop = () => {
      frameRef.current++;
      const f = frameRef.current;

      // Blink logic
      s.blinkTimer++;
      if (s.blinkTimer >= s.nextBlink) {
        s.blinkTimer = 0;
        s.nextBlink = 150 + Math.random() * 200;
        s.blinkDuration = 0;
      }
      if (s.blinkTimer < 8) {
        const t = s.blinkTimer / 4;
        const bv = t <= 1 ? 1 - t : t - 1;
        s.eyeOpenL = Math.max(0, bv);
        s.eyeOpenR = Math.max(0, bv + (Math.random() * 0.1 - 0.05));
      } else {
        s.eyeOpenL += (1 - s.eyeOpenL) * 0.3;
        s.eyeOpenR += (1 - s.eyeOpenR) * 0.3;
      }

      // Head bob
      s.headBobPhase += isSpeaking ? 0.08 : 0.02;
      s.headBobY = Math.sin(s.headBobPhase) * (isSpeaking ? 3 : 1.5);

      // Breathing
      s.breathPhase += 0.02;

      // Tail wag
      s.tailPhase += isSpeaking ? 0.06 : 0.03;

      drawAvatar(ctx, canvas.width, canvas.height);
      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [drawAvatar, isSpeaking]);

  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={380}
      className="avatar-canvas"
      style={{ imageRendering: "pixelated" }}
    />
  );
};

export default AvatarCanvas;