(function() {
  var MB_SIZE, PART_SIZE, PROVIDER, SELF_DEFINE_HEADER_PREFIX, UTIL, async, crypto, fs, glob, mime, noop, path, request, safeGetElement, startsWith, zlib, _;

  async = require('async');

  _ = require('underscore');

  fs = require('fs');

  crypto = require('crypto');

  path = require('path');

  mime = require('mime');

  request = require('request');

  zlib = require('zlib');

  glob = require('glob');

  MB_SIZE = 1024 * 1024;

  PART_SIZE = 1 * MB_SIZE;

  SELF_DEFINE_HEADER_PREFIX = "x-oss-";

  PROVIDER = "OSS";

  if (PROVIDER === "AWS") {
    SELF_DEFINE_HEADER_PREFIX = "x-amz-";
  }

  noop = function() {};

  startsWith = function(str, starts) {
    if (starts === '') {
      return true;
    } else if ((str != null) && (starts != null)) {
      str = String(str);
      starts = String(starts);
      return str.length >= starts.length && str.slice(0, starts.length) === starts;
    } else {
      return false;
    }
  };

  safeGetElement = function(name, obj) {
    var result;
    name = name.trim().toLowerCase();
    result = '';
    _.each(obj, function(value, key) {
      if (!result && key.trim().toLowerCase() === name) {
        return result = value;
      }
    });
    return result;
  };

  UTIL = (function() {

    function UTIL() {}

    /**
     * [getAssign description]
     * @param  {[type]} accessKey [description]
     * @param  {[type]} method    [description]
     * @param  {[type]} headers   =             {} [description]
     * @param  {[type]} resource  =             '/'  [description]
     * @return {[type]}           [description]
    */


    UTIL.prototype.getAssign = function(accessKey, method, headers, resource) {
      var canonicalizedOssHeaders, canonicalizedResource, contentMd5, contentType, date, sha1, strToSign, tmpHeaders, tmpKeys;
      if (headers == null) {
        headers = {};
      }
      if (resource == null) {
        resource = '/';
      }
      contentMd5 = safeGetElement('Content-MD5', headers);
      contentType = safeGetElement('Content-Type', headers);
      date = safeGetElement('Date', headers);
      canonicalizedResource = resource;
      canonicalizedOssHeaders = '';
      tmpHeaders = this._formatHeader(headers);
      tmpKeys = _.keys(tmpHeaders);
      if (tmpKeys.length) {
        tmpKeys.sort();
        _.each(tmpKeys, function(key) {
          if (startsWith(key, SELF_DEFINE_HEADER_PREFIX)) {
            return canonicalizedOssHeaders += "" + key + ":" + tmpHeaders[key] + "\n";
          }
        });
      }
      strToSign = "" + method + "\n" + (contentMd5.trim()) + "\n" + contentType + "\n" + date + "\n" + canonicalizedOssHeaders + canonicalizedResource;
      sha1 = crypto.createHmac('sha1', accessKey);
      return sha1.update(this.toBinary(strToSign)).digest('base64').trim();
    };

    /**
     * [getResource description]
     * @param  {[type]} params =             {} [description]
     * @return {[type]}        [description]
    */


    UTIL.prototype.getResource = function(params) {
      var overrideResponseList, queryStr, resource, result, tmpHeaders;
      if (params == null) {
        params = {};
      }
      tmpHeaders = {};
      queryStr = '';
      _.each(params, function(value, key) {
        return tmpHeaders[key.toLowerCase().trim()] = value;
      });
      overrideResponseList = 'response-content-type response-content-language response-cache-control logging response-content-encoding acl uploadId uploads partNumber group delete website response-expires response-content-disposition'.split(' ').sort();
      resource = '';
      result = [];
      _.each(overrideResponseList, function(key) {
        var tmpKey;
        tmpKey = key.toLowerCase();
        if (_.has(tmpHeaders, tmpKey)) {
          if (tmpHeaders[tmpKey]) {
            return result.push("" + key + "=" + tmpHeaders[tmpKey]);
          } else {
            return result.push(key);
          }
        }
      });
      if (result.length) {
        resource += "?" + (result.join('&'));
      }
      return resource;
    };

    /**
     * [appendParam description]
     * @param  {[type]} url    [description]
     * @param  {[type]} params [description]
     * @return {[type]}        [description]
    */


    UTIL.prototype.appendParam = function(url, params) {
      var result,
        _this = this;
      result = [];
      _.each(params, function(value, key) {
        key = key.replace('_', '-');
        if (key === 'maxKeys') {
          key = 'max-keys';
        }
        if (value) {
          return result.push("" + key + "=" + value);
        } else if (key === 'acl') {
          return result.push(key);
        } else if (!value) {
          return result.push(key);
        }
      });
      if (result.length) {
        url += "?" + (result.join('&'));
      }
      return url;
    };

    /**
     * [createObjectGroupMsgXml description]
     * @param  {[type]} partMsgList =             [] [description]
     * @return {[type]}             [description]
    */


    UTIL.prototype.createObjectGroupMsgXml = function(partMsgList) {
      var xmlArr,
        _this = this;
      if (partMsgList == null) {
        partMsgList = [];
      }
      xmlArr = ['<CreateFileGroup>'];
      _.each(partMsgList, function(part) {
        var filePath;
        if (part.length >= 3) {
          filePath = _this.toBinary(part[1]);
          xmlArr.push('<Part>');
          xmlArr.push("<PartNumber>" + part[0] + "</PartNumber>");
          xmlArr.push("<PartName>" + (_.escape(filePath)) + "</PartName>");
          xmlArr.push("<ETag>" + (part[2].toUpperCase()) + "</ETag>");
          return xmlArr.push('</Part>');
        } else {
          return console.error("the part params is less than 3");
        }
      });
      xmlArr.push('</CreateFileGroup>');
      return xmlArr.join('');
    };

    /**
     * [createPartXml description]
     * @param  {[type]} partMsgList =             [] [description]
     * @return {[type]}             [description]
    */


    UTIL.prototype.createPartXml = function(partMsgList) {
      var xmlArr,
        _this = this;
      if (partMsgList == null) {
        partMsgList = [];
      }
      xmlArr = ['<CompleteMultipartUpload>'];
      _.each(partMsgList, function(part) {
        if (part.length >= 3) {
          xmlArr.push('<Part>');
          xmlArr.push("<PartNumber>" + part[0] + "</PartNumber>");
          xmlArr.push("<ETag>" + (part[2].toUpperCase()) + "</ETag>");
          return xmlArr.push('</Part>');
        } else {
          return console.error("the part params is less than 3");
        }
      });
      xmlArr.push('</CompleteMultipartUpload>');
      return xmlArr.join('');
    };

    /**
     * [createDeleteObjectMsgXml description]
     * @param  {[type]}  objList =             []   [description]
     * @param  {Boolean} isQuiet =             true [description]
     * @return {[type]}          [description]
    */


    UTIL.prototype.createDeleteObjectMsgXml = function(objList, isQuiet) {
      var xmlArr,
        _this = this;
      if (objList == null) {
        objList = [];
      }
      if (isQuiet == null) {
        isQuiet = true;
      }
      xmlArr = ['<?xml version="1.0" encoding="UTF-8"?><Delete>'];
      if (isQuiet) {
        xmlArr.push('<Quiet>true</Quiet>');
      }
      _.each(objList, function(obj) {
        obj = _.escape(obj.trim());
        return xmlArr.push("<Object><Key>" + obj + "</Key></Object>");
      });
      xmlArr.push('</Delete>');
      return xmlArr.join('');
    };

    /**
     * [splitLargeFile description]
     * @param  {[type]} filePath     [description]
     * @param  {[type]} objectPrefix =             ''        [description]
     * @param  {[type]} maxPartNum   =             1000      [description]
     * @param  {[type]} partSize     =             PART_SIZE [description]
     * @param  {[type]} cbf          [description]
     * @return {[type]}              [description]
    */


    UTIL.prototype.splitLargeFile = function(filePath, objectPrefix, maxPartNum, partSize, cbf) {
      var getInfo, getPartMsg, getPartsList;
      if (objectPrefix == null) {
        objectPrefix = '';
      }
      if (maxPartNum == null) {
        maxPartNum = 1000;
      }
      if (partSize == null) {
        partSize = PART_SIZE;
      }
      if (_.isFunction(objectPrefix)) {
        cbf = objectPrefix;
        objectPrefix = '';
      } else if (_.isFunction(maxPartNum)) {
        cbf = maxPartNum;
        maxPartNum = 1000;
      } else if (_.isFunction(partSize)) {
        cbf = partSize;
        partSize = PART_SIZE;
      }
      getInfo = function(fd, offset, len, cbf) {
        var bufferSize, leftLen, md5, readIndex, realSize, throwErr;
        md5 = crypto.createHash('md5');
        bufferSize = MB_SIZE;
        leftLen = len;
        throwErr = null;
        realSize = 0;
        readIndex = 0;
        return async.whilst(function() {
          return leftLen > 0;
        }, function(cbf) {
          var buf, readSize;
          readSize = bufferSize;
          if (leftLen < bufferSize) {
            readSize = leftLen;
          }
          buf = new Buffer(readSize);
          return fs.read(fd, buf, 0, readSize, offset, function(err, bytesRead, buf) {
            if (err) {
              return cbf(err);
            } else {
              if (bytesRead) {
                realSize += bytesRead;
                offset += bytesRead;
                leftLen -= bytesRead;
                if (bytesRead !== buf.length) {
                  buf = buf.slice(0, bytesRead);
                }
                md5.update(buf);
              } else {
                leftLen = 0;
              }
              return cbf(null);
            }
          });
        }, function(err) {
          if (err) {
            return cbf(err);
          } else {
            return cbf(null, {
              md5Sum: md5.digest('hex'),
              realSize: realSize
            });
          }
        });
      };
      /**
       * [getPartMsg description]
       * @param  {[type]} objectPrefix [description]
       * @param  {[type]} filePath     [description]
       * @param  {[type]} fd           [description]
       * @param  {[type]} index        [description]
       * @param  {[type]} partSize     [description]
       * @param  {[type]} cbf          [description]
       * @return {[type]}              [description]
      */

      getPartMsg = function(objectPrefix, filePath, fd, index, partSize, cbf) {
        var md5, offset, partOrder;
        md5 = crypto.createHash('md5');
        partOrder = index + 1;
        offset = index * partSize;
        return async.waterfall([
          function(cbf) {
            return getInfo(fd, offset, partSize, cbf);
          }, function(info, cbf) {
            var fileName, tmpFileName;
            tmpFileName = path.basename(filePath) + '_' + partOrder;
            if (objectPrefix) {
              fileName = "" + objectPrefix + "/" + (md5.update(tmpFileName).digest('hex')) + "_" + tmpFileName;
            } else {
              fileName = "" + (md5.update(tmpFileName).digest('hex')) + "_" + tmpFileName;
            }
            return cbf(null, [partOrder, fileName, info.md5Sum.toUpperCase(), info.realSize, offset]);
          }
        ], cbf);
      };
      /**
       * [getPartsList description]
       * @param  {[type]} filePath [description]
       * @param  {[type]} partNum  [description]
       * @param  {[type]} cbf      [description]
       * @return {[type]}          [description]
      */

      getPartsList = function(filePath, partNum, cbf) {
        var partsList;
        partsList = [];
        return async.waterfall([
          function(cbf) {
            return fs.open(filePath, 'r', cbf);
          }, function(fd, cbf) {
            var arr;
            arr = _.range(0, partNum);
            return async.eachLimit(arr, 2, function(index, cbf) {
              return getPartMsg(objectPrefix, filePath, fd, index, partSize, function(err, partMsg) {
                if (partMsg) {
                  partsList.push(partMsg);
                }
                return cbf(err);
              });
            }, function(err) {
              return cbf(err, fd);
            });
          }, function(fd, cbf) {
            return fs.close(fd, cbf);
          }
        ], function(err) {
          partsList.sort(function(parts1, parts2) {
            return parts1[0] - parts2[0];
          });
          return cbf(err, partsList);
        });
      };
      return async.waterfall([
        function(cbf) {
          return fs.stat(filePath, cbf);
        }, function(stats, cbf) {
          if (!stats.isFile()) {
            return cbf(new Error("" + filePath + " is not a file"));
          } else {
            return cbf(null, stats.size);
          }
        }, function(fileSize, cbf) {
          var partNum;
          if (fileSize < partSize) {
            partSize = fileSize;
          } else if (fileSize > partSize * maxPartNum) {
            partSize = (fileSize + maxPartNum - fileSize % maxPartNum) / maxPartNum;
          }
          partNum = Math.ceil(fileSize / partSize);
          return getPartsList(filePath, partNum, cbf);
        }
      ], cbf);
    };

    UTIL.prototype.watch = function(targetPath, limit, cbf) {
      var changedList, createdList, removedList, watch;
      watch = require('watch');
      createdList = [];
      changedList = [];
      removedList = [];
      watch.createMonitor(targetPath, {
        ignoreDotFiles: true
      }, function(monitor) {
        monitor.on('created', function(f, stat) {
          return createdList.push(f);
        });
        monitor.on('changed', function(f, curr, prev) {
          return changedList.push(f);
        });
        return monitor.on('removed', function(f, stat) {
          return removedList.push(f);
        });
      });
      return GLOBAL.setInterval(function() {
        var result;
        if (createdList.length || changedList.length || removedList.length) {
          result = {
            created: _.uniq(createdList),
            changed: _.uniq(changedList),
            deleted: _.uniq(removedList)
          };
          createdList = [];
          changedList = [];
          removedList = [];
          return cbf(null, result);
        }
      }, 6 * 1000);
    };

    UTIL.prototype.classifyFiles = function(targetPath, limit, cbf) {
      var filterFiles;
      if (limit == null) {
        limit = PART_SIZE;
      }
      targetPath += '/**';
      filterFiles = function(files, limit, cbf) {
        var dirs, largeFiles, normalFiles;
        dirs = [];
        largeFiles = [];
        normalFiles = [];
        return async.eachLimit(files, 1, function(file, cbf) {
          if (file[0] === '.') {
            return GLOBAL.setImmediate(cbf);
          } else {
            return fs.stat(file, function(err, stats) {
              if (err) {
                return cbf(err);
              } else {
                if (stats.isFile()) {
                  if (stats.size > limit) {
                    largeFiles.push(file);
                  } else {
                    normalFiles.push(file);
                  }
                } else {
                  dirs.push(file);
                }
                return cbf(null);
              }
            });
          }
        }, function(err) {
          if (err) {
            return cbf(err);
          } else {
            return cbf(null, {
              files: normalFiles,
              dirs: dirs,
              largeFiles: largeFiles
            });
          }
        });
      };
      if (_.isFunction(limit)) {
        cbf = limit;
        limit = PART_SIZE;
      }
      return async.waterfall([
        function(cbf) {
          return glob(targetPath, cbf);
        }, function(files) {
          return filterFiles(files, limit, cbf);
        }
      ], cbf);
    };

    UTIL.prototype.toBinary = function(str) {
      if (!_.isString(str)) {
        return str;
      } else if (!str) {
        return '';
      } else {
        return new Buffer(str).toString('binary');
      }
    };

    UTIL.prototype._formatHeader = function(headers) {
      var tmpHeaders,
        _this = this;
      if (headers == null) {
        headers = {};
      }
      tmpHeaders = {};
      _.each(headers, function(value, key) {
        headers[key] = value;
        if (startsWith(key.toLowerCase(), SELF_DEFINE_HEADER_PREFIX)) {
          return tmpHeaders[key.toLowerCase()] = value;
        } else {
          return tmpHeaders[key] = value;
        }
      });
      return tmpHeaders;
    };

    return UTIL;

  })();

  module.exports = UTIL;

}).call(this);
