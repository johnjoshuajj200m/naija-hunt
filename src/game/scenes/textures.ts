import * as THREE from "three";

/** Seeded generator so every load produces the same surfaces. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasContext(width: number, height: number): CanvasRenderingContext2D {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not create a 2D canvas for a scene texture.");
  }
  return context;
}

function finish(context: CanvasRenderingContext2D, repeat: [number, number] = [1, 1]): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(context.canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);
  texture.anisotropy = 4;
  return texture;
}

/** Grayscale mottling with rain streaks. Mesh colour tints it, so one map serves every wall. */
export function createPlasterTexture(): THREE.CanvasTexture {
  const size = 256;
  const random = createRandom(7);
  const context = canvasContext(size, size);
  context.fillStyle = "#cbc5bb";
  context.fillRect(0, 0, size, size);
  for (let i = 0; i < 2200; i += 1) {
    const shade = 90 + Math.floor(random() * 140);
    context.fillStyle = `rgba(${shade}, ${shade}, ${shade}, 0.13)`;
    context.fillRect(random() * size, random() * size, 3, 2);
  }
  for (let i = 0; i < 26; i += 1) {
    const x = random() * size;
    const gradient = context.createLinearGradient(0, 0, 0, size);
    gradient.addColorStop(0, "rgba(70, 58, 45, 0.0)");
    gradient.addColorStop(0.35, "rgba(70, 58, 45, 0.16)");
    gradient.addColorStop(1, "rgba(70, 58, 45, 0.0)");
    context.fillStyle = gradient;
    context.fillRect(x, 0, 1 + random() * 2.5, size);
  }
  context.strokeStyle = "rgba(60, 50, 40, 0.14)";
  for (let i = 0; i < 14; i += 1) {
    context.beginPath();
    context.moveTo(random() * size, random() * size);
    context.lineTo(random() * size, random() * size);
    context.stroke();
  }
  return finish(context, [1, 1]);
}

export function createAsphaltTexture(repeat: [number, number]): THREE.CanvasTexture {
  const size = 256;
  const random = createRandom(11);
  const context = canvasContext(size, size);
  context.fillStyle = "#615e59";
  context.fillRect(0, 0, size, size);
  for (let i = 0; i < 3000; i += 1) {
    const shade = 40 + Math.floor(random() * 100);
    context.fillStyle = `rgba(${shade}, ${shade}, ${shade}, 0.35)`;
    context.fillRect(random() * size, random() * size, 2, 2);
  }
  // Darker tyre-wear lanes along the direction of travel.
  context.fillStyle = "rgba(20, 20, 20, 0.16)";
  context.fillRect(size * 0.2, 0, size * 0.14, size);
  context.fillRect(size * 0.66, 0, size * 0.14, size);
  context.strokeStyle = "rgba(25, 23, 21, 0.4)";
  for (let i = 0; i < 6; i += 1) {
    const startX = random() * size;
    const startY = random() * size;
    context.beginPath();
    context.moveTo(startX, startY);
    context.lineTo(startX + (random() - 0.5) * 12, startY + 30 + random() * 40);
    context.stroke();
  }
  return finish(context, repeat);
}

export function createPaverTexture(): THREE.CanvasTexture {
  const size = 256;
  const random = createRandom(23);
  const context = canvasContext(size, size);
  context.fillStyle = "#b9ae9a";
  context.fillRect(0, 0, size, size);
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const shade = 150 + Math.floor(random() * 50);
      context.fillStyle = `rgb(${shade + 20}, ${shade + 8}, ${shade - 12})`;
      context.fillRect(col * 64 + 2, row * 64 + 2, 60, 60);
    }
  }
  for (let i = 0; i < 700; i += 1) {
    context.fillStyle = "rgba(60, 50, 40, 0.1)";
    context.fillRect(random() * size, random() * size, 2, 2);
  }
  return finish(context, [1, 1]);
}

/** One 4 x 4 block of glass panes. Tiles per tower so floors and bays read at distance. */
export function createGlassFacadeTexture(): THREE.CanvasTexture {
  const size = 512;
  const cell = 128;
  const random = createRandom(31);
  const context = canvasContext(size, size);
  context.fillStyle = "#18231f";
  context.fillRect(0, 0, size, size);
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const x = col * cell;
      const y = row * cell;
      context.fillStyle = "#2c3834";
      context.fillRect(x, y + cell - 24, cell, 24);
      for (let pane = 0; pane < 2; pane += 1) {
        const paneX = x + 3 + pane * (cell / 2);
        const paneW = cell / 2 - 6;
        const paneH = cell - 24 - 6;
        const lit = random() < 0.1;
        const gradient = context.createLinearGradient(0, y + 3, 0, y + 3 + paneH);
        if (lit) {
          gradient.addColorStop(0, "#d9bb78");
          gradient.addColorStop(1, "#a2824a");
        } else {
          const tint = random() * 18;
          gradient.addColorStop(0, `rgb(${158 + tint}, ${176 + tint}, ${166 + tint})`);
          gradient.addColorStop(0.55, "#4d6a62");
          gradient.addColorStop(1, "#1f352f");
        }
        context.fillStyle = gradient;
        context.fillRect(paneX, y + 3, paneW, paneH);
      }
    }
  }
  return finish(context, [1, 1]);
}

