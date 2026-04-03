/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import Sidebar from './components/Sidebar';
import MapComponent from './components/Map';
import Toolbar from './components/Toolbar';
import RadiusDialog from './components/RadiusDialog';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from './lib/utils';

export interface CircleLayer {
  id: string;
  center: [number, number]; // [lon, lat]
  innerRadius: number;
  outerRadius: number;
}

export interface BuildingFootprint {
  id: number;
  coordinates: [number, number][][]; // Array of rings, each ring is an array of [lon, lat]
}

export default function App() {
  const [mapState, setMapState] = useState<{
    center: [number, number];
    zoom: number;
  }>({
    center: [0, 0],
    zoom: 2,
  });

  const [pickedLocation, setPickedLocation] = useState<any>(null);
  const [isPicking, setIsPicking] = useState(false);
  
  // New state for circle picking
  const [isPickingCircleLocation, setIsPickingCircleLocation] = useState(false);
  const [showRadiusDialog, setShowRadiusDialog] = useState(false);
  const [pendingCircleLocation, setPendingCircleLocation] = useState<[number, number] | null>(null);
  const [circleLayers, setCircleLayers] = useState<CircleLayer[]>([]);
  const [buildingFootprints, setBuildingFootprints] = useState<BuildingFootprint[]>([]);
  const [isFetchingBuildings, setIsFetchingBuildings] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const handleLocationSelect = (lat: number, lon: number) => {
    setMapState({
      center: [lon, lat],
      zoom: 16,
    });
    // Also fetch details for the selected search result
    fetchLocationDetails(lat, lon);
  };

  const fetchLocationDetails = async (lat: number, lon: number) => {
    setIsPicking(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`
      );
      const data = await response.json();
      setPickedLocation(data);
    } catch (error) {
      console.error('Reverse geocoding error:', error);
    } finally {
      setIsPicking(false);
    }
  };

  const handleMapClick = (lat: number, lon: number) => {
    if (isPickingCircleLocation) {
      setPendingCircleLocation([lon, lat]);
      setShowRadiusDialog(true);
      setIsPickingCircleLocation(false);
      return;
    }

    setMapState(prev => ({
      ...prev,
      center: [lon, lat],
      // zoom remains the same as current state
    }));
    fetchLocationDetails(lat, lon);
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };

  const fetchBuildingFootprints = async (lat: number, lon: number, innerRadius: number, outerRadius: number) => {
    setIsFetchingBuildings(true);
    try {
      // Overpass API query for buildings and schools within a radius
      const query = `
        [out:json];
        (
          way["building"](around:${outerRadius},${lat},${lon});
          relation["building"](around:${outerRadius},${lat},${lon});
          way["amenity"="school"](around:${outerRadius},${lat},${lon});
          relation["amenity"="school"](around:${outerRadius},${lat},${lon});
          way["school"](around:${outerRadius},${lat},${lon});
          relation["school"](around:${outerRadius},${lat},${lon});
        );
        out geom;
      `;
      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: query,
      });
      const data = await response.json();
      
      const allElements = data.elements
        .filter((el: any) => (el.type === 'way' || el.type === 'relation') && el.geometry)
        .map((el: any) => {
          // Calculate distance from center to first point of geometry as an approximation
          const firstPt = el.geometry[0];
          const dist = calculateDistance(lat, lon, firstPt.lat, firstPt.lon);
          
          return {
            id: el.id,
            name: el.tags?.name || null,
            distance_meters: dist,
            building: el.tags?.building || null,
            amenity: el.tags?.amenity || null,
            military: el.tags?.military || null,
            geometry: el.geometry
          };
        });

      // Call OpenAI to filter buildings
      const filterResponse = await fetch('/api/openai/filter-buildings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buildings: allElements.map(({ geometry, ...rest }) => rest),
          innerRadius: innerRadius
        })
      });
      
      const filterData = await filterResponse.json();
      const civilianIds = new Set(filterData.civilian_buildings.map((b: any) => b.id));

      const footprints: BuildingFootprint[] = allElements
        .filter((el: any) => civilianIds.has(el.id))
        .map((el: any) => ({
          id: el.id,
          coordinates: [el.geometry.map((pt: any) => [pt.lon, pt.lat])],
        }));

      setBuildingFootprints(footprints);
    } catch (error) {
      console.error('Building fetch/filter error:', error);
    } finally {
      setIsFetchingBuildings(false);
    }
  };

  const handleAddCircles = (inner: number, outer: number) => {
    if (pendingCircleLocation) {
      const newLayer: CircleLayer = {
        id: Math.random().toString(36).substr(2, 9),
        center: pendingCircleLocation,
        innerRadius: inner,
        outerRadius: outer,
      };
      setCircleLayers([newLayer]);
      
      // Fetch buildings for the new circle with AI filtering
      fetchBuildingFootprints(pendingCircleLocation[1], pendingCircleLocation[0], inner, outer);
      
      setPendingCircleLocation(null);
    }
  };

  const handleMoveEnd = (center: [number, number], zoom: number) => {
    setMapState({ center, zoom });
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50 font-sans" id="app-root">
      {/* Sidebar Container with Animation */}
      <motion.div
        initial={false}
        animate={{ 
          width: isSidebarCollapsed ? 0 : 320,
          opacity: isSidebarCollapsed ? 0 : 1
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="relative flex-shrink-0 h-full overflow-hidden"
      >
        <Sidebar 
          onLocationSelect={handleLocationSelect} 
          pickedLocation={pickedLocation}
          isPicking={isPicking}
        />
      </motion.div>

      {/* Collapse Toggle Button */}
      <div className="relative z-40 flex items-center">
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className={cn(
            "absolute -left-3 w-6 h-12 bg-white border border-gray-200 rounded-full shadow-md flex items-center justify-center hover:bg-gray-50 transition-colors group",
            isSidebarCollapsed && "left-2"
          )}
          title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isSidebarCollapsed ? (
            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
          )}
        </button>
      </div>

      <main className="flex-1 relative">
        <Toolbar 
          isPicking={isPickingCircleLocation} 
          onTogglePicking={() => {
            if (!isPickingCircleLocation) {
              setCircleLayers([]);
              setBuildingFootprints([]);
            }
            setIsPickingCircleLocation(!isPickingCircleLocation);
          }} 
        />
        
        <MapComponent 
          center={mapState.center} 
          zoom={mapState.zoom} 
          onClick={handleMapClick}
          onMoveEnd={handleMoveEnd}
          circleLayers={circleLayers}
          buildingFootprints={buildingFootprints}
        />

        <RadiusDialog 
          isOpen={showRadiusDialog}
          onClose={() => setShowRadiusDialog(false)}
          onConfirm={handleAddCircles}
        />
        
        {/* Floating Overlay for Coordinates */}
        <div className="absolute bottom-6 right-6 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg border border-gray-100 text-[10px] font-mono text-gray-500 z-20">
          LAT: {mapState.center[1].toFixed(6)} | LON: {mapState.center[0].toFixed(6)}
        </div>
      </main>
    </div>
  );
}

