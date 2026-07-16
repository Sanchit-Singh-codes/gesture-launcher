import { templates } from './templates.js';
import { Recognizer } from './recognizer.js';

// ==========================================
// Application State & Constants
// ==========================================
const CONFIG = {
  confidenceThreshold: 0.85,    // Match score must be at least 85%
  stopTimeoutMs: 700,           // Reduced from 800ms to 700ms for snappier triggering
  movementThreshold: 0.003,     // Normalized coordinates movement delta (approx 3-5px)
  minPathPoints: 8,             // Minimum points to trigger recognition
  minPathLength: 35,            // Minimum pixel length of the stroke
  smoothingFactor: 0.25,        // Exponential moving average coefficient (0-1) for smooth lines
  handLossTimeoutMs: 350,       // Reduced from 500ms to 350ms for faster trigger on hand pull-away
};

const SITE_MAPPING = {
  'W': { url: 'https://web.whatsapp.com', name: 'WhatsApp' },
  'S': { url: 'https://open.spotify.com', name: 'Spotify' },
  'Y': { url: 'https://youtube.com', name: 'YouTube' },
  'I': { url: 'https://instagram.com', name: 'Instagram' },
  'G': { url: 'https://mail.google.com', name: 'Gmail' }
};

// Application State Variables
let recognizer;
let strokePoints = [];          // Current stroke points: {x, y, time}
let currentPointerPos = null;   // Real-time finger position for cursor dot
let smoothedPointer = null;     // Smoothed finger position to eliminate jitter
let lastMoveTime = 0;           // Last timestamp of significant finger movement
let lastHandSeenTime = 0;       // Last timestamp when hand was in frame
let isListening = false;        // Active detection flag
let isDrawing = false;          // True when user is actively drawing a shape
let isFadingOut = false;        // True when stroke is fading out post-match
let canvasOpacity = 1.0;        // Used to smoothly fade the stroke

// MediaPipe & Video Handlers
let videoElement;
let hands;
let cameraActive = false;

// DOM Elements
const canvas = document.getElementById('drawing-canvas');
const ctx = canvas.getContext('2d');
const startupMessage = document.getElementById('startup-message');
const readyMessage = document.getElementById('ready-message');
const statusContainer = document.getElementById('status-container');
const recognitionFeedback = document.getElementById('recognition-feedback');
const recognizedLetter = document.getElementById('recognized-letter');
const redirectMessage = document.getElementById('redirect-message');
const errorScreen = document.getElementById('error-screen');
const errorMessage = document.getElementById('error-message');

// ==========================================
// Initialization & Startup
// ==========================================
async function init() {
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  
  // 1. Initialize `$1` Recognizer
  try {
    recognizer = new Recognizer(templates);
    console.log('Recognizer initialized with templates:', templates.map(t => t.name));
  } catch (err) {
    console.error('Failed to initialize recognizer:', err);
  }

  // 2. Setup MediaPipe Hands
  try {
    videoElement = document.getElementById('webcam');
    
    if (typeof window.Hands === 'undefined') {
      throw new Error('MediaPipe Hands library not loaded. Check connection.');
    }
    
    // Stable locating of CDN files
    hands = new window.Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.55,
      minTrackingConfidence: 0.55
    });

    hands.onResults(onHandResults);
    console.log('MediaPipe Hands initialized.');
  } catch (err) {
    showError('Initialization Error', err.message);
    return;
  }

  // 3. Start Camera and Processing loop
  await startCamera();
  
  // 4. Start high FPS canvas rendering loop
  requestAnimationFrame(drawLoop);
}

// Custom camera feed loop with standard getUserMedia (using generic constraints for 100% device compatibility)
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true, // Use basic camera constraints to avoid OverconstrainedError on low-end webcams
      audio: false
    });
    
    videoElement.srcObject = stream;
    await videoElement.play();
    cameraActive = true;
    
    processVideoFrame();
    showCameraReady();
  } catch (err) {
    console.error('Camera access failed:', err);
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      showError('Camera Permission Required', 'Please grant webcam access to draw in the air.');
    } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      showError('Camera Not Found', 'No camera detected. Please plug in a webcam.');
    } else {
      showError('Camera Error', err.message || 'Could not access the webcam.');
    }
  }
}

