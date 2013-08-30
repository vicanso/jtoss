(function() {
  var Client, DEFAULT_ACL, DEFAULT_CONTENT_TYPE, GB_SIZE, KB_SIZE, LARGE_FILE_SIZE, MB_SIZE, OSS_MAX_RESULT_OBJECTS, PROVIDER, UTIL, async, crypto, debug, fs, jtfs, mime, noop, path, request, xml2js, xmlParser, zlib, _,
    __slice = [].slice;

  UTIL = require('./util');

  fs = require('fs');

  _ = require('underscore');

  crypto = require('crypto');

  path = require('path');

  async = require('async');

  jtfs = require('jtfs');

  zlib = require('zlib');

  xml2js = require('xml2js');

  request = require('request');

  mime = require('mime');

  debug = require('debug')('oss');

  OSS_MAX_RESULT_OBJECTS = 1000;

  DEFAULT_CONTENT_TYPE = 'application/octet-stream';

  KB_SIZE = 1024;

  MB_SIZE = 1024 * 1024;

  LARGE_FILE_SIZE = 1 * MB_SIZE;

  GB_SIZE = 1024 * 1024;

  PROVIDER = "OSS";

  DEFAULT_ACL = 'private';

  xmlParser = function(xml, cbf) {
    var parser;
    parser = new xml2js.Parser();
    return parser.parseString(xml, cbf);
  };

  noop = function() {};

  Client = (function() {
    function Client(accessId, accessKey, host, port, timeout, retryTimes) {
      this.accessId = accessId;
      this.accessKey = accessKey;
      this.host = host != null ? host : 'oss.aliyuncs.com';
      this.port = port != null ? port : 80;
      this.timeout = timeout != null ? timeout : 60;
      this.retryTimes = retryTimes != null ? retryTimes : 2;
      this.util = new UTIL;
      this.provider = PROVIDER;
      this.defaultHeadersList = {};
    }

    Client.prototype.userMetas = function(value) {
      if (value) {
        return this.defaultHeadersList = value;
      } else {
        return this.defaultHeadersList;
      }
    };

    /**
     * [signUrlAuthWithExpireTime description]
     * @param  {String} method   可选值有：PUT, GET, DELETE, HEAD
     * @param  {String} url      bucket或者object的URL，如：http://HOST/bucket/object
     * @param  {Object} headers HTTP的header
     * @param  {String} resource bucket或者object的路径，如：/bucket/, /bucket/object
     * @param  {Integer} timeout 超时时间
     * @param  {[type]} params   =             {} [description]
     * @return {[type]}          [description]
    */


    Client.prototype.signUrlAuthWithExpireTime = function(method, url, headers, resource, timeout, params) {
      var auth;
      if (headers == null) {
        headers = {};
      }
      if (resource == null) {
        resource = '/';
      }
      if (timeout == null) {
        timeout = 60;
      }
      if (params == null) {
        params = {};
      }
      auth = this.util.getAssign(this.accessKey, method, headers, resource);
      params['OSSAccessKeyId'] = this.accessId;
      params['Expires'] = new Date(Date.now() + timeout * 1000).toUTCString();
      params['Signature'] = auth;
      return this.util.appendParam(url, params);
    };

    /**
     * [signUrl description]
     * @param  {[type]} method  [description]
     * @param  {[type]} bucket  [description]
     * @param  {[type]} object  [description]
     * @param  {[type]} timeout =             60   [description]
     * @param  {[type]} headers =             {} [description]
     * @param  {[type]} params  =             {} [description]
     * @return {[type]}         [description]
    */


    Client.prototype.signUrl = function(method, bucket, object, timeout, headers, params) {
      var auth, date, resource, url;
      if (timeout == null) {
        timeout = 60;
      }
      if (headers == null) {
        headers = {};
      }
      if (params == null) {
        params = {};
      }
      date = new Date(Date.now() + timeout * 1000).toUTCString();
      headers['Date'] = date;
      resource = "/" + bucket + "/" + object + (this.util.getResource(params));
      auth = this.util.getAssign(this.accessKey, method, headers, resource);
      params['OSSAccessKeyId'] = this.accessId;
      params['Expires'] = date;
      params['Signature'] = auth;
      url = "http://" + bucket + "." + host + "/" + object;
      return this.util.appendParam(url, params);
    };

    /**
     * listAllMyBuckets 列出所有的bucket
     * @param  {Function} cbf (err, [{name : 'xxx', createdAt : 'xxx'}])
     * @return {[type]}         [description]
    */


    Client.prototype.listAllMyBuckets = function(cbf) {
      var body, bucket, headers, method, object, params,
        _this = this;
      headers = null;
      method = 'GET';
      bucket = '';
      object = '';
      body = '';
      params = {};
      return async.waterfall([
        function(cbf) {
          return _this.exec(method, bucket, object, headers, body, params, cbf);
        }, xmlParser
      ], function(err, result) {
        if (err) {
          return cbf(err);
        } else {
          result = _.map(result.ListAllMyBucketsResult.Buckets[0].Bucket, function(item) {
            return {
              name: item.Name[0],
              createdAt: item.CreationDate[0]
            };
          });
          return cbf(null, result);
        }
      });
    };

    /**
     * getBucketAcl 获取bucket的访问控制权限
     * @param  {String} bucket bucket的名称
     * @param  {Function} cbf  (err, 'private'|'public-read'|'publick-read-write')
     * @return {[type]}        [description]
    */


    Client.prototype.getBucketAcl = function(bucket, cbf) {
      var body, headers, method, object, params,
        _this = this;
      method = 'GET';
      object = '';
      headers = {};
      body = '';
      params = {
        acl: ''
      };
      return async.waterfall([
        function(cbf) {
          return _this.exec(method, bucket, object, headers, body, params, cbf);
        }, xmlParser
      ], function(err, result) {
        if (err) {
          return cbf(err);
        } else {
          return cbf(null, result.AccessControlPolicy.AccessControlList[0].Grant[0]);
        }
      });
    };

    /**
     * setBucketAcl 修改bucket的访问控制权限
     * @param {[type]} bucket [description]
     * @param {[type]} acl    [description]
     * @param {[type]} cbf    [description]
    */


    Client.prototype.setBucketAcl = function(bucket, acl, cbf) {
      var body, headers, method, object, params,
        _this = this;
      method = 'PUT';
      object = '';
      headers = {
        'x-oss-acl': acl
      };
      params = {};
      body = '';
      return async.waterfall([
        function(cbf) {
          return _this.exec(method, bucket, object, headers, body, params, cbf);
        }
      ], cbf);
    };

    /**
     * listBucket 列出bucket的内容（默认最大只显示1000个object）
     * @param  {String} bucket  [description]
     * @param  {[type]} params 列出object列表的一些参数配置{delimiter : String, marker : String, max-keys : Integer, prefix : String}
     * @param  {[type]} cbf   (err, {marker : String, items : Array})
     * @return {[type]}         [description]
    */


    Client.prototype.listBucket = function(bucket, params, cbf) {
      var body, headers, method, object,
        _this = this;
      if (params == null) {
        params = {};
      }
      if (_.isFunction(params)) {
        cbf = params;
        params = {};
      }
      headers = null;
      method = 'GET';
      object = '';
      body = '';
      return async.waterfall([
        function(cbf) {
          return _this.exec(method, bucket, object, headers, body, params, cbf);
        }, xmlParser
      ], function(err, result) {
        var ListBucketResult, marker, _ref;
        if (err) {
          return cbf(err);
        } else {
          ListBucketResult = result.ListBucketResult;
          result = [];
          _.each(ListBucketResult != null ? ListBucketResult.CommonPrefixes : void 0, function(item) {
            return result.push({
              _type: 'folder',
              name: item.Prefix[0]
            });
          });
          _.each(ListBucketResult != null ? ListBucketResult.Contents : void 0, function(item) {
            var newItem;
            newItem = {};
            _.each(item, function(value, key) {
              if (key === 'Key') {
                key = 'name';
              } else {
                key = key.charAt(0).toLowerCase() + key.substring(1);
              }
              return newItem[key] = value[0];
            });
            return result.push(newItem);
          });
          marker = (_ref = ListBucketResult.NextMarker) != null ? _ref[0] : void 0;
          return cbf(null, {
            marker: marker,
            items: result
          });
        }
      });
    };

    /**
     * isModified 判断object和对应的本地file是否有修改（通过比较它们的ETag是否一样）
     * @param  {String}  bucket   [description]
     * @param  {String}  object   [description]
     * @param  {String}  fileName [description]
     * @param  {[type]}  cbf      [description]
     * @return {Boolean}          [description]
    */


    Client.prototype.isModified = function(bucket, object, fileName, cbf) {
      var _this = this;
      return async.waterfall([
        function(cbf) {
          return _this._md5(fileName, function(err, md5) {
            if (err) {
              return cbf(err);
            } else {
              return cbf(null, '"' + md5 + '"');
            }
          });
        }, function(eTag, cbf) {
          return _this.headObject(bucket, object, function(err, ossHeaders) {
            var index, ossETag;
            ossETag = ossHeaders != null ? ossHeaders['ETag'] : void 0;
            if (ossETag) {
              index = ossETag.indexOf('-');
              if (~index) {
                ossETag = ossETag.substring(0, index);
              }
            }
            if (err) {
              return cbf(null, true);
            } else if (ossETag === eTag) {
              return cbf(null, false);
            } else {
              return cbf(null, true);
            }
          });
        }
      ], cbf);
    };

    /**
     * putBucket 创建bucket
     * @param  {String} bucket  [description]
     * @param  {String} {optional} acl     [description]
     * @param  {Function} cbf     [description]
     * @return {[type]}         [description]
    */


    Client.prototype.putBucket = function(bucket, acl, cbf) {
      var body, headers, method, object, params;
      if (_.isFunction(acl)) {
        cbf = acl;
        acl = null;
      }
      headers = {};
      if (acl == null) {
        acl = DEFAULT_ACL;
      }
      if (this.provider === 'AWS') {
        headers['x-amz-acl'] = acl;
      } else {
        headers['x-oss-acl'] = acl;
      }
      method = 'PUT';
      object = '';
      body = '';
      params = {};
      return this.exec(method, bucket, object, headers, body, params, cbf);
    };

    /**
     * [putBucketWithLocation description]
     * @param  {[type]} bucket   [description]
     * @param  {[type]} acl      [description]
     * @param  {[type]} location [description]
     * @param  {[type]} headers  =             {} [description]
     * @param  {[type]} cbf      [description]
     * @return {[type]}          [description]
    */


    Client.prototype.putBucketWithLocation = function(bucket, acl, location, headers, cbf) {
      var body, method, object, params;
      if (headers == null) {
        headers = {};
      }
      if (_.isFunction(acl)) {
        cbf = acl;
        acl = null;
      } else if (_.isFunction(location)) {
        cbf = location;
        location = acl;
        acl = null;
      } else if (_.isFunction(headers)) {
        cbf = headers;
        headers = {};
      }
      if (acl == null) {
        acl = DEFAULT_ACL;
      }
      if (acl) {
        if (this.provider === 'AWS') {
          headers['x-amz-acl'] = acl;
        } else {
          headers['x-oss-acl'] = acl;
        }
      }
      params = {};
      body = '';
      if (location) {
        body += "<CreateBucketConfiguration><LocationConstraint>" + location + "</LocationConstraint></CreateBucketConfiguration>";
      }
      method = 'PUT';
      object = '';
      return this.exec(method, bucket, object, headers, body, params, cbf);
    };

    /**
     * deleteBucket 删除bucket
     * @param  {String} bucket  [description]
     * @param  {Function} cbf     [description]
     * @return {[type]}         [description]
    */


    Client.prototype.deleteBucket = function(bucket, cbf) {
      var body, headers, method, object, params;
      headers = null;
      method = 'DELETE';
      object = '';
      body = '';
      params = {};
      return this.exec(method, bucket, object, headers, body, params, cbf);
    };

    /**
     * putObjectWithData 上传Object
     * @param  {String} bucket  [description]
     * @param  {String} object  [description]
     * @param  {String|Buffer} content [description]
     * @param  {Object} {optional} headers [description]
     * @param  {Object} {optional} params  [description]
     * @param  {[type]} cbf     [description]
     * @return {[type]}         [description]
    */


    Client.prototype.putObjectWithData = function(bucket, object, content, headers, params, cbf) {
      var defaultHeaders, method,
        _this = this;
      if (content == null) {
        content = '';
      }
      if (_.isFunction(headers)) {
        cbf = headers;
        headers = null;
      } else if (_.isFunction(params)) {
        cbf = params;
        params = null;
      }
      if (headers == null) {
        headers = {};
      }
      method = 'PUT';
      defaultHeaders = this.defaultHeadersList[path.extname(object)];
      if (defaultHeaders) {
        _.extend(headers, defaultHeaders);
      }
      if (!headers['Content-Type']) {
        headers['Content-Type'] = mime.lookup(object) || DEFAULT_CONTENT_TYPE;
      }
      if (content && !Buffer.isBuffer(content)) {
        content = new Buffer(content);
      }
      headers["Expect"] = "100-Continue";
      return async.waterfall([
        function(cbf) {
          if (headers['Content-Encoding'] === 'gzip') {
            return zlib.gzip(content, cbf);
          } else {
            return cbf(null, content);
          }
        }, function(body, cbf) {
          return _this.exec(method, bucket, object, headers, body, params, cbf);
        }
      ], cbf);
    };

    /**
     * putObjectFromFile 从文件中上传object
     * @param  {String} bucket   [description]
     * @param  {String} object   [description]
     * @param  {String} fileName [description]
     * @param  {Object} {optional} headers [description]
     * @param  {Object} {optional} params   [description]
     * @param  {[type]} cbf      [description]
     * @return {[type]}          [description]
    */


    Client.prototype.putObjectFromFile = function(bucket, object, fileName, headers, params, cbf) {
      if (headers == null) {
        headers = {};
      }
      if (_.isFunction(headers)) {
        cbf = headers;
        headers = null;
      } else if (_.isFunction(params)) {
        cbf = params;
        params = null;
      }
      if (headers == null) {
        headers = {};
      }
      return this.putObjectFromFd(bucket, object, fileName, headers, params, cbf);
    };

    /**
     * putObjectFromFileList 从文件列表中上传object
     * @param  {String} bucket  [description]
     * @param  {Array} files   [description]
     * @param  {Object} {optional} headers [description]
     * @param  {Object} {optional}  [description]
     * @param  {Function} cbf     [description]
     * @return {[type]}         [description]
    */


    Client.prototype.putObjectFromFileList = function(bucket, files, headers, params, cbf) {
      var progress,
        _this = this;
      if (_.isFunction(headers)) {
        cbf = headers;
        headers = null;
      } else if (_.isFunction(params)) {
        cbf = params;
        params = headers;
        headers = null;
      }
      if (headers == null) {
        headers = {};
      }
      if (params == null) {
        params = {};
      }
      progress = params.progress || function() {};
      return async.eachLimit(files, 5, function(file, cbf) {
        var object, tmpHeaders, tmpParams;
        object = path.basename(file);
        progress('putObjectFromFileList', {
          file: file,
          status: 'doing'
        });
        tmpParams = _.clone(params);
        tmpHeaders = _.clone(headers);
        return _this.putObjectFromFile(bucket, object, file, tmpHeaders, tmpParams, function(err) {
          if (err) {
            progress('putObjectFromFileList', {
              file: file,
              status: 'fail'
            });
          } else {
            progress('putObjectFromFileList', {
              file: file,
              status: 'complete'
            });
          }
          return cbf(null);
        });
      }, cbf);
    };

    /**
     * putObjectFromFd 根据文件fd上传object
     * @param  {String} bucket  [description]
     * @param  {String} object  [description]
     * @param  {fd} fd      [description]
     * @param  {Object} {optional} headers [description]
     * @param  {Object} {optional} params  [description]
     * @param  {[type]} cbf     [description]
     * @return {[type]}         [description]
    */


    Client.prototype.putObjectFromFd = function(bucket, object, fd, headers, params, cbf) {
      if (headers == null) {
        headers = {};
      }
      if (_.isFunction(headers)) {
        cbf = headers;
        headers = null;
      } else if (_.isFunction(params)) {
        cbf = params;
        params = null;
      }
      if (headers == null) {
        headers = {};
      }
      return this.putObjectFromFileGivenPos(bucket, object, fd, 0, -1, headers, params, cbf);
    };

    /**
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
    */


    Client.prototype.putObjectFromFileGivenPos = function(bucket, object, fileName, offset, partSize, headers, params, cbf) {
      var fd, uploadTooLargeErr,
        _this = this;
      if (_.isFunction(headers)) {
        cbf = headers;
        headers = null;
      } else if (_.isFunction(params)) {
        cbf = params;
        params = null;
      }
      uploadTooLargeErr = new Error('upload data is to large');
      if (headers == null) {
        headers = {};
      }
      fd = null;
      return async.waterfall([
        function(cbf) {
          if (_.isString(fileName)) {
            return fs.open(fileName, 'r', cbf);
          } else {
            return cbf(null, fileName);
          }
        }, function(tmpFd, cbf) {
          fd = tmpFd;
          return fs.fstat(fd, cbf);
        }, function(stats, cbf) {
          var buf, size;
          size = stats.size;
          if (offset > size) {
            if (_.isString(fileName)) {
              fs.closeSync(fd);
            }
            cbf(new Error('the offset is bigger than file size'));
            return;
          }
          if (partSize === -1 && size > LARGE_FILE_SIZE) {
            if (!_.isString(fileName)) {
              fs.closeSync(fd);
            }
            return cbf(uploadTooLargeErr);
          } else {
            if (partSize === -1 || offset + partSize > size) {
              partSize = size - offset;
            }
            buf = new Buffer(partSize);
            return fs.read(fd, buf, 0, partSize, offset, cbf, cbf);
          }
        }, function(bytesRead, buffer, cbf) {
          return _this.putObjectFromString(bucket, object, buffer, headers, params, cbf);
        }, function(result, cbf) {
          if (_.isString(fileName)) {
            return fs.close(fd, function(err) {
              return cbf(err, result);
            });
          } else {
            return cbf(null, result);
          }
        }
      ], function(err, result) {
        if (err === uploadTooLargeErr) {
          return _this.uploadLargeFile(bucket, object, fileName, headers, params, cbf);
        } else {
          return cbf(err, result);
        }
      });
    };

    /**
     * updateObjectFromFile 根据指定的文件更新object
     * @param  {String} bucket   [description]
     * @param  {String} object   [description]
     * @param  {String} fileName [description]
     * @param  {[type]} cbf      [description]
     * @return {[type]}          [description]
    */


    Client.prototype.updateObjectFromFile = function(bucket, object, fileName, headers, params, cbf) {
      var _this = this;
      if (params == null) {
        params = {};
      }
      if (_.isFunction(headers)) {
        cbf = headers;
        headers = null;
      } else if (_.isFunction(params)) {
        cbf = params;
        params = headers;
        headers = null;
      }
      return async.waterfall([
        function(cbf) {
          return _this.isModified(bucket, object, fileName, cbf);
        }, function(modified, cbf) {
          if (modified) {
            return _this.putObjectFromFile(bucket, object, fileName, headers, params, cbf);
          } else {
            return cbf(null);
          }
        }
      ], cbf);
    };

    /**
     * getObject 获取object
     * @param  {String} bucket  [description]
     * @param  {String} object  [description]
     * @param  {Object} {optional} headers [description]
     * @param  {Object} {optional} params  [description]
     * @param  {[type]} cbf     [description]
     * @return {[type]}         [description]
    */


    Client.prototype.getObject = function(bucket, object, headers, params, cbf) {
      var body, method;
      if (_.isFunction(headers)) {
        cbf = headers;
        headers = null;
      } else if (_.isFunction(params)) {
        cbf = params;
        params = null;
      }
      method = 'GET';
      body = '';
      return this.exec(method, bucket, object, headers, body, params, cbf);
    };

    /**
     * getObjectToFile 获取object并保存到文件中
     * @param  {String} bucket   [description]
     * @param  {String} object   [description]
     * @param  {String} fileName [description]
     * @param  {[type]} args...  其它参数和getObject函数一样
     * @return {[type]}          [description]
    */


    Client.prototype.getObjectToFile = function() {
      var args, bucket, cbf, fileName, object,
        _this = this;
      bucket = arguments[0], object = arguments[1], fileName = arguments[2], args = 4 <= arguments.length ? __slice.call(arguments, 3) : [];
      cbf = args.pop();
      return async.waterfall([
        function(cbf) {
          args.unshift(bucket, object);
          args.push(cbf);
          return _this.getObject.apply(_this, args);
        }, function(data, cbf) {
          return fs.writeFile(fileName, data, cbf);
        }
      ], cbf);
    };

    /**
     * deleteObject 删除object
     * @param  {String} bucket  [description]
     * @param  {String} object  [description]
     * @param  {[type]} cbf     [description]
     * @return {[type]}         [description]
    */


    Client.prototype.deleteObject = function(bucket, object, cbf) {
      var body, headers, method, params,
        _this = this;
      headers = null;
      method = 'DELETE';
      body = '';
      params = {};
      if (object[object.length - 1] === '/') {
        return async.waterfall([
          function(cbf) {
            return _this.listObjects(bucket, {
              prefix: object
            }, cbf);
          }, function(items, cbf) {
            return _this.deleteObjects(bucket, _.pluck(items, 'name'), cbf);
          }
        ], cbf);
      } else {
        return this.exec(method, bucket, object, headers, body, params, cbf);
      }
    };

    /**
     * headObject 获取或修改object的headers
     * @param  {String} bucket  [description]
     * @param  {String} object  [description]
     * @param  {Object} {optional} headers 有该参数表示修改，无该参数表示获取
     * @param  {[type]} cbf     [description]
     * @return {[type]}         [description]
    */


    Client.prototype.headObject = function(bucket, object, headers, cbf) {
      var body, method, params,
        _this = this;
      if (_.isFunction(headers)) {
        cbf = headers;
        headers = null;
      }
      if (headers) {
        if (object[object.length - 1] === '/') {
          return async.waterfall([
            function(cbf) {
              return _this.listObjects(bucket, {
                prefix: object
              }, cbf);
            }, function(items, cbf) {
              return cbf(null, _.pluck(items, 'name'));
            }, function(objs, cbf) {
              return async.eachLimit(objs, 5, function(obj, cbf) {
                return _this.copyObject(bucket, obj, bucket, obj, headers, cbf);
              }, cbf);
            }
          ], cbf);
        } else {
          return this.copyObject(bucket, object, bucket, object, headers, cbf);
        }
      } else {
        method = 'HEAD';
        body = '';
        params = {};
        return this.exec(method, bucket, object, headers, body, params, cbf);
      }
    };

    Client.prototype.postObjectGroup = function(bucket, object, objectGroupMsgXml, headers, params, cbf) {
      var method;
      if (headers == null) {
        headers = {};
      }
      if (params == null) {
        params = {};
      }
      if (_.isFunction(headers)) {
        cbf = headers;
        headers = {};
      } else if (_.isFunction(params)) {
        cbf = params;
        params = {};
      }
      if (!headers['Content-Type']) {
        headers['Content-Type'] = mime.lookup(object);
      }
      method = 'POST';
      params['group'] = '';
      headers['Content-Length'] = objectGroupMsgXml.length;
      return this.exec(method, bucket, object, headers, objectGroupMsgXml, params, cbf);
    };

    Client.prototype.getObjectGroupIndex = function(bucket, object, headers, cbf) {
      var body, method, params;
      if (headers == null) {
        headers = {};
      }
      if (_.isFunction(headers)) {
        cbf = headers;
        headers = {};
      }
      headers['x-oss-file-group'] = '';
      method = 'GET';
      body = '';
      params = {};
      return this.exec(method, bucket, object, headers, body, params, cbf);
    };

    /**
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
    */


    Client.prototype.uploadPartFromFileGivenPos = function(bucket, object, fileName, offset, partSize, uploadId, partNumber, headers, params, cbf) {
      if (params == null) {
        params = {};
      }
      if (_.isFunction(headers)) {
        cbf = headers;
        headers = null;
      } else if (_.isFunction(params)) {
        cbf = params;
        params = {};
      }
      params['partNumber'] = partNumber;
      params['uploadId'] = uploadId;
      return this.putObjectFromFileGivenPos(bucket, object, fileName, offset, partSize, headers, params, cbf);
    };

    /**
     * uploadLargeFile 上传大文件
     * @param  {String} bucket   [description]
     * @param  {String} object   [description]
     * @param  {String} fileName [description]
     * @param  {Object} {optional} headers  [description]
     * @param  {Object} {optioanl} params   可以往params添加 {progress : fuction}回调上传进度
     * @param  {[type]} cbf      [description]
     * @return {[type]}          [description]
    */


    Client.prototype.uploadLargeFile = function(bucket, object, fileName, headers, params, cbf) {
      var partMsgList, progress, uploadId, uploadInfos, _filetrPartMsgList, _uploadPart,
        _this = this;
      if (params == null) {
        params = {};
      }
      _filetrPartMsgList = function(partMsgList, resultParts) {
        return _.filter(partMsgList, function(partMsg) {
          var eTag, id, info;
          id = partMsg[0];
          eTag = '"' + partMsg[2] + '"';
          info = _.find(resultParts, function(resultPart) {
            return resultPart.partNumber === id && resultPart.eTag === eTag;
          });
          return !info;
        });
      };
      _uploadPart = function(uploadId, partMsg, retry, cbf) {
        var cloneParams, eTag, offset, partNumber, partSize;
        if (retry == null) {
          retry = true;
        }
        if (_.isFunction(retry)) {
          cbf = retry;
          retry = true;
        }
        offset = partMsg[4];
        partSize = partMsg[3];
        eTag = '"' + partMsg[2] + '"';
        partNumber = partMsg[0];
        cloneParams = _.clone(params);
        delete cloneParams.progress;
        return _this.uploadPartFromFileGivenPos(bucket, object, fileName, offset, partSize, uploadId, partNumber, headers, cloneParams, function(err, headers) {
          if (err) {
            if (retry) {
              return _uploadPart(uploadId, partMsg, false, cbf);
            } else {
              return cbf(err);
            }
          } else if (headers.ETag === eTag) {
            return cbf(null);
          } else if (retry) {
            return _uploadPart(uploadId, partMsg, false, cbf);
          } else {
            return cbf(new Error('upload part fail!!'));
          }
        });
      };
      partMsgList = null;
      uploadId = null;
      uploadInfos = null;
      if (_.isFunction(headers)) {
        headers = null;
        cbf = headers;
      } else if (_.isFunction(params)) {
        cbf = params;
        params = headers;
        headers = null;
      }
      if (params) {
        progress = params.progress;
      }
      if (progress == null) {
        progress = function() {};
      }
      return async.waterfall([
        function(cbf) {
          return _this.util.splitLargeFile(fileName, object, cbf);
        }, function(msgList, cbf) {
          partMsgList = msgList;
          return _this.getUploadId(bucket, object, cbf);
        }, function(id, cbf) {
          uploadId = id;
          return _this.listParts(bucket, object, {
            uploadId: id
          }, cbf);
        }, function(partInfos, cbf) {
          var complete, total,
            _this = this;
          uploadInfos = partMsgList;
          partMsgList = _filetrPartMsgList(partMsgList, partInfos.parts);
          total = partMsgList.length;
          complete = 0;
          return async.eachLimit(partMsgList, 1, function(partMsg, cbf) {
            return _uploadPart(uploadId, partMsg, function(err) {
              if (!err) {
                complete++;
                debug("" + fileName + " " + complete + " " + total);
                progress('uploadLargeFile', {
                  file: fileName,
                  eTag: partMsg[2],
                  complete: complete,
                  total: total
                });
              } else {
                debug(err);
              }
              return cbf(null);
            });
          }, cbf);
        }, function(cbf) {
          return _this.listParts(bucket, object, {
            uploadId: uploadId
          }, cbf);
        }, function(partInfos, cbf) {
          var xml;
          xml = _this.util.createPartXml(uploadInfos);
          progress('putObjectFromFileList', {
            file: fileName,
            status: 'complete'
          });
          return _this.completeUpload(bucket, object, xml, {
            uploadId: uploadId
          }, cbf);
        }
      ], cbf);
    };

    /**
     * listParts 列出已上传的part
     * @param  {String} bucket [description]
     * @param  {String} object [description]
     * @param  {Object} params {uploadId : String}必须有该字段标记是哪一个upload
     * @param  {[type]} cbf    [description]
     * @return {[type]}        [description]
    */


    Client.prototype.listParts = function(bucket, object, params, cbf) {
      var body, getPartInfos, headers, method,
        _this = this;
      method = 'GET';
      body = '';
      params['uploads'] = '';
      headers = null;
      getPartInfos = function(data) {
        var result;
        result = _.map(data, function(info) {
          return {
            partNumber: GLOBAL.parseInt(info.PartNumber[0]),
            lastModified: info.LastModified[0],
            eTag: info.ETag[0],
            size: GLOBAL.parseInt(info.Size[0])
          };
        });
        result.sort(function(info1, info2) {
          return info1.partNumber - info2.partNumber;
        });
        return result;
      };
      return async.waterfall([
        function(cbf) {
          return _this.exec(method, bucket, object, headers, body, params, cbf);
        }, xmlParser, function(result, cbf) {
          var info;
          result = result.ListPartsResult;
          info = {
            isTruncated: result.IsTruncated[0] === 'true',
            partNumberMarker: GLOBAL.parseInt(result.PartNumberMarker[0]),
            nextPartNumberMarker: GLOBAL.parseInt(result.NextPartNumberMarker[0]),
            parts: getPartInfos(result.Part)
          };
          return cbf(null, info);
        }
      ], cbf);
    };

    Client.prototype.updateObjectHeaders = function(bucket, object, headers, cbf) {
      return this.copyObject(bucket, object, bucket, object, headers, cbf);
    };

    /**
     * copyObject 复制object
     * @param  {String} sourceBucket [description]
     * @param  {String} sourceObject [description]
     * @param  {String} targetBucket [description]
     * @param  {String} targetObject [description]
     * @param  {Object} {optional} headers 新的headers
     * @param  {[type]} cbf          [description]
     * @return {[type]}              [description]
    */


    Client.prototype.copyObject = function(sourceBucket, sourceObject, targetBucket, targetObject, headers, cbf) {
      var body, method, params;
      if (headers == null) {
        headers = {};
      }
      if (_.isFunction(headers)) {
        cbf = headers;
        headers = {};
      }
      headers['x-oss-copy-source'] = GLOBAL.encodeURI("/" + sourceBucket + "/" + sourceObject);
      method = 'PUT';
      body = '';
      params = {};
      return this.exec(method, targetBucket, targetObject, headers, body, params, cbf);
    };

    /**
     * initMultiUpload 初始化分块上传
     * @param  {String} bucket  [description]
     * @param  {String} object  [description]
     * @param  {Object} params  [description]
     * @param  {[type]} cbf     [description]
     * @return {[type]}         [description]
    */


    Client.prototype.initMultiUpload = function(bucket, object, params, cbf) {
      var body, headers, method,
        _this = this;
      if (params == null) {
        params = {};
      }
      if (_.isFunction(params)) {
        cbf = params;
        params = {};
      }
      headers = null;
      if (params == null) {
        params = {};
      }
      method = 'POST';
      body = '';
      params['uploads'] = '';
      return async.waterfall([
        function(cbf) {
          return _this.exec(method, bucket, object, headers, body, params, cbf);
        }, xmlParser, function(data, cbf) {
          return cbf(null, data.InitiateMultipartUploadResult.UploadId[0]);
        }
      ], cbf);
    };

    /**
     * getUploadId 获取uploadId（如果当前object有多个upload id，返回第一个，如果没有，初始化一个）
     * @param  {String} bucket [description]
     * @param  {String} object [description]
     * @param  {[type]} cbf    [description]
     * @return {[type]}        [description]
    */


    Client.prototype.getUploadId = function(bucket, object, cbf) {
      var _this = this;
      return async.waterfall([
        function(cbf) {
          return _this.getAllMultipartUploads(bucket, cbf);
        }, function(info, cbf) {
          var uploadInfo, _ref;
          if (info != null ? (_ref = info.ListMultipartUploadsResult) != null ? _ref.Upload : void 0 : void 0) {
            uploadInfo = _.find(info.ListMultipartUploadsResult.Upload, function(info) {
              return info.Key[0] === object;
            });
            if (uploadInfo) {
              return cbf(null, uploadInfo.UploadId[0]);
            } else {
              return _this.initMultiUpload(bucket, object, cbf);
            }
          } else {
            return _this.initMultiUpload(bucket, object, cbf);
          }
        }
      ], cbf);
    };

    /**
     * getAllMultipartUploads 获取该bucket下的所有分块上传信息
     * @param  {String} bucket  [description]
     * @param  {Object} {optional} params  [description]
     * @param  {[type]} cbf     [description]
     * @return {[type]}         [description]
    */


    Client.prototype.getAllMultipartUploads = function(bucket, params, cbf) {
      var body, headers, method, object,
        _this = this;
      if (params == null) {
        params = {};
      }
      if (_.isFunction(params)) {
        cbf = params;
        params = {};
      }
      headers = null;
      method = 'GET';
      object = '';
      body = '';
      if (params == null) {
        params = {};
      }
      params['uploads'] = '';
      return async.waterfall([
        function(cbf) {
          return _this.exec(method, bucket, object, headers, body, params, cbf);
        }, xmlParser
      ], cbf);
    };

    /**
     * completeUpload 完成上传
     * @param  {String} bucket     [description]
     * @param  {String} object     [description]
     * @param  {String} partMsgXml [description]
     * @param  {Object} headers    [description]
     * @param  {Object} params     [description]
     * @param  {[type]} cbf        [description]
     * @return {[type]}            [description]
    */


    Client.prototype.completeUpload = function(bucket, object, partMsgXml, headers, params, cbf) {
      var body, method,
        _this = this;
      if (headers == null) {
        headers = {};
      }
      if (params == null) {
        params = {};
      }
      if (_.isFunction(headers)) {
        cbf = headers;
        headers = {};
      } else if (_.isFunction(params)) {
        cbf = params;
        params = headers;
        headers = null;
      }
      method = 'POST';
      if (headers == null) {
        headers = {};
      }
      body = partMsgXml;
      headers['Content-Length'] = body.length;
      if (!headers['Content-Type']) {
        headers['Content-Type'] = mime.lookup(object);
      }
      return async.waterfall([
        function(cbf) {
          return _this.exec(method, bucket, object, headers, body, params, cbf);
        }, xmlParser
      ], cbf);
    };

    /**
     * cancelUpload 取消上传
     * @param  {String} bucket  [description]
     * @param  {String} object  [description]
     * @param  {Object} {optional} params  [description]
     * @param  {[type]} cbf     [description]
     * @return {[type]}         [description]
    */


    Client.prototype.cancelUpload = function(bucket, object, params, cbf) {
      var body, headers, method,
        _this = this;
      body = '';
      headers = null;
      method = 'DELETE';
      if (_.isFunction(params)) {
        cbf = params;
        params = null;
      }
      if (params == null) {
        params = {};
      }
      return async.waterfall([
        function(cbf) {
          if (params.uploadId) {
            return cbf(null, uploadId);
          } else {
            return _this.getUploadId(bucket, object, cbf);
          }
        }, function(uploadId, cbf) {
          params.uploadId = uploadId;
          return _this.exec(method, bucket, object, headers, body, params, cbf);
        }, xmlParser
      ], cbf);
    };

    /**
     * deleteObjects 删除objects
     * @param  {String} bucket  [description]
     * @param  {Array} objList  [description]
     * @param  {[type]} args... [description]
     * @return {[type]}         [description]
    */


    Client.prototype.deleteObjects = function() {
      var args, bucket, cbf, folders, objList, result, _deleteObjs, _getAllFiles,
        _this = this;
      bucket = arguments[0], objList = arguments[1], args = 3 <= arguments.length ? __slice.call(arguments, 2) : [];
      if (objList == null) {
        objList = [];
      }
      result = [];
      folders = [];
      cbf = args.pop();
      _getAllFiles = function(bucket, folders, cbf) {
        var files;
        files = [];
        return async.eachLimit(folders, 1, function(folder, cbf) {
          return _this.listObjects(bucket, {
            prefix: folder
          }, function(err, items) {
            files = files.concat(_.pluck(items, 'name'));
            return cbf(err);
          });
        }, function(err) {
          if (err) {
            return cbf(err);
          } else {
            return cbf(null, files);
          }
        });
      };
      _deleteObjs = function(objs, cbf) {
        var index, max;
        index = 0;
        max = objs.length;
        return async.doWhilst(function(cbf) {
          var tmpArgs, tmpObjs, xml;
          tmpObjs = objs.slice(index, index + OSS_MAX_RESULT_OBJECTS);
          xml = _this.util.createDeleteObjectMsgXml(tmpObjs);
          index += OSS_MAX_RESULT_OBJECTS;
          tmpArgs = _.clone(args);
          tmpArgs.unshift(bucket, xml);
          tmpArgs.push(cbf);
          return _this._batchDeleteObject.apply(_this, tmpArgs);
        }, function() {
          return index < max;
        }, cbf);
      };
      if (!objList.length) {
        cbf(null);
        return;
      }
      _.each(objList, function(obj) {
        if (obj[obj.length - 1] === '/') {
          return folders.push(obj);
        } else {
          return result.push(obj);
        }
      });
      return async.waterfall([
        function(cbf) {
          if (folders.length) {
            return _getAllFiles(bucket, folders, function(err, items) {
              if (err) {
                return cbf(err);
              } else {
                result = result.concat(items);
                return cbf(null, result);
              }
            });
          } else {
            return cbf(null, result);
          }
        }, function(objs, cbf) {
          return _deleteObjs(objs, cbf);
        }
      ], cbf);
    };

    /**
     * listObjects 列出所有的object,参数和listObjectsByFilter一样
     * @param  {[type]} args... [description]
     * @param  {[type]} cbf     [description]
     * @return {[type]}         [description]
    */


    Client.prototype.listObjects = function() {
      var args, cbf, tmp, _i;
      args = 2 <= arguments.length ? __slice.call(arguments, 0, _i = arguments.length - 1) : (_i = 0, []), cbf = arguments[_i++];
      tmp = function(err, result) {
        if (err) {
          return cbf(err);
        } else {
          return cbf(null, result.items);
        }
      };
      args.push(tmp);
      return this.listObjectsByFilter.apply(this, args);
    };

    /**
     * listObjectsByFilter 通过自定义的filter列出合条件的object
     * @param  {String} bucket  [description]
     * @param  {Object} {optioanl} headers [description]
     * @param  {Object} {optioanl} params  [description]
     * @param  {[type]} cbf     [description]
     * @return {[type]}         [description]
    */


    Client.prototype.listObjectsByFilter = function(bucket, params, cbf) {
      var filter, items, marker, max,
        _this = this;
      if (params == null) {
        params = {};
      }
      if (_.isFunction(params)) {
        cbf = params;
        params = null;
      }
      if (params == null) {
        params = {};
      }
      filter = params.filter;
      delete params.filter;
      max = params.max || -1;
      delete params.max;
      if (filter) {
        params['max-keys'] = OSS_MAX_RESULT_OBJECTS;
      }
      if (!filter && max > 0 && max < OSS_MAX_RESULT_OBJECTS) {
        params['max-keys'] = max;
      }
      marker = params.marker;
      items = [];
      return async.doWhilst(function(cbf) {
        params.marker = marker;
        return _this.listBucket(bucket, params, function(err, result) {
          var tmpItems;
          if (result) {
            marker = result.marker;
            tmpItems = result.items;
            if (filter) {
              tmpItems = _.filter(tmpItems, filter);
            }
            if (~max) {
              max -= tmpItems.length;
              if (max < 0) {
                max = 0;
              }
            }
            items = items.concat(tmpItems);
          }
          return cbf(err);
        });
      }, function() {
        if (~max) {
          return marker && max > 0;
        } else {
          return marker;
        }
      }, function(err) {
        if (err) {
          return cbf(err);
        } else {
          return cbf(null, {
            marker: marker,
            items: items
          });
        }
      });
    };

    /**
     * putObjectFromPath 从目录中更新object（将目录下的所有文件都更新）
     * @param  {[type]} bucket     [description]
     * @param  {[type]} targetPath [description]
     * @param  {[type]} sourcePath [description]
     * @param  {[type]} cbf        [description]
     * @return {[type]}            [description]
    */


    Client.prototype.putObjectFromPath = function(bucket, targetPath, sourcePath, progress, cbf) {
      var complete, sourcePathLen, syncFilesInfo, total,
        _this = this;
      if (!cbf) {
        cbf = progress;
        progress = function() {};
      }
      sourcePathLen = sourcePath.length;
      syncFilesInfo = null;
      total = 0;
      complete = 0;
      return async.waterfall([
        function(cbf) {
          return _this.util.classifyFiles(sourcePath, LARGE_FILE_SIZE, cbf);
        }, function(info, cbf) {
          var failFiles;
          syncFilesInfo = info;
          failFiles = [];
          total = syncFilesInfo.files.length + syncFilesInfo.largeFiles.length;
          return async.eachLimit(syncFilesInfo.files, 5, function(file, cbf) {
            var object;
            if (targetPath) {
              object = targetPath + file.substring(sourcePathLen);
            } else {
              object = '/' + file.substring(sourcePathLen);
            }
            return _this.updateObjectFromFile(bucket, object, file, function(err) {
              var status;
              status = 'complete';
              if (err) {
                status = 'fail';
                failFiles.push(file);
              }
              complete++;
              progress('putObjectFromPath', {
                file: file,
                status: status,
                complete: complete,
                total: total
              });
              return cbf(null);
            });
          }, function(err) {
            return cbf(err, failFiles);
          });
        }, function(failFiles, cbf) {
          return async.eachLimit(syncFilesInfo.largeFiles, 1, function(file, cbf) {
            var object;
            object = targetPath + file.substring(sourcePathLen);
            return this.updateLargeObjectFromFile(bucket, object, file, function(err) {
              var status;
              status = 'complete';
              if (err) {
                status = 'fail';
                failFiles.push(file);
              }
              complete++;
              progress('putObjectFromPath', {
                file: file,
                status: status,
                complete: complete,
                total: total
              });
              return cbf(null);
            });
          }, function(err) {
            return cbf(err, failFiles);
          });
        }
      ], cbf);
    };

    /**
     * clearAllObjectsInBucket 清除bucket中的所有object
     * @param  {[type]} bucket [description]
     * @return {[type]}        [description]
    */


    Client.prototype.clearAllObjectsInBucket = function(bucket) {};

    /**
     * watch 监控目录的变化，对应更新oss的相应目录（在调用的时候，首先会将整个目录同步一次：根据ETag判断是否需要修改）
     * @param  {String} bucket     [description]
     * @param  {String} targetPath [description]
     * @param  {String} sourcePath [description]
     * @param  {[type]} cbf        [description]
     * @return {[type]}            [description]
    */


    Client.prototype.watch = function(bucket, targetPath, sourcePath, cbf) {
      var sourcePathLen, _deletedFiles, _putFiles,
        _this = this;
      sourcePathLen = sourcePath.length;
      _putFiles = function(files, cbf) {
        var failFiles;
        failFiles = [];
        return async.eachLimit(files, 2, function(file, cbf) {
          var object;
          object = targetPath + file.substring(sourcePathLen);
          return _this.updateObjectFromFile(bucket, object, file, function(err) {
            if (err) {
              failFiles.push(file);
            }
            return cbf(null);
          });
        }, function() {
          return cbf(null, failFiles);
        });
      };
      _deletedFiles = function(files, cbf) {
        files = _.map(files, function(file) {
          return targetPath + file.substring(sourcePathLen);
        });
        return _this.deleteObjects(bucket, files, cbf);
      };
      return this.sync(bucket, targetPath, sourcePath, function(err, failFiles) {
        return _this.util.watch(sourcePath, LARGE_FILE_SIZE, function(err, info) {
          console.dir(info);
          if (info.created) {
            _putFiles(info.created, function(err, failFiles) {
              return console.dir(failFiles);
            });
          }
          if (info.changed) {
            _putFiles(info.changed, function(err, failFiles) {
              return console.dir(failFiles);
            });
          }
          if (info.deleted) {
            _deletedFiles(info.deleted, function(err, data) {
              console.dir(err);
              return console.dir(data);
            });
            return console.dir(info.deleted);
          }
        });
      });
    };

    /**
     * sync 将本地目录和oss的同步（watch操作一开始会调用sync）
     * @param  {String} bucket     [description]
     * @param  {String} targetPath [description]
     * @param  {String} sourcePath [description]
     * @param  {[type]} cbf        [description]
     * @return {[type]}            [description]
    */


    Client.prototype.sync = function(bucket, targetPath, sourcePath, progress, cbf) {
      var getDeleteObjects,
        _this = this;
      if (!cbf) {
        cbf = progress;
        progress = function() {};
      }
      getDeleteObjects = function(cbf) {
        return async.waterfall([
          function(cbf) {
            var prefix;
            prefix = targetPath;
            if (prefix[prefix.length - 1] !== '/') {
              prefix += '/';
            }
            return _this.listObjects(bucket, {
              prefix: targetPath
            }, cbf);
          }, function(objectList, cbf) {
            return _this.util.classifyFiles(sourcePath, function(err, info) {
              var tmpFiles;
              if (err) {
                return cbf(err);
              } else {
                tmpFiles = info.files.concat(info.largeFiles);
                tmpFiles = _.map(info.files.concat(info.largeFiles), function(file) {
                  return file.replace(sourcePath, targetPath);
                });
                return cbf(null, _.difference(_.pluck(objectList, 'name'), tmpFiles));
              }
            });
          }
        ], cbf);
      };
      return async.waterfall([
        function(cbf) {
          return getDeleteObjects(cbf);
        }, function(objectList, cbf) {
          return _this.deleteObjects(bucket, objectList, cbf);
        }, function(cbf) {
          return _this.putObjectFromPath(bucket, targetPath, sourcePath, progress, cbf);
        }
      ], cbf);
    };

    /**
     * updateLargeObjectFromFile 更新大文件
     * @param  {String} bucket   [description]
     * @param  {String} object   [description]
     * @param  {String} fileName [description]
     * @param  {[type]} cbf      [description]
     * @return {[type]}          [description]
    */


    Client.prototype.updateLargeObjectFromFile = function(bucket, object, fileName, headers, params, cbf) {
      var _this = this;
      if (params == null) {
        params = {};
      }
      if (_.isFunction(headers)) {
        headers = null;
        cbf = headers;
      } else if (_.isFunction(params)) {
        cbf = params;
        params = headers;
        headers = null;
      }
      return async.waterfall([
        function(cbf) {
          return _this.isModified(bucket, object, fileName, cbf);
        }, function(modified, cbf) {
          if (modified) {
            return async.waterfall([
              function(cbf) {
                return _this.headObject(bucket, object, cbf);
              }, function(headers, cbf) {
                return this.uploadLargeFile(bucket, object, fileName, headers, params, cbf);
              }
            ], cbf);
          } else {
            return cbf(null);
          }
        }
      ], cbf);
    };

    Client.prototype.exec = function(method, bucket, object, headers, body, params, cbf) {
      var options, resource, url;
      if (headers == null) {
        headers = {};
      }
      if (body == null) {
        body = '';
      }
      if (params == null) {
        params = {};
      }
      cbf = _.once(cbf);
      delete headers['Content-Length'];
      if (!bucket) {
        resource = '/';
        headers['Host'] = this.host;
      } else {
        headers['Host'] = "" + bucket + "." + this.host;
        resource = "/" + bucket + "/";
      }
      delete params.progress;
      resource = resource + object + this.util.getResource(params);
      url = "http://" + headers['Host'] + ":" + this.port + "/" + object;
      url = this.util.appendParam(url, params);
      headers['Date'] = new Date().toUTCString();
      headers['Authorization'] = this._createSignForNormalAuth(method, headers, resource);
      if (body) {
        headers['Content-Length'] = body.length;
      }
      options = {
        method: method,
        body: body,
        url: GLOBAL.encodeURI(url),
        encoding: null,
        headers: headers,
        timeout: this.timeout * 1000
      };
      return this.request(options, this.retryTimes, cbf);
    };

    Client.prototype.request = function(options, retryTimes, cbf) {
      var method, _ref,
        _this = this;
      method = options.method;
      if (((_ref = options.body) != null ? _ref.length : void 0) > 20 * 　KB_SIZE) {
        delete options.timeout;
      }
      console.dir(options);
      return request(options, function(err, res, body) {
        var headers;
        if (err) {
          if (retryTimes > 0) {
            return _this.request(options, --retryTimes, cbf);
          } else {
            return cbf(err);
          }
        } else if (res.statusCode < 200 || res.statusCode > 299) {
          err = new Error(body);
          err.status = res.statusCode;
          err.code = res.statusCode;
          err.data = body;
          return cbf(err);
        } else {
          headers = res.headers;
          _this._covertHeaders(headers);
          if (method === 'HEAD') {
            return cbf(null, headers);
          } else {
            if ((body != null ? body.length : void 0) && headers['Content-Encoding'] === 'gzip') {
              return zlib.gunzip(body, cbf);
            } else {
              return cbf(null, body || headers);
            }
          }
        }
      });
    };

    Client.prototype._md5 = function(fileName, cbf) {
      var md5, reader;
      md5 = crypto.createHash('md5');
      reader = fs.createReadStream(fileName);
      reader.pipe(md5, {
        end: false
      });
      return reader.on('end', function(err) {
        if (err) {
          return cbf(err);
        } else {
          return cbf(null, md5.digest('hex').toUpperCase());
        }
      });
    };

    /**
     * _batchDeleteObject 批量删除object
     * @param  {String} bucket     [description]
     * @param  {String} objListXml [description]
     * @param  {Object} {optional} headers [description]
     * @param  {Object} {optional} params  [description]
     * @param  {[type]} cbf        [description]
     * @return {[type]}            [description]
    */


    Client.prototype._batchDeleteObject = function(bucket, objListXml, headers, params, cbf) {
      var body, md5, method, object;
      if (headers == null) {
        headers = {};
      }
      if (params == null) {
        params = {};
      }
      if (_.isFunction(headers)) {
        cbf = headers;
        headers = {};
      } else if (_.isFunction(params)) {
        cbf = params;
        params = headers;
        headers = null;
      }
      method = 'POST';
      object = '';
      body = new Buffer(objListXml);
      headers['Content-Length'] = body.length;
      params['delete'] = '';
      md5 = crypto.createHash('md5');
      headers['Content-Md5'] = md5.update(body).digest('base64').trim();
      return this.exec(method, bucket, object, headers, body, params, cbf);
    };

    Client.prototype._covertHeaders = function(headers) {
      var covertKeys;
      covertKeys = {
        'cache-control': 'Cache-Control',
        'connection': 'Connection',
        'content-encoding': 'Content-Encoding',
        'content-length': 'Content-Length',
        'content-type': 'Content-Type',
        'content-language': 'Content-Language',
        'date': 'Date',
        'etag': 'ETag',
        'last-modified': 'Last-Modified'
      };
      return _.each(covertKeys, function(value, key) {
        if (headers[key]) {
          headers[value] = headers[key];
          return delete headers[key];
        }
      });
    };

    Client.prototype._createSignForNormalAuth = function(method, headers, resource) {
      if (headers == null) {
        headers = {};
      }
      if (resource == null) {
        resource = '/';
      }
      return "" + this.provider + " " + this.accessId + ":" + (this.util.getAssign(this.accessKey, method, headers, resource));
    };

    return Client;

  })();

  Client.prototype.getService = Client.prototype.listAllMyBuckets;

  Client.prototype.getBucket = Client.prototype.listBucket;

  Client.prototype.createBucket = Client.prototype.putBucket;

  Client.prototype.putObjectFromString = Client.prototype.putObjectWithData;

  Client.prototype.batchDeleteObjects = Client.prototype.deleteObjects;

  module.exports = Client;

}).call(this);
