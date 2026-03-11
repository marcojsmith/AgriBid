import { AdminLayout } from "@/components/admin/AdminLayout";
import { EquipmentMetadataEditor } from "@/components/admin";

/**
 * Admin page for managing the equipment catalog, including makes, models, and categories.
 *
 * @returns The AdminEquipmentCatalog page component.
 */
export default function AdminEquipmentCatalog() {
  return (
    <AdminLayout
      title="Equipment Catalog"
      subtitle="Manage manufacturer makes, models, and machinery categories."
    >
      <EquipmentMetadataEditor />
    </AdminLayout>
  );
}
