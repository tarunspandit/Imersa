import React, { useState, useCallback } from 'react';
import { Slider, Input } from '@/components/ui';
import type { Light } from '@/types';

interface ColorControlsProps {
  light: Light;
  onBrightnessChange: (brightness: number) => void;
  onColorTemperatureChange: (ct: number) => void;
  onHueChange: (hue: number) => void;
  onSaturationChange: (sat: number) => void;
  className?: string;
}

export const ColorControls: React.FC<ColorControlsProps> = ({
  light,
  onBrightnessChange,
  onColorTemperatureChange,
  onHueChange,
  onSaturationChange,
  className = '',
}) => {
  const [localBrightness, setLocalBrightness] = useState(light.brightness);
  const [localCt, setLocalCt] = useState(light.temperature || 300);
  const [localHue, setLocalHue] = useState(0);
  const [localSat, setLocalSat] = useState(0);

  // Convert RGB to HSV for display
  const rgbToHsv = useCallback((r: number, g: number, b: number) => {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;

    let h = 0;
    if (diff !== 0) {
      switch (max) {
        case r:
          h = ((g - b) / diff) % 6;
          break;
        case g:
          h = (b - r) / diff + 2;
          break;
        case b:
          h = (r - g) / diff + 4;
          break;
      }
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;

    const s = max === 0 ? 0 : diff / max;
    const v = max;

    return {
      h: Math.round((h / 360) * 65535), // Convert to Hue range
      s: Math.round(s * 254), // Convert to Hue range
      v: Math.round(v * 254), // Convert to Hue range
    };
  }, []);

  // Get current HSV values from light color
  const currentHsv = rgbToHsv(light.color.r, light.color.g, light.color.b);

  const handleBrightnessChange = useCallback((value: number[]) => {
    const brightness = value[0];
    setLocalBrightness(brightness);
    onBrightnessChange(brightness);
  }, [onBrightnessChange]);

  const handleBrightnessInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const brightness = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
    setLocalBrightness(brightness);
    onBrightnessChange(brightness);
  }, [onBrightnessChange]);

  const handleCtChange = useCallback((value: number[]) => {
    const ct = value[0];
    setLocalCt(ct);
    onColorTemperatureChange(ct);
  }, [onColorTemperatureChange]);

  const handleCtInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const ct = Math.max(153, Math.min(500, parseInt(e.target.value) || 300));
    setLocalCt(ct);
    onColorTemperatureChange(ct);
  }, [onColorTemperatureChange]);

  const handleHueChange = useCallback((value: number[]) => {
    const hue = value[0];
    setLocalHue(hue);
    onHueChange(hue);
  }, [onHueChange]);

  const handleHueInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const hue = Math.max(0, Math.min(65535, parseInt(e.target.value) || 0));
    setLocalHue(hue);
    onHueChange(hue);
  }, [onHueChange]);

  const handleSatChange = useCallback((value: number[]) => {
    const sat = value[0];
    setLocalSat(sat);
    onSaturationChange(sat);
  }, [onSaturationChange]);

  const handleSatInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const sat = Math.max(0, Math.min(254, parseInt(e.target.value) || 0));
    setLocalSat(sat);
    onSaturationChange(sat);
  }, [onSaturationChange]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Brightness Control */}
      {light.capabilities.hasBrightness && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Brightness
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                max="100"
                value={localBrightness}
                onChange={handleBrightnessInputChange}
                className="w-16 h-8 text-xs"
                aria-label="Brightness value"
              />
              <span className="text-xs text-gray-500">%</span>
            </div>
          </div>
          <Slider
            value={[localBrightness]}
            onValueChange={handleBrightnessChange}
            min={0}
            max={100}
            step={1}
            className="w-full"
            aria-label="Brightness slider"
          />
        </div>
      )}

      {/* Color Temperature Control */}
      {light.capabilities.hasTemperature && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Color Temperature
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="153"
                max="500"
                value={localCt}
                onChange={handleCtInputChange}
                className="w-16 h-8 text-xs"
                aria-label="Color temperature value"
              />
              <span className="text-xs text-gray-500">CT</span>
            </div>
          </div>
          <Slider
            value={[localCt]}
            onValueChange={handleCtChange}
            min={153}
            max={500}
            step={1}
            className="w-full"
            aria-label="Color temperature slider"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>Warm</span>
            <span>Cool</span>
          </div>
        </div>
      )}

      {/* Hue and Saturation Controls */}
      {light.capabilities.hasColor && (
        <>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Hue
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="65535"
                  value={currentHsv.h}
                  onChange={handleHueInputChange}
                  className="w-20 h-8 text-xs"
                  aria-label="Hue value"
                />
                <span className="text-xs text-gray-500">H</span>
              </div>
            </div>
            <Slider
              value={[currentHsv.h]}
              onValueChange={handleHueChange}
              min={0}
              max={65535}
              step={1}
              className="w-full"
              aria-label="Hue slider"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Saturation
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="254"
                  value={currentHsv.s}
                  onChange={handleSatInputChange}
                  className="w-16 h-8 text-xs"
                  aria-label="Saturation value"
                />
                <span className="text-xs text-gray-500">S</span>
              </div>
            </div>
            <Slider
              value={[currentHsv.s]}
              onValueChange={handleSatChange}
              min={0}
              max={254}
              step={1}
              className="w-full"
              aria-label="Saturation slider"
            />
          </div>
        </>
      )}

      {/* Color Preview */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Current Color
        </label>
        <div
          className="w-8 h-8 rounded-full border-2 border-gray-300 dark:border-gray-600"
          style={{
            backgroundColor: `rgb(${light.color.r}, ${light.color.g}, ${light.color.b})`,
          }}
          aria-label={`Current color: RGB(${light.color.r}, ${light.color.g}, ${light.color.b})`}
        />
      </div>
    </div>
  );
};

export default ColorControls;