// Continuous frame loop sending images to MediaPipe WASM
async function processVideoFrame() {
  if (!cameraActive) return;
  
  try {
    if (videoElement.readyState >= 2) {
      await hands.send({ image: videoElement });
    }
  } catch (err) {
    console.error('Error during MediaPipe frame processing:', err);
  }
  
  requestAnimationFrame(processVideoFrame);
}

// ==========================================
// Status Overlay Utilities
// ==========================================
function showCameraReady() {
  startupMessage.classList.add('hidden');
  readyMessage.classList.remove('hidden');
  
  setTimeout(() => {
    statusContainer.classList.add('hidden');
    isListening = true;
  }, 2200);
}

function showError(title, messageText) {
  statusContainer.classList.add('hidden');
  recognitionFeedback.classList.add('hidden');
  errorScreen.classList.remove('hidden');
  
  errorMessage.textContent = title;
  const subText = errorScreen.querySelector('.error-subtext');
  if (subText) subText.textContent = messageText;
}

// ==========================================
// MediaPipe Hand Detection Callback
// ==========================================
function onHandResults(results) {
  if (!isListening) {
    currentPointerPos = null;
    smoothedPointer = null;
    return;
  }

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    const landmarks = results.multiHandLandmarks[0];
    lastHandSeenTime = Date.now();
    
    // Check if video dimensions are fully loaded to prevent NaN coordinates
    const videoW = videoElement.videoWidth;
    const videoH = videoElement.videoHeight;
    if (!videoW || !videoH) return;
    
    // Landmark 8 is the INDEX_FINGER_TIP. Track it directly (no pose filters).
    const indexTip = landmarks[8];
    
    // Aspect-ratio aware coordinate mapping (resolves stretching/warping)
    const scale = Math.max(window.innerWidth / videoW, window.innerHeight / videoH);
    const xOffset = (window.innerWidth - videoW * scale) / 2;
    const yOffset = (window.innerHeight - videoH * scale) / 2;
    
    const videoX = indexTip.x * videoW;
    const videoY = indexTip.y * videoH;
    
    // Translate to screen coordinates, mirroring the X-axis for a natural writing experience
    const screenX = xOffset + (videoW - videoX) * scale;
    const screenY = yOffset + videoY * scale;
    
    const time = Date.now();
    
    // CRITICAL FIX: Safe initialization check to prevent null pointer crashes when hand returns
    if (!isDrawing || strokePoints.length === 0 || !smoothedPointer) {
      smoothedPointer = { x: screenX, y: screenY };
    } else {
      smoothedPointer.x = smoothedPointer.x + (screenX - smoothedPointer.x) * CONFIG.smoothingFactor;
      smoothedPointer.y = smoothedPointer.y + (screenY - smoothedPointer.y) * CONFIG.smoothingFactor;
    }
    
    const currentPoint = { x: smoothedPointer.x, y: smoothedPointer.y, time };
    currentPointerPos = currentPoint;

    if (strokePoints.length === 0) {
      strokePoints.push(currentPoint);
      lastMoveTime = time;
      isDrawing = true;
    } else {
      const lastPoint = strokePoints[strokePoints.length - 1];
      const dist = getDistance(currentPoint, lastPoint);
      const normDist = dist / Math.max(window.innerWidth, window.innerHeight);
      
      strokePoints.push(currentPoint);
      
      if (normDist > CONFIG.movementThreshold) {
        lastMoveTime = time;
      } else {
        // Check stationary timeout
        if (isDrawing && (time - lastMoveTime >= CONFIG.stopTimeoutMs)) {
          finalizeGesture();
        }
      }
    }
  } else {
    // No hand in frame
    currentPointerPos = null;
    smoothedPointer = null;
    
    // Hand loss fallback: finalize drawing if hand is missing for more than handLossTimeoutMs
    if (isDrawing && (Date.now() - lastHandSeenTime >= CONFIG.handLossTimeoutMs)) {
      if (strokePoints.length >= CONFIG.minPathPoints) {
        finalizeGesture();
      } else {
        resetLauncher();
      }
    }
  }
}

