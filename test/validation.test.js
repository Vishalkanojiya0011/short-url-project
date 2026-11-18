import assert from "node:assert/strict";
import test from "node:test";
import { validateDestination, validateShortCode } from "../src/validation.js";

test("accepts and normalizes HTTP and HTTPS destinations", () => {
  assert.deepEqual(validateDestination("https://example.com/a"), {
    value: "https://example.com/a",
  });
  assert.deepEqual(validateDestination("http://example.com"), {
    value: "http://example.com/",
  });
});

test("rejects missing, malformed, and unsafe destination URLs", () => {
  assert.equal(validateDestination("").error, "url is required and must be a non-empty string");
  assert.equal(validateDestination("example.com").error, "url must be a valid absolute URL");
  assert.equal(validateDestination("javascript:alert(1)").error, "url must use http or https");
});

test("accepts an omitted or valid custom short code", () => {
  assert.deepEqual(validateShortCode(undefined), {});
  assert.deepEqual(validateShortCode("my-link_2"), { value: "my-link_2" });
});

test("rejects custom short codes outside the supported format", () => {
  assert.ok(validateShortCode("ab").error);
  assert.ok(validateShortCode("bad code").error);
  assert.ok(validateShortCode("a".repeat(33)).error);
  assert.ok(validateShortCode("health").error);
  assert.ok(validateShortCode("HEALTH").error);
});
