# Product Requirements Document

## Freddy Voice Copilot — AI-Assisted Voice Support for Freshdesk

**Version:** 1.0 (Hackathon Draft)
**Date:** 2026-09-25
**Author:** Sangeetha S

---

## 1. Overview

Freddy Voice Copilot is an AI-powered voice support layer built on top of Freshdesk. Customers call a dedicated phone number (provisioned via Vobiz); an ElevenLabs conversational voice agent, branded **Freddy**, answers the call, understands the customer's issue and emotional state, and attempts to resolve it directly. If Freddy cannot resolve the issue, the call is handed off to a human agent along with a structured context package. During the live human-agent call, Freddy continues running in the background as a real-time copilot, surfacing customer history, recommended actions, compliance alerts, and live coaching — reducing the agent's cognitive load and manual work so they can resolve the issue faster and more effectively.

**Positioning note:** Freddy is designed to reduce human agents' workload, not replace them. The AI handles resolvable issues and does the upfront legwork (context gathering, history summarization, sentiment reading) so agents spend their time on judgment and conversation, not repetitive lookup and re-explaining.

## 2. Problem Statement

Customers calling support today face two recurring failures:
1. They repeat their issue multiple times as calls move from IVR → bot → human agent, with no context carried forward.
2. Human agents receive calls cold — no visibility into what was already tried, what the customer's emotional state is, or what the right next step should be — leading to slower resolution, inconsistent service quality, and unnecessary manual work re-gathering context that already exists.

## 3. Goals

- Resolve as many customer issues as possible autonomously via voice AI before human involvement.
- Reduce the manual workload on human agents by having Freddy do the context-gathering, summarization, and sentiment reading upfront — not replace the agent's role.
- Eliminate repeated-context friction by carrying a structured issue summary into every human handoff.
- Give human agents real-time situational awareness and guidance during the call to improve resolution speed and quality.
- Demonstrate a working, end-to-end voice-to-human handoff loop integrated with Freshdesk.

## 4. Non-Goals / Out of Scope

- Replacing human agents — Freddy augments and reduces their workload, it does not remove them from the loop.
- Supporting channels other than voice calls (chat, email) in this version.
- Building a new telephony network — Vobiz is the phone number/call provider.
- Full compliance certification (e.g., formal PCI/HIPAA audit) — only alerting/flagging is in scope, not enforcement.

## 5. Users / Personas

| Persona | Description | Needs |
|---|---|---|
| Customer | Calls in with a support issue | Fast resolution, doesn't want to repeat themselves, wants to be heard/understood |
| Freddy (AI Voice Copilot) | ElevenLabs-powered voice agent | Understand issue + emotion, resolve if possible, produce clean handoff data |
| Human Support Agent | Receives escalated calls via Freshdesk | Context before picking up, live guidance while on the call, less manual repetitive work |

## 6. System Components

1. **Telephony layer (Vobiz):** Receives inbound calls to the dedicated number, routes audio to the voice AI, and later bridges/forwards the call to a human agent's line.
2. **Voice AI Agent (Freddy — ElevenLabs):** Handles the live conversation with the customer: speech understanding, response generation, resolution attempts, sentiment/emotion detection.
3. **Freshdesk (API/MCP):** Ticket creation, contact/customer record lookup, storing conversation transcripts, surfacing the agent-facing UI/context.
4. **Handoff/Context Engine:** Assembles the structured handoff package and pushes it to the agent interface before/at call bridge time.
5. **Live Copilot Sidebar (Agent-facing UI):** Displays real-time customer history, next-best-step, compliance alerts, and live coaching during the human-agent call.

## 7. Functional Requirements

### 7.1 Inbound Call Handling
- Customer dials the Vobiz-provisioned number.
- Call is routed to Freddy (ElevenLabs voice agent).
- Freddy greets the customer and begins the conversation.

### 7.2 AI Resolution Attempt (Freddy)
- Freddy listens to and understands the customer's issue via natural conversation.
- Freddy performs real-time sentiment/emotion analysis throughout the call.
- Freddy attempts to resolve the issue directly (using Freshdesk data/knowledge as needed).
- If resolved: call can end normally, with a ticket logged in Freshdesk documenting the interaction.
- If Freddy determines it cannot resolve the issue, it triggers escalation to a human agent.

### 7.3 Escalation / Handoff Package
When Freddy escalates, it must generate and pass along a structured summary containing exactly:
1. **Contact details** — who the customer is (name, account/contact ID, phone number, any Freshdesk contact record match).
2. **Issue type** — categorized issue/topic.
3. **Issue description** — the specific description of the problem Freddy was unable to resolve.
4. **Sentiment/issue severity** — the customer's detected emotional state / sentiment reading.

