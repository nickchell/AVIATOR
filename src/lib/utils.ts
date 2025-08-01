import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const BACKEND_URL = "https://aviator-backend-rouq.onrender.com";

// Calculate the current round based on start time and round duration
export function getCurrentRound(startTime: number, roundDuration: number): number {
  const now = Date.now();
  return Math.floor((now - startTime) / roundDuration);
}

// Fetch a batch of multipliers from the backend using from/to
export async function fetchMultiplierBatch(startRound: number, count: number): Promise<Array<{ round_number: number, multiplier: number }>> {
  const from = startRound;
  const to = startRound + count - 1;
  console.log('Fetching multiplier batch from rounds', from, 'to', to);
  const response = await fetch(`${BACKEND_URL}/api/multipliers?from=${from}&to=${to}`);
  console.log('Multiplier batch response status:', response.status);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const data = await response.json();
  console.log('Multiplier batch raw data:', data);
  return data;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
