import { PLAYER_EMAIL_DOMAIN } from "../data/config.js";

// Website identity is independent of the Minecraft character receiving BP.
export const LOGIN_NAME = /^[A-Za-z0-9_]{3,16}$/;
export const GAME_NAME = /^\.?[A-Za-z0-9_]{3,16}$/;
export const loginEmail = (name) => `${name.trim().toLowerCase()}@${PLAYER_EMAIL_DOMAIN}`;
