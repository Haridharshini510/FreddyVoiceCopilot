let client;
let iparams;
let authHeader;
let state = "idle"; // idle | incoming | assisting
let currentTicket = null;
let pollTimer = null;
const handledTicketIds = new Set();

const POLL_INTERVAL_MS = 6000;
const RECENT_WINDOW_MS = 3 * 60 * 1000; // only treat tickets created in the last 3 minutes as "incoming"
const SENTIMENT_WORDS = ["angry", "frustrated", "disappointed", "upset", "irritated", "calm", "happy", "satisfied"];

init();

async function init() {
  client = await app.initialized();
  iparams = await client.iparams.get();
  authHeader = "Basic " + btoa(iparams.freshdesk_api_key + ":X");
  renderIdle();
  startPolling();
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollForEscalations();
  pollTimer = setInterval(pollForEscalations, POLL_INTERVAL_MS);
}

async function invoke(templateName, options) {
  const opts = options || {};
  opts.context = { authHeader, ...(opts.context || {}) };
  const res = await client.request.invokeTemplate(templateName, opts);
  return JSON.parse(res.response);
}

async function pollForEscalations() {
  if (state !== "idle") return; // don't interrupt an active call
  try {
    const tickets = await invoke("getTickets");
    const now = Date.now();
    const pending = tickets.find((t) => {
      const isRecent = now - new Date(t.created_at).getTime() < RECENT_WINDOW_MS;
      const isOpen = t.status === 2;
      const notHandled = !handledTicketIds.has(t.id);
      return isRecent && isOpen && notHandled;
    });
    if (pending) {
      currentTicket = pending;
      await renderIncoming(pending);
    }
  } catch (err) {
    console.error("Freddy CTI: polling failed", err);
  }
}

function setState(newState) {
  state = newState;
  document.querySelectorAll(".screen").forEach((el) => el.classList.remove("active"));
  document.getElementById(`screen-${newState}`).classList.add("active");
}

function renderIdle() {
  setState("idle");
}

async function fetchContactLabel(requesterId) {
  if (!requesterId) return "Unknown caller";
  try {
    const contact = await invoke("getContact", { context: { contactId: requesterId } });
    return `${contact.name || "Unknown"} (${contact.email || contact.phone || "no contact info"})`;
  } catch (err) {
    console.error("Freddy CTI: failed to fetch contact", err);
    return "Unknown caller";
  }
}

async function renderIncoming(ticket) {
  setState("incoming");

  const sentiment = extractSentiment(ticket);
  document.getElementById("incoming-subject").innerText = ticket.subject || "Unknown issue";
  document.getElementById("incoming-description").innerText = ticket.description_text || "";
  document.getElementById("incoming-sentiment").innerText = sentiment;
  document.getElementById("incoming-sentiment").className = "badge " + sentimentClass(sentiment);
  document.getElementById("incoming-source").innerText = "Escalated by Freddy AI";
  document.getElementById("incoming-contact").innerText = await fetchContactLabel(ticket.requester_id);

  document.getElementById("btn-answer").onclick = () => answerCall(ticket);
  document.getElementById("btn-dismiss").onclick = () => dismissCall(ticket);
}

function dismissCall(ticket) {
  handledTicketIds.add(ticket.id);
  currentTicket = null;
  renderIdle();
}

function extractSentiment(ticket) {
  const text = `${ticket.subject || ""} ${ticket.description_text || ""}`.toLowerCase();
  const found = SENTIMENT_WORDS.find((word) => text.includes(word));
  return found ? found : "unknown";
}

function sentimentClass(sentiment) {
  const negative = ["angry", "frustrated", "disappointed"];
  return negative.includes(sentiment.toLowerCase()) ? "badge-risk" : "badge-neutral";
}

async function answerCall(ticket) {
  handledTicketIds.add(ticket.id);
  try {
    await invoke("updateTicket", {
      context: { ticketId: ticket.id },
      body: JSON.stringify({ status: 3 }) // Pending = agent is now handling it
    });
  } catch (err) {
    console.error("Freddy CTI: failed to update ticket on answer", err);
  }
  await renderAssisting(ticket);
}

async function fetchPastTickets(ticket) {
  if (!ticket.requester_id) return [];
  try {
    const history = await invoke("getTicketsByRequester", {
      context: { requesterId: ticket.requester_id }
    });
    return history.filter((t) => t.id !== ticket.id);
  } catch (err) {
    console.error("Freddy CTI: failed to fetch history", err);
    return [];
  }
}

