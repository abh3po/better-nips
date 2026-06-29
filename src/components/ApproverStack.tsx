import { useMemo, useState } from "react";
import { npubEncode } from "nostr-tools/nip19";
import type { Profile } from "../hooks/useNips";
import { ApproverList } from "./ApproverList";
import { ProfileLink } from "./ProfileLink";

function label(pubkey: string, profile?: Profile): string {
  if (profile?.name) return profile.name;
  try {
    return `${npubEncode(pubkey).slice(0, 12)}…`;
  } catch {
    return pubkey.slice(0, 12);
  }
}

/** Sort the most meaningful endorsers first so their avatars lead the stack. */
function rankByTrust(
  pubkeys: string[],
  me: string,
  followSet: Set<string>,
  webOfTrust: Set<string>,
): string[] {
  const tier = (pk: string) =>
    pk === me ? 0 : followSet.has(pk) ? 1 : webOfTrust.has(pk) ? 2 : 3;
  return [...pubkeys].sort((a, b) => tier(a) - tier(b));
}

function AvatarRow({
  pubkeys,
  profiles,
  max = 6,
}: {
  pubkeys: string[];
  profiles: Map<string, Profile>;
  max?: number;
}) {
  const shown = pubkeys.slice(0, max);
  const extra = pubkeys.length - shown.length;
  return (
    <span className="avatar-stack">
      {shown.map((pk) => {
        const p = profiles.get(pk);
        return (
          <ProfileLink key={pk} pubkey={pk} title={label(pk, p)}>
            {p?.picture ? (
              <img className="avatar xs" src={p.picture} alt="" />
            ) : (
              <span className="avatar xs placeholder" />
            )}
          </ProfileLink>
        );
      })}
      {extra > 0 && <span className="avatar xs count-bubble">+{extra}</span>}
    </span>
  );
}

/**
 * Trust-ranked, overlapping-avatar summary of who has weighed in on a NIP —
 * approvers and (when present) disapprovers. Sits at the top of a NIP, above
 * the body. Expands to the full tiered lists on click.
 */
export function ApproverStack({
  approvers,
  disapprovers,
  profiles,
  follows,
  webOfTrust,
  me,
}: {
  approvers: string[];
  disapprovers: string[];
  profiles: Map<string, Profile>;
  follows: string[];
  webOfTrust: Set<string>;
  me: string;
}) {
  const [open, setOpen] = useState(false);
  const followSet = useMemo(() => new Set(follows), [follows]);

  const rankedApprovers = useMemo(
    () => rankByTrust(approvers, me, followSet, webOfTrust),
    [approvers, me, followSet, webOfTrust],
  );
  const rankedDisapprovers = useMemo(
    () => rankByTrust(disapprovers, me, followSet, webOfTrust),
    [disapprovers, me, followSet, webOfTrust],
  );

  if (approvers.length === 0 && disapprovers.length === 0) return null;

  const expandable = approvers.length + disapprovers.length > 0;

  return (
    <div className="verdict-stack">
      <button
        type="button"
        className="verdict-summary"
        onClick={() => expandable && setOpen((o) => !o)}
        aria-expanded={open}
      >
        {approvers.length > 0 && (
          <span className="verdict-group approve">
            <AvatarRow pubkeys={rankedApprovers} profiles={profiles} />
            <span className="verdict-count">
              {approvers.length} approved
            </span>
          </span>
        )}
        {disapprovers.length > 0 && (
          <span className="verdict-group disapprove">
            <AvatarRow pubkeys={rankedDisapprovers} profiles={profiles} />
            <span className="verdict-count">
              {disapprovers.length} disapproved
            </span>
          </span>
        )}
        {expandable && (
          <span className="verdict-toggle">{open ? "Hide" : "Details"}</span>
        )}
      </button>

      {open && (
        <div className="verdict-detail">
          {approvers.length > 0 && (
            <ApproverList
              approvers={rankedApprovers}
              profiles={profiles}
              follows={follows}
              webOfTrust={webOfTrust}
              me={me}
            />
          )}
          {disapprovers.length > 0 && (
            <ApproverList
              approvers={rankedDisapprovers}
              profiles={profiles}
              follows={follows}
              webOfTrust={webOfTrust}
              me={me}
              title={`Disapproved by ${disapprovers.length} ${
                disapprovers.length === 1 ? "person" : "people"
              }`}
            />
          )}
        </div>
      )}
    </div>
  );
}
