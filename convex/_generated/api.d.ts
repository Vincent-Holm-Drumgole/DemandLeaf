/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as anonymousSessions from "../anonymousSessions.js";
import type * as blogEdits from "../blogEdits.js";
import type * as blogs from "../blogs.js";
import type * as calibration from "../calibration.js";
import type * as confidenceScores from "../confidenceScores.js";
import type * as contentBriefs from "../contentBriefs.js";
import type * as contentCalendar from "../contentCalendar.js";
import type * as errors from "../errors.js";
import type * as feedback from "../feedback.js";
import type * as helpers from "../helpers.js";
import type * as keywords from "../keywords.js";
import type * as knowledgeBase from "../knowledgeBase.js";
import type * as neverSayList from "../neverSayList.js";
import type * as seoDataCache from "../seoDataCache.js";
import type * as strategies from "../strategies.js";
import type * as topicClusters from "../topicClusters.js";
import type * as validators from "../validators.js";
import type * as voiceProfiles from "../voiceProfiles.js";
import type * as workspaces from "../workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  anonymousSessions: typeof anonymousSessions;
  blogEdits: typeof blogEdits;
  blogs: typeof blogs;
  calibration: typeof calibration;
  confidenceScores: typeof confidenceScores;
  contentBriefs: typeof contentBriefs;
  contentCalendar: typeof contentCalendar;
  errors: typeof errors;
  feedback: typeof feedback;
  helpers: typeof helpers;
  keywords: typeof keywords;
  knowledgeBase: typeof knowledgeBase;
  neverSayList: typeof neverSayList;
  seoDataCache: typeof seoDataCache;
  strategies: typeof strategies;
  topicClusters: typeof topicClusters;
  validators: typeof validators;
  voiceProfiles: typeof voiceProfiles;
  workspaces: typeof workspaces;
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
