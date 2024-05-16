import React, { useRef, useEffect, useState } from "react";
import mapboxgl from "mapbox-gl";
import * as turf from "@turf/turf";
import "./Map.css"

const preprocessDensity = (geodata, geoports) => {
  const radius = 50; // radius in kilometers
  const units = "kilometers";

  const buffers = {
    type: "FeatureCollection",
    features: [],
  };

  geoports.features = geoports.features.map((port, index) => {
    // Create a buffer around the geoport point
    const buffer = turf.buffer(port, radius, { units });
    // Add the buffer to the buffers collection
    buffers.features.push(buffer);

    // Count the number of geodata points within the buffer
    const pointsWithin = turf.pointsWithinPolygon(geodata, buffer);
    const density = pointsWithin.features.length;

    // Assign the count as the density property of the geoport
    port.properties.density = density;

    // Print buffer and number of points within buffer to the console
    if (density !== 0) {
      console.log(buffer, density);
    }

    return port;
  });

  return { geoports, buffers };
};

const Map = ({ geoports, geodata }) => {
  const mapContainerRef = useRef(null);
  const [showContainer, setShowContainer] = useState(false);
  const [shipsData, setShipsData] = useState([]);

  useEffect(() => {
    mapboxgl.accessToken =
      "pk.eyJ1IjoiZXNwYWNlc2VydmljZSIsImEiOiJjbHZ1dHZjdTQwMDhrMm1uMnoxdWRibzQ4In0.NaprcMBbdX07f4eXXdr-lw";

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [0, 0], // Initial center of the map
      zoom: 2, // Initial zoom level
      projection: "mercator",
    });

    // Add Navigation Control
    map.addControl(new mapboxgl.NavigationControl(), "top-left");

    map.on("load", async () => {
      console.log("Preprocessing density...");

      const geoportsResponse = await fetch("https://neuronserver.onrender.com//geoports");
      const geodataResponse = await fetch("https://neuronserver.onrender.com//geodata");
      const frequencyResponse = await fetch("https://neuronserver.onrender.com//frequency");

      if (geoportsResponse.ok && geodataResponse.ok && frequencyResponse.ok) {
        console.log("GeoJSON data fetched successfully");
        const geoports = await geoportsResponse.json();
        const geodata = await geodataResponse.json();
        const shipsData = await frequencyResponse.json();

        setShipsData(shipsData);

        const { geoports: processedGeoports, buffers } = preprocessDensity(
          geodata,
          geoports
        );

        console.log("Adding sources and layers to the map...");

        map.addSource("geoports-source", {
          type: "geojson",
          data: processedGeoports,
        });

        map.addSource("geodata-source", {
          type: "geojson",
          data: geodata,
        });

        map.addSource("buffers", {
          type: "geojson",
          data: buffers,
        });

        map.addLayer({
          id: "geodata-markers",
          type: "circle",
          source: "geodata-source",
          minzoom: 0,
          maxzoom: 17,
          paint: {
            "circle-radius": 2,
            "circle-color": "#2C2C2C",
          },
        });

        map.addLayer({
          id: "geoports-markers",
          type: "circle",
          source: "geoports-source",
          minzoom: 0,
          maxzoom: 17,
          paint: {
            "circle-radius": 5,
            "circle-color": [
              "interpolate",
              ["linear"],
              ["get", "density"],
              0,
              "#FFCCBC", // Very Low density
              50,
              "#FF8A65", // Low density
              100,
              "#FF5722", // Medium density
              150,
              "#E64A19", // High density
              200,
              "#BF360C", // Very High density
            ],
          },
        });


        const popup = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: false
        });

        if(map) {
          map.on("mouseenter", "geoports-markers", (e) => {
            // Change the cursor style as a UI indicator.
            map.getCanvas().style.cursor = 'pointer';

            // Copy coordinates array.
            const coordinates = e.features[0].geometry.coordinates.slice();
            const portName = e.features[0].properties.name;

            // Ensure that if the map is zoomed out such that multiple
            // copies of the feature are visible, the popup appears
            // over the copy being pointed to.
            while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
                coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
            }

            // Populate the popup and set its coordinates
            // based on the feature found.
            popup.setLngLat(coordinates).setHTML(portName).addTo(map);
        });

        map.on('mouseleave', "geoports-markers", () => {
            map.getCanvas().style.cursor = '';
            popup.remove();
        });
      }
      
      if(map) {
        map.on("mouseenter", "geodata-markers", (e) => {
          // Change the cursor style as a UI indicator.
          map.getCanvas().style.cursor = 'pointer';

          // Copy coordinates array.
          const coordinates = e.features[0].geometry.coordinates.slice();
          const shipName = e.features[0].properties.name;

          // Ensure that if the map is zoomed out such that multiple
          // copies of the feature are visible, the popup appears
          // over the copy being pointed to.
          while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
              coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
          }

          // Populate the popup and set its coordinates
          // based on the feature found.
          popup.setLngLat(coordinates).setHTML(shipName).addTo(map);
      });

      map.on('mouseleave', "geodata-markers", () => {
          map.getCanvas().style.cursor = '';
          popup.remove();
      });
    } 

      } else {
        console.error("Failed to load GeoJSON data");
      }
    });
    return () => {
      map.remove(); // Cleanup when component unmounts
    };
  }, [geoports, geodata]);


  const toggleContainer = () => {
    setShowContainer(!showContainer);
  };


  return (
    <div className="container">
      <div ref={mapContainerRef} className="map-container" />
      <div className={`side-container ${showContainer ? "show" : ""}`}>
        <h4>Visit of Ships in Past 7 days</h4>
        {shipsData.map((ship, index) => (
          <div className="data-div" key={index}>
            <h2 className="heading">
              <span className="ship-tag">Ship Name: </span>
              {ship.name}
            </h2>
            <ul className="data-list">
              <span className="port-tag">Ports Visited</span>
              {ship.ports.map((port, idx) => (
                <li key={idx}>{port}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <button className="button" onClick={toggleContainer}>
        {showContainer ? "Hide Frequency" : "Show Frequency"}
      </button>
    </div>
  );

};

export default Map;
