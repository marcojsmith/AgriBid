import type { ListingFormData } from "../types";

/**
 * Ordered list of step titles displayed in the listing wizard progress indicator.
 * Each index corresponds to a step in the wizard flow.
 */
export const STEPS = [
  "General Information",
  "Technical Specifications",
  "Condition Checklist",
  "Media Gallery",
  "Pricing & Duration",
  "Review & Submit",
];

/**
 * Defines a photo upload slot in the media gallery step.
 */
export interface PhotoSlot {
  /** Unique identifier for the slot (e.g., 'front', 'engine', 'cabin', 'rear') */
  id: string;
  /** Human-readable label displayed to the user */
  label: string;
  /** Description explaining what this slot should show */
  desc: string;
}

/**
 * Predefined photo slots for required equipment views.
 * Each slot represents a specific angle or area that sellers should photograph.
 */
export const PHOTO_SLOTS: PhotoSlot[] = [
  {
    id: "front",
    label: "Front 45° View",
    desc: "Show the main profile of the equipment",
  },
  {
    id: "engine",
    label: "Engine Bay",
    desc: "Detailed shot of the engine and components",
  },
  {
    id: "cabin",
    label: "Instrument Cluster",
    desc: "Show hours and dashboard controls",
  },
  {
    id: "rear",
    label: "Rear / Hitch",
    desc: "Show hydraulics and rear assembly",
  },
];

/**
 * Default form data for a new listing.
 * Used to initialize the wizard state and as fallback when localStorage data is invalid.
 */
export const DEFAULT_FORM_DATA: ListingFormData = {
  year: new Date().getFullYear(),
  categoryId: "",
  make: "",
  model: "",
  location: "",
  description: "",
  operatingHours: 0,
  title: "",
  conditionChecklist: {
    engine: null,
    hydraulics: null,
    tires: null,
    serviceHistory: null,
    notes: "",
  },
  images: {
    front: undefined,
    engine: undefined,
    cabin: undefined,
    rear: undefined,
    additional: [],
  },
  startingPrice: 0,
  reservePrice: 0,
  durationDays: 7,
};

/**
 * List of available auction locations in Southern Africa.
 * Includes major cities from South Africa, Botswana, Namibia, Mozambique, Zimbabwe, Lesotho, and Eswatini.
 */
export const SOUTHERN_AFRICA_LOCATIONS = [
  "Johannesburg, ZA",
  "Cape Town, ZA",
  "Durban, ZA",
  "Pretoria, ZA",
  "Port Elizabeth, ZA",
  "Bloemfontein, ZA",
  "East London, ZA",
  "Sandton, ZA",
  "Soweto, ZA",
  "Polokwane, ZA",
  "Nelspruit, ZA",
  "Kimberley, ZA",
  "George, ZA",
  "Pietermaritzburg, ZA",
  "Paarl, ZA",
  "Gaborone, BW",
  "Windhoek, NA",
  "Maputo, MZ",
  "Harare, ZW",
  "Maseru, LS",
  "Mbabane, SZ",
].sort();
