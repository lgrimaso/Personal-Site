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
  selectedHandIds: new Set(),
  rewriteFirstId: "",
  quantumOrder: [],
  previewName: "",
  socket: null,
};

const el = {};

document.addEventListener("DOMContentLoaded", () => {
  bindElements();
  loadSession();
  bindEvents();
  loadCards();
  render();
  if (state.roomCode && state.playerToken) reconnect();
});

function bindElements() {
  for (const id of [
    "apiBaseInput",
    "connectionStatus",
    "sessionLine",
    "reconnectButton",
    "nicknameInput",
    "roomCodeInput",
    "serversInput",
    "createLobbyButton",
    "joinLobbyButton",
    "startGameButton",
    "clearLogButton",
    "eventLog",
    "turnSummary",
    "playerSeats",
    "currentDatajack",
    "futureDatajack",
    "webCount",
    "webCards",
    "stackCount",
    "stackList",
    "handCount",
    "handCards",
    "previewImage",
    "previewName",
    "previewMeta",
    "previewText",
    "selectionSummary",
    "contextTools",
    "playCardButton",
    "discardCardButton",
    "startHackButton",
    "passPriorityButton",
    "layLowAmount",
    "layLowButton",
    "choicePanel",
    "choicePrompt",
    "choiceActions",
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
  el.clearLogButton.addEventListener("click", () => (el.eventLog.innerHTML = ""));
  el.playCardButton.addEventListener("click", playSelectedNoTargetCard);
  el.discardCardButton.addEventListener("click", discardSelectedCard);
  el.startHackButton.addEventListener("click", startHackByDiscard);
  el.passPriorityButton.addEventListener("click", () => submitAction({ type: "pass_priority" }));
  el.layLowButton.addEventListener("click", () => submitAction({ type: "lay_low", amount: Number(el.layLowAmount.value) }));
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
    const data = await request("/lobbies", { method: "POST", body: { nickname, starting_servers } });
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
    const data = await request(`/lobbies/${roomCode}/join`, { method: "POST", body: { nickname } });
    applyCredentials(data, false);
    connectSocket();
    log(`Joined room ${state.roomCode}`);
  } catch (error) {
    logError(error.message);
  }
}

async function startGame() {
  try {
    await request(`/lobbies/${state.roomCode}/start`, { method: "POST", auth: true });
    log("Start requested");
  } catch (error) {
    logError(error.message);
  }
}

async function reconnect() {
  try {
    if (!state.roomCode || !state.playerToken) throw new Error("No saved room token");
    const privateState = await request(`/lobbies/${state.roomCode}/me`, { auth: true });
    state.privateState = privateState;
    state.publicState = privateState;
    pruneSelection();
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
  if (state.socket) state.socket.close();
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
    handleSocketMessage(JSON.parse(event.data));
  });
}

function handleSocketMessage(message) {
  if (message.type === "state.updated") {
    state.publicState = message.data;
  } else if (message.type === "private.updated") {
    state.privateState = message.data;
    state.publicState = message.data;
    pruneSelection();
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
  if (options.auth) headers.Authorization = `Bearer ${state.playerToken}`;
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
    await request(`/lobbies/${state.roomCode}/actions`, { method: "POST", auth: true, body: action });
    state.selectedHandIds.clear();
    state.rewriteFirstId = "";
    state.quantumOrder = [];
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
    pruneSelection();
    render();
  } catch (error) {
    logError(error.message);
  }
}

function render() {
  renderSession();
  renderPlayers();
  renderDatajack();
  renderWeb();
  renderStack();
  renderHand();
  renderControls();
  renderChoice();
  renderPreview();
}

function renderSession() {
  const room = state.publicState;
  el.sessionLine.textContent = state.roomCode ? `Room ${state.roomCode} · ${room?.status || "saved"}` : "No room";
  el.startGameButton.disabled = !state.roomCode;
  el.reconnectButton.disabled = !state.roomCode || !state.playerToken;
  const activeName = playerName(room?.game?.active_player_id);
  const priorityName = playerName(room?.game?.current_priority_player_id);
  el.turnSummary.textContent = priorityName ? `Priority: ${priorityName}` : activeName ? `Turn: ${activeName}` : "";
}

