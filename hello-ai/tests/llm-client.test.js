import test from "node:test";
import assert from "node:assert/strict";
import { LlmClient } from "../public/assets/js/chat/bot/llm-client.js";

const client = (handler) => new LlmClient({ endpoint: "/x", fetchImpl: async (url, init) => handler(JSON.parse(init.body)) });
const ok = (data) => ({ ok: true, json: async () => data });

test("ask sends the whole hot window and context, returns the reply", async () => {
  let sent;
  const c = client((body) => { sent = body; return ok({ reply: " hi " }); });
  const messages = [{ role: "assistant", content: "a" }, { role: "user", content: "b" }];
  assert.deepEqual(await c.ask({ messages, context: { historicSummary: "s" } }), { reply: "hi" });
  assert.deepEqual(sent, { messages, context: { historicSummary: "s" } });
});

test("ask returns null on http error, empty or rejected replies", async () => {
  assert.equal(await new LlmClient({ endpoint: "/x", fetchImpl: async () => ({ ok: false, status: 500 }) }).ask({ messages: [] }), null);
  assert.equal(await client(() => ok({ reply: "" })).ask({ messages: [] }), null);
  assert.equal(await client(() => ok({ reply: "I am human" })).ask({ messages: [], reject: /human/ }), null);
});

test("summarize sends previousSummary and returns a string or null", async () => {
  let sent;
  const c = client((body) => { sent = body; return ok({ historic: " new " }); });
  assert.equal(await c.summarize({ messages: [{ role: "user", content: "a" }], previousSummary: "old" }), "new");
  assert.equal(sent.action, "historic");
  assert.equal(sent.previousSummary, "old");
  assert.equal(sent.context.historicSummary, "old");
  assert.equal(await client(() => ok({})).summarize({ messages: [{ role: "user", content: "a" }] }), null);
  assert.equal(await client(() => { throw new Error("net"); }).summarize({ messages: [{ role: "user", content: "a" }] }), null);
  assert.equal(await c.summarize({ messages: [] }), null);
});
