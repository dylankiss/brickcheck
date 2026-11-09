// Texts of this area (keys start with "errors."). Each text is a message the
// server or lib/api.ts raises, with a full stop at the end (the server leaves it
// off, and lib/errors.ts ignores it when matching): lib/errors.ts matches a
// message on it and shows the Dutch text of the same key. A {placeholder}
// stands for a value in the message (the database writes it as %).
// lib/errors.test.ts keeps this list in step with the migrations and the Edge
// Functions.
export const errors = {
  // Database (supabase/migrations)
  "errors.notLoggedIn": "Not logged in",
  "errors.inviteInvalid": "This invite link is invalid or has expired.",
  "errors.groupFull": "A group can have at most 20 members.",
  "errors.groupLimit": "You can create at most 10 groups.",
  "errors.resetOwnerOnly": "Only the owner can reset this set.",
  "errors.importInvalid": "Invalid import payload",
  "errors.noCachedInventory":
    "Catalog set {setNum} has no cached inventory yet.",
  "errors.deltaInvalid": "Invalid delta",
  "errors.editNotAllowed": "Not allowed to edit this set",
  "errors.partNotInSet": "Part {partNum}/{colorId} is not part of this set.",
  "errors.groupAddSetsRole":
    "Only an owner or helper of the group can add sets to it.",
  "errors.setMoveOwnerOnly": "Only an owner of the set can move it.",
  "errors.setAlreadyInGroup":
    "The set is already in a group; move it out first.",
  "errors.groupNeedsOwner":
    "A group needs at least one owner. Promote another member to owner first.",
  "errors.groupHasSets":
    "A group with sets cannot be deleted. Move or delete its sets first.",

  // Edge Functions (supabase/functions)
  "errors.methodNotAllowed": "Method not allowed",
  "errors.setNumberInvalid": "Invalid set number",
  "errors.setUnknown": "Unknown set",
  "errors.setNotOnRebrickable": "Set not found on Rebrickable",
  "errors.noInventory": "Rebrickable has no inventory for this set.",
  "errors.importRateLimited":
    "Too many new sets imported, try again in an hour.",
  "errors.importInProgress":
    "This set is being imported right now, try again in a minute.",
  "errors.importBusy":
    "Many new sets are being added right now, try again later.",
  "errors.importTooSlow":
    "Importing this set is taking too long, try again in a few minutes.",
  "errors.rebrickableSlow":
    "Rebrickable is slow right now, try again in a minute.",
  "errors.rebrickableDown": "Rebrickable is unavailable, try again later.",
  "errors.rebrickableKey": "Rebrickable rejected the API key.",
  "errors.internal": "Internal error",

  // The client (lib/api.ts, lib/errors.ts)
  "errors.generic": "Something went wrong.",
  "errors.setLoadFailed": "Could not load the set.",
  "errors.slowConnection": "The connection is slow; that tap was not saved.",
  "errors.groupRenameOwnerOnly": "Only an owner can rename the group.",
  "errors.groupRolesOwnerOnly": "Only an owner can change roles.",
  "errors.groupRemoveOwnerOnly": "Only an owner can remove members.",
  "errors.notInGroup": "You are not in this group.",
  "errors.groupDeleteOwnerOnly": "Only an owner can delete the group.",
};
