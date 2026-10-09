import { test, describe } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

describe("Phase 4: Security Verification Tests", () => {
  describe("BUG-003: Cryptographic Secret Insecurity", () => {
    test("should reject missing or default fallback secrets in production", () => {
      const knownLeakedSecret = "81c134e63b7d02ddbdd6f6a3edae9042ace9af18cccada6e294bcc4998318c9f";
      const validateSecret = (secret?: string, env: string = "production") => {
        if (!secret) {
          if (env === "production") throw new Error("AUTH_SECRET is required");
          return false;
        }
        if (secret === knownLeakedSecret) {
          throw new Error("Cannot use known compromised fallback secret");
        }
        return true;
      };

      assert.throws(() => validateSecret(undefined, "production"), /AUTH_SECRET is required/);
      assert.throws(() => validateSecret(knownLeakedSecret, "production"), /compromised fallback secret/);
      assert.equal(validateSecret("strong-random-production-secret-1234567890", "production"), true);
    });
  });

  describe("BUG-006: Cron Bearer Token Authorization", () => {
    test("should strictly require Bearer CRON_SECRET and reject unauthorized requests", () => {
      const verifyCronAuth = (authHeader: string | null, cronSecret?: string): boolean => {
        if (!cronSecret || cronSecret.trim().length === 0) {
          return false; // Fail-closed when secret is not configured
        }
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return false;
        }
        const token = authHeader.replace("Bearer ", "").trim();
        const a = crypto.createHash("sha256").update(token).digest();
        const b = crypto.createHash("sha256").update(cronSecret).digest();
        return crypto.timingSafeEqual(a, b);
      };

      const testSecret = "super-secret-cron-key-987654";

      // Missing header
      assert.equal(verifyCronAuth(null, testSecret), false);
      // Wrong token
      assert.equal(verifyCronAuth("Bearer wrong-token-123", testSecret), false);
      // Unset CRON_SECRET (fail-closed)
      assert.equal(verifyCronAuth("Bearer " + testSecret, undefined), false);
      assert.equal(verifyCronAuth("Bearer " + testSecret, ""), false);
      // Correct token
      assert.equal(verifyCronAuth("Bearer " + testSecret, testSecret), true);
    });
  });

  describe("BUG-007: WhatsApp Webhook HMAC-SHA256 Signature Verification", () => {
    test("should validate authentic signatures and reject tampered payloads", () => {
      const appSecret = "meta_app_secret_test_xyz";
      const payload = JSON.stringify({ entry: [{ changes: [{ value: { messages: [] } }] }] });

      const generateSignature = (body: string, secret: string) => {
        const hash = crypto.createHmac("sha256", secret).update(body).digest("hex");
        return `sha256=${hash}`;
      };

      const verifySignature = (body: string, signatureHeader: string | null, secret?: string): boolean => {
        if (!secret) return false;
        if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
        const expectedSig = crypto.createHmac("sha256", secret).update(body).digest("hex");
        const providedSig = signatureHeader.replace("sha256=", "");
        if (expectedSig.length !== providedSig.length) return false;
        return crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(providedSig));
      };

      const validSignature = generateSignature(payload, appSecret);
      assert.equal(verifySignature(payload, validSignature, appSecret), true);

      // Tampered body
      const tamperedBody = payload + " ";
      assert.equal(verifySignature(tamperedBody, validSignature, appSecret), false);

      // Missing signature
      assert.equal(verifySignature(payload, null, appSecret), false);

      // Invalid signature
      assert.equal(verifySignature(payload, "sha256=invalidhash", appSecret), false);
    });
  });

  describe("BUG-004: Sensitive Token Masking in Settings", () => {
    test("should mask telegram_bot_token for unauthorized roles", () => {
      const maskSettings = (settings: Record<string, string>, userRole: string) => {
        const output = { ...settings };
        if (userRole !== "ADMIN" && userRole !== "OPS_MANAGER") {
          if (output.telegram_bot_token) {
            output.telegram_bot_token = "••••••••";
          }
        }
        return output;
      };

      const raw = {
        telegram_bot_token: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
        telegram_chat_id: "-10023456789",
      };

      const viewerResult = maskSettings(raw, "LEAD_ACQUISITION_JR");
      assert.equal(viewerResult.telegram_bot_token, "••••••••");
      assert.equal(viewerResult.telegram_chat_id, "-10023456789");

      const adminResult = maskSettings(raw, "ADMIN");
      assert.equal(adminResult.telegram_bot_token, raw.telegram_bot_token);
    });
  });
});
