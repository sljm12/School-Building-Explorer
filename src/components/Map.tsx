import React, { useEffect, useRef } from 'react';
import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { fromLonLat, toLonLat } from 'ol/proj';
import { Feature } from 'ol';
import { Point, Polygon } from 'ol/geom';
import { Vector as VectorLayer } from 'ol/layer';
import { Vector as VectorSource } from 'ol/source';
import { Style, Icon, Fill, Stroke } from 'ol/style';
import { circular } from 'ol/geom/Polygon';

interface CircleLayerData {
  id: string;
  center: [number, number];
  innerRadius: number;
  outerRadius: number;
}

interface BuildingFootprintData {
  id: number;
  coordinates: [number, number][][];
}

interface MapProps {
  center: [number, number]; // [lon, lat]
  zoom: number;
  onClick?: (lat: number, lon: number) => void;
  onMoveEnd?: (center: [number, number], zoom: number) => void;
  circleLayers?: CircleLayerData[];
  buildingFootprints?: BuildingFootprintData[];
}

const MapComponent: React.FC<MapProps> = ({ 
  center, 
  zoom, 
  onClick, 
  onMoveEnd, 
  circleLayers = [],
  buildingFootprints = []
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<Map | null>(null);
  const markerSource = useRef<VectorSource>(new VectorSource());
  const circleSource = useRef<VectorSource>(new VectorSource());
  const buildingSource = useRef<VectorSource>(new VectorSource());

  // Use refs to avoid stale closures in event listeners
  const onClickRef = useRef(onClick);
  const onMoveEndRef = useRef(onMoveEnd);

  useEffect(() => {
    onClickRef.current = onClick;
  }, [onClick]);

  useEffect(() => {
    onMoveEndRef.current = onMoveEnd;
  }, [onMoveEnd]);

  useEffect(() => {
    if (!mapRef.current) return;

    const vectorLayer = new VectorLayer({
      source: markerSource.current,
      style: new Style({
        image: new Icon({
          anchor: [0.5, 1],
          src: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
          scale: 0.05,
        }),
      }),
    });

    const circleLayer = new VectorLayer({
      source: circleSource.current,
    });

    const buildingLayer = new VectorLayer({
      source: buildingSource.current,
      style: new Style({
        stroke: new Stroke({
          color: 'rgba(239, 68, 68, 1)', // Red outline
          width: 1,
        }),
        fill: new Fill({
          color: 'rgba(239, 68, 68, 0.3)', // Red transparent fill
        }),
      }),
    });

    const map = new Map({
      target: mapRef.current,
      layers: [
        new TileLayer({
          source: new OSM(),
        }),
        buildingLayer,
        circleLayer,
        vectorLayer,
      ],
      view: new View({
        center: fromLonLat(center),
        zoom: zoom,
      }),
    });

    map.on('click', (event) => {
      const coords = toLonLat(event.coordinate);
      if (onClickRef.current) {
        onClickRef.current(coords[1], coords[0]);
      }
    });

    map.on('moveend', () => {
      const view = map.getView();
      const center = toLonLat(view.getCenter()!);
      const zoom = view.getZoom();
      if (onMoveEndRef.current && zoom !== undefined) {
        onMoveEndRef.current([center[0], center[1]], zoom);
      }
    });

    mapInstance.current = map;

    return () => {
      map.setTarget(undefined);
    };
  }, []);

  useEffect(() => {
    if (mapInstance.current) {
      circleSource.current.clear();
      
      circleLayers.forEach(layer => {
        // Inner Circle
        const innerGeom = circular(layer.center, layer.innerRadius);
        innerGeom.transform('EPSG:4326', 'EPSG:3857');
        const innerFeature = new Feature({
          geometry: innerGeom,
        });
        innerFeature.setStyle(new Style({
          stroke: new Stroke({
            color: 'rgba(59, 130, 246, 0.8)',
            width: 2,
            lineDash: [4, 4],
          }),
          fill: new Fill({
            color: 'rgba(59, 130, 246, 0.1)',
          }),
        }));

        // Outer Circle
        const outerGeom = circular(layer.center, layer.outerRadius);
        outerGeom.transform('EPSG:4326', 'EPSG:3857');
        const outerFeature = new Feature({
          geometry: outerGeom,
        });
        outerFeature.setStyle(new Style({
          stroke: new Stroke({
            color: 'rgba(37, 99, 235, 1)',
            width: 2,
          }),
          fill: new Fill({
            color: 'rgba(37, 99, 235, 0.05)',
          }),
        }));

        circleSource.current.addFeatures([outerFeature, innerFeature]);
      });
    }
  }, [circleLayers]);

  useEffect(() => {
    if (mapInstance.current) {
      buildingSource.current.clear();
      
      buildingFootprints.forEach(footprint => {
        const polygonCoords = footprint.coordinates.map(ring => 
          ring.map(coord => fromLonLat(coord))
        );
        
        const feature = new Feature({
          geometry: new Polygon(polygonCoords),
        });
        
        buildingSource.current.addFeature(feature);
      });
    }
  }, [buildingFootprints]);

  useEffect(() => {
    if (mapInstance.current) {
      const view = mapInstance.current.getView();
      const currentCenter = toLonLat(view.getCenter()!);
      const currentZoom = view.getZoom();

      // Only animate if the props are significantly different from current view
      // to avoid feedback loops from onMoveEnd
      const centerDiff = Math.abs(currentCenter[0] - center[0]) + Math.abs(currentCenter[1] - center[1]);
      const zoomDiff = Math.abs((currentZoom || 0) - zoom);

      if (centerDiff > 0.00001 || zoomDiff > 0.1) {
        view.animate({
          center: fromLonLat(center),
          zoom: zoom,
          duration: 1000,
        });
      }

      // Update marker
      markerSource.current.clear();
      const marker = new Feature({
        geometry: new Point(fromLonLat(center)),
      });
      markerSource.current.addFeature(marker);
    }
  }, [center, zoom]);

  return <div ref={mapRef} className="w-full h-full" id="map-container" />;
};

export default MapComponent;
