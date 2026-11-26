import test from "node:test";
import assert from "node:assert/strict";
import { validateCmsCommissionSubmission } from "../api/_commission-cms.js";

const serviceId = "custom-bgm-loop";
const formVersionId = "11111111-1111-4111-8111-111111111111";
const tosVersionId = "22222222-2222-4222-8222-222222222222";

const schema = {
  fields: [
    { id: "client", label: "Name", type: "text", required: true, system: "name", maxLength: 80 },
    { id: "discord", label: "Discord", type: "text", required: true, system: "contact", maxLength: 120 },
    { id: "license", label: "License", type: "select", required: true, system: "license", options: ["Non-Exclusive","Exclusive"] },
    { id: "brief", label: "Creative brief", type: "textarea", required: true, system: "character", minLength: 20, maxLength: 1500 },
    { id: "reference_link", label: "Reference link", type: "url" }
  ]
};

function mockFetch({ formServiceId = serviceId, terms = true, termsEffectiveAt = "2026-11-26T00:00:00Z" } = {}) {
  return async input => {
    const url = new URL(String(input));
    const table = url.pathname.split("/").pop();
    let rows = [];
    if (table === "services") rows = [{ service_id: serviceId, name: "Custom BGM Loop", status: "published" }];
    if (table === "commission_form_versions") rows = [{
      form_version_id: formVersionId, form_id: "33333333-3333-4333-8333-333333333333",
      version_number: 2, schema, form: { service_id: formServiceId, is_active: true }
    }];
    if (table === "tos_versions" && url.searchParams.get("service_id") === "eq." + serviceId && terms) rows = [{
      tos_version_id: tosVersionId, service_id: serviceId, version_number: 3,
      title: "Custom BGM Terms", agreement_text: "I agree.", effective_at: termsEffectiveAt
    }];
    if (table === "tos_sections") rows = [{
      section_key: "scope", heading: "Scope", content_markdown: "Custom work is scoped in the quotation.", display_order: 0
    }];
    return {
      ok: true,
      status: 200,
      json: async () => rows,
      text: async () => JSON.stringify(rows)
    };
  };
}

const baseData = () => ({
  service_id: serviceId,
  form_version_id: formVersionId,
  tos_version_id: tosVersionId,
  tos_accepted: "true",
  answers: {
    client: "Test Creator",
    discord: "creator#0001",
    license: "Non-Exclusive",
    brief: "A dreamy and warm BGM loop for a cozy stream.",
    reference_link: "https://example.com/reference"
  }
});

test("accepts a valid published form and stores immutable Terms snapshot data", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch();
  try {
    const data = baseData();
    const result = await validateCmsCommissionSubmission({
      data, baseUrl: "https://db.example", headers: { apikey: "test" }
    });
    assert.equal(result.serviceId, serviceId);
    assert.equal(result.formVersionId, formVersionId);
    assert.equal(result.tosVersionId, tosVersionId);
    assert.equal(result.tosAcceptedAt != null, true);
    assert.equal(data.name, "Test Creator");
    assert.equal(data.contact, "creator#0001");
    assert.equal(data.type, "Custom BGM Loop");
    assert.equal(result.submissionSnapshot.terms.version_number, 3);
    assert.equal(result.submissionSnapshot.form.schema.fields.length, 5);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects a published form version assigned to a different service", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch({ formServiceId: "sound-alerts-stinger" });
  try {
    await assert.rejects(
      validateCmsCommissionSubmission({ data: baseData(), baseUrl: "https://db.example", headers: {} }),
      /commission form has changed/i
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("requires acceptance of the current applicable Terms version", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch();
  try {
    const data = baseData();
    data.tos_accepted = "false";
    await assert.rejects(
      validateCmsCommissionSubmission({ data, baseUrl: "https://db.example", headers: {} }),
      /accept the current Terms/i
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects answers outside published select options", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch({ terms: false });
  try {
    const data = baseData();
    data.license = "Unsupported";
    data.answers.license = "Unsupported";
    data.tos_version_id = "";
    data.tos_accepted = "false";
    await assert.rejects(
      validateCmsCommissionSubmission({ data, baseUrl: "https://db.example", headers: {} }),
      /valid option/i
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("rejects overlong answers instead of silently truncating them", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch({ terms: false });
  try {
    const data = baseData();
    data.answers.client = "A".repeat(81);
    data.tos_version_id = "";
    data.tos_accepted = "false";
    await assert.rejects(
      validateCmsCommissionSubmission({ data, baseUrl: "https://db.example", headers: {} }),
      /too long/i
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("does not require future-dated Terms before they become effective", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch({ termsEffectiveAt: "2099-01-01T00:00:00Z" });
  try {
    const data = baseData();
    data.tos_version_id = "";
    data.tos_accepted = "false";
    const result = await validateCmsCommissionSubmission({
      data, baseUrl: "https://db.example", headers: {}
    });
    assert.equal(result.tosVersionId, null);
    assert.equal(result.tosAcceptedAt, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
