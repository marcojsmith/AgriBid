import type { ListingFormData } from "../types";

export const STEPS = [
  "General Information",
  "Technical Specifications",
  "Condition Checklist",
  "Media Gallery",
  "Pricing & Duration",
  "Review & Submit",
];

export const PHOTO_SLOTS = [
  { id: "front", label: "Front 45° View", desc: "Show the main profile of the equipment" },
  { id: "engine", label: "Engine Bay", desc: "Detailed shot of the engine and components" },
  { id: "cabin", label: "Instrument Cluster", desc: "Show hours and dashboard controls" },
  { id: "rear", label: "Rear / Hitch", desc: "Show hydraulics and rear assembly" },
];

export const DEFAULT_FORM_DATA: ListingFormData = {
  year: new Date().getFullYear(),
  make: "",
  model: "",
  location: "",
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
    additional: [],
  },
  startingPrice: 0,
  reservePrice: 0,
  durationDays: 7,
};

export const SA_LOCATIONS = [
  "Johannesburg, ZA", "Cape Town, ZA", "Durban, ZA", "Pretoria, ZA", "Port Elizabeth, ZA",
  "Bloemfontein, ZA", "East London, ZA", "Sandton, ZA", "Soweto, ZA", "Polokwane, ZA",
  "Nelspruit, ZA", "Kimberley, ZA", "George, ZA", "Pietermaritzburg, ZA", "Paarl, ZA",
  "Gaborone, BW", "Windhoek, NA", "Maputo, MZ", "Harare, ZW", "Maseru, LS", "Mbabane, SZ"
].sort();