This package is attached to the call/ticket and made available to the receiving human agent.

### 7.4 Pre-Pickup Context Screen (10-second window)
- Before the call is connected to the human agent (i.e., during ring/forward), the agent is shown the handoff package (from 7.3) for approximately 10 seconds.
- Purpose: give the agent enough time to read and mentally prepare before the call connects, so they don't start the conversation cold and don't have to manually ask for the same details again.

### 7.5 Live In-Call Copilot (Human Agent Assist)
While the human agent is on the call with the customer, Freddy continues running in the background and provides, in real time:
1. **Summarized customer past history** — prior tickets/interactions relevant to this customer.
2. **Next best step** — a recommended action/response for the agent to take.
3. **Risk/compliance alerts** — flags raised when the conversation touches risk-sensitive or compliance-relevant topics.
4. **Live coaching** — real-time guidance/prompts to help the agent handle the conversation effectively (e.g., tone suggestions, de-escalation prompts).

This layer is designed to take repetitive lookup and analysis work off the agent's plate, letting them focus on the conversation itself.

### 7.6 Resolution & Ticket Closure
- Human agent resolves the issue using the live copilot's assistance.
- Full interaction (AI portion + human portion, transcript, sentiment trail, actions taken) is logged back to the Freshdesk ticket for record-keeping.

## 8. Non-Functional Requirements

- **Latency:** Voice AI responses and live-agent-assist updates must feel conversational — noticeable lag breaks the experience, especially during the live coaching phase.
- **Reliability:** Call handoff must not drop the customer or lose context if Freddy escalates.
- **Data continuity:** All context generated by Freddy (contact info, issue, sentiment, history) must persist and be retrievable through Freshdesk so nothing is lost between AI and human phases.
- **Security/Privacy:** Customer conversation data (including sentiment/emotion data) must be handled and stored consistent with standard data-handling practice, since it includes personal and potentially sensitive conversational content.

## 9. Data Requirements

- Customer contact record (matched or created in Freshdesk).
- Call transcript (AI segment + human segment).
- Issue classification/type taxonomy.
- Sentiment/emotion readings, tracked over time across the call.
- Ticket record linking all of the above, accessible via Freshdesk.

## 10. Success Metrics

- **AI resolution rate:** % of calls Freddy resolves without human handoff.
- **Handoff context completeness:** % of escalations that carry all 4 required handoff fields.
- **Time-to-context:** Confirming the 10-second pre-pickup window is consistently delivered before connect.
- **Agent workload reduction:** Reduction in manual context-gathering/lookup time per call, enabled by the copilot.
- **Agent-assist engagement:** Usage/interaction with next-best-step and coaching prompts during live calls.
- **Resolution time (human phase):** Time from call connect to resolution, with vs. without copilot assist (directional, for demo purposes).

## 11. Assumptions & Dependencies

- Vobiz supports the call-control capabilities needed to route inbound calls to the voice AI and later forward/bridge to a human agent line, with a controllable delay/context window before connecting.
- ElevenLabs agent (Freddy) can be configured with the conversational logic needed for issue resolution and sentiment detection.
- Freshdesk API/MCP access is available for contact lookup, ticket creation/update, and surfacing data to an agent-facing interface.
- A human-agent-facing interface (custom UI or Freshdesk app) exists or will be built to display the pre-pickup screen and live copilot sidebar.

## 12. Risks

- Real-time live coaching during an active human call is the most technically demanding component (continuous speech understanding + inference while a call is live).
- Pre-pickup timing (10-second context window) depends on what call-control hooks Vobiz actually exposes.
- Sentiment/emotion detection accuracy affects the reliability of both the handoff package and live coaching prompts.

## 13. Milestones (Hackathon Scope)

1. Inbound call → Freddy conversation → resolution or escalation trigger.
2. Escalation handoff package (contact details, issue type, issue description, sentiment) generated and passed to agent view.
3. 10-second pre-pickup context screen for the human agent.
4. Live copilot sidebar during the human call: customer history summary, next-best-step, risk/compliance alerts, live coaching.
5. Ticket logging back into Freshdesk for the full interaction.

## 14. Future Considerations

- Expansion to chat/email channels using the same copilot architecture.
- Deeper compliance rule engine beyond flagging.
- Post-call analytics/reporting on AI resolution rates and agent workload/performance improvement from copilot assist.
