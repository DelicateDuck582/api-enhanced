// 歌曲链接 - v1
// 此版本不再采用 br 作为音质区分的标准
// 而是采用 standard, exhigh, lossless, hires, jyeffect(高清臻音), vivid(臻音全景声), jymaster(超清母带), sky(沉浸环绕声) 进行音质判断
// 当unblock为true时, 会尝试使用unblockmusic-utils进行解锁, 同时音质设置不会生效, 但仍然为必须传入参数
// 当level为sky时, 可通过 immerseType 选择沉浸声类型, 支持 c512(新版c51类型)、ste2(新版环绕立体声类型)、aac2(新版aac类型)、c51(c51类型)、ste(环绕立体声类型)、aac(aac类型), 默认为 c51

const logger = require('../util/logger.js')
const createOption = require('../util/option.js')
const { cookieToJson } = require('../util/index.js')
const retryOnEmptyUrl = require('../util/song-url-retry.js')
module.exports = async (query, request) => {
  const {
    matchID,
  } = require('@neteasecloudmusicapienhanced/unblockmusic-utils')
  require('dotenv').config()
  const data = {
    ids: '[' + query.id + ']',
    level: query.level,
    encodeType: 'flac',
  }
  if (query.unblock === 'true') {
    try {
      const result = await matchID(query.id, query.source)
      logger.info('Starting unblock(uses modules unblock):', query.id, result)
      const useProxy = process.env.ENABLE_PROXY || 'false'
      let proxyUrl = ''
      if (result.data.url && result.data.url.includes('kuwo')) {
        proxyUrl =
          useProxy === 'true' && process.env.PROXY_URL
            ? process.env.PROXY_URL + result.data.url
            : result.data.url
      }
      return {
        status: 200,
        body: {
          code: 200,
          msg: 'Warning: Customizing unblock sources is not supported on this endpoint. Please use `/song/url/match` instead.',
          data: [
            {
              id: Number(query.id),
              url: result.data.url,
              type: 'flac',
              level: query.level,
              freeTrialInfo: 'null',
              fee: 0,
              proxyUrl: proxyUrl || '',
            },
          ],
        },
        cookie: [],
      }
    } catch (e) {
      console.error('Error in unblocking music:', e)
    }
  }
  if (data.level == 'sky') {
    data.immerseType = query.immerseType || 'c51'
  }
  /**
   * 构造请求选项（保留上游的臻音全景声处理：需 android 身份）
   * @param {object} q 查询参数
   * @returns {object} 请求选项
   */
  const buildOptions = (q) => {
    const options = createOption(q, 'xeapi')
    if (data.level == 'vivid') {
      data.encodeType = 'mp3'
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
    (q) => request(`/api/song/enhance/player/url/v1`, data, buildOptions(q)),
    query,
  )
}
