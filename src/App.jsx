import { useEffect, useRef } from 'react'
import './App.css'

import * as THREE from 'three';

import SceneInit from './lib/SceneInit';

function App() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const engine = new SceneInit(canvasRef.current);
    engine.initialize();

    // NOTE: Placeholder ground so there's something to see; replace with the game.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      new THREE.MeshLambertMaterial({ color: 0x7f9a52 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    engine.scene.add(ground);
    const grid = new THREE.GridHelper(100, 50, 0x000000, 0x000000);
    grid.material.transparent = true;
    grid.material.opacity = 0.15;
    grid.position.y = 0.01;
    engine.scene.add(grid);

    engine.animate();
    // NOTE: Tear down fully so StrictMode / hot reload don't stack render loops.
    return () => engine.dispose();
  }, [])

  return <canvas ref={canvasRef} className="game-canvas" />
}

export default App
