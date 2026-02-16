import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { useListingWizard } from "../context/ListingWizardContext";

export const ConditionChecklistStep = () => {
  const { formData, updateChecklist } = useListingWizard();

  const checklistItems = [
    { id: "engine" as const, label: "Engine Condition", desc: "Is the engine running smoothly without leaks?" },
    { id: "hydraulics" as const, label: "Hydraulic System", desc: "Are all hydraulic cylinders and hoses in good working order?" },
    { id: "tires" as const, label: "Tires / Tracks", desc: "Do tires/tracks have more than 50% tread remaining?" },
    { id: "serviceHistory" as const, label: "Service History", desc: "Do you have complete maintenance records for this unit?" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="bg-amber-50 border-2 border-amber-100 p-4 rounded-xl flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
        <p className="text-[11px] text-amber-900 font-bold uppercase tracking-wide leading-relaxed">
          Honesty ensures the highest final bid. Buyers value transparency above all else.
        </p>
      </div>
      
      <div className="space-y-4">
        {checklistItems.map((item) => (
          <div key={item.id} className="flex items-center justify-between p-4 rounded-2xl border-2 bg-card">
            <div className="space-y-0.5">
              <p className="font-black text-sm uppercase tracking-tight">{item.label}</p>
              <p className="text-[10px] text-muted-foreground font-medium uppercase">{item.desc}</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant={formData.conditionChecklist[item.id] === true ? "default" : "outline"}
                size="sm"
                onClick={() => updateChecklist(item.id, true)}
                className="rounded-lg font-bold w-16"
                aria-pressed={formData.conditionChecklist[item.id] === true}
              >
                Yes
              </Button>
              <Button
                variant={formData.conditionChecklist[item.id] === false ? "destructive" : "outline"}
                size="sm"
                onClick={() => updateChecklist(item.id, false)}
                className="rounded-lg font-bold w-16"
                aria-pressed={formData.conditionChecklist[item.id] === false}
              >
                No
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <label htmlFor="condition-notes" className="text-xs font-black uppercase text-muted-foreground ml-1">Additional Condition Notes</label>
        <textarea 
          id="condition-notes"
          value={formData.conditionChecklist.notes}
          onChange={(e) => updateChecklist("notes", e.target.value)}
          placeholder="Mention any recent repairs, known issues, or upgrades..."
          className="w-full min-h-[120px] p-4 rounded-xl border-2 bg-background focus:border-primary outline-none transition-colors text-sm"
        />
      </div>
    </div>
  );
};
