UTIL = require './util'
fs = require 'fs'
_ = require 'underscore'
crypto = require 'crypto'
path = require 'path'
async = require 'async'
jtfs = require 'jtfs'
zlib = require 'zlib'
xml2js = require 'xml2js'
request = require 'request'
mime = require 'mime'
OSS_MAX_RESULT_OBJECTS = 1000
DEFAULT_CONTENT_TYPE = 'application/octet-stream'
KB_SIZE = 1024
MB_SIZE = 1024 * 1024
LARGE_FILE_SIZE = 10 * MB_SIZE
GB_SIZE = 1024 * 1024
PROVIDER = "OSS"
DEFAULT_ACL = 'private'
xmlParser = (xml, cbf) ->
  parser = new xml2js.Parser()
  parser.parseString xml, cbf
noop = ->

class Client
  constructor : (@accessId, @accessKey, @host = 'oss.aliyuncs.com',  @port = 80, @timeout = 60, @retryTimes = 2) ->
    @util = new UTIL
    @provider = PROVIDER
    @defaultHeadersList = {}
  userMetas : (value) ->
    if value
      @defaultHeadersList = value
    else
      @defaultHeadersList
  ###*
   * [signUrlAuthWithExpireTime description]
   * @param  {String} method   可选值有：PUT, GET, DELETE, HEAD
   * @param  {String} url      bucket或者object的URL，如：http://HOST/bucket/object
   * @param  {Object} headers HTTP的header
   * @param  {String} resource bucket或者object的路径，如：/bucket/, /bucket/object
   * @param  {Integer} timeout 超时时间
   * @param  {[type]} params   =             {} [description]
   * @return {[type]}          [description]
  ###
  signUrlAuthWithExpireTime : (method, url, headers = {}, resource = '/', timeout = 60, params = {}) ->
    auth = @util.getAssign @accessKey, method, headers, resource
    params['OSSAccessKeyId'] = @accessId
    params['Expires'] = new Date(Date.now() + timeout * 1000).toUTCString()
    params['Signature'] = auth
    @util.appendParam url, params

  ###*
   * [signUrl description]
   * @param  {[type]} method  [description]
   * @param  {[type]} bucket  [description]
   * @param  {[type]} object  [description]
   * @param  {[type]} timeout =             60   [description]
   * @param  {[type]} headers =             {} [description]
   * @param  {[type]} params  =             {} [description]
   * @return {[type]}         [description]
  ###
  signUrl : (method, bucket, object, timeout = 60, headers = {}, params = {}) ->
    date = new Date(Date.now() + timeout * 1000).toUTCString()
    headers['Date'] = date
    # object = @util.toBinary object
    resource = "/#{bucket}/#{object}#{@util.getResource(params)}"
    auth = @util.getAssign @accessKey, method, headers, resource
    params['OSSAccessKeyId'] = @accessId
    params['Expires'] = date
    params['Signature'] = auth
    url = "http://#{bucket}.#{host}/#{object}"
    @util.appendParam url, params

  # bucketOperation : (method, bucket, headers, params, cbf) ->
  #   @exec method, bucket, '', headers, '', params, cbf
  
  ###*
   * listAllMyBuckets 列出所有的bucket
   * @param  {Function} cbf (err, [{name : 'xxx', createdAt : 'xxx'}])
   * @return {[type]}         [description]
  ###
  listAllMyBuckets : (cbf) ->
    headers = null
    method = 'GET'
    bucket = ''
    object = ''
    body = ''
    params = {}
    async.waterfall [
      (cbf) =>
        @exec method, bucket, object, headers, body, params, cbf
      xmlParser
    ], (err, result) ->
      if err
        cbf err
      else
        result = _.map result.ListAllMyBucketsResult.Buckets[0].Bucket, (item) ->
          {
            name : item.Name[0]
            createdAt : item.CreationDate[0]
          }
        cbf null, result
  
  ###*
   * getBucketAcl 获取bucket的访问控制权限
   * @param  {String} bucket bucket的名称
   * @param  {Function} cbf  (err, 'private'|'public-read'|'publick-read-write')
   * @return {[type]}        [description]
  ###
  getBucketAcl : (bucket, cbf) ->
    method = 'GET'
    object = ''
    headers = {}
    body = ''
    params = 
      acl : ''
    async.waterfall [
      (cbf) =>
        @exec method, bucket, object, headers, body, params, cbf
      xmlParser
    ], (err, result) ->
      if err
        cbf err
      else
        cbf null, result.AccessControlPolicy.AccessControlList[0].Grant[0]

  ###*
   * listBucket 列出bucket的内容（默认最大只显示1000个object）
   * @param  {String} bucket  [description]
   * @param  {[type]} params 列出object列表的一些参数配置{delimiter : String, marker : String, max-keys : Integer, prefix : String}
   * @param  {[type]} cbf   (err, {marker : String, items : Array})
   * @return {[type]}         [description]
  ###
  listBucket : (bucket, params = {}, cbf) ->
    if _.isFunction params
      cbf = params
      params = {}
    headers = null
    method = 'GET'
    object = ''
    body = ''
    async.waterfall [
      (cbf) =>
        @exec method, bucket, object, headers, body, params, cbf
      xmlParser
    ], (err, result) ->
      if err
        cbf err
      else
        ListBucketResult = result.ListBucketResult
        result = []
        _.each ListBucketResult?.CommonPrefixes, (item) ->
          result.push 
            _type : 'folder'
            name : item.Prefix[0]
        _.each ListBucketResult?.Contents, (item) ->
          newItem = {}
          _.each item, (value, key) ->
            if key == 'Key'
              key = 'name'
            else
              key = key.charAt(0).toLowerCase() + key.substring 1
            newItem[key] = value[0]
          result.push newItem
        marker = ListBucketResult.NextMarker?[0]
        cbf null, {
          marker : marker
          items : result
        }

  ###*
   * isModified 判断object和对应的本地file是否有修改（通过比较它们的ETag是否一样）
   * @param  {String}  bucket   [description]
   * @param  {String}  object   [description]
   * @param  {String}  fileName [description]
   * @param  {[type]}  cbf      [description]
   * @return {Boolean}          [description]
  ###
  isModified : (bucket, object, fileName, cbf) ->
    async.waterfall [
      (cbf) =>
        @_md5 fileName, (err, md5) ->
          if err
            cbf err
          else
            cbf null, '"' + md5 + '"'
      (eTag, cbf) =>
        @headObject bucket, object, (err, ossHeaders) ->
          ossETag = ossHeaders?['ETag']
          if ossETag
            index = ossETag.indexOf '-'
            if ~index
              ossETag = ossETag.substring 0, index
          if err
            cbf null, true
          else if ossETag == eTag
            cbf null, false
          else
            cbf null, true
    ], cbf
    
  ###*
   * putBucket 创建bucket
   * @param  {String} bucket  [description]
   * @param  {String} acl     [description]
   * @param  {Object} {optional} headers [description]
   * @param  {Function} cbf     [description]
   * @return {[type]}         [description]
  ###
  putBucket : (bucket, acl, headers, cbf) ->
    if _.isFunction acl
      cbf = acl
      acl = null
    else if _.isFunction headers
      cbf = headers
      headers = null
    headers ?= {}
    acl ?= DEFAULT_ACL
    if acl
      if @provider == 'AWS'
        headers['x-amz-acl'] = acl
      else
        headers['x-oss-acl'] = acl
    method = 'PUT'
    object = ''
    body = ''
    params = {}
    @exec method, bucket, object, headers, body, params, cbf

  ###*
   * [putBucketWithLocation description]
   * @param  {[type]} bucket   [description]
   * @param  {[type]} acl      [description]
   * @param  {[type]} location [description]
   * @param  {[type]} headers  =             {} [description]
   * @param  {[type]} cbf      [description]
   * @return {[type]}          [description]
  ###
  putBucketWithLocation : (bucket, acl, location, headers = {}, cbf) ->
    if _.isFunction acl
      cbf = acl
      acl = null
    else if _.isFunction location
      cbf = location
      location = acl
      acl = null
    else if _.isFunction headers
      cbf = headers
      headers = {}
    acl ?= DEFAULT_ACL
    if acl
      if @provider == 'AWS'
        headers['x-amz-acl'] = acl
      else
        headers['x-oss-acl'] = acl
    params = {}
    body = ''
    if location
      body += "<CreateBucketConfiguration><LocationConstraint>#{location}</LocationConstraint></CreateBucketConfiguration>"
    method = 'PUT'
    object = ''
    @exec method, bucket, object, headers, body, params, cbf

  ###*
   * deleteBucket 删除bucket
   * @param  {String} bucket  [description]
   * @param  {Function} cbf     [description]
   * @return {[type]}         [description]
  ###
  deleteBucket : (bucket, cbf) ->
    headers = null
    method = 'DELETE'
    object = ''
    body = ''
    params = {}
    @exec method, bucket, object, headers, body, params, cbf

  ###*
   * putObjectWithData 上传Object
   * @param  {String} bucket  [description]
   * @param  {String} object  [description]
   * @param  {String|Buffer} content [description]
   * @param  {Object} {optional} headers [description]
   * @param  {Object} {optional} params  [description]
   * @param  {[type]} cbf     [description]
   * @return {[type]}         [description]
  ###
  putObjectWithData : (bucket, object, content = '', headers, params, cbf) ->
    if _.isFunction headers
      cbf = headers
      headers = null
    else if _.isFunction params
      cbf = params
      params = null
    headers ?= {}
    method = 'PUT'

    defaultHeaders = @defaultHeadersList[path.extname object]
    if defaultHeaders
      _.extend headers, defaultHeaders

    if !headers['Content-Type']
      headers['Content-Type'] = mime.lookup(object) || DEFAULT_CONTENT_TYPE
    if content && !Buffer.isBuffer content
      content = new Buffer content
    headers["Expect"] = "100-Continue"
    async.waterfall [
      (cbf) ->
        if headers['Content-Encoding'] == 'gzip'
          zlib.gzip content, cbf
        else
          cbf null, content
      (body, cbf) =>
        @exec method, bucket, object, headers, body,  params, cbf
    ], cbf


  ###*
   * putObjectFromFile 从文件中上传object
   * @param  {String} bucket   [description]
   * @param  {String} object   [description]
   * @param  {String} fileName [description]
   * @param  {Object} {optional} headers [description]
   * @param  {Object} {optional} params   [description]
   * @param  {[type]} cbf      [description]
   * @return {[type]}          [description]
  ###
  putObjectFromFile : (bucket, object, fileName, headers = {}, params, cbf) ->
    if _.isFunction headers
      cbf = headers
      headers = null
    else if _.isFunction params
      cbf = params
      params = null
    headers ?= {}
    @putObjectFromFd bucket, object, fileName, headers, params, cbf


  putObjectFromFileList : (bucket, files, headers, params, cbf) ->
    if _.isFunction headers
      cbf = headers
      headers = null
    else if _.isFunction params
      cbf = params
      params = null
    headers ?= {}
    params ?= {}
    progress = params.progress
    # delete params.progress
    async.eachLimit files, 5, (file, cbf) =>
      object = path.basename file
      progress 'putObjectFromFileList', {
        file : file
        status : 'doing'
      }
      tmpParams = _.clone params
      tmpHeaders = _.clone headers
      @putObjectFromFile bucket, object, file, tmpHeaders, tmpParams, (err) ->
        if err
          progress 'putObjectFromFileList', {
            file : file
            status : 'fail'
          }
        else
          progress 'putObjectFromFileList', {
            file : file
            status : 'complete'
          }
        cbf null
    , cbf

  ###*
   * putObjectFromFd 根据文件fd上传object
   * @param  {String} bucket  [description]
   * @param  {String} object  [description]
   * @param  {fd} fd      [description]
   * @param  {Object} {optional} headers [description]
   * @param  {Object} {optional} params  [description]
   * @param  {[type]} cbf     [description]
   * @return {[type]}         [description]
  ###
  putObjectFromFd : (bucket, object, fd, headers = {}, params, cbf) ->
    if _.isFunction headers
      cbf = headers
      headers = null
    else if _.isFunction params
      cbf = params
      params = null
    headers ?= {}
    @putObjectFromFileGivenPos bucket, object, fd, 0, -1, headers, params, cbf

  ###*
   * putObjectFromFileGivenPos 指定文件中数据读取的位置和大小上传object
   * @param  {String} bucket   [description]
   * @param  {String} object   [description]
   * @param  {String} fileName [description]
   * @param  {Integer} offset   [description]
   * @param  {Integer} partSize [description]
   * @param  {Object} {optional} headers  [description]
   * @param  {Object} {optional} params   [description]
   * @param  {[type]} cbf      [description]
   * @return {[type]}          [description]
  ###
  putObjectFromFileGivenPos : (bucket, object, fileName, offset, partSize, headers, params, cbf) ->
    if _.isFunction headers
      cbf = headers
      headers = null
    else if _.isFunction params
      cbf = params
      params = null
    uploadTooLargeErr = new Error 'upload data is to large'
    headers ?= {}
    fd = null
    async.waterfall [
      (cbf) ->
        if _.isString fileName
          fs.open fileName, 'r', cbf
        else
          cbf null, fileName
      (tmpFd, cbf) ->
        fd = tmpFd
        fs.fstat fd, cbf
      (stats, cbf) ->
        size = stats.size
        if offset > size
          cbf new Error 'the offset is bigger than file size'
          return
        if partSize == -1 && size > LARGE_FILE_SIZE
          if _.isString fileName
            fs.closeSync fd
          cbf uploadTooLargeErr
        else
          if partSize == -1 || offset + partSize > size
            partSize = size - offset
          buf = new Buffer partSize
          fs.read fd, buf, 0, partSize, offset, cbf, cbf
      (bytesRead, buffer, cbf) =>
        @putObjectFromString bucket, object, buffer, headers, params, cbf
      (result, cbf) ->
        if _.isString fileName
          fs.close fd, (err) ->
            cbf err, result
        else
          cbf null, result
    ], (err, result) =>
      if err == uploadTooLargeErr
        @uploadLargeFile bucket, object, fileName, headers, params, cbf
      else
        cbf err, result

  ###*
   * updateObjectFromFile 根据指定的文件更新object
   * @param  {String} bucket   [description]
   * @param  {String} object   [description]
   * @param  {String} fileName [description]
   * @param  {[type]} cbf      [description]
   * @return {[type]}          [description]
  ###
  updateObjectFromFile : (bucket, object, fileName, headers, params = {}, cbf) ->
    if _.isFunction headers
      headers = null
      cbf = headers
    else if _.isFunction params
      cbf = params
      params = headers
      headers = null
    async.waterfall [
      (cbf) =>
        @isModified bucket, object, fileName, cbf
      (modified, cbf) =>
        if modified
          @putObjectFromFile bucket, object, fileName, headers, params, cbf
        else
          cbf null
    ], cbf


  ###*
   * getObject 获取object
   * @param  {String} bucket  [description]
   * @param  {String} object  [description]
   * @param  {Object} {optional} headers [description]
   * @param  {Object} {optional} params  [description]
   * @param  {[type]} cbf     [description]
   * @return {[type]}         [description]
  ###
  getObject : (bucket, object, headers, params, cbf) ->
    if _.isFunction headers
      cbf = headers
      headers = null
    else if _.isFunction params
      cbf = params
      params = null
    method = 'GET'
    body = ''
    @exec method, bucket, object, headers, body, params, cbf


  ###*
   * getObjectToFile 获取object并保存到文件中
   * @param  {String} bucket   [description]
   * @param  {String} object   [description]
   * @param  {String} fileName [description]
   * @param  {[type]} args...  其它参数和getObject函数一样
   * @return {[type]}          [description]
  ###
  getObjectToFile : (bucket, object, fileName, args...) ->
    cbf = args.pop()
    async.waterfall [
      (cbf) =>
        args.unshift bucket, object
        args.push cbf
        @getObject.apply @, args
      (data, cbf) ->
        fs.writeFile fileName, data, cbf
    ], cbf
  
  
  ###*
   * deleteObject 删除object
   * @param  {String} bucket  [description]
   * @param  {String} object  [description]
   * @param  {[type]} cbf     [description]
   * @return {[type]}         [description]
  ###
  deleteObject : (bucket, object, cbf) ->
    headers = null
    method = 'DELETE'
    body = ''
    params = {}
    if object[object.length - 1] == '/'
      async.waterfall [
        (cbf) =>
          @listObjects bucket, {prefix : object}, cbf
        (items, cbf) =>
          @deleteObjects bucket, _.pluck(items, 'name'), cbf
      ], cbf
    else
      @exec method, bucket, object, headers, body, params, cbf

  ###*
   * headObject 获取或修改object的headers
   * @param  {String} bucket  [description]
   * @param  {String} object  [description]
   * @param  {Object} {optional} headers 有该参数表示修改，无该参数表示获取
   * @param  {[type]} cbf     [description]
   * @return {[type]}         [description]
  ###
  headObject : (bucket, object, headers, cbf) ->
    if _.isFunction headers
      cbf = headers
      headers = null
    if headers
      if object[object.length - 1] == '/'
        async.waterfall [
          (cbf) =>
            @listObjects bucket, {prefix : object}, cbf
          (items, cbf) =>
            cbf null, _.pluck items, 'name'
          (objs, cbf) =>
            async.eachLimit objs, 5, (obj, cbf) =>
              @copyObject bucket, obj, bucket, obj, headers, cbf
            , cbf
        ], cbf
      else
        @copyObject bucket, object, bucket, object, headers, cbf
    else
      method = 'HEAD'
      body = ''
      params = {}
      @exec method, bucket, object, headers, body, params, cbf


  ##未测试
  postObjectGroup : (bucket, object, objectGroupMsgXml, headers = {}, params = {}, cbf) ->
    if _.isFunction headers
      cbf = headers
      headers = {}
    else if _.isFunction params
      cbf = params
      params = {}
    if !headers['Content-Type']
      headers['Content-Type'] = mime.lookup object
    method = 'POST'
    params['group'] = ''
    headers['Content-Length'] = objectGroupMsgXml.length
    @exec method, bucket, object, headers, objectGroupMsgXml, params, cbf

  ##未测试
  getObjectGroupIndex : (bucket, object, headers = {}, cbf) ->
    if _.isFunction headers
      cbf = headers
      headers = {}
    headers['x-oss-file-group'] = ''
    method = 'GET'
    body = ''
    params = {}
    @exec method, bucket, object, headers, body, params, cbf

  ###*
   * uploadPartFromFileGivenPos 根据文件指定的位置和大小分块上传object
   * @param  {String} bucket     [description]
   * @param  {String} object     [description]
   * @param  {String} fileName   [description]
   * @param  {Integer} offset     [description]
   * @param  {Integer} partSize   [description]
   * @param  {String} uploadId   [description]
   * @param  {Integer} partNumber [description]
   * @param  {Object} {optional} headers    [description]
   * @param  {Object} {optional} params   [description]
   * @param  {[type]} cbf        [description]
   * @return {[type]}            [description]
  ###
  uploadPartFromFileGivenPos : (bucket, object, fileName, offset, partSize, uploadId, partNumber, headers, params = {}, cbf) ->
    if _.isFunction headers
      cbf = headers
      headers = null
    else if _.isFunction params
      cbf = params
      params = {}
    params['partNumber'] = partNumber
    params['uploadId'] = uploadId
    @putObjectFromFileGivenPos bucket, object, fileName, offset, partSize, headers, params, cbf

  ###*
   * uploadLargeFile 上传大文件
   * @param  {String} bucket   [description]
   * @param  {String} object   [description]
   * @param  {String} fileName [description]
   * @param  {Object} {optional} headers  [description]
   * @param  {Object} {optioanl} params   可以往params添加 {progress : fuction}回调上传进度
   * @param  {[type]} cbf      [description]
   * @return {[type]}          [description]
  ###
  uploadLargeFile : (bucket, object, fileName, headers, params = {}, cbf) ->
    console.dir 'large file:' + fileName
    _filetrPartMsgList = (partMsgList, resultParts) ->
      _.filter partMsgList, (partMsg) ->
        id = partMsg[0]
        eTag = '"' + partMsg[2] + '"'
        info = _.find resultParts, (resultPart) ->
          resultPart.partNumber == id && resultPart.eTag == eTag
        !info

    
    _uploadPart = (uploadId, partMsg, retry = true, cbf) =>
      if _.isFunction retry
        cbf = retry
        retry = true
      offset = partMsg[4]
      partSize = partMsg[3]
      eTag = '"' + partMsg[2] + '"'
      partNumber = partMsg[0]
      cloneParams = _.clone params
      delete cloneParams.progress
      @uploadPartFromFileGivenPos bucket, object, fileName, offset, partSize, uploadId, partNumber, headers, cloneParams, (err, headers) ->
        if err
          console.dir err
          if retry
            _uploadPart uploadId, partMsg, false, cbf
          else
            cbf err
        else if headers.ETag == eTag
          cbf null
        else if retry
          _uploadPart uploadId, partMsg, false, cbf
        else
          cbf new Error 'upload part fail!!'

    # args = _.toArray arguments
    partMsgList = null
    uploadId = null
    uploadInfos = null
    # cbf = args.pop()

    # if _.isFunction _.last args
    #   progress = args.pop()
    # else
    #   progress = ->
    # params = args.pop() || {}
    # headers = args.pop() || {}
    if _.isFunction headers
      headers = null
      cbf = headers
    else if _.isFunction params
      cbf = params
      params = headers
      headers = null
    if params
      progress = params.progress
      # delete params.progress
    progress ?= ->

    async.waterfall [
      (cbf) =>
        @util.splitLargeFile fileName, object, cbf
      (msgList, cbf) =>
        console.dir msgList
        partMsgList = msgList
        @getUploadId bucket, object, cbf
      (id, cbf) =>
        uploadId = id
        console.dir uploadId
        @listParts bucket, object, {uploadId : id}, cbf
      (partInfos, cbf) ->
        uploadInfos = partMsgList
        partMsgList = _filetrPartMsgList partMsgList, partInfos.parts
        console.dir partMsgList
        total = partMsgList.length
        complete = 0
        async.eachLimit partMsgList, 5, (partMsg, cbf) =>
          _uploadPart uploadId, partMsg, (err) ->
            complete++
            console.dir {
              file : fileName
              eTag : partMsg[0]
              complete : complete
              total : total
            }
            progress 'uploadLargeFile', {
              file : fileName
              eTag : partMsg[0]
              complete : complete
              total : total
            }
            # progress partMsg[0], complete, total
            cbf err
        , cbf
      (cbf) =>
        @listParts bucket, object, {uploadId : uploadId}, cbf
      (partInfos, cbf) =>
        xml = @util.createPartXml uploadInfos
        progress 'putObjectFromFileList', {
          file : fileName
          status : 'complete'
        }
        @completeUpload bucket, object, xml, {uploadId : uploadId}, cbf
    ], cbf


  ###*
   * listParts 列出已上传的part
   * @param  {String} bucket [description]
   * @param  {String} object [description]
   * @param  {Object} params {uploadId : String}必须有该字段标记是哪一个upload
   * @param  {[type]} cbf    [description]
   * @return {[type]}        [description]
  ###
  listParts : (bucket, object, params, cbf) ->
    method = 'GET'
    body = ''
    params['uploads'] = ''
    headers = null
    getPartInfos = (data) ->
      result = _.map data, (info) ->
        {
          partNumber : GLOBAL.parseInt info.PartNumber[0]
          lastModified : info.LastModified[0]
          eTag : info.ETag[0]
          size : GLOBAL.parseInt info.Size[0]
        }
      result.sort (info1, info2) ->
        info1.partNumber - info2.partNumber
      result


    async.waterfall [
      (cbf) =>
        @exec method, bucket, object, headers, body, params, cbf
      xmlParser
      (result, cbf) ->
        result = result.ListPartsResult
        info = 
          isTruncated : result.IsTruncated[0] == 'true'
          partNumberMarker : GLOBAL.parseInt result.PartNumberMarker[0]
          nextPartNumberMarker : GLOBAL.parseInt result.NextPartNumberMarker[0]
          parts : getPartInfos result.Part
        cbf null, info
    ], cbf


  ###*
   * copyObject 复制object
   * @param  {String} sourceBucket [description]
   * @param  {String} sourceObject [description]
   * @param  {String} targetBucket [description]
   * @param  {String} targetObject [description]
   * @param  {Object} {optional} headers 新的headers
   * @param  {[type]} cbf          [description]
   * @return {[type]}              [description]
  ###
  copyObject : (sourceBucket, sourceObject, targetBucket, targetObject, headers = {}, cbf) ->
    if _.isFunction headers
      cbf = headers
      headers = {}
    # sourceObject = @util.toBinary sourceObject
    headers['x-oss-copy-source'] = GLOBAL.encodeURI "/#{sourceBucket}/#{sourceObject}"
    method = 'PUT'
    body = ''
    params = {}
    @exec method, targetBucket, targetObject, headers, body, params, cbf

  ###*
   * initMultiUpload 初始化分块上传
   * @param  {String} bucket  [description]
   * @param  {String} object  [description]
   * @param  {Object} params  [description]
   * @param  {[type]} cbf     [description]
   * @return {[type]}         [description]
  ###
  initMultiUpload : (bucket, object, params = {}, cbf) ->
    if _.isFunction params
      cbf = params
      params = {}
    headers = null
    params ?= {}
    method = 'POST'
    body = ''
    params['uploads'] = ''
    async.waterfall [
      (cbf) =>
        @exec method, bucket, object, headers, body, params, cbf
      xmlParser
      (data, cbf) ->
        cbf null, data.InitiateMultipartUploadResult.UploadId[0]
    ], cbf

  ###*
   * getUploadId 获取uploadId（如果当前object有多个upload id，返回第一个，如果没有，初始化一个）
   * @param  {String} bucket [description]
   * @param  {String} object [description]
   * @param  {[type]} cbf    [description]
   * @return {[type]}        [description]
  ###
  getUploadId : (bucket, object, cbf) ->
    async.waterfall [
      (cbf) =>
        @getAllMultipartUploads bucket, cbf
      (info, cbf) =>
        if info?.ListMultipartUploadsResult?.Upload
          uploadInfo = _.find info.ListMultipartUploadsResult.Upload, (info) ->
            info.Key[0] == object
          if uploadInfo
            cbf null, uploadInfo.UploadId[0]
          else
            @initMultiUpload bucket, object, cbf
        else
          @initMultiUpload bucket, object, cbf
    ], cbf

  ###*
   * getAllMultipartUploads 获取该bucket下的所有分块上传信息
   * @param  {String} bucket  [description]
   * @param  {Object} {optional} params  [description]
   * @param  {[type]} cbf     [description]
   * @return {[type]}         [description]
  ###
  getAllMultipartUploads : (bucket, params = {}, cbf) ->
    if _.isFunction params
      cbf = params
      params = {}
    headers = null
    method = 'GET'
    object = ''
    body = ''
    params ?= {}
    params['uploads'] = ''
    async.waterfall [
      (cbf) =>
        @exec method, bucket, object, headers, body, params, cbf
      xmlParser
    ], cbf

  # uploadPart : (bucket, object, fileName, headers, params = {}, cbf) ->
  #   if _.isFunction params
  #     cbf = params
  #     params = headers
  #     headers = null
  #   else if _.isFunction headers
  #     cbf = headers
  #     headers = null
  #   params ?= {}
  #   contentType = ''
  #   @putObjectFromFile bucket, object, fileName, contentType, headers, params, cbf

  # uploadPartFromString : (bucket, object, content, headers, params, cbf) ->
  #   if _.isFunction params
  #     cbf = params
  #     params = headers
  #     headers = null
  #   else if _.isFunction headers
  #     cbf = headers
  #     headers = null
  #   params ?= {}
  #   contentType = ''
  #   @putObjectFromString bucket, object, data, contentType, headers, params, cbf

  ###*
   * completeUpload 完成上传
   * @param  {String} bucket     [description]
   * @param  {String} object     [description]
   * @param  {String} partMsgXml [description]
   * @param  {Object} headers    [description]
   * @param  {Object} params     [description]
   * @param  {[type]} cbf        [description]
   * @return {[type]}            [description]
  ###
  completeUpload : (bucket, object, partMsgXml, headers = {}, params = {}, cbf) ->
    if _.isFunction headers
      cbf = headers
      headers = {}
    else if _.isFunction params
      cbf = params
      params = headers
      headers = null
    method = 'POST'
    headers ?= {}
    body = partMsgXml
    headers['Content-Length'] = body.length
    # params['uploadId'] = uploadId
    if !headers['Content-Type']
      headers['Content-Type'] = mime.lookup object
    async.waterfall [
      (cbf) =>
        @exec method, bucket, object, headers, body, params, cbf
      xmlParser
    ], cbf


  ###*
   * cancelUpload 取消上传
   * @param  {String} bucket  [description]
   * @param  {String} object  [description]
   * @param  {Object} {optional} params  [description]
   * @param  {[type]} cbf     [description]
   * @return {[type]}         [description]
  ###
  cancelUpload : (bucket, object, params, cbf) ->
    body = ''
    headers = null
    method = 'DELETE'
    if _.isFunction params
      cbf = params
      params = null
    params ?= {}
    async.waterfall [
      (cbf) =>
        if params.uploadId
          cbf null, uploadId
        else
          @getUploadId bucket, object, cbf
      (uploadId, cbf) =>
        params.uploadId = uploadId
        @exec method, bucket, object, headers, body, params, cbf
      xmlParser
    ], cbf

  # multiUploadFile : (bucket, object, fileName, uploadId, threadNum = 10, maxPartNum = 10000, cbf) ->
  #   if _.isFunction uploadId
  #     cbf = uploadId
  #     uploadId = null
  #   else if _.isFunction threadNum
  #     cbf = threadNum
  #     threadNum = 10
  #   else if _.isFunction maxPartNum
  #     cbf = maxPartNum
  #     maxPartNum = 1000
  #   headers = {}
  #   params = {}
  #   async.waterfall [
  #     (cbf) =>
  #       if !uploadId
  #         @initMultiUpload bucket, object, cbf
  #       else
  #         cbf null, uploadId
  #     (uploadId, cbf) =>
  #       params.uploadId = uploadId
  #   ]

  ###*
   * deleteObjects 删除objects
   * @param  {String} bucket  [description]
   * @param  {Array} objList  [description]
   * @param  {[type]} args... [description]
   * @return {[type]}         [description]
  ###
  deleteObjects : (bucket, objList = [], args...) ->
    result = []
    folders = []
    cbf = args.pop()
    _getAllFiles = (bucket, folders, cbf) =>
      files = []
      async.eachLimit folders, 1, (folder, cbf) =>
        @listObjects bucket, {prefix : folder}, (err, items) ->
          files = files.concat _.pluck items, 'name'
          cbf err
      , (err) ->
        if err
          cbf err
        else
          cbf null, files
    _deleteObjs = (objs, cbf) =>
      index = 0
      max = objs.length
      async.doWhilst (cbf) =>
        tmpObjs = objs.slice index, index + OSS_MAX_RESULT_OBJECTS
        xml = @util.createDeleteObjectMsgXml tmpObjs
        index += OSS_MAX_RESULT_OBJECTS
        tmpArgs = _.clone args
        tmpArgs.unshift bucket, xml
        tmpArgs.push cbf
        @_batchDeleteObject.apply @, tmpArgs
      , ->
        index < max
      , cbf

    if !objList.length
      cbf null
      return
    _.each objList, (obj) ->
      if obj[obj.length - 1] == '/'
        folders.push obj
      else
        result.push obj
    async.waterfall [
      (cbf) =>
        if folders.length
          _getAllFiles bucket, folders, (err, items) ->
            if err
              cbf err
            else
              result = result.concat items
              cbf null, result
        else
          cbf null, result
      (objs, cbf) =>
        _deleteObjs objs, cbf
    ], cbf
    
  

  ###*
   * listObjects 列出所有的object,参数和listObjectsByFilter一样
   * @param  {[type]} args... [description]
   * @param  {[type]} cbf     [description]
   * @return {[type]}         [description]
  ###
  listObjects : (args..., cbf) ->
    tmp = (err, result) ->
      if err
        cbf err
      else
        cbf null, result.items
    args.push tmp
    @listObjectsByFilter.apply @, args

  ###*
   * listObjectsByFilter 通过自定义的filter列出合条件的object
   * @param  {String} bucket  [description]
   * @param  {Object} {optioanl} headers [description]
   * @param  {Object} {optioanl} params  [description]
   * @param  {[type]} cbf     [description]
   * @return {[type]}         [description]
  ###
  listObjectsByFilter : (bucket, headers, params = {}, cbf) ->
    if _.isFunction headers
      cbf = headers
      headers = null
    else if _.isFunction params
      cbf = params
      params = headers
      headers = null
    params ?= {}
    filter = params.filter
    delete params.filter
    max = params.max || -1
    delete params.max
    if filter
      params['max-keys'] = OSS_MAX_RESULT_OBJECTS
    if !filter && max > 0 && max < OSS_MAX_RESULT_OBJECTS
      params['max-keys'] = max
    marker = params.marker
    items = []
    async.doWhilst (cbf) =>
      params.marker = marker
      @listBucket bucket, params, (err, result) ->
        if result
          marker = result.marker
          tmpItems = result.items
          if filter
            tmpItems = _.filter tmpItems, filter
          if ~max
            max -= tmpItems.length
            max = 0 if max < 0
          items = items.concat tmpItems
        cbf err
    , ->
      if ~max
        marker && max > 0
      else
        marker
    , (err) ->
      if err
        cbf err
      else
        cbf null, {
          marker : marker
          items :items
        }

  ###*
   * putObjectFromPath 从目录中更新object（将目录下的所有文件都更新）
   * @param  {[type]} bucket     [description]
   * @param  {[type]} targetPath [description]
   * @param  {[type]} sourcePath [description]
   * @param  {[type]} cbf        [description]
   * @return {[type]}            [description]
  ###
  putObjectFromPath : (bucket, targetPath, sourcePath, progress, cbf) ->
    if !cbf
      cbf = progress
      progress = ->
    sourcePathLen = sourcePath.length
    syncFilesInfo = null
    total = 0
    complete = 0
    async.waterfall [
      (cbf) =>
        @util.classifyFiles sourcePath, LARGE_FILE_SIZE, cbf
      (info, cbf) =>
        syncFilesInfo = info
        failFiles = []
        total = syncFilesInfo.files.length + syncFilesInfo.largeFiles.length
        async.eachLimit syncFilesInfo.files, 5, (file, cbf) =>
          if targetPath
            object = targetPath + file.substring sourcePathLen
          else
            object = '/' + file.substring sourcePathLen
          @updateObjectFromFile bucket, object, file, (err) ->
            status = 'complete'
            if err
              status = 'fail'
              failFiles.push file
            complete++
            progress 'putObjectFromPath', {
              file : file
              status : status
              complete : complete
              total : total
            }
            # progress file, done, complete, total
            cbf null
        , (err) ->
          cbf err, failFiles
      (failFiles, cbf) =>
        async.eachLimit syncFilesInfo.largeFiles, 1, (file, cbf) ->
          object = targetPath + file.substring sourcePathLen
          @updateLargeObjectFromFile bucket, object, file, (err) ->
            status = 'complete'
            if err
              status = 'fail'
              failFiles.push file
            complete++
            progress 'putObjectFromPath', {
              file : file
              status : status
              complete : complete
              total : total
            }
            # progress file, done, complete, total
            cbf null
        , (err) ->
          cbf err, failFiles
    ], cbf

  ###*
   * watch 监控目录的变化，对应更新oss的相应目录（在调用的时候，首先会将整个目录同步一次：根据ETag判断是否需要修改）
   * @param  {String} bucket     [description]
   * @param  {String} targetPath [description]
   * @param  {String} sourcePath [description]
   * @param  {[type]} cbf        [description]
   * @return {[type]}            [description]
  ###
  watch : (bucket, targetPath, sourcePath, cbf) ->
    sourcePathLen = sourcePath.length
    _putFiles = (files, cbf) =>
      failFiles = []
      async.eachLimit files, 2, (file, cbf) =>
        object = targetPath + file.substring sourcePathLen
        @updateObjectFromFile bucket, object, file, (err) ->
          if err
            failFiles.push file
          cbf null
      , ->
        cbf null, failFiles
    _deletedFiles = (files, cbf) =>
      files = _.map files, (file) ->
        targetPath + file.substring sourcePathLen
      @deleteObjects bucket, files, cbf


    @sync bucket, targetPath, sourcePath, (err, failFiles) =>
      @util.watch sourcePath, LARGE_FILE_SIZE, (err, info) ->
        console.dir info
        if info.created
          _putFiles info.created, (err, failFiles) ->
            console.dir failFiles
        if info.changed
          _putFiles info.changed, (err, failFiles) ->
            console.dir failFiles
        if info.deleted
          _deletedFiles info.deleted, (err, data) ->
            console.dir err
            console.dir data
          console.dir info.deleted

  ###*
   * sync 将本地目录和oss的同步（watch操作一开始会调用sync）
   * @param  {String} bucket     [description]
   * @param  {String} targetPath [description]
   * @param  {String} sourcePath [description]
   * @param  {[type]} cbf        [description]
   * @return {[type]}            [description]
  ###
  sync : (bucket, targetPath, sourcePath, progress, cbf) ->
    if !cbf
      cbf = progress
      progress = ->

    getDeleteObjects = (cbf) =>
      async.waterfall [
        (cbf) =>
          prefix = targetPath
          if prefix[prefix.length - 1] != '/'
            prefix += '/'
          @listObjects bucket, {prefix : targetPath}, cbf
        (objectList, cbf) =>
          @util.classifyFiles sourcePath, (err, info) ->
            if err
              cbf err
            else
              tmpFiles = info.files.concat info.largeFiles
              tmpFiles = _.map info.files.concat(info.largeFiles), (file) ->
                file.replace sourcePath, targetPath
              cbf null, _.difference _.pluck(objectList, 'name'), tmpFiles
      ], cbf


    async.waterfall [
      (cbf) =>
        getDeleteObjects cbf
      (objectList, cbf) =>
        console.dir objectList
        @deleteObjects bucket, objectList, cbf
      (cbf) =>
        @putObjectFromPath bucket, targetPath, sourcePath, progress, cbf
    ], cbf


  ###*
   * updateLargeObjectFromFile 更新大文件
   * @param  {String} bucket   [description]
   * @param  {String} object   [description]
   * @param  {String} fileName [description]
   * @param  {[type]} cbf      [description]
   * @return {[type]}          [description]
  ###
  updateLargeObjectFromFile : (bucket, object, fileName, headers, params = {}, cbf) ->
    if _.isFunction headers
      headers = null
      cbf = headers
    else if _.isFunction params
      cbf = params
      params = headers
      headers = null

    async.waterfall [
      (cbf) =>
        @isModified bucket, object, fileName, cbf
      (modified, cbf) =>
        if modified
          async.waterfall [
            (cbf) =>
              @headObject bucket, object, cbf
            (headers, cbf) ->
              @uploadLargeFile bucket, object, fileName, headers, params, cbf
          ], cbf
        else
          cbf null
    ], cbf


  exec : (method, bucket, object, headers = {}, body = '', params = {}, cbf) ->
    cbf = _.once cbf
    # object = @util.toBinary object
    delete headers['Content-Length']
    if !bucket
      resource = '/'
      headers['Host'] = @host
    else
      headers['Host'] = "#{bucket}.#{@host}"
      resource = "/#{bucket}/"
    delete params.progress
    resource = resource + object + @util.getResource params
    url = "http://#{headers['Host']}:#{@port}/#{object}"
    url = @util.appendParam url, params

    headers['Date'] = new Date().toUTCString()
    headers['Authorization'] = @_createSignForNormalAuth method, headers, resource
    if body
      headers['Content-Length'] = body.length
    options = 
      method : method
      body : body
      url : GLOBAL.encodeURI url
      encoding : null
      headers : headers
      timeout : @timeout * 1000
    @request options, @retryTimes, cbf
  request : (options, retryTimes, cbf) ->
    # console.dir options
    method = options.method
    if options.body?.length > MB_SIZE
      delete options.timeout
    request options, (err, res, body) =>
      if err
        if retryTimes > 0
          @request options, --retryTimes, cbf
        else
          cbf err
      else if res.statusCode < 200 || res.statusCode > 299
        err = new Error body
        err.status = res.statusCode
        err.code = res.statusCode
        err.data = body
        cbf err
      else
        headers = res.headers
        @_covertHeaders headers
        if method == 'HEAD'
          cbf null, headers
        else
          if body?.length && headers['Content-Encoding'] == 'gzip'
            zlib.gunzip body, cbf
          else
            cbf null, body || headers

  _md5 : (fileName, cbf) ->
    md5 = crypto.createHash 'md5'
    reader = fs.createReadStream fileName
    reader.pipe md5, {end : false}
    reader.on 'end', (err)->
      if err
        cbf err
      else
        cbf null, md5.digest('hex').toUpperCase()

  ###*
   * _batchDeleteObject 批量删除object
   * @param  {String} bucket     [description]
   * @param  {String} objListXml [description]
   * @param  {Object} {optional} headers [description]
   * @param  {Object} {optional} params  [description]
   * @param  {[type]} cbf        [description]
   * @return {[type]}            [description]
  ###
  _batchDeleteObject : (bucket, objListXml, headers = {}, params = {}, cbf) ->
    if _.isFunction headers
      cbf = headers
      headers = {}
    else if _.isFunction params
      cbf = params
      params = headers
      headers = null

    method = 'POST'
    object = ''
    body = new Buffer objListXml
    headers['Content-Length'] = body.length
    params['delete'] = ''
    md5 = crypto.createHash 'md5'
    headers['Content-Md5'] = md5.update(body).digest('base64').trim()
    @exec method, bucket, object, headers, body, params, cbf

  _covertHeaders : (headers) ->
    covertKeys = 
      'cache-control' : 'Cache-Control'
      'connection' : 'Connection'
      'content-encoding' : 'Content-Encoding'
      'content-length' : 'Content-Length'
      'content-type' : 'Content-Type'
      'content-language' : 'Content-Language'
      'date' : 'Date'
      'etag' : 'ETag'
      'last-modified' : 'Last-Modified'
    _.each covertKeys, (value, key) ->
      if headers[key]
        headers[value] = headers[key]
        delete headers[key]
  _createSignForNormalAuth : (method, headers = {}, resource = '/') ->
    "#{@provider} #{@accessId}:#{@util.getAssign(@accessKey, method, headers, resource)}"


Client::getService = Client::listAllMyBuckets
Client::getBucket = Client::listBucket
Client::createBucket = Client::putBucket
Client::putObjectFromString = Client::putObjectWithData
Client::batchDeleteObjects = Client::deleteObjects
module.exports = Client