function renderPlayers() {
  const room = state.publicState;
  const selected = selectedCard();
  const hint = selected ? cardHint(selected.id) : null;
  const playerTargets = new Set(hint?.valid_targets?.players || []);
  const hardwareTargets = new Set((hint?.valid_targets?.hardware || []).map((target) => target.card_id));
  const futureId = activeProjection()?.landing_player_id;

  el.playerSeats.innerHTML = "";
  if (!room?.players?.length) {
    el.playerSeats.append(empty("No players"));
    return;
  }

  for (const player of room.players) {
    const seat = document.createElement("div");
    seat.role = "button";
    seat.tabIndex = 0;
    seat.className = "player-seat";
    if (player.id === state.playerId) seat.classList.add("is-me");
    if (room.game?.datajack_player_id === player.id) seat.classList.add("is-current-datajack");
    if (futureId === player.id) seat.classList.add("is-future-datajack");
    if (playerTargets.has(player.id)) seat.classList.add("is-target");
    seat.addEventListener("click", () => handlePlayerTarget(player.id));
    seat.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handlePlayerTarget(player.id);
      }
    });

    seat.innerHTML = `
      <div class="seat-name">
        <span>${escapeHtml(player.nickname)}</span>
        <span>${player.id === state.playerId ? "you" : ""}</span>
      </div>
      <div class="seat-badges"></div>
      <div class="seat-stats">
        <span class="chip">S ${player.servers}</span>
        <span class="chip">I ${player.investigations}</span>
        <span class="chip">H ${player.hand_count}</span>
      </div>
      <div class="hardware-strip"></div>
    `;

    const badges = seat.querySelector(".seat-badges");
    if (room.game?.active_player_id === player.id) badges.append(chip("active", "active"));
    if (room.game?.datajack_player_id === player.id) badges.append(chip("datajack", "current"));
    if (futureId === player.id) badges.append(chip("future", "future"));
    if (!player.alive) badges.append(chip("out", ""));

    const hardwareStrip = seat.querySelector(".hardware-strip");
    for (const hardware of player.hardware || []) {
      const token = document.createElement("button");
      token.type = "button";
      token.className = "hardware-token";
      if (hardwareTargets.has(hardware.id)) token.classList.add("is-target");
      token.title = hardware.name;
      token.innerHTML = `<img src="${artPath(hardware.name)}" alt="">`;
      token.addEventListener("mouseenter", () => showPreview(hardware.name));
      token.addEventListener("focus", () => showPreview(hardware.name));
      token.addEventListener("click", (event) => {
        event.stopPropagation();
        handleHardwareTarget(player.id, hardware.id);
      });
      hardwareStrip.append(token);
    }

    el.playerSeats.append(seat);
  }
}

function renderDatajack() {
  const game = state.publicState?.game;
  const projection = activeProjection();
  el.currentDatajack.textContent = playerName(game?.datajack_player_id) || "-";
  const futureName = playerName(projection?.landing_player_id) || "-";
  el.futureDatajack.textContent = projection?.uncertain ? `${futureName} ?` : futureName;
  el.futureDatajack.title = projection?.reasons?.join("; ") || "";
}

function renderWeb() {
  const web = state.publicState?.game?.web || [];
  const selected = selectedCard();
  const hint = selected ? cardHint(selected.id) : null;
  const validWebIds = new Set((hint?.valid_targets?.web_cards || []).map((target) => target.id));
  el.webCount.textContent = `${web.length} / 24`;
  el.webCards.innerHTML = "";
  if (!web.length) {
    el.webCards.append(empty("The Web is empty"));
    return;
  }
  web.forEach((card, index) => {
    const node = cardNode(card, { label: `${index}: ${card.name}` });
    if (isWebTarget(card.id, validWebIds)) node.classList.add("is-target");
    if (state.rewriteFirstId === card.id || state.quantumOrder.includes(card.id)) {
      node.classList.add("is-picked");
      const badge = document.createElement("span");
      badge.className = "order-badge";
      badge.textContent = state.quantumOrder.includes(card.id) ? String(state.quantumOrder.indexOf(card.id) + 1) : "1";
      node.append(badge);
    }
    node.addEventListener("click", () => handleWebTarget(card.id));
    el.webCards.append(node);
  });
}

