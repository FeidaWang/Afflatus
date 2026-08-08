import { describe, expect, it, vi } from 'vitest';
import { drawSectorsLogoImage } from '../src/lib/sectorsGraphView.js';

describe('Sectors graph logo rendering', () => {
  it('uses the non-cropping Canvas overload for a viewBox-only SVG', () => {
    const drawImage = vi.fn();
    const image = { naturalWidth: 150, naturalHeight: 150 };

    drawSectorsLogoImage({ drawImage }, image, {}, 50, 30, 96, 64);

    expect(drawImage).toHaveBeenCalledTimes(1);
    expect(drawImage.mock.calls[0]).toHaveLength(5);
    expect(drawImage.mock.calls[0][0]).toBe(image);
  });

  it('keeps the source-crop overload for an explicitly cropped raster logo', () => {
    const drawImage = vi.fn();
    const image = { naturalWidth: 454, naturalHeight: 132 };

    drawSectorsLogoImage({ drawImage }, image, {
      logo_crop: { x: 0.08, y: 0.18, width: 0.84, height: 0.64 },
    }, 50, 30, 96, 64);

    expect(drawImage).toHaveBeenCalledTimes(1);
    expect(drawImage.mock.calls[0]).toHaveLength(9);
  });
});
