/**
 * Starter templates for the three legal pages.
 *
 * These are DRAFT OUTLINES, not legal text: headings for the topics a South
 * African online auction platform normally needs to cover (POPIA, PAIA, CPA,
 * ECTA) with bracketed guidance beneath each. They must be completed and
 * reviewed by a qualified legal practitioner before an admin publishes them.
 */

/** The slugs of the legal pages, in footer order. */
export const LEGAL_SLUGS = ["terms", "privacy", "paia"] as const;

/** A legal page slug. */
export type LegalSlug = (typeof LEGAL_SLUGS)[number];

/** Maximum length of a legal page title, in characters. */
export const LEGAL_TITLE_MAX_LENGTH = 200;

/** Maximum length of a legal page body (markdown), in characters. */
export const LEGAL_BODY_MAX_LENGTH = 100_000;

/** Text that marks a page as an unreviewed draft; publishing is refused while it is present. */
export const DRAFT_NOTICE_MARKER = "Draft, needs legal review";

/** Banner placed at the top of every starter template. */
const DRAFT_NOTICE =
  "> **Draft, needs legal review.** This is a starter outline, not final legal text. Replace every bracketed note with reviewed wording before publishing.";

/** A starter template for one legal page. */
export interface LegalTemplate {
  slug: LegalSlug;
  title: string;
  body: string;
}

const TERMS_BODY = `${DRAFT_NOTICE}

## 1. About these terms

[State who operates the platform (registered company name, registration number, address) and that using the platform means accepting these terms.]

## 2. Definitions

[Define buyer, seller, lot, sale, reserve price, buyer's premium and other terms used below.]

## 3. Accounts and verification

[Describe registration, identity and FICA verification, and the accuracy of information users provide.]

## 4. Bidding

[Explain how bids work: increments, proxy bids, soft close, and that a bid is a binding offer.]

## 5. Reserve prices and winning bids

[Explain how a lot is sold or passed, and when a contract of sale forms between buyer and seller.]

## 6. Fees, commission and VAT

[List the buyer's premium, seller commission and listing fees, and how VAT is applied.]

## 7. Payment, collection and risk

[Describe payment deadlines, collection arrangements, and when risk and ownership pass to the buyer.]

## 8. Seller obligations

[Describe listing accuracy, condition disclosure, title to the goods, and the seller's duty to deliver.]

## 9. Consumer rights (Consumer Protection Act)

[Explain which Consumer Protection Act (CPA) rights apply to auctions and which do not, and the cooling-off position for electronic transactions.]

## 10. Electronic communications (ECTA)

[Confirm that electronic communications and records are valid under the Electronic Communications and Transactions Act (ECTA), and set out the information required for electronic transactions.]

## 11. Prohibited conduct

[List shill bidding, bid manipulation, fraudulent listings and other conduct that leads to suspension.]

## 12. Liability and disclaimers

[Describe the platform's role as a venue, its limits of liability, and any warranty disclaimers permitted by law.]

## 13. Disputes and governing law

[Set out the complaints process, dispute resolution and that South African law governs.]

## 14. Changes to these terms

[Explain how changes are notified and when they take effect.]

## 15. Contact

[Provide contact details for questions about these terms.]
`;

const PRIVACY_BODY = `${DRAFT_NOTICE}

## 1. Who we are

[Identify the responsible party under the Protection of Personal Information Act (POPIA), including the Information Officer and contact details.]

## 2. Personal information we collect

[Describe the personal information collected from bidders and sellers: identity and FICA documents, contact details, bank details, bidding history, device and usage data.]

## 3. Why we process it

[State each purpose and its lawful basis under POPIA: running auctions, verifying identity, preventing fraud, billing, legal obligations.]

## 4. Who we share it with

[List the categories of recipients: other parties to a sale, payment and verification providers, hosting and analytics providers, regulators.]

## 5. Cross-border transfers

[Describe whether personal information is stored or processed outside South Africa and the safeguards that apply.]

## 6. How long we keep it

[Describe retention periods and the reasons for them.]

## 7. Security

[Describe the technical and organisational measures that protect personal information, and how breaches are handled and reported.]

## 8. Your rights

[Explain the right to access, correct and delete personal information, to object to processing, and to withdraw consent.]

## 9. Cookies and analytics

[Describe the cookies and analytics tools in use and how a user can control them.]

## 10. Children

[State the minimum age for using the platform.]

## 11. Complaints

[Explain how to complain to the Information Officer and to the Information Regulator, with contact details.]

## 12. Changes to this policy

[Explain how changes are notified.]
`;

const PAIA_BODY = `${DRAFT_NOTICE}

## 1. Introduction

[Introduce this manual, prepared under section 51 of the Promotion of Access to Information Act (PAIA), and the company it covers.]

## 2. Company contact details

[Give the company name, head of the private body, Information Officer, postal and street address, phone, email and website.]

## 3. The Information Regulator's guide

[Explain how to obtain the guide on how to use PAIA from the Information Regulator, with its contact details.]

## 4. Records automatically available

[List any records available without a formal request.]

## 5. Records held by the company

[List the categories of records held: corporate records, user and transaction records, financial records, HR records, policies, and similar.]

## 6. Records available under other legislation

[List other laws that require or permit access to records held.]

## 7. Personal information processed (POPIA)

[Describe the purpose of processing, categories of data subjects and information, recipients, cross-border transfers and security measures, as POPIA requires in this manual.]

## 8. How to request access

[Describe the prescribed request form, the information to include, how to submit it and how identity is verified.]

## 9. Fees

[Describe the request fee and access fees, and the deposit position.]

## 10. Decisions and remedies

[Describe the response period, extensions, refusal grounds, and the right to complain to the Information Regulator or apply to court.]

## 11. Availability and updates

[State where the manual is available and when it was last updated.]
`;

/** The three starter templates in footer order. */
export const LEGAL_TEMPLATE_LIST: LegalTemplate[] = [
  { slug: "terms", title: "Terms and conditions", body: TERMS_BODY },
  { slug: "privacy", title: "Privacy policy", body: PRIVACY_BODY },
  { slug: "paia", title: "PAIA manual", body: PAIA_BODY },
];

/** The three starter templates, keyed by slug. */
export const LEGAL_TEMPLATES: Record<LegalSlug, LegalTemplate> = {
  terms: {
    slug: "terms",
    title: "Terms and conditions",
    body: TERMS_BODY,
  },
  privacy: {
    slug: "privacy",
    title: "Privacy policy",
    body: PRIVACY_BODY,
  },
  paia: {
    slug: "paia",
    title: "PAIA manual",
    body: PAIA_BODY,
  },
};
