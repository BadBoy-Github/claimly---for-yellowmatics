import { GET as apiHealth } from '../api/health/route.js';

export const runtime = 'nodejs';

export async function GET(request) {
  return apiHealth(request);
}