export function createSignTexture(
  label: string,
  background: string,
  foreground: string,
  accent = "#b88f35",
): THREE.CanvasTexture {
  const context = canvasContext(512, 128);
  context.fillStyle = background;
  context.fillRect(0, 0, 512, 128);
  context.fillStyle = accent;
  context.fillRect(0, 112, 512, 16);
  context.fillRect(0, 0, 512, 6);
  context.fillStyle = foreground;
  context.textAlign = "center";
  context.textBaseline = "middle";
  let fontSize = 58;
  context.font = `700 ${fontSize}px sans-serif`;
  while (context.measureText(label).width > 460 && fontSize > 20) {
    fontSize -= 2;
    context.font = `700 ${fontSize}px sans-serif`;
  }
  context.fillText(label, 256, 58);
  const texture = new THREE.CanvasTexture(context.canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Tarpaulin bands. Drawn as horizontal bands so they run down the slope of a stall roof. */
export function createStripeTexture(colorA: string, colorB: string): THREE.CanvasTexture {
  const context = canvasContext(64, 256);
  for (let stripe = 0; stripe < 8; stripe += 1) {
    context.fillStyle = stripe % 2 === 0 ? colorA : colorB;
    context.fillRect(0, stripe * 32, 64, 32);
  }
  return finish(context, [1, 1]);
}

const DANFO_LENGTH = 4.6;
const DANFO_HEIGHT = 2.3;
const DANFO_PIXELS_PER_METER = 1024 / DANFO_LENGTH;

/**
 * Side panel of a danfo-style minibus. Canvas x spans the 4.6 m body length, canvas y spans
 * 2.3 m of height. The area outside the body outline is transparent. `mirrored` is for the
 * far side so the nose stays on the correct end.
 */
export function createDanfoSideTexture(mirrored: boolean): THREE.CanvasTexture {
  const width = 1024;
  const height = Math.round(DANFO_HEIGHT * DANFO_PIXELS_PER_METER);
  const context = canvasContext(width, height);
  const px = (x: number) => (mirrored ? (DANFO_LENGTH - x) : x) * DANFO_PIXELS_PER_METER;
  const py = (y: number) => (DANFO_HEIGHT - y) * DANFO_PIXELS_PER_METER;
  const rect = (x0: number, x1: number, y0: number, y1: number) => {
    const left = Math.min(px(x0), px(x1));
    context.fillRect(left, py(y1), Math.abs(px(x1) - px(x0)), py(y0) - py(y1));
  };

  context.clearRect(0, 0, width, height);
  context.save();
  const outline: Array<[number, number]> = [
    [0, 0.35],
    [0, 1.85],
    [0.2, 2.1],
    [3.4, 2.1],
    [4.25, 1.55],
    [4.6, 1.45],
    [4.6, 0.45],
    [4.35, 0.35],
  ];
  context.beginPath();
  outline.forEach((point, index) => {
    if (index === 0) {
      context.moveTo(px(point[0]), py(point[1]));
    } else {
      context.lineTo(px(point[0]), py(point[1]));
    }
  });
  context.closePath();
  context.clip();

  // Base paint with grime toward the sills.
  const paint = context.createLinearGradient(0, py(2.1), 0, py(0.35));
  paint.addColorStop(0, "#e0ad2f");
  paint.addColorStop(0.7, "#d6a229");
  paint.addColorStop(1, "#a97d22");
  context.fillStyle = paint;
  context.fillRect(0, 0, width, height);

  // Black waist stripe with the slogan.
  context.fillStyle = "#171717";
  rect(0, 4.6, 0.96, 1.2);
  context.fillStyle = "#d9b04a";
  context.font = "700 30px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("NO CONDITION IS PERMANENT", px(2.2), (py(0.96) + py(1.2)) / 2);

  // Window band.
  const windows: Array<[number, number]> = [
    [0.28, 1.0],
    [1.1, 1.9],
    [2.0, 2.8],
    [2.9, 3.75],
  ];
  for (const [x0, x1] of windows) {
    const pane = context.createLinearGradient(0, py(2.0), 0, py(1.32));
    pane.addColorStop(0, "#7d9188");
    pane.addColorStop(1, "#1f2e2a");
    context.fillStyle = pane;
    rect(x0, x1, 1.32, 2.0);
  }
  context.fillStyle = "#1f2e2a";
  rect(3.85, 4.3, 1.28, 1.62);

  // Sliding door seam and handle.
  context.strokeStyle = "rgba(30, 24, 10, 0.55)";
  context.lineWidth = 3;
  context.strokeRect(Math.min(px(1.05), px(2.25)), py(1.95), Math.abs(px(2.25) - px(1.05)), py(0.45) - py(1.95));
  context.fillStyle = "#2a2a2a";
  rect(2.05, 2.17, 1.05, 1.14);

  // Wheel arches.
  context.fillStyle = "#101010";
  for (const wheelX of [0.95, 3.6]) {
    context.beginPath();
    context.arc(px(wheelX), py(0.36), 0.47 * DANFO_PIXELS_PER_METER, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();

  const texture = new THREE.CanvasTexture(context.canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Side of a two-car elevated transit train: cream body, dark windows, green skirt, gold band. */
export function createTrainSideTexture(): THREE.CanvasTexture {
  const width = 1024;
  const height = 300;
  const context = canvasContext(width, height);
  context.fillStyle = "#e4ddcc";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#1d3226";
  context.fillRect(0, height * 0.76, width, height * 0.24);
  context.fillStyle = "#b88f35";
  context.fillRect(0, height * 0.7, width, height * 0.06);
  const unit = width / 7.9;
  for (let i = 0; i < 6; i += 1) {
    const x = unit * (0.45 + i * 1.18);
    const pane = context.createLinearGradient(0, height * 0.2, 0, height * 0.55);
    pane.addColorStop(0, "#8ba197");
    pane.addColorStop(1, "#22362f");
    context.fillStyle = pane;
    context.fillRect(x, height * 0.2, unit * 0.9, height * 0.36);
  }
  return finish(context, [1, 1]);
}