function renderStack() {
  const stack = state.publicState?.game?.stack || [];
  const selected = selectedCard();
  const hint = selected ? cardHint(selected.id) : null;
  const stackTargets = new Set(hint?.valid_targets?.stack_items || []);
  el.stackCount.textContent = stack.length;
  el.stackList.innerHTML = "";
  if (!stack.length) {
    el.stackList.append(empty("Stack empty"));
    return;
  }
  [...stack].reverse().forEach((item, index) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "stack-item";
    if (stackTargets.has(item.id)) row.classList.add("is-target");
    const name = item.card?.name || item.action_type;
    row.innerHTML = `
      <img src="${artPath(name)}" alt="">
      <div>
        <strong>${escapeHtml(name)}${index === 0 ? " · top" : ""}</strong>
        <span>${escapeHtml(playerName(item.actor_id) || item.actor_id)}${item.canceled ? " · canceled" : ""}</span>
      </div>
    `;
    row.addEventListener("mouseenter", () => showPreview(name));
    row.addEventListener("focus", () => showPreview(name));
    row.addEventListener("click", () => handleStackTarget(item.id));
    el.stackList.append(row);
  });
}

function renderHand() {
  const hand = state.privateState?.me?.hand || [];
  el.handCount.textContent = hand.length;
  el.handCards.innerHTML = "";
  if (!hand.length) {
    el.handCards.append(empty("No cards"));
    return;
  }
  for (const card of hand) {
    const hint = cardHint(card.id);
    const node = cardNode(card);
    if (state.selectedHandIds.has(card.id)) node.classList.add("is-selected");
    if (hint && !hint.playable) {
      node.classList.add("is-unplayable");
      node.title = hint.reason || "Not playable";
    }
    node.addEventListener("click", () => toggleHandSelection(card.id));
    el.handCards.append(node);
  }
}

function renderControls() {
  const legal = new Set(state.privateState?.legal_actions || []);
  const selected = selectedHandCards();
  const active = selectedCard();
  const hint = active ? cardHint(active.id) : null;
  const me = state.privateState?.me;

  if (!selected.length) {
    el.selectionSummary.textContent = "No card selected";
  } else {
    el.selectionSummary.textContent = selected.map((card) => card.name).join(", ");
  }

  renderContextTools(active, hint);

  el.playCardButton.disabled = !(selected.length === 1 && hint?.playable && hint.target_type === "none");
  el.discardCardButton.disabled = !(selected.length === 1 && legal.has("discard_card"));
  el.startHackButton.disabled = !(selected.length === 2 && legal.has("start_hack_by_discard"));
  el.passPriorityButton.disabled = !legal.has("pass_priority");
  el.layLowButton.disabled = !(legal.has("lay_low") && me?.investigations >= Number(el.layLowAmount.value));
}

