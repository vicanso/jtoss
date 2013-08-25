_ = require 'underscore'
Client = require '../lib/client'
client = new Client 'akuluq6no78cynryy8nfbl23', 'k6k0jKekWlZn0ciqKLZr+mwrozo='

progress = ->
  console.dir arguments

files = [
  '/Users/tree/Downloads/办业务_报价回购权限设置_关闭权限.psd'
  '/Users/tree/Downloads/办业务_报价回购权限设置_开通权限01.psd'
  '/Users/tree/Downloads/办业务_退市股票权限设置_开通权限02.psd'
]

client.putObjectFromFileList 'jenny', files, {progress : progress}, (err, data) ->
  console.dir 'complete'
  console.dir err
  console.dir data


app = require('express')()

app.listen 10000


# client.uploadLargeFile 'jenny', 'Firefox-latest.dmg', '/Users/tree/Downloads/Firefox-latest.dmg', {progress : progress}, (err, data) ->
#   console.dir 'complete'
#   console.dir err
#   console.dir data

# client.listAllMyBuckets (err, data) ->
#   console.dir data
# client.getBucketAcl 'jennytest', (err, data) ->
#   console.dir data
# client.listBucket 'jennytest', {'max-keys' : 1000}, (err, data) ->
#   items = _.pluck data.items, 'name'
#   client.deleteObjects 'jennytest', items, (err, data) ->
#     console.dir err
# client.putBucket 'vicanso11', (err) ->
#   console.dir err


# client.deleteBucket 'vicanso11', (err, data) ->
#   console.dir err
#   console.dir data

# not pass
# client.putBucketWithLocation 'vicanso021', 'vicanso.com', (err, data) ->
#   console.dir err
#   console.dir data



# client.putObjectFromString 'vicanso11', 'test.txt', '我的测试', (err, data) ->
#   console.dir err
#   console.dir data
# client.putObjectFromString 'vicanso11', 'testgzip.txt', '我的测试内容我的测试内容我的测试内容我的测试内容我的测试内容我的测试内容', {'Content-Encoding' : 'gzip'}, (err, data) ->
#   console.dir err
#   console.dir data

# client.putObjectFromFile 'vicanso11', 'juniversalchardet.zip', './juniversalchardet.zip', (err, data) ->
#   console.dir err
#   console.dir data

# client.getObject 'vicanso11', 'juniversalchardet.zip', (err, data) ->
#   console.dir err
#   console.dir data.length

# client.getObjectToFile 'vicanso11', 'juniversalchardet.zip', './test.zip', (err, data) ->
#   console.dir err
#   console.dir data

# client.deleteObject 'vicanso11', 'test.txt', (err, data) ->
#   console.dir err
#   console.dir data

# client.headObject 'vicanso11', 'juniversalchardet.zip', (err, data) ->
#   console.dir err
#   console.dir data

# client.copyObject 'vicanso11', 'juniversalchardet.zip', 'vicansonovel', 'copy.zip', (err, data) ->
#   console.dir err
#   console.dir data

# not pass
# client.listObjects 'jennytest', {'max-keys' : 2}, (err, data) ->
#   console.dir err
#   console.dir data.length

# client.listObjects 'jennytest', {'max-keys' : 10}, (err, data) ->
#   console.dir err
#   console.dir data.length

# console.dir client.signUrlAuthWithExpireTime 'GET', 'http://vicanso11.oss.aliyuncs.com', {}, '/juniversalchardet.zip'
# progress = ->
#   console.dir arguments
# client.uploadLargeFile 'jennytest', 'test.zip', '/Users/Tree/test.zip', {progress : progress}, (err, data) ->
#   console.dir err
#   console.dir data


# client.sync 'jennytest', 'test', 'e:\\test', (err, info) ->
# 	console.dir info.dirs.length
# 	console.dir info.files.length
# 	console.dir info.largeFiles


# client.putObjectFromPath 'jenny', 'test', '/Users/Tree/tmp', (file, done) ->
#   console.dir "#{file} #{done}"
# ,(err, info) ->
#   console.dir arguments

# client.watch 'jenny', 'a', '/Users/Tree/tmp', ->
#   console.dir arguments
