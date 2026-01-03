/**
 * Generate a unique shipment number
 */
export function generateShipmentNumber(): string {
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `SHP-${year}-${timestamp}${random}`;
}

/**
 * Generate a unique tracking number
 */
export function generateTrackingNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `TRK-${timestamp}${random}`;
}

/**
 * Generate a unique label number
 */
export function generateLabelNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `LBL-${timestamp}${random}`;
}