function renderContextTools(card, hint) {
  el.contextTools.innerHTML = "";
  if (!card) {
    el.contextTools.textContent = "Select cards from your hand";
    return;
  }
  if (!hint?.playable) {
    el.contextTools.textContent = hint?.reason || "Card cannot be played";
    return;
  }
  const type = hint.target_type;
  if (type === "none") {
    el.contextTools.textContent = "Ready";
  } else if (type === "player") {
    el.contextTools.textContent = "Choose a highlighted player";
  } else if (type === "hardware") {
    el.contextTools.textContent = "Choose highlighted hardware";
  } else if (type === "stack_item") {
    el.contextTools.textContent = "Choose a highlighted stack item";
  } else if (type === "web_card") {
    el.contextTools.textContent = "Choose a highlighted Web card";
  } else if (type === "web_pair") {
    el.contextTools.textContent = state.rewriteFirstId ? "Choose the second Web card" : "Choose the first Web card";
    if (state.rewriteFirstId) el.contextTools.append(toolButton("Reset", () => {
      state.rewriteFirstId = "";
      render();
    }));
  } else if (type === "web_order") {
    const total = hint.valid_targets.web_cards.length;
    const row = document.createElement("div");
    row.className = "tool-row";
    row.innerHTML = `<span>Order ${state.quantumOrder.length} / ${total}</span>`;
    row.append(toolButton("Reset", () => {
      state.quantumOrder = [];
      render();
    }));
    el.contextTools.append(row);
    const submit = toolButton("Submit Order", () => submitQuantumOrder(card.id, total));
    submit.disabled = state.quantumOrder.length !== total;
    el.contextTools.append(submit);
  }
}

function renderChoice() {
  const choice = state.privateState?.my_choice;
  el.choiceActions.innerHTML = "";
  if (!choice) {
    el.choicePanel.classList.add("hidden");
    return;
  }
  el.choicePanel.classList.remove("hidden");
  el.choicePrompt.textContent = choice.prompt;
  if (choice.kind === "cloud_storage") {
    for (const card of choice.valid_cards || []) {
      const button = toolButton(card.name, () => submitAction({ type: "answer_choice", answer: "choose_card", card_id: card.id }));
      button.addEventListener("mouseenter", () => showPreview(card.name));
      button.addEventListener("focus", () => showPreview(card.name));
      el.choiceActions.append(button);
    }
  } else {
    for (const option of choice.options || []) {
      el.choiceActions.append(toolButton(option.replaceAll("_", " "), () => submitAction({ type: "answer_choice", answer: option })));
    }
  }
}

function renderPreview() {
  const selected = selectedCard();
  const name = state.previewName || selected?.name || "";
  if (!name) {
    el.previewImage.src = artPath("Card Back");
    el.previewName.textContent = "Inspect";
    el.previewMeta.textContent = "Hover or focus a card";
    el.previewText.textContent = "";
    return;
  }
  const definition = state.cards.get(name);
  el.previewImage.src = artPath(name);
  el.previewName.textContent = name;
  el.previewMeta.textContent = definition ? `${definition.card_type} · ${definition.magnifiers} investigation` : "";
  el.previewText.textContent = definition?.text || "";
}

function cardNode(card, options = {}) {
  const node = el.cardTemplate.content.firstElementChild.cloneNode(true);
  node.dataset.cardId = card.id;
  node.querySelector("img").src = artPath(card.name);
  node.querySelector("img").alt = card.name;
  node.querySelector("span").textContent = options.label || card.name;
  node.addEventListener("mouseenter", () => showPreview(card.name));
  node.addEventListener("focus", () => showPreview(card.name));
  return node;
}

function toggleHandSelection(cardId) {
  if (state.selectedHandIds.has(cardId)) {
    state.selectedHandIds.delete(cardId);
  } else {
    state.selectedHandIds.add(cardId);
  }
  state.rewriteFirstId = "";
  state.quantumOrder = [];
  const card = selectedHandCards().at(-1);
  if (card) showPreview(card.name);
  render();
}

function handlePlayerTarget(playerId) {
  const card = selectedCard();
  const hint = card ? cardHint(card.id) : null;
  if (!card || !hint?.playable || hint.target_type !== "player") return;
  if (!(hint.valid_targets.players || []).includes(playerId)) return;
  submitAction({ type: "play_card", card_id: card.id, payload: { target_player_id: playerId } });
}

function handleHardwareTarget(playerId, hardwareId) {
  const card = selectedCard();
  const hint = card ? cardHint(card.id) : null;
  if (!card || !hint?.playable || hint.target_type !== "hardware") return;
  const valid = (hint.valid_targets.hardware || []).some((target) => target.card_id === hardwareId);
  if (!valid) return;
  submitAction({ type: "play_card", card_id: card.id, payload: { target_player_id: playerId, hardware_id: hardwareId } });
}

