import { PLAYER_EMAIL_DOMAIN } from "../data/config.js";
import { $, openDialog, closeDialog, friendlyError } from "./lib.js";

const NAME_RE = /^[A-Za-z0-9_]{3,16}$/;
const listeners = new Set();
const state = { client: null, session: null, profile: null };

export const account = {
  get user() { return state.session?.user ?? null; },
  get profile() { return state.profile; },
  get signedIn() { return Boolean(state.session); },
  /** Player with a profile that is not banned: may post, report and vote. */
  get canPost() { return Boolean(state.profile && !state.profile.is_banned); },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  /** Opens the sign-in dialog when needed; returns true if the player can act now. */
  require(message) {
    if (account.canPost) return true;
    if (state.profile?.is_banned) {
      alert("Tài khoản của bạn đang bị khóa. Liên hệ admin nếu có nhầm lẫn.");
      return false;
    }
    showAccount(message || "Đăng nhập hoặc tạo tài khoản để tiếp tục nhé.");
    return false;
  },
};

const toEmail = (name) => `${name.trim().toLowerCase()}@${PLAYER_EMAIL_DOMAIN}`;

async function loadProfile() {
  state.profile = null;
  if (state.client && state.session) {
    const { data } = await state.client.from("profiles")
      .select("id,username,is_banned").eq("id", state.session.user.id).maybeSingle();
    state.profile = data || null;
  }
  renderButton();
  listeners.forEach((fn) => fn(account));
}

function renderButton() {
  const button = $("accountButton");
  button.textContent = state.profile ? state.profile.username : state.session ? "Tài khoản" : "Đăng nhập";
  $("accountSignedOut").classList.toggle("hide", Boolean(state.session));
  $("accountSignedIn").classList.toggle("hide", !state.session);
  $("accountName").textContent = state.profile?.username || state.session?.user?.email || "";
}

let mode = "login";
function setMode(next) {
  mode = next;
  $("tabLogin").setAttribute("aria-pressed", String(mode === "login"));
  $("tabLogin").setAttribute("aria-selected", String(mode === "login"));
  $("tabRegister").setAttribute("aria-pressed", String(mode === "register"));
  $("tabRegister").setAttribute("aria-selected", String(mode === "register"));
  $("accPass2Field").classList.toggle("hide", mode === "login");
  $("accPass").autocomplete = mode === "login" ? "current-password" : "new-password";
  $("accountSubmit").textContent = mode === "login" ? "Đăng nhập" : "Tạo tài khoản";
  $("accountStatus").textContent = "";
}

function showAccount(message) {
  setMode("login");
  openDialog("accountDialog");
  if (message) $("accountStatus").textContent = message;
  if (!state.session) $("accName").focus();
}

export function initAccount(client) {
  state.client = client;
  $("accountButton").addEventListener("click", () => showAccount());
  $("tabLogin").addEventListener("click", () => setMode("login"));
  $("tabRegister").addEventListener("click", () => setMode("register"));
  for (const id of ["accName", "accPass", "accPass2"]) {
    $(id).addEventListener("input", () => $(id).removeAttribute("aria-invalid"));
  }

  $("accountForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = $("accName").value.trim();
    const pass = $("accPass").value;
    const fail = (text, field) => {
      $("accountStatus").textContent = text;
      if (field) { field.setAttribute("aria-invalid", "true"); field.focus(); }
    };
    if (!state.client) return fail("Chưa kết nối được máy chủ dữ liệu.");
    if (!NAME_RE.test(name)) return fail("Tên Minecraft cần 3 đến 16 ký tự: chữ, số hoặc dấu gạch dưới.", $("accName"));
    if (pass.length < 8) return fail("Mật khẩu cần ít nhất 8 ký tự.", $("accPass"));
    if (mode === "register" && pass !== $("accPass2").value) return fail("Hai mật khẩu chưa giống nhau.", $("accPass2"));

    const button = $("accountSubmit");
    button.disabled = true;
    $("accountStatus").textContent = mode === "login" ? "Đang đăng nhập…" : "Đang tạo tài khoản…";
    try {
      if (mode === "register") {
        const { data, error } = await state.client.auth.signUp({
          email: toEmail(name), password: pass, options: { data: { username: name } },
        });
        if (error) return fail(friendlyError(error));
        // With "Confirm email" ON, Supabase returns no session and the fake address gets no mail.
        if (!data.session) return fail("Đã tạo tài khoản nhưng chưa dùng được: admin cần tắt \"Confirm email\" trong Supabase.");
      } else {
        const { error } = await state.client.auth.signInWithPassword({ email: toEmail(name), password: pass });
        if (error) return fail(friendlyError(error), $("accPass"));
      }
      $("accountForm").reset();
      closeDialog("accountDialog");
    } catch (error) {
      fail(friendlyError(error));
    } finally {
      button.disabled = false;
    }
  });

  $("signOut").addEventListener("click", async () => {
    await state.client?.auth.signOut();
    closeDialog("accountDialog");
  });

  if (!client) { renderButton(); return; }
  client.auth.getSession().then(({ data }) => { state.session = data.session; loadProfile(); });
  // Defer: calling Supabase inside this callback can deadlock the auth client.
  client.auth.onAuthStateChange((_event, session) => {
    state.session = session;
    setTimeout(loadProfile, 0);
  });
}
