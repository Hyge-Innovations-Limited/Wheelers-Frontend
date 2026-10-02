/** The five verification items, as the API names them, with what an admin reads. */
export const KYC_FIELD_LABELS: Record<string, string> = {
  nin: "NIN card",
  licence: "Driver's licence",
  selfie: "Face check",
  vehicle: "Vehicle details",
  vehiclePhotos: "Vehicle photos",
};

export function kycFieldLabel(field: string): string {
  return KYC_FIELD_LABELS[field] ?? field;
}

/** One-tap reasons, so a driver gets a clear sentence instead of shorthand. */
export const QUICK_REASONS: Record<string, string[]> = {
  nin: ["Blurry or unreadable", "Not a NIN card or slip", "Name doesn't match the account", "Corners cut off"],
  licence: ["Blurry or unreadable", "Expired", "Name doesn't match the NIN", "Not a driver's licence"],
  selfie: ["Face not clearly visible", "Doesn't match the NIN photo", "Too dark"],
  vehicle: ["Plate number doesn't match the photos", "Details incomplete", "Car too old for Wheelers"],
  vehiclePhotos: ["Plate not visible", "Photos too dark or blurry", "Missing angles of the car", "Not the same car"],
};
