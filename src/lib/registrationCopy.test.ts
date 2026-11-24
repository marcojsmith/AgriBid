import { describe, expect, it } from "vitest";

import {
  makeDoc,
  makeRegistration,
  SA_DETAILS,
} from "@/pages/register/testing";

import {
  buildStatusBanners,
  buildStatusRows,
  entryStep,
  idKinds,
  idLabel,
  kindTitle,
  registerPath,
  rejectedDocuments,
  safeCallbackPath,
  statusFootnote,
  stepProgress,
} from "./registrationCopy";

const NBSP = " ";
const SENT_AT = Date.UTC(2026, 10, 22, 6, 12); // Sun 22 Nov 2026, 08:12 SAST

describe("safeCallbackPath", () => {
  it.each(["/auction/abc", "/auction/abc?x=1#top", "/"])(
    "accepts %s",
    (url) => {
      expect(safeCallbackPath(url)).toBe(url);
    }
  );

  it.each([
    "//evil.com",
    "/\\evil",
    "https://x",
    "javascript:alert(1)",
    "evil.com",
    "/\t/evil.com",
    "/a\nb",
    "/a b",
    "",
    null,
    undefined,
  ])("rejects %s", (url) => {
    expect(safeCallbackPath(url)).toBeNull();
  });
});

describe("registerPath", () => {
  it("builds step paths and keeps a safe callback URL", () => {
    expect(registerPath("")).toBe("/register");
    expect(registerPath("id", { callbackUrl: "/auction/abc" })).toBe(
      "/register/id?callbackUrl=%2Fauction%2Fabc"
    );
    expect(
      registerPath("address", { callbackUrl: "/auction/abc", replace: true })
    ).toBe("/register/address?callbackUrl=%2Fauction%2Fabc&replace=1");
  });

  it("drops an unsafe callback URL", () => {
    expect(registerPath("status", { callbackUrl: "//evil.com" })).toBe(
      "/register/status"
    );
  });
});

describe("entryStep", () => {
  it.each([
    [{ kind: "incomplete", step: 1, totalSteps: 4 }, "details"],
    [{ kind: "incomplete", step: 2, totalSteps: 3 }, "id"],
    [{ kind: "incomplete", step: 3, totalSteps: 4 }, "address"],
    [{ kind: "under_review", depositReceived: false }, "status"],
    [{ kind: "needs_replacing", count: 1 }, "status"],
    [{ kind: "deposit_due", amount: 5000 }, "status"],
    [{ kind: "ok" }, "status"],
  ] as const)("%j goes to %s", (eligibility, expected) => {
    expect(entryStep(makeRegistration({ eligibility }))).toBe(expected);
  });
});

describe("labels", () => {
  it("names the ID step by ID type", () => {
    expect(idLabel("sa_id")).toBe("ID");
    expect(idLabel(undefined)).toBe("ID");
    expect(idLabel("passport")).toBe("Passport");
  });

  it("lists the ID document kinds", () => {
    expect(idKinds("sa_id")).toEqual(["id_front", "id_back"]);
    expect(idKinds("passport")).toEqual(["passport_photo"]);
    expect(idKinds(undefined)).toEqual(["id_front", "id_back"]);
  });

  it("titles each kind", () => {
    expect(kindTitle("id_front")).toBe("ID front");
    expect(kindTitle("id_back")).toBe("ID back");
    expect(kindTitle("passport_photo")).toBe("Passport photo page");
    expect(kindTitle("proof_of_address")).toBe("Proof of address");
  });
});

describe("stepProgress", () => {
  it("counts 4 steps with the deposit and 3 without", () => {
    const on = makeRegistration();
    const off = makeRegistration({
      depositSettings: { enabled: false, amount: 5000, refundDays: 3 },
    });
    expect(stepProgress("details", on)).toEqual({
      step: 1,
      total: 4,
      label: "Details",
    });
    expect(stepProgress("address", on)).toEqual({
      step: 3,
      total: 4,
      label: "Address",
    });
    expect(stepProgress("deposit", on)).toEqual({
      step: 4,
      total: 4,
      label: "Deposit",
    });
    expect(stepProgress("details", off).total).toBe(3);
    expect(stepProgress("address", off).total).toBe(3);
  });

  it("labels step 2 ID or Passport", () => {
    const sa = makeRegistration({ details: SA_DETAILS });
    const passport = makeRegistration({
      details: { ...SA_DETAILS, idType: "passport" },
    });
    expect(stepProgress("id", sa).label).toBe("ID");
    expect(stepProgress("id", passport).label).toBe("Passport");
  });
});

