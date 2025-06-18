"use client";

import { BrowserFingerprint, generateFingerprintHash } from "./session";

// Generate a canvas fingerprint
function generateCanvasFingerprint(): string {
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return "no-canvas";

    canvas.width = 200;
    canvas.height = 50;

    // unique fingerprint
    ctx.textBaseline = "top";
    ctx.font = "14px Arial";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("Browser fingerprint", 2, 15);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.fillText("Browser fingerprint", 4, 17);

    // some geometric shapes
    ctx.beginPath();
    ctx.arc(50, 25, 20, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.fill();

    return canvas.toDataURL();
  } catch {
    return "canvas-error";
  }
}

//WebGL fingerprint
function generateWebGLFingerprint(): string {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") as WebGLRenderingContext | null;
    if (!gl) return "no-webgl";

    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    if (!debugInfo) return "no-debug-info";

    const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);

    return `${vendor}~${renderer}`;
  } catch {
    return "webgl-error";
  }
}

// audio context fingerprint
function generateAudioFingerprint(): string {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const audioContext = new AudioContextClass();
    const oscillator = audioContext.createOscillator();
    const analyser = audioContext.createAnalyser();
    const gainNode = audioContext.createGain();
    const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(10000, audioContext.currentTime);

    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    oscillator.connect(analyser);
    analyser.connect(scriptProcessor);
    scriptProcessor.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start(0);

    const frequencyData = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(frequencyData);

    oscillator.stop();
    audioContext.close();

    // hash from the frequency data
    return Array.from(frequencyData.slice(0, 50))
      .map((x) => x.toString(16))
      .join("");
  } catch {
    return "audio-error";
  }
}

//  comprehensive browser fingerprint
export async function getBrowserFingerprint(): Promise<BrowserFingerprint> {
  const fingerprint: BrowserFingerprint = {
    userAgent: navigator.userAgent,
    language: navigator.language,
    languages: Array.from(navigator.languages || [navigator.language]),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    screen: {
      width: screen.width,
      height: screen.height,
      colorDepth: screen.colorDepth,
      pixelRatio: window.devicePixelRatio || 1,
    },
    platform: navigator.platform,
    cookieEnabled: navigator.cookieEnabled,
    doNotTrack: navigator.doNotTrack || "unspecified",
    hardwareConcurrency: navigator.hardwareConcurrency || 0,
    maxTouchPoints: navigator.maxTouchPoints || 0,
    webgl: generateWebGLFingerprint(),
    canvas: generateCanvasFingerprint(),
    audio: generateAudioFingerprint(),
  };

  return fingerprint;
}

// Get fingerprint hash for session identification
export async function getFingerprintHash(): Promise<string> {
  const fingerprint = await getBrowserFingerprint();
  return generateFingerprintHash(fingerprint);
}

// Track mouse movement entropy for behavioral analysis
export class MouseTracker {
  private movements: { x: number; y: number; timestamp: number }[] = [];
  private entropy: number = 0;

  constructor() {
    this.bindEvents();
  }

  private bindEvents(): void {
    if (typeof window === "undefined") return;

    document.addEventListener("mousemove", this.handleMouseMove.bind(this), {
      passive: true,
    });
  }

  private handleMouseMove(event: MouseEvent): void {
    const movement = {
      x: event.clientX,
      y: event.clientY,
      timestamp: Date.now(),
    };

    this.movements.push(movement);

    // Keep only last 100 movements
    if (this.movements.length > 100) {
      this.movements.shift();
    }

    this.calculateEntropy();
  }

  private calculateEntropy(): void {
    if (this.movements.length < 2) return;

    const distances = this.movements.slice(1).map((movement, i) => {
      const prev = this.movements[i];
      return Math.sqrt(
        Math.pow(movement.x - prev.x, 2) + Math.pow(movement.y - prev.y, 2),
      );
    });

    const avgDistance =
      distances.reduce((sum, d) => sum + d, 0) / distances.length;
    const variance =
      distances.reduce((sum, d) => sum + Math.pow(d - avgDistance, 2), 0) /
      distances.length;

    // Normalize entropy to 0-1 scale
    this.entropy = Math.min(1, variance / 1000);
  }

  public getEntropy(): number {
    return this.entropy;
  }

  public reset(): void {
    this.movements = [];
    this.entropy = 0;
  }
}

// Track typing patterns for behavioral analysis
export class TypingTracker {
  private keyIntervals: number[] = [];
  private lastKeyTime: number = 0;

  constructor() {
    this.bindEvents();
  }

  private bindEvents(): void {
    if (typeof window === "undefined") return;

    document.addEventListener("keydown", this.handleKeyDown.bind(this), {
      passive: true,
    });
  }

  private handleKeyDown(): void {
    const now = Date.now();

    if (this.lastKeyTime > 0) {
      const interval = now - this.lastKeyTime;
      this.keyIntervals.push(interval);

      // Keep only last 50 intervals
      if (this.keyIntervals.length > 50) {
        this.keyIntervals.shift();
      }
    }

    this.lastKeyTime = now;
  }

  public getAverageInterval(): number {
    if (this.keyIntervals.length === 0) return 0;
    return (
      this.keyIntervals.reduce((sum, interval) => sum + interval, 0) /
      this.keyIntervals.length
    );
  }

  public getIntervals(): number[] {
    return [...this.keyIntervals];
  }

  public reset(): void {
    this.keyIntervals = [];
    this.lastKeyTime = 0;
  }
}

// Comprehensive behavioral tracking
export class BehaviorTracker {
  private mouseTracker: MouseTracker;
  private typingTracker: TypingTracker;
  private pageLoadTime: number;
  private interactions: number = 0;

  constructor() {
    this.mouseTracker = new MouseTracker();
    this.typingTracker = new TypingTracker();
    this.pageLoadTime = Date.now();
    this.bindEvents();
  }

  private bindEvents(): void {
    if (typeof window === "undefined") return;

    // Track user interactions
    ["click", "scroll", "keypress", "touchstart"].forEach((event) => {
      document.addEventListener(
        event,
        () => {
          this.interactions++;
        },
        { passive: true },
      );
    });
  }

  public getBehaviorData() {
    return {
      mouseEntropy: this.mouseTracker.getEntropy(),
      averageTypingInterval: this.typingTracker.getAverageInterval(),
      timeOnPage: Date.now() - this.pageLoadTime,
      interactions: this.interactions,
      typingIntervals: this.typingTracker.getIntervals(),
    };
  }

  public reset(): void {
    this.mouseTracker.reset();
    this.typingTracker.reset();
    this.pageLoadTime = Date.now();
    this.interactions = 0;
  }
}

// Singleton instance for global use
let behaviorTracker: BehaviorTracker | null = null;

export function getBehaviorTracker(): BehaviorTracker {
  if (!behaviorTracker) {
    behaviorTracker = new BehaviorTracker();
  }
  return behaviorTracker;
}
