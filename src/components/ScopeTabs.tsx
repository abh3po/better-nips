import type { Surface } from "../hooks/useNips";

const TABS: { id: Surface; label: string; hint: string }[] = [
  { id: "following", label: "Following", hint: "NIPs from people you follow" },
  { id: "web-of-trust", label: "Web of Trust", hint: "Follows of your follows" },
  { id: "global", label: "Global", hint: "Everyone" },
];

export function ScopeTabs({
  surface,
  onChange,
  disabled,
}: {
  surface: Surface;
  onChange: (s: Surface) => void;
  disabled?: Set<Surface>;
}) {
  return (
    <nav className="tabs" role="tablist">
      {TABS.map((t) => {
        const isDisabled = disabled?.has(t.id);
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={surface === t.id}
            className={`tab${surface === t.id ? " active" : ""}`}
            title={isDisabled ? "Connect a signer to use this surface" : t.hint}
            disabled={isDisabled}
            onClick={() => onChange(t.id)}
          >
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}
