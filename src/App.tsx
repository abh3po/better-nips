import { useMemo, useState } from "react";
import { LoginBar } from "./components/LoginBar";
import { ScopeTabs } from "./components/ScopeTabs";
import { NipFeed } from "./components/NipFeed";
import { useSigner } from "./hooks/useSigner";
import { useFollows, useWebOfTrust, type Surface } from "./hooks/useNips";

export default function App() {
  const { pubkey } = useSigner();
  const [surface, setSurface] = useState<Surface>("following");

  const follows = useFollows(pubkey);
  const webOfTrust = useWebOfTrust(follows);

  // Trust-scoped surfaces need a logged-in user with follows.
  const disabled = useMemo(() => {
    const set = new Set<Surface>();
    if (!pubkey || follows.length === 0) {
      set.add("following");
      set.add("web-of-trust");
    }
    return set;
  }, [pubkey, follows.length]);

  // Fall back to Global when the active surface is unavailable.
  const effective: Surface = disabled.has(surface) ? "global" : surface;

  return (
    <div className="app">
      <LoginBar />
      <main className="content">
        <ScopeTabs
          surface={effective}
          onChange={setSurface}
          disabled={disabled}
        />
        <NipFeed
          surface={effective}
          pubkey={pubkey}
          follows={follows}
          webOfTrust={webOfTrust}
        />
      </main>
    </div>
  );
}
