// Public Supabase project settings. Never put service_role or secret keys here.
export const SUPABASE = {
  url: "https://rytcmsndgwyeoqikesgz.supabase.co",
  anonKey: "sb_publishable_kyzBo9X_E-ZuSZ_2o-gIog_7KyMt2ZQ",
};

// Players sign in with "Minecraft name + password". Supabase Auth needs an email, so the
// name is turned into "<name>@<this domain>". ".invalid" is a reserved TLD that can never
// receive mail. Requires "Confirm email" to be OFF in Supabase (see HUONG-DAN.md).
export const PLAYER_EMAIL_DOMAIN = "players.equalsurvival.invalid";

// Gallery storage bucket created by supabase-v2.sql.
export const GALLERY_BUCKET = "gallery";

// Public server status service (only receives the public server address).
export const STATUS_API = "https://api.mcsrvstat.us/3/";

// Player heads for leaderboards, by Minecraft name. Set to "" to show plain blocks instead.
export const AVATAR_URL = "https://mc-heads.net/avatar/{name}/64";