function buildAssistPrompt(ticket, sentiment, pastTickets) {
  const historyText =
    pastTickets.length === 0
      ? "No prior tickets from this customer."
      : pastTickets.map((t) => `- "${t.subject}" (status ${t.status})`).join("\n");

  return `You are assisting a human customer support agent who just picked up an escalated call.
Respond with ONLY valid JSON, no markdown, no code fences, no extra text. Use exactly these keys:
"customerHistorySummary" (a short 1-2 sentence narrative about this customer's relationship - e.g. loyal customer, first-time caller, repeat complainer),
"nextBestAction" (one specific, concrete recommended next step for the agent),
"riskAlert" (null unless the ticket description itself implies a compliance/policy risk, in which case a short warning message),
"coachingTip" (one short, specific coaching tip for how the agent should handle this conversation, given the sentiment).

Ticket subject: ${ticket.subject || "Unknown"}
Ticket description: ${ticket.description_text || "None"}
Detected sentiment: ${sentiment}
Past tickets from this customer:
${historyText}`;
}

async function renderAssisting(ticket) {
  setState("assisting");

  document.getElementById("assist-subject").innerText = ticket.subject || "Unknown issue";
  document.getElementById("assist-history").innerText = "Generating assist...";
  document.getElementById("assist-next-step").innerText = "Generating assist...";
  document.getElementById("assist-coaching").innerText = "Generating assist...";
  const riskEl = document.getElementById("assist-risk");
  riskEl.innerText = "Generating assist...";
  riskEl.className = "alert alert-ok";

  const sentiment = extractSentiment(ticket);
  const pastTickets = await fetchPastTickets(ticket);

  try {
    const assist = await requestAssist(ticket, sentiment, pastTickets);
    document.getElementById("assist-history").innerText = assist.customerHistorySummary;
    document.getElementById("assist-next-step").innerText = assist.nextBestAction;
    document.getElementById("assist-coaching").innerText = assist.coachingTip;
    riskEl.innerText = assist.riskAlert || "No compliance risk flagged.";
    riskEl.className = assist.riskAlert ? "alert alert-risk" : "alert alert-ok";
  } catch (err) {
    console.error("Freddy CTI: failed to generate assist", err);
    renderAssistFallback(ticket, pastTickets, riskEl);
  }

  document.getElementById("btn-end-call").onclick = () => endCall(ticket);
}

function renderAssistFallback(ticket, pastTickets, riskEl) {
  document.getElementById("assist-history").innerText =
    pastTickets.length === 0
      ? "No prior tickets from this customer."
      : `${pastTickets.length} prior ticket(s): ` + pastTickets.map((t) => `"${t.subject}"`).slice(0, 3).join(", ");
  document.getElementById("assist-next-step").innerText = computeNextBestStep(ticket);
  document.getElementById("assist-coaching").innerText = computeCoachingTip(ticket);
  const fallbackRisk = computeRiskAlert(ticket);
  riskEl.innerText = fallbackRisk || "No compliance risk flagged.";
  riskEl.className = fallbackRisk ? "alert alert-risk" : "alert alert-ok";
}

async function requestAssist(ticket, sentiment, pastTickets) {
  const prompt = buildAssistPrompt(ticket, sentiment, pastTickets);
  const res = await client.request.invokeTemplate("generateAssist", {
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }]
    })
  });
  const data = JSON.parse(res.response);
  const text = data.content[0].text;
  return JSON.parse(text);
}

const NEXT_STEP_RULES = [
  { keywords: ["refund", "charge", "billing"], step: "Verify the order/charge details and process the refund per policy (5-7 business days)." },
  { keywords: ["password", "login", "account"], step: "Verify the customer's identity, then assist with account access or reset." },
  { keywords: ["broken", "damaged", "defective"], step: "Confirm the damage, then arrange a replacement or refund and share the return process." },
  { keywords: ["delivery", "shipping", "delayed"], step: "Check the shipment tracking status and provide an updated delivery estimate." }
];

function computeNextBestStep(ticket) {
  const text = `${ticket.subject || ""} ${ticket.description_text || ""}`.toLowerCase();
  const rule = NEXT_STEP_RULES.find((r) => r.keywords.some((k) => text.includes(k)));
  return rule ? rule.step : "Review the ticket description and confirm the next steps directly with the customer.";
}

function computeRiskAlert(ticket) {
  const sentiment = extractSentiment(ticket).toLowerCase();
  if (["angry", "frustrated", "disappointed", "upset", "irritated"].includes(sentiment)) {
    return "Customer sentiment is negative - prioritize empathy, avoid delays, consider a goodwill gesture if policy allows.";
  }
  return null;
}

function computeCoachingTip(ticket) {
  const sentiment = extractSentiment(ticket).toLowerCase();
  if (["angry", "frustrated", "disappointed", "upset", "irritated"].includes(sentiment)) {
    return "Acknowledge the customer's frustration explicitly before offering a solution.";
  }
  return "Confirm you understand the issue in your own words before proposing next steps.";
}

async function endCall(ticket) {
  try {
    await invoke("updateTicket", {
      context: { ticketId: ticket.id },
      body: JSON.stringify({ status: 4 })
    });
  } catch (err) {
    console.error("Freddy CTI: failed to close ticket", err);
  }
  currentTicket = null;
  renderIdle();
}
