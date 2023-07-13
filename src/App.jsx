import { useEffect, useState } from 'react'
import './App.css'

import * as THREE from 'three';

import SceneInit from './lib/SceneInit';

function App() {
  useEffect(() => {
    const test = new SceneInit('threeJsCanvas');
    test.initialize();
    test.animate();

    const boxGeometry = new THREE.BoxGeometry(15, 15, 15);
    const boxMaterial = new THREE.MeshNormalMaterial();
    const boxMesh = new THREE.Mesh(boxGeometry, boxMaterial);

    test.scene.add(boxMesh);
  }, [])
  return (
    <>
  <div>
    <canvas id="threeJsCanvas" ></canvas>
  </div>
    </>
  )
}

export default App
