import Control from "./components/Control";
import Player from "./components/Player";

const params = new URLSearchParams(window.location.search);
const queryMode = params.get("mode");

export default function App() {
  if (queryMode === "player") {
    return <Player initialVideoPath={params.get("video") || undefined} />;
  }
  return <Control />;
}
