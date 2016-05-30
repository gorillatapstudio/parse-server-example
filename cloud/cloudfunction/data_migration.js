var common = require('./common.js');
var integrity = require('./data_integrity.js');

/**
 * data migration
 */
exports.bigMigrationSeries = function() {
	return [
		exports.copyKeyWithinClass,
		exports.newKeyWithinClass,
		exports.copyFeedbackKey,
		exports.copyBetweenClasses,
		exports.addFakeThumbUpDownObjects,
		exports.changeACL,
		
		integrity.deleteGhostObject,
		integrity.ensureFeedbacks,
		
		exports.tableToArray,
		exports.arrayToCount,
		exports.sumFeedCountToUserFeedback,
		exports.getXP,
		exports.copyXPToParent,
	];
}

exports.recomputeFeedbackPoints = function() {
	return [
		exports.clearClass,
		exports.changeACL,
		integrity.deleteGhostObject,
		integrity.ensureFeedbacks,
		
		exports.tableToArray,
		exports.arrayToCount,
		exports.sumFeedCountToUserFeedback,
		exports.getXP,
		exports.copyXPToParent,
	];
}
 
exports.clearClass = function() {
	return clearClass("ActorActionFeed");
};

function clearClass(className){	
	var query = new Parse.Query(className);
	query.limit(1000);
	query.descending("createdAt");
	return query.find().then(function(entries) {
		return common.foreach(entries, function(entry) {
			return entry.destroy();
		});
	});
};

exports.changeACL = function() {
	return [changeACL("FeedEntryFeedback"), changeACL("UserFeedback"), changeACL("CommentFeedback")];
}

function changeACL(className){
	var query = new Parse.Query(className);
	query.limit(1000);
	query.descending("createdAt");
	return query.find().then(function(feedbacks) {
		return common.foreach(feedbacks, function(feedback) {
			feedback.setACL(common.getPublicACL(false));
			return feedback.save();
		});
	});
};

exports.copyKeyWithinClass = function() {
	return copyKeyWithinClass("User", "feedback", "userFeedback");
};

function copyKeyWithinClass(className, oldKey, newKey){	
	var query = new Parse.Query(className);
	query.limit(1000);
	query.descending("createdAt");
	return query.find().then(function(entries) {
		var newEntries = [];
		for (var i = 0; i < entries.length; i++) {
			var entry = entries[i];

			if (entry.get(oldKey) && ! entry.get(newKey)) {
				entry.set(newKey, entry.get(oldKey));
				newEntries.push(entry);
			}
		}
		return common.saveArray(newEntries);	
	});
};


exports.newKeyWithinClass = function() {
	//newKeyWithinClass("FeedEntry", "imageFile", "photoFiles", response);
	//newKeyWithinClass("User", ["pinOrder"], [0], response);
	return newKeyWithinClass("UserFeedback", ["parentClassName"], ["User"]);
};

function newKeyWithinClass(className, newKeys, defaultValues){
	var clazz = Parse.Object.extend(className);
	var resultStr = "";
	
	var query = new Parse.Query(clazz);
	query.limit(1000);
	query.descending("createdAt");
	return query.find().then(function(entries) {
			var newEntries = [];
			for (var i = 0; i < entries.length; i++) {
				var entry = entries[i];
				var isModified = false;
				for (var j = 0; j < newKeys.length; j++) {
					if (entry.get(newKeys[j]) == null) {
						entry.set(newKeys[j], defaultValues[j]);
						isModified = true;
					}
				}
				if (isModified) newEntries.push(entry);
			}
			return common.saveArray(newEntries);
			
	});
};


exports.copyFeedbackKey = function() {
	return copyFeedbackKey("User", "userFeedback", ["xp", "axp_recent5", "currentEdition", "nextUserLevel"]);
};

function copyFeedbackKey(className, feedbackKey, keysToCopy){
	var FeedEntry = Parse.Object.extend(className);
	var resultStr = "";
	
	var query = new Parse.Query(FeedEntry);
	query.limit(1000);
	query.descending("createdAt");
	query.include(feedbackKey);
	
	return query.find().then(function(entries) {
			var newEntries = [];
			for (var i = 0; i < entries.length; i++) {
				var entry = entries[i];
				var feedback = entry.get(feedbackKey);
				for (var j= 0; j<keysToCopy.length; j++) {
					var key = keysToCopy[j];
					if (!entry.get(key) && feedback.get(key)) {
						entry.set(key, feedback.get(key));
						newEntries.push(entry);
					}
				}
			}
			return common.saveArray(newEntries);
			
	});
};

//copy like entry to actionactionfeed and add action field
exports.copyBetweenClasses = function() {
	return [
		copyBetweenClasses("LikeEntry", "ActorActionFeed", ["user", "entry"], ["user", "entry"], ["action"], ["ME_LIKE_FEED"]),
		copyBetweenClasses("FollowEntry", "ActorActionUser", ["user", "entry"], ["user", "entry"], ["action"], ["ME_FOLLOW_USER"]),
	];
};

