(function() {
  var Client, UTIL, async, fs, jtfs, noop, path, xml2js, _;

  UTIL = require('./util');

  fs = require('fs');

  _ = require('underscore');

  path = require('path');

  async = require('async');

  jtfs = require('jtfs');

  xml2js = require('xml2js');

  noop = function() {};

  Client = (function() {

    function Client(accessId, accessKey, host, port, timeout) {
      this.accessId = accessId;
      this.accessKey = accessKey;
      this.host = host != null ? host : 'oss.aliyuncs.com';
      this.port = port != null ? port : '8080';
      this.timeout = timeout != null ? timeout : 30000;
      this.util = new UTIL(this.accessId, this.accessKey, this.host, this.port, this.timeout);
    }

    /**
     * createBucket 创建bucket
     * @param  {String} bucket 
     * @param  {String} acl bucket的访问权限控制，默认值为private，可选值有private,public-read,public-read-write
     * @param  {Function} cbf 回调函数(err, result)
     * @return {[type]}        [description]
    */


    Client.prototype.createBucket = function(bucket, acl, cbf) {
      var metas, method, ossParams;
      if (acl == null) {
        acl = 'private';
      }
      if (cbf == null) {
        cbf = noop;
      }
      if (_.isFunction(acl)) {
        cbf = acl;
        acl = 'private';
      }
      if (!bucket) {
        cbf(new Error('the param bucket can not be null'));
        return;
      }
      method = 'put';
      metas = {
        'x-oss-acl': acl
      };
      ossParams = {
        bucket: bucket
      };
      this.util.exec(method, metas, ossParams, cbf);
      return this;
    };

    /**
     * [getService description]
     * @param  {[type]} cbf =             noop [description]
     * @return {[type]}     [description]
    */


    Client.prototype.getService = function(cbf) {
      if (cbf == null) {
        cbf = noop;
      }
      return this.listBuckets(cbf);
    };

    /**
     * listBuckets 显示所有bucket
     * @param  {Function} cbf (err, result)
     * @return {[type]}     [description]
    */


    Client.prototype.listBuckets = function(cbf) {
      var method, ossParams,
        _this = this;
      if (cbf == null) {
        cbf = noop;
      }
      method = 'get';
      ossParams = {
        bucket: ''
      };
      async.waterfall([
        function(cbf) {
          return _this.util.exec(method, null, ossParams, cbf);
        }, function(body, cbf) {
          var parser;
          parser = new xml2js.Parser();
          return parser.parseString(body, cbf);
        }
      ], function(err, result) {
        if (err) {
          return cbf(err);
        } else {
          return cbf(null, _.map(result.ListAllMyBucketsResult.Buckets[0].Bucket, function(item) {
            return {
              name: item.Name[0],
              createdAt: item.CreationDate[0]
            };
          }));
        }
      });
      return this;
    };

    /**
     * deleteBucket 删除bucket
     * @param  {String} bucket 
     * @param  {Function} cbf 回调函数(err, result)
     * @return {[type]}        [description]
    */


    Client.prototype.deleteBucket = function(bucket, cbf) {
      var method, ossParams;
      if (cbf == null) {
        cbf = noop;
      }
      if (!bucket) {
        cbf(new Error('the param bucket can not be null'));
        return;
      }
      method = 'delete';
      ossParams = {
        bucket: bucket
      };
      this.util.exec(method, null, ossParams, cbf);
      return this;
    };

    /**
     * setBucketAcl 设置bucket的访问权限
     * @param {String} bucket
     * @param {String} acl 访问权限
     * @param {Function} cbf 回调函数(err, result)
    */


    Client.prototype.setBucketAcl = function(bucket, acl, cbf) {
      var metas, method, ossParams;
      if (cbf == null) {
        cbf = noop;
      }
      if (arguments.length < 2) {
        cbf(new Error('the arguments is less than 2'));
        return;
      }
      method = 'put';
      metas = {
        'x-oss-acl': acl
      };
      ossParams = {
        bucket: bucket
      };
      this.util.exec(method, metas, ossParams, cbf);
      return this;
    };

    /**
     * getBucketAcl 获取bucket设置的权限
     * @param  {[type]} bucket [description]
     * @param  {[type]} cbf    =             noop [description]
     * @return {[type]}        [description]
    */


    Client.prototype.getBucketAcl = function(bucket, cbf) {
      var ossParams;
      if (cbf == null) {
        cbf = noop;
      }
      if (arguments.length < 1) {
        cbf(new Error('the arguments is less than 2'));
        return;
      }
      ossParams = {
        bucket: bucket,
        isAcl: true
      };
      this.util.exec('get', null, ossParams, cbf);
      return this;
    };

    /**
     * putObject 上传object
     * @param  {String} bucket 
     * @param  {String} object object在oss中的路径
     * @param  {String, Object} srcFile 源文件地址或者{name : xxx, data : xxx}
     * @param  {Object} {optional} userMetas [description]
     * @param  {Function} cbf 回调函数(err, result)
     * @return {[type]}           [description]
    */


    Client.prototype.putObject = function(bucket, object, srcFile, userMetas, cbf) {
      var method, ossParams,
        _this = this;
      if (cbf == null) {
        cbf = noop;
      }
      if (arguments.length < 3) {
        cbf(new Error('the arguments is less than 3'));
        return;
      }
      method = 'put';
      ossParams = {
        bucket: bucket,
        object: object
      };
      if (_.isFunction(userMetas)) {
        cbf = userMetas;
      } else if (_.isObject(userMetas)) {
        ossParams.userMetas = userMetas;
      }
      if (_.isString(srcFile)) {
        fs.readFile(srcFile, function(err, data) {
          if (err) {
            return cbf(err);
          } else {
            return _this.util.exec(method, null, ossParams, {
              name: srcFile,
              data: data
            }, cbf);
          }
        });
      } else {
        this.util.exec(method, null, ossParams, srcFile, cbf);
      }
      return this;
    };

    /**
     * copyObject 复制object
     * @param  {String} bucket 
     * @param  {String} dstObj 目标object
     * @param  {String} srcObj 源object
     * @param  {Object} {optional} userMetas [description]
     * @param  {Function} cbf 回调函数(err, result)
     * @return {[type]}        [description]
    */


    Client.prototype.copyObject = function(bucket, dstObj, srcObj, userMetas, cbf) {
      var metas, method, ossParams;
      if (cbf == null) {
        cbf = noop;
      }
      if (arguments.length < 3) {
        cbf(new Error('the arguments is less than 3'));
        return;
      }
      method = 'put';
      ossParams = {
        bucket: bucket,
        object: dstObj
      };
      metas = {};
      if (_.isFunction(userMetas)) {
        cbf = userMetas;
      } else if (_.isObject(userMetas)) {
        ossParams.userMetas = userMetas;
        _.each(userMetas, function(value, key) {
          if (!key.indexOf('x-oss-')) {
            metas[key] = value;
            return delete userMetas[key];
          }
        });
      }
      metas['x-oss-copy-source'] = "/" + bucket + "/" + srcObj;
      this.util.exec(method, metas, ossParams, cbf);
      return this;
    };

    /**
     * updateObject 更新object
     * @param  {String} bucket 
     * @param  {String} dstObj 目标对象，在oss上的路径
     * @param  {String} srcObj 源对象
     * @param  {Function} cbf 回调函数(err, result)
     * @return {[type]}        [description]
    */


    Client.prototype.updateObject = function(bucket, dstObj, srcObj, cbf) {
      var _this = this;
      if (cbf == null) {
        cbf = noop;
      }
      if (arguments.length < 3) {
        cbf(new Error('the arguments is less than 3'));
        return;
      }
      async.parallel([
        function(cbf) {
          if (_.isString(srcObj)) {
            return fs.readFile(srcObj, function(err, data) {
              if (err) {
                return cbf(err);
              } else {
                srcObj = {
                  name: srcObj,
                  data: data
                };
                return _this.util.getETag(srcObj.data, cbf);
              }
            });
          } else {
            return _this.util.getETag(srcObj.data, cbf);
          }
        }, function(cbf) {
          return _this.headObject(bucket, dstObj, function(err, result) {
            return cbf(null, result || {});
          });
        }
      ], function(err, result) {
        var etag;
        if (err) {
          return cbf(err);
        } else {
          etag = '"' + result[0] + '"';
          if (etag === result[1].etag) {
            return cbf(null);
          } else {
            return _this.putObject(bucket, dstObj, srcObj, cbf);
          }
        }
      });
      return this;
    };

    /**
     * updateObjectHeader 更新Object的response header
     * @param  {[type]} bucket           [description]
     * @param  {[type]} obj              [description]
     * @param  {[type]} resContentHeader [description]
     * @param  {[type]} cbf              =             noop [description]
     * @return {[type]}                  [description]
    */


    Client.prototype.updateObjectHeader = function(bucket, obj, resContentHeader, cbf) {
      var _this = this;
      if (cbf == null) {
        cbf = noop;
      }
      if (arguments.length < 3) {
        cbf(new Error('the arguments is less than 3'));
        return;
      }
      resContentHeader['x-oss-metadata-directive'] = 'REPLACE';
      if (!resContentHeader['Content-Encoding']) {
        this.copyObject(bucket, obj, obj, resContentHeader, cbf);
      } else {
        async.waterfall([
          function(cbf) {
            return _this.headObject(bucket, obj, cbf);
          }, function(headers, cbf) {
            if (headers['content-encoding']) {
              return _this.copyObject(bucket, obj, obj, resContentHeader, cbf);
            } else {
              return async.waterfall([
                function(cbf) {
                  return _this.getObject(bucket, obj, cbf);
                }, function(data, cbf) {
                  return zlib.gzip(data, cbf);
                }, function(data, cbf) {
                  return _this.putObject(bucket, obj, {
                    name: obj,
                    data: data
                  }, resContentHeader, cbf);
                }
              ], cbf);
            }
          }
        ], cbf);
      }
      return this;
    };

    /**
     * deleteObject 删除object
     * @param  {String} bucket 
     * @param  {String} obj 要删除的obj在oss上的路径
     * @param  {Function} cbf 回调函数(err, result)
     * @return {[type]}        [description]
    */


    Client.prototype.deleteObject = function(bucket, obj, cbf) {
      var method, ossParams;
      if (cbf == null) {
        cbf = noop;
      }
      if (arguments.length < 2) {
        cbf(new Error('the arguments is less than 2'));
        return;
      }
      method = 'delete';
      ossParams = {
        bucket: bucket,
        object: obj
      };
      this.util.exec(method, null, ossParams, cbf);
      return this;
    };

    /**
     * getObject 获取object
     * @param  {String} bucket
     * @param  {String} obj 要获取的obj在oss上的路径
     * @param  {Object} {optional} userHeaders [description]
     * @param  {Function} cbf 回调函数，(err, data)
     * @return {[type]}             [description]
    */


    Client.prototype.getObject = function(bucket, obj, userHeaders, cbf) {
      var method, ossParams;
      if (cbf == null) {
        cbf = noop;
      }
      if (arguments.length < 2) {
        cbf(new Error('the arguments is less than 2'));
        return;
      }
      method = 'get';
      ossParams = {
        bucket: bucket,
        object: obj
      };
      if (_.isFunction(userHeaders)) {
        cbf = userHeaders;
      } else if (_.isObject(userHeaders)) {
        ossParams.userHeaders = userHeaders;
      }
      this.util.exec(method, null, ossParams, cbf);
      return this;
    };

    /**
     * getObjectToFile 获取Object保存到文件
     * @param  {[type]} bucket      [description]
     * @param  {[type]} obj         [description]
     * @param  {[type]} dstFile     [description]
     * @param  {[type]} userHeaders [description]
     * @param  {[type]} cbf         =             noop [description]
     * @return {[type]}             [description]
    */


    Client.prototype.getObjectToFile = function(bucket, obj, dstFile, userHeaders, cbf) {
      if (cbf == null) {
        cbf = noop;
      }
      if (arguments.length < 3) {
        cbf(new Error('the arguments is less than 2'));
        return;
      }
      this.getObject(bucket, obj, userHeaders, function(err, data) {
        if (err) {
          return cbf(err);
        } else {
          return fs.writeFile(dstFile, data, cbf);
        }
      });
      return this;
    };

    /**
     * headObject 获取Obejct的header信息
     * @param  {String} bucket
     * @param  {String} obj 要获取的obj在oss上的路径
     * @param  {Function} cbf 回调函数(err, cbf)
     * @return {[type]}        [description]
    */


    Client.prototype.headObject = function(bucket, obj, cbf) {
      var method, ossParams;
      if (cbf == null) {
        cbf = noop;
      }
      if (arguments.length < 2) {
        cbf(new Error('the arguments is less than 2'));
        return;
      }
      method = 'head';
      ossParams = {
        bucket: bucket,
        object: obj
      };
      this.util.exec(method, null, ossParams, cbf);
      return this;
    };

    /**
     * listObjects 列出object（oss限制最多一次只能获取100个）
     * @param  {String} bucket
     * @param  {Object} {optional} options [description]
     * @param  {Function} cbf 回调函数(err, result)
     * @return {[type]}         [description]
    */


    Client.prototype.listObjects = function(bucket, options, cbf) {
      var method, ossParams,
        _this = this;
      if (cbf == null) {
        cbf = noop;
      }
      if (arguments.length < 1) {
        cbf(new Error('the arguments is less than 1'));
        return;
      }
      if (_.isFunction(options)) {
        cbf = options;
        options = null;
      }
      method = 'get';
      ossParams = {
        bucket: bucket
      };
      _.extend(ossParams, options);
      async.waterfall([
        function(cbf) {
          return _this.util.exec(method, null, ossParams, cbf);
        }, function(body, cbf) {
          return new xml2js.Parser().parseString(body, cbf);
        }
      ], function(err, res) {
        var ListBucketResult, next, result, total, _ref;
        if (err) {
          return cbf(err);
        } else {
          result = [];
          ListBucketResult = res.ListBucketResult;
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
          total = result.length;
          next = (_ref = ListBucketResult.NextMarker) != null ? _ref[0] : void 0;
          return cbf(null, {
            total: total,
            next: next,
            items: result
          });
        }
      });
      return this;
    };

    /**
     * listAllObjects 获取所有的object（通过多次调用listObjects，获取所有的Objects）
     * @param  {[type]} bucket  [description]
     * @param  {[type]} options [description]
     * @param  {[type]} cbf     =             noop [description]
     * @return {[type]}         [description]
    */


    Client.prototype.listAllObjects = function(bucket, options, cbf) {
      var items, next,
        _this = this;
      if (cbf == null) {
        cbf = noop;
      }
      next = null;
      items = [];
      return async.doWhilst(function(cbf) {
        options.marker = next;
        return _this.listObjects(bucket, options, function(err, result) {
          if (result) {
            next = result.next;
            items = items.concat(result.items);
          }
          return cbf(err);
        });
      }, function() {
        return next;
      }, function(err) {
        return cbf(err, items);
      });
    };

    /**
     * [createObjectGroup description]
     * @param  {[type]} bucket   [description]
     * @param  {[type]} objGroup [description]
     * @param  {[type]} objs     [description]
     * @param  {[type]} cbf      [description]
     * @return {[type]}          [description]
    */


    Client.prototype.createObjectGroup = function(bucket, objGroup, objs, cbf) {
      var method, ossParams;
      if (cbf == null) {
        cbf = noop;
      }
      if (arguments.length < 3) {
        cbf(new Error('the arguments is less than 3'));
        return;
      }
      method = 'post';
      ossParams = {
        bucket: bucket,
        object: objGroup,
        objectArray: objs,
        isGroup: true
      };
      this.util.exec(method, null, ossParams, cbf);
      return this;
    };

    /**
     * [getObjectGroup description]
     * @param  {[type]} bucket   [description]
     * @param  {[type]} objGroup [description]
     * @param  {[type]} dstFile  [description]
     * @param  {[type]} cbf      [description]
     * @return {[type]}          [description]
    */


    Client.prototype.getObjectGroup = function(bucket, objGroup, dstFile, cbf) {
      var method, ossParams;
      if (cbf == null) {
        cbf = noop;
      }
      if (arguments.length < 3) {
        cbf(new Error('the arguments is less than 3'));
        return;
      }
      method = 'get';
      ossParams = {
        bucket: bucket,
        object: objGroup,
        isGroup: true,
        dstFile: dstFile
      };
      this.util.exec(method, null, ossParams, cbf);
      return this;
    };

    /**
     * [getObjectGroupIndex description]
     * @param  {[type]} bucket   [description]
     * @param  {[type]} objGroup [description]
     * @param  {[type]} cbf      [description]
     * @return {[type]}          [description]
    */


    Client.prototype.getObjectGroupIndex = function(bucket, objGroup, cbf) {
      var metas, method, ossParams;
      if (cbf == null) {
        cbf = noop;
      }
      if (arguments.length < 2) {
        cbf(new Error('the arguments is less than 2'));
        return;
      }
      method = 'get';
      ossParams = {
        bucket: bucket,
        object: objGroup
      };
      metas = {
        'x-oss-file-group': ''
      };
      this.util.exec(method, metas, ossParams, cbf);
      return this;
    };

    /**
     * [headObjectGroup description]
     * @param  {[type]} bucket   [description]
     * @param  {[type]} objGroup [description]
     * @param  {[type]} cbf      [description]
     * @return {[type]}          [description]
    */


    Client.prototype.headObjectGroup = function(bucket, objGroup, cbf) {
      var method, ossParams;
      if (cbf == null) {
        cbf = noop;
      }
      if (arguments.length < 2) {
        cbf(new Error('the arguments is less than 3'));
        return;
      }
      method = 'head';
      ossParams = {
        bucket: bucket,
        object: objGroup
      };
      this.util.exec(method, null, ossParams, cbf);
      return this;
    };

    /**
     * [deleteObjectGroup description]
     * @param  {[type]} bucket   [description]
     * @param  {[type]} objGroup [description]
     * @param  {[type]} cbf      [description]
     * @return {[type]}          [description]
    */


    Client.prototype.deleteObjectGroup = function(bucket, objGroup, cbf) {
      var method, ossParams;
      if (cbf == null) {
        cbf = noop;
      }
      if (arguments.length < 2) {
        cbf(new Error('the arguments is less than 2'));
        return;
      }
      method = 'delete';
      ossParams = {
        bucket: bucket,
        object: objGroup
      };
      this.util.exec(method, null, ossParams, cbf);
      return this;
    };

    /**
     * deleteObjects 删除objects
     * @param  {[type]} bucket [description]
     * @param  {[type]} data   [description]
     * @param  {[type]} cbf    [description]
     * @return {[type]}        [description]
    */


    Client.prototype.deleteObjects = function(bucket, data, cbf) {
      var headers, options;
      if (cbf == null) {
        cbf = noop;
      }
      headers = {};
      data = new Buffer(data);
      headers['Content-Length'] = data.length;
      headers['Content-Md5'] = this.util.md5(data, 'base64');
      options = {
        method: 'POST',
        url: GLOBAL.encodeURI("http://" + bucket + "." + this.host + ":" + this.port + "/?delete"),
        headers: headers,
        body: data
      };
      return this.util.request(options, function(err, res, body) {
        var parser;
        if (err) {
          return cbf(err);
        } else if (body) {
          parser = new xml2js.Parser();
          return parser.parseString(body, cbf);
        } else {
          return cbf(null);
        }
      });
    };

    /**
     * sync 同步文件
     * @param  {[type]} bucket  [description]
     * @param  {[type]} ossPath [description]
     * @param  {[type]} files   [description]
     * @param  {[type]} cbf     [description]
     * @return {[type]}         [description]
    */


    Client.prototype.sync = function(bucket, ossPath, files, viewProgress, cbf) {
      var completeTotal, failFiles, step, stepCbf, successFiles, total,
        _this = this;
      if (cbf == null) {
        cbf = noop;
      }
      if (arguments.length < 3) {
        cbf(new Error('the arguments is less than 2'));
        return;
      }
      if (_.isFunction(viewProgress)) {
        cbf = viewProgress;
        viewProgress = false;
      }
      if (!_.isArray(files)) {
        files = [files];
      }
      failFiles = [];
      successFiles = [];
      if (viewProgress) {
        total = files.length;
        completeTotal = 0;
        step = Math.floor(total / 10);
        stepCbf = function() {
          if (completeTotal % step === 0) {
            return cbf(null, {
              completion: Math.floor(completeTotal / total * 100),
              fail: failFiles,
              success: successFiles
            });
          }
        };
      }
      return async.eachLimit(files, 10, function(file, cbf) {
        var targetPath;
        targetPath = path.join(ossPath, path.basename(file));
        return _this.updateObject(bucket, targetPath, file, function(err) {
          if (err) {
            failFiles.push(file);
          } else {
            successFiles.push(file);
          }
          if (viewProgress) {
            completeTotal++;
            stepCbf();
          }
          return cbf(null);
        });
      }, function() {
        return cbf(null, {
          completion: 100,
          fail: failFiles,
          success: successFiles
        });
      });
    };

    /**
     * syncPath 同步文件夹
     * @param  {[type]} dstPath [description]
     * @param  {[type]} bucket  [description]
     * @param  {[type]} ossPath [description]
     * @param  {[type]} cbf     =             noop [description]
     * @return {[type]}         [description]
    */


    Client.prototype.syncPath = function(dstPath, bucket, ossPath, cbf) {
      var failFiles, originPath,
        _this = this;
      if (cbf == null) {
        cbf = noop;
      }
      if (arguments.length < 2) {
        cbf(new Error('the arguments is less than 2'));
        return;
      }
      originPath = dstPath;
      failFiles = [];
      return async.whilst(function() {
        if (_.isArray(dstPath)) {
          return dstPath.length;
        } else {
          return dstPath;
        }
      }, function(cbf) {
        return async.waterfall([
          function(cbf) {
            return jtfs.getFiles(dstPath, cbf);
          }, function(infos, cbf) {
            var filePath, files, targetPath;
            files = infos.files;
            dstPath = infos.dirs;
            if (files.length) {
              filePath = path.dirname(files[0]);
              targetPath = path.join(ossPath, path.relative(originPath, filePath));
              return _this.sync(files, bucket, targetPath, cbf);
            } else {
              return cbf(null);
            }
          }
        ], function(err, result) {
          var _ref;
          if (result != null ? (_ref = result.fail) != null ? _ref.length : void 0 : void 0) {
            failFiles = failFiles.concat(result.fail);
          }
          return cbf(null);
        });
      }, function() {
        return cbf(null, failFiles);
      });
    };

    return Client;

  })();

  module.exports = Client;

}).call(this);
