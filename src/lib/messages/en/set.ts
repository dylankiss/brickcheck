// The Set page, its part grid and pictures, Missing, Missing in all sets and
// Manage. Keys start with "set.".
export const set = {
  // Counts shared by the Missing pages
  "set.count.pieces": { one: "{count} piece", other: "{count} pieces" },
  "set.count.parts": { one: "{count} part", other: "{count} parts" },
  "set.count.sets": { one: "{count} set", other: "{count} sets" },

  "set.role.owner": "Owner",
  "set.role.helper": "Helper",
  "set.role.viewer": "Viewer",
  "set.role.viaGroup": "{role} · group",

  // Loading and errors of the set screens
  "set.loading": "Loading parts…",
  "set.notFound.title": "Set not found",
  "set.notFound.text": "This set doesn't exist or isn't shared with you.",
  "set.loadError": "Could not load this set.",

  // The Set page
  "set.manage": "Manage set",
  "set.missingButton": "Missing {count}",
  "set.viewOnly": "You can view this set but not change it.",
  "set.allFound": "All pieces found! 🎉",
  "set.noMatch": "No parts match the filter.",
  "set.refreshList": "Refresh list",
  "set.tick.added": "{number} · {color}: {found} of {needed} found",
  "set.tick.undo": "Undo",

  // Filter bar
  "set.filter.search": "Search parts",
  "set.filter.searchLabel": "Search parts by name, number or color",
  "set.filter.sortLabel": "Sort by",
  "set.filter.sortColor": "Color",
  "set.filter.sortPart": "Part",
  "set.filter.sortMissing": "Most missing",
  "set.filter.hideFound": "Hide found",
  "set.filter.color": "Filter by color",
  "set.filter.colorActive": "Filter by color: {name}",

  // Color picker
  "set.color.title": "Choose a color",
  "set.color.search": "Search colors",
  "set.color.all": "All colors",
  "set.color.none": "No colors match.",
  "set.color.close": "Close",

  // Part card and pictures
  "set.part.tapLabel": "{label}: {found} of {needed} found. Tap to add one.",
  "set.part.removeOne": "Remove one {name}",
  "set.part.minifig": "minifig",
  "set.part.spare": "spare",
  "set.picture.partDetail": "{color} · {number} · {found} of {needed} found",
  "set.part.details": "Details of {label}",
  "set.part.addOne": "Add one {name}",
  "set.part.foundAll": "Found all ({count})",
  "set.hint.longPress":
    "Press and hold a part to see it larger or tick off several at once.",
  "set.hint.dismiss": "Got it",
  "set.picture.enlarge": "Enlarge picture of {label}",
  "set.picture.close": "Close",
  "set.picture.closePicture": "Close picture of {label}",

  // Missing
  "set.missing.title": "Missing · {title}",
  "set.missing.complete": "Nothing is missing. This set is complete! 🎉",
  "set.missing.summary": "{pieces} in {parts} still to find.",
  "set.missing.csv": "Rebrickable CSV",
  "set.missing.bricklink": "BrickLink wanted list",
  "set.missing.skipped": {
    one: "{count} part has no BrickLink id and is left out of the BrickLink file.",
    other:
      "{count} parts have no BrickLink id and are left out of the BrickLink file.",
  },
  // The label of a set whose title another set shares
  "set.missing.started": "{title} (started {date})",

  // Missing in all sets
  "set.missingAll.title": "Missing in all sets",
  "set.missingAll.none": "Nothing is missing in any of your sets. 🎉",
  "set.missingAll.summary": "{pieces} in {parts} still to find, across {sets}.",
  "set.missingAll.noMatch": "No missing parts match.",
  "set.missingAll.needs": "× {count}",
  "set.missingAll.foundOne": "Found one",
  "set.missingAll.foundOneLabel": "Found one {part} for {set}",

  // Manage
  "set.manage.title": "Manage · {title}",
  "set.manage.copyError": "Could not copy the link.",
  "set.manage.shareText": 'Help me check "{title}" in BrickCheck',
  "set.manage.deleteConfirm":
    'Delete "{title}" for everyone? Progress is lost.',
  "set.manage.leaveConfirm":
    'Leave "{title}"? You can rejoin with an invite link.',
  "set.manage.resetConfirm":
    'Reset all counts in "{title}" to zero for everyone? This can\'t be undone.',
  "set.manage.reset": "Reset counts",
  "set.manage.delete": "Delete set",
  "set.manage.leave": "Leave set",
  "set.manage.viaGroupOnly":
    "You have access to this set through its group. To lose it, leave the group on the ",
  "set.manage.groupsPage": "Groups page",

  "set.rename.label": "Name",
  "set.rename.hint":
    "What everyone on this set sees. Owners and helpers can change it.",
  "set.rename.save": "Save",
  "set.rename.saving": "Saving…",
  "set.rename.saved": "Saved",

  "set.invite.title": "Invite people",
  "set.invite.hint":
    "Send a link. Anyone who opens it and logs in joins this set. Links expire after 7 days.",
  "set.invite.helpers": "Invite helpers",
  "set.invite.viewers": "Invite viewers",
  "set.invite.linkHelper": "Helper link · expires {date}",
  "set.invite.linkViewer": "Viewer link · expires {date}",
  "set.invite.share": "Share",
  "set.invite.copied": "Copied!",
  "set.invite.revoke": "Revoke",

  "set.group.title": "Group",
  "set.group.inNamed":
    'This set is in "{name}". Everyone in the group has access to it.',
  "set.group.inUnnamed":
    "This set is in a group. Everyone in the group has access to it.",
  "set.group.moveOut": "Move out of group",
  "set.group.moveOutConfirm":
    'Move "{title}" out of {group}? People who have access only through the group lose it. Members added to this set keep their roles.',
  "set.group.itsGroup": "its group",
  "set.group.moveInHint":
    "Put this set in a group to share it with everyone in it.",
  "set.group.pickLabel": "Group to move this set into",
  "set.group.pick": "Choose a group",
  "set.group.moveIn": "Move in",
  "set.group.viaTitleNamed": 'Through the group "{name}"',
  "set.group.viaTitle": "Through the group",
  "set.group.viaHint":
    "These people have access to this set because they are in the group, with their role in it. Manage them on the Groups page.",

  "set.members.title": "Members",
  "set.members.unnamed": "Unnamed builder",
  "set.members.you": "(you)",
  "set.members.roleOf": "Role of {name}",
  "set.members.member": "member",
  "set.members.thisMember": "this member",
  "set.members.remove": "Remove",
  "set.members.removeConfirm":
    "Remove {name}? Links you sent before won't let them back in.",
};