function copyBetweenClasses(classNameFrom, classNameTo, keysToCopy, newKeys, extraKeys, extraValues) {
	var ClazzTo = Parse.Object.extend(classNameTo);
	var ClazzFrom = Parse.Object.extend(classNameFrom);
	
	var query = new Parse.Query(ClazzFrom);
	query.limit(1000);
	query.descending("createdAt");
	query.include("user");
	
	return query.find().then(function(entries) {
		var newEntries = [];
		return common.foreach(entries, function(entry) {
			var queryTo = new Parse.Query(ClazzTo);
			for (var t = 0; t < newKeys.length; t++) {
				var object = (keysToCopy[t].localeCompare("self") == 0) ? entry : entry.get(keysToCopy[t]);
				queryTo.equalTo(newKeys[t], object);
			}
			return queryTo.first().then(function(item){
				if (item == null) {
					var newEntry = new ClazzTo();
					for (var j= 0; j<keysToCopy.length; j++) {
						var object = (keysToCopy[j].localeCompare("self") == 0) ? entry : entry.get(keysToCopy[j]);
						newEntry.set(newKeys[j], object);
					}
					for (var k = 0; k < extraKeys.length; k++) {
						newEntry.set(extraKeys[k], extraValues[k]);
					}
					var userId = entry.get("user").id;
					newEntry.setACL(common.getUserACL(userId));
					return newEntry.save();
				}
			});
		});
	});
};

//add fake thumbup/down
exports.addFakeThumbUpDownObjects = function() {
	return addFakeThumbUpDownObjects("cp1@gmail.com", "FeedEntry", "ActorActionFeed", common.actionFeed, ["ME_THUMB_UP_FEED", "ME_THUMB_DOWN_FEED"]);
};

function addFakeThumbUpDownObjects(userName, classNameFrom, classNameTo, actions, actionKeys) {	
	var ClazzTo = Parse.Object.extend(classNameTo);
	var userQuery = new Parse.Query("User");
	userQuery.equalTo("username", userName);
	return userQuery.first().then(function(user) {
		var query = new Parse.Query(classNameFrom);
		query.limit(1000);
		query.descending("createdAt");
		query.include("entryFeedback");
	
		return query.find().then(function(entries) {
			return common.foreach(entries, function(entry) {
				var feedback = entry.get("entryFeedback");
				return common.foreach(actionKeys, function(actionKey) {
					var action = actions[actionKey];
					var count = feedback.get(action["countKey"]);
					if (count != null && count > 0) {
						var queryTo = new Parse.Query(classNameTo);
						queryTo.equalTo("user", user);
						queryTo.equalTo("action", actionKey);
						queryTo.equalTo("entry", entry);
						return queryTo.find().then(function(items){
							var n = count - items.length;
							return common.forloop(n, function(i) {
								var item = new ClazzTo();
								item.set("user", user);
								item.set("action", actionKey);
								item.set("entry", entry);
								item.setACL(common.getUserACL(user.id));

								return item.save();
							});
						});
					}
				});	
			});
		});
	});
};

//ActorActionFeed/User -> FeedEntry.usersLike/...
exports.tableToArray = function() {
	return [
		tableToArray("ActorActionFeed", "FeedEntryFeedback", "entry", "entryFeedback", "entry.entryFeedback", "user", common.actionFeed),
		tableToArray("ActorActionUser", "UserFeedback", "entry", "userFeedback", "user.userFeedback", "user", common.actionUser),
		tableToArray("ActorActionComment", "CommentEntryFeedback", "entry", "commentFeedback", "entry.commentFeedback","user",  common.actionFeed),
		//FeedEntry and commentEntry are special 
		tableToArray("FeedEntry", "UserFeedback", "user", "userFeedback", "user.userFeedback", "self", common.actionFeedEntry),
		tableToArray("FeedCommentEntry", "FeedEntryFeedback", "entry", "entryFeedback", "entry.entryFeedback", "self",  common.actionComment),
		tableToArray("UserMessageEntry", "UserFeedback", "entry", "userFeedback", "entry.userFeedback", "self", common.actionMessage),
	];
};

//ActorActionFeed.entry.entryFeedback.get(actionFeed[self.action]) = self.user
function tableToArray(tableClassName, feedbackClassName, feedbackParentKey, feedbackKey, feedbackIncludeKey, objectKeyInArray, actions ) {
	var ClazzTable = Parse.Object.extend(tableClassName);
	var ClazzFeedback = Parse.Object.extend(feedbackClassName);
	//console.log("tabletToArray: " + tableClassName);
	return resetFeedback(feedbackClassName, actions).then(function() {
		var query = new Parse.Query(ClazzTable);
		query.limit(1000);
		query.descending("createdAt");
		query.include("user");
		query.include("entry");
		query.include(feedbackIncludeKey);
		
		return query.find().then(function(items) {
			var newFeedbacks = {};
			return common.foreach(items, function(item) {
				var action = integrity.getAction(item, actions);
				integrity.addItemToListWithIntegrityCheck(item, tableClassName, feedbackParentKey, feedbackKey, objectKeyInArray, action, newFeedbacks);
			}).then(function() {
				return common.foreach(Object.keys(newFeedbacks), function(key) {
					newFeedbacks[key].save();
				});
			});
		});
	});
};



