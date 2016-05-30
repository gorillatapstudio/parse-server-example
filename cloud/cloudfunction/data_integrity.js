var common = require('cloud/cloudfunction/common.js');




// exports.copyFeedbackXPToEntry = function copyFeedbackXPToEntry(request, feedbackKeyInEntry, xpKeys, defaultParentClassName) {
// 	Parse.Cloud.useMasterKey();
// 	var parentClassName = request.object.get("parentClassName");
// 	if (!parentClassName) parentClassName = defaultParentClassName;
// 	if (!parentClassName) return;
// 
// 	query = new Parse.Query(parentClassName);
// 	console.log(query);
// 	query.equalTo(feedbackKeyInEntry, request.object);
// 	return query.first().then(function(post) {
// 		if (post) {
// 			for (var i = 0; i<xpKeys.length; i++) {
// 				post.set(xpKeys[i], request.object.get(xpKeys[i]));
// 			}
// 			post.save();
// 		}
// 	});
// }


/**
 *  data validation
 */
exports.deleteGhostObject = function() {
	return [
		deleteGhostRelation("ActorActionFeed", ["User", "FeedEntry"], ["user", "entry"]),
		deleteGhostRelation("ActorActionUser", ["User", "User"], ["user", "entry"]),
		deleteGhostRelation("ActorActionComment", ["User", "FeedCommentEntry"], ["user", "entry"]),
		deleteGhostRelation("FeedEntry", ["User", "Edition"], ["user", "edition"]),
		deleteGhostRelation("FeedCommentEntry", ["User", "FeedEntry"], ["user", "entry"]),
		deleteGhostRelation("UserMessageEntry", ["User", "User"], ["user", "entry"]),
		deleteGhostRelation("AppFeedCommentEntry", ["User", "AppFeedbackEntry"], ["user", "entry"]),
		deleteGhostChild("FeedEntryFeedback", "entryFeedback"),
		deleteGhostChild("CommentEntryFeedback", "commentFeedback"),
		deleteGhostChild("UserFeedback", "userFeedback")
	];
};

function deleteGhostRelation(className, parentClassNames, keys){
	var clazz = Parse.Object.extend(className);
	var resultStr = "";
	
	var query = new Parse.Query(clazz);
	query.limit(1000);
	query.descending("createdAt");
	for (var i = 0; i < keys.length; i++) {
		query.include(keys[i]);
	}
	
	return query.find().then(function(entries) {
		
		var deleteEntries = [];
		for (var i = 0; i < entries.length; i++) {
			var entry = entries[i];
			
			for (var j = 0; j < keys.length; j++) {
				if (entry.get(keys[j]) == null) {
					deleteEntries.push(entry);
					break;
				}
			}
		}
		return common.foreach(deleteEntries, function(entry) {
				return entry.destroy();
			});
			
	});
};

function deleteGhostChild(childClassName, key) {
	Parse.Cloud.useMasterKey();
	var childQuery = new Parse.Query(childClassName);
	return childQuery.find().then( function(children) {
		return common.foreach(children, function(child) {
			var parentClassName = child.get("parentClassName");
			var parentQuery = new Parse.Query(parentClassName);
			parentQuery.equalTo(key, child);
			return parentQuery.first().then(function(entry) {
					if (entry == null) {
						console.log(childClassName + " found ghost child " + child.id);
						return child.destroy();
					} 
			});
		});
	});
}

//if FeedEntry.entryFeedback is null, create one
exports.ensureFeedbacks = function() {
	return [
		ensureFeedbacks("FeedEntry", "FeedEntryFeedback", "entryFeedback") , 
		ensureFeedbacks("AppFeedbackEntry", "FeedEntryFeedback", "entryFeedback") , 
		ensureFeedbacks("FeedCommentEntry", "CommentEntryFeedback", "commentFeedback") ,
		ensureFeedbacks("AppFeedbackCommentEntry", "CommentEntryFeedback", "commentFeedback") ,
		ensureFeedbacks("UserMessageEntry", "CommentEntryFeedback", "commentFeedback") ,
		ensureFeedbacks("User", "UserFeedback", "userFeedback")
	];
};

