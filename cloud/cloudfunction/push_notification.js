
/**
 * push notification
 */
Parse.Cloud.define("pushNotification", function(request, response) {
	var title = request.params.title;
	var alert = request.params.alert;
	var uri = request.params.uri;
	var from = request.params.from;
	var userIds = request.params.userIds;
	var action = request.params.action;
	var entryIdForComments = request.params.entryIdForComments;
	var channel = request.params.channel;
	var badge = "Increment"		
		
	if (entryIdForComments) {
		var FeedEntry = Parse.Object.extend("FeedEntry");
		var entryQuery = new Parse.Query(FeedEntry);
		entryQuery.equalTo("objectId", entryIdForComments);
		entryQuery.include("user");
		entryQuery.first().then(function(entry) {
			var FeedCommentEntry = Parse.Object.extend("FeedCommentEntry");
			var commentQuery = new Parse.Query(FeedCommentEntry);
			commentQuery.equalTo("entry", entry);
			commentQuery.include("user");
			commentQuery.find().then(function(comments) {
				var userIds = [];
				var entryOwnerId = entry.get("user").id;
				if (entryOwnerId != from) userIds.push(entryOwnerId);
				
				for (var i = 0; i<comments.length; i++) {
					var id = comments[i].get("user").id;
					if (id != from) userIds.push(id);
				}
				if (userIds.length > 0)
					push(response, from, userIds, title, alert, uri, channel, badge);
			});
		});
	} else {
		push(response, from, userIds, title, alert, uri, channel, badge);
	}
	
	
});

function push(response, from, userIds, title, alert, uri, channel, badge) {
	var pushQuery = new Parse.Query(Parse.Installation);
	if (userIds) {
		pushQuery.containedIn("userId", userIds);
		pushQuery.notEqualTo("userId", from);
	}
	
	pushQuery.equalTo("subscribeNotification", true);
	if (channel) pushQuery.containedIn("channels", [channel]);
	var interval = 60*60*24*2; 
	
	Parse.Push.send({
		where: pushQuery, 
		expiration_interval: interval,
		data: {
			title: title,
			alert: alert,
			uri: uri,
			badge: badge,
		}
	}, {
		success: function() {
			response.success("pushed");
		},
		error: function(error) {
			response.error(error);
		}
	});
}