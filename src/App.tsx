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
import { ChevronLeft, ChevronRight, Loader2, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { cn } from './lib/utils';

export interface CircleLayer {
  id: string;
  center: [number, number]; // [lon, lat]
  innerRadius: number;
  outerRadius: number;
}

export interface BuildingFootprint {
  id: string;
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
  const [fetchStatus, setFetchStatus] = useState<{
    step: string;
    error: string | null;
  }>({ step: '', error: null });
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
    setFetchStatus({ step: 'Searching PostGIS for buildings...', error: null });
    try {
      // Use our new PostGIS endpoint
      const response = await fetch(`/api/buildings/nearby?lat=${lat}&lon=${lon}&radius=${outerRadius}`);
      if (!response.ok) throw new Error('Failed to fetch buildings from PostGIS');
      const buildings = await response.json();
      
      setFetchStatus({ step: `Analyzing ${buildings.length} buildings with AI...`, error: null });

      const allElements = buildings.map((el: any) => ({
        id: el.osm_id,
        name: el.name,
        distance_meters: el.distance_meters,
        building: el.building,
        amenity: el.amenity,
        military: el.military,
        geometry: el.geometry
      }));

      // Call OpenAI to filter buildings
      const filterResponse = await fetch('/api/openai/filter-buildings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buildings: allElements.map(({ geometry, ...rest }) => rest),
          innerRadius: innerRadius
        })
      });
      
      if (!filterResponse.ok) throw new Error('AI filtering request failed');
      const filterData = await filterResponse.json();
      
      setFetchStatus({ step: 'Processing results and updating map...', error: null });
      
      const civilianIds = new Set(filterData.civilian_buildings.map((b: any) => String(b.id)));

      const footprints: BuildingFootprint[] = allElements
        .filter((el: any) => civilianIds.has(String(el.id)))
        .map((el: any) => {
          let coordinates: [number, number][][] = [];
          if (el.geometry.type === 'Polygon') {
            coordinates = el.geometry.coordinates;
          } else if (el.geometry.type === 'MultiPolygon') {
            coordinates = el.geometry.coordinates.flat(1);
          }

          return {
            id: String(el.id),
            coordinates: coordinates,
          };
        });

      setBuildingFootprints(footprints);
      setFetchStatus({ step: 'Done!', error: null });
      
      // Clear status after a short delay
      setTimeout(() => setFetchStatus({ step: '', error: null }), 3000);
    } catch (error: any) {
      console.error('Building fetch/filter error:', error);
      setFetchStatus({ step: '', error: error.message || 'An unknown error occurred' });
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

        {/* Processing Status Panel */}
        <AnimatePresence>
          {(fetchStatus.step || fetchStatus.error) && (
            <motion.div
              initial={{ opacity: 0, y: 20, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: 20, x: '-50%' }}
              className="absolute bottom-20 left-1/2 z-50 min-w-[300px]"
            >
              <div className={cn(
                "bg-white rounded-xl shadow-2xl border p-4 flex items-center gap-4 transition-colors",
                fetchStatus.error ? "border-red-200 bg-red-50" : "border-blue-100"
              )}>
                {fetchStatus.error ? (
                  <div className="bg-red-100 p-2 rounded-full">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  </div>
                ) : fetchStatus.step === 'Done!' ? (
                  <div className="bg-green-100 p-2 rounded-full">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  </div>
                ) : (
                  <div className="bg-blue-100 p-2 rounded-full">
                    <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                  </div>
                )}
                
                <div className="flex-1">
                  <p className={cn(
                    "text-sm font-medium",
                    fetchStatus.error ? "text-red-900" : "text-gray-900"
                  )}>
                    {fetchStatus.error ? "Error Occurred" : "Processing Status"}
                  </p>
                  <p className={cn(
                    "text-xs",
                    fetchStatus.error ? "text-red-700" : "text-gray-500"
                  )}>
                    {fetchStatus.error || fetchStatus.step}
                  </p>
                </div>

                {fetchStatus.error && (
                  <button 
                    onClick={() => setFetchStatus({ step: '', error: null })}
                    className="p-1 hover:bg-red-100 rounded-full transition-colors"
                  >
                    <X className="w-4 h-4 text-red-500" />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Floating Overlay for Coordinates */}
        <div className="absolute bottom-6 right-6 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg border border-gray-100 text-[10px] font-mono text-gray-500 z-20">
          LAT: {mapState.center[1].toFixed(6)} | LON: {mapState.center[0].toFixed(6)}
        </div>
      </main>
    </div>
  );
}

