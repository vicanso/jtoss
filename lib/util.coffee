async = require 'async'
_ = require 'underscore'
fs = require 'fs'
crypto = require 'crypto'
path = require 'path'
mime = require 'mime'
request = require 'request'
zlib = require 'zlib'
glob = require 'glob'
MB_SIZE = 1024 * 1024
PART_SIZE = 1 * MB_SIZE
SELF_DEFINE_HEADER_PREFIX = "x-oss-"
PROVIDER = "OSS"
if PROVIDER == "AWS"
  SELF_DEFINE_HEADER_PREFIX = "x-amz-"
noop = ->

startsWith = (str, starts) ->
  if starts == ''
    true
  else if str? && starts?
    str = String str
    starts = String starts
    str.length >= starts.length && str.slice(0, starts.length) == starts
  else
    false

safeGetElement = (name, obj) ->
  name = name.trim().toLowerCase()
  result = ''
  _.each obj, (value, key) ->
    if !result && key.trim().toLowerCase() == name
      result = value
  result


class UTIL
  constructor : ->
  ###*
   * [getAssign description]
   * @param  {[type]} accessKey [description]
   * @param  {[type]} method    [description]
   * @param  {[type]} headers   =             {} [description]
   * @param  {[type]} resource  =             '/'  [description]
   * @return {[type]}           [description]
  ###
  getAssign : (accessKey, method, headers = {}, resource = '/') ->
    contentMd5 = safeGetElement 'Content-MD5', headers
    contentType = safeGetElement 'Content-Type', headers
    date = safeGetElement 'Date', headers
    canonicalizedResource = resource
    canonicalizedOssHeaders = ''
    tmpHeaders = @_formatHeader headers
    tmpKeys = _.keys tmpHeaders
    if tmpKeys.length
      tmpKeys.sort()
      _.each tmpKeys, (key) ->
        if startsWith key, SELF_DEFINE_HEADER_PREFIX
          canonicalizedOssHeaders += "#{key}:#{tmpHeaders[key]}\n"
    strToSign = "#{method}\n#{contentMd5.trim()}\n#{contentType}\n#{date}\n#{canonicalizedOssHeaders}#{canonicalizedResource}"
    sha1 = crypto.createHmac 'sha1', accessKey
    sha1.update(@toBinary(strToSign)).digest('base64').trim()

  ###*
   * [getResource description]
   * @param  {[type]} params =             {} [description]
   * @return {[type]}        [description]
  ###
  getResource : (params = {}) ->
    tmpHeaders = {}
    queryStr = ''
    _.each params, (value, key) ->
      tmpHeaders[key.toLowerCase().trim()] = value
    overrideResponseList = 'response-content-type response-content-language response-cache-control logging response-content-encoding acl uploadId uploads partNumber group delete website response-expires response-content-disposition'.split(' ').sort()
    resource = ''
    result = []
    _.each overrideResponseList, (key) ->
      tmpKey = key.toLowerCase()
      if _.has tmpHeaders, tmpKey
        if tmpHeaders[tmpKey]
          result.push "#{key}=#{tmpHeaders[tmpKey]}"
        else
          result.push key
    if result.length
      resource += "?#{result.join('&')}"
    resource


  ###*
   * [appendParam description]
   * @param  {[type]} url    [description]
   * @param  {[type]} params [description]
   * @return {[type]}        [description]
  ###
  appendParam : (url, params) ->
    result = []
    _.each params, (value, key) =>
      key = key.replace '_', '-'
      if key == 'maxKeys'
        key = 'max-keys'
      # value = @toBinary value
      if value
        result.push "#{key}=#{value}"
      else if key == 'acl'
        result.push key
      else if !value
        result.push key
    if result.length
      url += "?#{result.join('&')}"
    url

  ###*
   * [createObjectGroupMsgXml description]
   * @param  {[type]} partMsgList =             [] [description]
   * @return {[type]}             [description]
  ###
  createObjectGroupMsgXml : (partMsgList = []) ->
    xmlArr = ['<CreateFileGroup>']
    _.each partMsgList, (part) =>
      if part.length >= 3
        filePath = @toBinary part[1]
        xmlArr.push '<Part>'
        xmlArr.push "<PartNumber>#{part[0]}</PartNumber>"
        xmlArr.push "<PartName>#{_.escape(filePath)}</PartName>"
        xmlArr.push "<ETag>#{part[2].toUpperCase()}</ETag>"
        xmlArr.push '</Part>'
      else
        console.error "the part params is less than 3"
    xmlArr.push '</CreateFileGroup>'
    xmlArr.join ''

  ###*
   * [createPartXml description]
   * @param  {[type]} partMsgList =             [] [description]
   * @return {[type]}             [description]
  ###
  createPartXml : (partMsgList = []) ->
    xmlArr = ['<CompleteMultipartUpload>']
    _.each partMsgList, (part) =>
      if part.length >= 3
        xmlArr.push '<Part>'
        xmlArr.push "<PartNumber>#{part[0]}</PartNumber>"
        xmlArr.push "<ETag>#{part[2].toUpperCase()}</ETag>"
        xmlArr.push '</Part>'
      else
        console.error "the part params is less than 3"
    xmlArr.push '</CompleteMultipartUpload>'
    xmlArr.join ''


  ###*
   * [createDeleteObjectMsgXml description]
   * @param  {[type]}  objList =             []   [description]
   * @param  {Boolean} isQuiet =             true [description]
   * @return {[type]}          [description]
  ###
  createDeleteObjectMsgXml : (objList = [], isQuiet = true) ->
    xmlArr = ['<?xml version="1.0" encoding="UTF-8"?><Delete>']
    if isQuiet
      xmlArr.push '<Quiet>true</Quiet>'
    _.each objList, (obj) =>
      obj = _.escape obj.trim()
      xmlArr.push "<Object><Key>#{obj}</Key></Object>"
    xmlArr.push '</Delete>'
    xmlArr.join ''


  ###*
   * [splitLargeFile description]
   * @param  {[type]} filePath     [description]
   * @param  {[type]} objectPrefix =             ''        [description]
   * @param  {[type]} maxPartNum   =             1000      [description]
   * @param  {[type]} partSize     =             PART_SIZE [description]
   * @param  {[type]} cbf          [description]
   * @return {[type]}              [description]
  ###
  splitLargeFile : (filePath, objectPrefix = '', maxPartNum = 1000, partSize = PART_SIZE, cbf) ->
    if _.isFunction objectPrefix
      cbf = objectPrefix
      objectPrefix = ''
    else if _.isFunction maxPartNum
      cbf = maxPartNum
      maxPartNum = 1000
    else if _.isFunction partSize
      cbf = partSize
      partSize = PART_SIZE
    getInfo = (fd, offset, len, cbf) ->
      md5 = crypto.createHash 'md5'
      bufferSize = MB_SIZE
      leftLen = len
      throwErr = null
      realSize = 0
      readIndex = 0
      async.whilst ->
        leftLen > 0
      , (cbf) ->
        readSize = bufferSize
        if leftLen < bufferSize
          readSize = leftLen
        buf = new Buffer readSize
        fs.read fd, buf, 0, readSize, offset, (err, bytesRead, buf) ->
          if err
            cbf err
          else
            if bytesRead
              realSize += bytesRead
              offset += bytesRead
              leftLen -= bytesRead
              if bytesRead != buf.length
                buf = buf.slice 0, bytesRead
              md5.update buf
            else
              leftLen = 0
            cbf null
      , (err) ->
        if err
          cbf err
        else
          cbf null, {
            md5Sum : md5.digest 'hex'
            realSize : realSize
          }

    ###*
     * [getPartMsg description]
     * @param  {[type]} objectPrefix [description]
     * @param  {[type]} filePath     [description]
     * @param  {[type]} fd           [description]
     * @param  {[type]} index        [description]
     * @param  {[type]} partSize     [description]
     * @param  {[type]} cbf          [description]
     * @return {[type]}              [description]
    ###
    getPartMsg = (objectPrefix, filePath, fd, index, partSize, cbf) ->
      md5 = crypto.createHash 'md5'
      partOrder = index + 1
      offset = index * partSize
      async.waterfall [
        (cbf) ->
          getInfo fd, offset, partSize, cbf
        (info, cbf) ->
          tmpFileName = path.basename(filePath) + '_' + partOrder
          if objectPrefix
            fileName = "#{objectPrefix}/#{md5.update(tmpFileName).digest('hex')}_#{tmpFileName}"
          else
            fileName = "#{md5.update(tmpFileName).digest('hex')}_#{tmpFileName}"
          cbf null, [
            partOrder
            fileName
            info.md5Sum.toUpperCase()
            info.realSize
            offset
          ]
      ], cbf


    ###*
     * [getPartsList description]
     * @param  {[type]} filePath [description]
     * @param  {[type]} partNum  [description]
     * @param  {[type]} cbf      [description]
     * @return {[type]}          [description]
    ###
    getPartsList = (filePath, partNum, cbf) ->
      partsList = []
      async.waterfall [
        (cbf) ->
          fs.open filePath, 'r', cbf
        (fd, cbf) ->
          arr = _.range 0, partNum
          async.eachLimit arr, 2, (index, cbf) ->
            getPartMsg objectPrefix, filePath, fd, index, partSize, (err, partMsg) ->
              if partMsg
                partsList.push partMsg
              cbf err
          , (err) ->
            cbf err, fd
        (fd, cbf) ->
          fs.close fd, cbf
      ], (err) ->
        partsList.sort (parts1, parts2) ->
          parts1[0] - parts2[0]
        cbf err, partsList

    async.waterfall [
      (cbf) ->
        fs.stat filePath, cbf
      (stats, cbf) ->
        if !stats.isFile()
          cbf new Error "#{filePath} is not a file"
        else
          cbf null, stats.size
      (fileSize, cbf) ->
        if fileSize < partSize
          partSize = fileSize
        else if fileSize > partSize * maxPartNum
          partSize = (fileSize + maxPartNum - fileSize % maxPartNum) / maxPartNum
        partNum = Math.ceil fileSize / partSize
        getPartsList filePath, partNum, cbf
    ], cbf



  watch : (targetPath, limit, cbf) ->
    watch = require 'watch'
    createdList = []
    changedList = []
    removedList = []
    watch.createMonitor targetPath, {ignoreDotFiles : true}, (monitor) ->
      monitor.on 'created', (f, stat) ->
        createdList.push f
      monitor.on 'changed', (f, curr, prev) ->
        changedList.push f
      monitor.on 'removed', (f, stat) ->
        removedList.push f

    GLOBAL.setInterval ->
      if createdList.length || changedList.length || removedList.length
        result = 
          created : _.uniq createdList
          changed : _.uniq changedList
          deleted : _.uniq removedList
        createdList = []
        changedList = []
        removedList = []
        cbf null, result
    , 6 * 1000



  classifyFiles : (targetPath, limit = PART_SIZE, cbf) ->
    targetPath += '/**'
    filterFiles = (files, limit, cbf) ->
      dirs = []
      largeFiles = []
      normalFiles = []
      async.eachLimit files, 1, (file, cbf) ->
        if file[0] == '.'
          GLOBAL.setImmediate cbf
        else
          fs.stat file, (err, stats) ->
            if err
              cbf err
            else 
              if stats.isFile()
                if stats.size > limit
                  largeFiles.push file
                else
                  normalFiles.push file
              else
                dirs.push file
              cbf null
      , (err) ->
        if err
          cbf err
        else
          cbf null, {
            files : normalFiles
            dirs : dirs
            largeFiles : largeFiles
          }

    if _.isFunction limit
      cbf = limit
      limit = PART_SIZE
    async.waterfall [
      (cbf) ->
        glob targetPath, cbf
      (files) ->
        filterFiles files, limit, cbf
    ], cbf

  toBinary : (str) ->
    if !_.isString str
      str
    else if !str
      ''
    else
      new Buffer(str).toString 'binary'
  _formatHeader : (headers = {}) ->
    tmpHeaders = {}
    _.each headers, (value, key) =>
      # value = @toBinary value
      headers[key] = value
      if startsWith key.toLowerCase(), SELF_DEFINE_HEADER_PREFIX
        tmpHeaders[key.toLowerCase()] = value
      else
        tmpHeaders[key] = value
    tmpHeaders

module.exports = UTIL