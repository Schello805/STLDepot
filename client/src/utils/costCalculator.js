/**
 * Utility to calculate model weight and estimated print material cost
 * based on current user material pricing settings.
 */

export function calculateModelCost(model, materialSettings) {
  if (!model) return null;

  const materials = materialSettings?.materials || [
    { id: 'PLA', name: 'PLA', density: 1.24, price_per_kg: 19.99 },
    { id: 'PETG', name: 'PETG', density: 1.27, price_per_kg: 21.99 },
    { id: 'ABS', name: 'ABS', density: 1.04, price_per_kg: 22.99 },
    { id: 'ASA', name: 'ASA', density: 1.07, price_per_kg: 24.99 },
    { id: 'TPU', name: 'TPU', density: 1.21, price_per_kg: 29.99 }
  ];
  const infillFactor = typeof materialSettings?.infill_factor === 'number' ? materialSettings.infill_factor : 0.35;
  const multicolorWastePercent = typeof materialSettings?.multicolor_waste_percent === 'number'
    ? materialSettings.multicolor_waste_percent 
    : 10;
  const currency = materialSettings?.currency || '€';

  const filType = (model.filament_type || 'PLA').toUpperCase();
  const matchedMat = materials.find(m => (m.id || m.name).toUpperCase() === filType) || materials[0];

  const density = matchedMat?.density || 1.24;
  const pricePerKg = matchedMat?.price_per_kg || 19.99;

  let baseWeight = 0;
  if (typeof model.weight_grams === 'number' && model.weight_grams > 0) {
    baseWeight = model.weight_grams;
  } else if (typeof model.volume_cm3 === 'number' && model.volume_cm3 > 0) {
    baseWeight = model.volume_cm3 * density * infillFactor;
  }

  const isMultiColor = Boolean(model.is_multicolor);
  const wastePercent = isMultiColor ? multicolorWastePercent : 0;
  const wasteGrams = isMultiColor && baseWeight > 0 ? (baseWeight * wastePercent) / 100.0 : 0;
  const totalWeight = baseWeight + wasteGrams;

  const basePriceRaw = (baseWeight / 1000.0) * pricePerKg;
  const wastePriceRaw = (wasteGrams / 1000.0) * pricePerKg;
  const totalPriceRaw = basePriceRaw + wastePriceRaw;

  let formattedPrice = '';
  if (totalWeight > 0) {
    formattedPrice = totalPriceRaw < 0.01 
      ? `< 0,01 ${currency}` 
      : `${totalPriceRaw.toFixed(2).replace('.', ',')} ${currency}`;
  } else {
    formattedPrice = `-- ${currency}`;
  }

  return {
    weight: parseFloat(totalWeight.toFixed(1)),
    baseWeight: parseFloat(baseWeight.toFixed(1)),
    wasteGrams: parseFloat(wasteGrams.toFixed(1)),
    weightFormatted: totalWeight > 0 ? `~${totalWeight.toFixed(1)}g` : '-- g',
    price: formattedPrice,
    priceRaw: totalPriceRaw,
    basePriceRaw,
    wastePriceRaw,
    materialName: matchedMat?.name || matchedMat?.id || 'PLA',
    pricePerKg,
    currency,
    isMultiColor,
    wastePercent
  };
}
