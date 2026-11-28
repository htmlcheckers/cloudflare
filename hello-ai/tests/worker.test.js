import test from "node:test";
import assert from "node:assert/strict";
import { serveChatBot } from "../src/chat/handler.js";

const request = (origin) => new Request("https://worker.test/chat", {
  method: "POST",
  headers: { Origin: origin, "Content-Type": "application/json" },
  body: JSON.stringify({ messages: [{ role: "user", content: "hello" }], context: {} })
});

test("ALLOWED_ORIGINS wildcard accepts local origins", async () => {
  const response = await serveChatBot(request("http://localhost:8787"), {
    ALLOWED_ORIGINS: "*",
    AI: { run: async () => ({ response: "hello" }) }
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
});

test("ALLOWED_ORIGINS still restricts requests to configured origins", async () => {
  const env = {
    ALLOWED_ORIGINS: "https://hello-ai.example, https://another.example",
    AI: { run: async () => ({ response: "hello" }) }
  };

  const allowed = await serveChatBot(request("https://another.example"), env);
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get("Access-Control-Allow-Origin"), "https://another.example");

  const rejected = await serveChatBot(request("http://localhost:8787"), env);
  assert.equal(rejected.status, 403);
});
