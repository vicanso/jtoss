UTIL = require './util'
fs = require 'fs'
_ = require 'underscore'
path = require 'path'
async = require 'async'
jtfs = require 'jtfs'
zlib = require 'zlib'
xml2js = require 'xml2js'
noop = ->

class Client
  constructor : (@accessId, @accessKey, @host = 'oss.aliyuncs.com', @port = '8080', @timeout = 30000 ) ->
    @util = new UTIL @accessId, @accessKey, @host, @port, @timeout
  ###*
   * createBucket 创建bucket
   * @param  {String} bucket 
   * @param  {String} acl bucket的访问权限控制，默认值为private，可选值有private,public-read,public-read-write
   * @param  {Function} cbf 回调函数(err, result)
   * @return {[type]}        [description]
  ###
  createBucket : (bucket, acl = 'private', cbf = noop) ->
    if _.isFunction acl
      cbf = acl
      acl = 'private'
    if !bucket
      cbf new Error 'the param bucket can not be null'
      return
    method = 'put'
    metas = 
      'x-oss-acl' : acl
    ossParams =
      bucket : bucket
    @util.exec method, metas, ossParams, cbf
    @
  ###*
   * [getService description]
   * @param  {[type]} cbf =             noop [description]
   * @return {[type]}     [description]
  ###
  getService : (cbf = noop) ->
    @listBuckets cbf
  ###*
   * listBuckets 显示所有bucket
   * @param  {Function} cbf (err, result)
   * @return {[type]}     [description]
  ###
  listBuckets : (cbf = noop) ->
    method = 'get'
    ossParams = 
      bucket : ''
    async.waterfall [
      (cbf) =>
        @util.exec method, null, ossParams, cbf
      (body, cbf) ->
        parser = new xml2js.Parser()
        parser.parseString body, cbf
    ], (err, result) ->
      if err
        cbf err
      else
        cbf null, _.map result.ListAllMyBucketsResult.Buckets[0].Bucket, (item) ->
          {
            name : item.Name[0]
            createdAt : item.CreationDate[0]
          }
    @
  ###*
   * deleteBucket 删除bucket
   * @param  {String} bucket 
   * @param  {Function} cbf 回调函数(err, result)
   * @return {[type]}        [description]
  ###
  deleteBucket : (bucket, cbf = noop) ->
    if !bucket
      cbf new Error 'the param bucket can not be null'
      return
    method = 'delete'
    ossParams =
      bucket : bucket
    @util.exec method, null, ossParams, cbf
    @
  ###*
   * setBucketAcl 设置bucket的访问权限
   * @param {String} bucket
   * @param {String} acl 访问权限
   * @param {Function} cbf 回调函数(err, result)
  ###
  setBucketAcl : (bucket, acl, cbf = noop) ->
    if arguments.length < 2
      cbf new Error 'the arguments is less than 2'
      return
    method = 'put'
    metas = 
      'x-oss-acl' : acl
    ossParams = 
      bucket : bucket
    @util.exec method, metas, ossParams, cbf
    @
  ###*
   * getBucketAcl 获取bucket设置的权限
   * @param  {[type]} bucket [description]
   * @param  {[type]} cbf    =             noop [description]
   * @return {[type]}        [description]
  ###
  getBucketAcl : (bucket, cbf = noop) ->
    if arguments.length < 1
      cbf new Error 'the arguments is less than 2'
      return
    ossParams = 
      bucket : bucket
      acl : ''
    headers = {}
    method = 'get'
    async.waterfall [
      (cbf) =>
        @util.exec method, '', ossParams, cbf
      (body, cbf) ->
        parser = new xml2js.Parser()
        parser.parseString body, cbf
      (data, cbf) ->
        cbf null, {
          access : data.AccessControlPolicy.AccessControlList[0].Grant[0]
        }
    ], cbf
    @
  ###*
   * putObject 上传object
   * @param  {String} bucket 
   * @param  {String} object object在oss中的路径
   * @param  {String, Object} srcFile 源文件地址或者{name : xxx, data : xxx}
   * @param  {Object} {optional} userMetas [description]
   * @param  {Function} cbf 回调函数(err, result)
   * @return {[type]}           [description]
  ###
  putObject : (bucket, object, srcFile, userMetas, cbf = noop) ->
    if arguments.length < 3
      cbf new Error 'the arguments is less than 3'
      return
    method = 'put'
    ossParams = 
      bucket : bucket
      object : object
    if _.isFunction userMetas
      cbf = userMetas
    else if _.isObject userMetas
      ossParams.userMetas = userMetas
    async.waterfall [
      (cbf) ->
        if _.isString srcFile
          fs.readFile srcFile, (err, data) ->
            if err
              cbf err
            else
              cbf null, {
                name : srcFile
                data : data
              }
        else
          cbf null, srcFile
      (srcData, cbf) ->
        if userMetas?['Content-Encoding'] == 'gzip'
          zlib.gzip srcData.data, (err, gzipData) ->
            if err
              cbf err
            else
              srcData.data = gzipData
              cbf null, srcData
        else
          cbf null, srcData
      (srcData, cbf) =>
        @util.exec method, null, ossParams, srcData, cbf
    ], cbf
    @
  ###*
   * copyObject 复制object
   * @param  {String} bucket 
   * @param  {String} dstObj 目标object
   * @param  {String} srcObj 源object
   * @param  {Object} {optional} userMetas [description]
   * @param  {Function} cbf 回调函数(err, result)
   * @return {[type]}        [description]
  ###
  copyObject : (bucket, dstObj, srcObj, userMetas, cbf = noop) ->
    if arguments.length < 3
      cbf new Error 'the arguments is less than 3'
      return
    method = 'put'
    ossParams = 
      bucket : bucket
      object : dstObj
    metas = {}
    if _.isFunction userMetas
      cbf = userMetas
    else if _.isObject userMetas
      ossParams.userMetas = userMetas
      _.each userMetas, (value, key) ->
        if !key.indexOf 'x-oss-'
          metas[key] = value
          delete userMetas[key]
    metas['x-oss-copy-source'] = "/#{bucket}/#{srcObj}"
    @util.exec method, metas, ossParams, cbf
    @
  ###*
   * updateObject 更新object
   * @param  {String} bucket 
   * @param  {String} dstObj 目标对象，在oss上的路径
   * @param  {String} srcObj 源对象
   * @param  {Function} cbf 回调函数(err, result)
   * @return {[type]}        [description]
  ###
  updateObject : (bucket, dstObj, srcObj, cbf = noop) ->
    if arguments.length < 3
      cbf new Error 'the arguments is less than 3'
      return
    headers = null
    updateFlag = false
    updateCbf = cbf
    async.auto {
      getData : (cbf) ->
        if _.isString srcObj
          fs.readFile srcObj, (err, data) ->
            if err
              updateCbf err
            else
              srcObj = 
                name : srcObj
                data : data
              cbf null
      getHeaders : (cbf) =>
        @headObject bucket, dstObj, (err, result) ->
          headers = result
          cbf null
      checkData : [
        'getData'
        'getHeaders'
        (cbf) ->
          if headers?['Content-Encoding'] == 'gzip'
            zlib.gzip srcObj.data, (err, data) ->
              if err
                updateCbf err
              else
                srcObj.zipData = data
                cbf null
          else
            srcObj.zipData = srcObj.data
            cbf null
      ]
      check : [
        'checkData'
        (cbf) =>
          ossEtag = headers?['ETag']
          @util.getETag srcObj.zipData, (err, etag) ->
            if err
              updateCbf err
            else
              updateFlag = etag != ossEtag
              cbf null
      ]
      update : [
        'check'
        =>
          if updateFlag
            @putObject bucket, dstObj, srcObj, cbf
          else
            cbf null
      ]
    }
    @
  ###*
   * updateObjectHeader 更新Object的response header
   * @param  {[type]} bucket           [description]
   * @param  {[type]} obj              [description]
   * @param  {[type]} resContentHeader [description]
   * @param  {[type]} cbf              =             noop [description]
   * @return {[type]}                  [description]
  ###
  updateObjectHeader : (bucket, obj, resContentHeader, cbf = noop) ->
    if arguments.length < 3
      cbf new Error 'the arguments is less than 3'
      return
    resContentHeader['x-oss-metadata-directive'] = 'REPLACE'
    # if !resContentHeader['Content-Encoding']
    #   @copyObject bucket, obj, obj, resContentHeader, cbf
    # else
    async.waterfall [
      (cbf) =>
        @headObject bucket, obj, cbf
      (headers, cbf) =>
        if headers['Content-Encoding'] == resContentHeader['Content-Encoding']
          @copyObject bucket, obj, obj, resContentHeader, cbf
        else
          # TODO
          async.waterfall [
            (cbf) =>
              @getObject bucket, obj, cbf
            (data, cbf) =>
              @putObject bucket, obj, {name : obj, data : data}, resContentHeader, cbf
          ], cbf
    ], cbf
    @
  ###*
   * deleteObject 删除object
   * @param  {String} bucket 
   * @param  {String} obj 要删除的obj在oss上的路径
   * @param  {Function} cbf 回调函数(err, result)
   * @return {[type]}        [description]
  ###
  deleteObject : (bucket, obj, cbf = noop) ->
    if arguments.length < 2
      cbf new Error 'the arguments is less than 2'
      return
    method = 'delete'
    ossParams = 
      bucket : bucket
      object : obj
    @util.exec method, null, ossParams, cbf
    @
  ###*
   * getObject 获取object
   * @param  {String} bucket
   * @param  {String} obj 要获取的obj在oss上的路径
   * @param  {Object} {optional} userHeaders [description]
   * @param  {Function} cbf 回调函数，(err, data)
   * @return {[type]}             [description]
  ###
  getObject : (bucket, obj, userHeaders, cbf = noop) ->
    if arguments.length < 2
      cbf new Error 'the arguments is less than 2'
      return
    method = 'get'
    ossParams =
      bucket : bucket
      object : obj
    if _.isFunction userHeaders
      cbf = userHeaders
    else if _.isObject userHeaders
      ossParams.userHeaders = userHeaders
    @util.exec method, null, ossParams, cbf
    @
  ###*
   * getObjectToFile 获取Object保存到文件
   * @param  {[type]} bucket      [description]
   * @param  {[type]} obj         [description]
   * @param  {[type]} dstFile     [description]
   * @param  {[type]} userHeaders [description]
   * @param  {[type]} cbf         =             noop [description]
   * @return {[type]}             [description]
  ###
  getObjectToFile : (bucket, obj, dstFile, userHeaders, cbf = noop) ->
    if arguments.length < 3
      cbf new Error 'the arguments is less than 2'
      return
    @getObject bucket, obj, userHeaders, (err, data) ->
      if err
        cbf err
      else
        fs.writeFile dstFile, data, cbf
    @
  ###*
   * headObject 获取Obejct的header信息
   * @param  {String} bucket
   * @param  {String} obj 要获取的obj在oss上的路径
   * @param  {Function} cbf 回调函数(err, cbf)
   * @return {[type]}        [description]
  ###
  headObject : (bucket, obj, cbf = noop) ->
    if arguments.length < 2
      cbf new Error 'the arguments is less than 2'
      return
    method = 'head'
    ossParams =
      bucket : bucket
      object : obj
    @util.exec method, null, ossParams, cbf
    @
  ###*
   * listObjects 列出object（oss限制最多一次只能获取1000个）
   * @param  {String} bucket
   * @param  {Object} {optional} options [description]
   * @param  {Function} cbf 回调函数(err, result)
   * @return {[type]}         [description]
  ###
  listObjects : (bucket, options, cbf = noop) ->
    if arguments.length < 1
      cbf new Error 'the arguments is less than 1'
      return
    if _.isFunction options
      cbf = options
      options = null
    method = 'get'
    ossParams = 
      bucket : bucket
    _.extend ossParams, options
    async.waterfall [
      (cbf) =>
        @util.exec method, null, ossParams, cbf
      (body, cbf) ->
        new xml2js.Parser().parseString body, cbf
    ], (err, res) ->
      if err
        cbf err
      else
        result = []
        ListBucketResult = res.ListBucketResult
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
        total = result.length
        next = ListBucketResult.NextMarker?[0]
        cbf null, {
          total : total
          next : next
          items : result
        }
    @
  ###*
   * listAllObjects 获取所有的object（通过多次调用listObjects，获取所有的Objects）
   * @param  {[type]} bucket  [description]
   * @param  {[type]} options [description]
   * @param  {[type]} cbf     =             noop [description]
   * @return {[type]}         [description]
  ###
  listAllObjects : (bucket, options, cbf = noop) ->
    next = null
    items = []
    async.doWhilst (cbf) =>
      options.marker = next
      @listObjects bucket, options, (err, result) ->
        if result
          next = result.next
          items = items.concat result.items
        cbf err
    , () ->
      next
    , (err) ->
      cbf err, items
  ###*
   * [createObjectGroup description]
   * @param  {[type]} bucket   [description]
   * @param  {[type]} objGroup [description]
   * @param  {[type]} objs     [description]
   * @param  {[type]} cbf      [description]
   * @return {[type]}          [description]
  ###
  createObjectGroup : (bucket, objGroup, objs, cbf = noop) ->
    if arguments.length < 3
      cbf new Error 'the arguments is less than 3'
      return
    method = 'post'
    ossParams =
      bucket : bucket
      object : objGroup
      objectArray : objs
      isGroup : true
    @util.exec method, null, ossParams, cbf
    @
  ###*
   * [getObjectGroup description]
   * @param  {[type]} bucket   [description]
   * @param  {[type]} objGroup [description]
   * @param  {[type]} dstFile  [description]
   * @param  {[type]} cbf      [description]
   * @return {[type]}          [description]
  ###
  getObjectGroup : (bucket, objGroup, dstFile, cbf = noop) ->
    if arguments.length < 3
      cbf new Error 'the arguments is less than 3'
      return
    method = 'get'
    ossParams = 
      bucket : bucket
      object : objGroup
      isGroup : true
      dstFile : dstFile
    @util.exec method, null, ossParams, cbf
    @
  ###*
   * [getObjectGroupIndex description]
   * @param  {[type]} bucket   [description]
   * @param  {[type]} objGroup [description]
   * @param  {[type]} cbf      [description]
   * @return {[type]}          [description]
  ###
  getObjectGroupIndex : (bucket, objGroup, cbf = noop) ->
    if arguments.length < 2
      cbf new Error 'the arguments is less than 2'
      return
    method = 'get'
    ossParams =
      bucket : bucket
      object : objGroup
    metas = 
      'x-oss-file-group' : ''
    @util.exec method, metas, ossParams, cbf
    @
  ###*
   * [headObjectGroup description]
   * @param  {[type]} bucket   [description]
   * @param  {[type]} objGroup [description]
   * @param  {[type]} cbf      [description]
   * @return {[type]}          [description]
  ###
  headObjectGroup : (bucket, objGroup, cbf = noop) ->
    if arguments.length < 2
      cbf new Error 'the arguments is less than 3'
      return
    method = 'head'
    ossParams =
      bucket : bucket
      object : objGroup
    @util.exec method, null, ossParams, cbf
    @
  ###*
   * [deleteObjectGroup description]
   * @param  {[type]} bucket   [description]
   * @param  {[type]} objGroup [description]
   * @param  {[type]} cbf      [description]
   * @return {[type]}          [description]
  ###
  deleteObjectGroup : (bucket, objGroup, cbf = noop) ->
    if arguments.length < 2
      cbf new Error 'the arguments is less than 2'
      return
    method = 'delete'
    ossParams = 
      bucket : bucket
      object : objGroup
    @util.exec method, null, ossParams, cbf
    @

  ###*
   * deleteObjects 删除objects
   * @param  {[type]} bucket [description]
   * @param  {[type]} data   [description]
   * @param  {[type]} cbf    [description]
   * @return {[type]}        [description]
  ###
  deleteObjects : (bucket, data, cbf = noop) ->
    headers = {}
    data = new Buffer data
    headers['Content-Length'] = data.length;
    headers['Content-Md5'] = @util.md5 data, 'base64'
    options =
      method : 'POST'
      url : GLOBAL.encodeURI "http://#{bucket}.#{@host}:#{@port}/?delete"
      headers : headers
      body : data
    @util.request options, (err, body) ->
      if err
        cbf err
      else if body
        parser = new xml2js.Parser()
        parser.parseString body, cbf
      else
        cbf null
  ###*
   * sync 同步文件
   * @param  {[type]} bucket  [description]
   * @param  {[type]} ossPath [description]
   * @param  {[type]} files   [description]
   * @param  {[type]} cbf     [description]
   * @return {[type]}         [description]
  ###
  sync : (bucket, ossPath, files, viewProgress, cbf = noop) ->
    if arguments.length < 3
      cbf new Error 'the arguments is less than 2'
      return
    if _.isFunction viewProgress
      cbf = viewProgress
      viewProgress = false
    files = [files] if !_.isArray files
    failFiles = []
    successFiles = []
    if viewProgress
      total = files.length
      completeTotal = 0
      step = Math.floor total / 10
      stepCbf = ->
        if completeTotal % step == 0
          cbf null, {
            completion : Math.floor completeTotal / total * 100
            fail : failFiles
            success : successFiles
          }
    async.eachLimit files, 10, (file, cbf) =>
      targetPath = path.join ossPath, path.basename file
      @updateObject bucket, targetPath, file, (err) ->
        if err
          failFiles.push file
        else
          successFiles.push file
        if viewProgress
          completeTotal++
          stepCbf()
        cbf null
    , ->
      cbf null, {
        completion : 100
        fail : failFiles
        success : successFiles
      }
  ###*
   * syncPath 同步文件夹
   * @param  {[type]} dstPath [description]
   * @param  {[type]} bucket  [description]
   * @param  {[type]} ossPath [description]
   * @param  {[type]} cbf     =             noop [description]
   * @return {[type]}         [description]
  ###
  syncPath : (dstPath, bucket, ossPath, cbf = noop) ->
    if arguments.length < 2
      cbf new Error 'the arguments is less than 2'
      return
    originPath = dstPath
    failFiles = []
    async.whilst () ->
      if _.isArray dstPath
        dstPath.length
      else
        dstPath
    , (cbf) =>
      async.waterfall [
        (cbf) ->
          jtfs.getFiles dstPath, cbf
        (infos, cbf) =>
          files = infos.files
          dstPath = infos.dirs
          if files.length
            filePath = path.dirname files[0]
            targetPath = path.join ossPath, path.relative originPath, filePath
            @sync files, bucket, targetPath, cbf
          else
            cbf null
      ], (err, result) ->
        if result?.fail?.length
          failFiles = failFiles.concat result.fail
        cbf null
    , ->
      cbf null, failFiles
module.exports = Client