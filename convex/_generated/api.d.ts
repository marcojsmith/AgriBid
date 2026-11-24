/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as admin_categories from "../admin/categories.js";
import type * as admin_equipmentMetadata from "../admin/equipmentMetadata.js";
import type * as admin_faq from "../admin/faq.js";
import type * as admin_fees from "../admin/fees.js";
import type * as admin_kyc from "../admin/kyc.js";
import type * as admin_legal from "../admin/legal.js";
import type * as admin_mutations from "../admin/mutations.js";
import type * as admin_platformSettings from "../admin/platformSettings.js";
import type * as admin_queries from "../admin/queries.js";
import type * as admin_settings from "../admin/settings.js";
import type * as admin_statistics from "../admin/statistics.js";
import type * as admin_debug from "../admin_debug.js";
import type * as admin_utils from "../admin_utils.js";
import type * as auctions from "../auctions.js";
import type * as auctions_helpers from "../auctions/helpers.js";
import type * as auctions_internal from "../auctions/internal.js";
import type * as auctions_mutations_adminCrud from "../auctions/mutations/adminCrud.js";
import type * as auctions_mutations_assignment from "../auctions/mutations/assignment.js";
import type * as auctions_mutations_bidding from "../auctions/mutations/bidding.js";
import type * as auctions_mutations_create from "../auctions/mutations/create.js";
import type * as auctions_mutations_delete from "../auctions/mutations/delete.js";
import type * as auctions_mutations_consideration from "../auctions/mutations/consideration.js";
import type * as auctions_mutations_publish from "../auctions/mutations/publish.js";
import type * as auctions_mutations_update from "../auctions/mutations/update.js";
import type * as auctions_proxy_bidding from "../auctions/proxy_bidding.js";
import type * as auctions_queries from "../auctions/queries.js";
import type * as auctions_queries_admin from "../auctions/queries/admin.js";
import type * as auctions_queries_bids from "../auctions/queries/bids.js";
import type * as auctions_queries_browse from "../auctions/queries/browse.js";
import type * as auctions_queries_eventLots from "../auctions/queries/eventLots.js";
import type * as auctions_queries_events from "../auctions/queries/events.js";
import type * as auctions_queries_homeLots from "../auctions/queries/homeLots.js";
import type * as auctions_queries_index from "../auctions/queries/index.js";
import type * as auctions_queries_listings from "../auctions/queries/listings.js";
import type * as auctions_queries_lotPage from "../auctions/queries/lotPage.js";
import type * as auctions_queries_shared from "../auctions/queries/shared.js";
import type * as config from "../config.js";
import type * as constants from "../constants.js";
import type * as cronJobs from "../cronJobs.js";
import type * as cronRegistry from "../cronRegistry.js";
import type * as crons from "../crons.js";
import type * as documents from "../documents.js";
import type * as documentsHttp from "../documentsHttp.js";
import type * as engagement from "../engagement.js";
import type * as errors from "../errors.js";
import type * as faq from "../faq.js";
import type * as http from "../http.js";
import type * as image_cache from "../image_cache.js";
import type * as legal from "../legal.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_bidEligibility from "../lib/bidEligibility.js";
import type * as lib_bidGuard from "../lib/bidGuard.js";
import type * as lib_buyerPremium from "../lib/buyerPremium.js";
import type * as lib_cors from "../lib/cors.js";
import type * as lib_documentCrypto from "../lib/documentCrypto.js";
import type * as lib_documentSniff from "../lib/documentSniff.js";
import type * as lib_encryption from "../lib/encryption.js";
import type * as lib_errorFingerprint from "../lib/errorFingerprint.js";
import type * as lib_errorRateLimit from "../lib/errorRateLimit.js";
import type * as lib_errorSanitization from "../lib/errorSanitization.js";
import type * as lib_githubIssueFormatting from "../lib/githubIssueFormatting.js";
import type * as lib_legalPages from "../lib/legalPages.js";
import type * as lib_legalTemplates from "../lib/legalTemplates.js";
import type * as lib_lotCounters from "../lib/lotCounters.js";
import type * as lib_lotSpecs from "../lib/lotSpecs.js";
import type * as lib_pagination from "../lib/pagination.js";
import type * as lib_pushDelivery from "../lib/pushDelivery.js";
import type * as lib_registration from "../lib/registration.js";
import type * as lib_provinces from "../lib/provinces.js";
import type * as lib_reserve from "../lib/reserve.js";
import type * as lib_seedCounters from "../lib/seedCounters.js";
import type * as lib_sellerCommission from "../lib/sellerCommission.js";
import type * as lib_sellerVat from "../lib/sellerVat.js";
import type * as lib_storage from "../lib/storage.js";
import type * as lib_userNames from "../lib/userNames.js";
import type * as lib_wbtImport from "../lib/wbtImport.js";
import type * as lots_mutations_helpers from "../lots/mutations/helpers.js";
import type * as lots_mutations_lifecycle from "../lots/mutations/lifecycle.js";
import type * as messages from "../messages.js";
import type * as migrations from "../migrations.js";
import type * as notifications from "../notifications.js";
import type * as presence from "../presence.js";
import type * as push from "../push.js";
import type * as pushNode from "../pushNode.js";
import type * as profileFlags from "../profileFlags.js";
import type * as registration from "../registration.js";
import type * as reviews from "../reviews.js";
import type * as seed from "../seed.js";
import type * as share from "../share.js";
import type * as storageCleanup from "../storageCleanup.js";
import type * as support from "../support.js";
import type * as transport from "../transport.js";
import type * as userActivity from "../userActivity.js";
import type * as userPreferences from "../userPreferences.js";
import type * as users from "../users.js";
import type * as watchlist from "../watchlist.js";
import type * as watchAlerts from "../watchAlerts.js";
import type * as wbtDemo from "../wbtDemo.js";
import type * as wbtImport from "../wbtImport.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  "admin/categories": typeof admin_categories;
  "admin/equipmentMetadata": typeof admin_equipmentMetadata;
  "admin/faq": typeof admin_faq;
  "admin/fees": typeof admin_fees;
  "admin/kyc": typeof admin_kyc;
  "admin/legal": typeof admin_legal;
  "admin/mutations": typeof admin_mutations;
  "admin/platformSettings": typeof admin_platformSettings;
  "admin/queries": typeof admin_queries;
  "admin/settings": typeof admin_settings;
  "admin/statistics": typeof admin_statistics;
  admin_debug: typeof admin_debug;
  admin_utils: typeof admin_utils;
  auctions: typeof auctions;
  "auctions/helpers": typeof auctions_helpers;
  "auctions/internal": typeof auctions_internal;
  "auctions/mutations/adminCrud": typeof auctions_mutations_adminCrud;
  "auctions/mutations/assignment": typeof auctions_mutations_assignment;
  "auctions/mutations/bidding": typeof auctions_mutations_bidding;
  "auctions/mutations/create": typeof auctions_mutations_create;
  "auctions/mutations/delete": typeof auctions_mutations_delete;
  "auctions/mutations/consideration": typeof auctions_mutations_consideration;
  "auctions/mutations/publish": typeof auctions_mutations_publish;
  "auctions/mutations/update": typeof auctions_mutations_update;
  "auctions/proxy_bidding": typeof auctions_proxy_bidding;
  "auctions/queries": typeof auctions_queries;
  "auctions/queries/admin": typeof auctions_queries_admin;
  "auctions/queries/bids": typeof auctions_queries_bids;
  "auctions/queries/browse": typeof auctions_queries_browse;
  "auctions/queries/eventLots": typeof auctions_queries_eventLots;
  "auctions/queries/events": typeof auctions_queries_events;
  "auctions/queries/homeLots": typeof auctions_queries_homeLots;
  "auctions/queries/index": typeof auctions_queries_index;
  "auctions/queries/listings": typeof auctions_queries_listings;
  "auctions/queries/lotPage": typeof auctions_queries_lotPage;
  "auctions/queries/shared": typeof auctions_queries_shared;
  config: typeof config;
  constants: typeof constants;
  cronJobs: typeof cronJobs;
  cronRegistry: typeof cronRegistry;
  crons: typeof crons;
  documents: typeof documents;
  documentsHttp: typeof documentsHttp;
  engagement: typeof engagement;
  errors: typeof errors;
  faq: typeof faq;
  http: typeof http;
  image_cache: typeof image_cache;
  legal: typeof legal;
  "lib/auth": typeof lib_auth;
  "lib/bidEligibility": typeof lib_bidEligibility;
  "lib/bidGuard": typeof lib_bidGuard;
  "lib/buyerPremium": typeof lib_buyerPremium;
  "lib/cors": typeof lib_cors;
  "lib/documentCrypto": typeof lib_documentCrypto;
  "lib/documentSniff": typeof lib_documentSniff;
  "lib/encryption": typeof lib_encryption;
  "lib/errorFingerprint": typeof lib_errorFingerprint;
  "lib/errorRateLimit": typeof lib_errorRateLimit;
  "lib/errorSanitization": typeof lib_errorSanitization;
  "lib/githubIssueFormatting": typeof lib_githubIssueFormatting;
  "lib/legalPages": typeof lib_legalPages;
  "lib/legalTemplates": typeof lib_legalTemplates;
  "lib/lotCounters": typeof lib_lotCounters;
  "lib/lotSpecs": typeof lib_lotSpecs;
  "lib/pagination": typeof lib_pagination;
  "lib/pushDelivery": typeof lib_pushDelivery;
  "lib/registration": typeof lib_registration;
  "lib/provinces": typeof lib_provinces;
  "lib/reserve": typeof lib_reserve;
  "lib/seedCounters": typeof lib_seedCounters;
  "lib/sellerCommission": typeof lib_sellerCommission;
  "lib/sellerVat": typeof lib_sellerVat;
  "lib/storage": typeof lib_storage;
  "lib/userNames": typeof lib_userNames;
  "lib/wbtImport": typeof lib_wbtImport;
  "lots/mutations/helpers": typeof lots_mutations_helpers;
  "lots/mutations/lifecycle": typeof lots_mutations_lifecycle;
  messages: typeof messages;
  migrations: typeof migrations;
  notifications: typeof notifications;
  presence: typeof presence;
  push: typeof push;
  pushNode: typeof pushNode;
  profileFlags: typeof profileFlags;
  registration: typeof registration;
  reviews: typeof reviews;
  seed: typeof seed;
  share: typeof share;
  storageCleanup: typeof storageCleanup;
  support: typeof support;
  transport: typeof transport;
  userActivity: typeof userActivity;
  userPreferences: typeof userPreferences;
  users: typeof users;
  watchlist: typeof watchlist;
  watchAlerts: typeof watchAlerts;
  wbtDemo: typeof wbtDemo;
  wbtImport: typeof wbtImport;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
