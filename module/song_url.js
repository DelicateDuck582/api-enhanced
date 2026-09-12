// 歌曲链接
const createOption = require('../util/option.js')
const retryOnEmptyUrl = require('../util/song-url-retry.js')
module.exports = async (query, request) => {
  const ids = String(query.id).split(',')
  const data = {
    ids: JSON.stringify(ids),
    br: parseInt(query.br || 999000),
  }
  // 出口 IP 被风控时（url 为空）自动以随机国内 IP 重试一次
  const res = await retryOnEmptyUrl(
    (q) => request(`/api/song/enhance/player/url`, data, createOption(q)),
    query,
  )
  // 根据id排序
  const result = res.body.data
  result.sort((a, b) => {
    return ids.indexOf(String(a.id)) - ids.indexOf(String(b.id))
  })
  return {
    status: 200,
    body: {
      code: 200,
      data: result,
    },
  }
}
