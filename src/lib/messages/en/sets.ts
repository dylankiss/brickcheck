// Start screen, My sets, Add a set (with the catalog search) and the join pages.
// Keys start with "sets.".
export const sets = {
  "sets.count": { one: "{count} set", other: "{count} sets" },
  "sets.groupCount": { one: "{count} group", other: "{count} groups" },
  "sets.pieces": { one: "{count} piece", other: "{count} pieces" },

  "sets.home.mySets": "My sets",
  "sets.home.groups": "Groups",
  "sets.home.missingCard": "Where does this piece go?",
  "sets.home.noSets": "No sets yet",
  "sets.home.allComplete": "{sets}, all complete",
  "sets.home.someIncomplete": "{sets}, {count} not complete",
  "sets.home.noGroups": "No groups yet",
  "sets.home.nothingMissing": "Nothing missing",
  "sets.home.missing": {
    one: "{count} piece missing in {sets}",
    other: "{count} pieces missing in {sets}",
  },

  "sets.my.title": "My sets",
  "sets.my.empty": "No sets yet. Add one and start checking.",
  "sets.my.group": "Group",
  "sets.my.allSets": "All sets",
  "sets.my.noGroup": "Not in a group",
  "sets.my.emptyGroup": "No sets in this group.",
  "sets.my.sharedWithYou": "shared with you",
  "sets.my.groupChip": "Group: {name}",
  "sets.my.add": "+ Add a set",

  "sets.search.label": "Search sets by number or name",
  "sets.search.placeholder": "Set number or name, e.g. 10305 or castle",
  "sets.search.noResults": "No sets found.",

  "sets.add.title": "Add a set",
  "sets.add.adding": "Adding set…",
  "sets.add.loadingParts": "Loading the parts list from Rebrickable…",
  "sets.add.change": "Change",
  "sets.add.name": "Name",
  "sets.add.nameHint":
    'Handy if you own several copies, e.g. "Castle – blue box".',
  "sets.add.group": "Group",
  "sets.add.noGroup": "None (only people you invite)",
  "sets.add.groupHint": "Everyone in the group gets access to this set.",
  "sets.add.minifigs": "Include minifigure parts",
  "sets.add.minifigsHint": "Heads, torsos, legs and accessories",
  "sets.add.spares": "Include spare parts",
  "sets.add.sparesHint": "Pieces LEGO adds on top of what the set needs",
  "sets.add.fixedOptions": "These two options can't be changed later.",
  "sets.add.start": "Start checking",

  "sets.join.title": "Join a set",
  "sets.join.someone": "Someone",
  "sets.join.invited": "{name} invited you to {role}.",
  "sets.join.role.helper": "tick off parts",
  "sets.join.role.viewer": "follow along",
  "sets.join.button": "Join",
  "sets.join.joining": "Joining…",
  "sets.join.invalid":
    "This invite link is invalid or has expired. Ask for a new one.",

  "sets.joinGroup.title": "Join a group",
  "sets.joinGroup.invited":
    "{name} invited you to join this group and {role} on all its sets.",
  "sets.joinGroup.checkFailed": "Could not check this invite link: {error}",
};
