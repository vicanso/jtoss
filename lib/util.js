(function() {
  var UTIL, async, crypto, fs, mime, noop, path, request, zlib, _;

  async = require('async');

  _ = require('underscore');

  fs = require('fs');

  crypto = require('crypto');

  path = require('path');

  mime = require('mime');

  request = require('request');

  zlib = require('zlib');

  noop = function() {};

  UTIL = (function() {

    function UTIL(accessId, accessKey, host, port, timeout) {
      this.accessId = accessId;
      this.accessKey = accessKey;
      this.host = host != null ? host : 'oss.aliyuncs.com';
      this.port = port != null ? port : '8080';
      this.timeout = timeout != null ? timeout : 30000;
    }

    /**
     * md5 获取MD5值
     * @param  {String, Buffer} data 获取作MD5处理的数据
     * @param  {String} type 返回的数据类型，可以为'hex'、'binary'或者'base64'，默认为'hex'
     * @return {[type]}      [description]
    */


    UTIL.prototype.md5 = function(data, type) {
      var md5;
      if (type == null) {
        type = 'hex';
      }
      md5 = crypto.createHash('md5');
      return md5.update(data).digest(type);
    };

    /**
     * getData 获取文件数据，判断该字符串对应的文件是否存在，如果存在，读取文件内容，如果不存在，则认为该字符串就是数据
     * @param  {[type]} file [description]
     * @param  {[type]} cbf  [description]
     * @return {[type]}      [description]
    */


    UTIL.prototype.getData = function(file, cbf) {
      return fs.exists(file, function(exists) {
        if (exists) {
          return fs.readFile(file, cbf);
        } else {
          return cbf(null, file);
        }
      });
    };

    /**
     * getETag 获取ETag
     * @param  {String, Buffer} obj 文件路径或者文件内容
     * @param  {[type]} cbf [description]
     * @return {[type]}     [description]
    */


    UTIL.prototype.getETag = function(obj, cbf) {
      var _this = this;
      async.waterfall([
        function(cbf) {
          if (_.isString(obj)) {
            return _this.getData(obj, cbf);
          } else {
            return process.nextTick(function() {
              return cbf(null, obj);
            });
          }
        }, function(data, cbf) {
          return cbf(null, '"' + _this.md5(data).toUpperCase() + '"');
        }
      ], cbf);
      return this;
    };

    /**
     * [getGroupPostBody description]
     * @param  {[type]} bucket [description]
     * @param  {[type]} objs   [description]
     * @param  {[type]} cbf    [description]
     * @return {[type]}        [description]
    */


    UTIL.prototype.getGroupPostBody = function(bucket, objs, cbf) {
      var index, xml,
        _this = this;
      xml = '<CreateFileGroup>';
      index = 0;
      async.whilst(function() {
        return index !== objs.length;
      }, function(cbf) {
        var obj;
        obj = objs[index];
        return _this.getETag(obj, function(err, etag) {
          index++;
          if (err) {
            return cbf(err);
          } else {
            xml += "<Part><PartNumber>" + index + "</PartNumber><PartName>" + obj + "</PartName><ETag>" + etag + "</ETag></Part>";
            return cbf(null);
          }
        });
      }, function(err) {
        return cbf(err, xml + '</CreateFileGroup>');
      });
      return this;
    };

    /**
     * toBinary 字符串转换为binary
     * @param  {[type]} str [description]
     * @return {[type]}     [description]
    */


    UTIL.prototype.toBinary = function(str) {
      return new Buffer(str).toString('binary');
    };

    /**
     * getSign 获取sign字符串
     * @param  {[type]} method      [description]
     * @param  {[type]} contentType =             '' [description]
     * @param  {[type]} contentMd5  =             '' [description]
     * @param  {[type]} date        [description]
     * @param  {[type]} metas       [description]
     * @param  {[type]} resource    [description]
     * @return {[type]}             [description]
    */


    UTIL.prototype.getSign = function(method, contentType, contentMd5, date, metas, resource) {
      var content, newmetas, params, result, sha1, tmp;
      if (contentType == null) {
        contentType = '';
      }
      if (contentMd5 == null) {
        contentMd5 = '';
      }
      params = [method.toUpperCase(), contentType, contentMd5, date];
      if (metas) {
        newmetas = {};
        _.each(metas, function(value, key) {
          value = value.trim();
          if (!key.indexOf('x-oss-')) {
            if (newmetas[key]) {
              return newmetas[key] = "," + value;
            } else {
              return newmetas[key] = value;
            }
          }
        });
        tmp = _.map(newmetas, function(value, key) {
          return "" + key + ":" + value;
        });
        params.push.apply(params, tmp.sort());
      }
      params.push(resource);
      sha1 = crypto.createHmac('sha1', this.accessKey);
      content = this.toBinary(params.join('\n'));
      return result = sha1.update(content).digest('base64');
    };

    /**
     * [getResource description]
     * @param  {[type]} ossParams [description]
     * @return {[type]}           [description]
    */


    UTIL.prototype.getResource = function(ossParams) {
      var header, params, resource;
      resource = '';
      _.each('bucket object'.split(' '), function(value) {
        if (_.isString(ossParams[value])) {
          return resource = "" + resource + "/" + ossParams[value];
        }
      });
      params = [];
      if (_.isBoolean(ossParams['isAcl'])) {
        params.push('acl');
      } else if (_.isBoolean(ossParams['isGroup'])) {
        params.push('group');
      }
      header = ossParams.header;
      if (header) {
        params = params.concat(_.map(header, function(value, key) {
          return "" + key + "=" + value;
        }));
        params = params.sort();
      }
      if (params.length) {
        resource += "?" + (params.join('&'));
      } else if (!_.isUndefined(ossParams.acl)) {
        resource += '/?acl';
      }
      return resource;
    };

    /**
     * getUrl 获取URL
     * @param  {[type]} ossParams [description]
     * @return {[type]}           [description]
    */


    UTIL.prototype.getUrl = function(ossParams) {
      var params, url;
      if (!_.isUndefined(ossParams.acl)) {
        url = "http://" + ossParams.bucket + "." + this.host + ":" + this.port + "/?acl";
      } else {
        url = "http://" + this.host + ":" + this.port + (this.getResource(ossParams));
        params = this.getOssParamQuery(ossParams);
        if (params.length) {
          if (!~url.indexOf('?')) {
            url += '?';
          } else {
            url += '&';
          }
          url += params.join('&');
        }
      }
      return url;
    };

    /**
     * getSignUrl 获取带签名的URL
     * @param  {[type]} method    [description]
     * @param  {[type]} ossParams [description]
     * @param  {[type]} ttl       [description]
     * @return {[type]}           [description]
    */


    UTIL.prototype.getSignUrl = function(method, ossParams, ttl) {
      var date, params, resource, sign, url;
      date = Date.now() + ttl;
      resource = this.getResource(ossParams);
      sign = this.getSign(method, '', '', date, {}, resource);
      url = this.getUrl(ossParams);
      params = [];
      params.push("OSSAccessKeyId=" + this.accessId);
      params.push("Expires=" + date);
      params.push("Signature=" + sign);
      if (!~url.indexOf('?')) {
        url += '?';
      } else {
        url += '&';
      }
      url += params.join('&');
      return url;
    };

    /**
     * getOssParamQuery 获取OSS的参数查询字段
     * @param  {[type]} ossParams [description]
     * @return {[type]}           [description]
    */


    UTIL.prototype.getOssParamQuery = function(ossParams) {
      var params;
      params = [];
      _.each('prefix marker max-keys delimiter'.split(' '), function(value) {
        if (_.isString(ossParams[value]) || (value === 'max-keys' && _.isNumber(ossParams[value]))) {
          return params.push("" + value + "=" + ossParams[value]);
        }
      });
      return params.sort();
    };

    /**
     * fillHeaders 填充headers
     * @param  {[type]} headers   [description]
     * @param  {[type]} method    [description]
     * @param  {[type]} metas     =             {} [description]
     * @param  {[type]} ossParams [description]
     * @return {[type]}           [description]
    */


    UTIL.prototype.fillHeaders = function(headers, method, metas, ossParams) {
      var date, self;
      if (metas == null) {
        metas = {};
      }
      self = this;
      date = new Date().toGMTString();
      headers.Date = date;
      if (ossParams.isGroup) {
        headers['Content-Type'] = 'text/xml';
      }
      _.extend(metas, ossParams.userMetas);
      _.extend(headers, metas);
      headers['Authorization'] = ("OSS " + this.accessId + ":") + this.getSign(method, headers['Content-Md5'], headers['Content-Type'], date, metas, this.getResource(ossParams));
      return this;
    };

    /**
     * getHeaders 获取headers
     * @param  {[type]} method    [description]
     * @param  {[type]} metas     [description]
     * @param  {[type]} ossParams [description]
     * @param  {[type]} {optional} srcFile   [description]
     * @return {[type]}           [description]
    */


    UTIL.prototype.getHeaders = function(method, metas, ossParams, srcFile) {
      var data, headers, md5;
      headers = {};
      if (srcFile) {
        headers['Content-Type'] = mime.lookup(path.extname(srcFile.name));
        data = srcFile.data;
        headers['Content-Length'] = data.length;
        md5 = crypto.createHash('md5');
        headers['Content-Md5'] = md5.update(data).digest('hex');
      }
      this.fillHeaders(headers, method, metas, ossParams);
      return headers;
    };

    /**
     * exec 执行操作
     * @param  {String} method HTTP Method类型
     * @param  {[type]} metas     [description]
     * @param  {[type]} ossParams [description]
     * @param  {[type]} {optional} srcFile   [description]
     * @param  {[type]} cbf       =             noop [description]
     * @return {[type]}           [description]
    */


    UTIL.prototype.exec = function(method, metas, ossParams, srcFile, cbf) {
      var headers, options;
      if (cbf == null) {
        cbf = noop;
      }
      if (_.isFunction(srcFile)) {
        cbf = srcFile;
        srcFile = null;
      }
      cbf = _.once(cbf);
      method = method.toUpperCase();
      headers = this.getHeaders(method, metas, ossParams, srcFile);
      headers['Accept-Encoding'] = 'gzip';
      options = {
        method: method,
        url: GLOBAL.encodeURI(this.getUrl(ossParams)),
        encoding: null,
        headers: headers,
        timeout: this.timeout
      };
      if (srcFile) {
        options.body = srcFile.data;
      }
      if (ossParams.isGroup) {
        options.body = this.getGroupPostBody(ossParams.bucket, ossParams.objectArray);
      }
      return this.request(options, cbf);
    };

    UTIL.prototype.request = function(options, cbf) {
      var method,
        _this = this;
      method = options.method;
      return request(options, function(err, res, body) {
        var headers;
        if (err) {
          return cbf(err);
        } else if (res.statusCode !== 200 && res.statusCode !== 204) {
          err = new Error(body);
          err.code = res.statusCode;
          return cbf(err);
        } else {
          headers = res.headers;
          _this.covertHeaders(headers);
          if (method === 'HEAD') {
            return cbf(null, headers);
          } else {
            if ((body != null ? body.length : void 0) && headers['Content-Encoding'] === 'gzip') {
              return zlib.gunzip(body, cbf);
            } else {
              return cbf(null, body);
            }
          }
        }
      });
    };

    UTIL.prototype.covertHeaders = function(headers) {
      var covertKeys;
      covertKeys = {
        'cache-control': 'Cache-Control',
        'connection': 'Connection',
        'content-encoding': 'Content-Encoding',
        'content-length': 'Content-Length',
        'content-type': 'Content-Type',
        'date': 'Date',
        'etag': 'ETag',
        'last-modified': 'Last-Modified'
      };
      _.each(covertKeys, function(value, key) {
        if (headers[key]) {
          headers[value] = headers[key];
          return delete headers[key];
        }
      });
      return headers;
    };

    UTIL.prototype.validateObject = function(name) {
      var ch, err;
      err = new Error('长度必须在 1-1023 字节之间；不能以“/”或者“\”字符开头');
      if (name.length < 1 || name.length > 1023) {
        return err;
      } else {
        ch = name.charAt(0);
        if (ch === '\\' || ch === '/') {
          return err;
        } else {
          return null;
        }
      }
    };

    UTIL.prototype.validateBucket = function(name) {
      var err, reg;
      err = new Error('只能包括小写字母,数字,短横线(-);必须以小写字母或者数字开头;长度必须在 3-63 字节之间');
      reg = /^([a-z\d\-]*)$/;
      if (value.length < 3 || value.length > 63) {
        return err;
      } else if (!reg.test(value)) {
        return err;
      } else if (value.charAt(0) === '-') {
        return err;
      } else {
        return null;
      }
    };

    return UTIL;

  })();

  module.exports = UTIL;

}).call(this);