function ensureFeedbacks(parentClassName, feedbackClassName, key){
	var ClazzFeedback = Parse.Object.extend(feedbackClassName);
	
	var query = new Parse.Query(parentClassName);
	query.limit(1000);
	query.descending("createdAt");
	query.include(key);
	
	return query.find().then(function(entries) {
		
		var newEntries = [];
		for (var i = 0; i < entries.length; i++) {
			var entry = entries[i];
			
			if (entry.get(key) == null) {
				console.log(parentClassName + ": "+entry.id+ " has no feedback. creating...");
				var feedback = new ClazzFeedback();
				feedback.set("parentClassName", parentClassName);
				entry.set(key, feedback);
				newEntries.push(entry);
			}
		}
		return common.saveArray(newEntries);
	});
};



//after save
Parse.Cloud.define("addEdgeOrSelfEntryAfterSave", function(request, response) {
	Parse.Cloud.useMasterKey();
	var className = request.params.className;
	var id = request.params.id;
	addFunctionMap[className](id, function(entry) {
				//TODO
			}).then(function() {
				response.success("added");
			});
});


var addFunctionMap = { 
	"ActorActionFeed" : addActorActionFeed, 
	"ActorActionUser" : addActorActionUser, 
	"ActorActionComment" : addActorActionComment, 
	"FeedEntry" : addFeedEntry, 
	"FeedCommentEntry" : addFeedCommentEntry, 
	"UserMessageEntry" : addUserMessageEntry,
};

function addActorActionFeed(id, callback) {
	var query = new Parse.Query("ActorActionFeed");
	query.include("entry");
	query.include("entry.entryFeedback");
	query.include("entry.user");
	query.include("entry.user.userFeedback");
	return query.get(id).then(function(item) {
  		return tableToArrayToCountToXP(item, common.actionFeed, "user", "entry", "entryFeedback", true, true)
  		  	.then(function() { return callback(item);});
  	});
};

function addActorActionUser(id, callback) {
	var query = new Parse.Query("ActorActionUser");
	query.include("entry");
	query.include("entry.userFeedback");
	return query.get(id).then(function(item) {
  		return tableToArrayToCountToXP(item, common.actionUser, "user", "entry", "userFeedback", false, true)
  		  	.then(function() { return callback(item);});
  	});
};

function addActorActionComment(id, callback) {
	var query = new Parse.Query("ActorActionComment");
	query.include("entry");
	query.include("entry.commentFeedback");
	return query.get(id).then(function(item) {
		//function tableToArrayToCountToXP(item, actions, objectKeyInList, feedbackParentKey, feedbackKey, addFeedbackToEntryOwner, isAdd)
  		return tableToArrayToCountToXP(item, common.actionFeed, "user", "entry", "commentFeedback", false, true)
  		  	.then(function() { return callback(item);});
  	});
};

function addFeedEntry(id, callback) {
	var query = new Parse.Query("FeedEntry");
	query.include("user");
	query.include("user.userFeedback");
	return query.get(id).then(function(item) {
  		return tableToArrayToCountToXP(item, common.actionFeedEntry, "self", "user", "userFeedback", false, true)
  		  	.then(function() { return callback(item);});
  	});
};

function addFeedCommentEntry(id, callback) {
	var query = new Parse.Query("FeedCommentEntry");
	query.include("entry");
	query.include("entry.user");
	query.include("entry.user.userFeedback");
	return query.get(id).then(function(item) {			
		//function tableToArrayToCountToXP(item, actions, objectKeyInList, feedbackParentKey, feedbackKey, addFeedbackToEntryOwner, isAdd) {
  		return tableToArrayToCountToXP(item, common.actionComment, "self", "entry", "entryFeedback", true, true)
  		  	.then(function() { return callback(item);});
  	});
};

function addUserMessageEntry(id, callback) {
	var query = new Parse.Query("UserMessageEntry");
	query.include("user");
	query.include("user.userFeedback");
	return query.get(id).then(function(item) {
  		return tableToArrayToCountToXP(item, common.actionMessage, "self", "entry", "userFeedback", false, true)
  		  	.then(function() { return callback(item);});
  	});
};

//after delete
Parse.Cloud.define("deleteEdgeOrSelfEntry", function(request, response) {
	Parse.Cloud.useMasterKey();
	var className = request.params.className;
	var id = request.params.id;
	deleteFunctionMap[className](id, function(entry) {
		return entry.destroy();
	}).then(function() {
		response.success("deleted");
	});
});

