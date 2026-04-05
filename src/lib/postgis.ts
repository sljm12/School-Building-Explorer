import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DATABASE || 'school_explorer',
});

export interface BuildingResult {
  osm_id: string;
  name: string | null;
  amenity: string | null;
  building: string | null;
  military: string | null;
  distance_meters: number;
  geometry: any; // GeoJSON geometry
}

/**
 * Fetches buildings within a specified radius of a given location using PostGIS.
 * 
 * @param lon - Longitude of the center point
 * @param lat - Latitude of the center point
 * @param radiusMeters - Search radius in meters
 * @returns A promise that resolves to an array of buildings within the radius.
 */
export async function getBuildingsNearby(
  lon: number,
  lat: number,
  radiusMeters: number
): Promise<BuildingResult[]> {
  const query = `
    SELECT 
        osm_id, 
        name, 
        amenity, 
        building,
        military,
        ST_Distance(
            ST_Transform(way, 4326)::geography, 
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        ) as distance_meters,
        ST_AsGeoJSON(ST_Transform(way, 4326)) as geometry
    FROM 
        public.planet_osm_polygon
    WHERE 
        ST_DWithin(
            ST_Transform(way, 4326)::geography, 
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 
            $3
        )
    ORDER BY 
        distance_meters ASC
  `;

  try {
    const result = await pool.query(query, [lon, lat, radiusMeters]);
    return result.rows.map(row => ({
      ...row,
      distance_meters: parseFloat(row.distance_meters),
      geometry: JSON.parse(row.geometry),
    }));
  } catch (error) {
    console.error('Error executing PostGIS query:', error);
    throw error;
  }
}

export default pool;
