import { useRelayStatus } from "../hooks/useRelayStatus";

export function OnlineDot() {
  const { online, connected, relays } = useRelayStatus();
  const label = online
    ? `Online · ${connected}/${relays.length} relays`
    : "Connecting…";
  return (
    <span
      className={`status-dot${online ? " on" : ""}`}
      title={label}
      aria-label={label}
    />
  );
}
