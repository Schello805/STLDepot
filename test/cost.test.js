import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateModelCost } from '../client/src/utils/costCalculator.js';

describe('costCalculator - Material & Print Cost Engine', () => {
  const defaultSettings = {
    materials: [
      { id: 'PLA', name: 'PLA', density: 1.24, price_per_kg: 20.00 },
      { id: 'PETG', name: 'PETG', density: 1.27, price_per_kg: 30.00 },
      { id: 'TPU', name: 'TPU', density: 1.21, price_per_kg: 40.00 }
    ],
    infill_factor: 0.35,
    currency: '€'
  };

  it('calculates cost accurately from explicit weight in grams', () => {
    // 50g of PLA at 20 €/kg = 0.050 kg * 20 € = 1.00 €
    const model = {
      filament_type: 'PLA',
      weight_grams: 50
    };

    const res = calculateModelCost(model, defaultSettings);
    assert.ok(res);
    assert.equal(res.weight, 50);
    assert.equal(res.weightFormatted, '~50.0g');
    assert.equal(res.price, '1,00 €');
    assert.equal(res.priceRaw, 1.0);
    assert.equal(res.materialName, 'PLA');
  });

  it('calculates cost from volume when weight_grams is not pre-calculated', () => {
    // 100 cm3 volume with PLA (density 1.24, infill 0.35)
    // Weight = 100 * 1.24 * 0.35 = 43.4g
    // Cost = 0.0434 kg * 20 € = 0.868 € -> 0,87 €
    const model = {
      filament_type: 'PLA',
      volume_cm3: 100
    };

    const res = calculateModelCost(model, defaultSettings);
    assert.ok(res);
    assert.equal(res.weight, 43.4);
    assert.equal(res.price, '0,87 €');
  });

  it('matches material case-insensitively and handles alternate filaments', () => {
    const model = {
      filament_type: 'petg',
      weight_grams: 100
    };

    // 100g PETG @ 30 €/kg = 3.00 €
    const res = calculateModelCost(model, defaultSettings);
    assert.ok(res);
    assert.equal(res.price, '3,00 €');
    assert.equal(res.materialName, 'PETG');
  });

  it('falls back gracefully to PLA when unknown filament type is provided', () => {
    const model = {
      filament_type: 'MYSTERY_FILAMENT',
      weight_grams: 10
    };

    const res = calculateModelCost(model, defaultSettings);
    assert.ok(res);
    assert.equal(res.weight, 10);
    assert.equal(res.price, '0,20 €');
  });

  it('handles micro-costs below 1 cent cleanly', () => {
    const model = {
      filament_type: 'PLA',
      weight_grams: 0.1
    };

    // 0.1g @ 20 €/kg = 0.002 €
    const res = calculateModelCost(model, defaultSettings);
    assert.ok(res);
    assert.equal(res.price, '< 0,01 €');
  });

  it('returns empty placeholder when model has no weight or volume', () => {
    const model = {
      filament_type: 'PLA',
      weight_grams: 0,
      volume_cm3: 0
    };

    const res = calculateModelCost(model, defaultSettings);
    assert.ok(res);
    assert.equal(res.weight, 0);
    assert.equal(res.weightFormatted, '-- g');
    assert.equal(res.price, '-- €');
  });

  it('handles null or undefined model gracefully without throwing', () => {
    assert.equal(calculateModelCost(null, defaultSettings), null);
    assert.equal(calculateModelCost(undefined, defaultSettings), null);
  });
});