var deleteFunctionMap = { 
	"ActorActionFeed" : deleteActorActionFeed, 
	"ActorActionUser" : deleteActorActionUser, 
	"ActorActionComment" : deleteActorActionComment, 
	"FeedEntry" : deleteFeedEntry, 
	"FeedCommentEntry" : deleteFeedCommentEntry, 
	"UserMessageEntry" : deleteUserMessageEntry,
};

function deleteActorActionFeed(id, callback) {
	var query = new Parse.Query("ActorActionFeed");
	query.include("entry");
	query.include("entry.entryFeedback");
	query.include("entry.user");
	query.include("entry.user.userFeedback");
	return query.get(id).then(function(item) {
		//function tableToArrayToCountToXP(item, actions, objectKeyInList, feedbackParentKey, feedbackKey, addFeedbackToEntryOwner, isAdd) {
  		return tableToArrayToCountToXP(item, common.actionFeed, "user", "entry", "entryFeedback", true, false)
  			.then(function() { return callback(item);});
  	});
};

function deleteActorActionUser(id, callback) {
	var query = new Parse.Query("ActorActionUser");
	query.include("entry");
	query.include("entry.userFeedback");
	return query.get(id).then(function(item) {
  		return tableToArrayToCountToXP(item, common.actionUser, "user", "entry", "userFeedback", false, false)
  			.then(function() { return callback(item);});
  	});
};

function deleteActorActionComment(id, callback) {
	var query = new Parse.Query("ActorActionComment");
	query.include("entry");
	query.include("entry.commentFeedback");
	return query.get(id).then(function(item) {
  		return tableToArrayToCountToXP(item, common.actionFeed, "user", "entry", "commentFeedback", false, false)
  			.then(function() { return callback(item);});
  	});
};

function deleteFeedEntry(id, callback) {
	var query = new Parse.Query("FeedEntry");
	query.include("user");
	query.include("user.userFeedback");
	return query.get(id).then(function(item) {
  		return tableToArrayToCountToXP(item, common.actionFeedEntry, "self", "user", "userFeedback", false, false)
  			.then(function() { 
  				return item.get("entryFeedback").destroy().then(
  					function() {return callback(item);}
  				);
  			});
  	});
};

function deleteFeedCommentEntry(id, callback) {
	var query = new Parse.Query("FeedCommentEntry");
	query.include("entry");
	query.include("entry.user");
	query.include("entry.user.userFeedback");
	return query.get(id).then(function(item) {
  		return tableToArrayToCountToXP(item, common.actionComment, "self", "entry", "entryFeedback", true, false)
  			.then(function() { 
  				return item.get("commentFeedback").destroy().then(
  					function() {return callback(item);}
  				);
  			});
  	});
};

function deleteUserMessageEntry(id, callback) {
	var query = new Parse.Query("UserMessageEntry");
	query.include("user");
	query.include("user.userFeedback");
	return query.get(id).then(function(item) {
  		return tableToArrayToCountToXP(item, common.actionMessage, "self", "entry", "userFeedback", false, false)
  			.then(function() { 
  				return item.get("commentFeedback").destroy().then(
  					function() {return callback(item);}
  				);
  			});
  	});
};

//item.entry.feedback.getList(item.action).add(item.get(objectKeyInList).id)
function tableToArrayToCountToXP(item, actions, objectKeyInList, feedbackParentKey, feedbackKey, addFeedbackToEntryOwner, isAdd) {
	var object = objectKeyInList.localeCompare("self") == 0 
		? item : item.get(objectKeyInList);
		
	var action = exports.getAction(item, actions);
	var entry = item.get(feedbackParentKey);
	var feedback = entry.get(feedbackKey);
	
	var delta = isAdd ? 1 : -1;
	if (isAdd) addIdToList(feedback, object.id, action);
		else removeIdInList(feedback, object.id, action);
	if (delta != 0) {
		exports.incCount(feedback, action, delta);
		exports.incXP(feedback, action, delta);
		exports.incXP(entry, action, delta);
		if (addFeedbackToEntryOwner) {
			var user = entry.get("user");
			exports.incCount(user.get("userFeedback"), action, delta);
			exports.incXP(user.get("userFeedback"), action, delta);
			exports.incXP(user, action, delta);
		}
		if (item.get("rating") > 0) {
			//TODO: take FeedMessageEntry separately
			return exports.updateRating(entry);
		} else {
			return entry.save();
		}
	}
}

