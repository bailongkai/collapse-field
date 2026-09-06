export interface Pickup {
  id: number;
  active: boolean;
  defId: string;
  x: number;
  y: number;
  radius: number;
  attracted: boolean;
}

export function createPickup(id: number): Pickup {
  return { id, active: false, defId: '', x: 0, y: 0, radius: 0, attracted: false };
}
