# jtoss - node.js的aliyun oss客户端

##API
- [constructor] (#constructor)
- [listAllMyBuckets] (#listAllMyBuckets)
- [getBucketAcl] (#getBucketAcl)
- [setBucketAcl] (#setBucketAcl)
- [listBucket] (#listBucket)
- [isModified] (#isModified)
- [putBucket] (#putBucket)
- [deleteBucket] (#deleteBucket)
- [putObjectWithData] (#putObjectWithData)
- [putObjectFromFile] (#putObjectFromFile)
- [putObjectFromFileList] (#putObjectFromFileList)
- [putObjectFromFd] (#putObjectFromFd)
- [putObjectFromFileGivenPos] (#putObjectFromFileGivenPos)
- [updateObjectFromFile] (#updateObjectFromFile)
- [getObject] (#getObject)
- [getObjectToFile] (#getObjectToFile)
- [deleteObject] (#deleteObject)
- [headObject] (#headObject)
- [uploadLargeFile] (#uploadLargeFile)
- [listParts] (#listParts)
- [updateObjectHeaders] (#updateObjectHeaders)
- [copyObject] (#copyObject)
- [getUploadId] (#getUploadId)
- [getAllMultipartUploads] (#getAllMultipartUploads)
- [cancelUpload] (#cancelUpload)
- [deleteObjects] (#deleteObjects)
- [listObjects] (#listObjects)

<a name="constructor" />
## constructor
### 返回一个Oss Client的实例

### 参数列表
- accessId oss的access id
- accessKey oss的access key
- host oss的host，默认为oss.aliyuncs.com
- port 端口号，默认为80
- timeout 超时时间（单位秒），默认为60，如果请求是post，且数据大于20KB，则该字段无效
- retryTimes 重试次数，默认为2·

```js
var JTOss = require('jtoss');
var ossClient = new JTOss(ACCESS_ID, ACCESS_KEY);
```

<a name="listAllMyBuckets" />
## listAllMyBuckets
### 列出所有的buckets

### 参数列表
- cbf 回调函数(err, [{name : 'xxx', createdAt : 'xxx'}])

```js
ossClient.listAllMyBuckets(function(err, buckets){
  console.dir(buckets);
});
```


<a name="getBucketAcl" />
## getBucketAcl
### 获取bucket的访问控制权限

### 参数列表
- bucket bucket名
- cbf 回调函数(err, 'private'|'public-read'|'publick-read-write')

```js
ossClient.getBucketAcl('vicanso', function(err, acl){
  console.dir(acl);
});
```


<a name="setBucketAcl" />
## setBucketAcl
### 设置bucket的访问控制权限

### 参数列表
- bucket bucket名
- acl bucket控制权限，可选值有：'private', 'public-read', 'publick-read-write'
- cbf 回调函数(err)

```js
ossClient.setBucketAcl('vicanso', 'private', function(err){
  console.dir(err);
});
```


<a name="listBucket" />
## listBucket
### 列出bucket中的objects

### 参数列表
- bucket bucket名
- params 参数{delimiter : String, marker : String, max-keys : Integer, prefix : String}
- cbf 回调函数(err, {marker : String, items : Array})

```js
ossClient.listBucket('vicanso', {max-keys : 1000}, function(err, data){
  console.dir(data);
});
```


<a name="isModified" />
## isModified
### 判断object与其对应的文件是否一致（通过比较它们的ETag）

### 参数列表
- bucket bucket名
- object oss中的object
- fileName 本地文件
- cbf 回调函数(err, Boolean)


```js
ossClient.isModified('vicanso', 'index.coffee', './index.coffee', function(err, isModified){
  console.dir(isModified);
});
```


<a name="putBucket" />
## putBucket
### 创建bucket

### 参数列表
- bucket bucket名
- acl 访问权限，可选参数
- cbf 回调函数(err)

```js
ossClient.putBucket('vicanso', 'private', function(err){
  console.dir(err);
});
```


<a name="deleteBucket" />
## deleteBucket
### 删除bucket

### 参数列表
- bucket bucket名
- cbf 回调函数(err)

```js
ossClient.deleteBucket('vicanso', function(err){
  console.dir(err);
});
```


<a name="putObjectWithData" />
## putObjectWithData
### 上传Object

### 参数列表
- bucket bucket名
- object oss的object
- content 上传的数据 String|Buffer
- headers object的response headers，可选参数
- params oss的配置参数，可选参数
- cbf 回调函数(err)

```js
ossClient.putObjectWithData('vicanso', 'test.txt', '测试文件的内容', function(err){
  console.dir(err);
});
```


<a name="putObjectFromFile" />
## putObjectFromFile
### 从文件中中上传Object

### 参数列表
- bucket bucket名
- object oss的object
- fileName 上传的文件
- headers object的response headers，可选参数
- params oss的配置参数，可选参数
- cbf 回调函数(err)


```js
ossClient.putObjectFromFile('vicanso', 'test.txt', './localfile.txt', function(err){
  console.dir(err);
});
```


<a name="putObjectFromFileList" />
## putObjectFromFileList
### 从文件列表中上传Object

### 参数列表
- bucket bucket名
- files 要上传的文件列表
- headers object的response headers，可选参数
- params oss的配置参数，可选参数
- cbf (err)

```js
ossClient.putObjectFromFileList('vicanso', ['./index.coffee', './测试.txt'], function(err){
  console.dir(err);
});
```


<a name="putObjectFromFd" />
## putObjectFromFd
### 从fd中获取数据上传到Object

### 参数列表
- bucket bucket名
- object oss的object
- fd node.js的fd
- headers object的response headers，可选参数
- params oss的配置参数，可选参数
- cbf (err)

```js
fs.open('./index.coffee', 'r', function(err, fd){
  ossClient.putObjectFromFd('vicanso', 'index.coffee', fd, function(err){
    console.dir(err);
    fs.close(fd);
  })
});
```


<a name="putObjectFromFileGivenPos" />
## putObjectFromFileGivenPos
### 从指定文件中指定位置获取固定的数据上传（主要用于大文件上传）

### 参数列表
- bucket bucket名
- object oss的object
- fileName 本地文件
- offset 读取开始的位置
- partSize 读取的大小
- headers object的response headers，可选参数
- params oss的配置参数，可选参数
- cbf (err)

```js
ossClient.putObjectFromFileGivenPos('vicanso', 'test.dat', './test.dat', 1000, 500, function(err){
  console.dir(err);
});
```


<a name="updateObjectFromFile" />
## updateObjectFromFile
### 根据指定的文件更新object，先调用isModified判断是否已修改，如果已修改，则调用putObjectFromFile

### 参数列表
- bucket bucket名
- object oss的object
- fileName 本地文件
- headers object的response headers，可选参数
- params oss的配置参数，可选参数
- cbf (err)

```js
ossClient.updateObjectFromFile('vicanso', 'index.coffee', './index.coffee', function(err){
  console.dir(err);
});
```


<a name="getObject" />
## getObject
### 获取object

### 参数列表
- bucket bucket名
- object oss的object
- headers object的response headers，可选参数
- params oss的配置参数，可选参数
- cbf (err, Buffer)

```js
ossClient.getObject('vicanso', 'index.coffee', function(err, buf){
  console.dir(buf.length);
});
```


<a name="getObjectToFile" />
## getObjectToFile
### 获取object保存到本地文件

### 参数列表
- bucket bucket名
- object oss的object
- fileName 本地文件名
- headers object的response headers，可选参数
- params oss的配置参数，可选参数
- cbf (err)

```js
ossClient.getObjectToFile('vicanso', 'index.coffee', './index.coffee', function(err){
  console.dir(err);
});
```


<a name="deleteObject" />
## deleteObject
### 删除Object，如果Object是目录，删除该目录下的所有Object

### 参数列表
- bucket bucket名
- object oss的object
- cbf (err)
```js
ossClient.deleteObject('vicanso', 'index.coffee', funciont(err){
  console.dir(err);
})
```


<a name="headObject" />
## headObject
### 获取或修改object的headers，若修改的Object是目录，则会对该目录的所有object都修改

### 参数列表
- bucket bucket名
- object oss的object
- headers 有该参数表示修改，无该参数表示获取
```js
ossClient.headObject('vicanso', 'index.coffee', function(err, headers){
  console.dir(headers);
});
```


<a name="uploadLargeFile" />
## uploadLargeFile
### 大文件上传

### 参数列表
- bucket bucket名
- object oss的object
- fileName 本地文件名
- headers object的response headers，可选参数
- params oss的配置参数，可选参数
- cbf (err)
```js
ossClient.uploadLargeFile('vicanso', 'test.dat', './test.dat', function(err){
  console.dir(err);
})
```


<a name="listParts" />
## listParts
### 列出已上传的part

### 参数列表
- bucket bucket名
- object oss的object
- params {uploadId : String} 必须有该字段标记是哪一个upload
- cbf (err, {isTruncated : Boolean, partNumberMarker : Integer, nextPartNumberMarker : Integer, parts : Array})

```js
ossClient.listParts('vicanso', 'test.dat', {uploadId : xxx}, function(err, result){
  console.dir(result);
});
```


<a name="updateObjectHeaders" />
## updateObjectHeaders
### 更新当前Object的response headers

### 参数列表
- bucket bucket名
- object oss的object
- headers object的response headers

```js
ossClient.updateObjectHeaders('vicanso', 'index.coffee', {'Cache-Control' : 'public, maxage=300'}, function(err){
  console.dir(err);
});
```


<a name="copyObject" />
## copyObject
### 复制object

### 参数列表
- sourceBucket 源bucket
- sourceObject 源object
- targetBucket 目标bucket
- targetObject 目标object
- headers 目标object的headers，可选参数
- cbf (err)


```js
ossClient.copyObject('vicanso', 'index.coffee', 'vicanso', 'copy.coffee', function(err){
  console.dir(err);
});

```

<a name="getUploadId" />
## getUploadId
### 获取upload的id

### 参数列表
- bucket bucket名
- object oss的object
- cbf (err, uploadId)

```js
ossClient.getUploadId('vicanso', 'test.dat', function(err, uploadId){
  console.dir(uploadId);
});
```


<a name="getAllMultipartUploads" />
## getAllMultipartUploads
### 获取该bucket下的所有分块上传信息

### 参数列表
- bucket bucket名
- params oss的配置参数，可选参数
- cbf (err, Object)

```js
ossClient.getAllMultipartUploads('vicanso', function(err, infos){
  
})
```



<a name="cancelUpload" />
## cancelUpload
### 取消上传

### 参数列表
- bucket bucket名
- object oss的object
- params oss的配置参数，可选参数
- cbf (err)
```js
ossClient.cancelUpload('vicanso', 'test.dat', function(err){
  console.dir(err);
});
```


<a name="deleteObjects" />
## deleteObjects
### 批量删除objects

### 参数列表
- bucket bucket名
- objList 要删除的object列表
- params oss的配置参数，可选参数
- cbf (err)

```js
ossClient.deleteObjects('vicanso', ['test.dat', 'index.coffee'], function(err){
  console.dir(err);
});
```


<a name="listObjects" />
## listObjects
### 列出所有的object

### 参数列表
- bucket bucket名
- params oss的配置参数，可选参数
- cbf (err, Array)

```js
ossClient.listObjects('vicanso', function(err, items){
  console.dir(items.length);
});
```