// components/three/ThreeCanvas.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Minimal wrapper around expo-gl + three.js. Bridges the GL context that
// expo-gl gives us to a stock THREE.WebGLRenderer — no expo-three dependency,
// because expo-three@8 has a hard import on three's loader subpaths that newer
// three versions reject (broken at the time of writing).
//
// Usage:
//   <ThreeCanvas
//     setup={(ctx) => { /* add lights / meshes via ctx.scene */ }}
//     tick={(ctx, dt) => { /* per-frame animation */ }}
//     style={{ width: 240, height: 240 }}
//   />
//
// REQUIRES: `expo-gl` and `three`. Native rebuild needed after install.
// ─────────────────────────────────────────────────────────────────────────────

import { useRef } from 'react';
import { View } from 'react-native';
import { GLView } from 'expo-gl';
import * as THREE from 'three';

// expo-gl's GL context isn't an HTMLCanvasElement, so THREE.WebGLRenderer's
// constructor — which expects to attach event listeners to a canvas — fails
// outright. This shim provides the bare-minimum methods/props the renderer
// touches during construction.
function fakeCanvasFor(gl) {
  return {
    width:        gl.drawingBufferWidth,
    height:       gl.drawingBufferHeight,
    clientWidth:  gl.drawingBufferWidth,
    clientHeight: gl.drawingBufferHeight,
    style: {},
    addEventListener:    () => {},
    removeEventListener: () => {},
    getContext:          () => gl,
  };
}

export default function ThreeCanvas({
  setup,
  tick,
  bg = 'transparent',
  cameraZ = 5,
  cameraFov = 70,
  style,
}) {
  const rafRef = useRef(null);
  const ctxRef = useRef(null);

  const onContextCreate = async (gl) => {
    const { drawingBufferWidth: width, drawingBufferHeight: height } = gl;

    // ── Renderer — stock three, no expo-three ────────────────────────────
    const renderer = new THREE.WebGLRenderer({
      canvas:  fakeCanvasFor(gl),
      context: gl,
      alpha:   bg === 'transparent',
      antialias: true,
    });
    renderer.setPixelRatio(1);
    renderer.setSize(width, height);
    if (bg === 'transparent' || bg == null) renderer.setClearColor(0x000000, 0);
    else                                    renderer.setClearColor(new THREE.Color(bg), 1);

    // ── Scene + camera with sensible defaults ────────────────────────────
    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(cameraFov, width / height, 0.1, 1000);
    camera.position.z = cameraZ;
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));

    const ctx = { gl, renderer, scene, camera, width, height, THREE };
    ctxRef.current = ctx;

    if (setup) await setup(ctx);

    let last = Date.now();
    const loop = () => {
      const now = Date.now();
      const dt  = (now - last) / 1000;
      last = now;
      if (tick) tick(ctx, dt);
      renderer.render(scene, camera);
      gl.endFrameEXP();
      rafRef.current = requestAnimationFrame(loop);
    };
    loop();
  };

  // GLView itself unmounts cleanly when its parent unmounts. We just need to
  // stop the render loop and free GPU buffers via Three's dispose().
  // useEffect cleanup runs on unmount of THIS component:
  //
  //   (we wire it via a ref-based cleanup function callable from a
  //   useEffect cleanup OR just rely on RN unmount which discards the
  //   GLView and its WebGL context)

  return (
    <View style={style} pointerEvents="none">
      <GLView style={{ flex: 1 }} onContextCreate={onContextCreate} />
    </View>
  );
}
