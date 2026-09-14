// 知乎开放平台内容 Provider。Access Secret 仅在服务端使用。
const BASE_URL = 'https://developer.zhihu.com/api/v1/content/zhihu_search';
const searchCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

export function isZhihuContentConfigured() {
  return Boolean(process.env.ZHIHU_ACCESS_SECRET);
}

export async function searchZhihu(query, { count = 5, timeoutMs = 8000 } = {}) {
  const secret = process.env.ZHIHU_ACCESS_SECRET;
  if (!secret) throw new Error('知乎内容 API 未配置 Access Secret');
  if (!query || !String(query).trim()) throw new Error('搜索关键词不能为空');
  const normalizedQuery = String(query).trim().slice(0, 120);
  const normalizedCount = Math.min(Math.max(Number(count) || 5, 1), 10);
  const cacheKey = `${normalizedQuery}\n${normalizedCount}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) return cached.items;
  const url = new URL(BASE_URL);
  url.searchParams.set('Query', normalizedQuery);
  url.searchParams.set('Count', String(normalizedCount));
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${secret}`,
      'X-Request-Timestamp': String(Math.floor(Date.now() / 1000)),
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await response.text();
  let payload;
  try { payload = JSON.parse(text); } catch { throw new Error(`知乎搜索返回非 JSON（HTTP ${response.status}）`); }
  const code = payload.Code ?? payload.code;
  if (!response.ok || payload.error || (code !== undefined && Number(code) !== 0)) {
    throw new Error(payload.Message || payload.message || payload.error?.message || `知乎搜索失败（HTTP ${response.status}）`);
  }
  const data = payload.Data || payload.data || payload;
  const items = data.Items || data.items || [];
  const normalizedItems = items.map((item) => ({
    title: item.Title || item.title || '知乎内容',
    url: item.Url || item.url || item.Link || item.link || 'https://www.zhihu.com/',
    author: item.AuthorName || item.author || item.Author?.Name || '知乎用户',
    publishedAt: item.EditTime ? new Date(Number(item.EditTime) * 1000).toISOString() : (item.PublishedTime || item.published_at || item.CreatedTime || null),
    excerpt: item.ContentText || item.content || item.Excerpt || item.excerpt || '',
    contentType: item.ContentType || item.content_type || '',
    contentId: String(item.ContentID || item.content_id || ''),
    voteUpCount: Number(item.VoteUpCount || item.vote_up_count || 0),
    commentCount: Number(item.CommentCount || item.comment_count || 0),
    authorityLevel: item.AuthorityLevel || item.authority_level || '',
    rankingScore: Number(item.RankingScore || item.ranking_score || 0),
    isDemo: false,
  }));
  searchCache.set(cacheKey, { createdAt: Date.now(), items: normalizedItems });
  return normalizedItems;
}
