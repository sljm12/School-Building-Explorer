import React, { useState, useRef, useEffect } from 'react';
import { Search, MapPin, Loader2, GripHorizontal, Maximize2, Minimize2, RefreshCw, MessageSquare, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';

interface Location {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: Record<string, string>;
}

interface SidebarProps {
  onLocationSelect: (lat: number, lon: number) => void;
  pickedLocation: Location | null;
  isPicking: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ onLocationSelect, pickedLocation, isPicking }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [topHeight, setTopHeight] = useState(50); // Percentage
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`
      );
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAskAi = async () => {
    if (!pickedLocation) return;
    setIsAiLoading(true);
    setAiResponse(null);
    try {
      const response = await fetch('/api/openai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'You are a helpful assistant that provides interesting facts about locations.' },
            { role: 'user', content: `Tell me 3 interesting facts about this location: ${pickedLocation.display_name}` }
          ]
        })
      });
      const data = await response.json();
      if (data.choices && data.choices[0]) {
        setAiResponse(data.choices[0].message.content);
      }
    } catch (error) {
      console.error('AI Error:', error);
      setAiResponse('Failed to get AI response. Please check your API key.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const startResizing = (e: React.MouseEvent) => {
    isResizing.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  };

  const stopResizing = () => {
    isResizing.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'default';
    document.body.style.userSelect = 'auto';
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing.current || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const relativeY = e.clientY - containerRect.top;
    const percentage = (relativeY / containerRect.height) * 100;

    // Constrain between 10% and 90%
    setTopHeight(Math.min(Math.max(percentage, 10), 90));
  };

  return (
    <div className="w-80 h-full bg-white border-r border-gray-200 flex flex-col shadow-lg z-10" id="sidebar">
      <div className="p-4 border-b border-gray-100">
        <h1 className="text-xl font-bold text-gray-900 font-sans tracking-tight">
          {import.meta.env.VITE_APP_NAME || 'Building Explorer'}
        </h1>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden relative" ref={containerRef}>
        {/* Search Results Section */}
        <div 
          style={{ height: `${topHeight}%` }}
          className="flex flex-col border-b border-gray-100 overflow-hidden transition-[height] duration-75 ease-out"
        >
          <div className="px-4 py-2 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Search Results</h2>
            {results.length > 0 && <span className="text-[10px] text-gray-400">{results.length} found</span>}
          </div>

          <div className="p-4 border-b border-gray-50 bg-gray-50/30">
            <form onSubmit={handleSearch} className="relative mb-3">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search locations..."
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm shadow-sm"
              />
              <Search className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
            </form>

            <div className="flex items-center gap-2 text-[10px] text-gray-500 bg-blue-50/50 p-2 rounded-md border border-blue-100">
              <div className={cn("w-2 h-2 rounded-full", isPicking ? "bg-green-500 animate-pulse" : "bg-gray-300")} />
              <span>Click anywhere on the map to pick a point</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
              </div>
            ) : results.length > 0 ? (
              <ul className="divide-y divide-gray-50">
                {results.map((location) => (
                  <li
                    key={location.place_id}
                    onClick={() => onLocationSelect(parseFloat(location.lat), parseFloat(location.lon))}
                    className="p-4 hover:bg-blue-50 cursor-pointer transition-colors group"
                  >
                    <div className="flex gap-3">
                      <MapPin className="w-4 h-4 text-gray-400 group-hover:text-blue-500 mt-1 flex-shrink-0" />
                      <p className="text-sm text-gray-700 leading-tight">{location.display_name}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : query && !loading ? (
              <div className="p-8 text-center text-gray-500 text-sm italic">
                No locations found.
              </div>
            ) : (
              <div className="p-8 text-center text-gray-400 text-sm italic">
                Enter a search query above...
              </div>
            )}
          </div>
        </div>

        {/* Resizable Divider Bar */}
        <div 
          className="h-6 bg-gray-50 border-y border-gray-200 flex items-center justify-center cursor-row-resize hover:bg-gray-100 transition-colors group relative z-20"
          onMouseDown={startResizing}
          onDoubleClick={() => setTopHeight(50)}
          title="Drag to resize, Double-click to reset"
        >
          <div className="flex items-center gap-4">
            <button 
              onClick={(e) => { e.stopPropagation(); setTopHeight(90); }}
              className="p-1 hover:bg-white rounded text-gray-400 hover:text-blue-500 transition-colors"
              title="Maximize Search"
            >
              <Maximize2 className="w-3 h-3 rotate-90" />
            </button>
            <GripHorizontal className="w-4 h-4 text-gray-300 group-hover:text-gray-400" />
            <button 
              onClick={(e) => { e.stopPropagation(); setTopHeight(10); }}
              className="p-1 hover:bg-white rounded text-gray-400 hover:text-blue-500 transition-colors"
              title="Maximize Details"
            >
              <Minimize2 className="w-3 h-3 rotate-90" />
            </button>
          </div>
          
          {/* Reset indicator */}
          {Math.abs(topHeight - 50) > 1 && (
            <button 
              onClick={(e) => { e.stopPropagation(); setTopHeight(50); }}
              className="absolute right-2 p-1 hover:bg-white rounded text-gray-300 hover:text-blue-500 transition-colors"
              title="Reset to 50/50"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Details Panel Section */}
        <div 
          style={{ height: `${100 - topHeight}%` }}
          className="flex flex-col overflow-hidden transition-[height] duration-75 ease-out"
        >
          <div className="px-4 py-2 bg-gray-50/50 border-b border-gray-100">
            <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Location Details</h2>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
            {pickedLocation ? (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <MapPin className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 leading-tight mb-1">
                        {pickedLocation.address?.building || pickedLocation.address?.road || 'Selected Point'}
                      </p>
                      <p className="text-xs text-gray-500 leading-relaxed">
                        {pickedLocation.display_name}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-gray-100 pt-4">
                    {pickedLocation.address && Object.entries(pickedLocation.address).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-[11px] py-0.5">
                        <span className="text-gray-400 capitalize">{key.replace(/_/g, ' ')}</span>
                        <span className="text-gray-600 font-medium text-right ml-4">{value}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-[11px] pt-2 mt-2 border-t border-gray-50">
                      <span className="text-gray-400">Coordinates</span>
                      <span className="text-gray-600 font-mono">
                        {parseFloat(pickedLocation.lat).toFixed(4)}, {parseFloat(pickedLocation.lon).toFixed(4)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <button
                      onClick={handleAskAi}
                      disabled={isAiLoading}
                      className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg text-xs font-semibold hover:opacity-90 transition-all disabled:opacity-50 shadow-md"
                    >
                      {isAiLoading ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      Ask AI about this place
                    </button>

                    {aiResponse && (
                      <div className="mt-3 p-3 bg-purple-50 border border-purple-100 rounded-lg animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="flex items-center gap-2 mb-2">
                          <MessageSquare className="w-3 h-3 text-purple-600" />
                          <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">AI Insights</span>
                        </div>
                        <p className="text-[11px] text-gray-700 leading-relaxed whitespace-pre-wrap">
                          {aiResponse}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-400 text-sm">
                <MapPin className="w-8 h-8 mb-2 opacity-20" />
                <p>Click the map or select a result to see details.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
