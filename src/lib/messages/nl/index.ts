// Dutch, informal "je". One chunk: the app loads this file on demand. The type
// makes it fail to compile when a key of English has no Dutch text.
import type { Messages } from "../../i18n";
import { account } from "./account";
import { common } from "./common";
import { errors } from "./errors";
import { groups } from "./groups";
import { login } from "./login";
import { sets } from "./sets";
import { set } from "./set";

export const nl: Messages = {
  ...common,
  ...account,
  ...login,
  ...sets,
  ...set,
  ...groups,
  ...errors,
};
