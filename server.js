(() => {
  "use strict";

  const data = window.SERVER_INFO || {};
  const byId = (id) => document.getElementById(id);
  const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
  const javaAddress = String(data.ip || "").trim();
  const javaPort = Number(data.port || 25565);
  const javaJoinAddress = javaAddress && javaPort !== 25565 ? `${javaAddress}:${javaPort}` : javaAddress;
  const bedrockAddress = String(data.bedrockIp || data.ip || "").trim();
  const bedrockPort = Number(data.bedrockPort || 19101);
  const bedrockJoinAddress = bedrockAddress ? `${bedrockAddress}:${bedrockPort}` : "Chưa xác minh";

  byId("serverIP").textContent = javaJoinAddress || "Chưa cập nhật";
  byId("serverVersion").textContent = data.version || "Chưa xác minh";
  byId("serverStatus").textContent = data.status || "Chưa kiểm tra trực tuyến";
  byId("bedrockAddress").textContent = bedrockJoinAddress;
  byId("serverDescription").textContent = data.description || "Thông tin máy chủ đang được cập nhật.";

  function bindCopy(button, value, idleLabel) {
    if (!button) return;
    button.disabled = !value;
    button.addEventListener("click", async () => {
      if (!value) return;
      try {
        await navigator.clipboard.writeText(value);
        button.textContent = "Đã sao chép";
      } catch {
        button.textContent = "Không sao chép được";
      }
      window.setTimeout(() => {
        button.textContent = idleLabel;
      }, 1800);
    });
  }

  bindCopy(byId("copyIP"), javaJoinAddress, "Sao chép địa chỉ");
  bindCopy(byId("copyBedrock"), bedrockAddress ? bedrockJoinAddress : "", "Sao chép Bedrock");

  const renderHighlights = (items) => (Array.isArray(items) ? items : []).map((item) =>
    `<article class="highlight-item"><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.description)}</p></article>`
  ).join("");
  byId("serverHighlights").innerHTML = renderHighlights(data.highlights);

  const renderPlugins = (items) => (Array.isArray(items) ? items : []).map((plugin) => {
    const reference = /^https:\/\//.test(String(plugin.reference || ""))
      ? `<a href="${escapeHTML(plugin.reference)}" target="_blank" rel="noreferrer">${escapeHTML(plugin.name)}</a>`
      : escapeHTML(plugin.name);
    return `<article class="plugin-item"><h3>${reference}</h3><span class="plugin-version">${escapeHTML(plugin.version ? `v${plugin.version}` : "Có trong log")}</span><p>${escapeHTML(plugin.description)}</p></article>`;
  }).join("");
  byId("serverPlugins").innerHTML = renderPlugins(data.plugins) || "<p>Chưa có plugin nào được đối chiếu.</p>";

  const commands = Array.isArray(data.commands) ? data.commands : [];
  const commandTarget = byId("serverCommands");
  const commandSearch = byId("commandSearch");
  const commandCategory = byId("commandCategory");
  const commandParams = new URLSearchParams(window.location.search);
  const commandCategories = new Set(["all", "Di chuyển", "Nhà", "Bảo vệ đất", "Tương tác"]);
  commandSearch.value = commandParams.get("cmd") || "";
  commandCategory.value = commandCategories.has(commandParams.get("cmdGroup")) ? commandParams.get("cmdGroup") : "all";

  function saveCommandFilter(key, value, initial) {
    const url = new URL(window.location.href);
    if (value && value !== initial) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
    window.history.replaceState(null, "", url);
  }

  function renderCommands() {
    const query = String(commandSearch.value || "").trim().toLocaleLowerCase("vi");
    const category = commandCategory.value;
    const matches = commands.filter((command) => {
      const text = [command.command, command.description, command.plugin, command.category].join(" ").toLocaleLowerCase("vi");
      return (!query || text.includes(query)) && (category === "all" || command.category === category);
    });

    commandTarget.innerHTML = matches.length
      ? matches.map((command) => {
        const reference = /^https:\/\//.test(String(command.reference || ""))
          ? `<a class="command-meta" href="${escapeHTML(command.reference)}" target="_blank" rel="noreferrer">${escapeHTML(command.plugin)}: ${escapeHTML(command.note || "Xem quyền plugin")}</a>`
          : `<span class="command-meta">${escapeHTML(command.plugin)}: ${escapeHTML(command.note || "")}</span>`;
        return `<article class="command-row"><div class="command-main"><div><code>${escapeHTML(command.command)}</code>${reference}</div><p>${escapeHTML(command.description)}</p></div><button class="command-copy" type="button" data-copy-command="${escapeHTML(command.command)}">Sao chép</button></article>`;
      }).join("")
      : `<p class="table-message">Không tìm thấy lệnh phù hợp. Hãy xóa từ khóa hoặc chọn nhóm khác.</p>`;
  }

  commandSearch.addEventListener("input", () => {
    saveCommandFilter("cmd", commandSearch.value.trim(), "");
    renderCommands();
  });
  commandCategory.addEventListener("change", () => {
    saveCommandFilter("cmdGroup", commandCategory.value, "all");
    renderCommands();
  });
  commandTarget.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-copy-command]");
    if (!button) return;
    try {
      await navigator.clipboard.writeText(button.dataset.copyCommand);
      button.textContent = "Đã sao chép";
    } catch {
      button.textContent = "Không sao chép được";
    }
    window.setTimeout(() => {
      if (button.isConnected) button.textContent = "Sao chép";
    }, 1800);
  });
  renderCommands();

  byId("goRankFull").addEventListener("click", () => document.querySelector('[data-tab="rank"]').click());
  byId("goRank").addEventListener("click", () => document.querySelector('[data-tab="rank"]').click());
})();