// ==========================================
// Gesture Finalization & Recognition
// ==========================================
function finalizeGesture() {
  isListening = false;
  isDrawing = false;
  currentPointerPos = null;
  smoothedPointer = null;
  
  const totalLength = getStrokeLength(strokePoints);
  
  if (strokePoints.length < CONFIG.minPathPoints || totalLength < CONFIG.minPathLength) {
    resetLauncher();
    return;
  }

  const result = recognizer.recognize(strokePoints);
  console.log(`Recognition Result: ${result.name} (Score: ${(result.score * 100).toFixed(1)}%)`);

  if (result.name !== "No Match" && result.score >= CONFIG.confidenceThreshold) {
    handleMatchSuccess(result.name);
  } else {
    resetLauncher();
  }
}

function handleMatchSuccess(letter) {
  const mapping = SITE_MAPPING[letter];
  if (!mapping) {
    resetLauncher();
    return;
  }

  recognizedLetter.textContent = letter;
  redirectMessage.textContent = `Opening ${mapping.name}...`;
  recognitionFeedback.classList.remove('hidden');

  setTimeout(() => {
    try {
      window.open(mapping.url, '_blank');
    } catch (e) {
      console.error('Popup blocked or redirection failed:', e);
    }
    
    isFadingOut = true;
    recognitionFeedback.classList.add('hidden');
  }, 500);
}

function resetLauncher() {
  strokePoints = [];
  currentPointerPos = null;
  smoothedPointer = null;
  isDrawing = false;
  isListening = true;
}

// ==========================================
// Canvas Rendering Loop (60 FPS requestAnimationFrame)
// ==========================================
function drawLoop() {
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  if (strokePoints.length > 0) {
    if (isFadingOut) {
      canvasOpacity -= 0.08;
      if (canvasOpacity <= 0) {
        canvasOpacity = 1.0;
        isFadingOut = false;
        strokePoints = [];
        isListening = true;
      }
    }
    
    ctx.globalAlpha = canvasOpacity;

    // Draw bold neon glowing lines (thicker and brighter bloom profiles)
    
    // Layer 1: Wide Soft Bloom
    ctx.beginPath();
    ctx.lineWidth = 26;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowBlur = 55;
    ctx.shadowColor = '#ffffff';
    drawSmoothPath(strokePoints);
    ctx.stroke();

    // Layer 2: Medium Glow Core
    ctx.beginPath();
    ctx.lineWidth = 14;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.48)';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowBlur = 28;
    ctx.shadowColor = '#ffffff';
    drawSmoothPath(strokePoints);
    ctx.stroke();

    // Layer 3: Central Laser Trail
    ctx.beginPath();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#ffffff';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#ffffff';
    drawSmoothPath(strokePoints);
    ctx.stroke();
    
    ctx.globalAlpha = 1.0;
    ctx.shadowBlur = 0;
  }

  // Draw smooth real-time tracking cursor dot
  if (currentPointerPos && isListening) {
    ctx.beginPath();
    ctx.arc(currentPointerPos.x, currentPointerPos.y, 8, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 18;
    ctx.shadowColor = '#ffffff';
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  requestAnimationFrame(drawLoop);
}

function drawSmoothPath(points) {
  if (points.length === 0) return;
  
  ctx.moveTo(points[0].x, points[0].y);
  if (points.length === 1) {
    ctx.lineTo(points[0].x, points[0].y);
    return;
  }
  
  for (let i = 1; i < points.length - 1; i++) {
    const xc = (points[i].x + points[i + 1].x) / 2;
    const yc = (points[i].y + points[i + 1].y) / 2;
    ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
  }
  
  ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
}

// ==========================================
// Math Utilities
// ==========================================
function getDistance(p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Aspect ratio scaling invariant path length
function getStrokeLength(points) {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += getDistance(points[i - 1], points[i]);
  }
  return len;
}

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  
  ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform matrix to prevent scale accumulation
  ctx.scale(dpr, dpr);
  
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
}

window.addEventListener('DOMContentLoaded', init);
