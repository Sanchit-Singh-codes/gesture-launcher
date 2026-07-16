export class Point {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }
}

export class Recognizer {
  constructor(templates) {
    this.templates = [];
    for (const t of templates) {
      this.templates.push({
        name: t.name,
        points: this.preprocess(t.points.map(p => new Point(p.x, p.y)))
      });
    }
  }

  preprocess(points) {
    const resampled = this.resample(points, 64);
    const radians = this.indicativeAngle(resampled);
    const rotated = this.rotateBy(resampled, -radians);
    const scaled = this.scaleTo(rotated, 250);
    const translated = this.translateTo(scaled, new Point(0, 0));
    return translated;
  }

  resample(points, n) {
    const I = this.pathLength(points) / (n - 1);
    let d = 0.0;
    const newPoints = [new Point(points[0].x, points[0].y)];
    let i = 1;
    // Copy the points array to avoid mutating input template lists
    const pts = points.map(p => new Point(p.x, p.y));
    
    while (i < pts.length) {
      const p1 = pts[i - 1];
      const p2 = pts[i];
      const dist = this.distance(p1, p2);
      if ((d + dist) >= I) {
        const t = (I - d) / dist;
        const q = new Point(
          p1.x + t * (p2.x - p1.x),
          p1.y + t * (p2.y - p1.y)
        );
        newPoints.push(q);
        pts.splice(i, 0, q); // insert q in the list of points to visit
        d = 0.0;
      } else {
        d += dist;
      }
      i++;
    }
    
    // Safety checkpoints to guarantee exact array size of n
    while (newPoints.length < n) {
      newPoints.push(new Point(pts[pts.length - 1].x, pts[pts.length - 1].y));
    }
    if (newPoints.length > n) {
      newPoints.length = n;
    }
    return newPoints;
  }

  indicativeAngle(points) {
    const c = this.centroid(points);
    return Math.atan2(c.y - points[0].y, c.x - points[0].x);
  }

  rotateBy(points, radians) {
    const c = this.centroid(points);
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const newPoints = [];
    for (let i = 0; i < points.length; i++) {
      const dx = points[i].x - c.x;
      const dy = points[i].y - c.y;
      const qx = dx * cos - dy * sin + c.x;
      const qy = dx * sin + dy * cos + c.y;
      newPoints.push(new Point(qx, qy));
    }
    return newPoints;
  }

  scaleTo(points, size) {
    const box = this.boundingBox(points);
    const newPoints = [];
    const AR_THRESHOLD = 0.2;
    const ratio = Math.min(box.width / box.height, box.height / box.width);
    
    let scaleX, scaleY;
    if (ratio < AR_THRESHOLD) {
      const maxDim = Math.max(box.width, box.height);
      scaleX = size / maxDim;
      scaleY = size / maxDim;
    } else {
      scaleX = size / box.width;
      scaleY = size / box.height;
    }

    for (let i = 0; i < points.length; i++) {
      const qx = points[i].x * scaleX;
      const qy = points[i].y * scaleY;
      newPoints.push(new Point(qx, qy));
    }
    return newPoints;
  }

  translateTo(points, origin) {
    const c = this.centroid(points);
    const newPoints = [];
    for (let i = 0; i < points.length; i++) {
      const qx = points[i].x + (origin.x - c.x);
      const qy = points[i].y + (origin.y - c.y);
      newPoints.push(new Point(qx, qy));
    }
    return newPoints;
  }

  distanceAtBestAngle(points, template, a, b, threshold) {
    const phi = 0.5 * (-1.0 + Math.sqrt(5.0)); // Golden ratio constant
    let x1 = phi * a + (1.0 - phi) * b;
    let x2 = (1.0 - phi) * a + phi * b;
    let f1 = this.distanceAtAngle(points, template, x1);
    let f2 = this.distanceAtAngle(points, template, x2);

    while (Math.abs(b - a) > threshold) {
      if (f1 < f2) {
        b = x2;
        x2 = x1;
        f2 = f1;
        x1 = phi * a + (1.0 - phi) * b;
        f1 = this.distanceAtAngle(points, template, x1);
      } else {
        a = x1;
        x1 = x2;
        f1 = f2;
        x2 = (1.0 - phi) * a + phi * b;
        f2 = this.distanceAtAngle(points, template, x2);
      }
    }
    return Math.min(f1, f2);
  }

  distanceAtAngle(points, template, radians) {
    const rotatedPoints = this.rotateBy(points, radians);
    return this.pathDistance(rotatedPoints, template.points);
  }

  pathDistance(pts1, pts2) {
    let d = 0.0;
    for (let i = 0; i < pts1.length; i++) {
      d += this.distance(pts1[i], pts2[i]);
    }
    return d / pts1.length;
  }

  pathLength(points) {
    let d = 0.0;
    for (let i = 1; i < points.length; i++) {
      d += this.distance(points[i - 1], points[i]);
    }
    return d;
  }

  distance(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  centroid(points) {
    let x = 0.0, y = 0.0;
    for (let i = 0; i < points.length; i++) {
      x += points[i].x;
      y += points[i].y;
    }
    return new Point(x / points.length, y / points.length);
  }

  boundingBox(points) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < points.length; i++) {
      minX = Math.min(minX, points[i].x);
      maxX = Math.max(maxX, points[i].x);
      minY = Math.min(minY, points[i].y);
      maxY = Math.max(maxY, points[i].y);
    }
    return {
      x: minX,
      y: minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY)
    };
  }

  recognize(rawPoints) {
    if (rawPoints.length < 5) {
      return { name: "No Match", score: 0.0 };
    }
    const points = this.preprocess(rawPoints.map(p => new Point(p.x, p.y)));
    
    let bestDistance = Infinity;
    let bestTemplate = null;
    
    const size = 250;
    const halfDiag = 0.5 * Math.sqrt(size * size + size * size);
    const theta = 45 * Math.PI / 180;
    const dTheta = 2 * Math.PI / 180;

    for (const template of this.templates) {
      const d = this.distanceAtBestAngle(points, template, -theta, theta, dTheta);
      if (d < bestDistance) {
        bestDistance = d;
        bestTemplate = template;
      }
    }

    if (bestTemplate === null) {
      return { name: "No Match", score: 0.0 };
    }

    const score = Math.max(0, 1.0 - bestDistance / halfDiag);
    return { name: bestTemplate.name, score: score };
  }
}
