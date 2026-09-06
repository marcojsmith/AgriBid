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
import type * as admin_mutations from "../admin/mutations.js";
import type * as admin_queries from "../admin/queries.js";
import type * as admin_settings from "../admin/settings.js";
import type * as admin_statistics from "../admin/statistics.js";
import type * as admin_debug from "../admin_debug.js";
import type * as admin_utils from "../admin_utils.js";
import type * as auctions from "../auctions.js";
import type * as auctions_helpers from "../auctions/helpers.js";
import type * as auctions_internal from "../auctions/internal.js";
import type * as auctions_mutations_bidding from "../auctions/mutations/bidding.js";
import type * as auctions_mutations_create from "../auctions/mutations/create.js";
import type * as auctions_mutations_delete from "../auctions/mutations/delete.js";
import type * as auctions_mutations_helpers from "../auctions/mutations/helpers.js";
import type * as auctions_mutations_publish from "../auctions/mutations/publish.js";
import type * as auctions_mutations_update from "../auctions/mutations/update.js";
import type * as auctions_proxy_bidding from "../auctions/proxy_bidding.js";
import type * as auctions_queries from "../auctions/queries.js";
import type * as auctions_queries_admin from "../auctions/queries/admin.js";
import type * as auctions_queries_bids from "../auctions/queries/bids.js";
import type * as auctions_queries_browse from "../auctions/queries/browse.js";
import type * as auctions_queries_index from "../auctions/queries/index.js";
import type * as auctions_queries_listings from "../auctions/queries/listings.js";
import type * as auctions_queries_shared from "../auctions/queries/shared.js";
import type * as config from "../config.js";
import type * as constants from "../constants.js";
import type * as crons from "../crons.js";
import type * as errors from "../errors.js";
import type * as faq from "../faq.js";
import type * as http from "../http.js";
import type * as image_cache from "../image_cache.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_encryption from "../lib/encryption.js";
import type * as lib_storage from "../lib/storage.js";
import type * as messages from "../messages.js";
import type * as notifications from "../notifications.js";
import type * as presence from "../presence.js";
import type * as profileFlags from "../profileFlags.js";
import type * as reviews from "../reviews.js";
import type * as seed from "../seed.js";
import type * as support from "../support.js";
import type * as userPreferences from "../userPreferences.js";
import type * as users from "../users.js";
import type * as watchlist from "../watchlist.js";

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
  "admin/mutations": typeof admin_mutations;
  "admin/queries": typeof admin_queries;
  "admin/settings": typeof admin_settings;
  "admin/statistics": typeof admin_statistics;
  admin_debug: typeof admin_debug;
  admin_utils: typeof admin_utils;
  auctions: typeof auctions;
  "auctions/helpers": typeof auctions_helpers;
  "auctions/internal": typeof auctions_internal;
  "auctions/mutations/bidding": typeof auctions_mutations_bidding;
  "auctions/mutations/create": typeof auctions_mutations_create;
  "auctions/mutations/delete": typeof auctions_mutations_delete;
  "auctions/mutations/helpers": typeof auctions_mutations_helpers;
  "auctions/mutations/publish": typeof auctions_mutations_publish;
  "auctions/mutations/update": typeof auctions_mutations_update;
  "auctions/proxy_bidding": typeof auctions_proxy_bidding;
  "auctions/queries": typeof auctions_queries;
  "auctions/queries/admin": typeof auctions_queries_admin;
  "auctions/queries/bids": typeof auctions_queries_bids;
  "auctions/queries/browse": typeof auctions_queries_browse;
  "auctions/queries/index": typeof auctions_queries_index;
  "auctions/queries/listings": typeof auctions_queries_listings;
  "auctions/queries/shared": typeof auctions_queries_shared;
  config: typeof config;
  constants: typeof constants;
  crons: typeof crons;
  errors: typeof errors;
  faq: typeof faq;
  http: typeof http;
  image_cache: typeof image_cache;
  "lib/auth": typeof lib_auth;
  "lib/encryption": typeof lib_encryption;
  "lib/storage": typeof lib_storage;
  messages: typeof messages;
  notifications: typeof notifications;
  presence: typeof presence;
  profileFlags: typeof profileFlags;
  reviews: typeof reviews;
  seed: typeof seed;
  support: typeof support;
  userPreferences: typeof userPreferences;
  users: typeof users;
  watchlist: typeof watchlist;
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