describe("buildStatusRows", () => {
  it("shows pending documents and an unpaid deposit", () => {
    const rows = buildStatusRows(
      makeRegistration({
        eligibility: { kind: "under_review", depositReceived: false },
        details: SA_DETAILS,
        documents: [
          makeDoc("id_front"),
          makeDoc("id_back"),
          makeDoc("proof_of_address"),
        ],
      })
    );
    expect(rows.map((r) => [r.title, r.sub, r.tone])).toEqual([
      ["Your details", "Saved", "ok"],
      ["ID", "Under review", "pending"],
      ["Proof of address", "Under review", "pending"],
      ["Deposit", `R${NBSP}5${NBSP}000 · not yet received`, "neutral"],
    ]);
    expect(rows[3]?.action).toEqual({ label: "Pay now", step: "deposit" });
  });

  it("flags a rejected document with a Replace action", () => {
    const rows = buildStatusRows(
      makeRegistration({
        eligibility: { kind: "needs_replacing", count: 1 },
        details: SA_DETAILS,
        documents: [
          makeDoc("id_front", "approved"),
          makeDoc("id_back", "approved"),
          makeDoc("proof_of_address", "rejected"),
        ],
      })
    );
    expect(rows[1]).toMatchObject({ sub: "Approved", tone: "ok" });
    expect(rows[2]).toMatchObject({
      sub: "Needs replacing",
      tone: "bad",
      action: { label: "Replace", step: "address", replace: true },
    });
  });

  it("uses Passport as the title and one slot for a passport", () => {
    const rows = buildStatusRows(
      makeRegistration({
        details: { ...SA_DETAILS, idType: "passport" },
        documents: [makeDoc("passport_photo", "rejected")],
      })
    );
    expect(rows[1]).toMatchObject({
      title: "Passport",
      tone: "bad",
      action: { step: "id", replace: true },
    });
  });

  it("says Not uploaded for a missing document", () => {
    const rows = buildStatusRows(
      makeRegistration({
        details: SA_DETAILS,
        documents: [makeDoc("id_front", "approved")],
      })
    );
    expect(rows[1]).toMatchObject({ sub: "Not uploaded", tone: "neutral" });
    expect(rows[2]).toMatchObject({ sub: "Not uploaded", tone: "neutral" });
  });

  it("shows the received deposit with its date", () => {
    const rows = buildStatusRows(
      makeRegistration({
        details: SA_DETAILS,
        deposit: {
          reference: "AB-7K3F2",
          status: "received",
          amount: 5000,
          receivedAt: Date.UTC(2026, 10, 22, 8, 40),
        },
      })
    );
    expect(rows[3]).toMatchObject({
      sub: `R${NBSP}5${NBSP}000 received Sun 22 Nov, 10:40`,
      tone: "ok",
    });
    expect(rows[3]?.action).toBeUndefined();
  });

  it("says received without a date when none is stored", () => {
    const rows = buildStatusRows(
      makeRegistration({
        deposit: {
          reference: "AB-7K3F2",
          status: "received",
          amount: 5000,
        },
      })
    );
    expect(rows[3]?.sub).toBe(`R${NBSP}5${NBSP}000 received`);
  });

  it("keeps Pay now for a refunded deposit", () => {
    const rows = buildStatusRows(
      makeRegistration({
        deposit: { reference: "AB-7K3F2", status: "refunded", amount: 4000 },
      })
    );
    expect(rows[3]).toMatchObject({
      sub: `R${NBSP}4${NBSP}000 · not yet received`,
      action: { label: "Pay now" },
    });
  });

  it("says the payment is being checked, with no Pay now, once it is claimed", () => {
    const rows = buildStatusRows(
      makeRegistration({
        deposit: {
          reference: "AB-7K3F2",
          status: "paid_claimed",
          amount: 5000,
        },
      })
    );
    expect(rows[3]).toMatchObject({
      sub: `R${NBSP}5${NBSP}000 · payment being checked`,
      tone: "neutral",
    });
    expect(rows[3]).not.toHaveProperty("action");
  });

  it("has no deposit row when the deposit is off", () => {
    const rows = buildStatusRows(
      makeRegistration({
        depositSettings: { enabled: false, amount: 5000, refundDays: 3 },
      })
    );
    expect(rows.map((r) => r.key)).toEqual([
      "details",
      "id",
      "proof_of_address",
    ]);
  });
});

