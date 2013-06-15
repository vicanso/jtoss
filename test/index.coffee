async = require 'async'
_ = require 'underscore'
OSSClient = require '../lib/client'
ossClient = new OSSClient 'Z8pQTAkCNNDAOPjt', 'z014NFAjKNLpvP07TSACKjNDgQDsqS'


describe 'Bucket functions: listBuckets, createBucket, deleteBucket', ->
  nextFunc = 'deleteBucket'
  testBucket = _.uniqueId 'vicanso'
  it 'should run without error', (done) ->
    async.waterfall [
      (cbf) ->
        ossClient.listBuckets cbf
      (buckets, cbf) ->
        result = _.find buckets, (bucket) ->
          bucket.name == testBucket
        if result
          ossClient.deleteBucket testBucket, cbf
          nextFunc = 'createBucket'
        else
          ossClient.createBucket testBucket, cbf
      (data, cbf) ->
        ossClient[nextFunc] testBucket, cbf
      (data, cbf) ->
        if nextFunc != 'deleteBucket'
          ossClient.deleteBucket testBucket, cbf
        else
          cbf null
    ], (err) ->
      if err
        throw err
      else
        done()

describe 'Bucket functions: getBucketAcl, setBucketAcl', ->
  it 'should run without error', (done) ->
    testBucket = _.uniqueId 'vicanso'
    async.waterfall [
      (cbf) ->
        ossClient.createBucket testBucket, cbf
      (data, cbf) ->
        ossClient.getBucketAcl testBucket, cbf
      (data, cbf) ->
        if data != 'private'
          cbf new Error 'get bucket acl fail'
        else
          ossClient.setBucketAcl testBucket, 'public-read', cbf
      (data, cbf) ->
        ossClient.getBucketAcl testBucket, cbf
      (data, cbf) ->
        if data != 'public-read'
          cbf new Error 'set bucket acl fail'
        else
          ossClient.deleteBucket testBucket, cbf
    ], (err) ->
      if err
        throw err
      else
        done()

describe 'Object functions: putObject, copyObject, updateObject updateObjectHeader deleteObject', ->
  it 'should run without error', (done) ->
    testBucket = _.uniqueId 'vicanso'
    async.waterfall [
      (cbf) ->
        ossClient.createBucket testBucket, cbf
      (data, cbf) ->
        ossClient.putObject testBucket, 'index.coffee', './index.coffee', {'Content-Encoding' : 'gzip'}, cbf
      (data, cbf) ->
        ossClient.getObject testBucket, 'index.coffee', cbf
      (data, cbf) ->
        if data.length < 100
          cbf new Error 'put object fail!'
        else
          ossClient.copyObject testBucket, 'copyindex.coffee', 'index.coffee', cbf
      (data, cbf) ->
        ossClient.updateObject testBucket, 'index.coffee', './index.js', cbf
      (data, cbf) ->
        ossClient.updateObjectHeader testBucket, 'index.coffee', {'Cache-Control' : 'public, maxage=300'}, cbf
      (data, cbf) ->
        ossClient.deleteObject testBucket, 'index.coffee', cbf
      (data, cbf) ->
        ossClient.deleteObject testBucket, 'copyindex.coffee', cbf
      (data, cbf) ->
        ossClient.deleteBucket testBucket, cbf
    ], (err) ->
      if err
        throw err
      else
        done()

describe 'Object functions: listObjects, listAllObjects', ->
  it 'should run without error', (done) ->
    testBucket = _.uniqueId 'vicanso'
    async.waterfall [
      (cbf) ->
        ossClient.createBucket testBucket, cbf
      (data, cbf) ->
        ossClient.updateObject testBucket, 'index.coffee', './index.js', cbf
      (data, cbf) ->
        ossClient.listObjects testBucket, cbf
      (data, cbf) ->
        ossClient.listAllObjects testBucket, cbf
    ], (err) ->
      if err
        throw err
      else
        done()   
