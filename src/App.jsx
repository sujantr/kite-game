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

  const { kite, pecha } = state;

  return (
    <>
      <canvas ref={canvasRef} className="game-canvas" />
      {state.view === 'first' && <div className="crosshair" />}

      <div className="kite-panel">
        <div className="kite-score">Kites cut: {state.score ?? 0}</div>
        <div>Wind {state.wind ?? 0} m/s</div>
        {kite && kite.state === 'flying' && (
          <div>String {kite.line} m · Height {kite.height} m</div>
        )}
      </div>

      {pecha && (
        <div className="pecha">
          <div className="pecha-title">Pecha! Keep pulling or letting out to cut them</div>
          <div className="pecha-row">
            <span>You</span>
            <div className="pecha-bar"><div className="pecha-fill you" style={{ width: `${pecha.you * 100}%` }} /></div>
          </div>
          <div className="pecha-row">
            <span>Them</span>
            <div className="pecha-bar"><div className="pecha-fill them" style={{ width: `${pecha.them * 100}%` }} /></div>
          </div>
        </div>
      )}

      {(state.message || state.nearPickup) && (
        <div className="message">
          {state.nearPickup ? (
            <>Press <kbd>E</kbd> to pick up the lattai</>
          ) : (
            state.message
          )}
        </div>
      )}

      <div className="hud">
        <span className="hud-view">
          {state.view === 'first' ? 'First person' : 'Third person'}
        </span>
        <span className="hud-key"><kbd>W A S D</kbd> move</span>
        {state.holding ? (
          <>
            <span className="hud-key"><kbd>LMB</kbd> / <kbd>F</kbd> pull</span>
            <span className="hud-key"><kbd>RMB</kbd> / <kbd>R</kbd> let out</span>
            <span className="hud-key">look to steer</span>
            <span className="hud-key"><kbd>E</kbd> drop</span>
          </>
        ) : (
          <>
            <span className="hud-key"><kbd>Shift</kbd> run</span>
            <span className="hud-key"><kbd>Space</kbd> jump</span>
            <span className="hud-key"><kbd>E</kbd> pick up</span>
          </>
        )}
        <span className="hud-key"><kbd>V</kbd> / scroll view</span>
        <span className="hud-key"><kbd>Esc</kbd> release mouse</span>
      </div>
      {!state.locked && (
        <div className="start-hint">Click to look around</div>
      )}
    </>
  )
}

export default App
