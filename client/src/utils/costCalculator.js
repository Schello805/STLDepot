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
  const currency = materialSettings?.currency || '€';

  const filType = (model.filament_type || 'PLA').toUpperCase();
  const matchedMat = materials.find(m => (m.id || m.name).toUpperCase() === filType) || materials[0];

  const density = matchedMat?.density || 1.24;
  const pricePerKg = matchedMat?.price_per_kg || 19.99;

  let weight = 0;
  if (typeof model.weight_grams === 'number' && model.weight_grams > 0) {
    weight = model.weight_grams;
  } else if (typeof model.volume_cm3 === 'number' && model.volume_cm3 > 0) {
    weight = model.volume_cm3 * density * infillFactor;
  }

  const priceRaw = (weight / 1000.0) * pricePerKg;
  let formattedPrice = '';
  if (weight > 0) {
    formattedPrice = priceRaw < 0.01 ? `< 0,01 ${currency}` : `${priceRaw.toFixed(2).replace('.', ',')} ${currency}`;
  } else {
    formattedPrice = `-- ${currency}`;
  }

  return {
    weight: parseFloat(weight.toFixed(1)),
    weightFormatted: weight > 0 ? `~${weight.toFixed(1)}g` : '-- g',
    price: formattedPrice,
    priceRaw,
    materialName: matchedMat?.name || matchedMat?.id || 'PLA',
    pricePerKg,
    currency
  };
}
