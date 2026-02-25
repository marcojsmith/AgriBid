/**
 * Represents the condition checklist for equipment condition assessment.
 * Each key corresponds to a specific component or feature.
 */
export interface ConditionChecklist {
  /** Engine condition status */
  engine: boolean | null;
  /** Hydraulic system condition status */
  hydraulics: boolean | null;
  /** Tires/tracks condition status */
  tires: boolean | null;
  /** Service history availability */
  serviceHistory: boolean | null;
  /** Additional notes about the equipment condition */
  notes: string;
}

/**
 * Represents the images associated with a listing.
 * Optional image slots (front, engine, cabin, rear) plus required additional photos array.
 */
export interface ListingImages {
  /** Front 45° view image storage ID */
  front?: string;
  /** Engine bay image storage ID */
  engine?: string;
  /** Cabin/instrument cluster image storage ID */
  cabin?: string;
  /** Rear/hitch image storage ID */
  rear?: string;
  /** Additional photos array */
  additional: string[];
}

/**
 * Complete form data structure for creating or editing a listing.
 * Used throughout the listing wizard to manage form state.
 */
export interface ListingFormData {
  /** Manufacturing year of the equipment */
  year: number;
  /** Equipment manufacturer/make */
  make: string;
  /** Equipment model name */
  model: string;
  /** Auction location */
  location: string;
  /** Detailed description of the equipment */
  description: string;
  /** Operating hours on the equipment */
  operatingHours: number;
  /** Auto-generated title from year, make, and model */
  title: string;
  /** Condition checklist responses */
  conditionChecklist: ConditionChecklist;
  /** Uploaded images for the listing */
  images: ListingImages;
  /** Starting bid price in ZAR */
  startingPrice: number;
  /** Reserve price (minimum acceptable price) in ZAR */
  reservePrice: number;
  /** Auction duration in days */
  durationDays: number;
}
