(function() {
  var OSSClient, async, ossClient, _;

  async = require('async');

  _ = require('underscore');

  OSSClient = require('../lib/client');

  ossClient = new OSSClient('Z8pQTAkCNNDAOPjt', 'z014NFAjKNLpvP07TSACKjNDgQDsqS');

  describe('Object functions: putObject, copyObject, updateObject updateObjectHeader deleteObject', function() {
    return it('should run without error', function(done) {
      var testBucket;
      testBucket = _.uniqueId('vicanso');
      return async.waterfall([
        function(cbf) {
          return ossClient.createBucket(testBucket, cbf);
        }, function(data, cbf) {
          return ossClient.putObject(testBucket, 'index.coffee', './index.coffee', cbf);
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
