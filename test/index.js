(function() {
  var OSSClient, async, ossClient, _;

  async = require('async');

  _ = require('underscore');

  OSSClient = require('../lib/client');

  ossClient = new OSSClient('akuluq6no78cynryy8nfbl23', 'k6k0jKekWlZn0ciqKLZr+mwrozo=');

  describe('Bucket functions: getBucketAcl, setBucketAcl', function() {
    return it('should run without error', function(done) {
      var testBucket;
      testBucket = _.uniqueId('vicanso');
      console.dir(testBucket);
      return async.waterfall([
        function(cbf) {
          return ossClient.createBucket(testBucket, cbf);
        }, function(data, cbf) {
          return ossClient.getBucketAcl(testBucket, cbf);
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
