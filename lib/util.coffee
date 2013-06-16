async = require 'async'
_ = require 'underscore'
fs = require 'fs'
crypto = require 'crypto'
path = require 'path'
mime = require 'mime'
request = require 'request'
zlib = require 'zlib'
noop = ->


class UTIL
  constructor : (@accessId, @accessKey, @host = 'oss.aliyuncs.com', @port = '8080', @timeout = 30000 ) ->


  ###*
   * md5 获取MD5值
   * @param  {String, Buffer} data 获取作MD5处理的数据
   * @param  {String} type 返回的数据类型，可以为'hex'、'binary'或者'base64'，默认为'hex'
   * @return {[type]}      [description]
  ###
  md5 : (data, type = 'hex') ->
    md5 = crypto.createHash 'md5'
    md5.update(data).digest type
  ###*
   * getData 获取文件数据，判断该字符串对应的文件是否存在，如果存在，读取文件内容，如果不存在，则认为该字符串就是数据
   * @param  {[type]} file [description]
   * @param  {[type]} cbf  [description]
   * @return {[type]}      [description]
  ###
  getData : (file, cbf) ->
    fs.exists file, (exists) ->
      if exists
        fs.readFile file, cbf
      else
        cbf null, file
  ###*
   * getETag 获取ETag
   * @param  {String, Buffer} obj 文件路径或者文件内容
   * @param  {[type]} cbf [description]
   * @return {[type]}     [description]
  ###
  getETag : (obj, cbf) ->
    async.waterfall [
      (cbf) =>
        if _.isString obj
          @getData obj, cbf
        else
          process.nextTick ->
            cbf null, obj
      (data, cbf) =>
        cbf null, '"' + @md5(data).toUpperCase() + '"'
    ], cbf
    @
  ###*
   * [getGroupPostBody description]
   * @param  {[type]} bucket [description]
   * @param  {[type]} objs   [description]
   * @param  {[type]} cbf    [description]
   * @return {[type]}        [description]
  ###
  getGroupPostBody : (bucket, objs, cbf) ->
    xml = '<CreateFileGroup>'
    index = 0
    async.whilst () ->
      index != objs.length
    , (cbf) =>
      obj = objs[index]
      @getETag obj, (err, etag) ->
        index++
        if err
          cbf err
        else
          xml += "<Part><PartNumber>#{index}</PartNumber><PartName>#{obj}</PartName><ETag>#{etag}</ETag></Part>"
          cbf null
    , (err) ->
      cbf err, xml + '</CreateFileGroup>'
    @
  ###*
   * toBinary 字符串转换为binary
   * @param  {[type]} str [description]
   * @return {[type]}     [description]
  ###
  toBinary : (str) ->
    new Buffer(str).toString 'binary'
  ###*
   * getSign 获取sign字符串
   * @param  {[type]} method      [description]
   * @param  {[type]} contentType =             '' [description]
   * @param  {[type]} contentMd5  =             '' [description]
   * @param  {[type]} date        [description]
   * @param  {[type]} metas       [description]
   * @param  {[type]} resource    [description]
   * @return {[type]}             [description]
  ###
  getSign : (method, contentType = '', contentMd5 = '', date, metas, resource) ->
    params = [
      method.toUpperCase()
      contentType
      contentMd5
      date
    ]
    if metas
      newmetas = {}
      _.each metas, (value, key) ->
        value = value.trim()
        if !key.indexOf 'x-oss-'
          if newmetas[key]
            newmetas[key] = ",#{value}"
          else
            newmetas[key] = value
      tmp = _.map newmetas, (value, key) ->
        "#{key}:#{value}"
      params.push.apply params, tmp.sort()

    params.push resource
    sha1 = crypto.createHmac 'sha1', @accessKey
    content = @toBinary params.join '\n'
    result = sha1.update(content).digest 'base64'
  ###*
   * [getResource description]
   * @param  {[type]} ossParams [description]
   * @return {[type]}           [description]
  ###
  getResource : (ossParams) ->
    resource = ''
    _.each 'bucket object'.split(' '), (value) ->
      if _.isString ossParams[value]
        resource = "#{resource}/#{ossParams[value]}"
    params = []
    if _.isBoolean ossParams['isAcl']
      params.push 'acl'
    else if _.isBoolean ossParams['isGroup']
      params.push 'group'
    header = ossParams.header
    if header
      params = params.concat _.map header, (value, key) ->
        "#{key}=#{value}"
      params = params.sort()
    if params.length
      resource += "?#{params.join('&')}"
    else if !_.isUndefined ossParams.acl
      resource += '/?acl'
    resource
  ###*
   * getUrl 获取URL
   * @param  {[type]} ossParams [description]
   * @return {[type]}           [description]
  ###
  getUrl : (ossParams) ->
    if !_.isUndefined ossParams.acl
       url = "http://#{ossParams.bucket}.#{@host}:#{@port}/?acl"
    else
      url = "http://#{@host}:#{@port}#{@getResource(ossParams)}"
      params = @getOssParamQuery ossParams
      if params.length
        if !~url.indexOf '?'
          url += '?'
        else
          url += '&'
        url += params.join '&'
    url
  ###*
   * getSignUrl 获取带签名的URL
   * @param  {[type]} method    [description]
   * @param  {[type]} ossParams [description]
   * @param  {[type]} ttl       [description]
   * @return {[type]}           [description]
  ###
  getSignUrl : (method, ossParams, ttl) ->
    date = Date.now() + ttl
    resource = @getResource ossParams
    sign = @getSign method, '', '', date, {}, resource
    url = @getUrl ossParams
    params = []
    params.push "OSSAccessKeyId=#{@accessId}"
    params.push "Expires=#{date}"
    params.push "Signature=#{sign}"
    if !~url.indexOf '?'
      url += '?'
    else
      url += '&'
    url += params.join '&'
    url
  ###*
   * getOssParamQuery 获取OSS的参数查询字段
   * @param  {[type]} ossParams [description]
   * @return {[type]}           [description]
  ###
  getOssParamQuery : (ossParams) ->
    params = []
    _.each 'prefix marker max-keys delimiter'.split(' '), (value) ->
      if _.isString(ossParams[value]) || (value == 'max-keys' && _.isNumber ossParams[value])
        params.push "#{value}=#{ossParams[value]}"
    params.sort()
  ###*
   * fillHeaders 填充headers
   * @param  {[type]} headers   [description]
   * @param  {[type]} method    [description]
   * @param  {[type]} metas     =             {} [description]
   * @param  {[type]} ossParams [description]
   * @return {[type]}           [description]
  ###
  fillHeaders : (headers, method, metas = {}, ossParams) ->
    self = @
    date = new Date().toGMTString()
    headers.Date = date
    if ossParams.isGroup
      headers['Content-Type'] = 'text/xml'
    _.extend metas, ossParams.userMetas
    _.extend headers, metas
    headers['Authorization'] = "OSS #{@accessId}:" + @getSign method, headers['Content-Md5'], headers['Content-Type'], date, metas, @getResource ossParams
    @
  ###*
   * getHeaders 获取headers
   * @param  {[type]} method    [description]
   * @param  {[type]} metas     [description]
   * @param  {[type]} ossParams [description]
   * @param  {[type]} {optional} srcFile   [description]
   * @return {[type]}           [description]
  ###
  getHeaders : (method, metas, ossParams, srcFile) ->
    headers = {}
    if srcFile
      headers['Content-Type'] = mime.lookup path.extname srcFile.name
      data = srcFile.data
      headers['Content-Length'] = data.length
      md5 = crypto.createHash 'md5'
      headers['Content-Md5'] = md5.update(data).digest 'hex'
    @fillHeaders headers, method, metas, ossParams
    headers
  ###*
   * exec 执行操作
   * @param  {String} method HTTP Method类型
   * @param  {[type]} metas     [description]
   * @param  {[type]} ossParams [description]
   * @param  {[type]} {optional} srcFile   [description]
   * @param  {[type]} cbf       =             noop [description]
   * @return {[type]}           [description]
  ###
  exec : (method, metas, ossParams, srcFile, cbf = noop) ->
    if _.isFunction srcFile
      cbf = srcFile
      srcFile = null
    cbf = _.once cbf
    method = method.toUpperCase()
    headers = @getHeaders method, metas, ossParams, srcFile
    # headers['Accept-Encoding'] = 'gzip'
    options =
      method : method
      url : GLOBAL.encodeURI @getUrl ossParams
      encoding : null
      headers : headers
      timeout : @timeout
    if srcFile
      options.body = srcFile.data
    if ossParams.isGroup
      options.body = @getGroupPostBody ossParams.bucket, ossParams.objectArray
   	@request options, cbf
  request : (options, cbf) ->
    method = options.method
    request options, (err, res, body) =>
      if err
        cbf err
      else if res.statusCode != 200 && res.statusCode != 204
        err = new Error body
        err.code = res.statusCode
        cbf err
      else
        headers = res.headers
        @covertHeaders headers
        if method == 'HEAD'
          cbf null, headers
        else
          if body?.length && headers['Content-Encoding'] == 'gzip'
            zlib.gunzip body, cbf
          else
            cbf null, body
  covertHeaders : (headers) ->
    covertKeys = 
      'cache-control' : 'Cache-Control'
      'connection' : 'Connection'
      'content-encoding' : 'Content-Encoding'
      'content-length' : 'Content-Length'
      'content-type' : 'Content-Type'
      'date' : 'Date'
      'etag' : 'ETag'
      'last-modified' : 'Last-Modified'
    _.each covertKeys, (value, key) ->
      if headers[key]
        headers[value] = headers[key]
        delete headers[key]
    headers
  validateObject : (name) ->
    err = new Error '长度必须在 1-1023 字节之间；不能以“/”或者“\”字符开头'
    if name.length < 1 || name.length > 1023
      err
    else
      ch = name.charAt 0
      if ch == '\\' || ch == '/'
        err
      else
        null
  validateBucket : (name) ->
    err = new Error '只能包括小写字母,数字,短横线(-);必须以小写字母或者数字开头;长度必须在 3-63 字节之间'
    reg = /^([a-z\d\-]*)$/
    if value.length < 3 || value.length > 63
      err
    else if !reg.test value
      err
    else if value.charAt(0) == '-'
      err
    else
      null

module.exports = UTIL