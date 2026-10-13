import { useEffect, useRef, useState } from 'react'
import './App.css'

import Game from './game/Game';

function App() {
  const canvasRef = useRef(null);
  const [state, setState] = useState({ view: 'third', locked: false });

  useEffect(() => {
    const game = new Game(canvasRef.current, { onStateChange: setState });
    // NOTE: Tear down fully so StrictMode / hot reload don't stack game loops.
    return () => game.dispose();
  }, [])

  return (
    <>
      <canvas ref={canvasRef} className="game-canvas" />
      {state.view === 'first' && <div className="crosshair" />}
      <div className="hud">
        <span className="hud-view">
          {state.view === 'first' ? 'First person' : 'Third person'}
        </span>
        <span className="hud-keys">
          <kbd>W A S D</kbd> move · <kbd>Shift</kbd> run · <kbd>Space</kbd> jump ·{' '}
          <kbd>V</kbd> / scroll switch view · <kbd>Esc</kbd> release mouse
        </span>
      </div>
      {!state.locked && (
        <div className="start-hint">Click to look around</div>
      )}
    </>
  )
}

export default App
