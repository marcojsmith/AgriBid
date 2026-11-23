import { Label } from "@/components/ui/label";
import {
  PHOTO_ANGLES,
  PHOTO_ANGLE_LABELS,
  parsePhotoAngle,
  type PhotoAngle,
} from "@/lib/lotSpecs";

/** One uploaded photo that can be given an angle caption. */
export interface AnglePhoto {
  /** Image reference (storage id or URL) the angle is stored against. */
  ref: string;
  /** Human label shown next to the select. */
  label: string;
}

/** Props for {@link PhotoAngleList}. */
export interface PhotoAngleListProps {
  /** Uploaded photos. */
  photos: readonly AnglePhoto[];
  /** Current angle per image reference. */
  angles: Record<string, PhotoAngle> | undefined;
  /** Called when an angle is chosen (undefined clears it). */
  onChange: (ref: string, angle: PhotoAngle | undefined) => void;
}

/**
 * Lets a seller caption each uploaded photo with a shot from the fixed list
 * (Front, Rear, Left side, ... Serial plate).
 *
 * @param props - Component props
 * @param props.photos - Uploaded photos that can be captioned
 * @param props.angles - Current angle per image reference
 * @param props.onChange - Called when an angle is chosen or cleared
 * @returns The list of angle selects, or null when nothing is uploaded
 */
export function PhotoAngleList({
  photos,
  angles,
  onChange,
}: PhotoAngleListProps) {
  if (photos.length === 0) return null;

  return (
    <section aria-labelledby="photo-angles-heading" className="space-y-3">
      <h3 id="photo-angles-heading" className="text-sm font-semibold">
        Photo angles
      </h3>
      <ul className="space-y-2">
        {photos.map((photo) => (
          <li
            key={photo.ref}
            className="flex items-center justify-between gap-3"
          >
            <Label
              htmlFor={`angle-${photo.ref}`}
              className="min-w-0 truncate text-xs"
            >
              {`Angle for ${photo.label}`}
            </Label>
            <select
              id={`angle-${photo.ref}`}
              value={angles?.[photo.ref] ?? ""}
              onChange={(event) => {
                onChange(photo.ref, parsePhotoAngle(event.target.value));
              }}
              className="border-input bg-background h-9 w-40 shrink-0 rounded-md border px-2 text-base md:text-sm"
            >
              <option value="">Not set</option>
              {PHOTO_ANGLES.map((angle) => (
                <option key={angle} value={angle}>
                  {PHOTO_ANGLE_LABELS[angle]}
                  {angle === "serial_plate" ? " (optional)" : ""}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
    </section>
  );
}
