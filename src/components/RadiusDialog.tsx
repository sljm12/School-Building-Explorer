import React, { useState } from 'react';
import { X } from 'lucide-react';

interface RadiusDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (inner: number, outer: number) => void;
}

const RadiusDialog: React.FC<RadiusDialogProps> = ({ isOpen, onClose, onConfirm }) => {
  const [inner, setInner] = useState<string>('100');
  const [outer, setOuter] = useState<string>('200');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(parseFloat(inner), parseFloat(outer));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-gray-100 animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Set Circle Radii</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Inner Radius (meters)</label>
            <input
              type="number"
              value={inner}
              onChange={(e) => setInner(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              required
              min="0"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Outer Radius (meters)</label>
            <input
              type="number"
              value={outer}
              onChange={(e) => setOuter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              required
              min="0"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium shadow-lg shadow-blue-200"
            >
              Confirm
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RadiusDialog;
