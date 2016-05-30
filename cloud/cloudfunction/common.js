exports.actionFeed = {
	"ME_LIKE_FEED" : { "countKey" : "nLikes", "listKey" : "usersLiked", "points" : 4 } , 
	"ME_READ_FEED" : { "countKey" : "nRead", "listKey" : "usersRead", "points" : 4 } ,
	"ME_THUMB_UP_FEED" : { "countKey" : "nThumbUp", "listKey" : "usersThumbUp", "points" : 4 } ,
	"ME_THUMB_DOWN_FEED" : { "countKey" : "nThumbDown", "listKey" : "usersThumbDown", "points" : -4 } ,
	"ME_SHARE_FEED_INTENT" : { "countKey" : "nShares", "listKey" : "usersShared", "points" : 2 } ,
	"ME_SHARE_FB_INTENT" : { "countKey" : "nShares", "listKey" : "usersShared", "points" : 2 } ,
	"ME_SHARE_MSG_INTENT" : { "countKey" : "nShares", "listKey" : "usersShared", "points" : 2 } ,
	"ME_REPORT_FEED" : { "countKey" : "nReports", "listKey" : "usersReported", "points" : -20 } ,
	"ME_PUBLIC_PUSH_FEED" : { "countKey" : "nPushes", "listKey" : "usersPushed", "points" : 12 } ,
	"ME_ORDER_FEED" : { "countKey" : "nOrders", "listKey" : "ordersPosted", "points" : 0 } 

	};
exports.actionFeedEntry = {
	"ME_POST_FEED" : { "countKey" : "nPosts", "listKey" : null, "points" : 20 } ,
}
exports.actionComment = {
	"ME_COMMENT_FEED" : { "countKey" : "nComments", "listKey" : null, "points" : 7 } 
	};
exports.actionUser = {
	"ME_FOLLOW_USER" : { "countKey" : "nFollows", "listKey" : "usersFollowed", "points" : 40 } ,
	"ME_REPORT_USER" : { "countKey" : "nUserComplaints", "listKey" : "usersComplained", "points" : -20 }
	};
exports.actionMessage = {
	"ME_MESSAGE_USER" : { "countKey" : "nMessages", "listKey" : null, "points" : 2 } 
	};



exports.getFuncParallel = function(funcName) {
	return function(request, response){
		Parse.Cloud.useMasterKey();
		Parse.Promise.when(funcName()).then (function() {
			response.success("success");
		});
	};
};

exports.getFunc = exports.getFuncParallel;

exports.getFuncSeries = function(funcGroupName) {
	return function(request, response){
		Parse.Cloud.useMasterKey();		
		exports.foreach(funcGroupName(), function runArray(funcName) {
			console.log("run "+funcName);
			var promise = funcName();
			if (promise.length > 1) {
				return exports.foreach(promise, function runArray(funcName){
					console.log("  > run "+funcName);
					return funcName;
				});
			} else {
				return promise;
			}
		}).then(function(){
			response.success("success");
		});
	};
};


exports.foreach = function foreach(items, func) {
	Parse.Cloud.useMasterKey();

	var promise = Parse.Promise.as();
	for (var i = 0; i < items.length; i++) {
		var item = items[i];

		(function(item){
			promise = promise.then(function() {
			
				return func(item);
			});
		})(item);
	}
	return promise;
};

exports.forloop = function forloop(n, func) {
	Parse.Cloud.useMasterKey();
	var items = [];
	for (var i = 0; i < n; i++) {
		items.push(i);
	}
	return exports.foreach(items, function(item) {
		func(item);
	});
}



exports.saveArray = function saveArray(items) {
	return exports.foreach(items, function(item) {
		return item.save();
	});
}

function oldSaveArray(items) {
	Parse.Cloud.useMasterKey();

	var promise = Parse.Promise.as();
	for (var i = 0; i < items.length; i++) {
		var item = items[i];

		(function(item){
			promise = promise.then(function() {
				return item.save();
			});
		})(item);
	}
	return promise;
}

exports.getUserACL = function getUserACL(userId) {
	var acl = new Parse.ACL();
	acl.setPublicReadAccess(true);
	acl.setPublicWriteAccess(false);
	acl.setWriteAccess(userId, true);
	acl.setRoleWriteAccess("ContentModerator", true);
	return acl;
}

exports.getPublicACL = function getPublicACL(isWrite) {
	var acl = new Parse.ACL();
	acl.setPublicReadAccess(true);
	acl.setPublicWriteAccess(isWrite);
	return acl;
}

