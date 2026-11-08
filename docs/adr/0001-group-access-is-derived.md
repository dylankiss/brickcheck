# Group access is derived from Group membership

A person in a Group has access to every Set in it because of that membership, worked out when access is checked. We do not copy Group members into each Set's own member list. Leaving a Group, being removed, or moving a Set out of a Group then takes effect at once, with no fan-out writes to keep in sync.

## Considered Options

- **Copy members into each Set on join and on adding a Set.** Membership checks stay unchanged, but every Group change must rewrite many rows, and a missed update leaves someone with stale access.

## Consequences

Every membership check, policy and broadcast channel rule must also consider Groups. When someone has both a per-Set role and a Group role, the higher one wins.
