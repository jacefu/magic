/**
 * Internal mention placeholder format used inside the composer textarea:
 *   [@displayName](userId)            — user mention, e.g. [@alice](@alice:magic.com)
 *   @全体                              — room mention
 *
 * `parseMentions` converts the placeholder string into the Matrix wire format
 * (body / formatted_body / m.mentions) before send.
 */

const USER_MENTION_PATTERN = /\[@([^\]]+)\]\((@[^)]+)\)/g;
const ROOM_MENTION_PATTERN = /@全体/g;

export interface ParsedMessage {
  body: string;
  formattedBody: string;
  mentions: {
    user_ids?: string[];
    room?: boolean;
  };
}

/** Convert the editor's placeholder string to a Matrix m.text content payload. */
export function parseMentions(input: string): ParsedMessage {
  const userIds: string[] = [];

  for (const match of input.matchAll(USER_MENTION_PATTERN)) {
    userIds.push(match[2]);
  }

  let hasRoomMention = false;
  for (const _ of input.matchAll(ROOM_MENTION_PATTERN)) {
    hasRoomMention = true;
    break;
  }

  // Plain body: strip placeholder syntax → `@displayName`, normalize @全体 → @room
  let body = input.replace(USER_MENTION_PATTERN, (_match, displayName) => `@${displayName}`);
  body = body.replace(ROOM_MENTION_PATTERN, "@room");

  // HTML body: walk the input, escape non-mention text, splice in real anchor
  // tags for each mention placeholder. One pass avoids double-escaping the
  // display name (which would happen if we escaped the whole input first then
  // re-escaped inside the replace callback).
  let formattedBody = "";
  let cursor = 0;
  for (const match of input.matchAll(USER_MENTION_PATTERN)) {
    const [full, displayName, userId] = match;
    formattedBody += escapeHtml(input.slice(cursor, match.index));
    formattedBody += `<a href="https://matrix.to/#/${encodeURIComponent(userId)}">${escapeHtml(displayName)}</a>`;
    cursor = (match.index ?? 0) + full.length;
  }
  formattedBody += escapeHtml(input.slice(cursor));
  formattedBody = formattedBody.replace(ROOM_MENTION_PATTERN, "@room");

  const mentions: ParsedMessage["mentions"] = {};
  if (userIds.length > 0) mentions.user_ids = [...new Set(userIds)];
  if (hasRoomMention) mentions.room = true;

  return { body, formattedBody, mentions };
}

export function hasMentions(input: string): boolean {
  return /\[@[^\]]+\]\(@[^)]+\)/.test(input) || /@全体/.test(input);
}

/** Pull mentioned userIds out of a Matrix `formatted_body` HTML string. */
export function extractMentionedUserIds(formattedBody: string | undefined): string[] {
  if (!formattedBody) return [];
  const regex = /href="https:\/\/matrix\.to\/#\/([^"]+)"/g;
  const ids: string[] = [];
  for (const match of formattedBody.matchAll(regex)) {
    const decoded = decodeURIComponent(match[1]);
    if (decoded.startsWith("@")) ids.push(decoded);
  }
  return ids;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
