# School Building Explorer

A specialized geospatial tool for exploring and identifying civilian buildings (such as schools) within specific radii of a selected location. It leverages OpenStreetMap data and uses AI to classify buildings based on their attributes.

## Project Overview

- **Purpose:** To visualize and filter civilian infrastructure near a point of interest, using AI to distinguish between civilian and non-civilian (or ambiguous) buildings.
- **Main Technologies:**
    - **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, OpenLayers (Mapping), Framer Motion (Animations), Lucide React (Icons).
    - **Backend:** Express server (via `tsx`) which serves as an API proxy for OpenAI, integrates Vite as middleware for development, and uses `pg` for PostGIS database connectivity.
    - **External APIs:**
        - **OpenStreetMap (Nominatim):** For reverse geocoding and location search.
        - **OpenStreetMap (Overpass API):** For fetching building footprints and metadata.
        - **OpenAI (GPT-4o):** For intelligent filtering and classification of building data.
    - **Database:** PostGIS (PostgreSQL) for storing and querying geospatial data.

## Architecture

- **`server.ts`:** The entry point for the application. It initializes an Express server that:
    - Proxies requests to OpenAI to keep API keys secure.
    - Includes a specialized endpoint `/api/openai/filter-buildings` which uses a detailed prompt to classify OSM data.
    - Handles Vite's middleware in development mode and serves static assets in production.
- **`src/App.tsx`:** The main state container, managing map coordinates, search results, circular selection layers, and building footprint data.
- **`src/components/Map.tsx`:** An OpenLayers-based component that handles map rendering, layers (OSM, circles, building footprints), and user interactions (clicks, movement).
- **`src/components/`:** Contains modular UI components like `Sidebar`, `Toolbar`, and `RadiusDialog`.

## Building and Running

### Prerequisites
- Node.js installed.
- An OpenAI API Key (and optionally a Gemini API Key).
- A running PostGIS (PostgreSQL) instance.

### Commands
- **Install Dependencies:**
  ```bash
  npm install
  ```
- **Development Mode:**
  Starts the Express server with Vite middleware. Ensure `OPENAI_API_KEY` and PostGIS configuration (e.g., `POSTGRES_HOST`, `POSTGRES_USER`) are set in your environment or `.env` file.
  ```bash
  npm run dev
  ```
- **Build for Production:**
  ```bash
  npm run build
  ```
- **Type Checking:**
  ```bash
  npm run lint
  ```

## Development Conventions

- **Environment Variables:** Use `.env` or `.env.local` for sensitive keys. Required variables include `OPENAI_API_KEY`.
- **Styling:** Uses Tailwind CSS v4. Prefer utility classes for styling.
- **Animations:** Use `motion` (from `motion/react`) for smooth UI transitions and state changes.
- **Map Interaction:** All map-related logic should be encapsulated in `src/components/Map.tsx`. Coordinate systems should be handled carefully (OpenLayers uses `EPSG:3857` internally, while coordinates are often passed as `EPSG:4326` [lon, lat]).
- **AI Integration:** For new AI-driven features, add corresponding endpoints to `server.ts` to maintain a secure proxy pattern.
