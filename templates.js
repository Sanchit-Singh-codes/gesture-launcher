/**
 * Predefined templates for the $1 Unistroke Recognizer.
 * We define multiple styles for each letter to make the recognition
 * extremely robust, forgiving, and accurate.
 */

function interpolatePoints(keyPoints, pointsPerSegment = 20) {
  const points = [];
  for (let i = 0; i < keyPoints.length - 1; i++) {
    const p1 = keyPoints[i];
    const p2 = keyPoints[i + 1];
    for (let j = 0; j < pointsPerSegment; j++) {
      const t = j / pointsPerSegment;
      points.push({
        x: p1.x + (p2.x - p1.x) * t,
        y: p1.y + (p2.y - p1.y) * t
      });
    }
  }
  const last = keyPoints[keyPoints.length - 1];
  points.push({ x: last.x, y: last.y });
  return points;
}

// ==========================================
// 1. W Templates
// ==========================================
const w_style1 = [
  { x: 50, y: 50 },
  { x: 90, y: 200 },
  { x: 125, y: 100 },
  { x: 160, y: 200 },
  { x: 200, y: 50 }
];

const w_style2 = [
  { x: 50, y: 60 },
  { x: 80, y: 190 },
  { x: 110, y: 140 },
  { x: 125, y: 120 },
  { x: 140, y: 140 },
  { x: 170, y: 190 },
  { x: 200, y: 60 }
];

const w_style3 = [
  { x: 40, y: 80 },
  { x: 75, y: 210 },
  { x: 110, y: 110 },
  { x: 150, y: 210 },
  { x: 190, y: 80 }
];

// ==========================================
// 2. S Templates
// ==========================================
const s_style1 = [
  { x: 180, y: 50 },
  { x: 125, y: 40 },
  { x: 70, y: 70 },
  { x: 80, y: 110 },
  { x: 140, y: 130 },
  { x: 180, y: 150 },
  { x: 175, y: 185 },
  { x: 120, y: 210 },
  { x: 70, y: 195 }
];

const s_style2 = [
  { x: 170, y: 60 },
  { x: 120, y: 50 },
  { x: 80, y: 75 },
  { x: 110, y: 115 },
  { x: 150, y: 135 },
  { x: 170, y: 175 },
  { x: 130, y: 200 },
  { x: 80, y: 190 }
];

// ==========================================
// 3. Y Templates
// ==========================================
// Y Style 1: Start top-left, go to center, go up to top-right, backtrack to center, go straight down to bottom
const y_style1 = [
  { x: 50, y: 50 },
  { x: 125, y: 125 },
  { x: 200, y: 50 },
  { x: 125, y: 125 },
  { x: 125, y: 220 }
];

// Y Style 2: Start top-left, go to center, go to top-right, then draw stem down
const y_style2 = [
  { x: 50, y: 50 },
  { x: 125, y: 125 },
  { x: 200, y: 50 },
  { x: 125, y: 220 }
];

// Y Style 3: Curved U-shape then stem
const y_style3 = [
  { x: 50, y: 50 },
  { x: 75, y: 130 },
  { x: 125, y: 130 },
  { x: 175, y: 130 },
  { x: 200, y: 50 },
  { x: 160, y: 135 },
  { x: 125, y: 220 }
];

// ==========================================
// 4. I Templates
// ==========================================
const i_style1 = [
  { x: 125, y: 30 },
  { x: 125, y: 220 }
];

const i_style2 = [
  { x: 125, y: 220 },
  { x: 125, y: 30 }
];

const i_style3 = [
  { x: 110, y: 35 },
  { x: 140, y: 215 }
];

// ==========================================
// 5. G Templates (Replacing T)
// ==========================================
// G Style 1: Classic circular G starting top-right, curve left, bottom-right, then middle-right horizontal inner bar
const g_style1 = [
  { x: 180, y: 60 },
  { x: 125, y: 45 },
  { x: 70, y: 80 },
  { x: 60, y: 125 },
  { x: 70, y: 170 },
  { x: 125, y: 205 },
  { x: 180, y: 170 },
  { x: 180, y: 130 },
  { x: 130, y: 130 }
];

// G Style 2: Curved oval G shape
const g_style2 = [
  { x: 170, y: 70 },
  { x: 125, y: 55 },
  { x: 80, y: 85 },
  { x: 70, y: 125 },
  { x: 80, y: 165 },
  { x: 125, y: 195 },
  { x: 170, y: 165 },
  { x: 170, y: 135 },
  { x: 140, y: 135 }
];

// G Style 3: G with a sharp downward tail tick
const g_style3 = [
  { x: 170, y: 60 },
  { x: 120, y: 50 },
  { x: 70, y: 80 },
  { x: 70, y: 170 },
  { x: 120, y: 200 },
  { x: 170, y: 160 },
  { x: 170, y: 120 },
  { x: 130, y: 120 },
  { x: 130, y: 155 }
];


export const templates = [
  { name: 'W', points: interpolatePoints(w_style1) },
  { name: 'W', points: interpolatePoints(w_style2) },
  { name: 'W', points: interpolatePoints(w_style3) },
  
  { name: 'S', points: interpolatePoints(s_style1) },
  { name: 'S', points: interpolatePoints(s_style2) },
  
  { name: 'Y', points: interpolatePoints(y_style1) },
  { name: 'Y', points: interpolatePoints(y_style2) },
  { name: 'Y', points: interpolatePoints(y_style3) },
  
  { name: 'I', points: interpolatePoints(i_style1) },
  { name: 'I', points: interpolatePoints(i_style2) },
  { name: 'I', points: interpolatePoints(i_style3) },
  
  { name: 'G', points: interpolatePoints(g_style1) },
  { name: 'G', points: interpolatePoints(g_style2) },
  { name: 'G', points: interpolatePoints(g_style3) }
];