Parse.Cloud.define("updateRating", function(request, response) {
	Parse.Cloud.useMasterKey();
	var id = request.params.id;
	var query = new Parse.Query("FeedEntry");
	
	return query.get(id).then(function(entry) {
		return exports.updateRating(entry)
			.then(function() {
					response.success("updated");
				});
	});
});

exports.updateRating = function(entry) {
	var query = new Parse.Query("FeedCommentEntry");
	query.equalTo("entry", entry);
	query.greaterThan("rating", 0);
	return query.find().then(function(items) {
		var s = 0;
		for (var i = 0; i<items.length; i++) {
			s += items[i].get("rating");
		}
		entry.set("rating", items.length == 0 ? 0 : s / items.length);
		return entry.save();
	});
}

exports.getAction = function(item, actions) {
	var actionName = item.get("action");
	if (actionName == null) actionName = Object.keys(actions)[0];
	return actions[actionName];
}

function addIdToList(feedback, objectId, action) {
	var listKey = action["listKey"];
	if (listKey != null) feedback.add(listKey, objectId);
	//console.log("add "+objectId+ " to " + listKey);
}

function removeIdInList(feedback, objectId, action) {
	var listKey = action["listKey"];
	if (listKey != null) feedback.remove(listKey, objectId);
}

function count(list, id) {
	var s = 0;
	for (var i = 0; i< list.length; i++) {
		if (list[i].localeCompare(id) == 0) {
			s++;
		}
	}
	return s;
}


exports.incCount = function(feedback, action, delta) {
	feedback.increment(action["countKey"], delta);
};

exports.incXP = function(entry, action, delta) {
	entry.increment("xp", action["points"] * delta);
};


exports.addItemToListWithIntegrityCheck = function(item, tableClassName, feedbackParentKey, feedbackKey, objectKeyInArray, action, newFeedbacks) {
	var entry = item.get(feedbackParentKey);
	if (entry == null) {
		console.log("run integrity/deleteGhostChild. " + tableClassName + "("+item.id + ")." + feedbackParentKey + " is null");
		return;
	}
	var feedback = entry.get(feedbackKey);
	if (feedback == null) {
		console.log("run integrity/ensureFeedback. " + feedbackClassName + " empty");	
	}
	
	var newFeedback = newFeedbacks == null ? feedback : newFeedbacks[feedback.id];
	if (newFeedback == null) {
		newFeedback = feedback;
	}
	var object = objectKeyInArray.localeCompare("self") == 0 
		? item : item.get(objectKeyInArray);
	addIdToList(newFeedback, object.id, action);
	exports.incCount(newFeedback, action, 1);
	if (newFeedbacks != null) {
		//add to hashtable so that it's guaranteed to write to the same feedback
		newFeedbacks[feedback.id] = newFeedback;
	}
	return newFeedback;
}

Parse.Cloud.define("addUserToRole", function(request, response) {
	var username = request.params.username;
	var roleName = request.params.role;
	
	//get role for each <Role, Emails>
	var roleQuery = new Parse.Query(Parse.Role);
	roleQuery.equalTo("name", roleName);
	return roleQuery.first().then(function(role){			
		if (role != null){	
			//get emails for the <Role, Emails>
			var query = new Parse.Query(Parse.User);
			query.equalTo("username", username);
			return query.first().then(function(user){
				return exports.addUserToRole(user, role);
			});
		}
	}).then(function(){
		response.success("success");
	});
});

exports.addUserToRole = function(user, role) {
		//oldRole.remove(user)
	var oldRoleQuery = new Parse.Query(Parse.Role);
	oldRoleQuery.equalTo("users", user);
									
	return oldRoleQuery.find().then(function(roles){
		return common.foreach(roles, function(oldRole){
			if (oldRole.get("level") == 1)
				oldRole.getUsers().remove(user); //remove the others manually
			oldRole.save();
		});
	}).then(function(){
		//role.add(user)
		role.getUsers().add(user);
		return role.save();
	}).then(function() {
		//user.save()
		user.set("role", role);
		return user.save();
	});
}





