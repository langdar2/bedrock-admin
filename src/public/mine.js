// ponytail: Easter egg mini-game. Triggered by 5x click on header title.
const COLS = 20, ROWS = 14, CELL = 28;
const BLOCKS = {
  air:     { color: null, hp: 0, drop: null },
  grass:   { color: '#4a7c3f', hp: 1, drop: 'dirt', top: '#5d9e4e' },
  dirt:    { color: '#8b6914', hp: 1, drop: 'dirt' },
  stone:   { color: '#7a7a7a', hp: 3, drop: 'stone' },
  coal:    { color: '#3a3a3a', hp: 4, drop: 'coal', dots: '#222' },
  iron:    { color: '#7a7a7a', hp: 5, drop: 'iron', dots: '#c4a26e' },
  diamond: { color: '#7a7a7a', hp: 6, drop: 'diamond', dots: '#4af5e2' },
  bedrock: { color: '#2a2a2a', hp: Infinity, drop: null, dots: '#1a1a1a' },
};
const INV_COLORS = { dirt: '#8b6914', stone: '#7a7a7a', coal: '#3a3a3a', iron: '#c4a26e', diamond: '#4af5e2' };

export function launchGame() {
  if (document.getElementById('mine-overlay')) return;

  // Build overlay
  const overlay = document.createElement('div');
  overlay.id = 'mine-overlay';
  Object.assign(overlay.style, {
    position: 'fixed', inset: 0, zIndex: 9999,
    background: 'rgba(0,0,0,0.85)', display: 'flex',
    flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Outfit',sans-serif", color: '#e8e6e3',
  });

  const title = document.createElement('div');
  title.textContent = 'Bedrock Miner';
  Object.assign(title.style, { fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.5rem', color: '#f59e0b' });

  const canvas = document.createElement('canvas');
  canvas.width = COLS * CELL;
  canvas.height = ROWS * CELL;
  Object.assign(canvas.style, { borderRadius: '8px', cursor: 'crosshair', imageRendering: 'pixelated', border: '1px solid rgba(255,255,255,0.1)' });

  const hud = document.createElement('div');
  Object.assign(hud.style, { marginTop: '0.5rem', fontSize: '0.8rem', color: '#9ca3af', display: 'flex', gap: '1rem', alignItems: 'center' });

  const invEl = document.createElement('span');
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'ESC = Schließen';
  Object.assign(closeBtn.style, { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', color: '#9ca3af', padding: '0.3rem 0.7rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem' });

  hud.append(invEl, closeBtn);
  overlay.append(title, canvas, hud);
  document.body.appendChild(overlay);

  const ctx = canvas.getContext('2d');

  // Generate world
  const grid = [];
  for (let y = 0; y < ROWS; y++) {
    grid[y] = [];
    for (let x = 0; x < COLS; x++) {
      if (y === 0) grid[y][x] = 'air';
      else if (y === 1) grid[y][x] = 'grass';
      else if (y < 4) grid[y][x] = 'dirt';
      else if (y === ROWS - 1) grid[y][x] = 'bedrock';
      else {
        const r = Math.random();
        if (y > 8 && r < 0.02) grid[y][x] = 'diamond';
        else if (y > 6 && r < 0.06) grid[y][x] = 'iron';
        else if (r < 0.12) grid[y][x] = 'coal';
        else grid[y][x] = 'stone';
      }
    }
  }

  const dmg = Array.from({ length: ROWS }, () => new Float32Array(COLS));
  const inventory = { dirt: 0, stone: 0, coal: 0, iron: 0, diamond: 0 };
  const particles = [];
  let selected = 'dirt'; // block to place

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, CELL * 2);
    sky.addColorStop(0, '#1a1e28');
    sky.addColorStop(1, '#12151c');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, CELL * 2);

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const b = BLOCKS[grid[y][x]];
        if (!b.color) continue;
        const px = x * CELL, py = y * CELL;

        ctx.fillStyle = b.color;
        ctx.fillRect(px, py, CELL, CELL);

        // Top highlight for grass
        if (b.top) {
          ctx.fillStyle = b.top;
          ctx.fillRect(px, py, CELL, 4);
        }

        // Ore dots
        if (b.dots) {
          ctx.fillStyle = b.dots;
          const seed = x * 31 + y * 17;
          for (let i = 0; i < 3; i++) {
            const dx = ((seed * (i + 1) * 7) % 20) + 4;
            const dy = ((seed * (i + 1) * 13) % 20) + 4;
            ctx.fillRect(px + dx, py + dy, 3, 3);
          }
        }

        // Damage cracks
        if (dmg[y][x] > 0 && b.hp < Infinity) {
          const pct = dmg[y][x] / b.hp;
          ctx.strokeStyle = `rgba(0,0,0,${0.2 + pct * 0.5})`;
          ctx.lineWidth = 1;
          const cx = px + CELL / 2, cy = py + CELL / 2;
          for (let i = 0; i < Math.ceil(pct * 4); i++) {
            const a = (i * 1.8 + seed) % 6.28;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(a) * CELL * 0.45, cy + Math.sin(a) * CELL * 0.45);
            ctx.stroke();
          }
        }

        // Grid line
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(px, py, CELL, CELL);
      }
    }

    // Particles
    for (const p of particles) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15;
      p.life -= 0.025;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function spawnParticles(x, y, color) {
    for (let i = 0; i < 8; i++) {
      particles.push({
        x: x * CELL + CELL / 2, y: y * CELL + CELL / 2,
        vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.8) * 3,
        size: 2 + Math.random() * 3, color, life: 1,
      });
    }
  }

  function updateHud() {
    const items = Object.entries(inventory).filter(([, v]) => v > 0).map(([k, v]) =>
      `<span style="display:inline-flex;align-items:center;gap:3px;${k === selected ? 'color:#f59e0b;font-weight:600' : ''}"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${INV_COLORS[k]}"></span>${v}</span>`
    );
    invEl.innerHTML = items.length ? items.join(' &nbsp; ') : 'Klicke zum Abbauen, Rechtsklick zum Platzieren';
  }

  // Mine on click
  canvas.addEventListener('click', e => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / CELL);
    const y = Math.floor((e.clientY - rect.top) / CELL);
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return;
    const block = grid[y][x];
    const b = BLOCKS[block];
    if (!b.color || b.hp === Infinity) return;

    dmg[y][x]++;
    if (dmg[y][x] >= b.hp) {
      spawnParticles(x, y, b.color);
      if (b.drop) inventory[b.drop]++;
      grid[y][x] = 'air';
      dmg[y][x] = 0;
      updateHud();
    }
  });

  // Place on right-click
  canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / CELL);
    const y = Math.floor((e.clientY - rect.top) / CELL);
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return;
    if (grid[y][x] !== 'air') return;
    if (inventory[selected] <= 0) return;
    grid[y][x] = selected;
    inventory[selected]--;
    updateHud();
  });

  // Cycle selected block with scroll
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const keys = Object.keys(inventory).filter(k => inventory[k] > 0);
    if (!keys.length) return;
    const idx = keys.indexOf(selected);
    const dir = e.deltaY > 0 ? 1 : -1;
    selected = keys[(idx + dir + keys.length) % keys.length] || keys[0];
    updateHud();
  });

  // Close
  function close() { overlay.remove(); cancelAnimationFrame(raf); }
  closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
  });

  // Game loop
  let raf;
  function loop() {
    updateParticles();
    draw();
    raf = requestAnimationFrame(loop);
  }
  updateHud();
  loop();
}