describe("buildStatusBanners and statusFootnote", () => {
  it("under review without a deposit: info with the sent time", () => {
    const reg = makeRegistration({
      eligibility: { kind: "under_review", depositReceived: false },
      submittedAt: SENT_AT,
    });
    expect(buildStatusBanners(reg)).toEqual([
      {
        kind: "info",
        text: "Documents sent Sun 22 Nov, 08:12. We check them within 2 business days.",
      },
    ]);
    expect(statusFootnote(reg)).toBe("We notify you when it's done.");
  });

  it("under review without a sent time (legacy): no date", () => {
    const reg = makeRegistration({
      eligibility: { kind: "under_review", depositReceived: false },
    });
    expect(buildStatusBanners(reg)[0]?.text).toBe(
      "Documents sent. We check them within 2 business days."
    );
  });

  it("under review with the deposit received: ok banner and bidding note", () => {
    const reg = makeRegistration({
      eligibility: { kind: "under_review", depositReceived: true },
    });
    expect(buildStatusBanners(reg)).toEqual([
      { kind: "ok", text: "Deposit received" },
    ]);
    expect(statusFootnote(reg)).toBe(
      "Bidding opens when your documents are approved."
    );
  });

  it("needs replacing: singular and plural", () => {
    expect(
      buildStatusBanners(
        makeRegistration({ eligibility: { kind: "needs_replacing", count: 1 } })
      )
    ).toEqual([{ kind: "warn", text: "One document needs replacing" }]);
    expect(
      buildStatusBanners(
        makeRegistration({ eligibility: { kind: "needs_replacing", count: 2 } })
      )
    ).toEqual([{ kind: "warn", text: "2 documents need replacing" }]);
  });

  it("ok: You can bid, and no footnote", () => {
    const reg = makeRegistration({ eligibility: { kind: "ok" } });
    expect(buildStatusBanners(reg)).toEqual([
      { kind: "ok", text: "You can bid" },
    ]);
    expect(statusFootnote(reg)).toBeNull();
  });

  it("deposit due: asks for the deposit", () => {
    expect(
      buildStatusBanners(
        makeRegistration({ eligibility: { kind: "deposit_due", amount: 5000 } })
      )
    ).toEqual([
      { kind: "info", text: `Pay your R${NBSP}5${NBSP}000 deposit to bid.` },
    ]);
  });

  it("incomplete: no banner", () => {
    expect(buildStatusBanners(makeRegistration())).toEqual([]);
  });
});

describe("rejectedDocuments", () => {
  it("lists rejected documents with reason and time", () => {
    const reg = makeRegistration({
      documents: [
        makeDoc("id_front", "approved"),
        makeDoc("proof_of_address", "rejected", {
          rejectionReason: "The bill is older than 3 months.",
          reviewedAt: 123,
        }),
        makeDoc("id_back", "rejected"),
      ],
    });
    expect(rejectedDocuments(reg)).toEqual([
      {
        kind: "proof_of_address",
        title: "Proof of address",
        reason: "The bill is older than 3 months.",
        reviewedAt: 123,
      },
      {
        kind: "id_back",
        title: "ID back",
        reason: "This document couldn't be accepted. Replace it.",
        reviewedAt: undefined,
      },
    ]);
  });
});
