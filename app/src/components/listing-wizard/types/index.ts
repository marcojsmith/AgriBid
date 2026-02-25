export interface ConditionChecklist {
  engine: boolean | null;
  hydraulics: boolean | null;
  tires: boolean | null;
  serviceHistory: boolean | null;
  notes?: string;
}

export interface ListingFormData {
  year: number;
  make: string;
  model: string;
  location: string;
  description: string;
  operatingHours: number;
  title: string;
  conditionChecklist: ConditionChecklist;
  images: {
    front?: string;
    engine?: string;
    cabin?: string;
    rear?: string;
    additional: string[];
  };
  startingPrice: number;
  reservePrice: number;
  durationDays: number;
}
