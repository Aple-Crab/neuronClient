import React from "react";
import Map from "./components/Map";

const App = () => {

  const geoports = "https://neuronserver.onrender.com/geoports";
  const geodata = "https://neuronserver.onrender.com/geodata";

  return (
    <div>
      <Map geoports={geoports} geodata={geodata} />
    </div>
  );
};

export default App;