function resetFeedback(clazzFeedback, actions) {
	var query = new Parse.Query(clazzFeedback);
	query.limit(1000);
	query.descending("createdAt");
	
	return query.find().then(function(items) {
			for (var i = 0; i < items.length; i++) {
				var item = items[i];
				for (var j = 0; j< Object.keys(actions).length; j++) {
					var action = actions[ Object.keys(actions)[j]];
					item.unset(action["countKey"]);
					item.unset(action["listKey"]);
				}
			}
			return common.saveArray(items);
		});
};

//could be removed
exports.arrayToCount = function() {
	return [
		arrayToCount("FeedEntryFeedback", common.actionFeed),
		arrayToCount("FeedEntryFeedback", common.actionComment),
		arrayToCount("UserFeedback", common.actionUser),
		arrayToCount("UserFeedback", common.actionMessage),
		arrayToCount("CommentEntryFeedback", common.actionFeed),
		arrayToCount("UserFeedback", common.actionFeedEntry),
	];
};

function arrayToCount(feedbackClassName, actions) {
	var query = new Parse.Query(feedbackClassName);
	query.limit(1000);
	
	return query.find().then(function(feedbacks) {
			for (var i = 0; i < feedbacks.length; i++) {
				var feedback = feedbacks[i];
				for (var j = 0; j< Object.keys(actions).length; j++) {
					var action = actions[ Object.keys(actions)[j]];
					var list = feedback.get(action["listKey"]);
					if (list != null) {
						feedback.set(action["countKey"], list.length);
					}
				}
			}
			return common.saveArray(feedbacks);
		});
}

// user.feedback.nLikes = sum(feedEntry.feedback.nLikes, where feedEntry.user = user)
exports.sumFeedCountToUserFeedback = function() {
	return [
		sumFeedCountToUserFeedback(common.actionFeed)
	];
};

function sumFeedCountToUserFeedback(actions){
	var actionKeys = Object.keys(actions);
	
	var userQuery = new Parse.Query("User");
	userQuery.include("userFeedback");
	return userQuery.find().then( function(users) {
		return common.foreach(users, function(user){
			var feedback = user.get("userFeedback");
			
			var query = new Parse.Query("FeedEntry");
			query.include("entryFeedback");
			query.equalTo("user", user);
			return query.find().then(function(entries) { 
				if (entries != null) {
					for (var i = 0; i < actionKeys.length; i++) {
						var s = 0; 
						var key = actions[actionKeys[i]]["countKey"];
						for (var j = 0; j < entries.length; j++) {
							var entryFeedback = entries[j].get("entryFeedback");
							if (entryFeedback.get(key) != null) {
								s += entryFeedback.get(key);
							}
						}

						feedback.set(key, s);
					}
					//nPosts
					feedback.set(common.actionFeedEntry["ME_POST_FEED"]["countKey"], entries.length);
				}
				
				var query = new Parse.Query("UserMessageEntry");
				query.equalTo("entry", user);
				return query.count().then(function(n) {
					feedback.set(common.actionMessage["ME_MESSAGE_USER"]["countKey"], n);
					return feedback.save();
				});
			});
		});
	});
}


exports.getXP = function() {
    return [
		getXP("FeedEntryFeedback", [common.actionFeed]),
		getXP("UserFeedback", [common.actionUser, common.actionFeedEntry]),
		getXP("CommentEntryFeedback", [common.actionFeed]),
	];
};

function getXP(feedbackClassName, actionsList) {
	var query = new Parse.Query(feedbackClassName);
	query.limit(1000);
	
	return query.find().then(function(feedbacks) {
		for (var i = 0; i < feedbacks.length; i++) {
			var feedback = feedbacks[i];
			var s = 0;
			for (var k = 0; k < actionsList.length; k++ ) {
				actions = actionsList[k];
				for (var j = 0; j< Object.keys(actions).length; j++) {
					var action = actions[ Object.keys(actions)[j]];
					var count = feedback.get(action["countKey"]);
					if (count != null) {
						s += action["points"] * count;
					}
				}
			}
			feedback.set("xp", s);
		}
		return common.saveArray(feedbacks);
	});
}

exports.copyXPToParent = function() {
	return [
		copyXPToParent("User", "userFeedback", "xp"),
		copyXPToParent("FeedEntry", "entryFeedback", "xp"),
		copyXPToParent("FeedCommentEntry", "commentFeedback", "xp"),
	];
};

function copyXPToParent(parentClassName, feedbackKey, key) {
	var query = new Parse.Query(parentClassName);
	query.include(feedbackKey);
	query.limit(1000);
	
	return query.find().then(function(entries) {
		for (var i = 0; i < entries.length; i++) {
			var entry = entries[i];
			entry.set(key, entry.get(feedbackKey).get(key));
		}
		return common.saveArray(entries);
	});
}