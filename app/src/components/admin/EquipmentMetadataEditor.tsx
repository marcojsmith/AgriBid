import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { Search, Hammer, LayoutGrid } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingIndicator } from "@/components/LoadingIndicator";

import { api } from "../../../convex/_generated/api";
import { CategoryManager } from "./CategoryManager";
import { MetadataCatalog } from "./MetadataCatalog";
import type { Doc } from "../../../convex/_generated/dataModel";

type Category = Doc<"equipmentCategories">;
type EquipmentMetadata = Doc<"equipmentMetadata"> & { categoryName: string };

/**
 * Admin component for managing the equipment metadata catalog and categories.
 * Provides tabs for switching between the equipment catalog and category management.
 *
 * @returns The rendered equipment metadata editor interface
 */
export function EquipmentMetadataEditor() {
  const [activeTab, setActiveTab] = useState<"catalog" | "categories">(
    "catalog"
  );
  const [searchTerm, setSearchTerm] = useState("");

  const categories = useQuery(api.admin.categories.getCategories, {
    includeInactive: true,
  }) as Category[] | undefined;
  const metadata = useQuery(
    api.admin.equipmentMetadata.getAllEquipmentMetadata,
    {
      includeInactive: true,
    }
  ) as EquipmentMetadata[] | undefined;

  const addCategory = useMutation(api.admin.categories.addCategory);
  const updateCategory = useMutation(api.admin.categories.updateCategory);
  const deleteCategory = useMutation(api.admin.categories.deleteCategory);

  const addMake = useMutation(api.admin.equipmentMetadata.addEquipmentMake);
  const updateMake = useMutation(
    api.admin.equipmentMetadata.updateEquipmentMake
  );
  const deleteMake = useMutation(
    api.admin.equipmentMetadata.deleteEquipmentMake
  );
  const addModel = useMutation(api.admin.equipmentMetadata.addModelToMake);
  const removeModel = useMutation(
    api.admin.equipmentMetadata.removeModelFromMake
  );

  if (categories === undefined || metadata === undefined) {
    return (
      <div className="h-64 flex items-center justify-center">
        <LoadingIndicator />
      </div>
    );
  }

  const filteredCategories = categories.filter((c: Category) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredMetadata = metadata.filter(
    (m: EquipmentMetadata) =>
      m.make.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.categoryName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.models.some((model: string) =>
        model.toLowerCase().includes(searchTerm.toLowerCase())
      )
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex bg-muted p-1 rounded-lg">
          <Button
            variant={activeTab === "catalog" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("catalog")}
            className="rounded-md"
          >
            <Hammer className="h-4 w-4 mr-2" />
            Equipment Catalog
          </Button>
          <Button
            variant={activeTab === "categories" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("categories")}
            className="rounded-md"
          >
            <LayoutGrid className="h-4 w-4 mr-2" />
            Categories
          </Button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {activeTab === "catalog" ? (
        <MetadataCatalog
          metadata={filteredMetadata}
          categories={categories.filter((c: Category) => c.isActive)}
          addMake={addMake}
          updateMake={updateMake}
          deleteMake={deleteMake}
          addModel={addModel}
          removeModel={removeModel}
        />
      ) : (
        <CategoryManager
          categories={filteredCategories}
          addCategory={addCategory}
          updateCategory={updateCategory}
          deleteCategory={deleteCategory}
        />
      )}
    </div>
  );
}
