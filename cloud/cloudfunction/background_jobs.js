var common = require('cloud/cloudfunction/common.js');

/**
 * count
 */
Parse.Cloud.define("countEditionParallel", function(request, response) {
	var FeedEntry = Parse.Object.extend("FeedEntry");
	var Edition = Parse.Object.extend("Edition");
	var queryEditionName = new Parse.Query(Edition);
	var resultStr = "";
	
	queryEditionName.find().then( function(editions) {
		var promises = [];
		for (var i = 0; i < editions.length; i++) {
			var edition = editions[i];
			(function(edition){
				var query = new Parse.Query(FeedEntry);
				query.equalTo("edition", edition);
				promises.push(query.count().then(function(count) {
					edition.set("count", count);
					return edition.save();
				},function(error) {
					response.error(error);
				}));
			})(edition);			
		};
		
		return Parse.Promise.when(promises);	
	}).then (function() {
		response.success("success" + resultStr);
	});
});


Parse.Cloud.define("countEditionSeries", function(request, response) {
	countKeys("Edition", "edition", response, false);
});

Parse.Cloud.job("countEditionSeries", function(request, response) {
  	Parse.Cloud.useMasterKey();
	countKeys("Edition", "edition", response, false);	
});

Parse.Cloud.define("countHashtagSeries", function(request, response) {
	countKeys("Hashtag", "hashtags", response, true);
});

Parse.Cloud.job("countHashtagSeries", function(request, response) {
  	Parse.Cloud.useMasterKey();
	countKeys("Hashtag", "hashtags", response, true);	
});

function countKeys(className, keyName, response, isContains){
	var FeedEntry = Parse.Object.extend("FeedEntry");
	var Key = Parse.Object.extend(className);
	var queryKeyName = new Parse.Query(Key);
	var resultStr = "";
	
	queryKeyName.find().then( function(keys) {
		return common.foreach(keys, function(key){
			var query = new Parse.Query(FeedEntry);
			if (!key.get("isAll")){
				if (isContains)
					query.containedIn(keyName, [key]);
				else
					query.equalTo(keyName, key);
			}
			
			return query.count().then(function(count) {
				key.set("count", count);
				return key.save();
			});
		});
	}).then (function() {
		response.success("success");
	});
}


Parse.Cloud.define("axp", function(request, response) {
  	Parse.Cloud.useMasterKey();
  	
	var UserFeedback = Parse.Object.extend("UserFeedback");
	var query = new Parse.Query(UserFeedback);
	query.greaterThan("nPosts", 0);
	
	query.find().then( function(feedbacks) {
		var promise = Parse.Promise.as();
		for (var i = 0; i < feedbacks.length; i++) {
			var feedback = feedbacks[i];

			(function(feedback){
				promise = promise.then(function() {
					feedback.set("axp", getObjectXp(feedback) / feedback.get("nPosts"));
					return feedback.save();
				});
			})(feedback);
		};
		return promise;	
	}).then (function() {
		response.success("success");
	});
});

//weighted xp value for each article
//mimic axp and axp_recent5 function, 
//for each user in FeedEntry.usersThumbUp
//  userXp = user id -> User -> UserFeedback.xp
//  s += getWeight(userXp);
//FeedEntry.wxp = s;
//UserFeedback.wxp = sum(feedEntry.wxp)

Parse.Cloud.define("wxp", function(request, response) {
  	Parse.Cloud.useMasterKey();
  	
	var UserFeedback = Parse.Object.extend("UserFeedback");
	var query = new Parse.Query(UserFeedback);
	query.greaterThan("nPosts", 0);
	
	query.find().then( function(feedbacks) {
		var promise = Parse.Promise.as();
		for (var i = 0; i < feedbacks.length; i++) {
			var feedback = feedbacks[i];

			(function(feedback){
				promise = promise.then(function() {
					feedback.set("axp", getObjectXp(feedback) / feedback.get("nPosts"));
					return feedback.save();
				});
			})(feedback);
		};
		return promise;	
	}).then (function() {
		response.success("success");
	});
});

Parse.Cloud.define("axp_recent5", function(request, response) {
  	Parse.Cloud.useMasterKey();
  	var recentCount = 5;
	var userQuery = new Parse.Query("User");
	var feedbackQuery = new Parse.Query("UserFeedback");
	feedbackQuery.greaterThan("nPosts", 0);
	userQuery.matchesQuery("userFeedback", feedbackQuery);
	userQuery.include("userFeedback");
	
	userQuery.find().then( function(users) {
		return common.foreach(users, function(user) {
			var query = new Parse.Query("FeedEntry");
			query.equalTo("user", user);
			query.descending("createdAt");
			query.limit(recentCount);
			
			return query.find().then(function(entries) {
				var xp = 0.0;
				var n = entries.length;
				for (var j = 0; j < n; j++) {
					xp += entries[j].get("xp");
				}
				//make the axp smaller if there are only 1 or 2 posts in total
				user.set("axp_recent5", n == 0 ? 0 : xp / Math.max(n, 3));
				console.log(user);
				return user.save();
			});
		});
	}).then (function() {
		response.success("success");
	});
});

//not in use
function getObjectXp(object) {
	var xp = 0.0;
	if (object.has("nComments")) xp += object.get("nLikes") * 2;
	if (object.has("nLikes")) xp += object.get("nLikes") * 2;
	if (object.has("nThumbUp")) xp += object.get("nThumbUp");
	if (object.has("nThumbDown")) xp -= object.get("nThumbDown");
	return xp;
}
