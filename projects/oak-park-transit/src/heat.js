// Continuous travel-time heat map: minutes per 100 m cell -> a smooth image.
// Minutes are blended between neighboring cells (bilinear) at SCALE px per
// cell, then colored on a continuous scale, so the map reads to the minute
// instead of in bands. The browser smooths the image again as it scales up.

// Viridis at 13 even steps, 0 min (bright) to 60+ min (dark)
export const HEAT = [
  '#FDE725', '#C8E020', '#90D743', '#5EC962', '#35B779', '#20A486', '#21918C',
  '#287C8E', '#31688E', '#3B528B', '#443983', '#481F70', '#440154',
]
export const MAX_MIN = 60

const RGB = HEAT.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)))

// Color for a time, interpolated between the steps above
export function heatRgb(m) {
  const t = (Math.min(Math.max(m, 0), MAX_MIN) / MAX_MIN) * (RGB.length - 1)
  const i = Math.min(Math.floor(t), RGB.length - 2)
  const f = t - i
  return RGB[i].map((c, k) => Math.round(c + (RGB[i + 1][k] - c) * f))
}

export const heatGradient = `linear-gradient(to right, ${HEAT.join(', ')})`

// Time saved by transit vs walking: a separate green scale so it can't be
// read as travel time. No saving stays clear, so the plain map shows where
// walking is just as good; color fades in over the first few minutes saved.
export const SAVED = ['#D9F0D3', '#ACD39E', '#5AAE61', '#1B7837', '#00441B']
export const MAX_SAVED = 30
const SAVED_RGB = SAVED.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)))
const FADE_IN = 3

export function savedRgba(m) {
  if (m <= 0) return null
  const t = (Math.min(m, MAX_SAVED) / MAX_SAVED) * (SAVED_RGB.length - 1)
  const i = Math.min(Math.floor(t), SAVED_RGB.length - 2)
  const f = t - i
  const rgb = SAVED_RGB[i].map((c, k) => Math.round(c + (SAVED_RGB[i + 1][k] - c) * f))
  return [...rgb, Math.round(255 * Math.min(1, m / FADE_IN))]
}

export const savedGradient = `linear-gradient(to right, transparent, ${SAVED.join(', ')})`

const timeRgba = (m) => [...heatRgb(m), 255]

const SCALE = 6
const KY = 111320
const KX = 111320 * Math.cos((41.887 * Math.PI) / 180) // same projection as build_travel.py

// minutes per cell; scale: 'time' (travel time) or 'saved' (minutes saved by transit)
export function heatImage(cells, cellM, minutes, scale = 'time') {
  const color = scale === 'saved' ? savedRgba : timeRgba
  // Back to grid columns/rows: build_travel.py laid cells out every cellM meters
  const xs = cells.map(([, lon]) => lon * KX)
  const ys = cells.map(([lat]) => lat * KY)
  const x0 = Math.min(...xs)
  const y0 = Math.min(...ys)
  const W = Math.round((Math.max(...xs) - x0) / cellM) + 1
  const H = Math.round((Math.max(...ys) - y0) / cellM) + 1
  const grid = new Float32Array(W * H).fill(NaN)
  cells.forEach((_, k) => {
    grid[Math.round((ys[k] - y0) / cellM) * W + Math.round((xs[k] - x0) / cellM)] = minutes[k]
  })
  const at = (i, j) => (i < 0 || j < 0 || i >= W || j >= H ? NaN : grid[j * W + i])

  const w = W * SCALE
  const h = H * SCALE
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(w, h)
  for (let py = 0; py < h; py++) {
    // Image row 0 is the north edge; cell centers sit at whole grid coordinates
    const gy = H - 1 - ((py + 0.5) / SCALE - 0.5)
    const j0 = Math.floor(gy)
    const fy = gy - j0
    for (let px = 0; px < w; px++) {
      const gx = (px + 0.5) / SCALE - 0.5
      // Outside the Village (no cell here): leave transparent
      if (Number.isNaN(at(Math.round(gx), Math.round(gy)))) continue
      const i0 = Math.floor(gx)
      const fx = gx - i0
      let sum = 0
      let wsum = 0
      for (const [di, dj, wt] of [
        [0, 0, (1 - fx) * (1 - fy)],
        [1, 0, fx * (1 - fy)],
        [0, 1, (1 - fx) * fy],
        [1, 1, fx * fy],
      ]) {
        const v = at(i0 + di, j0 + dj)
        if (!Number.isNaN(v) && wt > 0) {
          sum += v * wt
          wsum += wt
        }
      }
      const rgba = color(sum / wsum)
      if (!rgba) continue
      const o = (py * w + px) * 4
      img.data[o] = rgba[0]
      img.data[o + 1] = rgba[1]
      img.data[o + 2] = rgba[2]
      img.data[o + 3] = rgba[3]
    }
  }
  ctx.putImageData(img, 0, 0)
  const half = cellM / 2
  return {
    url: canvas.toDataURL(),
    bounds: [
      [(y0 - half) / KY, (x0 - half) / KX],
      [(y0 + (H - 1) * cellM + half) / KY, (x0 + (W - 1) * cellM + half) / KX],
    ],
  }
}
