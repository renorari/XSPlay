import { useState, useEffect } from "react";
import Main from "./components/Main";
import Player from "./components/Player";
import Calibrate from "./components/Calibrate";

export default function App() {
  const [route, setRoute] = useState(() => window.location.hash.slice(1) || "/");

  useEffect(() => {
    const onHashChange = () => setRoute(window.location.hash.slice(1) || "/");
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  if (route === "player") {
    return <Player />;
  }
  if (route === "calibrate") {
    return <Calibrate />;
  }

  return <Main />;
}
