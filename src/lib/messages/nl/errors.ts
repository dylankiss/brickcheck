// Foutmeldingen van de server en van lib/api.ts, in dezelfde volgorde als en/errors.ts.
export const errors = {
  // Database
  "errors.notLoggedIn": "Je bent niet ingelogd.",
  "errors.inviteInvalid": "Deze uitnodigingslink is ongeldig of verlopen.",
  "errors.groupFull": "Een groep kan maximaal 20 leden hebben.",
  "errors.groupLimit": "Je kunt maximaal 10 groepen maken.",
  "errors.resetOwnerOnly": "Alleen de eigenaar kan deze set resetten.",
  "errors.importInvalid": "Ongeldige importgegevens",
  "errors.noCachedInventory":
    "De set {setNum} heeft nog geen onderdelenlijst in de cache.",
  "errors.deltaInvalid": "Ongeldige wijziging",
  "errors.editNotAllowed": "Je mag deze set niet bewerken.",
  "errors.partNotInSet":
    "Onderdeel {partNum}/{colorId} hoort niet bij deze set.",
  "errors.groupAddSetsRole":
    "Alleen een eigenaar of helper van de groep kan er sets aan toevoegen.",
  "errors.setMoveOwnerOnly":
    "Alleen een eigenaar van de set kan hem verplaatsen.",
  "errors.setAlreadyInGroup":
    "De set zit al in een groep. Haal hem eerst uit die groep.",
  "errors.groupNeedsOwner":
    "Een groep heeft minstens één eigenaar nodig. Maak eerst een ander lid eigenaar.",
  "errors.groupHasSets":
    "Een groep met sets kun je niet verwijderen. Verplaats of verwijder eerst de sets.",

  // Edge Functions
  "errors.methodNotAllowed": "Methode niet toegestaan",
  "errors.setNumberInvalid": "Ongeldig setnummer",
  "errors.setUnknown": "Onbekende set",
  "errors.setNotOnRebrickable": "Set niet gevonden op Rebrickable",
  "errors.noInventory": "Rebrickable heeft geen onderdelenlijst voor deze set.",
  "errors.importRateLimited":
    "Er zijn te veel nieuwe sets geïmporteerd. Probeer het over een uur opnieuw.",
  "errors.importInProgress":
    "Deze set wordt nu geïmporteerd. Probeer het over een minuut opnieuw.",
  "errors.importBusy":
    "Er worden nu veel nieuwe sets toegevoegd. Probeer het later opnieuw.",
  "errors.importTooSlow":
    "Het importeren van deze set duurt te lang. Probeer het over een paar minuten opnieuw.",
  "errors.rebrickableSlow":
    "Rebrickable is nu traag. Probeer het over een minuut opnieuw.",
  "errors.rebrickableDown":
    "Rebrickable is niet beschikbaar. Probeer het later opnieuw.",
  "errors.rebrickableKey": "Rebrickable heeft de API-sleutel geweigerd.",
  "errors.internal": "Interne fout",

  // De app zelf
  "errors.generic": "Er ging iets mis.",
  "errors.setLoadFailed": "De set kon niet worden geladen.",
  "errors.slowConnection":
    "De verbinding is traag. Die tik is niet opgeslagen.",
  "errors.groupRenameOwnerOnly": "Alleen een eigenaar kan de groep hernoemen.",
  "errors.groupRolesOwnerOnly": "Alleen een eigenaar kan rollen wijzigen.",
  "errors.groupRemoveOwnerOnly": "Alleen een eigenaar kan leden verwijderen.",
  "errors.notInGroup": "Je zit niet in deze groep.",
  "errors.groupDeleteOwnerOnly":
    "Alleen een eigenaar kan de groep verwijderen.",
};
