import Control from "./components/Control";
import Player from "./components/Player";
import Calibrate from "./components/Calibrate";

// Support both hash routing (internal navigation) and query string (main process opens player)
const hash = window.location.hash.slice(1);
const params = new URLSearchParams(window.location.search);
const queryMode = params.get("mode");

export default function App() {
  if (queryMode === "player") {
    return <Player initialVideoPath={params.get("video") || undefined} />;
  }
  if (hash === "calibrate") {
    return <Calibrate />;
  }
  return <Control />;
}
