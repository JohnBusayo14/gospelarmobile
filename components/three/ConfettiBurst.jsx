// components/three/ConfettiBurst.jsx
// ─────────────────────────────────────────────────────────────────────────────
// 3D particle celebration — fires ~150 small colored boxes outward from the
// center of the canvas, applies gravity, rotates them, fades them out, then
// destroys them. Used on Subscribe success to make the moment feel earned.
//
// All particles are managed manually (no Points/PointsMaterial) so they
// rotate, scale, and tilt independently — feels closer to physical confetti
// than a flat sprite cloud.
// ─────────────────────────────────────────────────────────────────────────────

import ThreeCanvas from './ThreeCanvas';

const PALETTE = [
  0xD9FF6B,   // lime (brand accent)
  0x10B981,   // green
  0x1A56DB,   // blue
  0xF59E0B,   // amber
  0xEC4899,   // pink
  0x7C3AED,   // purple
  0xFFFFFF,   // white
];

export default function ConfettiBurst({
  count    = 150,
  duration = 4,         // seconds before particles fully fade
  size     = 320,       // canvas dimensions
  style,
}) {
  const setup = (ctx) => {
    const { THREE, scene } = ctx;
    const group = new THREE.Group();
    scene.add(group);
    ctx.group = group;
    ctx.particles = [];

    // Spawn particles in a ring around the origin with random outward
    // velocity, random spin axis, random color from the palette.
    for (let i = 0; i < count; i++) {
      const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
      const geom  = new THREE.BoxGeometry(0.08, 0.16, 0.02);
      const mat   = new THREE.MeshStandardMaterial({
        color,
        transparent: true,
        opacity: 1,
        roughness: 0.4,
        metalness: 0.1,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geom, mat);

      // Random outward velocity (mostly horizontal, with an initial upward kick)
      const angle  = Math.random() * Math.PI * 2;
      const speed  = 1.2 + Math.random() * 2.0;
      mesh.userData = {
        vx: Math.cos(angle) * speed,
        vy: 1.5 + Math.random() * 2.0,        // launch upward
        vz: Math.sin(angle) * speed * 0.5,
        rx: (Math.random() - 0.5) * 6,
        ry: (Math.random() - 0.5) * 6,
        rz: (Math.random() - 0.5) * 6,
        life: 0,
      };
      group.add(mesh);
      ctx.particles.push(mesh);
    }

    // Soft side light so colors stay vivid against the transparent canvas.
    const key = new THREE.DirectionalLight(0xffffff, 1.0);
    key.position.set(0, 4, 5);
    scene.add(key);
  };

  const GRAVITY = 4.5;     // units / sec²

  const tick = (ctx, dt) => {
    if (!ctx.particles) return;
    for (const p of ctx.particles) {
      const u = p.userData;
      u.life += dt;

      // Newtonian motion + gravity
      u.vy -= GRAVITY * dt;
      p.position.x += u.vx * dt;
      p.position.y += u.vy * dt;
      p.position.z += u.vz * dt;

      // Spin
      p.rotation.x += u.rx * dt;
      p.rotation.y += u.ry * dt;
      p.rotation.z += u.rz * dt;

      // Fade out over the second half of the duration
      const fadeStart = duration * 0.5;
      if (u.life > fadeStart) {
        const fadeT = Math.min(1, (u.life - fadeStart) / (duration - fadeStart));
        p.material.opacity = 1 - fadeT;
      }
    }
  };

  return (
    <ThreeCanvas
      setup={setup}
      tick={tick}
      cameraZ={6}
      cameraFov={50}
      style={[{ width: size, height: size }, style]}
    />
  );
}
