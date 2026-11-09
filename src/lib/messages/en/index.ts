// English, the source language: every key of the app is defined here. One file
// per area, so tickets that translate different screens do not touch the same
// lines. To add an area: create en/<area>.ts and nl/<area>.ts, then add one
// import and one spread line here and in nl/index.ts.
import { account } from "./account";
import { common } from "./common";
import { errors } from "./errors";
import { groups } from "./groups";
import { login } from "./login";
import { sets } from "./sets";
import { set } from "./set";

export const en = {
  ...common,
  ...account,
  ...login,
  ...sets,
  ...set,
  ...groups,
  ...errors,
};
