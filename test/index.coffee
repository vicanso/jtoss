async = require 'async'
_ = require 'underscore'
OSSClient = require '../lib/client'
ossClient = new OSSClient '', ''


describe 'Bucket functions: getService, createBucket, deleteBucket', ->
  nextFunc = 'deleteBucket'
  testBucket = _.uniqueId 'vicanso'
  it 'should run without error', (done) ->
    async.waterfall [
      (cbf) ->
        ossClient.getService cbf
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

describe 'Object functions: putObject, copyObject, updateObject updateObjectHeaders deleteObject', ->
  it 'should run without error', (done) ->
    testBucket = _.uniqueId 'vicanso'
    async.waterfall [
      (cbf) ->
        ossClient.createBucket testBucket, cbf
      (data, cbf) ->
        ossClient.putObjectFromFile testBucket, 'index.coffee', './index.coffee', {'Content-Encoding' : 'gzip'}, cbf
      (data, cbf) ->
        ossClient.getObject testBucket, 'index.coffee', cbf
      (data, cbf) ->
        if data.length < 100
          cbf new Error 'put object fail!'
        else
          ossClient.copyObject testBucket, 'index.coffee', testBucket, 'copyindex.coffee', cbf
      (data, cbf) ->
        ossClient.updateObjectFromFile testBucket, 'index.coffee', './index.js', cbf
      (data, cbf) ->
        ossClient.updateObjectHeaders testBucket, 'index.coffee', {'Cache-Control' : 'public, maxage=300'}, cbf
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

describe 'Object functions: listBucket, listObjects', ->
  it 'should run without error', (done) ->
    testBucket = _.uniqueId 'vicanso'
    async.waterfall [
      (cbf) ->
        ossClient.createBucket testBucket, cbf
      (data, cbf) ->
        ossClient.updateObjectFromFile testBucket, 'index.coffee', './index.js', cbf
      (data, cbf) ->
        ossClient.listBucket testBucket, cbf
      (data, cbf) ->
        ossClient.listObjects testBucket, cbf
    ], (err) ->
      if err
        throw err
      else
        done()   
