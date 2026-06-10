import Control from "./components/Control";
import Player from "./components/Player";

const params = new URLSearchParams(window.location.search);
const mode = params.get("mode");
const videoPath = params.get("video") || undefined;

export default function App() {
  if (mode === "player") {
    return <Player initialVideoPath={videoPath} />;
  }
  return <Control />;
}
