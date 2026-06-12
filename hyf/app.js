const DEFAULT_API_BASE = "https://api.logangrimason.com";
const STORAGE_KEY = "hyf.web.session";

const artOverrides = {
  BOUNTY: "BOUNTY - Internal.png",
  FIREWALL: "FIREWALL - Internal.png",
  "MEMORY LEAK": "MEMORY LEAK - Internal.png",
};

const state = {
  apiBase: DEFAULT_API_BASE,
  roomCode: "",
  playerId: "",
  playerToken: "",
  isHost: false,
  publicState: null,
  privateState: null,
  cards: new Map(),
  selectedCardIds: new Set(),
  socket: null,
};

const el = {};

document.addEventListener("DOMContentLoaded", () => {
  bindElements();
  loadSession();
  bindEvents();
  loadCards();
  render();
  if (state.roomCode && state.playerToken) {
    reconnect();
  }
});

function bindElements() {
  for (const id of [
    "apiBaseInput",
    "connectionStatus",
    "sessionLine",
    "nicknameInput",
    "roomCodeInput",
    "serversInput",
    "createLobbyButton",
    "joinLobbyButton",
    "startGameButton",
    "reconnectButton",
    "playersList",
    "deckCount",
    "discardCount",
    "priorityPlayer",
    "winnerBanner",
    "webCount",
    "webCards",
    "stackCount",
    "stackList",
    "handCount",
    "handCards",
    "selectionSummary",
    "dynamicInputs",
    "playCardButton",
    "discardCardButton",
    "startHackButton",
    "passPriorityButton",
    "layLowAmount",
    "layLowButton",
    "choicePanel",
    "choicePrompt",
    "choiceActions",
    "eventLog",
    "clearLogButton",
    "cardTemplate",
  ]) {
    el[id] = document.getElementById(id);
  }
}

function bindEvents() {
  el.apiBaseInput.addEventListener("change", () => {
    state.apiBase = el.apiBaseInput.value.trim().replace(/\/$/, "") || DEFAULT_API_BASE;
    saveSession();
  });
  el.createLobbyButton.addEventListener("click", createLobby);
  el.joinLobbyButton.addEventListener("click", joinLobby);
  el.startGameButton.addEventListener("click", startGame);
  el.reconnectButton.addEventListener("click", reconnect);
  el.playCardButton.addEventListener("click", playSelectedCard);
  el.discardCardButton.addEventListener("click", discardSelectedCard);
  el.startHackButton.addEventListener("click", startHackByDiscard);
  el.passPriorityButton.addEventListener("click", () => submitAction({ type: "pass_priority" }));
  el.layLowButton.addEventListener("click", () => submitAction({ type: "lay_low", amount: Number(el.layLowAmount.value) }));
  el.clearLogButton.addEventListener("click", () => {
    el.eventLog.innerHTML = "";
  });
}

function loadSession() {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  state.apiBase = saved.apiBase || DEFAULT_API_BASE;
  state.roomCode = saved.roomCode || "";
  state.playerId = saved.playerId || "";
  state.playerToken = saved.playerToken || "";
  state.isHost = Boolean(saved.isHost);
  el.apiBaseInput.value = state.apiBase;
  el.roomCodeInput.value = state.roomCode;
  el.nicknameInput.value = saved.nickname || "";
}

function saveSession() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      apiBase: state.apiBase,
      roomCode: state.roomCode,
      playerId: state.playerId,
      playerToken: state.playerToken,
      isHost: state.isHost,
      nickname: el.nicknameInput.value.trim(),
    }),
  );
}

async function loadCards() {
  try {
    const cards = await request("/cards");
    state.cards = new Map(cards.map((card) => [card.name, card]));
    render();
  } catch (error) {
    logError(error.message);
  }
}

async function createLobby() {
  try {
    const nickname = el.nicknameInput.value.trim() || "Player";
    const starting_servers = Number(el.serversInput.value || 3);
    const data = await request("/lobbies", {
      method: "POST",
      body: { nickname, starting_servers },
    });
    applyCredentials(data, true);
    connectSocket();
    log(`Created room ${state.roomCode}`);
  } catch (error) {
    logError(error.message);
  }
}

