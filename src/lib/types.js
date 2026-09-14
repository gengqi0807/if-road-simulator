/** @typedef {'subject'|'career'} Scene */
/** @typedef {'active'|'ended'|'archived'} SessionStatus */

/**
 * @typedef {Object} SessionInput
 * @property {string} goal
 * @property {Scene} [scene]
 * @property {Record<string, unknown>} [constraints]
 */

/**
 * @typedef {Object} Choice
 * @property {string} key
 * @property {string} text
 * @property {string} [meta]
 */

/**
 * @typedef {Object} Step
 * @property {string} id
 * @property {string} sessionId
 * @property {string|null} branchId
 * @property {string|null} parentStepId
 * @property {number} index
 * @property {string|null} choiceKey
 * @property {string|null} choiceText
 * @property {string} title
 * @property {Choice[]} options
 * @property {Record<string, unknown>|null} analysis
 * @property {Record<string, number>} metrics
 * @property {Array<{title:string,url:string,year:number}>} evidence
 * @property {Array<{level:string,reason:string}>} freshness
 */

export const isValidSessionInput = (input) => Boolean(
  input && typeof input.goal === 'string' && input.goal.trim().length >= 2,
);
