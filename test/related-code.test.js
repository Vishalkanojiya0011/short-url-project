import assert from "node:assert/strict";
import test from "node:test";
import { createRelatedCode } from "../src/app.js";

test("generates a compact short code related to the destination hostname", () => {
  const code = createRelatedCode("https://www.youtube.com/watch?v=example");

  assert.match(code, /^youtube-[A-Za-z0-9_-]{3}$/);
});

test("handles destination hostnames that do not start with a letter", () => {
  const code = createRelatedCode("https://127.0.0.1:8080/long/path");

  assert.match(code, /^127-[A-Za-z0-9_-]{3}$/);
});
