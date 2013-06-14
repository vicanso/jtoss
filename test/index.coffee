async = require 'async'
_ = require 'underscore'
OSSClient = require '../lib/client'
ossClient = new OSSClient 'akuluq6no78cynryy8nfbl23', 'k6k0jKekWlZn0ciqKLZr+mwrozo='
# describe 'Bucket functions: listBuckets, createBucket, deleteBucket', ->
#   nextFunc = 'deleteBucket'
#   testBucket = _.uniqueId 'vicanso'
#   console.dir testBucket
#   it 'should run without error', (done) ->
#     async.waterfall [
#       (cbf) ->
#         ossClient.listBuckets cbf
#       (buckets, cbf) ->
#         result = _.find buckets, (bucket) ->
#           bucket.name == testBucket
#         if result
#           ossClient.deleteBucket testBucket, cbf
#           nextFunc = 'createBucket'
#         else
#           ossClient.createBucket testBucket, cbf
#       (data, cbf) ->
#         ossClient[nextFunc] testBucket, cbf
#       (data, cbf) ->
#         if nextFunc != 'deleteBucket'
#           ossClient.deleteBucket testBucket, cbf
#         else
#           cbf null
#     ], (err) ->
#       if err
#         throw err
#       else
#         done()

describe 'Bucket functions: getBucketAcl, setBucketAcl', ->
  it 'should run without error', (done) ->
    testBucket = _.uniqueId 'vicanso'
    console.dir testBucket
    async.waterfall [
      (cbf) ->
        ossClient.createBucket testBucket, cbf
      (data, cbf) ->
        ossClient.getBucketAcl testBucket, cbf
    #   (data, cbf) ->
    #     console.dir data.toString()
    #     ossClient.setBucketAcl testBucket, 'public-read', cbf
    #   (data, cbf) ->
    #     ossClient.deleteBucket testBucket, cbf
    ], (err) ->
      if err
        throw err
      else
        done()

# describe 'Object functions: putObject, copyObject, updateObject updateObjectHeader deleteObject', ->
#   it 'should run without error', (done) ->
#     testBucket = _.uniqueId 'osstest_'
#     async.waterfall [
#       (cbf) ->
#         ossClient.createBucket testBucket, cbf

#       (data, cbf) ->
#         ossClient.deleteBucket testBucket, cbf
#     ], (err) ->
#       if err
#         throw err
#       else
#         done()