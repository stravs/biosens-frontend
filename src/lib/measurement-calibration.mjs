// Source: ../BioSens commit 8573f0077590a1a3bec2ba18d90edae19982b9b9,
// source/eureka_system/eureka_system.ino (restored supplier defaults and removed
// flash-diagnostic defaults). Flash record failed CRC; diagnostic floats were rounded.
export const DEFAULT_CALIBRATION = {
  conductivityOffset: -1241.5773, conductivityGain: 0.370295, conductivityGainSquare: 0.117642,
  turbidityOffset: -20.9790, turbidityGain: 0.25490, turbidityGainSquare: 0.00030,
  fluorescenceOffset: 38.7660, fluorescenceGain: -16.2447, temperatureOffset: 0,
};
export const FLASH_CALIBRATION = {
  conductivityOffset: -1447.36377, conductivityGain: 0.26386, conductivityGainSquare: 0.21601,
  turbidityOffset: -33.80020, turbidityGain: 0.14301, turbidityGainSquare: 0.00025,
  fluorescenceOffset: 47.17900, fluorescenceGain: -20.68300, temperatureOffset: 0,
};

// Firmware: EC = a*raw²/1000 + b*raw + c; NTU = a*raw² + b*raw + c.
// Positive raw branch. Logs round EC to 3 decimals and NTU to 2 decimals,
// so recovering raw and applying other coefficients is only an estimate.
const rawFrom = (value, a, b, c) => {
  const discriminant = b * b + 4 * a * (value - c);
  if (discriminant < 0) throw new Error('Kalibracije ni mogoče obrniti.');
  return 2 * (value - c) / (b + Math.sqrt(discriminant));
};
export function recalibratedValue(values, key, calibration = DEFAULT_CALIBRATION) {
  if (key === 'fluorescence') return calibration.fluorescenceOffset + calibration.fluorescenceGain * values[0];
  if (calibration === DEFAULT_CALIBRATION) return values[Number(key)];
  if (key === '1') return values[1] + DEFAULT_CALIBRATION.temperatureOffset - calibration.temperatureOffset;
  const prefix = key === '2' ? 'conductivity' : key === '6' ? 'turbidity' : null;
  if (!prefix) return values[Number(key)];
  const divisor = key === '2' ? 1000 : 1;
  const raw = rawFrom(values[Number(key)], DEFAULT_CALIBRATION[`${prefix}GainSquare`] / divisor,
    DEFAULT_CALIBRATION[`${prefix}Gain`], DEFAULT_CALIBRATION[`${prefix}Offset`]);
  return calibration[`${prefix}GainSquare`] / divisor * raw * raw + calibration[`${prefix}Gain`] * raw + calibration[`${prefix}Offset`];
}
