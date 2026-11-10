// De setpagina, het onderdelenraster en de afbeeldingen, Ontbreekt, Ontbreekt
// in alle sets en Beheren. Sleutels beginnen met "set.".
export const set = {
  "set.count.pieces": { one: "{count} stukje", other: "{count} stukjes" },
  "set.count.parts": { one: "{count} onderdeel", other: "{count} onderdelen" },
  "set.count.sets": { one: "{count} set", other: "{count} sets" },

  "set.role.owner": "Eigenaar",
  "set.role.helper": "Helper",
  "set.role.viewer": "Kijker",
  "set.role.viaGroup": "{role} · groep",

  "set.loading": "Onderdelen laden…",
  "set.notFound.title": "Set niet gevonden",
  "set.notFound.text": "Deze set bestaat niet of is niet met je gedeeld.",
  "set.loadError": "Deze set kon niet worden geladen.",

  "set.manage": "Set beheren",
  "set.missingButton": "{count} te vinden",
  "set.viewOnly": "Je kunt deze set bekijken, maar niet wijzigen.",
  "set.allFound": "Alle stukjes gevonden! 🎉",
  "set.noMatch": "Geen onderdelen gevonden voor deze filter.",
  "set.updateOrder": "Volgorde bijwerken",
  "set.tick.added": "{number} · {color}: {found} van {needed} gevonden",
  "set.tick.undo": "Ongedaan maken",

  "set.filter.search": "Onderdelen zoeken",
  "set.filter.searchLabel": "Zoek onderdelen op naam, nummer of kleur",
  "set.filter.sortLabel": "Sorteren op",
  "set.filter.sortColor": "Kleur",
  "set.filter.sortPart": "Onderdeel",
  "set.filter.sortMissing": "Meest ontbrekend",
  "set.filter.hideFound": "Verberg gevonden",
  "set.filter.color": "Filteren op kleur",
  "set.filter.colorActive": "Filteren op kleur: {name}",

  "set.color.title": "Kies een kleur",
  "set.color.search": "Kleuren zoeken",
  "set.color.all": "Alle kleuren",
  "set.color.none": "Geen kleuren gevonden.",
  "set.color.close": "Sluiten",

  "set.part.tapLabel":
    "{label}: {found} van {needed} gevonden. Tik om er één toe te voegen.",
  "set.part.removeOne": "Eén {name} weghalen",
  "set.part.minifig": "minifig",
  "set.part.spare": "reserve",
  "set.picture.partDetail":
    "{color} · {number} · {found} van {needed} gevonden",
  "set.picture.enlarge": "Afbeelding van {label} vergroten",
  "set.picture.close": "Sluiten",
  "set.picture.zoomIn": "Inzoomen: {label}",
  "set.picture.zoomOut": "Uitzoomen: {label}",

  "set.missing.title": "Ontbreekt · {title}",
  "set.missing.complete": "Er ontbreekt niets. Deze set is compleet! 🎉",
  "set.missing.summary": "{pieces} in {parts} nog te vinden.",
  "set.missing.csv": "Rebrickable-CSV",
  "set.missing.bricklink": "BrickLink-verlanglijst",
  "set.missing.skipped": {
    one: "{count} onderdeel heeft geen BrickLink-id en staat niet in het BrickLink-bestand.",
    other:
      "{count} onderdelen hebben geen BrickLink-id en staan niet in het BrickLink-bestand.",
  },
  "set.missing.started": "{title} (gestart op {date})",

  "set.missingAll.title": "Ontbrekende onderdelen",
  "set.missingAll.none": "Er ontbreekt niets in je sets. 🎉",
  "set.missingAll.summary":
    "{pieces} in {parts} nog te vinden, verspreid over {sets}.",
  "set.missingAll.noMatch": "Geen ontbrekende onderdelen passen erbij.",
  "set.missingAll.needs": "× {count}",
  "set.missingAll.foundOne": "Eén gevonden",
  "set.missingAll.foundOneLabel": "Eén {part} gevonden voor {set}",

  "set.manage.title": "Beheren · {title}",
  "set.manage.copyError": "De link kon niet worden gekopieerd.",
  "set.manage.shareText": 'Help me "{title}" na te kijken in BrickCheck',
  "set.manage.deleteConfirm":
    'Wil je "{title}" voor iedereen verwijderen? De voortgang gaat verloren.',
  "set.manage.leaveConfirm":
    'Wil je "{title}" verlaten? Je kunt weer meedoen met een uitnodigingslink.',
  "set.manage.resetConfirm":
    'Wil je alle aantallen in "{title}" voor iedereen resetten naar nul? Dit kan niet ongedaan worden gemaakt.',
  "set.manage.reset": "Aantallen resetten",
  "set.manage.delete": "Set verwijderen",
  "set.manage.leave": "Set verlaten",
  "set.manage.viaGroupOnly":
    "Je hebt toegang tot deze set via de groep. Om die toegang kwijt te raken, verlaat je de groep op de ",
  "set.manage.groupsPage": "Groepenpagina",

  "set.rename.label": "Naam",
  "set.rename.hint":
    "Wat iedereen op deze set ziet. Eigenaars en helpers kunnen hem wijzigen.",
  "set.rename.save": "Opslaan",
  "set.rename.saving": "Opslaan…",
  "set.rename.saved": "Opgeslagen",

  "set.invite.title": "Mensen uitnodigen",
  "set.invite.hint":
    "Stuur een link. Iedereen die de link opent en inlogt, doet mee met deze set. Links verlopen na 7 dagen.",
  "set.invite.helpers": "Helpers uitnodigen",
  "set.invite.viewers": "Kijkers uitnodigen",
  "set.invite.linkHelper": "Helperlink · verloopt op {date}",
  "set.invite.linkViewer": "Kijkerlink · verloopt op {date}",
  "set.invite.share": "Delen",
  "set.invite.copied": "Gekopieerd!",
  "set.invite.revoke": "Intrekken",

  "set.group.title": "Groep",
  "set.group.inNamed":
    'Deze set zit in "{name}". Iedereen in de groep heeft er toegang toe.',
  "set.group.inUnnamed":
    "Deze set zit in een groep. Iedereen in de groep heeft er toegang toe.",
  "set.group.moveOut": "Uit de groep halen",
  "set.group.moveOutConfirm":
    'Wil je "{title}" uit {group} halen? Mensen die alleen via de groep toegang hebben, verliezen die. Leden die aan deze set zijn toegevoegd, houden hun rol.',
  "set.group.itsGroup": "de groep",
  "set.group.moveInHint":
    "Zet deze set in een groep om hem te delen met iedereen in die groep.",
  "set.group.pickLabel": "Groep waarin je deze set zet",
  "set.group.pick": "Kies een groep",
  "set.group.moveIn": "In de groep zetten",
  "set.group.viaTitleNamed": 'Via de groep "{name}"',
  "set.group.viaTitle": "Via de groep",
  "set.group.viaHint":
    "Deze mensen hebben toegang tot deze set omdat ze in de groep zitten, met hun rol daarin. Beheer ze op de groepenpagina.",

  "set.members.title": "Leden",
  "set.members.unnamed": "Naamloze bouwer",
  "set.members.you": "(jij)",
  "set.members.roleOf": "Rol van {name}",
  "set.members.member": "lid",
  "set.members.thisMember": "dit lid",
  "set.members.remove": "Verwijderen",
  "set.members.removeConfirm":
    "Wil je {name} verwijderen? Links die je eerder hebt gestuurd, laten die persoon niet meer binnen.",
};
