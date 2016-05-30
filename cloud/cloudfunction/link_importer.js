var Image = require('parse-image');

/**
 * import link
 */
Parse.Cloud.define("importLink", function(request, response) {
	var linkUrl = request.params.url;
	var maxImageSize = request.params.maxImageSize;
	var maxThumbSize = request.params.maxThumbSize;
	
	getHtml(linkUrl, function(html) {
		var title = findTitleStr(html);
		console.log(title);
		var imageUrl = findOGImageUrl(html);
		if (imageUrl) {
			return getImage(imageUrl, maxImageSize, maxThumbSize, function(bytes, bytesThumb) {
				response.success({title: title, bytes: bytes, bytesThumb: bytesThumb});
			});
		} else {
			response.success({title: title, bytes: [], bytesThumb: []});
		}
	});
});

function getHtml(url, callback) {
	var httpOptions = {
        followRedirects: true,
        url: url
    };
	Parse.Cloud.httpRequest(httpOptions).then(function(httpResponse) {
		// success
		var html = httpResponse.text;
		callback(html);
	});
}

   
function findStringRegex(src, pattern) {
	var matches = src.match(pattern);
	if (matches)  return matches[1].trim();
	else return null;
}

var TITLE_START_STRINGS   = ["<head", "<title>"];
var TITLE_END_STRING      = "</title>";
function findTitleStr( src) {
	var str = findOGTitle1(src);
	if (str == null) str = findOGTitle2(src);
	if (str == null) str = findString(src, TITLE_START_STRINGS, TITLE_END_STRING);
	if (str == null) str = src;
	//str = unescape(str); does not work
	return str;
}
    
function findOGTitle1( src) {
    var pattern = "<meta[^>]+property[^>]+og:title[^>]+[\\s]content\\s*=\\s*[\"]([^\"]+)[\"][^>]*>";
    return findStringRegex(src, pattern);
}

function findOGTitle2( src) {
	var pattern = "<meta[^>]+property[^>]+og:title[^>]+[\\s]content\\s*=\\s*[']([^']+)['][^>]*>";
	return findStringRegex(src, pattern);
}
    
function findString(src, startStrs, endString) {
	var n = startStrs.length;
	var index = 0;
	var featureStr = "";
	for (var i = 0; i < n; i++) {
		featureStr = startStrs[i];
		index = src.indexOf(featureStr, index);
		if (index < 0) return null;
	}
	index += featureStr.length;

	var indexEnd = src.indexOf(endString, index);
	if (indexEnd < 0) return null;

	return src.substring(index, indexEnd);
}

 
function getImage(url, maxImageSize, maxThumbSize, callback) {
	var imageBuffer;
	var originalImage;
	Parse.Cloud.httpRequest({ url: url }).then(function(response) {
		var image = new Image();
	  	return image.setData(response.buffer);
	}).then(function(image) {
		originalImage = image;
		var ratio = image.width() / image.height();
		if (ratio > 1) {
			var height = Math.min(maxImageSize, image.height());
	  		return image.scale({ width: height * ratio, height: height });
	  	} else {
	  		var width = Math.min(maxImageSize, image.width());
		  	return image.scale({ width: width, height: width / ratio});
		}
	}).then(function(image) {
		return image.data();
	}).then(function(buffer) {
		imageBuffer = buffer;
		var ratio = originalImage.width() / originalImage.height();
		if (ratio > 1) {
			var height = Math.min(maxThumbSize, originalImage.height());
	  		return originalImage.scale({ width: height * ratio, height: height });
	  	} else {
	  		var width = Math.min(maxThumbSize, originalImage.width());
		  	return originalImage.scale({ width: width, height: width / ratio});
		}
	}).then(function(image) {
		return image.data();
	}).then(function(thumbBuffer) {
		var bytes = imageBuffer.toString("base64");
	  	var bytesThumb = thumbBuffer.toString("base64");
		callback(bytes, bytesThumb);
	}); 
}



function findOGImageUrl( src) {
        var pattern = "<meta[^>]+property[^>]+og:image[^>]+[\\s]content\\s*=\\s*['\"]([^'\"]+)['\"][^>]*>";
        
        return findStringRegex(src, pattern);
}
 