function handleStackTarget(stackItemId) {
  const card = selectedCard();
  const hint = card ? cardHint(card.id) : null;
  if (!card || !hint?.playable || hint.target_type !== "stack_item") return;
  if (!(hint.valid_targets.stack_items || []).includes(stackItemId)) return;
  submitAction({ type: "play_card", card_id: card.id, target_stack_item_id: stackItemId });
}

function handleWebTarget(webCardId) {
  const card = selectedCard();
  const hint = card ? cardHint(card.id) : null;
  if (!card || !hint?.playable) return;
  const validIds = new Set((hint.valid_targets.web_cards || []).map((target) => target.id));
  if (!validIds.has(webCardId)) return;

  if (hint.target_type === "web_card") {
    submitAction({ type: "play_card", card_id: card.id, payload: { web_card_id: webCardId } });
  } else if (hint.target_type === "web_pair") {
    if (!state.rewriteFirstId) {
      state.rewriteFirstId = webCardId;
      render();
    } else if (state.rewriteFirstId !== webCardId) {
      submitAction({
        type: "play_card",
        card_id: card.id,
        payload: { first_web_card_id: state.rewriteFirstId, second_web_card_id: webCardId },
      });
    }
  } else if (hint.target_type === "web_order") {
    if (state.quantumOrder.includes(webCardId)) {
      state.quantumOrder = state.quantumOrder.filter((id) => id !== webCardId);
    } else {
      state.quantumOrder.push(webCardId);
    }
    render();
  }
}

function playSelectedNoTargetCard() {
  const card = selectedCard();
  const hint = card ? cardHint(card.id) : null;
  if (!card || !hint?.playable || hint.target_type !== "none") return;
  submitAction({ type: "play_card", card_id: card.id });
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

function submitQuantumOrder(cardId, total) {
  if (state.quantumOrder.length !== total) return;
  submitAction({ type: "play_card", card_id: cardId, payload: { web_card_ids: state.quantumOrder } });
}

function isWebTarget(cardId, validWebIds) {
  const hint = selectedCard() ? cardHint(selectedCard().id) : null;
  if (!hint?.playable) return false;
  if (!["web_card", "web_pair", "web_order"].includes(hint.target_type)) return false;
  if (hint.target_type === "web_order" && state.quantumOrder.includes(cardId)) return false;
  return validWebIds.has(cardId);
}

function selectedHandCards() {
  const hand = state.privateState?.me?.hand || [];
  return hand.filter((card) => state.selectedHandIds.has(card.id));
}

function selectedCard() {
  const selected = selectedHandCards();
  return selected.length === 1 ? selected[0] : null;
}

function activeProjection() {
  const selected = selectedCard();
  const direction = selected?.name === "HONEYPOT" ? "reverse" : "forward";
  return state.publicState?.game?.datajack_projection?.[direction] || null;
}

function cardHint(cardId) {
  return state.privateState?.card_actions?.[cardId] || null;
}

function pruneSelection() {
  const ids = new Set((state.privateState?.me?.hand || []).map((card) => card.id));
  state.selectedHandIds = new Set([...state.selectedHandIds].filter((id) => ids.has(id)));
}

function showPreview(cardName) {
  state.previewName = cardName;
  renderPreview();
}

function playerName(playerId) {
  return (state.publicState?.players || []).find((player) => player.id === playerId)?.nickname || "";
}

function chip(text, className) {
  const span = document.createElement("span");
  span.className = `chip ${className}`.trim();
  span.textContent = text;
  return span;
}

function toolButton(text, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = text;
  button.addEventListener("click", onClick);
  return button;
}

function empty(text) {
  const div = document.createElement("div");
  div.className = "empty-state";
  div.textContent = text;
  return div;
}

function artPath(cardName) {
  if (cardName === "Card Back") return "./CardArt/Card%20Back.png";
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