async function joinLobby() {
  try {
    const nickname = el.nicknameInput.value.trim() || "Player";
    const roomCode = el.roomCodeInput.value.trim().toUpperCase();
    const data = await request(`/lobbies/${roomCode}/join`, {
      method: "POST",
      body: { nickname },
    });
    applyCredentials(data, false);
    connectSocket();
    log(`Joined room ${state.roomCode}`);
  } catch (error) {
    logError(error.message);
  }
}

async function startGame() {
  try {
    await request(`/lobbies/${state.roomCode}/start`, {
      method: "POST",
      auth: true,
    });
    log("Start requested");
  } catch (error) {
    logError(error.message);
  }
}

async function reconnect() {
  try {
    if (!state.roomCode || !state.playerToken) {
      throw new Error("No saved room token");
    }
    const privateState = await request(`/lobbies/${state.roomCode}/me`, { auth: true });
    state.privateState = privateState;
    state.publicState = privateState;
    connectSocket();
    log(`Reconnected to ${state.roomCode}`);
    render();
  } catch (error) {
    setConnection("offline");
    logError(error.message);
  }
}

function applyCredentials(data, isHost) {
  state.roomCode = data.room_code;
  state.playerId = data.player_id;
  state.playerToken = data.player_token;
  state.isHost = isHost;
  state.privateState = data.state;
  state.publicState = data.state;
  el.roomCodeInput.value = state.roomCode;
  saveSession();
  render();
}

function connectSocket() {
  if (!state.roomCode || !state.playerToken) return;
  if (state.socket) {
    state.socket.close();
  }
  const wsUrl = `${state.apiBase.replace(/^http/, "ws")}/lobbies/${state.roomCode}/ws?player_token=${encodeURIComponent(state.playerToken)}`;
  setConnection("waiting");
  const socket = new WebSocket(wsUrl);
  state.socket = socket;
  socket.addEventListener("open", () => {
    setConnection("online");
    log("Socket connected");
  });
  socket.addEventListener("close", () => {
    if (state.socket === socket) setConnection("offline");
  });
  socket.addEventListener("error", () => {
    setConnection("offline");
    logError("WebSocket error");
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    handleSocketMessage(message);
  });
}

function handleSocketMessage(message) {
  if (message.type === "state.updated") {
    state.publicState = message.data;
  } else if (message.type === "private.updated") {
    state.privateState = message.data;
    state.publicState = message.data;
  } else if (message.type === "priority.required") {
    log("Priority required");
  } else if (message.type === "choice.required") {
    log("Choice required");
  } else if (message.type === "game.ended") {
    log("Game ended");
  } else if (message.type === "error") {
    logError(message.data?.message || "Socket error");
  }
  render();
}

