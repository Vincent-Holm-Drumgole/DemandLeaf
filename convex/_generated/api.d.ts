/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agentActions from "../agentActions.js";
import type * as agentAuditLog from "../agentAuditLog.js";
import type * as agentTrust from "../agentTrust.js";
import type * as anonymousSessions from "../anonymousSessions.js";
import type * as authorPersonas from "../authorPersonas.js";
import type * as blogEdits from "../blogEdits.js";
import type * as blogs from "../blogs.js";
import type * as calibration from "../calibration.js";
import type * as competitorTracking from "../competitorTracking.js";
import type * as confidenceScores from "../confidenceScores.js";
import type * as contentBriefs from "../contentBriefs.js";
import type * as contentCalendar from "../contentCalendar.js";
import type * as decayAlerts from "../decayAlerts.js";
import type * as errors from "../errors.js";
import type * as feedback from "../feedback.js";
import type * as googleConnections from "../googleConnections.js";
import type * as helpers from "../helpers.js";
import type * as internalLinks from "../internalLinks.js";
import type * as keywords from "../keywords.js";
import type * as knowledgeBase from "../knowledgeBase.js";
import type * as knowledgeBaseEmbeddings from "../knowledgeBaseEmbeddings.js";
import type * as neverSayList from "../neverSayList.js";
import type * as notifications from "../notifications.js";
import type * as performanceMetrics from "../performanceMetrics.js";
import type * as publishingAgentConfig from "../publishingAgentConfig.js";
import type * as rankSnapshots from "../rankSnapshots.js";
import type * as refreshHistory from "../refreshHistory.js";
import type * as scoredOutputs from "../scoredOutputs.js";
import type * as seoDataCache from "../seoDataCache.js";
import type * as strategies from "../strategies.js";
import type * as topicClusters from "../topicClusters.js";
import type * as validators from "../validators.js";
import type * as voiceProfiles from "../voiceProfiles.js";
import type * as workspaces from "../workspaces.js";
import type * as wpConnections from "../wpConnections.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agentActions: typeof agentActions;
  agentAuditLog: typeof agentAuditLog;
  agentTrust: typeof agentTrust;
  anonymousSessions: typeof anonymousSessions;
  authorPersonas: typeof authorPersonas;
  blogEdits: typeof blogEdits;
  blogs: typeof blogs;
  calibration: typeof calibration;
  competitorTracking: typeof competitorTracking;
  confidenceScores: typeof confidenceScores;
  contentBriefs: typeof contentBriefs;
  contentCalendar: typeof contentCalendar;
  decayAlerts: typeof decayAlerts;
  errors: typeof errors;
  feedback: typeof feedback;
  googleConnections: typeof googleConnections;
  helpers: typeof helpers;
  internalLinks: typeof internalLinks;
  keywords: typeof keywords;
  knowledgeBase: typeof knowledgeBase;
  knowledgeBaseEmbeddings: typeof knowledgeBaseEmbeddings;
  neverSayList: typeof neverSayList;
  notifications: typeof notifications;
  performanceMetrics: typeof performanceMetrics;
  publishingAgentConfig: typeof publishingAgentConfig;
  rankSnapshots: typeof rankSnapshots;
  refreshHistory: typeof refreshHistory;
  scoredOutputs: typeof scoredOutputs;
  seoDataCache: typeof seoDataCache;
  strategies: typeof strategies;
  topicClusters: typeof topicClusters;
  validators: typeof validators;
  voiceProfiles: typeof voiceProfiles;
  workspaces: typeof workspaces;
  wpConnections: typeof wpConnections;
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
