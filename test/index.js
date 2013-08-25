(function() {
  var OSSClient, async, ossClient, _;

  async = require('async');

  _ = require('underscore');

  OSSClient = require('../lib/client');

  ossClient = new OSSClient('', '');

  describe('Bucket functions: getService, createBucket, deleteBucket', function() {
    var nextFunc, testBucket;
    nextFunc = 'deleteBucket';
    testBucket = _.uniqueId('vicanso');
    return it('should run without error', function(done) {
      return async.waterfall([
        function(cbf) {
          return ossClient.getService(cbf);
        }, function(buckets, cbf) {
          var result;
          result = _.find(buckets, function(bucket) {
            return bucket.name === testBucket;
          });
          if (result) {
            ossClient.deleteBucket(testBucket, cbf);
            return nextFunc = 'createBucket';
          } else {
            return ossClient.createBucket(testBucket, cbf);
          }
        }, function(data, cbf) {
          return ossClient[nextFunc](testBucket, cbf);
        }, function(data, cbf) {
          if (nextFunc !== 'deleteBucket') {
            return ossClient.deleteBucket(testBucket, cbf);
          } else {
            return cbf(null);
          }
        }
      ], function(err) {
        if (err) {
          throw err;
        } else {
          return done();
        }
      });
    });
  });

  describe('Bucket functions: getBucketAcl, setBucketAcl', function() {
    return it('should run without error', function(done) {
      var testBucket;
      testBucket = _.uniqueId('vicanso');
      return async.waterfall([
        function(cbf) {
          return ossClient.createBucket(testBucket, cbf);
        }, function(data, cbf) {
          return ossClient.getBucketAcl(testBucket, cbf);
        }, function(data, cbf) {
          if (data !== 'private') {
            return cbf(new Error('get bucket acl fail'));
          } else {
            return ossClient.setBucketAcl(testBucket, 'public-read', cbf);
          }
        }, function(data, cbf) {
          return ossClient.getBucketAcl(testBucket, cbf);
        }, function(data, cbf) {
          if (data !== 'public-read') {
            return cbf(new Error('set bucket acl fail'));
          } else {
            return ossClient.deleteBucket(testBucket, cbf);
          }
        }
      ], function(err) {
        if (err) {
          throw err;
        } else {
          return done();
        }
      });
    });
  });

  describe('Object functions: putObject, copyObject, updateObject updateObjectHeaders deleteObject', function() {
    return it('should run without error', function(done) {
      var testBucket;
      testBucket = _.uniqueId('vicanso');
      return async.waterfall([
        function(cbf) {
          return ossClient.createBucket(testBucket, cbf);
        }, function(data, cbf) {
          return ossClient.putObjectFromFile(testBucket, 'index.coffee', './index.coffee', {
            'Content-Encoding': 'gzip'
          }, cbf);
        }, function(data, cbf) {
          return ossClient.getObject(testBucket, 'index.coffee', cbf);
        }, function(data, cbf) {
          if (data.length < 100) {
            return cbf(new Error('put object fail!'));
          } else {
            return ossClient.copyObject(testBucket, 'index.coffee', testBucket, 'copyindex.coffee', cbf);
          }
        }, function(data, cbf) {
          return ossClient.updateObjectFromFile(testBucket, 'index.coffee', './index.js', cbf);
        }, function(data, cbf) {
          return ossClient.updateObjectHeaders(testBucket, 'index.coffee', {
            'Cache-Control': 'public, maxage=300'
          }, cbf);
        }, function(data, cbf) {
          return ossClient.deleteObject(testBucket, 'index.coffee', cbf);
        }, function(data, cbf) {
          return ossClient.deleteObject(testBucket, 'copyindex.coffee', cbf);
        }, function(data, cbf) {
          return ossClient.deleteBucket(testBucket, cbf);
        }
      ], function(err) {
        if (err) {
          throw err;
        } else {
          return done();
        }
      });
    });
  });

  describe('Object functions: listBucket, listObjects', function() {
    return it('should run without error', function(done) {
      var testBucket;
      testBucket = _.uniqueId('vicanso');
      return async.waterfall([
        function(cbf) {
          return ossClient.createBucket(testBucket, cbf);
        }, function(data, cbf) {
          return ossClient.updateObjectFromFile(testBucket, 'index.coffee', './index.js', cbf);
        }, function(data, cbf) {
          return ossClient.listBucket(testBucket, cbf);
        }, function(data, cbf) {
          return ossClient.listObjects(testBucket, cbf);
        }
      ], function(err) {
        if (err) {
          throw err;
        } else {
          return done();
        }
      });
    });
  });

}).call(this);
