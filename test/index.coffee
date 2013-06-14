async = require 'async'
_ = require 'underscore'
OSSClient = require '../lib/client'
ossClient = new OSSClient 'Z8pQTAkCNNDAOPjt', 'z014NFAjKNLpvP07TSACKjNDgQDsqS'
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

# describe 'Bucket functions: getBucketAcl, setBucketAcl', ->
#   it 'should run without error', (done) ->
#     testBucket = _.uniqueId 'vicanso'
#     console.dir testBucket
#     async.waterfall [
#       (cbf) ->
#         ossClient.createBucket testBucket, cbf
#       (data, cbf) ->
#         ossClient.getBucketAcl testBucket, cbf
#       (data, cbf) ->
#         if data != 'private'
#           cbf new Error 'get bucket acl fail'
#         else
#           ossClient.setBucketAcl testBucket, 'public-read', cbf
#       (data, cbf) ->
#         ossClient.getBucketAcl testBucket, cbf
#       (data, cbf) ->
#         if data != 'public-read'
#           cbf new Error 'set bucket acl fail'
#         else
#           ossClient.deleteBucket testBucket, cbf
#     ], (err) ->
#       if err
#         throw err
#       else
#         done()

describe 'Object functions: putObject, copyObject, updateObject updateObjectHeader deleteObject', ->
  it 'should run without error', (done) ->
    testBucket = _.uniqueId 'vicanso'
    async.waterfall [
      (cbf) ->
        ossClient.createBucket testBucket, cbf
      (data, cbf) ->
        ossClient.putObject testBucket, 'index.coffee', './index.coffee', cbf
    ], (err) ->
      if err
        throw err
      else
        done()