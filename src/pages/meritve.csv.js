import { SAMPLES } from '../data/measurements.mjs';
import { measurementsCsv } from '../lib/measurements-csv.mjs';

export function GET() {
  return new Response(measurementsCsv(SAMPLES), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="biosens_meritve_vse.csv"',
    },
  });
}
