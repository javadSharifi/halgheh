/**
 * The glass switch used by Settings and by the Rulebook sheets. One component, so every switch in the app looks and
 * behaves the same and the accessibility attributes cannot drift apart.
 */
export function Toggle({ on, label, onChange }: { on: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button className="switch" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}>
      <i />
    </button>
  );
}
