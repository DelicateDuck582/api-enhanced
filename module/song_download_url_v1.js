// 获取客户端歌曲下载链接 - v1
// 此版本不再采用 br 作为音质区分的标准
// 而是采用 standard, exhigh, lossless, hires, jyeffect(高清臻音), vivid(臻音全景声), jymaster(超清母带), sky(沉浸环绕声) 进行音质判断

const createOption = require('../util/option.js')
const { cookieToJson } = require('../util/index.js')
const retryOnEmptyUrl = require('../util/song-url-retry.js')
module.exports = (query, request) => {
  const data = {
    id: query.id,
    immerseType: 'c51',
    level: query.level,
  }
  /**
   * 构造请求选项（保留上游的臻音全景声处理：需 android 身份）
   * @param {object} q 查询参数
   * @returns {object} 请求选项
   */
  const buildOptions = (q) => {
    const options = createOption(q)
    if (query.level === 'vivid') {
      const cookie = options.cookie
      options.cookie = {
        ...(typeof cookie === 'string' ? cookieToJson(cookie) : cookie),
        os: 'android',
        appver: '9.5.61',
      }
    }
    return options
  }
  // 出口 IP 被风控时（url 为空）自动以随机国内 IP 重试一次
  return retryOnEmptyUrl(
    (q) => request(`/api/song/enhance/download/url/v1`, data, buildOptions(q)),
    query,
  )
}
