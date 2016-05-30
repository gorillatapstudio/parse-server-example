var common = require('./common.js');
var integrity = require('./data_integrity.js');

/**
 * initialize
 */
exports.initialize = function(request, response, editions, hashtags, timetags) {
	var acl = new Parse.ACL();
	acl.setPublicReadAccess(true);
	acl.setPublicWriteAccess(false);
	
	var aclPublic = new Parse.ACL();
	aclPublic.setPublicReadAccess(true);
	aclPublic.setPublicWriteAccess(true);
	
	var promises = [
		getRoles().then(function(roles){
			return initRoles(roles, acl, aclPublic);
		}),
		getObjects("Edition").then(function(objects){
			return initEdition(editions, objects, acl);
		}),
		getObjects("Hashtag").then(function(objects){
			return initHashtag(hashtags, objects, acl);
		}),
		getObjects("Timetag").then(function(objects){
			return initTimetag(timetags, objects, acl);
		})
	];
	
	Parse.Promise.when(promises).then(function(){
		response.success("success");
	});
}

function getRoles() {
	var roleQuery = new Parse.Query(Parse.Role);												
	return roleQuery.find();
}

function getObjects(className) {
	var ParseClass = Parse.Object.extend(className);
	var query = new Parse.Query(ParseClass);												
	return query.find();
}

function initRoles(roles, roleACL, roleACLPublic){
	Parse.Cloud.useMasterKey();
	//roles	
	var role5 = getRole(roles, "Administrator", roleACL);
	role5.set("description", "admin");
	role5.set("level",1000);
	
	var role4 = getRole(roles, "AppDeveloper", roleACL);
	role4.set("description", "to be used");
	role4.set("level",130);

	var role3_2 = getRole(roles, "ContentModerator", roleACL);
	role3_2.set("description", "can delete posts and comments");
	role3_2.set("level",125);
	
	var role3_1 = getRole(roles, "ContentPublisher", roleACL);
	role3_1.set("description", "can publish posts and comments");
	role3_1.set("level",120);

	var role2 = getRole(roles, "ContentTester", roleACL);
	role2.set("description", "post visible to tester only");
	role2.set("level",110);
	
	var role1 = getRole(roles, "Employee", roleACLPublic);
	role1.set("description", "enabled internal parse log in");
	role1.set("level",100);
	
	var role0 = getRole(roles, "PublicUser", roleACLPublic);
	role0.set("description", "normal user");
	role0.set("level",1);
	
	return role5.save().then(function(){		
		return role4.save();
	}).then(function(){		
		role3_2.getRoles().add(role5);
		return role3_2.save();
	}).then(function(){	
		role3_1.getRoles().add(role5);
		role3_1.getRoles().add(role3_2);
		return role3_1.save();
	}).then(function(){		
		return role2.save();
	}).then(function(){		
		role1.getRoles().add(role2);
		role1.getRoles().add(role3_1);
		role1.getRoles().add(role3_2);
		role1.getRoles().add(role4);
		role1.getRoles().add(role5);
		return role1.save();
	}).then(function(){
		role0.getRoles().add(role1);
		role0.getRoles().add(role2);
		role0.getRoles().add(role3_1);
		role0.getRoles().add(role3_2);
		role0.getRoles().add(role4);
		role0.getRoles().add(role5);
		return role0.save();
	});
}

function getRole(roles, name, roleACL){
	for(var i = 0; i < roles.length; i++) { 
      	var role = roles[i];
		if (role.get("name") == name) {
			return role;
		} 
	}
	return 	new Parse.Role(name, roleACL);
}

function getObject(className, objects, name){
	for(var i = 0; i < objects.length; i++) { 
      	var object = objects[i];
		if (object.get("name") == name) {
			return object;
		} 
	}
	
	var ParseClass = Parse.Object.extend(className);
	var object = new ParseClass();
	object.set("name", name);
	return object;
}

function initEdition(editions, objects, acl){
	//edition
	var names = editions["names"];
	var names_zh = editions["names_zh"];
	var titleNames = editions["titleNames"];
	var languages = editions["languages"];
	var namesMatched = editions["namesMatched"];
	var isDefaultIndex = 0;
	var isAllIndex = names.length - 1;	
	var editions = [];
	for (var i = 0; i < names.length; i++) {
		var edition = getObject("Edition", objects, names[i]);
		if (names_zh) edition.set("name_zh", names_zh[i]);
		edition.set("titleName", titleNames[i]);
		edition.set("language", languages[i]);
		edition.set("namesMatched", namesMatched[i]);
		edition.set("pinOrder", i * 10);
		edition.set("isDefault", i == isDefaultIndex);
		edition.set("isAll", i == isAllIndex);
		edition.setACL(acl);
		editions.push(edition);
	}
	return common.saveArray(editions);
}	

function initHashtag(hashtags, objects, acl){
	//hashtag
	var names = hashtags["names"];
	var names_zh = hashtags["names_zh"];

	var isDefaultIndex = 0;
	var isAllIndex = 0;
	var isOthers = names.length - 1;
	var hashtags = [];
	for (var i = 0; i < names.length; i++) {
		var name = names[i];
		var hashtag = getObject("Hashtag", objects, name);
		if (names_zh) hashtag.set("name_zh", names_zh[i]);
		hashtag.set("pinOrder", i * 10);
		hashtag.set("isDefault", i == isDefaultIndex);
		hashtag.set("isAll", i == isAllIndex);
		hashtag.set("isOthers", i == isOthers);
		hashtag.setACL(acl);
		hashtags.push(hashtag);
	}
	return common.saveArray(hashtags);
}

function initTimetag(timetags, objects, acl){
	//timetag
	var names = timetags["names"];
	var names_zh = timetags["names_zh"];
	var periods = timetags["periods"];
	var isDefaultIndex = timetags["isDefaultIndex"];
	var isAllIndex = 0;
	var timetags = [];
	for (var i = 0; i < names.length; i++) {
		var timetag = getObject("Timetag", objects, names[i]);
		if (names_zh) timetag.set("name_zh", names_zh[i]);
		timetag.set("pinOrder", i * 10);
		timetag.set("isDefault", i == isDefaultIndex);
		timetag.set("isAll", i == isAllIndex);
		timetag.set("period", periods[i]);
		timetag.setACL(acl);
		timetags.push(timetag);
	}
	return common.saveArray(timetags);
};
	
/**
 * add user
 */

exports.addUsersToRole = function(request, response, map, cpCount) {
	if (!cpCount) cpCount = 10;
	var contentPublishers = map["ContentPublisher"];
	for (var i = 0; i < cpCount; i++) {
			var name = "cp" + (i+1) + "@gmail.com";
			contentPublishers.push(name);
	}
	
	var roleNames = [], iRole = 0;
	for (roleNames[iRole++] in map) {}

	common.foreach(roleNames, function(roleName){
		var emails = map[roleName];
		//get role for each <Role, Emails>
		var roleQuery = new Parse.Query(Parse.Role);
		roleQuery.equalTo("name", roleName)
		return roleQuery.first().then(function(role){			
			if (role != null){	
				//get emails for the <Role, Emails>
				var query = new Parse.Query(Parse.User);
				query.containedIn("email", emails);
				return query.find().then(function(users){
					return addUsersToRole(users, role);
				});
			}
		});
	}).then(function(){
		response.success("success");
	});
		
};

function addUsersToRole(users, role){
	return common.foreach(users, 
		function(user){
			return integrity.addUserToRole(user, role);
		});
}
