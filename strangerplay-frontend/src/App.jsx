import { useState } from "react";
import StrangerPlay from "./pages/StrangerPlay_Main";
import Splash from "./pages/Splash";

function App() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <>
      <StrangerPlay />
      {showSplash && <Splash onDone={() => setShowSplash(false)} />}
    </>
  );
}

export default App;