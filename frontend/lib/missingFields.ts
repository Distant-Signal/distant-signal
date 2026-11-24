/** "Fill in From and To." for the fields a form still needs, or `null` when
 * none is missing. The sentence a blocked submit button is described by
 * (`GatedButton`), so a screen reader user hears what is missing. */
export function missingFieldsReason(fields: readonly string[]): string | null {
  if (fields.length === 0) return null;
  const list =
    fields.length === 1
      ? (fields[0] ?? '')
      : `${fields.slice(0, -1).join(', ')} and ${fields[fields.length - 1] ?? ''}`;
  return `Fill in ${list}.`;
}
