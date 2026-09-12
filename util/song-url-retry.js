/**
 * 歌曲直链兜底
 *
 * 背景：部署在云环境（Vercel 等）时，出口 IP 可能被网易云风控，
 * 表现为取链接口返回空 `url`（`code` 为 `404` / `-110`），
 * 客户端将无法播放或下载。
 *
 * 处理：首次取链未拿到地址时，自动以「随机国内 IP」（`randomCNIP=true`）重试一次。
 * 该参数由本项目的 `util/option.js` 透传给网易云，可有效规避出口 IP 风控。
 *
 * @param {(query: object) => Promise<object>} call 实际取链调用（接收 query，返回 { status, body }）
 * @param {object} query 原始查询参数
 * @returns {Promise<object>} 优先返回包含可用地址的响应
 */
const logger = require('./logger.js')

/**
 * 响应体是否含可用直链
 * @param {object} result 取链响应（{ status, body }）
 * @returns {boolean}
 */
const hasPlayableUrl = (result) => {
  const data = result && result.body && result.body.data
  if (Array.isArray(data)) {
    return data.some((item) => item && typeof item.url === 'string' && item.url)
  }
  return !!(data && typeof data.url === 'string' && data.url)
}

module.exports = async (call, query) => {
  const result = await call(query)
  // 调用方显式关闭时不再重试（randomCNIP=false / disableUrlRetry=true）
  const disabled =
    query.randomCNIP === 'false' ||
    query.randomCNIP === false ||
    query.disableUrlRetry === 'true'
  if (disabled || hasPlayableUrl(result)) return result
  logger.info(
    '取链未返回可用地址（可能出口 IP 被风控），以随机国内 IP 重试一次:',
    query.id,
  )
  // 注意：必须清除 realIP —— 本项目 request.js 中 realIP 优先于 randomCNIP，
  // 若保留原 realIP，重试将仍走被风控的 IP，兜底形同虚设
  const retried = await call({
    ...query,
    realIP: undefined,
    randomCNIP: true,
  })
  if (!hasPlayableUrl(retried)) {
    logger.warn('随机国内 IP 重试仍未取到地址:', query.id)
  }
  return hasPlayableUrl(retried) ? retried : result
}