async function request(path, options = {}) {
  const headers = { "Content-Type": "application/json" };
  if (options.auth) {
    headers.Authorization = `Bearer ${state.playerToken}`;
  }
  const response = await fetch(`${state.apiBase}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) {
    const detail = data?.detail;
    throw new Error(detail?.message || detail?.code || response.statusText);
  }
  return data;
}

async function submitAction(action) {
  try {
    await request(`/lobbies/${state.roomCode}/actions`, {
      method: "POST",
      auth: true,
      body: action,
    });
    state.selectedCardIds.clear();
    log(`Submitted ${action.type}`);
    await refreshPrivateState();
  } catch (error) {
    logError(error.message);
  }
}

async function refreshPrivateState() {
  if (!state.roomCode || !state.playerToken) return;
  try {
    const privateState = await request(`/lobbies/${state.roomCode}/me`, { auth: true });
    state.privateState = privateState;
    state.publicState = privateState;
    render();
  } catch (error) {
    logError(error.message);
  }
}

function playSelectedCard() {
  const selected = selectedHandCards();
  if (selected.length !== 1) return;
  const card = selected[0];
  const action = { type: "play_card", card_id: card.id };
  const payload = buildPayloadForCard(card);
  if (Object.keys(payload).length) {
    action.payload = payload;
  }
  const stackTarget = valueOf("stackTargetInput");
  if (stackTarget) {
    action.target_stack_item_id = stackTarget;
  }
  submitAction(action);
}

function discardSelectedCard() {
  const selected = selectedHandCards();
  if (selected.length !== 1) return;
  submitAction({ type: "discard_card", card_id: selected[0].id });
}

function startHackByDiscard() {
  const selected = selectedHandCards();
  if (selected.length !== 2) return;
  submitAction({ type: "start_hack_by_discard", card_ids: selected.map((card) => card.id) });
}

function buildPayloadForCard(card) {
  const name = card.name;
  if (["ROOTKIT", "RANSOMWARE"].includes(name)) {
    return { target_player_id: valueOf("targetPlayerInput") };
  }
  if (name === "REWRITE") {
    return {
      first_index: Number(valueOf("firstWebIndexInput")),
      second_index: Number(valueOf("secondWebIndexInput")),
    };
  }
  if (name === "PHISHING ATTACK") {
    return { web_index: Number(valueOf("webIndexInput")) };
  }
  if (name === "QUANTUM COMPUTING") {
    const order = valueOf("webOrderInput")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    return { web_card_ids: order };
  }
  if (name === "CORPO RAID") {
    return {
      target_player_id: valueOf("targetPlayerInput"),
      hardware_id: valueOf("hardwareInput"),
    };
  }
  return {};
}

function valueOf(id) {
  return document.getElementById(id)?.value || "";
}

function render() {
  renderSession();
  renderPlayers();
  renderBoard();
  renderHand();
  renderActions();
  renderChoice();
}

function renderSession() {
  const room = state.publicState;
  const status = room?.status || "none";
  el.sessionLine.textContent = state.roomCode ? `Room ${state.roomCode} · ${status}` : "No room connected";
  el.startGameButton.disabled = !state.roomCode;
  el.reconnectButton.disabled = !state.roomCode || !state.playerToken;
}

function renderPlayers() {
  const room = state.publicState;
  el.playersList.innerHTML = "";
  if (!room?.players?.length) {
    el.playersList.append(emptyLine("No players yet"));
    return;
  }
  for (const player of room.players) {
    const tile = document.createElement("div");
    tile.className = `player-tile${player.id === state.playerId ? " is-me" : ""}`;
    const badges = [];
    if (room.game?.active_player_id === player.id) badges.push(`<span class="badge active">active</span>`);
    if (room.game?.datajack_player_id === player.id) badges.push(`<span class="badge datajack">datajack</span>`);
    if (!player.alive) badges.push(`<span class="badge">out</span>`);
    tile.innerHTML = `
      <div class="player-name">
        <span>${escapeHtml(player.nickname)}</span>
        <span>${player.id === state.playerId ? "you" : ""}</span>
      </div>
      <div class="badges">${badges.join("")}</div>
      <div class="stat-row">
        <span class="stat">Servers ${player.servers}</span>
        <span class="stat">Investigation ${player.investigations}</span>
        <span class="stat">Hand ${player.hand_count}</span>
      </div>
      <div class="hardware-row"></div>
    `;
    const hardwareRow = tile.querySelector(".hardware-row");
    for (const card of player.hardware || []) {
      const img = document.createElement("img");
      img.src = artPath(card.name);
      img.alt = card.name;
      img.title = card.name;
      hardwareRow.append(img);
    }
    el.playersList.append(tile);
  }
}

function renderBoard() {
  const game = state.publicState?.game;
  el.deckCount.textContent = game?.deck_count ?? 0;
  el.discardCount.textContent = game?.discard_count ?? 0;
  el.priorityPlayer.textContent = playerName(game?.current_priority_player_id) || "-";
  el.webCount.textContent = `${game?.web?.length || 0} / 24`;
  el.stackCount.textContent = game?.stack?.length || 0;
  renderCardRow(el.webCards, game?.web || [], { small: true, selectable: false, showIndex: true });
  renderStack(game?.stack || []);

  if (game?.winner_id) {
    el.winnerBanner.textContent = `${playerName(game.winner_id)} wins`;
    el.winnerBanner.classList.remove("hidden");
  } else {
    el.winnerBanner.classList.add("hidden");
  }
}

function renderStack(stack) {
  el.stackList.innerHTML = "";
  if (!stack.length) {
    el.stackList.append(emptyLine("Stack empty"));
    return;
  }
  [...stack].reverse().forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "stack-item";
    const cardName = item.card?.name || item.action_type;
    row.innerHTML = `
      <img src="${artPath(cardName)}" alt="">
      <div>
        <strong>${escapeHtml(cardName)}${index === 0 ? " · top" : ""}</strong>
        <span>${escapeHtml(playerName(item.actor_id) || item.actor_id)} ${item.canceled ? "· canceled" : ""}</span>
      </div>
    `;
    el.stackList.append(row);
  });
}

function renderHand() {
  const hand = state.privateState?.me?.hand || [];
  el.handCount.textContent = hand.length;
  renderCardRow(el.handCards, hand, { selectable: true });
}

function renderCardRow(container, cards, options = {}) {
  container.innerHTML = "";
  if (!cards.length) {
    container.append(emptyLine("Empty"));
    return;
  }
  cards.forEach((card, index) => {
    const node = el.cardTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.cardId = card.id;
    if (options.small) node.classList.add("is-small");
    if (state.selectedCardIds.has(card.id)) node.classList.add("is-selected");
    node.querySelector("img").src = artPath(card.name);
    node.querySelector("img").alt = card.name;
    node.querySelector("span").textContent = options.showIndex ? `${index}: ${card.name}` : card.name;
    if (options.selectable) {
      node.addEventListener("click", () => toggleSelected(card.id));
    } else {
      node.disabled = true;
    }
    container.append(node);
  });
}

function renderActions() {
  const legal = new Set(state.privateState?.legal_actions || []);
  const selected = selectedHandCards();
  const selectedNames = selected.map((card) => card.name).join(", ");
  el.selectionSummary.textContent = selected.length ? selectedNames : "No card selected";

  el.playCardButton.disabled = !legal.has("play_card") || selected.length !== 1;
  el.discardCardButton.disabled = !legal.has("discard_card") || selected.length !== 1;
  el.startHackButton.disabled = !legal.has("start_hack_by_discard") || selected.length !== 2;
  el.passPriorityButton.disabled = !legal.has("pass_priority");
  el.layLowButton.disabled = !legal.has("lay_low");
  renderDynamicInputs(selected[0]);
}

function renderDynamicInputs(card) {
  el.dynamicInputs.innerHTML = "";
  if (!card) return;
  if (["ROOTKIT", "RANSOMWARE", "CORPO RAID"].includes(card.name)) {
    el.dynamicInputs.append(makeSelect("targetPlayerInput", "Target Player", alivePlayerOptions()));
  }
  if (card.name === "CORPO RAID") {
    el.dynamicInputs.append(makeSelect("hardwareInput", "Hardware", hardwareOptions(valueOf("targetPlayerInput"))));
    const target = document.getElementById("targetPlayerInput");
    target?.addEventListener("change", () => renderDynamicInputs(card));
  }
  if (card.name === "REWRITE") {
    el.dynamicInputs.append(makeNumberInput("firstWebIndexInput", "First Web Index", 0));
    el.dynamicInputs.append(makeNumberInput("secondWebIndexInput", "Second Web Index", 1));
  }
  if (card.name === "PHISHING ATTACK") {
    el.dynamicInputs.append(makeNumberInput("webIndexInput", "Web Index", 0));
  }
  if (card.name === "QUANTUM COMPUTING") {
    const ids = (state.publicState?.game?.web || []).map((webCard) => webCard.id).join(", ");
    el.dynamicInputs.append(makeTextInput("webOrderInput", "Web Card IDs", ids));
  }
  if (card.name === "QUICK HACK") {
    el.dynamicInputs.append(makeSelect("stackTargetInput", "Stack Target", stackOptions()));
  }
}

function renderChoice() {
  const choice = state.privateState?.my_choice;
  if (!choice) {
    el.choicePanel.classList.add("hidden");
    return;
  }
  el.choicePanel.classList.remove("hidden");
  el.choicePrompt.textContent = choice.prompt;
  el.choiceActions.innerHTML = "";
  for (const option of choice.options) {
    if (choice.kind === "cloud_storage") {
      const top = state.publicState?.game?.discard_top;
      const button = makeButton(top ? `Take ${top.name}` : "Take Card", () => {
        if (top) submitAction({ type: "answer_choice", answer: option, card_id: top.id });
      });
      button.disabled = !top;
      el.choiceActions.append(button);
    } else {
      el.choiceActions.append(makeButton(option.replaceAll("_", " "), () => submitAction({ type: "answer_choice", answer: option })));
    }
  }
}

function toggleSelected(cardId) {
  if (state.selectedCardIds.has(cardId)) {
    state.selectedCardIds.delete(cardId);
  } else {
    state.selectedCardIds.add(cardId);
  }
  render();
}

function selectedHandCards() {
  const hand = state.privateState?.me?.hand || [];
  return hand.filter((card) => state.selectedCardIds.has(card.id));
}

function alivePlayerOptions() {
  return (state.publicState?.players || [])
    .filter((player) => player.alive)
    .map((player) => ({ value: player.id, label: player.nickname }));
}

function hardwareOptions(playerId) {
  const player = (state.publicState?.players || []).find((candidate) => candidate.id === playerId);
  return (player?.hardware || []).map((card) => ({ value: card.id, label: card.name }));
}

function stackOptions() {
  return (state.publicState?.game?.stack || []).map((item) => ({
    value: item.id,
    label: item.card?.name || item.action_type,
  }));
}

function makeSelect(id, labelText, options) {
  const label = document.createElement("label");
  label.textContent = labelText;
  const select = document.createElement("select");
  select.id = id;
  for (const option of options) {
    const node = document.createElement("option");
    node.value = option.value;
    node.textContent = option.label;
    select.append(node);
  }
  label.append(select);
  return label;
}

function makeNumberInput(id, labelText, value) {
  const label = document.createElement("label");
  label.textContent = labelText;
  const input = document.createElement("input");
  input.id = id;
  input.type = "number";
  input.min = "0";
  input.value = String(value);
  label.append(input);
  return label;
}

function makeTextInput(id, labelText, value) {
  const label = document.createElement("label");
  label.textContent = labelText;
  const input = document.createElement("input");
  input.id = id;
  input.type = "text";
  input.value = value;
  input.spellcheck = false;
  label.append(input);
  return label;
}

function makeButton(label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function emptyLine(text) {
  const div = document.createElement("div");
  div.className = "event";
  div.textContent = text;
  return div;
}

function playerName(playerId) {
  return (state.publicState?.players || []).find((player) => player.id === playerId)?.nickname || "";
}

function artPath(cardName) {
  const file = artOverrides[cardName] || `${cardName}.png`;
  return `./CardArt/${encodeURIComponent(file).replaceAll("%2F", "/")}`;
}

function setConnection(status) {
  el.connectionStatus.textContent = status;
  el.connectionStatus.className = `status-pill status-${status === "online" ? "online" : status === "waiting" ? "waiting" : "offline"}`;
}

function log(message) {
  const div = document.createElement("div");
  div.className = "event";
  div.textContent = `${new Date().toLocaleTimeString()} · ${message}`;
  el.eventLog.prepend(div);
}

function logError(message) {
  const div = document.createElement("div");
  div.className = "event error";
  div.textContent = `${new Date().toLocaleTimeString()} · ${message}`;
  el.eventLog.prepend(div);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
